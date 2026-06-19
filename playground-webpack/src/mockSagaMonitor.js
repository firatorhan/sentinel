const effectsData = require('./mockSaga.js');

let effects = [...effectsData];
const listeners = new Set();

const mockSagaMonitor = {
  effectTriggered() {},
  effectResolved() {},
  effectRejected() {},
  effectCancelled() {},
  _subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  _getEffects() {
    return effects;
  },
  _clear() {
    effects = [];
    listeners.forEach((l) => l());
  },
};

module.exports = { mockSagaMonitor };
