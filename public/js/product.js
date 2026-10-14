const productImages = document.querySelectorAll(".product-images img");
const productImageSlide = document.querySelector(".image-slider");
const loaderDiv = document.querySelector(".loader-div");
const optionsContainer = document.querySelector(".product-options");
const stockState = document.querySelector(".product-stock");
const productState = document.querySelector(".product-state");

const productPageState = {
  product: null,
  selectedOptions: {},
  selectedVariant: null,
  explicitlySelectedOptionIds: new Set(),
  wishlistContext: null,
};

let optionValidationAttempted = false;

let activeImageSlide = 0;

productImages.forEach((item, index) => {
  item.addEventListener("click", () => {
    productImages[activeImageSlide].classList.remove("active");
    item.classList.add("active");
    productImageSlide.style.backgroundImage = `url('${item.src}')`;
    activeImageSlide = index;
  });
});

const formatProductPrice = (amount, currencyCode) => {
  const currency = currencyCode?.toUpperCase();

  if (currency) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).format(Number(amount));
  }

  return `$${Number(amount)}`;
};

const renderVariantPrice = (variant) => {
  const sellPrice = document.querySelector(".product-price");
  const actualPrice = document.querySelector(".product-actual-price");
  const discount = document.querySelector(".product-discount");
  const price = variant?.price;

  if (!price) {
    sellPrice.textContent = "Price unavailable";
    actualPrice.textContent = "";
    discount.textContent = "";
    return;
  }

  sellPrice.textContent = formatProductPrice(price.amount, price.currencyCode);

  if (price.originalAmount > price.amount) {
    const discountPercentage = Math.round(((price.originalAmount - price.amount) / price.originalAmount) * 100);
    actualPrice.textContent = formatProductPrice(price.originalAmount, price.currencyCode);
    discount.textContent = `( ${discountPercentage}% off )`;
  } else {
    actualPrice.textContent = "";
    discount.textContent = "";
  }
};

const colorDisplayFamilies = {
  bleu: "BLEU",
  gris: "GRIS",
  blanc: "BLANC",
  vert: "VERT",
  beige: "BEIGE",
  brun: "BRUN",
  noir: "NOIR",
  rouge: "ROUGE",
  kaki: "KAKI",
  sable: "SABLE",
  ecru: "ÉCRU",
  bordeaux: "ROUGE",
  anthracite: "GRIS",
  olive: "VERT",
  black: "NOIR",
  white: "BLANC",
};

const getColorDisplayLabel = (value) => {
  const rawValue = String(value || "").trim();
  const firstWord = rawValue.split(/\s+/)[0]?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  return colorDisplayFamilies[firstWord] || rawValue;
};

const getOptionDisplayOrder = (option) => {
  const title = option.title.toLowerCase();

  if (["color", "couleur"].includes(title)) {
    return 0;
  }

  if (["size", "taille"].includes(title)) {
    return 1;
  }

  return 2;
};

const getColorImages = (colorValue) => {
  const mediaByColor = productPageState.product.mediaByColor;
  if (mediaByColor && Object.prototype.hasOwnProperty.call(mediaByColor, colorValue)) {
    return mediaByColor[colorValue].map((image) => image.url).filter(Boolean);
  }

  if (mediaByColor) {
    console.warn(`No color gallery is available for ${productPageState.product.id}: ${colorValue}`);
    return [];
  }

  const colorOption = productPageState.product.options.find(
    (option) => ["color", "couleur"].includes(option.title.toLowerCase())
  );

  if (!colorOption) {
    return [];
  }

  return [...new Set(productPageState.product.variants
    .filter((variant) => variant.options.some(
      (option) => option.optionId === colorOption.id && option.value === colorValue
    ))
    .flatMap((variant) => variant.images || []))];
};

const variantMatchesSelections = (variant, selections) => Object.entries(selections).every(
  ([optionId, value]) => variant.options.some((option) => option.optionId === optionId && option.value === value)
);

const findSelectedVariant = () => {
  const { product, selectedOptions } = productPageState;

  if (Object.keys(selectedOptions).length !== product.options.length) {
    return null;
  }

  return product.variants.find((variant) => variantMatchesSelections(variant, selectedOptions)) || null;
};

const updateOptionAvailability = () => {
  const { product, selectedOptions } = productPageState;

  optionsContainer.querySelectorAll(".option-radio-btn").forEach((button) => {
    const candidateSelections = {
      ...selectedOptions,
      [button.dataset.optionId]: button.dataset.optionValue,
    };
    const available = product.variants.some(
      (variant) => variant.available && variantMatchesSelections(variant, candidateSelections)
    );

    const isUnavailable = !available;
    const isColorButton = button.classList.contains("color-radio-btn");

    button.disabled = isUnavailable && !isColorButton;
    button.classList.toggle("unavailable", isUnavailable);
  });
};

