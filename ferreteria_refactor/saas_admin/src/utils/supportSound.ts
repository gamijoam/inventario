let lastPlayedAt = 0;
let unlockRegistered = false;
let unlocked = false;

const getAudioContext = () => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const w = window as any;
    if (!w.__supportAudioContext) w.__supportAudioContext = new AudioContextCtor();
    return w.__supportAudioContext as AudioContext;
};

const playTone = (ctx: AudioContext, freq: number, start: number, duration: number, volume: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'triangle';
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
        console.debug('Support audio unlock unavailable', error);
    }
};

export const initSupportSound = () => {
    if (unlockRegistered) return;
    unlockRegistered = true;
    const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const handler = () => {
        unlockAudio();
        events.forEach(event => window.removeEventListener(event, handler, true));
    };
    events.forEach(event => window.addEventListener(event, handler, true));
};

export const playSupportSound = async () => {
    const now = Date.now();
    if (now - lastPlayedAt < 900) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') await ctx.resume();
        if (ctx.state === 'suspended' && !unlocked) return;
        lastPlayedAt = now;
        playTone(ctx, 880, 0, 0.12, 0.24);
        playTone(ctx, 660, 0.1, 0.12, 0.2);
        playTone(ctx, 990, 0.2, 0.18, 0.18);
    } catch (error) {
        console.debug('Support sound unavailable', error);
    }
};
