let lastPlayedAt = 0;
let unlockRegistered = false;
let unlocked = false;

const getAudioContext = () => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!window.__orgChatAudioContext) {
    window.__orgChatAudioContext = new AudioContextCtor();
  }
  return window.__orgChatAudioContext;
};

const playTone = (ctx, freq, start, duration, volume) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
};

const unlockAudio = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.01);
    unlocked = true;
  } catch (error) {
    console.debug('Org chat audio unlock unavailable', error);
  }
};

export const initOrgChatSound = () => {
  if (typeof window === 'undefined' || unlockRegistered) return;
  unlockRegistered = true;
  const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
  const handler = () => {
    unlockAudio();
    events.forEach(event => window.removeEventListener(event, handler, true));
  };
  events.forEach(event => window.addEventListener(event, handler, true));
};

export const playOrgChatSound = async () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastPlayedAt < 900) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state === 'suspended' && !unlocked) return;
    lastPlayedAt = now;
    playTone(ctx, 740, 0, 0.12, 0.22);
    playTone(ctx, 988, 0.1, 0.16, 0.2);
  } catch (error) {
    console.debug('Org chat sound unavailable', error);
  }
};