const updateOptionErrorStates = () => {
  optionsContainer.querySelectorAll(".product-option-group").forEach((group) => {
    const hasSelection = Boolean(productPageState.selectedOptions[group.dataset.optionId]);

    group.querySelectorAll(".option-radio-btn").forEach((button) => {
      button.classList.toggle("uncheck", optionValidationAttempted && !hasSelection && !button.disabled);
    });
  });
};

const updateSelectedVariant = () => {
  productPageState.selectedVariant = findSelectedVariant();
  const variant = productPageState.selectedVariant;
  const hasExploitableVariant = productPageState.product.variants.some(
    (candidate) => candidate.available && candidate.price
  );
  const cartBtn = document.querySelector(".cart-btn");
  const canAddToCart = Boolean(variant?.available && variant.price);
  const isCartUnavailable = !hasExploitableVariant;

  cartBtn.disabled = isCartUnavailable;
  cartBtn.classList.toggle("cart-btn-disabled", !canAddToCart);
  cartBtn.dataset.state = canAddToCart ? "ready" : isCartUnavailable ? "unavailable" : "incomplete";
  if (isCartUnavailable) {
    cartBtn.setAttribute("aria-disabled", "true");
  } else {
    cartBtn.removeAttribute("aria-disabled");
  }

  if (!variant) {
    stockState.textContent = hasExploitableVariant ? "" : "Rupture de stock";
    return;
  }

  renderVariantPrice(variant);
  stockState.textContent = variant.available ? "En stock" : "Rupture de stock";
};

const clearSelectionSuccessStates = () => {
  const cartBtn = document.querySelector(".cart-btn");
  const wishlistBtn = document.querySelector(".wishlist-btn");

  if (cartBtn?.textContent === "Ajouté") cartBtn.textContent = "Ajouter au panier";
  if (wishlistBtn?.textContent === "Ajouté") wishlistBtn.textContent = "Liste de souhaits";
};

const selectOption = (button, { explicit = true } = {}) => {
  const group = button.closest(".product-option-group");
  const isColorButton = button.classList.contains("color-radio-btn");
  const selectionChanged = productPageState.selectedOptions[button.dataset.optionId] !== button.dataset.optionValue;

  group.querySelectorAll(".option-radio-btn").forEach((item) => {
    item.classList.remove("check", "uncheck");
  });
  button.classList.add("check");
  productPageState.selectedOptions[button.dataset.optionId] = button.dataset.optionValue;
  if (explicit) productPageState.explicitlySelectedOptionIds.add(button.dataset.optionId);
  if (selectionChanged) clearSelectionSuccessStates();
  productState.textContent = "";
  productState.classList.remove("product-inventory-limit");

  if (isColorButton) {
    const sizeOption = productPageState.product.options.find(
      (option) => ["size", "taille"].includes(option.title.toLowerCase())
    );
    const selectedSize = sizeOption && productPageState.selectedOptions[sizeOption.id];
    const hasAvailableSelectedSize = !selectedSize || productPageState.product.variants.some(
      (variant) => variant.available && variantMatchesSelections(variant, productPageState.selectedOptions)
    );

    if (sizeOption && !hasAvailableSelectedSize) {
      delete productPageState.selectedOptions[sizeOption.id];
      productPageState.explicitlySelectedOptionIds.delete(sizeOption.id);
      optionsContainer
        .querySelector(`.product-option-group[data-option-id="${sizeOption.id}"]`)
        ?.querySelectorAll(".option-radio-btn")
        .forEach((sizeButton) => sizeButton.classList.remove("check", "uncheck"));
    }

    renderImages(getColorImages(button.dataset.optionValue));
  }

  updateOptionAvailability();
  updateSelectedVariant();
  updateOptionErrorStates();
};

