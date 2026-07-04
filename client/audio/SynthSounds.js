export default class SynthSounds {
  constructor(ctx) { this._ctx = ctx; }

  _osc(type, freq, gainVal, duration, targetGain) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(targetGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  _sweep(type, startFreq, endFreq, gainVal, duration, targetGain) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration * 0.9);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(targetGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  buttonClick(gain) { this._sweep('square', 800, 400, 0.3, 0.1, gain); }
  readyToggle(gain) { this._osc('sine', 600, 0.2, 0.15, gain); }

  gameStart(gain) {
    const ctx = this._ctx;
    [200, 300, 400].forEach(f => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(g); g.connect(gain);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.55);
    });
  }

  phaseHiding(gain) {
    const ctx = this._ctx;
    this._sweep('sine', 500, 200, 0.2, 0.8, gain);
    // Echo/Delay
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.15;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine'; osc2.frequency.value = 400;
    g2.gain.setValueAtTime(0.1, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc2.connect(g2); g2.connect(delay); delay.connect(feedback); feedback.connect(delay);
    delay.connect(gain);
    osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.9);
  }

  phaseSeeking(gain) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this._osc('sawtooth', 700, 0.25, 0.15, gain), i * 130);
    }
  }

  phaseRoundEnd(gain) {
    this._sweep('sine', 300, 600, 0.2, 0.6, gain);
  }

  catchSuccess(gain) { this._sweep('sine', 1000, 200, 0.2, 0.2, gain); }

  timerWarning(gain) { this._osc('square', 900, 0.15, 0.12, gain); }

  createAmbient(mapId, ctx) {
    // Einfaches Low-Freq-Brummen als Ambient
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    osc.connect(gain);
    osc.start();
    return gain; // gain node zum connecten/disconnecten
  }
}
