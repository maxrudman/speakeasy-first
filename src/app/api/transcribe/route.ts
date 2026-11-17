import { NextResponse } from "next/server";
import { jsonError, withUser } from "@/lib/api";
import { MAX_RECORDING_SECONDS, MAX_UPLOAD_BYTES, SUPPORTED_AUDIO_TYPES } from "@/lib/audio-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { configuredTranscribers, transcribe } from "@/lib/transcribe";

export const maxDuration = 60;

/** Lets the recorder know whether server transcription is available at all. */
export const GET = withUser(async () => {
  return NextResponse.json({ available: configuredTranscribers().length > 0 });
});

/**
 * Transcribes one recorded answer. The audio arrives as multipart form data,
 * stays in memory for this request only, and is never stored or logged.
 */
export const POST = withUser(async (req, user) => {
  const limited = await enforceRateLimit("transcribe", user.id);
  if (limited) return limited;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return jsonError("This recording is too long to transcribe automatically. Type or paste your answer.", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("We couldn't read that recording. Try recording again.", 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return jsonError("The recording was empty. Try recording again.", 400);
  if (audio.size > MAX_UPLOAD_BYTES) {
    return jsonError("This recording is too long to transcribe automatically. Type or paste your answer.", 413);
  }
  const baseType = audio.type.split(";")[0].trim().toLowerCase();
  if (baseType && !SUPPORTED_AUDIO_TYPES.includes(baseType)) {
    return jsonError("That audio format isn't supported. Try recording again.", 415);
  }
  const seconds = Number(form.get("seconds") ?? 0);
  if (seconds > MAX_RECORDING_SECONDS + 5) {
    return jsonError("Answers can be up to 5 minutes. Type or paste the rest of your answer.", 413);
  }
  const rawLang = String(form.get("language") ?? "").slice(0, 2).toLowerCase();
  const language = /^[a-z]{2}$/.test(rawLang) ? rawLang : undefined;

  const result = await transcribe(audio, { language });
  return NextResponse.json(result);
});
