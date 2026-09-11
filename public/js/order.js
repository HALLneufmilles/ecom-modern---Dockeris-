const orderId = location.pathname.split("/").filter(Boolean).at(-1);
const orderPlacedNoticeKey = "order-placed-notice";

const formatOrderPrice = (amount, currencyCode) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: currencyCode.toUpperCase(),
}).format(Number(amount));

const renderOrder = (order) => {
  document.querySelector(".order-reference").textContent = `Order #${order.display_id || order.id}`;
  const orderStatus = document.querySelector(".order-status");
  orderStatus.replaceChildren();
  [
    ["Order status", order.status],
    ["Payment status", order.payment_status],
    ["Fulfillment status", order.fulfillment_status],
  ].forEach(([label, value]) => {
    const container = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = value;
    container.append(term, description);
    orderStatus.appendChild(container);
  });

  const orderItems = document.querySelector(".order-items");
  orderItems.replaceChildren();
  (order.items || []).forEach((item) => {
    const article = document.createElement("article");
    const image = document.createElement("img");
    const details = document.createElement("div");
    const productName = document.createElement("strong");
    const variantName = document.createElement("span");
    const quantityAndPrice = document.createElement("span");

    article.className = "order-item";
    image.src = item.thumbnail || "/img/no image.png";
    image.alt = "";
    productName.textContent = item.product_title || item.title;
    variantName.textContent = item.variant_title || "";
    quantityAndPrice.textContent = `${item.quantity} × ${formatOrderPrice(Number(item.unit_price), order.currency_code)}`;
    details.append(productName, variantName);
    article.append(image, details, quantityAndPrice);
    orderItems.appendChild(article);
  });
  document.querySelector(".order-total").textContent = `Total: ${formatOrderPrice(Number(order.total || 0), order.currency_code)}`;
};

const showOrderPlacedNotice = () => {
  if (sessionStorage.getItem(orderPlacedNoticeKey) !== orderId) return;

  sessionStorage.removeItem(orderPlacedNoticeKey);
  const notice = document.createElement("div");
  notice.className = "order-placed-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.innerHTML = `
    <span class="order-placed-notice__check" aria-hidden="true">✓</span>
    <span class="order-placed-notice__text">Order Is Placed</span>
  `;
  document.body.appendChild(notice);

  requestAnimationFrame(() => notice.classList.add("order-placed-notice--animate"));
  notice.addEventListener("animationend", () => notice.remove(), { once: true });
};

const loadOrder = async () => {
  if (!sessionStorage.user) {
    location.replace("/login");
    return;
  }

  const response = await fetch(`/medusa-orders/${encodeURIComponent(orderId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.order) {
    location.replace("/404");
    return;
  }
  renderOrder(data.order);
  showOrderPlacedNotice();
};

loadOrder();
