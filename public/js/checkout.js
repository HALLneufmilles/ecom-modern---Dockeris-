const placeOrderBtn = document.querySelector(".place-order-btn");
const shippingOptionsElement = document.querySelector("#shipping-options");
const paymentElementContainer = document.querySelector("#payment-element");
const checkoutStatus = document.querySelector(".checkout-status");

let checkoutCart = null;
let stripe = null;
let stripeElements = null;
let paymentPrepared = false;
let checkoutReady = false;
let checkoutBusy = false;
let checkoutResetPromise = null;

const requestCheckout = async (path, options) => {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "checkout_unavailable");
    error.status = response.status;
    throw error;
  }

  return data;
};

const setCheckoutStatus = (message, error = false) => {
  checkoutStatus.textContent = message;
  checkoutStatus.classList.toggle("error", error);
};

const setCheckoutBusy = (busy) => {
  checkoutBusy = busy;
  window.medusaCartBusy = busy;
  placeOrderBtn.disabled = busy || !checkoutReady || !checkoutCart?.items?.length;
  document.querySelectorAll('.shipping-option input, .cart button').forEach((element) => {
    element.disabled = busy || paymentPrepared || !checkoutReady || !checkoutCart?.items?.length;
  });
  placeOrderBtn.textContent = busy
    ? "processing..."
    : "place order";
};

const addressFields = ["last_name", "first_name", "address", "street", "city", "state", "pincode", "landmark", "country"];
const requiredAddressFields = ["last_name", "first_name", "address", "street", "city", "state", "pincode", "country"];
const addressMaxLengths = {
  last_name: 80,
  first_name: 80,
  address: 120,
  street: 120,
  city: 80,
  state: 80,
  pincode: 16,
  landmark: 120,
};
const postalCodePatterns = {
  fr: /^\d{5}$/,
  de: /^\d{5}$/,
  dk: /^\d{4}$/,
  es: /^\d{5}$/,
  gb: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  it: /^\d{5}$/,
  se: /^\d{3}\s?\d{2}$/,
};

const fieldId = (prefix, field) => `${prefix ? `${prefix}-` : ""}${field}`;

const collectAddress = (prefix = "") => Object.fromEntries(
  addressFields.map((field) => [field, document.querySelector(`#${fieldId(prefix, field)}`).value.trim()])
);

const clearAddressErrors = (prefix = "") => {
  addressFields.forEach((field) => {
    const element = document.querySelector(`#${fieldId(prefix, field)}`);
    const error = document.querySelector(`#${fieldId(prefix, field)}-error`);
    element.removeAttribute("aria-invalid");
    error.textContent = "";
  });
};

const resetCheckoutForm = () => {
  addressFields.forEach((field) => {
    const element = document.querySelector(`#${field}`);
    element.value = field === "country" ? "fr" : "";
  });
  clearAddressErrors();
  paymentElementContainer.replaceChildren();
  paymentElementContainer.hidden = true;
  shippingOptionsElement.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
  stripe = null;
  stripeElements = null;
  paymentPrepared = false;
  setCheckoutStatus("");
};

const addressErrors = (address) => {
  const errors = {};
  requiredAddressFields.forEach((field) => {
    if (!address[field]) errors[field] = "This field is required.";
  });

  Object.entries(addressMaxLengths).forEach(([field, maxLength]) => {
    if (address[field] && address[field].length > maxLength) {
      errors[field] = `Maximum ${maxLength} characters.`;
    }
  });

  if (address.pincode && postalCodePatterns[address.country] && !postalCodePatterns[address.country].test(address.pincode)) {
    errors.pincode = "Enter a valid postal code for the selected country.";
  }

  return errors;
};

const displayAddressError = (prefix, field, message) => {
    const element = document.querySelector(`#${fieldId(prefix, field)}`);
    const error = document.querySelector(`#${fieldId(prefix, field)}-error`);
    if (message) element.setAttribute("aria-invalid", "true");
    else element.removeAttribute("aria-invalid");
    error.textContent = message || "";
};

