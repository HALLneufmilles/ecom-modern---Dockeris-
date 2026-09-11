const statusElement = document.querySelector("#checkout-return-status");
const returnLink = document.querySelector("#checkout-return-link");
const loaderElement = document.querySelector(".checkout-return-loader");
const params = new URLSearchParams(location.search);
const cartId = params.get("cart_id");
const sessionId = params.get("session_id");
const orderPlacedNoticeKey = "order-placed-notice";

const showReturnError = (message) => {
  loaderElement.hidden = true;
  statusElement.textContent = message;
  statusElement.hidden = false;
  returnLink.hidden = false;
};

const waitForOrder = async () => {
  if (!cartId || !sessionId) {
    showReturnError("The checkout return link is invalid. Your cart is unchanged.");
    return;
  }

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const query = new URLSearchParams({ cart_id: cartId, session_id: sessionId });
    const response = await fetch(`/stripe-checkout/status?${query}`);
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace("/login");
      return;
    }
    if (!response.ok) {
      showReturnError("Unable to confirm the order yet. Your cart is unchanged.");
      return;
    }
    if (data.status === "complete" && data.order?.id) {
      localStorage.removeItem("medusa_cart_id");
      sessionStorage.setItem(orderPlacedNoticeKey, data.order.id);
      location.replace(`/order/${encodeURIComponent(data.order.id)}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  showReturnError("Payment confirmation is still processing. Your cart has been preserved.");
};

waitForOrder().catch(() => {
  showReturnError("Unable to confirm the order yet. Your cart is unchanged.");
});
