const formatCartPrice = (amount, currencyCode) => {
  const currency = currencyCode?.toUpperCase();

  if (currency) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount));
  }

  return `$${Number(amount).toFixed(2)}`;
};

const hasRestoredCustomerSession = () => window.customerSessionState?.status === "authenticated";

const productHref = (productId, wishlistItemId = null) => {
  const href = `/products/${encodeURIComponent(productId)}`;
  if (!wishlistItemId) return href;

  const params = new URLSearchParams({ wishlistItemId });
  return `${href}?${params.toString()}`;
};

const createSmallCard = (item, { mutable = false, action, moveToWishlist = false } = {}) => {
  const productLink = Object.prototype.hasOwnProperty.call(item, "productLink")
    ? item.productLink
    : (item.productId ? productHref(item.productId) : null);
  const image = `<img src="${item.image || "img/no image.png"}" class="sm-product-img" alt="${item.name || "Product"}">`;
  const variantOptions = item.variantOptions?.length
    ? `<p class="sm-des wishlist-variant-options">${item.variantOptions.map((option) => option.value).join(" / ")}</p>`
    : "";
  const text = `
    <p class="sm-product-name">${item.name || "Product"}</p>
    ${variantOptions}
    <p class="sm-des">${item.shortDes || ""}</p>`;
  const textContent = productLink ? `
    <a href="${productLink}" class="sm-text sm-product-link">${text}</a>` : `
    <div class="sm-text">${text}</div>`;
  const imageContent = productLink ? `
    <a href="${productLink}" class="sm-product-link sm-product-image-link">${image}</a>
  ` : image;
  const controls = action ? `
    <div class="wishlist-actions">
      <button type="button" class="wishlist-cart-btn ${action.className}">${action.label}</button>
    </div>` : `
    <div class="cart-quantity">
      <div class="item-counter">
        <button class="counter-btn decrement"${mutable ? "" : " disabled"}>-</button>
        <p class="item-count">${item.quantity}</p>
        <button class="counter-btn increment"${mutable && !item.incrementDisabled ? "" : " disabled"}>+</button>
      </div>
      ${item.inventoryLimited ? `<p class="cart-inventory-message" role="alert">Quantité max en stock.</p>` : ""}
    </div>`;
  const moveToWishlistAction = moveToWishlist ? `
    <div class="cart-wishlist-actions">
      <button type="button" class="cart-wishlist-move-btn${hasRestoredCustomerSession() ? "" : " wishlist-auth-required"}">Déplacer vers Wishlist</button>
    </div>` : "";

  return `
  <div class="sm-product${action ? " wishlist-product" : ""}${moveToWishlist ? " cart-product" : ""}"${item.lineId ? ` data-line-id="${item.lineId}"` : ""}${item.wishlistItemId ? ` data-wishlist-item-id="${item.wishlistItemId}"` : ""}${item.productId ? ` data-product-id="${item.productId}"` : ""}${item.variantId ? ` data-variant-id="${item.variantId}"` : ""}>
    ${imageContent}
    ${action ? `<div class="wishlist-product-details">${textContent}${controls}</div>` : moveToWishlist ? `<div class="cart-product-details">${textContent}${moveToWishlistAction}</div>${controls}` : `${textContent}${controls}`}
    <p class="sm-price">${formatCartPrice(item.lineTotal ?? item.unitPrice * item.quantity, item.currencyCode)}</p>
    <button class="sm-delete-btn"><img src="img/close.png" alt=""></button>
  </div>
`;
};

const normalizeMedusaItem = (item, currencyCode) => ({
  lineId: item.id,
  productId: item.product_id,
  variantId: item.variant_id,
  name: item.product_title || item.title,
  shortDes: item.variant_title || item.subtitle || "",
  image: item.thumbnail,
  quantity: Number(item.quantity),
  unitPrice: Number(item.unit_price),
  lineTotal: Number(item.total),
  currencyCode,
});

const emptyList = (element) => {
  element.innerHTML = `<img src="img/empty-cart.png" class="empty-img" alt="">`;
};

const requestCart = async (path, options) => {
  const response = await fetch(path, options);
  const data = await response.json();

  if (!response.ok || !data.cart) {
    const error = new Error(data.error || "Cart is unavailable");
    error.status = response.status;
    error.code = data.error;
    throw error;
  }

  return data.cart;
};

const inventoryLimitedLineIds = new Set();

const renderCart = (cart) => {
  const element = document.querySelector(".cart");
  const items = (cart.items || []).map((item) => ({
    ...normalizeMedusaItem(item, cart.currency_code),
    incrementDisabled: inventoryLimitedLineIds.has(item.id),
    inventoryLimited: inventoryLimitedLineIds.has(item.id),
  }));

  element.innerHTML = "";
  if (!items.length) {
    emptyList(element);
  } else {
    items.forEach((item) => element.insertAdjacentHTML("beforeend", createSmallCard(item, {
      mutable: true,
      moveToWishlist: window.storefrontConfig?.features?.wishlist === true,
    })));
  }

  document.querySelector(".bill").textContent = formatCartPrice(Number(cart.item_subtotal || 0), cart.currency_code);
  bindCartEvents(cart.id, items);
  window.currentMedusaCart = cart;
  window.dispatchEvent(new CustomEvent("medusa-cart-updated", { detail: cart }));
  return cart;
};