const renderOptions = (product) => {
  optionsContainer.innerHTML = "";

  [...product.options]
    .sort((firstOption, secondOption) => getOptionDisplayOrder(firstOption) - getOptionDisplayOrder(secondOption))
    .forEach((option) => {
      const group = document.createElement("div");
      group.className = "product-option-group";
      group.dataset.optionId = option.id;

      const heading = document.createElement("p");
      heading.className = "product-sub-heading";
      heading.textContent = `select ${option.title}`;
      group.appendChild(heading);

      const isColorOption = ["color", "couleur"].includes(option.title.toLowerCase());
      const isSizeOption = ["size", "taille"].includes(option.title.toLowerCase());

      option.values.forEach((value) => {
        const button = document.createElement("button");
        const optionClass = isSizeOption
          ? "size-radio-btn"
          : isColorOption
            ? "color-radio-btn"
            : "";

        button.type = "button";
        button.className = `option-radio-btn ${optionClass}`.trim();
        button.dataset.optionId = option.id;
        button.dataset.optionValue = value;
        button.textContent = isColorOption ? getColorDisplayLabel(value) : value;
        button.addEventListener("click", () => selectOption(button));
        group.appendChild(button);
      });

      optionsContainer.appendChild(group);
    });

  if (product.options.length === 0) {
    productPageState.selectedVariant = product.variants.find((variant) => variant.available) || null;
    updateSelectedVariant();
  } else {
    updateOptionAvailability();

    const wishlistVariant = productPageState.wishlistContext?.variantId
      ? product.variants.find((variant) => variant.id === productPageState.wishlistContext.variantId)
      : null;
    if (wishlistVariant) {
      wishlistVariant.options.forEach((option) => {
        const button = optionsContainer.querySelector(
          `.product-option-group[data-option-id="${option.optionId}"] .option-radio-btn[data-option-value="${option.value}"]`
        );
        if (button) selectOption(button, { explicit: false });
      });
      return;
    }

    const wishlistSelectedOptions = productPageState.wishlistContext?.selectedOptions;
    if (wishlistSelectedOptions) {
      let restoredSelection = false;
      Object.entries(wishlistSelectedOptions).forEach(([optionId, value]) => {
        const button = optionsContainer.querySelector(
          `.product-option-group[data-option-id="${optionId}"] .option-radio-btn[data-option-value="${value}"]`
        );
        if (button) {
          selectOption(button, { explicit: false });
          restoredSelection = true;
        }
      });
      if (restoredSelection) return;
    }

    const colorOption = product.options.find(
      (option) => ["color", "couleur"].includes(option.title.toLowerCase())
    );
    const firstColor = colorOption?.values.find((value) => product.variants.some((variant) => (
      variant.available
      && variant.price
      && variant.options.some((option) => option.optionId === colorOption.id && option.value === value)
    )));
    if (colorOption && firstColor) {
      const firstColorButton = optionsContainer.querySelector(
        `.product-option-group[data-option-id="${colorOption.id}"] .color-radio-btn[data-option-value="${firstColor}"]`
      );
      if (firstColorButton) {
        selectOption(firstColorButton, { explicit: false });
      } else {
        updateSelectedVariant();
      }
    } else {
      updateSelectedVariant();
    }
  }
};

const renderImages = (images) => {
  const availableImages = images.length ? images : ["../img/no image.png"];

  productImages.forEach((image, index) => {
    const source = availableImages[index];
    image.style.display = source ? "block" : "none";
    if (source) {
      image.src = source;
      image.alt = productPageState.product.name;
    }
  });

  productImages[0].click();
};

const selectedValueFor = (title) => {
  const option = productPageState.product.options.find(
    (item) => item.title.toLowerCase() === title.toLowerCase()
  );

  return option ? productPageState.selectedOptions[option.id] || null : null;
};

const addMedusaVariantToCart = async () => {
  const wishlistItemId = productPageState.wishlistContext?.itemId || null;
  const postItem = (cartId) => fetch("/medusa-cart/items", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      cartId,
      variantId: productPageState.selectedVariant.id,
      quantity: 1,
      ...(wishlistItemId ? { wishlistItemId } : {}),
    }),
  });
  const cartId = sessionStorage.getItem("medusa_cart_id");
  let response = await postItem(cartId);
  if (response.status === 404 && cartId) {
    sessionStorage.removeItem("medusa_cart_id");
    response = await postItem(null);
  }

  const data = await response.json();
  if (!response.ok || !data.cart) {
    const error = new Error(data.error || "cart_unavailable");
    error.code = data.error;
    throw error;
  }

  sessionStorage.setItem("medusa_cart_id", data.cart.id);
  return data;
};

const getWishlistVariantId = (product) => {
  if (product.options.length === 0) {
    const availableVariants = product.variants.filter((variant) => variant.available && variant.price);
    return availableVariants.length === 1 ? availableVariants[0].id : null;
  }

  return productPageState.selectedVariant?.id || null;
};

