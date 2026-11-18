"use client";

/**
 * Tiny synthesized sound effects (no audio files): applause, an elevator ding, reaction pops,
 * a level-up fanfare. Built with the Web Audio API, quiet by default, and silenced by the
 * mute toggle (saved per browser) or when the browser has no Web Audio support.
 */

const MUTE_KEY = "se-sound-muted";
export const SOUND_EVENT = "se-sound-change";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || isMuted()) return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(SOUND_EVENT));
}

/** Call inside a tap/click so browsers allow audio to start later (iOS Safari especially). */
export function unlockAudio() {
  audio();
}

function tone(c: AudioContext, freq: number, at: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Elevator "ding": two soft bell tones. */
export function playDing() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 1318.5, t, 0.9, 0.12);
  tone(c, 1046.5, t + 0.28, 1.1, 0.1);
}

/** A soft pop for each audience reaction. */
export function playPop(good = true) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(good ? 520 : 300, t);
  osc.frequency.exponentialRampToValueAtTime(good ? 880 : 180, t + 0.12);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Applause made of many short filtered noise "claps". intensity 0–1 sets length and volume. */
export function playApplause(intensity = 0.7) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime;
  const length = 0.8 + intensity * 2.2;
  const claps = Math.round(18 + intensity * 70);
  const buf = noiseBuffer(c, 0.05);
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.12 + intensity * 0.12, t0 + 0.25);
  master.gain.setValueAtTime(0.12 + intensity * 0.12, t0 + length * 0.7);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  master.connect(c.destination);
  for (let i = 0; i < claps; i++) {
    const at = t0 + Math.random() * length * 0.92;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900 + Math.random() * 1800;
    filter.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.3 + Math.random() * 0.7, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    src.connect(filter).connect(g).connect(master);
    src.start(at);
    src.stop(at + 0.06);
  }
}

/** Rising arpeggio for level-ups and badges. */
export function playFanfare() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.11, 0.35 + (i === 3 ? 0.4 : 0), 0.09, "triangle"));
}

/** A low, short "hmm" for a disappointed crowd. */
export function playGroan() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(190, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.6);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(filter).connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.75);
}