const cartLineMutationQueues = new Map();

const refreshCartAfterMutationFailure = async (cartId) => {
  try {
    renderCart(await requestCart(`/medusa-cart/${encodeURIComponent(cartId)}`));
  } catch (refreshError) {
    // Le Cart affiché reste le dernier état confirmé si sa relecture échoue aussi.
  }
};

const processCartLineMutationQueue = async (queue) => {
  if (queue.processing) return;
  queue.processing = true;

  try {
    while (queue.intents.length) {
      const intent = queue.intents.shift();
      const options = intent.method === "PATCH"
        ? {
          method: "PATCH",
          headers: new Headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ quantity: intent.quantity }),
        }
        : { method: "DELETE" };
      const cart = await requestCart(
        `/medusa-cart/${encodeURIComponent(queue.cartId)}/items/${encodeURIComponent(queue.lineId)}`,
        options
      );
      if (intent.delta < 0) inventoryLimitedLineIds.delete(queue.lineId);
      renderCart(cart);
    }
  } catch (error) {
    queue.intents = [];
    if (error.code === "insufficient_inventory") {
      inventoryLimitedLineIds.add(queue.lineId);
    }
    await refreshCartAfterMutationFailure(queue.cartId);
    window.dispatchEvent(new CustomEvent("medusa-cart-error", { detail: error.message }));
  } finally {
    queue.processing = false;
    cartLineMutationQueues.delete(queue.lineId);
  }
};

const enqueueCartLineMutation = (cartId, lineId, intent) => {
  let queue = cartLineMutationQueues.get(lineId);
  if (!queue) {
    queue = { cartId, lineId, intents: [], processing: false, plannedQuantity: intent.quantity };
    cartLineMutationQueues.set(lineId, queue);
  }

  queue.plannedQuantity = intent.quantity;
  queue.intents.push(intent);
  processCartLineMutationQueue(queue);
};

const moveCartItemToWishlist = async (cartId, item, button) => {
  if (!hasRestoredCustomerSession()) {
    setWishlistStatus("Connectez-vous pour utiliser la Wishlist.");
    return;
  }

  if (!item.productId || !item.variantId) {
    setWishlistStatus("Impossible de déplacer ce produit vers la Wishlist.");
    return;
  }

  button.disabled = true;
  setWishlistStatus("");
  try {
    const wishlistResponse = await fetch("/medusa-wishlist/items", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ productId: item.productId, variantId: item.variantId }),
    });
    const wishlistData = await wishlistResponse.json();
    if (!wishlistResponse.ok) {
      if (wishlistResponse.status === 401 || wishlistData.error === "authentication_required") {
        setWishlistStatus("Connectez-vous pour utiliser la Wishlist.");
      } else {
        setWishlistStatus("Impossible de déplacer ce produit vers la Wishlist.");
      }
      return;
    }

    const cart = await requestCart(`/medusa-cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(item.lineId)}`, {
      method: "DELETE",
    });
    renderCart(cart);
    await loadWishlist();
  } catch (error) {
    setWishlistStatus("Impossible de déplacer ce produit vers la Wishlist.");
  } finally {
    if (document.body.contains(button)) button.disabled = false;
  }
};

const bindCartEvents = (cartId, items) => {
  document.querySelectorAll(".cart .sm-product").forEach((card) => {
    const lineId = card.dataset.lineId;
    const count = card.querySelector(".item-count");
    const quantity = () => Number(count.textContent);

    const enqueueQuantityChange = (delta) => {
      const queue = cartLineMutationQueues.get(lineId);
      const baseQuantity = queue?.plannedQuantity ?? quantity();
      const nextQuantity = Math.max(1, baseQuantity + delta);
      if (nextQuantity === baseQuantity) return;
      enqueueCartLineMutation(cartId, lineId, { method: "PATCH", quantity: nextQuantity, delta });
    };

    card.querySelector(".decrement").addEventListener("click", () => enqueueQuantityChange(-1));
    card.querySelector(".increment").addEventListener("click", () => enqueueQuantityChange(1));
    card.querySelector(".sm-delete-btn").addEventListener("click", () => {
      enqueueCartLineMutation(cartId, lineId, { method: "DELETE", quantity: quantity() });
    });
    const moveButton = card.querySelector(".cart-wishlist-move-btn");
    if (moveButton) {
      const item = items.find((candidate) => candidate.lineId === lineId);
      moveButton.addEventListener("click", () => moveCartItemToWishlist(cartId, item, moveButton));
    }
  });
};