const getCurrentWishlistSelection = (product) => {
  const variantId = getWishlistVariantId(product);
  if (variantId) {
    return { variantId, selectedOptions: null };
  }

  const restoredOptionIds = Object.keys(productPageState.wishlistContext?.selectedOptions || {});
  const trackedOptionIds = new Set([
    ...restoredOptionIds,
    ...productPageState.explicitlySelectedOptionIds,
  ]);
  const selectedOptions = Object.fromEntries(
    [...trackedOptionIds]
      .filter((optionId) => productPageState.selectedOptions[optionId])
      .map((optionId) => [optionId, productPageState.selectedOptions[optionId]])
  );

  return {
    variantId: null,
    selectedOptions: Object.keys(selectedOptions).length ? selectedOptions : null,
  };
};

const sameSelectedOptions = (first, second) => {
  const firstEntries = Object.entries(first || {}).sort(([firstId], [secondId]) => firstId.localeCompare(secondId));
  const secondEntries = Object.entries(second || {}).sort(([firstId], [secondId]) => firstId.localeCompare(secondId));
  return JSON.stringify(firstEntries) === JSON.stringify(secondEntries);
};

const matchesWishlistContext = (selection, wishlistContext) => (
  selection.variantId === (wishlistContext.variantId || null)
  && sameSelectedOptions(selection.selectedOptions, wishlistContext.selectedOptions)
);

const hasRestoredCustomerSession = () => window.customerSessionState?.status === "authenticated";

const bindProductActions = (product) => {
  const wishlistBtn = document.querySelector(".wishlist-btn");
  const cartBtn = document.querySelector(".cart-btn");

  const wishlistEnabled = window.storefrontConfig?.features?.wishlist === true;
  const wishlistAuthenticationRequired = wishlistEnabled && !hasRestoredCustomerSession();
  wishlistBtn.hidden = !wishlistEnabled;
  wishlistBtn.classList.toggle("wishlist-auth-required", wishlistAuthenticationRequired);
  wishlistBtn.setAttribute("aria-disabled", "false");

  wishlistBtn.addEventListener("click", async () => {
    productState.classList.remove("product-inventory-limit");
    if (!window.storefrontConfig?.features?.wishlist) {
      return;
    }

    if (!hasRestoredCustomerSession()) {
      productState.textContent = "Connectez-vous pour utiliser la Wishlist.";
      return;
    }

    if (product.source !== "medusa") {
      productState.textContent = "This product is not yet available for the wishlist.";
      return;
    }

    wishlistBtn.disabled = true;
    productState.textContent = "";

    try {
      const selection = getCurrentWishlistSelection(product);
      const body = { productId: product.id };
      if (selection.variantId) body.variantId = selection.variantId;
      if (selection.selectedOptions) body.selectedOptions = selection.selectedOptions;
      const wishlistContext = productPageState.wishlistContext;
      if (wishlistContext && matchesWishlistContext(selection, wishlistContext)) {
        productState.textContent = "Produit déjà en Wishlist.";
        return;
      }

      const response = await fetch(wishlistContext
        ? `/medusa-wishlist/items/${encodeURIComponent(wishlistContext.itemId)}`
        : "/medusa-wishlist/items", {
        method: wishlistContext ? "PUT" : "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || data.error === "authentication_required") {
          productState.textContent = "Connectez-vous pour enregistrer ce produit.";
        } else if (data.error === "wishlist_disabled") {
          wishlistBtn.hidden = true;
        } else {
          productState.textContent = "Unable to add this product to the wishlist.";
        }
        return;
      }

      if (wishlistContext) {
        productPageState.wishlistContext.variantId = selection.variantId;
        productPageState.wishlistContext.selectedOptions = selection.selectedOptions;
        const url = new URL(location.href);
        url.searchParams.delete("wishlistVariantId");
        history.replaceState(null, "", url);
        productState.textContent = "Produit mis à jour.";
      } else {
        wishlistBtn.textContent = "Ajouté";
      }
    } catch (error) {
      productState.textContent = "Unable to add this product to the wishlist.";
    } finally {
      wishlistBtn.disabled = false;
    }
  });

  cartBtn.addEventListener("click", async () => {
    productState.classList.remove("product-inventory-limit");
    const variant = productPageState.selectedVariant;

    if (!product.variants.some((candidate) => candidate.available && candidate.price)) {
      productState.textContent = "Rupture de stock.";
      return;
    }

    if (!variant) {
      optionValidationAttempted = true;
      updateOptionErrorStates();
      return;
    }

    if (!variant.available) {
      productState.textContent = "Rupture de stock.";
      return;
    }

    if (product.source !== "medusa") {
      productState.textContent = "This product is not yet available for the Medusa cart.";
      return;
    }

    cartBtn.disabled = true;
    productState.textContent = "";
    try {
      const cartData = await addMedusaVariantToCart();
      cartBtn.textContent = "Ajouté";
      if (productPageState.wishlistContext && !cartData.wishlistRemoved) {
        productState.textContent = "Product added to cart, but wishlist could not be updated.";
      }
    } catch (error) {
      if (error.code === "insufficient_inventory") {
        productState.textContent = "Quantité maximale en stock atteinte.";
        productState.classList.add("product-inventory-limit");
      } else {
        productState.textContent = "Unable to add this product to the cart.";
      }
    } finally {
      cartBtn.disabled = false;
    }
  });
};

