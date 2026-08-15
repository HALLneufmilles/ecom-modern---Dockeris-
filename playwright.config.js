const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  workers: 4,

  use: {
    baseURL: "http://127.0.0.1:5000",
    trace: "retain-on-failure"
  },

  reporter: "list"
});
// La boutique que tu dois tester est celle servie par Docker sur le port 5000. Puisque Docker et PC sont sous port 5000.
// Nous ne demandons pas à Playwright de démarrer l'application, puisque Docker s'en charge déjà.
