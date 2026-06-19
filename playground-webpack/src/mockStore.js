const createMockStore = () => {
  let state = {
    auth: {
      user: {
        id: "u_1042",
        name: "Fırat Orhan",
        email: "fratorhann@gmail.com",
        role: "admin",
        preferences: {
          language: "tr",
          currency: "TRY",
          newsletter: true,
        },
      },
      isAuthenticated: true,
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock",
      expiresAt: "2026-12-31T23:59:59Z",
    },
    cart: {
      items: [
        { id: 1, title: "Minimal Sneakers", price: 1299, qty: 2, size: "42" },
        { id: 3, title: "Classic White", price: 1199, qty: 1, size: "41" },
      ],
      total: 3797,
      discount: 0,
      coupon: null,
      shippingMethod: "standard",
    },
    products: {
      list: [
        { id: 1, title: "Minimal Sneakers", price: 1299, stock: 14, category: "sneaker" },
        { id: 2, title: "Urban Runner", price: 1599, stock: 0, category: "runner" },
        { id: 3, title: "Classic White", price: 1199, stock: 7, category: "sneaker" },
      ],
      filters: {
        category: null,
        priceRange: [0, 2000],
        inStockOnly: false,
        sortBy: "popularity",
      },
      pagination: { page: 1, perPage: 12, total: 3 },
      loading: false,
      error: null,
    },
    ui: {
      theme: "dark",
      sidebarOpen: false,
      notifications: [
        { id: "n1", type: "success", message: "Ürün sepete eklendi", read: false },
        { id: "n2", type: "info", message: "Siparişiniz kargoya verildi", read: true },
      ],
      modal: null,
      breadcrumbs: ["Ana Sayfa", "Sneakers"],
    },
  };

  const listeners = new Set();

  const notify = () => listeners.forEach((l) => l());

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch: (updater) => {
      state = updater(state);
      notify();
    },
  };
};

const mockStore = createMockStore();

module.exports = { mockStore };