const fetchWishlistContext = async (wishlistItemId, productId) => {
  if (!wishlistItemId) return null;

  try {
    const response = await fetch(`/medusa-wishlist/items/${encodeURIComponent(wishlistItemId)}`);
    const data = await response.json();
    const item = data.wishlistItem;
    if (!response.ok || !item || item.productId !== productId) return null;

    return {
      itemId: item.id,
      variantId: item.variantId || null,
      selectedOptions: item.selectedOptions || null,
    };
  } catch (error) {
    return null;
  }
};

const setData = async (product) => {
  productPageState.product = product;
  productPageState.selectedOptions = {};
  productPageState.selectedVariant = null;
  productPageState.explicitlySelectedOptionIds = new Set();
  await (window.customerSessionReady || Promise.resolve({ status: "anonymous" }));
  const searchParams = new URLSearchParams(location.search);
  const wishlistItemId = searchParams.get("wishlistItemId");
  productPageState.wishlistContext = await fetchWishlistContext(wishlistItemId, product.id);
  document.title = `Product - ${product.name}`;
  document.querySelector(".product-brand").textContent = product.name;
  document.querySelector(".product-short-des").textContent = product.shortDes;
  document.querySelector(".des").textContent = product.des;

  renderImages(product.images);
  renderOptions(product);
  renderVariantPrice(product.variants.find((variant) => variant.available) || product.variants[0]);
  bindProductActions(product);
};

const normalizeLegacyProduct = (data, productId) => {
  const sizes = Array.isArray(data.sizes) ? data.sizes : [];

  return {
    ...data,
    source: "legacy",
    id: productId,
    images: Array.isArray(data.images) ? data.images : [],
    options: [{ id: "legacy-size", title: "Size", values: sizes }],
    variants: sizes.map((value) => ({
      id: `legacy-${productId}-${value}`,
      options: [{ optionId: "legacy-size", value }],
      price: {
        amount: Number(data.sellPrice),
        originalAmount: Number(data.actualPrice ?? data.sellPrice),
        currencyCode: null,
      },
      available: true,
    })),
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
};

const fetchLegacyProduct = async (productId) => {
  const response = await fetch("/get-products", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: productId }),
  });
  const data = await response.json();

  return normalizeLegacyProduct(data, productId);
};

const fetchProduct = async (productId) => {
  if (!productId.startsWith("prod_")) {
    return fetchLegacyProduct(productId);
  }

  const response = await fetch(`/medusa-products/${encodeURIComponent(productId)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Product unavailable");
  }

  return data;
};

const getMedusaRecommendations = async (productId) => {
  const response = await fetch(`/medusa-products/${encodeURIComponent(productId)}/recommendations`);
  const data = await response.json();

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data.error || "Recommendations are unavailable");
  }

  return data;
};

const renderSimilarProducts = (products) => {
  const container = document.querySelector(".container-for-card-slider");
  container.innerHTML = "";

  if (!products.length) {
    container.dataset.recommendationsState = "empty";
    return;
  }

  createProductSlider(products, ".container-for-card-slider", "similar products");
  container.dataset.recommendationsState = "loaded";
};

const loadRelatedProducts = async (product) => {
  const container = document.querySelector(".container-for-card-slider");

  if (!window.storefrontConfig?.features?.recommendations || product.source !== "medusa") {
    container.innerHTML = "";
    container.dataset.recommendationsState = "disabled";
    return;
  }

  try {
    const recommendations = await getMedusaRecommendations(product.id);
    renderSimilarProducts(recommendations);
  } catch (error) {
    container.innerHTML = "";
    container.dataset.recommendationsState = "error";
    console.error("F-16 recommendations unavailable:", error.message);
  }
};

const getProductDataId = async (productId) => {
  loaderDiv.style.display = "block";

  try {
    const product = await fetchProduct(productId);
    await setData(product);
    await loadRelatedProducts(product);
  } catch (error) {
    productState.textContent = "Product unavailable.";
  } finally {
    loaderDiv.style.display = "none";
  }
};

const productId = decodeURIComponent(location.pathname.split("/").pop());

if (location.pathname !== "/products" && productId) {
  getProductDataId(productId);
}
