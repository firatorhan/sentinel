const now = Date.now();

// Simulates Redux state from SSR
const serverState = {
  auth: { isAuthenticated: true, userId: "u_1042", role: "admin" },
  products: {
    loading: false,
    list: [
      { id: 1, title: "Minimal Sneakers", price: 1299, stock: 14 },
      { id: 2, title: "Urban Runner", price: 1599, stock: 7 },
    ],
    total: 2,
  },
  cart: { items: [], total: 0 },
  ui: { theme: "dark", modal: null, sidebar: false },
};

// Simulates saga effects captured on the server during SSR
const serverSagaEffects = [
  {
    id: 1,
    parentId: 0,
    fnName: "rootSaga",
    type: "FORK",
    status: "resolved",
    args: [],
    result: undefined,
    duration: 312,
  },
  {
    id: 2,
    parentId: 1,
    fnName: "watchAuth",
    type: "FORK",
    status: "resolved",
    args: [],
    result: undefined,
    duration: 5,
  },
  {
    id: 3,
    parentId: 1,
    fnName: "fetchInitialData",
    type: "CALL",
    status: "resolved",
    args: [{ userId: "u_1042" }],
    result: { products: 2, loaded: true },
    duration: 289,
  },
  {
    id: 4,
    parentId: 3,
    fnName: "getProducts",
    type: "CALL",
    status: "resolved",
    args: [{ page: 1, limit: 10 }],
    result: [{ id: 1 }, { id: 2 }],
    duration: 241,
  },
  {
    id: 5,
    parentId: 3,
    fnName: "getUser",
    type: "CALL",
    status: "resolved",
    args: ["u_1042"],
    result: { id: "u_1042", role: "admin" },
    duration: 118,
  },
];

// Simulates action log captured on the server during SSR
const serverActionLog = [
  {
    id: 1,
    action: { type: "auth/SET_USER", payload: { userId: "u_1042", role: "admin" } },
    diff: [
      { path: "auth", type: "changed", prev: { isAuthenticated: false }, next: { isAuthenticated: true, userId: "u_1042" } },
    ],
    timestamp: now - 500,
  },
  {
    id: 2,
    action: { type: "products/FETCH_SUCCESS" },
    diff: [
      { path: "products", type: "changed", prev: { loading: true, list: [] }, next: { loading: false, list: [{ id: 1 }, { id: 2 }] } },
    ],
    timestamp: now - 300,
  },
  {
    id: 3,
    action: { type: "ui/SET_THEME", payload: "dark" },
    diff: [],
    timestamp: now - 100,
  },
];

module.exports = { serverState, serverSagaEffects, serverActionLog };
