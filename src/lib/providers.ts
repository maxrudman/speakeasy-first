import "server-only";

/**
 * Every outside service the app can use, and how to tell whether it's configured.
 * Features turn themselves off when their key is missing, so nothing here is required
 * except DATABASE_URL and SESSION_SECRET.
 */
export type ProviderId = "anthropic" | "openai" | "deepgram" | "assemblyai";

export const PROVIDERS: Record<ProviderId, { label: string; env: string; purpose: string }> = {
  anthropic: { label: "Claude (Anthropic)", env: "ANTHROPIC_API_KEY", purpose: "Vocabulary, questions and coach" },
  openai: { label: "OpenAI", env: "OPENAI_API_KEY", purpose: "Whisper transcription and backup AI" },
  deepgram: { label: "Deepgram", env: "DEEPGRAM_API_KEY", purpose: "Backup transcription" },
  assemblyai: { label: "AssemblyAI", env: "ASSEMBLYAI_API_KEY", purpose: "Backup transcription" },
};

export function providerKey(id: ProviderId): string | null {
  const value = process.env[PROVIDERS[id].env]?.trim();
  return value ? value : null;
}

export function isMockAi() {
  return process.env.SPEAKEASY_MOCK_AI === "1" || process.env.SPEAKEASY_MOCK_AI === "true";
}

/** fetch() with a hard timeout. */
export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 5000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
