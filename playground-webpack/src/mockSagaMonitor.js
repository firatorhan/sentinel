const effectsData = require('./mockSaga.js');

// Demo entries to showcase tree hierarchy and different effect types
const demoEntries = [
  { id: 1, parentId: 0, type: "FORK", fnName: "rootSaga", args: [], status: "resolved", startedAt: Date.now() - 5000, duration: 4900 },
  { id: 2, parentId: 1, type: "TAKE", fnName: "FETCH_PRODUCTS_REQUEST", args: [], status: "resolved", startedAt: Date.now() - 4900, duration: 120 },
  { id: 3, parentId: 1, type: "FORK", fnName: "fetchProductsSaga", args: [], status: "resolved", startedAt: Date.now() - 4780, duration: 800 },
  { id: 4, parentId: 3, type: "CALL", fnName: "getProducts", args: [{ category: "electronics" }], status: "resolved", result: [{ id: 1, name: "TV" }], startedAt: Date.now() - 4700, duration: 600 },
  { id: 5, parentId: 3, type: "PUT", fnName: "FETCH_PRODUCTS_SUCCESS", args: [{ type: "FETCH_PRODUCTS_SUCCESS", payload: [{ id: 1 }] }], status: "resolved", startedAt: Date.now() - 4100, duration: 1 },
  { id: 6, parentId: 1, type: "TAKE", fnName: "FETCH_USER_REQUEST", args: [], status: "resolved", startedAt: Date.now() - 4000, duration: 200 },
  { id: 7, parentId: 1, type: "FORK", fnName: "fetchUserSaga", args: [], status: "rejected", startedAt: Date.now() - 3800, duration: 300 },
  { id: 8, parentId: 7, type: "CALL", fnName: "getUser", args: [{ userId: "abc-123" }], status: "rejected", error: "Network Error", startedAt: Date.now() - 3750, duration: 280 },
  { id: 9, parentId: 7, type: "PUT", fnName: "FETCH_USER_FAILURE", args: [{ type: "FETCH_USER_FAILURE", payload: "Network Error" }], status: "resolved", startedAt: Date.now() - 3470, duration: 1 },
];

let effects = [...demoEntries, ...effectsData.map(e => ({ type: "CALL", ...e }))];
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
