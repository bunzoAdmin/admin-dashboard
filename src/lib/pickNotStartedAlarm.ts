/** Web Audio emergency siren + tab flash for unstarted pick tasks. */

const SIREN_ON_MS = 2_200;
const SIREN_GAP_MS = 600;

let audioCtx: AudioContext | null = null;
let alarmTimer: ReturnType<typeof setInterval> | null = null;
let titleTimer: ReturnType<typeof setInterval> | null = null;
let savedTitle: string | null = null;
let activeCount = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function unlockPickAlarmAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') void ctx.resume();
}

/** Harsh two-tone siren — sawtooth + square layered, ~1.4s burst. */
export function playPickAlarmSiren(): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.001, now);
  master.gain.linearRampToValueAtTime(0.42, now + 0.03);
  master.gain.setValueAtTime(0.42, now + 1.25);
  master.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
  master.connect(ctx.destination);

  const tones: Array<{ type: OscillatorType; low: number; high: number; mix: number }> = [
    { type: 'sawtooth', low: 780, high: 1240, mix: 0.55 },
    { type: 'square', low: 520, high: 980, mix: 0.35 }
  ];

  for (const { type, low, high, mix } of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;

    const steps = 10;
    const step = 0.13;
    for (let i = 0; i < steps; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? low : high, now + i * step);
    }

    gain.gain.setValueAtTime(mix, now);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  for (let c = 0; c < 4; c++) {
    const t = now + 0.08 + c * 0.34;
    const chirp = ctx.createOscillator();
    const cg = ctx.createGain();
    chirp.type = 'square';
    chirp.frequency.setValueAtTime(1600, t);
    cg.gain.setValueAtTime(0.001, t);
    cg.gain.linearRampToValueAtTime(0.22, t + 0.015);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    chirp.connect(cg);
    cg.connect(master);
    chirp.start(t);
    chirp.stop(t + 0.1);
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([180, 80, 180, 80, 220]);
  }
}

function alarmTitle(): string {
  return `🚨 ${activeCount} PICK NOT STARTED`;
}

function startTitleFlash(): void {
  if (typeof document === 'undefined') return;
  if (!titleTimer) {
    savedTitle = document.title;
    let flip = false;
    titleTimer = setInterval(() => {
      flip = !flip;
      document.title = flip ? alarmTitle() : savedTitle ?? 'Bunzo Admin';
    }, 550);
  }
}

function stopTitleFlash(): void {
  if (titleTimer) {
    clearInterval(titleTimer);
    titleTimer = null;
  }
  if (savedTitle != null) {
    document.title = savedTitle;
    savedTitle = null;
  }
}

function tickAlarm(): void {
  playPickAlarmSiren();
  startTitleFlash();
}

function stopAlarmLoop(): void {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  stopTitleFlash();
}

/** Start/stop looping siren based on unstarted pick count. */
export function syncPickNotStartedAlarm(count: number | null): void {
  const n = count ?? 0;
  if (n <= 0) {
    activeCount = 0;
    stopAlarmLoop();
    return;
  }

  activeCount = n;
  unlockPickAlarmAudio();

  if (alarmTimer) return;

  tickAlarm();
  alarmTimer = setInterval(tickAlarm, SIREN_ON_MS + SIREN_GAP_MS);
}

export function disposePickNotStartedAlarm(): void {
  stopAlarmLoop();
  activeCount = 0;
  if (audioCtx) {
    void audioCtx.close();
    audioCtx = null;
  }
}
