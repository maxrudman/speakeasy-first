import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configuredTranscribers, transcribe } from "./transcribe";

const audio = new Blob([new Uint8Array(2000)], { type: "audio/webm" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  for (const k of ["OPENAI_API_KEY", "DEEPGRAM_API_KEY", "ASSEMBLYAI_API_KEY", "SPEAKEASY_MOCK_TRANSCRIPTION"]) delete process.env[k];
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("transcription cascade", () => {
  it("reports when no server tier is configured", async () => {
    expect(configuredTranscribers()).toEqual([]);
    await expect(transcribe(audio)).resolves.toEqual({ ok: false, reason: "none_configured", tried: [] });
  });

  it("uses Whisper and maps segment confidence onto words", async () => {
    process.env.OPENAI_API_KEY = "sk-test-whisper-1";
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      json({
        text: "I led the project.",
        segments: [{ start: 0, end: 3, avg_logprob: -0.05, no_speech_prob: 0.01 }],
        words: [{ word: "I", start: 0.1, end: 0.2 }, { word: "led", start: 0.3, end: 0.5 }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await transcribe(audio, { language: "en" });
    expect(r).toMatchObject({ ok: true, provider: "whisper", text: "I led the project." });
    if (r.ok) expect(r.words[0].confidence).toBeCloseTo(Math.exp(-0.05));
    expect(String(fetchMock.mock.calls[0][0])).toContain("/audio/transcriptions");
  });

  it("retries Whisper once on 5xx, then falls through to Deepgram", async () => {
    process.env.OPENAI_API_KEY = "sk-test-whisper-2";
    process.env.DEEPGRAM_API_KEY = "dg-test";
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("openai")
        ? json({ error: "down" }, 503)
        : json({ results: { channels: [{ alternatives: [{ transcript: "Hello there", words: [{ word: "hello", punctuated_word: "Hello", confidence: 0.4 }] }] }] } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await transcribe(audio);
    expect(r).toMatchObject({ ok: true, provider: "deepgram", text: "Hello there", words: [{ word: "Hello", confidence: 0.4 }] });
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("openai"))).toHaveLength(2);
  });

  it("treats empty transcripts everywhere as no speech", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-test-2";
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: { channels: [{ alternatives: [{ transcript: "" }] }] } })));
    await expect(transcribe(audio)).resolves.toMatchObject({ ok: false, reason: "no_speech" });
  });

  it("does not retry a 400 and reports all_failed", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-test-3";
    const fetchMock = vi.fn(async () => json({ err: "bad audio" }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcribe(audio)).resolves.toMatchObject({ ok: false, reason: "all_failed", tried: ["deepgram"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
