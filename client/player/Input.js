// Keyboard input tracker with held-state queries and one-shot edge detection.

/**
 * Tracks keyboard state via `KeyboardEvent.code`. Supports querying held keys
 * and consuming single key-press edges. Held state is cleared on window blur
 * so keys never get stuck after alt-tab.
 */
export class Input {
  /**
   * @param {EventTarget} [target=window] element to attach key listeners to
   */
  constructor(target = window) {
    this._target = target;
    this._held = new Set();
    this._pressed = new Set();

    this._onKeyDown = (event) => {
      // OS key-repeat events must not retrigger edge detection.
      if (!event.repeat) this._pressed.add(event.code);
      this._held.add(event.code);
    };
    this._onKeyUp = (event) => {
      this._held.delete(event.code);
    };
    this._onBlur = () => {
      this._held.clear();
      this._pressed.clear();
    };

    this._target.addEventListener('keydown', this._onKeyDown);
    this._target.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  /**
   * @param {string} code e.g. 'KeyW'
   * @returns {boolean} whether the key is currently held
   */
  isDown(code) {
    return this._held.has(code);
  }

  /**
   * True exactly once per physical key press since the last call.
   * @param {string} code e.g. 'Space'
   * @returns {boolean}
   */
  consumePressed(code) {
    if (!this._pressed.has(code)) return false;
    this._pressed.delete(code);
    return true;
  }

  /** Removes all event listeners and clears state. */
  dispose() {
    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._held.clear();
    this._pressed.clear();
  }
}
