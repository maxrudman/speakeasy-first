/** Shared by the recorder and /api/transcribe. */

/** Longest answer we record (and transcribe). */
export const MAX_RECORDING_SECONDS = 5 * 60;
/** Shorter takes are treated as accidental taps. */
export const MIN_RECORDING_SECONDS = 1;
/** Vercel functions accept bodies up to 4.5 MB; stay under it. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Low bitrate keeps 5 minutes of speech near 1.2 MB, plenty for transcription. */
export const RECORDING_BITS_PER_SECOND = 32_000;

export const SUPPORTED_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac", "audio/x-m4a"];