const validateAddress = (address, prefix = "") => {
  const errors = addressErrors(address);
  addressFields.forEach((field) => displayAddressError(prefix, field, errors[field]));

  const firstInvalid = Object.keys(errors)[0];
  if (firstInvalid) document.querySelector(`#${fieldId(prefix, firstInvalid)}`).focus();
  return !firstInvalid;
};

// Autofill can update several inputs in one operation. Recheck all displayed
// errors without marking untouched empty fields or moving keyboard focus.
const refreshAddressErrors = (prefix, changedField) => {
  const address = collectAddress(prefix);
  const errors = addressErrors(address);
  addressFields.forEach((field) => {
    const element = document.querySelector(`#${fieldId(prefix, field)}`);
    if (element.hasAttribute("aria-invalid") || field === changedField
      || (changedField === "country" && field === "pincode" && address.pincode)) {
      displayAddressError(prefix, field, errors[field]);
    }
  });
};

addressFields.forEach((field) => {
  const element = document.querySelector(`#${field}`);
  ["input", "change", "blur"].forEach((event) => {
    element.addEventListener(event, () => {
      refreshAddressErrors("", field);
      setTimeout(() => refreshAddressErrors("", field), 0);
    });
  });
});

const renderPriceSummary = (cart) => {
  const currencyCode = cart.currency_code;
  ["subtotal", "shipping_total", "discount_total", "tax_total", "total"].forEach((field) => {
    const value = Number((field === "subtotal" ? cart.item_subtotal : cart[field]) ?? 0);
    const element = document.querySelector(`[data-summary="${field}"]`);
    const row = document.querySelector(`[data-summary-row="${field}"]`);
    element.textContent = formatCartPrice(value, currencyCode);
    if (row) row.hidden = value === 0;
  });
};

const selectedShippingOptionId = () => shippingOptionsElement.querySelector("input:checked")?.value;

const syncShippingSelection = () => {
  const applied = new Set((checkoutCart?.shipping_methods || []).map((method) => method.shipping_option_id));
  shippingOptionsElement.querySelectorAll("input").forEach((input) => {
    input.checked = applied.has(input.value);
  });
};

window.addEventListener("medusa-cart-updated", (event) => {
  checkoutCart = event.detail;
  renderPriceSummary(checkoutCart);
  syncShippingSelection();
  if (checkoutReady) setCheckoutBusy(checkoutBusy);
});
window.addEventListener("medusa-cart-busy", (event) => setCheckoutBusy(event.detail));
window.addEventListener("medusa-cart-error", () => setCheckoutStatus("Unable to update the cart. Please try again.", true));

const updateShippingMethod = async (shippingOptionId) => {
  syncShippingSelection();
  if (checkoutBusy || !checkoutReady || paymentPrepared || !checkoutCart?.items?.length) return;
  clearAddressErrors();
  const address = collectAddress();
  if (!validateAddress(address)) return;

  setCheckoutBusy(true);
  setCheckoutStatus("Updating delivery method...");
  try {
    const data = await requestCheckout(`/medusa-checkout/${encodeURIComponent(checkoutCart.id)}/shipping`, {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        address,
        shippingOptionId,
      }),
    });
    if (!data.cart?.id) throw new Error("invalid_shipping_response");
    renderCart(data.cart);
    setCheckoutStatus("");
  } catch (error) {
    setCheckoutStatus(error.message || "Unable to update the delivery method.", true);
  } finally {
    setCheckoutBusy(false);
  }
};

