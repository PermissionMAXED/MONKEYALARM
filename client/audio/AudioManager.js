import { bus } from '../core/EventBus.js';
import SynthSounds from './SynthSounds.js';
import { PHASES } from '../core/constants.js';
import * as THREE from 'three';

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
    this._ambientNodes = [];
    this._synth = new SynthSounds(this._ctx);
    this._bgMusic = null;
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
    this.stopAmbient();
    const node = this._synth.createAmbient(mapId, this._ctx);
    if (node) {
      node.connect(this._ambientGain);
      this._ambientNodes.push(node);
    }
  }

  stopAmbient() {
    for (const n of this._ambientNodes) {
      try { n.disconnect(); } catch(e) {}
    }
    this._ambientNodes = [];
  }

  playBackgroundMusic() {
    if (!this._autoplayResolved) return;
    const loader = new THREE.AudioLoader();
    loader.load(
      './audio/monkeys-spinning-monkeys.mp3',
      (buffer) => {
        if (this._bgMusic) this.stopBackgroundMusic();
        const audio = new THREE.Audio(this._listener);
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.3);
        audio.play();
        this._bgMusic = audio;
      },
      undefined,
      (err) => console.warn('AudioManager: Background music could not be loaded.', err)
    );
  }

  stopBackgroundMusic() {
    if (this._bgMusic) {
      this._bgMusic.stop();
      this._bgMusic = null;
    }
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
    on('game:feed', (p) => {
      if (p.text && p.text.includes('caught')) this.playOneShot('catchSuccess', 'sfx');
    });
    on('game:timer', (p) => {
      if (p.remainingSec != null && p.remainingSec <= 10 && p.remainingSec > 0) {
        this.playOneShot('timerWarning', 'sfx');
      }
    });
    on('game:hud', (p) => {
      if (p.mapName) this.startAmbient(p.mapName);
    });
    on('game:menu', () => this.stopAmbient());
    on('ui:ready', () => this.playOneShot('readyToggle', 'ui'));
    on('ui:start_game', () => this.playOneShot('gameStart', 'ui'));
  }

  dispose() {
    this.stopBackgroundMusic();
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
