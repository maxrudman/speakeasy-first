import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Fetches a vocabulary list from a link the user pasted, safely:
 *  - http and https only, default ports only, no usernames/passwords in the link
 *  - every address the host resolves to (including after redirects) must be public;
 *    private, loopback, link-local and other internal ranges are refused. The check runs
 *    inside the connection's DNS lookup, so a host can't switch addresses after the check.
 *  - short timeout, size limit, at most a few redirects
 *  - the page is only read as text; nothing on it is run
 * The link is never stored.
 */

/** An error whose message is safe and friendly enough to show the user. */
export class ImportError extends Error {}

export type ListSource = { kind: "text"; text: string; truncated: boolean } | { kind: "pdf"; data: Buffer };

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
/** Text sent to Claude is capped; very long lists are read from the top. */
export const MAX_TEXT_CHARS = 40_000;

const UNREADABLE =
  "We couldn't read that link. If it's private or needs a login, make it public (\"anyone with the link\") or paste the words instead.";

/* --------------------------------- Address checks --------------------------------- */

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

/** True for any address that isn't a normal public internet address. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible forms: judge the embedded IPv4 address.
    const mapped = address.toLowerCase().match(/^::(?:ffff:(?:0:)?)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    const hexMapped = address.toLowerCase().match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isBlockedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return blocked.check(address, "ipv6");
  }
  return true;
}

class BlockedAddressError extends Error {}

/** DNS lookup used for the connection itself: refuses the request if any resolved address is internal. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(new BlockedAddressError(`blocked address for ${hostname}`), "", 4);
    }
    if (options.all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
};

/* ------------------------------------ Fetching ------------------------------------- */

/** Checks a link before any request is made. Returns the URL to fetch. */
export function checkLink(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ImportError("That doesn't look like a link. It should start with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportError("Only http and https links can be imported.");
  }
  if (url.username || url.password) throw new ImportError("Links with a username or password can't be imported.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ImportError("That link uses an unusual port, so it can't be imported. Paste the words instead.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) throw new ImportError("That link points to a private address, so it can't be imported.");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new ImportError("That link points to a private address, so it can't be imported.");
  }
  return rewriteGoogleLink(url);
}

/** Google Docs, Sheets, Slides and Drive files: fetch the plain export instead of the editor page. */
function rewriteGoogleLink(url: URL): URL {
  const host = url.hostname.toLowerCase();
  const id = url.pathname.match(/\/d\/([\w-]{10,})/)?.[1];
  if (host === "docs.google.com" && id) {
    if (url.pathname.startsWith("/document/")) return new URL(`https://docs.google.com/document/d/${id}/export?format=txt`);
    if (url.pathname.startsWith("/spreadsheets/")) return new URL(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`);
    if (url.pathname.startsWith("/presentation/")) return new URL(`https://docs.google.com/presentation/d/${id}/export/txt`);
  }
  if (host === "drive.google.com" && id) return new URL(`https://drive.google.com/uc?export=download&id=${id}`);
  return url;
}

type RawResponse = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; url: URL };

function requestOnce(url: URL, deadline: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new ImportError("That link took too long to respond. Try again, or paste the words instead."));
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: remaining,
        headers: {
          "User-Agent": "SpeakEasy-VocabImport/1.0",
          Accept: "text/html,text/plain,text/csv,text/markdown,application/pdf;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0), url });
        }
        const declared = Number(res.headers["content-length"]);
        if (declared > MAX_BYTES) {
          res.destroy();
          return reject(new ImportError("That file is too large to import (over 3 MB). Paste the words instead."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new ImportError("That file is too large to import (over 3 MB). Paste the words instead."));
          } else {
            chunks.push(chunk);
          }
        });
        res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks), url }));
        res.on("error", reject);
      },
    );
    const timer = setTimeout(() => req.destroy(new ImportError("That link took too long to respond. Try again, or paste the words instead.")), remaining);
    req.on("timeout", () => req.destroy(new ImportError("That link took too long to respond. Try again, or paste the words instead.")));
    req.on("error", (err) => reject(err));
    req.on("close", () => clearTimeout(timer));
    req.end();
  });
}

/** Fetches the link and returns its text (or the PDF bytes). Throws ImportError with a friendly message. */
export async function fetchListSource(link: string): Promise<ListSource> {
  let url = checkLink(link);
  const deadline = Date.now() + TIMEOUT_MS;
  let res: RawResponse | undefined;

  try {
    for (let hop = 0; ; hop++) {
      res = await requestOnce(url, deadline);
      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.location;
      if (!location || hop >= MAX_REDIRECTS) throw new ImportError(UNREADABLE);
      url = checkLink(new URL(location, url).toString());
    }
  } catch (err) {
    if (err instanceof ImportError) throw err;
    if (err instanceof BlockedAddressError) throw new ImportError("That link points to a private address, so it can't be imported.");
    console.warn("[import] fetch failed:", (err as Error).message);
    throw new ImportError("We couldn't reach that link. Check it opens in your browser, or paste the words instead.");
  }

  const host = res.url.hostname.toLowerCase();
  if (res.status === 401 || res.status === 403 || host === "accounts.google.com" || host.startsWith("login.")) {
    throw new ImportError(UNREADABLE);
  }
  if (res.status === 404) throw new ImportError("We couldn't find that page. Check the link, or paste the words instead.");
  if (res.status >= 400) throw new ImportError(UNREADABLE);

  const type = String(res.headers["content-type"] ?? "").toLowerCase();
  const isPdf = type.includes("application/pdf") || res.body.subarray(0, 5).toString("latin1") === "%PDF-";
  if (isPdf) return { kind: "pdf", data: res.body };

  if (type && !/^(text\/|application\/(json|xhtml\+xml|xml|csv))/.test(type)) {
    throw new ImportError("We can only read web pages, plain text, Google Docs and PDFs. Paste the words instead.");
  }
  const decoded = decode(res.body, type);
  const text = /html|xml/.test(type) || /^\s*<(!doctype|html)/i.test(decoded) ? htmlToText(decoded) : decoded;
  return limitText(text);
}

/** Tidies pasted or fetched text and applies the length cap. Throws if there are no words in it. */
export function limitText(text: string): { kind: "text"; text: string; truncated: boolean } {
  const tidy = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  if (!/\p{L}{2,}/u.test(tidy)) {
    throw new ImportError("We didn't find any text in that list. If it's private, make it public, or paste the words instead.");
  }
  return { kind: "text", text: tidy.slice(0, MAX_TEXT_CHARS), truncated: tidy.length > MAX_TEXT_CHARS };
}

function decode(body: Buffer, contentType: string) {
  const charset = contentType.match(/charset=([\w-]+)/)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Turns HTML into readable text. Scripts, styles and other non-text parts are dropped, never run. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg|head|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|dt|dd|section|article|blockquote|pre|table|ul|ol)\s*>/gi, "\n")
      .replace(/<(td|th)\b[^>]*>/gi, " \t ")
      .replace(/<[^>]+>/g, " "),
  );
}

function decodeEntities(text: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "…" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return named[code.toLowerCase()] ?? m;
  });
}
