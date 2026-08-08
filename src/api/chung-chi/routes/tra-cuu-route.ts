// File: src/api/chung-chi/routes/tra-cuu-route.ts

export default {
  routes: [
    {
      method: "POST",
      path: "/tra-cuu-chung-chi",
      handler: "chung-chi.traCuu",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
