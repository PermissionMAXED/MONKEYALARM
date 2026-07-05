import { bus } from '../core/EventBus.js';
import SynthSounds from './SynthSounds.js';
import { PHASES } from '../core/constants.js';
import * as THREE from 'three';

// game:sfx payload names → SynthSounds method names.
const SFX_METHODS = {
  footstep: 'footstep',
  jump: 'jump',
  land: 'land',
  catch: 'catchSuccess',
  caught_self: 'caughtSelf',
  round_win: 'roundWin',
  round_lose: 'roundLose',
  alarm: 'alarmSiren',
  gate_open: 'gateOpen',
  pickup: 'itemPickup',
  escaped: 'escapeStinger'
};

export default class AudioManager {
  constructor(camera) {
    // THREE.AudioListener an Camera hängen
    this._listener = new THREE.AudioListener();
    camera.add(this._listener);
    this._ctx = this._listener.context;

    // Master-Gain
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.5;
    this._masterGain.connect(this._ctx.destination);

    // Sub-Gains
    this._sfxGain = this._ctx.createGain(); this._sfxGain.gain.value = 0.8; this._sfxGain.connect(this._masterGain);
    this._ambientGain = this._ctx.createGain(); this._ambientGain.gain.value = 0.4; this._ambientGain.connect(this._masterGain);
    this._uiGain = this._ctx.createGain(); this._uiGain.gain.value = 0.6; this._uiGain.connect(this._masterGain);

    this._autoplayResolved = false;
    /** @type {{ output: GainNode, stop: Function } | null} */
    this._ambient = null;
    this._ambientId = null;
    this._synth = new SynthSounds(this._ctx);
    this._handlers = {};
    this._subscribe();
  }

  resume() {
    if (this._ctx.state === 'suspended') this._ctx.resume();
    this._autoplayResolved = true;
  }

  setVolume(channel, value) {
    const v = Math.max(0, Math.min(1, value));
    const map = { master: this._masterGain, sfx: this._sfxGain, ambient: this._ambientGain, ui: this._uiGain };
    if (map[channel]) map[channel].gain.value = v;
  }

  // Spielt einen One-Shot Sound via SynthSounds-Methode
  playOneShot(methodName, category = 'sfx') {
    if (!this._autoplayResolved) return;
    const gainMap = { sfx: this._sfxGain, ui: this._uiGain };
    const gain = gainMap[category] || this._sfxGain;
    if (typeof this._synth[methodName] === 'function') {
      this._synth[methodName](gain);
    }
  }

  startAmbient(mapId) {
    // game:hud re-fires mid-round (e.g. infection conversion) — don't restart
    // the bed if the map hasn't changed.
    if (this._ambient && this._ambientId === mapId) return;
    this.stopAmbient();
    const ambient = this._synth.createAmbient(mapId, this._ctx);
    if (ambient) {
      ambient.output.connect(this._ambientGain);
      this._ambient = ambient;
      this._ambientId = mapId;
    }
  }

  stopAmbient() {
    if (this._ambient) {
      this._ambient.stop();
      try { this._ambient.output.disconnect(); } catch { /* already disconnected */ }
      this._ambient = null;
    }
    this._ambientId = null;
  }

  _subscribe() {
    const on = (event, fn) => {
      this._handlers[event] = fn;
      bus.on(event, fn);
    };
    on('game:phase', (p) => {
      if (p.phase === PHASES.HIDING) this.playOneShot('phaseHiding', 'sfx');
      else if (p.phase === PHASES.SEEKING) this.playOneShot('phaseSeeking', 'sfx');
      else if (p.phase === PHASES.ROUND_END) this.playOneShot('phaseRoundEnd', 'sfx');
    });
    on('game:timer', (p) => {
      if (p.remainingSec != null && p.remainingSec <= 10 && p.remainingSec > 0) {
        this.playOneShot('timerWarning', 'sfx');
      }
    });
    on('game:sfx', (p) => {
      const method = p ? SFX_METHODS[p.name] : null;
      if (method) this.playOneShot(method, 'sfx');
    });
    on('game:hud', (p) => {
      if (p.mapId) this.startAmbient(p.mapId);
    });
    on('game:menu', () => this.stopAmbient());
    on('ui:click', () => this.playOneShot('buttonClick', 'ui'));
    on('ui:ready', () => this.playOneShot('readyToggle', 'ui'));
    on('ui:start_game', () => this.playOneShot('gameStart', 'ui'));
  }

  // Full shutdown (app teardown only — the game keeps ONE AudioManager alive
  // for its whole lifetime and calls stopAmbient() between rounds instead).
  dispose() {
    this.stopAmbient();
    for (const [event, fn] of Object.entries(this._handlers)) {
      bus.off(event, fn);
    }
    this._handlers = {};
    this._masterGain.disconnect();
    this._sfxGain.disconnect();
    this._ambientGain.disconnect();
    this._uiGain.disconnect();
  }
}
