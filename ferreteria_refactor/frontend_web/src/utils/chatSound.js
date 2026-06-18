let lastPlayedAt = 0;

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

export const playOrgChatSound = async () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastPlayedAt < 900) return;
  lastPlayedAt = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    playTone(ctx, 740, 0, 0.12, 0.18);
    playTone(ctx, 988, 0.1, 0.16, 0.16);
  } catch (error) {
    console.debug('Org chat sound unavailable', error);
  }
};
