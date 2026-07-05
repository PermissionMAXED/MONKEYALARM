// Camera-only cutscene player for scripted fly-throughs (e.g. the Escape
// intro). Advances a real-time clock hard-clamped to the script duration,
// eases the camera between position/look keyframes and fires subtitle
// callbacks as their timestamps are crossed. It never mutates the world —
// the camera transform is the only thing it touches.

import * as THREE from 'three';

// Scratch vectors reused every update (no per-frame allocation).
const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _lookA = new THREE.Vector3();
const _lookB = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

/** Clamped smoothstep ease (0..1 in, 0..1 out). */
function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Plays a keyframed camera script:
 * `{ duration, keys: [{t, pos:[x,y,z], look:[x,y,z]}], subs: [{t, text}] }`.
 * Keys and subs must be sorted by ascending `t`. The clock is clamped to
 * `duration`, so a cutscene can never run forever; `skip()` jumps straight
 * to the end. `onEnd` fires exactly once per start(), whether the script
 * finishes naturally or is skipped.
 */
export class CutscenePlayer {
  /**
   * @param {THREE.Camera} camera the camera the cutscene drives
   */
  constructor(camera) {
    this.camera = camera;
    this._keys = null;
    this._subs = [];
    this._duration = 0;
    this._time = 0;
    this._subIndex = 0;
    this._onSub = null;
    this._onEnd = null;
    this._active = false;
  }

  /** @returns {boolean} whether a cutscene is currently playing */
  get isActive() {
    return this._active;
  }

  /**
   * Starts playing a script from t = 0 and immediately applies the first
   * keyframe to the camera. Any cutscene still running is skipped first so
   * its onEnd is never lost.
   * @param {{duration: number, keys: Array, subs?: Array}} script
   * @param {{onSub?: (text: string) => void, onEnd?: () => void}} [callbacks]
   */
  start(script, { onSub, onEnd } = {}) {
    this.skip();
    this._keys = Array.isArray(script?.keys) && script.keys.length > 0 ? script.keys : null;
    this._subs = Array.isArray(script?.subs) ? script.subs : [];
    this._duration = Math.max(0, Number(script?.duration) || 0);
    this._time = 0;
    this._subIndex = 0;
    this._onSub = onSub || null;
    this._onEnd = onEnd || null;
    this._active = true;
    this._apply(0);
  }

  /**
   * Advances the cutscene clock, poses the camera and fires any subtitles
   * whose timestamp was crossed (each fires once). Ends the cutscene when
   * the clock reaches the script duration.
   * @param {number} dt seconds since last frame
   */
  update(dt) {
    if (!this._active) return;
    this._time = Math.min(this._time + dt, this._duration);
    while (this._subIndex < this._subs.length && this._subs[this._subIndex].t <= this._time) {
      const sub = this._subs[this._subIndex];
      this._subIndex += 1;
      if (this._onSub) this._onSub(sub.text);
    }
    this._apply(this._time);
    if (this._time >= this._duration) this._finish();
  }

  /** Jumps to the end pose and finishes. No-op when nothing is playing. */
  skip() {
    if (!this._active) return;
    this._time = this._duration;
    this._apply(this._time);
    this._finish();
  }

  /** Deactivates and fires onEnd exactly once (guarded against re-entry). */
  _finish() {
    if (!this._active) return;
    this._active = false;
    const onEnd = this._onEnd;
    this._keys = null;
    this._subs = [];
    this._onSub = null;
    this._onEnd = null;
    if (onEnd) onEnd();
  }

  /**
   * Poses the camera for a clock time: finds the bracketing keys, then
   * smoothstep-eases both the position and the look target between them.
   * Before the first key / after the last key the camera holds that key.
   * @param {number} time seconds into the script
   */
  _apply(time) {
    const keys = this._keys;
    if (!keys) return;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= time) i += 1;
    const a = keys[i];
    const b = i + 1 < keys.length ? keys[i + 1] : a;
    _posA.fromArray(a.pos);
    _lookA.fromArray(a.look);
    if (b === a || b.t <= a.t) {
      _pos.copy(_posA);
      _look.copy(_lookA);
    } else {
      const alpha = smoothstep((time - a.t) / (b.t - a.t));
      _posB.fromArray(b.pos);
      _lookB.fromArray(b.look);
      _pos.lerpVectors(_posA, _posB, alpha);
      _look.lerpVectors(_lookA, _lookB, alpha);
    }
    this.camera.position.copy(_pos);
    this.camera.lookAt(_look);
  }
}