const renderShippingOptions = (shippingOptions, currencyCode) => {
  shippingOptionsElement.replaceChildren();

  shippingOptions.forEach((option) => {
    const price = option.calculated_price?.calculated_amount ?? option.amount ?? 0;
    const label = document.createElement("label");
    const input = document.createElement("input");
    const name = document.createElement("span");
    const formattedPrice = document.createElement("strong");

    label.className = "shipping-option";
    input.type = "radio";
    input.name = "shipping-option";
    input.value = option.id;
    input.addEventListener("change", () => updateShippingMethod(input.value));
    name.textContent = option.name;
    formattedPrice.textContent = formatCartPrice(Number(price), currencyCode);
    label.append(input, name, formattedPrice);
    shippingOptionsElement.appendChild(label);
  });
  syncShippingSelection();

  if (!shippingOptions.length) {
    shippingOptionsElement.textContent = "No delivery method is available for this cart.";
  }
};

const lockCheckoutDetails = () => {
  document.querySelectorAll(".form input, .form select, .shipping-option input, .cart button").forEach((element) => {
    element.disabled = true;
  });
};

const completeCart = async () => {
  const data = await requestCheckout(`/medusa-checkout/${encodeURIComponent(checkoutCart.id)}/complete`, {
    method: "POST",
  });
  sessionStorage.removeItem("medusa_cart_id");
  location.assign(`/order/${encodeURIComponent(data.order.id)}`);
};

const resumeStripeReturn = async (checkoutData) => {
  const clientSecret = new URLSearchParams(location.search).get("payment_intent_client_secret");
  if (!clientSecret) return false;

  stripe = Stripe(checkoutData.stripePublishableKey);
  setCheckoutBusy(true);
  setCheckoutStatus("Checking payment...");
  const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);

  if (error || !["succeeded", "requires_capture"].includes(paymentIntent?.status)) {
    setCheckoutStatus(error?.message || "Payment was not completed. Your cart is unchanged.", true);
    setCheckoutBusy(false);
    return false;
  }

  await completeCart();
  return true;
};

const resetCheckoutEntry = async () => {
  if (checkoutResetPromise) return checkoutResetPromise;

  checkoutResetPromise = (async () => {
    checkoutReady = false;
    resetCheckoutForm();
    setCheckoutBusy(true);

    const checkoutData = await requestCheckout(
      `/medusa-checkout/${encodeURIComponent(checkoutCart.id)}/reset`,
      { method: "POST" }
    );
    if (!checkoutData.cart?.id || !checkoutData.stripeCheckoutAvailable) {
      throw new Error("invalid_checkout_response");
    }

    renderCart(checkoutData.cart);
    renderShippingOptions(checkoutData.shippingOptions, checkoutData.cart.currency_code);
    checkoutReady = true;
    setCheckoutBusy(false);
    return checkoutData;
  })();

  try {
    return await checkoutResetPromise;
  } finally {
    checkoutResetPromise = null;
  }
};

const initializeCheckout = async () => {
  const session = await (window.customerSessionReady || Promise.resolve({ status: "anonymous" }));
  if (session.status === "unavailable") {
    setCheckoutStatus("Account service is temporarily unavailable.", true);
    placeOrderBtn.disabled = true;
    return;
  }

  if (session.status !== "authenticated") {
    location.replace("/login");
    return;
  }

  checkoutCart = await window.medusaCartReady;
  if (!checkoutCart?.id || !checkoutCart.items?.length) {
    showAlert("your cart is empty");
    placeOrderBtn.disabled = true;
    return;
  }

  try {
    const legacyStripeReturn = new URLSearchParams(location.search).has("payment_intent_client_secret");
    if (legacyStripeReturn) {
      const checkoutData = await requestCheckout(`/medusa-checkout/${encodeURIComponent(checkoutCart.id)}`);
      if (!checkoutData.stripeAvailable || !checkoutData.stripePublishableKey || typeof Stripe !== "function") {
        throw new Error("stripe_not_configured");
      }
      if (await resumeStripeReturn(checkoutData)) return;
    }
    await resetCheckoutEntry();
    if (new URLSearchParams(location.search).get("payment_cancelled") === "true") {
      setCheckoutStatus("Payment was canceled. Your cart is unchanged.");
    } else if (legacyStripeReturn) {
      setCheckoutStatus("Payment was not completed. Your cart is unchanged.", true);
    }
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.removeItem("user");
      location.replace("/login");
      return;
    }
    setCheckoutStatus("Checkout is temporarily unavailable.", true);
    placeOrderBtn.disabled = true;
  }
};