const loadMedusaCart = async () => {
  const element = document.querySelector(".cart");

  try {
    const response = await fetch("/medusa-cart/current");
    if (!response.ok) throw new Error("Cart is unavailable");
    const { cart } = await response.json();
    if (cart) {
      sessionStorage.setItem("medusa_cart_id", cart.id);
      return renderCart(cart);
    }
    sessionStorage.removeItem("medusa_cart_id");
  } catch (error) {
    // Une panne du service ne doit pas effacer le dernier identifiant confirmé.
  }
  emptyList(element);
  document.querySelector(".bill").textContent = "$0.00";
  window.currentMedusaCart = null;
  return null;
};

const renderWishlist = (wishlist) => {
  const element = document.querySelector(".wishlist");
  if (!element) return;

  element.innerHTML = "";
  if (!wishlist?.items?.length) {
    emptyList(element);
    return;
  }

  wishlist.items.forEach((item) => {
    const product = item.product;
    const availableVariants = (product.variants || []).filter((variant) => variant.available && variant.price);
    const selectedVariant = item.variantId
      ? availableVariants.find((variant) => variant.id === item.variantId) || null
      : null;
    const directVariant = item.variantId ? selectedVariant : null;
    const action = directVariant
      ? { label: "Ajouter au panier", className: "wishlist-add-to-cart" }
      : { label: "Choisir les options", className: "wishlist-choose-options" };
    element.insertAdjacentHTML("beforeend", createSmallCard({
      wishlistItemId: item.id,
      productId: product.id,
      productLink: item.variantId ? productHref(product.id, item.id) : null,
      name: product.name,
      shortDes: product.shortDes,
      image: item.image || product.image,
      variantOptions: item.variantId ? selectedVariant?.options || [] : [],
      quantity: 1,
      unitPrice: Number(product.price?.amount || 0),
      currencyCode: product.price?.currencyCode,
    }, { action }));
    const card = element.lastElementChild;
    card.querySelector(".sm-delete-btn").addEventListener("click", async () => {
      setWishlistStatus("");
      const response = await fetch(`/medusa-wishlist/items/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadWishlist();
      } else {
        setWishlistStatus("Unable to update the wishlist.");
      }
    });
    card.querySelector(".wishlist-cart-btn").addEventListener("click", async () => {
      if (!directVariant) {
        location.assign(productHref(product.id, item.id));
        return;
      }

      const actionButton = card.querySelector(".wishlist-cart-btn");
      actionButton.disabled = true;
      setWishlistStatus("");
      let cartAdded = false;
      try {
        const postItem = (cartId) => fetch("/medusa-cart/items", {
          method: "POST",
          headers: new Headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            cartId,
            variantId: directVariant.id,
            quantity: 1,
            wishlistItemId: item.id,
          }),
        });
        const cartId = sessionStorage.getItem("medusa_cart_id");
        let cartResponse = await postItem(cartId);
        if (cartResponse.status === 404 && cartId) {
          sessionStorage.removeItem("medusa_cart_id");
          cartResponse = await postItem(null);
        }
        const cartData = await cartResponse.json();
        if (!cartResponse.ok || !cartData.cart) throw new Error("cart_unavailable");

        sessionStorage.setItem("medusa_cart_id", cartData.cart.id);
        renderCart(cartData.cart);
        cartAdded = true;
        await loadWishlist();
        if (!cartData.wishlistRemoved) {
          setWishlistStatus("Product added to cart, but wishlist could not be updated.");
        }
      } catch (error) {
        setWishlistStatus(cartAdded
          ? "Product added to cart, but wishlist could not be updated."
          : "Unable to add this product to the cart.");
        actionButton.disabled = false;
      }
    });
  });
};

const setWishlistStatus = (message) => {
  const state = document.querySelector(".wishlist-state");
  if (state) state.textContent = message;
};

const loadWishlist = async () => {
  const section = document.querySelector(".wishlist-section");
  if (!section) return null;

  if (window.storefrontConfig?.features?.wishlist !== true) {
    section.hidden = true;
    return null;
  }

  section.hidden = false;
  try {
    const response = await fetch("/medusa-wishlist");
    if (response.status === 401) {
      renderWishlist(null);
      return null;
    }

    if (!response.ok) {
      if (response.status === 404) section.hidden = true;
      return null;
    }

    const data = await response.json();
    renderWishlist(data.wishlist);
    return data.wishlist;
  } catch (error) {
    renderWishlist(null);
    return null;
  }
};

// `loadWishlist` is intentionally not called for an anonymous visitor. Hide the
// static Cart section here as well so an OFF feature is never exposed in that
// case.
if (window.storefrontConfig?.features?.wishlist !== true) {
  const wishlistSection = document.querySelector(".wishlist-section");
  if (wishlistSection) wishlistSection.hidden = true;
}

const customerSessionReady = window.customerSessionReady || Promise.resolve({ status: "anonymous" });
window.medusaCartReady = customerSessionReady.then(() => loadMedusaCart());
window.medusaWishlistReady = customerSessionReady.then((session) => {
  if (session.status !== "authenticated") {
    renderWishlist(null);
    return null;
  }
  return loadWishlist();
});
