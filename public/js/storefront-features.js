const runtimeWishlistEnabled = typeof window !== "undefined"
  && window.storefrontRuntimeConfig?.features?.wishlist === true;

const storefrontConfig = Object.freeze({
  version: 1,
  features: Object.freeze({
    recommendations: true,
    wishlist: runtimeWishlistEnabled
  })
});

const isStorefrontFeatureEnabled = (config, feature) => config.features?.[feature] === true;

if (typeof window !== "undefined") {
  window.storefrontConfig = storefrontConfig;
  localStorage.removeItem("wishlist");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { storefrontConfig, isStorefrontFeatureEnabled };
}
