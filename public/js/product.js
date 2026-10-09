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

  if (!variant) {
    stockState.textContent = Object.keys(productPageState.selectedOptions).length
      ? "Select all options"
      : "";
    return;
  }

  renderVariantPrice(variant);
  stockState.textContent = variant.available ? "In stock" : "Out of stock";
};

const selectOption = (button) => {
  const group = button.closest(".product-option-group");
  const isColorButton = button.classList.contains("color-radio-btn");

  group.querySelectorAll(".option-radio-btn").forEach((item) => {
    item.classList.remove("check", "uncheck");
  });
  button.classList.add("check");
  productPageState.selectedOptions[button.dataset.optionId] = button.dataset.optionValue;
  productState.textContent = "";

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

    const colorOption = product.options.find(
      (option) => ["color", "couleur"].includes(option.title.toLowerCase())
    );
    const firstColor = colorOption?.values[0];
    if (colorOption && firstColor) {
      const firstColorButton = optionsContainer.querySelector(
        `.product-option-group[data-option-id="${colorOption.id}"] .color-radio-btn[data-option-value="${firstColor}"]`
      );
      if (firstColorButton) {
        selectOption(firstColorButton);
      }
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
  const response = await fetch("/medusa-cart/items", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      cartId: localStorage.getItem("medusa_cart_id"),
      variantId: productPageState.selectedVariant.id,
      quantity: 1,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.cart) {
    throw new Error("Cart is unavailable");
  }

  localStorage.setItem("medusa_cart_id", data.cart.id);
};

const bindProductActions = (product) => {
  const wishlistBtn = document.querySelector(".wishlist-btn");
  const cartBtn = document.querySelector(".cart-btn");

  wishlistBtn.hidden = window.storefrontConfig?.features?.wishlist !== true;

  wishlistBtn.addEventListener("click", async () => {
    if (!window.storefrontConfig?.features?.wishlist) {
      return;
    }

    if (!sessionStorage.getItem("user")) {
      productState.textContent = "Connectez-vous pour enregistrer ce produit.";
      return;
    }

    if (product.source !== "medusa") {
      productState.textContent = "This product is not yet available for the wishlist.";
      return;
    }

    wishlistBtn.disabled = true;
    productState.textContent = "";

    try {
      const response = await fetch("/medusa-wishlist/items", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ productId: product.id }),
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

      wishlistBtn.textContent = "added";
    } catch (error) {
      productState.textContent = "Unable to add this product to the wishlist.";
    } finally {
      wishlistBtn.disabled = false;
    }
  });

  cartBtn.addEventListener("click", async () => {
    const variant = productPageState.selectedVariant;

    if (!variant) {
      optionValidationAttempted = true;
      updateOptionErrorStates();
      return;
    }

    if (!variant.available) {
      productState.textContent = "This variant is out of stock.";
      return;
    }

    if (product.source !== "medusa") {
      productState.textContent = "This product is not yet available for the Medusa cart.";
      return;
    }

    cartBtn.disabled = true;
    productState.textContent = "";
    try {
      await addMedusaVariantToCart();
      cartBtn.textContent = "added";
    } catch (error) {
      productState.textContent = "Unable to add this product to the cart.";
    } finally {
      cartBtn.disabled = false;
    }
  });
};

const setData = (product) => {
  productPageState.product = product;
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
    setData(product);
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