window.addEventListener("pageshow", async (event) => {
  const session = await (window.customerSessionReady || Promise.resolve({ status: "anonymous" }));
  if (!event.persisted || session.status !== "authenticated" || !checkoutCart?.id || !checkoutCart.items?.length) return;

  try {
    await resetCheckoutEntry();
  } catch (error) {
    setCheckoutStatus("Checkout is temporarily unavailable.", true);
    placeOrderBtn.disabled = true;
  }
});

const preparePayment = async () => {
  if (checkoutBusy || !checkoutReady || !checkoutCart?.items?.length) return;
  clearAddressErrors();
  const address = collectAddress();
  const shippingOptionId = selectedShippingOptionId();
  if (!validateAddress(address)) return;
  if (!shippingOptionId) {
    showAlert("select a delivery method");
    return;
  }

  setCheckoutBusy(true);
  setCheckoutStatus("Preparing secure payment...");
  const data = await requestCheckout(`/medusa-checkout/${encodeURIComponent(checkoutCart.id)}/prepare`, {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      address,
      shippingOptionId,
    }),
  });

  if (!data.cart?.id) throw new Error("invalid_checkout_response");
  renderCart(data.cart);
  stripe = Stripe(data.stripePublishableKey);
  stripeElements = stripe.elements({ clientSecret: data.clientSecret });
  stripeElements.create("payment").mount(paymentElementContainer);
  paymentElementContainer.hidden = false;
  paymentPrepared = true;
  lockCheckoutDetails();
  setCheckoutStatus("Enter your test card details, then confirm the order.");
  setCheckoutBusy(false);
};

const startHostedStripeCheckout = async () => {
  if (checkoutBusy || !checkoutReady || !checkoutCart?.items?.length) return;
  clearAddressErrors();
  const address = collectAddress();
  const shippingOptionId = selectedShippingOptionId();
  if (!validateAddress(address)) return;
  if (!shippingOptionId) {
    showAlert("select a delivery method");
    return;
  }

  setCheckoutBusy(true);
  setCheckoutStatus("Preparing secure payment...");
  const data = await requestCheckout(
    `/medusa-checkout/${encodeURIComponent(checkoutCart.id)}/stripe-checkout`,
    {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        address,
        shippingOptionId,
      }),
    }
  );

  if (!data.cart?.id || !data.checkoutUrl) throw new Error("invalid_checkout_response");
  renderCart(data.cart);
  const checkoutUrl = new URL(data.checkoutUrl);
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
    throw new Error("invalid_stripe_checkout_url");
  }
  location.assign(checkoutUrl.toString());
};

const confirmPayment = async () => {
  setCheckoutBusy(true);
  setCheckoutStatus("Confirming payment...");
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements: stripeElements,
    confirmParams: { return_url: `${location.origin}/checkout` },
    redirect: "if_required",
  });

  if (error) {
    setCheckoutStatus(error.message || "Payment failed. Your cart is unchanged.", true);
    setCheckoutBusy(false);
    return;
  }
  if (!["succeeded", "requires_capture"].includes(paymentIntent?.status)) {
    setCheckoutStatus("Payment is not complete. Your cart is unchanged.", true);
    setCheckoutBusy(false);
    return;
  }

  await completeCart();
};

placeOrderBtn.addEventListener("click", async () => {
  try {
    await startHostedStripeCheckout();
  } catch (error) {
    setCheckoutStatus(error.message || "Checkout is temporarily unavailable.", true);
    setCheckoutBusy(false);
  }
});

window.addEventListener("load", initializeCheckout);
