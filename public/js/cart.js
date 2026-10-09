const formatCartPrice = (amount, currencyCode) => {
  const currency = currencyCode?.toUpperCase();

  if (currency) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount));
  }

  return `$${Number(amount).toFixed(2)}`;
};

const createSmallCard = (item, { mutable = false } = {}) => `
  <div class="sm-product"${item.lineId ? ` data-line-id="${item.lineId}"` : ""}${item.wishlistItemId ? ` data-wishlist-item-id="${item.wishlistItemId}"` : ""}>
    <img src="${item.image || "img/no image.png"}" class="sm-product-img" alt="">
    <div class="sm-text">
      <p class="sm-product-name">${item.name || "Product"}</p>
      <p class="sm-des">${item.shortDes || ""}</p>
    </div>
    <div class="item-counter">
      <button class="counter-btn decrement"${mutable ? "" : " disabled"}>-</button>
      <p class="item-count">${item.quantity}</p>
      <button class="counter-btn increment"${mutable ? "" : " disabled"}>+</button>
    </div>
    <p class="sm-price">${formatCartPrice(item.lineTotal ?? item.unitPrice * item.quantity, item.currencyCode)}</p>
    <button class="sm-delete-btn"><img src="img/close.png" alt=""></button>
  </div>
`;

const normalizeMedusaItem = (item, currencyCode) => ({
  lineId: item.id,
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
    throw error;
  }

  return data.cart;
};

const renderCart = (cart) => {
  const element = document.querySelector(".cart");
  const items = (cart.items || []).map((item) => normalizeMedusaItem(item, cart.currency_code));

  element.innerHTML = "";
  if (!items.length) {
    emptyList(element);
  } else {
    items.forEach((item) => element.insertAdjacentHTML("beforeend", createSmallCard(item, { mutable: true })));
  }

  document.querySelector(".bill").textContent = formatCartPrice(Number(cart.item_subtotal || 0), cart.currency_code);
  bindCartEvents(cart.id);
  window.currentMedusaCart = cart;
  window.dispatchEvent(new CustomEvent("medusa-cart-updated", { detail: cart }));
  return cart;
};

const mutateCartItem = async (cartId, lineId, method, quantity) => {
  if (window.medusaCartBusy) return;
  window.medusaCartBusy = true;
  window.dispatchEvent(new CustomEvent("medusa-cart-busy", { detail: true }));
  const card = document.querySelector(`.sm-product[data-line-id="${lineId}"]`);
  card?.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  try {
    const cart = await requestCart(`/medusa-cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(lineId)}`, {
      method,
      headers: quantity ? new Headers({ "Content-Type": "application/json" }) : undefined,
      body: quantity ? JSON.stringify({ quantity }) : undefined,
    });
    renderCart(cart);
  } catch (error) {
    window.dispatchEvent(new CustomEvent("medusa-cart-error", { detail: error.message }));
    card?.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
  } finally {
    window.medusaCartBusy = false;
    window.dispatchEvent(new CustomEvent("medusa-cart-busy", { detail: false }));
  }
};

const bindCartEvents = (cartId) => {
  document.querySelectorAll(".cart .sm-product").forEach((card) => {
    const lineId = card.dataset.lineId;
    const count = card.querySelector(".item-count");
    const quantity = () => Number(count.textContent);

    card.querySelector(".decrement").addEventListener("click", () => {
      if (quantity() > 1) mutateCartItem(cartId, lineId, "PATCH", quantity() - 1);
    });
    card.querySelector(".increment").addEventListener("click", () => {
      if (quantity() < 9) mutateCartItem(cartId, lineId, "PATCH", quantity() + 1);
    });
    card.querySelector(".sm-delete-btn").addEventListener("click", () => {
      mutateCartItem(cartId, lineId, "DELETE");
    });
  });
};

const loadMedusaCart = async () => {
  const cartId = localStorage.getItem("medusa_cart_id");
  const element = document.querySelector(".cart");

  if (!cartId) {
    emptyList(element);
    document.querySelector(".bill").textContent = "$0.00";
    window.currentMedusaCart = null;
    return null;
  }

  try {
    return renderCart(await requestCart(`/medusa-cart/${encodeURIComponent(cartId)}`));
  } catch (error) {
    if (error.status === 404) localStorage.removeItem("medusa_cart_id");
    emptyList(element);
    document.querySelector(".bill").textContent = "$0.00";
    window.currentMedusaCart = null;
    return null;
  }
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
    element.insertAdjacentHTML("beforeend", createSmallCard({
      wishlistItemId: item.id,
      name: product.name,
      shortDes: product.shortDes,
      image: product.image,
      quantity: 1,
      unitPrice: Number(product.price?.amount || 0),
      currencyCode: product.price?.currencyCode,
    }));
    element.lastElementChild.querySelector(".sm-delete-btn").addEventListener("click", async () => {
      const response = await fetch(`/medusa-wishlist/items/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadWishlist();
      }
    });
  });
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

window.medusaCartReady = loadMedusaCart();
window.medusaWishlistReady = loadWishlist();
