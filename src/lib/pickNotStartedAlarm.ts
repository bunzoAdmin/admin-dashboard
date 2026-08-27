/** Web Audio emergency siren + tab flash + background notifications for unstarted pick tasks. */

const SIREN_ON_MS = 2_200;
const SIREN_GAP_MS = 600;
const BG_NOTIFY_MIN_MS = 25_000;
/** Minimal silent WAV — keeps the tab in Chrome's "audible" state so siren can loop in background. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

let audioCtx: AudioContext | null = null;
let keepaliveEl: HTMLAudioElement | null = null;
let alarmTimer: ReturnType<typeof setInterval> | null = null;
let titleTimer: ReturnType<typeof setInterval> | null = null;
let savedTitle: string | null = null;
let activeCount = 0;
let sessionActive = false;
let lastBgNotifyMs = 0;
let lastNotification: Notification | null = null;
let autoUnlockInstalled = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

function startKeepaliveAudio(): void {
  if (keepaliveEl || typeof Audio === 'undefined') return;
  keepaliveEl = new Audio(SILENT_WAV);
  keepaliveEl.loop = true;
  keepaliveEl.volume = 0.02;
  void keepaliveEl.play().catch(() => {});
}

function stopKeepaliveAudio(): void {
  if (!keepaliveEl) return;
  keepaliveEl.pause();
  keepaliveEl.src = '';
  keepaliveEl = null;
}

async function ensureAudioRunning(): Promise<boolean> {
  if (!sessionActive) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== 'running') return false;
  if (keepaliveEl?.paused) void keepaliveEl.play().catch(() => {});
  return true;
}

async function activatePickAlarmSession(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (sessionActive && ctx.state === 'running') {
    if (keepaliveEl?.paused) void keepaliveEl.play().catch(() => {});
    return true;
  }

  try {
    await ctx.resume();
    startKeepaliveAudio();
    sessionActive = true;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void requestNotificationPermission();
    }
    return ctx.state === 'running';
  } catch {
    sessionActive = false;
    return false;
  }
}

/** Browser autoplay policy requires a user gesture — arm audio on any normal interaction. */
export function unlockPickAlarmAudio(): void {
  void activatePickAlarmSession();
}

/**
 * Wire global unlock once for the authenticated shell. First click/keypress anywhere
 * (nav, login button, order row, etc.) arms audio — no separate enable step.
 */
export function installPickAlarmAutoUnlock(): () => void {
  if (typeof window === 'undefined' || autoUnlockInstalled) return () => {};
  autoUnlockInstalled = true;

  const unlock = () => unlockPickAlarmAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    autoUnlockInstalled = false;
  };
}

/** Harsh two-tone siren — sawtooth + square layered, ~1.4s burst. */
export function playPickAlarmSiren(): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;

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

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && !document.hidden) {
    navigator.vibrate([180, 80, 180, 80, 220]);
  }
}

function clearBackgroundNotification(): void {
  lastNotification?.close();
  lastNotification = null;
}

function maybeShowBackgroundNotification(): void {
  if (typeof document === 'undefined' || !document.hidden || activeCount <= 0) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const now = Date.now();
  if (now - lastBgNotifyMs < BG_NOTIFY_MIN_MS) return;
  lastBgNotifyMs = now;

  const body = `${activeCount} confirmed order${activeCount === 1 ? '' : 's'} waiting — no picker activity`;
  lastNotification?.close();
  lastNotification = new Notification('Pick not started', {
    body,
    tag: 'bunzo-pick-not-started',
    requireInteraction: true
  });
  lastNotification.onclick = () => {
    window.focus();
    lastNotification?.close();
  };
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

async function tickAlarm(): Promise<void> {
  const ready = await ensureAudioRunning();
  if (ready) playPickAlarmSiren();
  startTitleFlash();
  maybeShowBackgroundNotification();
}

function stopAlarmLoop(): void {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  stopTitleFlash();
  clearBackgroundNotification();
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
  void ensureAudioRunning();

  if (alarmTimer) return;

  void tickAlarm();
  alarmTimer = setInterval(() => void tickAlarm(), SIREN_ON_MS + SIREN_GAP_MS);
}

export function disposePickNotStartedAlarm(): void {
  stopAlarmLoop();
  activeCount = 0;
  stopKeepaliveAudio();
  sessionActive = false;
  if (audioCtx) {
    void audioCtx.close();
    audioCtx = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (activeCount <= 0 || !sessionActive) return;
    void ensureAudioRunning().then((ready) => {
      if (ready && document.hidden) void tickAlarm();
    });
  });
}
