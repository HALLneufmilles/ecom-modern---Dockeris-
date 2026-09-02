const formatCartPrice = (amount, currencyCode) => {
  const currency = currencyCode?.toUpperCase();

  if (currency) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount));
  }

  return `$${Number(amount).toFixed(2)}`;
};

const createSmallCard = (item, { mutable = false } = {}) => `
  <div class="sm-product"${item.lineId ? ` data-line-id="${item.lineId}"` : ""}>
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
    <p class="sm-price">${formatCartPrice(item.unitPrice * item.quantity, item.currencyCode)}</p>
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

  document.querySelector(".bill").textContent = formatCartPrice(Number(cart.total || 0), cart.currency_code);
  bindCartEvents(cart.id);
  window.currentMedusaCart = cart;
  return cart;
};

const mutateCartItem = async (cartId, lineId, method, quantity) => {
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
    card?.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
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

const renderWishlist = () => {
  const element = document.querySelector(".wishlist");
  if (!element) return;

  let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
  element.innerHTML = "";
  if (!wishlist.length) {
    emptyList(element);
    return;
  }

  wishlist.forEach((item, index) => {
    element.insertAdjacentHTML("beforeend", createSmallCard({
      name: item.name,
      shortDes: item.shortDes,
      image: item.image,
      quantity: Number(item.item),
      unitPrice: Number(item.sellPrice),
      currencyCode: item.currencyCode,
    }));
    element.lastElementChild.querySelector(".sm-delete-btn").addEventListener("click", () => {
      wishlist = wishlist.filter((entry, itemIndex) => itemIndex !== index);
      localStorage.setItem("wishlist", JSON.stringify(wishlist));
      renderWishlist();
    });
  });
};

window.medusaCartReady = loadMedusaCart();
renderWishlist();
