// Procedural Web Audio synthesis for MONKEYALARM!. Every sound is built from
// oscillators and filtered white noise — there are no audio asset files.
// One-shot methods all take the destination GainNode; createAmbient returns a
// { output, stop } handle so AudioManager can halt a bed without leaks.

export default class SynthSounds {
  constructor(ctx) {
    this._ctx = ctx;
    this._stepToggle = false;
    this._noiseBuffer = null;
  }

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

  /** Lazily created shared 1-second white-noise buffer. */
  _getNoiseBuffer() {
    if (!this._noiseBuffer) {
      const ctx = this._ctx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buffer;
    }
    return this._noiseBuffer;
  }

  /** White-noise tap through a lowpass filter with exponential decay. */
  _noise(duration, filterFreq, gainVal, targetGain) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._getNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(targetGain);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + duration + 0.05);
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

  /** Alarm ding + rising whoop — a satisfying catch confirmation. */
  catchSuccess(gain) {
    this._osc('sine', 1318.5, 0.22, 0.35, gain);
    this._osc('sine', 1975.5, 0.1, 0.25, gain);
    setTimeout(() => this._sweep('sawtooth', 350, 900, 0.14, 0.25, gain), 90);
  }

  timerWarning(gain) { this._osc('square', 900, 0.15, 0.12, gain); }

  /** ~60ms filtered noise tap, alternating pitch so steps don't sound robotic. */
  footstep(gain) {
    this._stepToggle = !this._stepToggle;
    this._noise(0.06, this._stepToggle ? 900 : 650, 0.22, gain);
  }

  /** Quick rising chirp. */
  jump(gain) { this._sweep('sine', 300, 620, 0.16, 0.12, gain); }

  /** Low sine thump + noise tap. */
  land(gain) {
    this._osc('sine', 90, 0.22, 0.15, gain);
    this._noise(0.09, 500, 0.14, gain);
  }

  /** Descending two-note minor sting (you got caught). */
  caughtSelf(gain) {
    this._osc('triangle', 392, 0.22, 0.3, gain);
    setTimeout(() => this._osc('triangle', 311.1, 0.22, 0.35, gain), 250);
  }

  /** Short ascending major fanfare. */
  roundWin(gain) {
    const notes = [523.25, 659.25, 784, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => this._osc('triangle', f, 0.18, i === notes.length - 1 ? 0.55 : 0.25, gain), i * 180);
    });
  }

  /** Short descending sad cue. */
  roundLose(gain) {
    const notes = [659.25, 523.25, 415.3, 349.23];
    notes.forEach((f, i) => {
      setTimeout(() => this._osc('sine', f, 0.16, i === notes.length - 1 ? 0.65 : 0.3, gain), i * 240);
    });
  }

  /**
   * Builds a quiet layered ambient bed for a map id.
   * @param {string} mapId
   * @param {AudioContext} ctx
   * @returns {{ output: GainNode, stop: Function }} `stop()` halts every
   *   internal oscillator/noise loop and clears all pending timers.
   */
  createAmbient(mapId, ctx) {
    const output = ctx.createGain();
    const sources = []; // started nodes that must be .stop()ed
    const timers = [];  // pending setTimeout ids
    let stopped = false;

    const gainNode = (value, dest = output) => {
      const g = ctx.createGain();
      g.gain.value = value;
      g.connect(dest);
      return g;
    };
    const filter = (type, freq, dest, q) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      if (q !== undefined) f.Q.value = q;
      f.connect(dest);
      return f;
    };
    const osc = (type, freq, dest) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(dest);
      o.start();
      sources.push(o);
      return o;
    };
    const noiseLoop = (dest) => {
      const src = ctx.createBufferSource();
      src.buffer = this._getNoiseBuffer();
      src.loop = true;
      src.connect(dest);
      src.start();
      sources.push(src);
      return src;
    };
    // Repeatedly runs fn with a random delay in [minMs, maxMs].
    const schedule = (minMs, maxMs, fn) => {
      const next = () => {
        timers.push(setTimeout(() => {
          if (stopped) return;
          fn();
          next();
        }, minMs + Math.random() * (maxMs - minMs)));
      };
      next();
    };
    const later = (ms, fn) => {
      timers.push(setTimeout(() => { if (!stopped) fn(); }, ms));
    };

    switch (mapId) {
      case 'JUNGLE_TEMPLE': {
        // Low wind + sparse random bird chirps.
        noiseLoop(filter('lowpass', 240, gainNode(0.05)));
        schedule(3000, 9000, () => {
          const f = 1600 + Math.random() * 900;
          this._sweep('sine', f, f + 350, 0.06, 0.15, output);
          later(180, () => this._sweep('sine', f + 200, f - 100, 0.05, 0.12, output));
        });
        break;
      }
      case 'CITY_ZOO': {
        // Distant city hum + occasional animal call.
        osc('sawtooth', 48, filter('lowpass', 120, gainNode(0.035)));
        noiseLoop(filter('lowpass', 400, gainNode(0.012)));
        schedule(6000, 14000, () => {
          this._sweep('sine', 480, 300, 0.05, 0.5, output);
        });
        break;
      }
      case 'BANANA_FACTORY': {
        // Machine hum + slow rhythmic clank.
        osc('sawtooth', 55, filter('lowpass', 180, gainNode(0.05)));
        schedule(2200, 2200, () => {
          this._osc('square', 210, 0.04, 0.08, output);
          this._osc('square', 317, 0.025, 0.07, output);
          this._noise(0.06, 1800, 0.035, output);
        });
        break;
      }
      case 'TREETOP_VILLAGE': {
        // Wind through an LFO-modulated bandpass + wood creaks.
        const windBand = filter('bandpass', 420, gainNode(0.06), 0.8);
        noiseLoop(windBand);
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 220;
        lfoDepth.connect(windBand.frequency);
        osc('sine', 0.13, lfoDepth);
        schedule(5000, 12000, () => {
          this._sweep('sawtooth', 95, 70, 0.035, 0.4, output);
        });
        break;
      }
      case 'MONKEY_BREAK': {
        // Deep prison drone + faint distant alarm whoop every ~20s.
        osc('sine', 55, gainNode(0.045));
        osc('sine', 55.7, gainNode(0.03));
        schedule(17000, 23000, () => {
          const t = ctx.currentTime;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(420, t);
          o.frequency.linearRampToValueAtTime(840, t + 0.7);
          o.frequency.linearRampToValueAtTime(420, t + 1.4);
          g.gain.setValueAtTime(0.02, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
          o.connect(g); g.connect(output);
          o.start(t); o.stop(t + 1.7);
        });
        break;
      }
      case 'BANANA_BAY': {
        // Slow wave washes + sparse gull cries + a distant buoy bell.
        const wash = gainNode(0.035);
        const washDepth = ctx.createGain();
        washDepth.gain.value = 0.028;
        washDepth.connect(wash.gain);
        osc('sine', 0.14, washDepth);
        noiseLoop(filter('lowpass', 500, wash));
        schedule(7000, 15000, () => {
          this._sweep('sine', 1250, 880, 0.045, 0.35, output);
          later(300, () => this._sweep('sine', 1180, 840, 0.035, 0.3, output));
        });
        schedule(12000, 20000, () => {
          this._osc('sine', 523.25, 0.03, 1.2, output);
          this._osc('sine', 785, 0.015, 0.8, output);
        });
        break;
      }
      case 'SPACE_CENTER': {
        // Electrical hum + occasional radio blip beeps.
        osc('triangle', 60, gainNode(0.035));
        osc('sine', 120, gainNode(0.015));
        schedule(6000, 14000, () => {
          const count = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < count; i++) {
            later(i * 140, () => this._osc('square', i % 2 ? 1580 : 1180, 0.03, 0.06, output));
          }
        });
        break;
      }
      default: {
        // Generic bed for unknown map ids: soft low hum + faint air.
        osc('sine', 60, gainNode(0.04));
        noiseLoop(filter('lowpass', 300, gainNode(0.015)));
        break;
      }
    }

    const stop = () => {
      stopped = true;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const s of sources) {
        try { s.stop(); } catch { /* already stopped */ }
      }
      sources.length = 0;
    };

    return { output, stop };
  }
}
