// Minimal synchronous event bus. Dispatch MUST stay synchronous so handlers
// that need a user gesture (e.g. pointer-lock requests) run inside the
// originating call stack.

/**
 * Synchronous publish/subscribe event bus.
 */
export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  /**
   * Subscribes a handler to an event. Handlers run synchronously on emit,
   * in registration order.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    let list = this._handlers.get(event);
    if (!list) {
      list = [];
      this._handlers.set(event, list);
    }
    list.push(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribes a handler that is removed after its first invocation.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  /**
   * Removes a previously registered handler.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const list = this._handlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this._handlers.delete(event);
  }

  /**
   * Emits an event synchronously. Each handler is exception-isolated: a
   * throwing handler is logged via console.error and remaining handlers
   * still run.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const list = this._handlers.get(event);
    if (!list) return;
    for (const handler of list.slice()) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`EventBus handler for "${event}" failed:`, err);
      }
    }
  }
}

/** App-wide singleton for UI <-> Game communication. */
export const bus = new EventBus();
