const now = Date.now();

const demoRecords = [
  {
    id: 1,
    action: { type: "auth/LOGIN_SUCCESS", payload: { userId: "u_1042" } },
    diff: [
      { path: "auth", type: "changed", prev: { isAuthenticated: false }, next: { isAuthenticated: true } },
    ],
    timestamp: now - 60000,
  },
  {
    id: 2,
    action: { type: "products/FETCH_SUCCESS" },
    diff: [
      { path: "products", type: "changed", prev: { loading: true, list: [] }, next: { loading: false, list: [{ id: 1 }, { id: 2 }] } },
    ],
    timestamp: now - 45000,
  },
  {
    id: 3,
    action: { type: "cart/ADD_ITEM", payload: { id: 2, qty: 1 } },
    diff: [
      { path: "cart", type: "changed", prev: { items: [{ id: 1 }], total: 1299 }, next: { items: [{ id: 1 }, { id: 2 }], total: 2898 } },
    ],
    timestamp: now - 20000,
  },
  {
    id: 4,
    action: { type: "ui/SET_THEME", payload: "dark" },
    diff: [],
    timestamp: now - 10000,
  },
  {
    id: 5,
    action: { type: "ui/OPEN_MODAL", payload: "checkout" },
    diff: [
      { path: "ui", type: "changed", prev: { modal: null }, next: { modal: "checkout" } },
    ],
    timestamp: now - 3000,
  },
];

let records = [...demoRecords];
const listeners = new Set();

const mockReduxMiddleware = {
  middleware: _store => next => action => next(action),
  _getRecords() {
    return records;
  },
  _subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  _clear() {
    records = [];
    listeners.forEach(l => l());
  },
};

module.exports = { mockReduxMiddleware };
