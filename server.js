// importing packages
const express = require("express");
const admin = require("firebase-admin");
const bcrypt = require("bcrypt");
const path = require("path");
const { GUEST_CART_COOKIE, signGuestCart, verifyGuestCart, getGuestCartId } = require("./guest-cart-proof");
const { resolveCartCustomerAuth } = require("./cart-customer-auth");
const dotenv = require("dotenv");
const { storefrontConfig, isStorefrontFeatureEnabled } = require("./public/js/storefront-features");
const { selectCategoryRecommendations } = require("./recommendations");

dotenv.config();
// firebase admin setup
// let serviceAccount = {
//   type: "service_account",
//   project_id: "ecom-website-ef3e5",
//   private_key_id: "993f185ab00e65da7ba94d64edf92ed5b2cc8e19",
//   private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDK3JLDRCe9uW5V\nqcnwG77F8RZVT7Mjc5JpnS9tTXlfWSBbz6fKpevHBM8ARIMpTzAo9DNgXloFJy4h\nVFnqzcswHed+1i8BRGYRQ5D9AkWm+p28d8xpLjZuKbn3iCBIHlVKYqPO3B1q79NM\nmGloX7WBNX0sMYvo3EBfJS2X0ysXO2a/Pdm7+MO1n0hFZbeGFxiLC0dsDtvha5+Q\nNl55Lw8CoCfbOJQXowHwty/YVKGsgFzunw6u98iymi6KbmwUhni4Eb2/1S03yauc\noTxHlj/XPuIAhNfYXQs3dkt5HYFLShTNaHVCSy5Qs/DLcluBwYrLPP/kPLV3sPWp\nhlKnb6uTAgMBAAECggEAHwurU5eOSW/Oc0JdIDzuxkDuJ7eJynwjxRFZh8MajGgJ\nwWNB4jaK+ICY5AlC1W3uszskKF8S1xphlJeMfJhqvH4Rxox60cPTpwK4drAD/tj4\njjZQodbWXPz6c+fGS6MwxFsyMd89NUy8q/U19H4+kHv3dcL4uXYI9/FVophI+PCd\nb6jkT/+gGilua8AQNSpe+tIPrSlFD98KP6vjBywlIdS5/gd8T1cgolS/fJfmCB+1\nlC4Jkg2WOSKJVwLapyjFyPgqSWHgQNM1wZuMo1WuE1xD5iQ/XhocSy9LdydG3K5c\n7jD7pVBq6W86N7NxnzhEyzADUEvOLPaaCjmvKjsrUQKBgQDxuIKHU6bVXYuir7oR\nL9YKVU/F3xIdjqDmviSWVmfp5kO6hpVXdAQOE+d8+FosAHAM8SbeMz3+MIy/asWp\nf1hfjHPxye16+sySLlhb6p6G5ydYnMeAM8j+F57uyur+hW6oPlbfVlZDlsfrZUFr\nGqjvZ61Y6J3YD8VG1/Ot124ASwKBgQDW2GfBkYsYJlVU2MLv/oD/pczMgFh7AyUg\nOg93fHLj2rUrxgNGrLR0BEmiAvzisbpsHuYpsQiPeA2XlSsE4KCivF2n+55MN4GS\nkK8AVL2gj6cLaI0sbgvX939083w7qc8Hd/RUmPVpwX/F41qWIcZkl/nWZixB4Bpm\nlt/ATejE2QKBgCAS038RYnm9R+H2X0IYjtYgK82do9G4MzFq2X/5RyCKJUKCyR4p\njsAvc+/pJE3iYPvWo8moEvm/h21+xWuQMjG7eUcD/DbtQGfFLoRDxXUxBs+DPhWM\nyYatq7ETy8qp+dzpKK3Jzvh48V4SuXN0viXGJAJAG3Gn5g1YakUO6NGxAoGBAIM+\ncaui4GihSjFptTPsshr5yvEGWobS9gQI09f3MywUN+aEsQ2khRv2XpDU6G0Hi01v\nVsUTO5qBCTSXUE9LdXXUQhZTNHF02veQ4Qb/vVNvTek/NjZ1B1EoBTmJYFQGOM1k\nLuLbCdhP92EIsRbTjSF4YYvioJihcR9IfWk5br+JAoGAM420uoTqOs+Pzdj6ufmU\nArXgx11HcOI49qWpHRPthOOAG+eSNj/4Vhyo9Qd70WM76FQjiixdr4XkVka4uW0I\n5fDE2zQrB4AqfQmqECgK2Oy3E4bUFyz4PuNF+DqX1lmKIUWFSXG/BItYVRHN7IOG\nQkTz5Wuce3IpW2bDzGOwkSI=\n-----END PRIVATE KEY-----\n",
//   client_email: "firebase-adminsdk-igrd4@ecom-website-ef3e5.iam.gserviceaccount.com",
//   client_id: "108310191022764476750",
//   auth_uri: "https://accounts.google.com/o/oauth2/auth",
//   token_uri: "https://oauth2.googleapis.com/token",
//   auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
//   client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-igrd4%40ecom-website-ef3e5.iam.gserviceaccount.com",
// };

const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY
    ? process.env.PRIVATE_KEY.replace(/\\n/gm, "\n")
    : undefined,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER,
  client_x509_cert_url: process.env.CLIENT_X509,
};
//const { isNumberObject } = require("util/types");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

let db = admin.firestore();
console.log(process.env.PROJECT_ID);
// aws config
const aws = require("aws-sdk");

const { log } = require("console");

// aws parameters
const region = "eu-west-3";
const bucketName = "monpremiersite";
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

aws.config.update({
  region,
  accessKeyId,
  secretAccessKey,
});

// init s3
const s3 = new aws.S3();

// generate image upload link
async function generateUrl() {
  let date = new Date();
  let id = parseInt(Math.random() * 10000000000);

  const imageName = `${id}${date.getTime()}.jpg`;

  const params = {
    Bucket: bucketName,
    Key: imageName,
    Expires: 300, //300 ms
    ContentType: "image/jpeg",
  };
  const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
  return uploadUrl;
}

// declare static path
let staticPath = path.join(__dirname, "public");

//intializing express.js
const app = express();

//middlewares
app.use(express.static(staticPath));

app.post("/stripe-checkout/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.get("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) {
    return res.status(400).send("Invalid Stripe webhook request");
  }

  try {
    const medusaWebhookUrl = new URL(
      "/hooks/stripe-checkout",
      process.env.MEDUSA_BACKEND_URL || "http://medusa:9000"
    );
    const response = await fetch(medusaWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: req.body,
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();
    return res.status(response.status).type(response.headers.get("content-type") || "text/plain").send(body);
  } catch (error) {
    console.error("Stripe Checkout webhook proxy failed:", error.message);
    return res.status(502).send("Stripe webhook delivery failed");
  }
});

app.use(express.json());

//routes
//home route
app.get("/", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

const getMedusaStoreConfig = () => ({
  backendUrl: process.env.MEDUSA_BACKEND_URL || "http://medusa:9000",
  publishableApiKey: process.env.MEDUSA_PUBLISHABLE_API_KEY,
});

const isStorefrontFeatureActive = (feature) => isStorefrontFeatureEnabled(storefrontConfig, feature);
const isWishlistFeatureEnabled = () => process.env.MVDW_FEATURE_WISHLIST !== "false";

app.get("/storefront-config.js", (req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  return res.send(`window.storefrontRuntimeConfig = Object.freeze({ features: Object.freeze({ wishlist: ${isWishlistFeatureEnabled()} }) });`);
});

const fetchMedusaStore = async (pathname, { method = "GET", body, token, guestProof, timeout = 5000 } = {}) => {
  const { backendUrl, publishableApiKey } = getMedusaStoreConfig();
  const url = new URL(pathname, backendUrl);
  const response = await fetch(url, {
    method,
    headers: {
      "x-publishable-api-key": publishableApiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(guestProof ? { Cookie: `${GUEST_CART_COOKIE}=${guestProof}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Medusa Store API request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

const getDefaultMedusaRegionId = async () => {
  const data = await fetchMedusaStore("/store/regions?limit=1");
  const regionId = data?.regions?.[0]?.id;

  if (!regionId) {
    throw new Error("No Medusa region is available");
  }

  return regionId;
};

const getVariantOptionValue = (variantOption) => ({
  optionId: variantOption.option_id,
  value: variantOption.value,
});

const mapMedusaProduct = (product, regionId) => {
  const productImageRecords = (product.images || []).filter((image) => image?.id && image?.url);
  const productImages = productImageRecords.map((image) => image.url);
  const productImagesById = new Map(productImageRecords.map((image) => [image.id, image]));
  const mediaByColor = Object.fromEntries(
    Object.entries(product.metadata?.media_by_color || {}).map(([color, gallery]) => [
      color,
      Array.isArray(gallery?.image_ids)
        ? gallery.image_ids.map((imageId) => productImagesById.get(imageId)).filter(Boolean)
        : [],
    ])
  );
  const variants = (product.variants || []).map((variant) => {
    const price = variant.calculated_price;
    const inventoryQuantity = variant.inventory_quantity;
    const variantImages = (variant.images || []).map((image) => image.url).filter(Boolean);
    const hasVariantSpecificImages = variantImages.length > 0 && (
      variantImages.length !== productImages.length
      || variantImages.some((image) => !productImages.includes(image))
    );
    const available = variant.manage_inventory === false
      || variant.allow_backorder === true
      || Number(inventoryQuantity) > 0;

    return {
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      images: hasVariantSpecificImages ? variantImages : [],
      options: (variant.options || []).map(getVariantOptionValue),
      price: price ? {
        amount: Number(price.calculated_amount),
        originalAmount: Number(price.original_amount ?? price.calculated_amount),
        currencyCode: price.currency_code,
      } : null,
      inventoryQuantity,
      manageInventory: variant.manage_inventory,
      allowBackorder: variant.allow_backorder,
      available,
    };
  });

  const options = (product.options || []).map((option) => {
    const directValues = option.values?.map((value) => value.value).filter(Boolean) || [];
    const values = directValues.length ? directValues : variants.flatMap((variant) => variant.options
        .filter((variantOption) => variantOption.optionId === option.id)
        .map((variantOption) => variantOption.value));

    return {
      id: option.id,
      title: option.title,
      values: [...new Set(values.filter(Boolean))],
    };
  });

  return {
    source: "medusa",
    id: product.id,
    regionId,
    name: product.title,
    shortDes: product.subtitle || product.description || "",
    des: product.description || "",
    images: productImages.length ? productImages : [product.thumbnail].filter(Boolean),
    mediaByColor,
    thumbnail: product.thumbnail,
    options,
    variants,
    tags: (product.tags || []).map((tag) => tag.value).filter(Boolean),
  };
};

const getMostSpecificCategoryName = (categories = []) => {
  const mostSpecificCategory = categories
    .filter((category) => category?.name)
    .reduce((current, category) => {
      const currentDepth = current?.mpath?.split(".").length || 0;
      const categoryDepth = category.mpath?.split(".").length || 0;

      return categoryDepth > currentDepth ? category : current;
    }, null);

  return mostSpecificCategory?.name || null;
};

const mapMedusaCatalogueCard = (product) => {
  const pricedVariant = product.variants?.find((variant) => variant.calculated_price);
  const calculatedPrice = pricedVariant?.calculated_price;

  if (!calculatedPrice) {
    throw new Error(`No calculated price is available for Medusa product ${product.id}`);
  }

  const sellPrice = Number(calculatedPrice.calculated_amount);
  const actualPrice = Number(calculatedPrice.original_amount ?? sellPrice);

  return {
    id: product.id,
    name: product.title,
    category: getMostSpecificCategoryName(product.categories),
    brand: typeof product.metadata?.brand === "string" && product.metadata.brand.trim()
      ? product.metadata.brand
      : null,
    image: product.thumbnail || product.images?.[0]?.url || "/img/no image.png",
    sellPrice,
    actualPrice,
    discount: actualPrice > sellPrice
      ? Math.round(((actualPrice - sellPrice) / actualPrice) * 100)
      : 0,
    currencyCode: calculatedPrice.currency_code,
  };
};

const getMedusaProductsForCategories = async (categoryIds, regionId, backendUrl) => {
  const productsUrl = new URL("/store/products", backendUrl);
  categoryIds.forEach((categoryId) => productsUrl.searchParams.append("category_id[]", categoryId));
  productsUrl.searchParams.set("region_id", regionId);
  productsUrl.searchParams.set("limit", "100");
  productsUrl.searchParams.set("fields", "*categories,+metadata");

  const data = await fetchMedusaStore(productsUrl.pathname + productsUrl.search);

  if (!Array.isArray(data.products)) {
    throw new Error("Medusa Store API returned an invalid product list");
  }

  return data.products;
};

const getMedusaRecommendations = async (productId, regionId, backendUrl) => {
  const productUrl = new URL(`/store/products/${encodeURIComponent(productId)}`, backendUrl);
  productUrl.searchParams.set("region_id", regionId);
  productUrl.searchParams.set("fields", "*categories");

  const [productData, categoriesData] = await Promise.all([
    fetchMedusaStore(productUrl.pathname + productUrl.search),
    fetchMedusaStore("/store/product-categories?limit=100"),
  ]);
  const currentProduct = productData.product;
  const categories = categoriesData.product_categories;

  if (!currentProduct || !Array.isArray(categories)) {
    throw new Error("Medusa Store API returned invalid recommendation data");
  }

  return selectCategoryRecommendations({
    currentProduct,
    categories,
    loadProductsForCategories: (categoryIds) => getMedusaProductsForCategories(categoryIds, regionId, backendUrl),
    mapProduct: mapMedusaCatalogueCard,
  });
};

// F-14 - home catalogue from the Medusa Store API
app.get("/medusa-home-products", async (req, res) => {
  const { publishableApiKey } = getMedusaStoreConfig();

  if (!publishableApiKey) {
    return res.status(503).json({ error: "catalogue_unavailable" });
  }

  try {
    const { backendUrl } = getMedusaStoreConfig();
    const regionId = await getDefaultMedusaRegionId();
    const productsUrl = new URL("/store/products", backendUrl);
    // The storefront renders the current demonstration catalogue in one scrollable list.
    // Product data stays lightweight; card images are deferred by the browser in the UI.
    productsUrl.searchParams.set("limit", "100");
    productsUrl.searchParams.set("order", "-created_at");
    productsUrl.searchParams.set("region_id", regionId);
    productsUrl.searchParams.set("fields", "*categories,+metadata");
    const productsData = await fetchMedusaStore(productsUrl.pathname + productsUrl.search);
    const medusaProducts = productsData.products;

    if (!Array.isArray(medusaProducts)) {
      throw new Error("Medusa Store API returned an invalid product list");
    }

    const products = medusaProducts.map(mapMedusaCatalogueCard);

    return res.json(products);
  } catch (error) {
    console.error("F-14 Medusa catalogue unavailable:", error.message);
    return res.status(502).json({ error: "catalogue_unavailable" });
  }
});

// F-15 - basic catalogue search through the Medusa Store API.
app.get("/medusa-search-products", async (req, res) => {
  const { publishableApiKey, backendUrl } = getMedusaStoreConfig();
  const searchQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!searchQuery || searchQuery.length > 200) {
    return res.status(400).json({ error: "invalid_search_query" });
  }

  if (!publishableApiKey) {
    return res.status(503).json({ error: "catalogue_unavailable" });
  }

  try {
    const regionId = await getDefaultMedusaRegionId();
    const productsUrl = new URL("/store/products", backendUrl);
    productsUrl.searchParams.set("q", searchQuery);
    productsUrl.searchParams.set("region_id", regionId);
    productsUrl.searchParams.set("limit", "50");

    const productsData = await fetchMedusaStore(productsUrl.pathname + productsUrl.search);
    const medusaProducts = productsData.products;

    if (!Array.isArray(medusaProducts)) {
      throw new Error("Medusa Store API returned an invalid product list");
    }

    return res.json(medusaProducts.map(mapMedusaCatalogueCard));
  } catch (error) {
    console.error("F-15 Medusa catalogue search unavailable:", error.message);
    return res.status(502).json({ error: "catalogue_unavailable" });
  }
});

// F-16 - category-based product recommendations from the Medusa Store API.
app.get("/medusa-products/:id/recommendations", async (req, res) => {
  if (!isStorefrontFeatureActive("recommendations")) {
    return res.status(404).json({ error: "recommendations_disabled" });
  }

  const { publishableApiKey, backendUrl } = getMedusaStoreConfig();

  if (!publishableApiKey) {
    return res.status(503).json({ error: "catalogue_unavailable" });
  }

  try {
    const regionId = await getDefaultMedusaRegionId();
    const recommendations = await getMedusaRecommendations(req.params.id, regionId, backendUrl);
    return res.json(recommendations);
  } catch (error) {
    console.error("F-16 Medusa recommendations unavailable:", error.message);
    const status = error.status === 404 ? 404 : 502;
    return res.status(status).json({ error: status === 404 ? "product_not_found" : "catalogue_unavailable" });
  }
});

app.get("/medusa-products/:id", async (req, res) => {
  const { publishableApiKey, backendUrl } = getMedusaStoreConfig();

  if (!publishableApiKey) {
    return res.status(503).json({ error: "catalogue_unavailable" });
  }

  try {
    const regionId = await getDefaultMedusaRegionId();
    const productUrl = new URL(`/store/products/${encodeURIComponent(req.params.id)}`, backendUrl);
    productUrl.searchParams.set("region_id", regionId);
    productUrl.searchParams.set("fields", "*variants.images,*variants.calculated_price,+variants.inventory_quantity,+metadata");

    const data = await fetchMedusaStore(productUrl.pathname + productUrl.search);
    return res.json(mapMedusaProduct(data.product, regionId));
  } catch (error) {
    console.error("F-04 Medusa product unavailable:", error.message);
    const status = error.status === 404 ? 404 : 502;
    return res.status(status).json({ error: status === 404 ? "product_not_found" : "catalogue_unavailable" });
  }
});

const createMedusaCart = async (regionId, token) => {
  const data = await fetchMedusaStore("/store/carts?fields=+customer_id", {
    method: "POST",
    body: { region_id: regionId },
    token,
  });

  return data.cart;
};

const MEDUSA_AUTH_COOKIE = "medusa_customer_token";

const readCookie = (req, name) => {
  const prefix = `${name}=`;
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
};

const getMedusaCustomerToken = (req) => readCookie(req, MEDUSA_AUTH_COOKIE);
const getGuestCartProof = (req) => readCookie(req, GUEST_CART_COOKIE);

const guestCartCookieOptions = () => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `HttpOnly; SameSite=Lax; Path=/${secure}`;
};

const setGuestCartCookie = (res, proof) => {
  res.append("Set-Cookie", `${GUEST_CART_COOKIE}=${proof}; ${guestCartCookieOptions()}`);
};

const clearGuestCartCookie = (res) => {
  res.append("Set-Cookie", `${GUEST_CART_COOKIE}=; ${guestCartCookieOptions()}; Max-Age=0`);
};

const setMedusaCustomerCookie = (res, token) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${MEDUSA_AUTH_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`
  );
};

const clearMedusaCustomerCookie = (res) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${MEDUSA_AUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
  );
};

const retrieveMedusaCart = async (cartId, token, guestProof) => {
  const data = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cartId)}?fields=+items.total,+customer_id,+completed_at`, {
    token, guestProof,
  });
  return data.cart;
};

const updateMedusaCustomer = async (token, body) => {
  const data = await fetchMedusaStore("/store/customers/me", {
    method: "POST",
    body,
    token,
  });
  return data.customer;
};

const retrieveMedusaCustomer = async (token) => {
  const data = await fetchMedusaStore("/store/customers/me", { token });
  return data.customer;
};

const transferMedusaCart = async (cartId, token, guestProof) => {
  const data = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cartId)}/customer`, {
    method: "POST",
    token,
    guestProof,
  });
  return data.cart;
};

const findUsableMedusaCart = async (cartId, token) => {
  if (!cartId) {
    return null;
  }

  try {
    const cart = await retrieveMedusaCart(cartId, token);
    return cart.completed_at ? null : cart;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
};

const restoreCustomerCart = async (token) => {
  const customer = await retrieveMedusaCustomer(token);
  try {
    const customerCartId = typeof customer.metadata?.active_cart_id === "string"
      ? customer.metadata.active_cart_id
      : null;
    let cart = await findUsableMedusaCart(customerCartId, token);
    if (cart?.customer_id !== customer.id) cart = null;
    if (!cart) cart = await createMedusaCart(await getDefaultMedusaRegionId(), token);
    await updateMedusaCustomer(token, {
      metadata: { ...customer.metadata, active_cart_id: cart.id },
    });
    return { customer, cart };
  } catch (error) {
    console.error("Customer authenticated, but cart restoration failed:", error.message);
    return { customer, cart: null };
  }
};

const resolveSignupCart = async (token, guestProof) => {
  const customer = await retrieveMedusaCustomer(token);
  let cart = null;
  const guestCartId = getGuestCartId(guestProof);
  if (guestCartId) {
    try {
      const candidate = await retrieveMedusaCart(guestCartId, token, guestProof);
      if (!candidate.customer_id && !candidate.completed_at) {
        cart = await transferMedusaCart(candidate.id, token, guestProof);
      }
    } catch (error) {
      console.error("Guest cart could not be attached during signup:", error.message);
    }
  }
  if (!cart) cart = await createMedusaCart(await getDefaultMedusaRegionId(), token);
  await updateMedusaCustomer(token, {
    metadata: { ...customer.metadata, active_cart_id: cart.id },
  });
  return { customer, cart };
};

const resolveCartCustomer = (req, res) => resolveCartCustomerAuth(req, res, {
  getToken: getMedusaCustomerToken,
  retrieveCustomer: retrieveMedusaCustomer,
  clearCookie: clearMedusaCustomerCookie,
});

app.get("/medusa-customer/session", async (req, res) => {
  try {
    const { token, customer } = await resolveCartCustomer(req, res);
    if (!token || !customer) {
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      user: {
        name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error("Medusa customer session restoration failed:", error.message);
    return res.status(503).json({ error: "customer_session_unavailable" });
  }
});

const requireCartAccess = async (req, res, cartId) => {
  const { token, customer } = await resolveCartCustomer(req, res);
  const guestProof = getGuestCartProof(req);
  const cart = await retrieveMedusaCart(cartId, token, token ? null : guestProof);
  if (cart.completed_at) {
    const error = new Error("cart_not_found");
    error.status = 404;
    throw error;
  }

  if (cart.customer_id) {
    if (customer?.id === cart.customer_id) return { cart, token };
  } else if (!token && verifyGuestCart(guestProof, cartId)) {
    return { cart, token: null, guestProof };
  }

  const error = new Error("cart_not_found");
  error.status = 404;
  throw error;
};

const resolveCurrentCart = async (req, res) => {
  const { token, customer } = await resolveCartCustomer(req, res);
  if (token) {
    const cartId = customer.metadata?.active_cart_id;
    if (typeof cartId !== "string" || !cartId) return null;
    try {
      const { cart } = await requireCartAccess(req, res, cartId);
      return cart.customer_id === customer.id ? cart : null;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  const cartId = getGuestCartId(getGuestCartProof(req));
  if (!cartId) return null;
  try {
    const { cart } = await requireCartAccess(req, res, cartId);
    return cart.customer_id ? null : cart;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

const addMedusaCartItem = async (cartId, variantId, quantity, token, guestProof) => {
  const data = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cartId)}/line-items`, {
    method: "POST",
    body: { variant_id: variantId, quantity },
    token,
    guestProof,
  });

  return data.cart;
};

const requireWishlistToken = (req, res) => {
  if (!isWishlistFeatureEnabled()) {
    res.status(404).json({ error: "wishlist_disabled" });
    return null;
  }

  const token = getMedusaCustomerToken(req);
  if (!token) {
    res.status(401).json({ error: "authentication_required" });
    return null;
  }

  return token;
};

const sendWishlistError = (res, error) => {
  if (error.status === 401) {
    return res.status(401).json({ error: "authentication_required" });
  }

  if (error.status === 404) {
    return res.status(404).json({ error: "wishlist_not_found" });
  }

  if (error.status === 400) {
    return res.status(400).json({ error: "invalid_wishlist_item" });
  }

  return res.status(502).json({ error: "wishlist_unavailable" });
};

const isWishlistSelectedOptions = (value) => (
  value
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.keys(value).length > 0
  && Object.values(value).every((optionValue) => typeof optionValue === "string" && optionValue)
);

const resolveWishlistImage = (product, item) => {
  const colorOption = product.options.find((option) => ["color", "couleur"].includes(option.title.toLowerCase()));
  let colorValue = null;

  if (colorOption && item.variant_id) {
    const variant = product.variants.find((candidate) => candidate.id === item.variant_id);
    colorValue = variant?.options.find((option) => option.optionId === colorOption.id)?.value || null;
  }
  if (colorOption && !colorValue && isWishlistSelectedOptions(item.selected_options)) {
    colorValue = item.selected_options[colorOption.id] || null;
  }

  const colorImage = colorValue
    ? product.mediaByColor?.[colorValue]?.find((image) => image?.url)?.url
    : null;
  if (colorImage) return colorImage;

  if (item.variant_id) {
    const variant = product.variants.find((candidate) => candidate.id === item.variant_id);
    if (variant?.images?.[0]) return variant.images[0];
  }

  return product.images[0] || null;
};

const retrieveWishlistCatalogueProduct = async (productId, regionId) => {
  const { backendUrl } = getMedusaStoreConfig();
  const productUrl = new URL(`/store/products/${encodeURIComponent(productId)}`, backendUrl);
  productUrl.searchParams.set("region_id", regionId);
  productUrl.searchParams.set("fields", "*variants.images,*variants.calculated_price,+variants.inventory_quantity,+metadata");
  const data = await fetchMedusaStore(productUrl.pathname + productUrl.search);
  const product = mapMedusaProduct(data.product, regionId);
  const priceVariant = product.variants.find((variant) => variant.available && variant.price)
    || product.variants.find((variant) => variant.price)
    || null;

  return {
    id: product.id,
    name: product.name,
    shortDes: product.shortDes,
    image: product.images[0] || null,
    images: product.images,
    mediaByColor: product.mediaByColor,
    price: priceVariant?.price || null,
    options: product.options,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      available: variant.available,
      price: variant.price,
      options: variant.options,
      images: variant.images,
    })),
  };
};

const mapWishlistItemContext = (item) => ({
  id: item.id,
  productId: item.product_id,
  variantId: item.variant_id || null,
  selectedOptions: isWishlistSelectedOptions(item.selected_options) ? item.selected_options : null,
});

const getCustomerWishlistItemForCart = async (token, wishlistItemId, variantId) => {
  const data = await fetchMedusaStore("/store/customers/me/wishlist", { token });
  const item = data.wishlist?.items?.find((wishlistItem) => wishlistItem.id === wishlistItemId);
  if (!item) {
    const error = new Error("wishlist_item_not_found");
    error.status = 404;
    error.code = "wishlist_item_not_found";
    throw error;
  }

  const product = await retrieveWishlistCatalogueProduct(item.product_id, await getDefaultMedusaRegionId());
  if (!product.variants?.some((variant) => variant.id === variantId)) {
    const error = new Error("wishlist_item_product_mismatch");
    error.status = 400;
    error.code = "wishlist_item_product_mismatch";
    throw error;
  }

  return item;
};

const removeCustomerWishlistItemAfterCart = async (token, wishlistItemId) => {
  await fetchMedusaStore(`/store/customers/me/wishlist/items/${encodeURIComponent(wishlistItemId)}`, {
    method: "DELETE",
    token,
  });
  return true;
};

app.get("/medusa-wishlist", async (req, res) => {
  const token = requireWishlistToken(req, res);
  if (!token) return;

  try {
    const data = await fetchMedusaStore("/store/customers/me/wishlist", { token });
    const wishlist = data.wishlist;

    if (!wishlist) {
      return res.json({ wishlist: null });
    }

    const regionId = await getDefaultMedusaRegionId();
    const items = (await Promise.all((wishlist.items || []).map(async (item) => {
      try {
        const product = await retrieveWishlistCatalogueProduct(item.product_id, regionId);
        return {
          ...mapWishlistItemContext(item),
          image: resolveWishlistImage(product, item),
          product,
        };
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    }))).filter(Boolean);

    return res.json({ wishlist: { id: wishlist.id, items } });
  } catch (error) {
    return sendWishlistError(res, error);
  }
});

app.get("/medusa-wishlist/items/:itemId", async (req, res) => {
  const token = requireWishlistToken(req, res);
  if (!token) return;

  try {
    const data = await fetchMedusaStore(`/store/customers/me/wishlist/items/${encodeURIComponent(req.params.itemId)}`, { token });
    return res.json({ wishlistItem: mapWishlistItemContext(data.wishlist_item) });
  } catch (error) {
    return sendWishlistError(res, error);
  }
});

app.post("/medusa-wishlist/items", async (req, res) => {
  const token = requireWishlistToken(req, res);
  if (!token) return;

  const { productId, variantId, selectedOptions } = req.body;
  if (typeof productId !== "string" || !productId
    || (variantId !== undefined && (typeof variantId !== "string" || !variantId))
    || (selectedOptions !== undefined && !isWishlistSelectedOptions(selectedOptions))
    || (variantId && selectedOptions)) {
    return res.status(400).json({ error: "invalid_wishlist_item" });
  }

  try {
    const body = { product_id: productId };
    if (variantId) body.variant_id = variantId;
    if (selectedOptions) body.selected_options = selectedOptions;
    const data = await fetchMedusaStore("/store/customers/me/wishlist/items", {
      method: "POST",
      body,
      token,
    });
    return res.status(201).json({ wishlistItem: data.wishlist_item });
  } catch (error) {
    return sendWishlistError(res, error);
  }
});

app.delete("/medusa-wishlist/items/:itemId", async (req, res) => {
  const token = requireWishlistToken(req, res);
  if (!token) return;

  try {
    await fetchMedusaStore(`/store/customers/me/wishlist/items/${encodeURIComponent(req.params.itemId)}`, {
      method: "DELETE",
      token,
    });
    return res.status(204).end();
  } catch (error) {
    return sendWishlistError(res, error);
  }
});

app.put("/medusa-wishlist/items/:itemId", async (req, res) => {
  const token = requireWishlistToken(req, res);
  if (!token) return;

  const { productId, variantId, selectedOptions } = req.body;
  if (typeof productId !== "string" || !productId
    || (variantId !== undefined && (typeof variantId !== "string" || !variantId))
    || (selectedOptions !== undefined && !isWishlistSelectedOptions(selectedOptions))
    || (variantId && selectedOptions)) {
    return res.status(400).json({ error: "invalid_wishlist_item" });
  }

  try {
    const data = await fetchMedusaStore(`/store/customers/me/wishlist/items/${encodeURIComponent(req.params.itemId)}`, {
      method: "PUT",
      body: {
        product_id: productId,
        ...(variantId ? { variant_id: variantId } : {}),
        ...(selectedOptions ? { selected_options: selectedOptions } : {}),
      },
      token,
    });
    return res.json({ wishlistItem: data.wishlist_item });
  } catch (error) {
    return sendWishlistError(res, error);
  }
});

app.post("/medusa-cart/items", async (req, res) => {
  const { publishableApiKey } = getMedusaStoreConfig();
  const { cartId, variantId, quantity = 1, wishlistItemId } = req.body;

  if (!publishableApiKey) {
    return res.status(503).json({ error: "cart_unavailable" });
  }

  if (typeof variantId !== "string" || !Number.isInteger(quantity) || quantity < 1
    || (wishlistItemId !== undefined && (typeof wishlistItemId !== "string" || !wishlistItemId))) {
    return res.status(400).json({ error: "invalid_cart_item" });
  }

  try {
    const { token } = await resolveCartCustomer(req, res);
    let wishlistItem;
    if (wishlistItemId) {
      if (!token) return res.status(401).json({ error: "authentication_required" });
      if (!isWishlistFeatureEnabled()) return res.status(404).json({ error: "wishlist_disabled" });
      wishlistItem = await getCustomerWishlistItemForCart(token, wishlistItemId, variantId);
    }

    let activeCartId = typeof cartId === "string" && cartId ? cartId : null;
    let guestProof;

    const currentCart = await resolveCurrentCart(req, res);
    if (currentCart) {
      activeCartId = currentCart.id;
      if (!token) guestProof = getGuestCartProof(req);
    } else if (!token) {
      if (activeCartId) {
        const error = new Error("cart_not_found");
        error.status = 404;
        throw error;
      }
    } else if (activeCartId) {
      ({ guestProof } = await requireCartAccess(req, res, activeCartId));
    }

    if (!activeCartId) {
      const newCart = await createMedusaCart(await getDefaultMedusaRegionId(), token);
      activeCartId = newCart.id;
      if (!newCart.customer_id) guestProof = signGuestCart(activeCartId);
    }

    let cart = await addMedusaCartItem(activeCartId, variantId, quantity, token, guestProof);
    cart = await retrieveMedusaCart(cart.id, token, guestProof);

    if (token && cart.customer_id) {
      const customer = await retrieveMedusaCustomer(token);
      await updateMedusaCustomer(token, {
        metadata: { ...customer.metadata, active_cart_id: cart.id },
      });
    }

    if (guestProof && !cart.customer_id) setGuestCartCookie(res, guestProof);

    let wishlistRemoved = false;
    if (wishlistItem) {
      try {
        wishlistRemoved = await removeCustomerWishlistItemAfterCart(token, wishlistItem.id);
      } catch (error) {
        console.error("F-17 Wishlist removal after cart add failed:", error.message);
      }
    }

    return res.json({ cart, wishlistRemoved });
  } catch (error) {
    console.error("F-04 Medusa cart unavailable:", error.message);
    if (error.status === 400 && /does not have the required inventory/i.test(error.message)) {
      return res.status(409).json({ error: "insufficient_inventory" });
    }
    if (error.code === "wishlist_item_not_found") {
      return res.status(404).json({ error: "wishlist_item_not_found" });
    }
    if (error.code === "wishlist_item_product_mismatch") {
      return res.status(400).json({ error: "wishlist_item_product_mismatch" });
    }
    return res.status(error.status === 404 ? 404 : 502).json({ error: error.status === 404 ? "cart_not_found" : "cart_unavailable" });
  }
});

app.get("/medusa-cart/current", async (req, res) => {
  try {
    return res.json({ cart: await resolveCurrentCart(req, res) });
  } catch (error) {
    return res.status(error.status === 401 ? 401 : 502).json({ error: "cart_unavailable" });
  }
});

app.get("/medusa-cart/:id", async (req, res) => {
  try {
    const { cart } = await requireCartAccess(req, res, req.params.id);
    return res.json({ cart });
  } catch (error) {
    const status = error.status === 404 ? 404 : 502;
    return res.status(status).json({ error: status === 404 ? "cart_not_found" : "cart_unavailable" });
  }
});

app.patch("/medusa-cart/:cartId/items/:lineId", async (req, res) => {
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "invalid_quantity" });
  }

  try {
    const { token, guestProof } = await requireCartAccess(req, res, req.params.cartId);
    const data = await fetchMedusaStore(
      `/store/carts/${encodeURIComponent(req.params.cartId)}/line-items/${encodeURIComponent(req.params.lineId)}?fields=+items.total`,
      {
        method: "POST",
        body: { quantity },
        token,
        guestProof,
      }
    );
    return res.json({ cart: data.cart });
  } catch (error) {
    if (error.status === 400 && /does not have the required inventory/i.test(error.message)) {
      return res.status(409).json({ error: "insufficient_inventory" });
    }
    return res.status(error.status === 404 ? 404 : 502).json({
      error: error.status === 404 ? "cart_not_found" : "cart_update_failed",
    });
  }
});

app.delete("/medusa-cart/:cartId/items/:lineId", async (req, res) => {
  try {
    const { token, guestProof } = await requireCartAccess(req, res, req.params.cartId);
    const data = await fetchMedusaStore(
      `/store/carts/${encodeURIComponent(req.params.cartId)}/line-items/${encodeURIComponent(req.params.lineId)}?fields=+items.total`,
      { method: "DELETE", token, guestProof }
    );
    return res.json({ cart: data.parent });
  } catch (error) {
    return res.status(error.status === 404 ? 404 : 502).json({
      error: error.status === 404 ? "cart_not_found" : "cart_delete_failed",
    });
  }
});

//signup route
app.get("/signup", (req, res) => {
  res.sendFile(path.join(staticPath, "signup.html"));
});

const authenticateMedusaCustomer = async (email, password) => {
  const data = await fetchMedusaStore("/auth/customer/emailpass", {
    method: "POST",
    body: { email, password },
  });
  return data.token;
};

const registerMedusaCustomer = async ({ name, email, password, number }) => {
  const registration = await fetchMedusaStore("/auth/customer/emailpass/register", {
    method: "POST",
    body: { email, password },
  });
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/);

  await fetchMedusaStore("/store/customers", {
    method: "POST",
    token: registration.token,
    body: {
      email,
      first_name: firstName,
      last_name: lastNameParts.join(" ") || undefined,
      phone: number,
    },
  });

  return authenticateMedusaCustomer(email, password);
};

const getLegacyAccountState = async (email) => {
  const [user, seller] = await Promise.all([
    db.collection("users").doc(email).get(),
    db.collection("sellers").doc(email).get(),
  ]);

  return { user, seller };
};

const customerResponse = ({ customer, cart, legacy }) => ({
  name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email,
  email: customer.email,
  seller: legacy.user.exists ? Boolean(legacy.user.data().seller) : false,
  tagsSeller: legacy.seller.exists ? legacy.seller.data().tagsSeller : null,
  cartId: cart?.id || null,
});

app.post("/signup", async (req, res) => {
  const { name, email, password, number, tac } = req.body;

  // form validations
  if (name.length < 3) {
    return res.json({ alert: "name must be 3 letters long" });
  } else if (!email.length) {
    return res.json({ alert: "enter your email" });
  } else if (password.length < 8) {
    return res.json({ alert: "password should be 8 letters long" });
  } else if (!number.length) {
    return res.json({ alert: "enter your phone number" });
  } else if (!Number(number) || number.length < 10) {
    return res.json({ alert: "invalid number, please enter valid one" });
  } else if (!tac) {
    return res.json({ alert: "you must agree to our terms and conditions" });
  }

  try {
    const existingUser = await db.collection("users").doc(email).get();
    if (existingUser.exists) {
      return res.json({ alert: "email already exists" });
    }

    const token = await registerMedusaCustomer({ name, email, password, number });
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection("users").doc(email).set({
      name,
      email,
      password: passwordHash,
      number,
      tac: true,
      notification: Boolean(req.body.notification),
      seller: false,
    });

    const { customer, cart } = await resolveSignupCart(token, getGuestCartProof(req));
    const legacy = await getLegacyAccountState(email);
    setMedusaCustomerCookie(res, token);
    clearGuestCartCookie(res);
    return res.json(customerResponse({ customer, cart, legacy }));
  } catch (error) {
    console.error("Medusa customer registration failed:", error.message);
    const duplicate = error.status === 400 || error.status === 409;
    return res.status(duplicate ? 200 : 502).json({
      alert: duplicate ? "email already exists" : "account service unavailable",
    });
  }
});

// login route
app.get("/login", (req, res) => {
  res.sendFile(path.join(staticPath, "login.html"));
});

// app.post("/login", (req, res) => {
//   let { email, password } = req.body;

//   if (!email.length || !password.length) {
//     return res.json({ alert: "fill all the inputs" });
//   }

//   db.collection("users")
//     .doc(email)
//     .get()
//     .then((user) => {
//       if (!user.exists) {
//         // if email does not exists
//         return res.json({ alert: "log in email does not exists" });
//       } else {
//         bcrypt.compare(password, user.data().password, (err, result) => {
//           if (result) {
//             let data = user.data();
//             return res.json({
//               name: data.name,
//               email: data.email,
//               seller: data.seller,
//             });
//           } else {
//             return res.json({ alert: "password is incorrect" });
//           }
//         });
//       }
//     });
// });

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email.length || !password.length) {
    return res.json({ alert: "fill all the inputs" });
  }
  try {
    const legacy = await getLegacyAccountState(email);
    let token;

    try {
      token = await authenticateMedusaCustomer(email, password);
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }

      if (!legacy.user.exists || !legacy.user.data().password) {
        return res.json({ alert: "log in email does not exist" });
      }

      const passwordMatches = await bcrypt.compare(password, legacy.user.data().password);
      if (!passwordMatches) {
        return res.json({ alert: "password is incorrect" });
      }

      token = await registerMedusaCustomer({
        name: legacy.user.data().name,
        email,
        password,
        number: legacy.user.data().number,
      });
    }

    const { customer, cart } = await restoreCustomerCart(token);
    setMedusaCustomerCookie(res, token);
    clearGuestCartCookie(res);
    return res.json(customerResponse({ customer, cart, legacy }));
  } catch (error) {
    console.error("Medusa customer login failed:", error.message);
    return res.status(502).json({ alert: "account service unavailable" });
  }
});

app.post("/logout", (req, res) => {
  clearMedusaCustomerCookie(res);
  clearGuestCartCookie(res);
  return res.json({ success: true });
});

// seller route
app.get("/seller", (req, res) => {
  res.sendFile(path.join(staticPath, "seller.html"));
});

app.post("/seller", (req, res) => {
  let { name, about, address, number, tac, legit, email } = req.body;
  if (
    !name.length ||
    !address.length ||
    !about.length ||
    number.length < 10 ||
    !Number(number)
  ) {
    return res.json({ alert: "some inforamation(s) is/are invalid" });
  } else if (!tac || !legit) {
    return res.json({ alert: "you must agree to our terms and conditions" });
  } else {
    // update users seller status here.
    db.collection("sellers")
      .doc(email)
      .set(req.body)
      .then((data) => {
        db.collection("users")
          .doc(email)
          .update({
            seller: true,
          })
          .then((data) => {
            res.json(true);
          });
      });
  }
});

// add product
app.get("/add-product", (req, res) => {
  res.sendFile(path.join(staticPath, "addProduct.html"));
});

app.get("/add-product/:id", (req, res) => {
  res.sendFile(path.join(staticPath, "addProduct.html"));
});

// get the upload link
app.get("/s3url", (req, res) => {
  generateUrl().then((url) => res.json(url));
});

// add product
app.post("/add-product", (req, res) => {
  let {
    name,
    shortDes,
    des,
    images,
    sizes,
    actualPrice,
    discount,
    sellPrice,
    stock,
    tags,
    tac,
    email,
    draft,
    id,
  } = req.body;

  // validation
  if (!draft) {
    if (!name.length) {
      return res.json({ alert: "enter product name" });
    } else if (shortDes.length > 100 || shortDes.length < 10) {
      return res.json({
        alert: "short description must be between 10 to 100 letters long",
      });
    } else if (!des.length) {
      return res.json({ alert: "enter detail description about the product" });
    } else if (!images.length) {
      // image link array
      return res.json({ alert: "upload atleast one product image" });
    } else if (!sizes.length) {
      // size array
      return res.json({ alert: "select at least one size" });
    } else if (!actualPrice.length || !discount.length || !sellPrice.length) {
      return res.json({ alert: "you must add pricings" });
    } else if (stock < 20) {
      return res.json({ alert: "you should have at least 20 items in stock" });
    } else if (!tags.length) {
      return res.json({
        alert: "enter few tags to help ranking your product in search",
      });
    } else if (!tac) {
      return res.json({ alert: "you must agree to our terms and conditions" });
    }
  }

  // add product
  let docName =
    id == undefined
      ? `${name.toLowerCase()}-${Math.floor(Math.random() * 5000)}`
      : id;
  db.collection("products")
    .doc(docName)
    .set(req.body)
    .then((data) => {
      res.json({ product: name });
    })
    .catch((err) => {
      return res.json({ alert: "some error occured. Try again" });
    });
});

// get products
app.post("/get-products", (req, res) => {
  let { email, id, tag } = req.body;

  if (id) {
    docRef = db.collection("products").doc(id);
    // Si tag alors
  } else if (tag) {
    docRef = db.collection("products").where("tags", "array-contains", tag);
  } else {
    docRef = db.collection("products").where("email", "==", email);
  }

  docRef.get().then((products) => {
    if (products.empty) {
      return res.json("no products");
    }
    let productArr = [];
    if (id) {
      return res.json(products.data());
    } else {
      products.forEach((item) => {
        let data = item.data();
        data.id = item.id;
        productArr.push(data);
      });
      res.json(productArr);
    }
  });
});

app.post("/delete-product", (req, res) => {
  let { id } = req.body;
  //console.log(req.body);
  docRef = db.collection("products").doc(id);
  // console.log(`docRef : `, docRef);
  docRef.get().then((product) => {
    let imageUrls = product.data().images;
    // console.log(`product.data() --- : `, imageUrls);
    imageLinks = imageUrls.filter((value) => value);
    // console.log(`imageLinks : `, imageLinks);
    idImages = imageLinks.map((url) => url.split("/").pop());
    console.log(idImages);

    const promises = idImages.map((idImage) => {
      const bucketParams = {
        Bucket: bucketName,
        Key: idImage,
        // Expires: 300, //300 ms
        // ContentType: "image/jpeg",
      };

      return s3.deleteObject(bucketParams).promise();
    });

    Promise.all(promises)
      .then(() => {
        db.collection("products")
          .doc(id)
          .delete()
          .then((data) => {
            res.json("success");
          })
          .catch((err) => {
            res.json("err");
          });
      })
      .catch((err) => {
        console.log("Error", err);
      });
  });
});

// app.post("/delete-product", (req, res) => {
//   let { id } = req.body;
//   console.log(req.body);
//   docRef = db.collection("products").doc(id);
//   // console.log(`docRef : `, docRef);
//   docRef.get().then((product) => {
//     let imageUrls = product.data().images;
//     // console.log(`product.data() --- : `, imageUrls);
//     imageLinks = imageUrls.filter((value) => value);
//     // console.log(`imageLinks : `, imageLinks);
//     idImages = imageLinks.map((url) => url.split("/").pop());
//     console.log(idImages);
//     idImages.forEach((idImage) => {
//       const bucketParams = {
//         Bucket: bucketName,
//         Key: idImage,
//         // Expires: 300, //300 ms
//         // ContentType: "image/jpeg",
//       };

//       const run = async () => {
//         try {
//           const data = await s3.deleteObject(bucketParams).promise();
//           console.log("Success!", data);
//           return data; // For unit tests.
//         } catch (err) {
//           console.log("Error", err);
//         }
//       };
//       run();
//     });
//     db.collection("products")
//       .doc(id)
//       .delete()
//       .then((data) => {
//         res.json("success");
//       })
//       .catch((err) => {
//         res.json("err");
//       });
//   });
// });

// product page
app.get("/products/:id", (req, res) => {
  res.sendFile(path.join(staticPath, "product.html"));
});

app.get("/search/:key", (req, res) => {
  res.sendFile(path.join(staticPath, "search.html"));
});

app.get("/cart", (req, res) => {
  res.sendFile(path.join(staticPath, "cart.html"));
});

app.post("/save-user-state", async (req, res) => {
  const { email, tagsSeller } = req.body;

  try {
    if (tagsSeller) {
      await db.collection("sellers").doc(email).set({ tagsSeller }, { merge: true });
    }
    return res.json("saved");
  } catch (error) {
    console.error(error);
    return res.json("some error occurred in save. Try again");
  }
});

// app.post("/tagsSeller", (req, res) => {
//   let { email, tagsSeller } = req.body;
//   // update tagsSeller here.

//   db.collection("seller")
//     .doc(email)
//     .update({
//       tagsSeller: tagsSeller,
//     })
//     .then((data) => {
//       res.json(console.log("updated"));
//     });
// });

app.get("/checkout", (req, res) => {
  res.sendFile(path.join(staticPath, "checkout.html"));
});

app.get("/stripe-checkout/return", (req, res) => {
  res.sendFile(path.join(staticPath, "checkout-return.html"));
});

const MEDUSA_STRIPE_PROVIDER_ID = "pp_stripe_stripe";
const MEDUSA_STRIPE_CHECKOUT_PROVIDER_ID = "pp_stripe-checkout_stripe-checkout";

const sendCheckoutError = (res, error, fallback = "checkout_unavailable") => {
  const status = [400, 401, 403, 404, 409].includes(error.status) ? error.status : 502;
  const publicErrors = new Set([
    "authentication_required",
    "cart_not_found",
    "cart_completed",
    "empty_cart",
    "completed_order_not_found",
  ]);
  const errorCode = publicErrors.has(error.message) ? error.message : fallback;
  return res.status(status).json({ error: errorCode });
};

const requireCheckoutContext = async (req, cartId) => {
  const token = getMedusaCustomerToken(req);
  if (!token) {
    const error = new Error("authentication_required");
    error.status = 401;
    throw error;
  }

  const [customer, cart] = await Promise.all([
    retrieveMedusaCustomer(token),
    retrieveMedusaCart(cartId, token),
  ]);

  if (cart.customer_id !== customer.id) {
    const error = new Error("cart_not_found");
    error.status = 404;
    throw error;
  }
  if (cart.completed_at) {
    const error = new Error("cart_completed");
    error.status = 409;
    throw error;
  }
  if (!cart.items?.length) {
    const error = new Error("empty_cart");
    error.status = 400;
    throw error;
  }

  return { token, customer, cart };
};

const retrieveShippingOptions = async (cartId, token) => {
  const query = new URLSearchParams({ cart_id: cartId });
  const data = await fetchMedusaStore(`/store/shipping-options?${query}`, { token });
  return data.shipping_options || [];
};

const replaceMedusaCartShippingMethod = async (cartId, shippingOptionId, token) => {
  const encodedCartId = encodeURIComponent(cartId);

  await fetchMedusaStore(`/store/carts/${encodedCartId}/shipping-methods/replace`, {
    method: "POST",
    token,
  });
  await fetchMedusaStore(`/store/carts/${encodedCartId}/shipping-methods`, {
    method: "POST",
    body: { option_id: shippingOptionId },
    token,
  });
};

const resetMedusaCartCheckout = async (cartId, token) => {
  const encodedCartId = encodeURIComponent(cartId);
  await fetchMedusaStore(`/store/carts/${encodedCartId}/checkout/reset`, {
    method: "POST",
    token,
  });
};

const retrievePaymentProviders = async (regionId, token) => {
  const query = new URLSearchParams({ region_id: regionId });
  const data = await fetchMedusaStore(`/store/payment-providers?${query}`, { token });
  return data.payment_providers || [];
};

const checkoutAddress = (address, customer) => ({
  first_name: address.first_name,
  last_name: address.last_name,
  address_1: address.address,
  address_2: [address.street, address.landmark].filter(Boolean).join(", "),
  city: address.city,
  province: address.state,
  postal_code: address.pincode,
  country_code: address.country,
  phone: customer.phone || undefined,
});

const checkoutAddressFields = ["last_name", "first_name", "address", "street", "city", "state", "pincode", "country"];
const checkoutAddressMaxLengths = {
  last_name: 80,
  first_name: 80,
  address: 120,
  street: 120,
  city: 80,
  state: 80,
  pincode: 16,
  landmark: 120,
};
const checkoutPostalCodePatterns = {
  fr: /^\d{5}$/,
  de: /^\d{5}$/,
  dk: /^\d{4}$/,
  es: /^\d{5}$/,
  gb: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  it: /^\d{5}$/,
  se: /^\d{3}\s?\d{2}$/,
};

const normalizeCheckoutAddress = (address) => {
  if (!address || typeof address !== "object") return address;
  return Object.fromEntries(
    [...checkoutAddressFields, "landmark"].map((field) => [
      field,
      typeof address[field] === "string" ? address[field].trim() : address[field],
    ])
  );
};

const isValidCheckoutAddress = (address) => {
  if (!address || !checkoutAddressFields.every((field) => typeof address[field] === "string" && address[field].trim())) {
    return false;
  }
  if (typeof address.landmark !== "undefined" && typeof address.landmark !== "string") return false;
  if (Object.entries(checkoutAddressMaxLengths).some(([field, maxLength]) => address[field]?.length > maxLength)) {
    return false;
  }
  return !checkoutPostalCodePatterns[address.country] || checkoutPostalCodePatterns[address.country].test(address.pincode);
};

const findCustomerOrderByCart = async (token, cartId) => {
  const query = new URLSearchParams({
    fields: "+cart.id",
    limit: "100",
  });
  const data = await fetchMedusaStore(`/store/orders?${query}`, { token });
  return data.orders?.find((order) => order.cart?.id === cartId) || null;
};

const stripeCheckoutUrl = (pathname) => {
  const storefrontUrl = process.env.STOREFRONT_URL || "http://127.0.0.1:5000";
  return new URL(pathname, storefrontUrl).toString();
};

const buildStripeCheckoutProjection = (cart, shippingOptionName) => {
  const itemSubtotal = Number(cart.item_subtotal ?? 0);
  const shippingTotal = Number(cart.shipping_total ?? 0);
  const discountTotal = Number(cart.discount_total ?? 0);
  const taxTotal = Number(cart.tax_total ?? 0);
  const total = Number(cart.total ?? 0);
  const productLines = (cart.items || []).map((item) => ({
    name: item.product_title || item.title || "Product",
    description: [item.variant_title, item.subtitle].filter(Boolean).join(" / ") || undefined,
    image: item.thumbnail || undefined,
    quantity: Number(item.quantity),
    unit_amount: Number(item.unit_price),
  }));
  const projectedItemSubtotal = productLines.reduce(
    (sum, line) => sum + (line.unit_amount * line.quantity),
    0
  );
  const lineItems = [...productLines];

  if (cart.shipping_methods?.length) {
    lineItems.push({
      name: shippingOptionName || "Delivery",
      quantity: 1,
      unit_amount: shippingTotal,
    });
  }
  if (taxTotal > 0) {
    lineItems.push({ name: "Taxes", quantity: 1, unit_amount: taxTotal });
  }

  const projectedTotal = projectedItemSubtotal + shippingTotal + taxTotal - discountTotal;
  if (
    !lineItems.length
    || ![itemSubtotal, shippingTotal, discountTotal, taxTotal, total, projectedItemSubtotal, projectedTotal]
      .every(Number.isFinite)
    || projectedItemSubtotal !== itemSubtotal
    || projectedTotal !== total
  ) {
    const error = new Error("checkout_projection_total_mismatch");
    error.status = 409;
    throw error;
  }

  return {
    line_items: lineItems,
    discount_amount: discountTotal,
    expected_total: total,
    currency_code: cart.currency_code,
  };
};

app.get("/medusa-checkout/:cartId", async (req, res) => {
  try {
    const { token, cart } = await requireCheckoutContext(req, req.params.cartId);
    const [shippingOptions, paymentProviders] = await Promise.all([
      retrieveShippingOptions(cart.id, token),
      retrievePaymentProviders(cart.region_id, token),
    ]);

    return res.json({
      cart,
      shippingOptions,
      stripeAvailable: paymentProviders.some((provider) => provider.id === MEDUSA_STRIPE_PROVIDER_ID),
      stripeCheckoutAvailable: paymentProviders.some(
        (provider) => provider.id === MEDUSA_STRIPE_CHECKOUT_PROVIDER_ID
      ),
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    });
  } catch (error) {
    console.error("Medusa checkout initialization failed:", error.message);
    return sendCheckoutError(res, error);
  }
});

app.post("/medusa-checkout/:cartId/reset", async (req, res) => {
  try {
    const { token, cart } = await requireCheckoutContext(req, req.params.cartId);
    await resetMedusaCartCheckout(cart.id, token);

    const updatedCart = await retrieveMedusaCart(cart.id, token);
    const [shippingOptions, paymentProviders] = await Promise.all([
      retrieveShippingOptions(updatedCart.id, token),
      retrievePaymentProviders(updatedCart.region_id, token),
    ]);

    return res.json({
      cart: updatedCart,
      shippingOptions,
      stripeAvailable: paymentProviders.some((provider) => provider.id === MEDUSA_STRIPE_PROVIDER_ID),
      stripeCheckoutAvailable: paymentProviders.some(
        (provider) => provider.id === MEDUSA_STRIPE_CHECKOUT_PROVIDER_ID
      ),
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    });
  } catch (error) {
    console.error("Medusa checkout reset failed:", error.message);
    return sendCheckoutError(res, error);
  }
});

app.post("/medusa-checkout/:cartId/stripe-checkout", async (req, res) => {
  const address = normalizeCheckoutAddress(req.body.address);
  if (
    !isValidCheckoutAddress(address)
    || typeof req.body.shippingOptionId !== "string"
  ) {
    return res.status(400).json({ error: "invalid_checkout_details" });
  }

  try {
    const { token, customer, cart } = await requireCheckoutContext(req, req.params.cartId);
    await fetchMedusaStore(`/store/carts/${encodeURIComponent(cart.id)}`, {
      method: "POST",
      body: {
        email: customer.email,
        shipping_address: checkoutAddress(address, customer),
      },
      token,
    });

    const shippingOptions = await retrieveShippingOptions(cart.id, token);
    const selectedShippingOption = shippingOptions.find(
      (option) => option.id === req.body.shippingOptionId
    );
    if (!selectedShippingOption) {
      return res.status(400).json({ error: "invalid_shipping_option" });
    }

    await replaceMedusaCartShippingMethod(cart.id, selectedShippingOption.id, token);

    const updatedCart = await retrieveMedusaCart(cart.id, token);
    const paymentProviders = await retrievePaymentProviders(updatedCart.region_id, token);
    if (!paymentProviders.some((provider) => provider.id === MEDUSA_STRIPE_CHECKOUT_PROVIDER_ID)) {
      return res.status(503).json({ error: "stripe_checkout_not_available" });
    }

    const projection = buildStripeCheckoutProjection(updatedCart, selectedShippingOption.name);
    const collectionData = await fetchMedusaStore("/store/payment-collections", {
      method: "POST",
      body: { cart_id: updatedCart.id },
      token,
      timeout: 15000,
    });
    const paymentCollection = collectionData.payment_collection;
    const sessionData = await fetchMedusaStore(
      `/store/payment-collections/${encodeURIComponent(paymentCollection.id)}/payment-sessions`,
      {
        method: "POST",
        body: {
          provider_id: MEDUSA_STRIPE_CHECKOUT_PROVIDER_ID,
          data: {
            ...projection,
            cart_id: updatedCart.id,
            payment_collection_id: paymentCollection.id,
            customer_email: customer.email,
            success_url: stripeCheckoutUrl(
              `/stripe-checkout/return?session_id={CHECKOUT_SESSION_ID}&cart_id=${encodeURIComponent(updatedCart.id)}`
            ),
            cancel_url: stripeCheckoutUrl("/checkout?payment_cancelled=true"),
          },
        },
        token,
        timeout: 15000,
      }
    );
    const paymentSession = sessionData.payment_collection.payment_sessions?.find(
      (session) => session.provider_id === MEDUSA_STRIPE_CHECKOUT_PROVIDER_ID
    );
    if (!paymentSession?.data?.checkout_url) {
      throw new Error("stripe_checkout_url_missing");
    }

    return res.json({ cart: updatedCart, checkoutUrl: paymentSession.data.checkout_url });
  } catch (error) {
    console.error("Hosted Stripe Checkout preparation failed:", error.message);
    return sendCheckoutError(res, error, "stripe_checkout_unavailable");
  }
});

app.get("/stripe-checkout/status", async (req, res) => {
  const cartId = typeof req.query.cart_id === "string" ? req.query.cart_id : "";
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!cartId || !sessionId.startsWith("cs_")) {
    return res.status(400).json({ error: "invalid_checkout_return" });
  }

  try {
    const token = getMedusaCustomerToken(req);
    if (!token) return res.status(401).json({ error: "authentication_required" });
    const order = await findCustomerOrderByCart(token, cartId);
    if (order) {
      const customer = await retrieveMedusaCustomer(token);
      if (customer.metadata?.active_cart_id === cartId) {
        await updateMedusaCustomer(token, {
          metadata: { ...customer.metadata, active_cart_id: null },
        });
      }
      return res.json({ status: "complete", order });
    }

    const { cart } = await requireCheckoutContext(req, cartId);
    return res.json({ status: "pending", cart });
  } catch (error) {
    console.error("Stripe Checkout return status failed:", error.message);
    return sendCheckoutError(res, error, "checkout_status_unavailable");
  }
});

app.post("/medusa-checkout/:cartId/shipping", async (req, res) => {
  const address = normalizeCheckoutAddress(req.body.address);
  if (
    !isValidCheckoutAddress(address)
    || typeof req.body.shippingOptionId !== "string"
  ) {
    return res.status(400).json({ error: "invalid_checkout_details" });
  }

  try {
    const { token, customer, cart } = await requireCheckoutContext(req, req.params.cartId);
    await fetchMedusaStore(`/store/carts/${encodeURIComponent(cart.id)}`, {
      method: "POST",
      body: {
        email: customer.email,
        shipping_address: checkoutAddress(address, customer),
      },
      token,
    });
    const shippingOptions = await retrieveShippingOptions(cart.id, token);
    if (!shippingOptions.some((option) => option.id === req.body.shippingOptionId)) {
      return res.status(400).json({ error: "invalid_shipping_option" });
    }

    await replaceMedusaCartShippingMethod(cart.id, req.body.shippingOptionId, token);

    return res.json({ cart: await retrieveMedusaCart(cart.id, token) });
  } catch (error) {
    console.error("Medusa shipping selection failed:", error.message);
    return sendCheckoutError(res, error);
  }
});

app.post("/medusa-checkout/:cartId/prepare", async (req, res) => {
  const address = normalizeCheckoutAddress(req.body.address);
  if (
    !isValidCheckoutAddress(address)
    || typeof req.body.shippingOptionId !== "string"
  ) {
    return res.status(400).json({ error: "invalid_checkout_details" });
  }
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: "stripe_not_configured" });
  }

  try {
    const { token, customer, cart } = await requireCheckoutContext(req, req.params.cartId);
    const shipping = checkoutAddress(address, customer);
    await fetchMedusaStore(`/store/carts/${encodeURIComponent(cart.id)}`, {
      method: "POST",
      body: {
        email: customer.email,
        shipping_address: shipping,
      },
      token,
    });

    const shippingOptions = await retrieveShippingOptions(cart.id, token);
    if (!shippingOptions.some((option) => option.id === req.body.shippingOptionId)) {
      return res.status(400).json({ error: "invalid_shipping_option" });
    }

    await replaceMedusaCartShippingMethod(cart.id, req.body.shippingOptionId, token);

    const paymentProviders = await retrievePaymentProviders(cart.region_id, token);
    if (!paymentProviders.some((provider) => provider.id === MEDUSA_STRIPE_PROVIDER_ID)) {
      return res.status(503).json({ error: "stripe_not_available" });
    }

    const collectionData = await fetchMedusaStore("/store/payment-collections", {
      method: "POST",
      body: { cart_id: cart.id },
      token,
      timeout: 15000,
    });
    const sessionData = await fetchMedusaStore(
      `/store/payment-collections/${encodeURIComponent(collectionData.payment_collection.id)}/payment-sessions`,
      {
        method: "POST",
        body: {
          provider_id: MEDUSA_STRIPE_PROVIDER_ID,
          data: { payment_method_types: ["card"] },
        },
        token,
        timeout: 15000,
      }
    );
    const paymentSession = sessionData.payment_collection.payment_sessions?.find(
      (session) => session.provider_id === MEDUSA_STRIPE_PROVIDER_ID
    );
    const clientSecret = paymentSession?.data?.client_secret;
    if (!clientSecret) {
      throw new Error("stripe_client_secret_missing");
    }

    const updatedCart = await retrieveMedusaCart(cart.id, token);
    return res.json({
      cart: updatedCart,
      clientSecret,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    console.error("Medusa checkout preparation failed:", error.message);
    return sendCheckoutError(res, error);
  }
});

app.post("/medusa-checkout/:cartId/complete", async (req, res) => {
  const token = getMedusaCustomerToken(req);
  if (!token) {
    return res.status(401).json({ error: "authentication_required" });
  }

  try {
    let cart;
    try {
      cart = await retrieveMedusaCart(req.params.cartId, token);
    } catch (error) {
      if (error.status !== 404) throw error;
      const existingOrder = await findCustomerOrderByCart(token, req.params.cartId);
      if (existingOrder) return res.json({ order: existingOrder });
      throw error;
    }

    const customer = await retrieveMedusaCustomer(token);
    if (cart.customer_id !== customer.id) {
      return res.status(404).json({ error: "cart_not_found" });
    }
    if (cart.completed_at) {
      const existingOrder = await findCustomerOrderByCart(token, cart.id);
      return existingOrder
        ? res.json({ order: existingOrder })
        : res.status(409).json({ error: "completed_order_not_found" });
    }
    if (!cart.items?.length) {
      return res.status(400).json({ error: "empty_cart" });
    }

    const result = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cart.id)}/complete`, {
      method: "POST",
      token,
      timeout: 15000,
    });

    if (result.type !== "order" || !result.order?.id) {
      return res.status(409).json({ error: result.error?.message || "order_not_created" });
    }

    try {
      await updateMedusaCustomer(token, {
        metadata: { ...customer.metadata, active_cart_id: null },
      });
    } catch (error) {
      console.error("Medusa Order created but active cart metadata was not cleared:", error.message);
    }
    return res.json({ order: result.order });
  } catch (error) {
    console.error("Medusa cart completion failed:", error.message);
    return sendCheckoutError(res, error, "order_not_created");
  }
});

app.get("/medusa-orders/:orderId", async (req, res) => {
  try {
    const token = getMedusaCustomerToken(req);
    if (!token) {
      return res.status(401).json({ error: "authentication_required" });
    }

    const ownershipQuery = new URLSearchParams({
      id: req.params.orderId,
      limit: "1",
    });
    const ownedOrders = await fetchMedusaStore(`/store/orders?${ownershipQuery}`, { token });
    if (!ownedOrders.orders?.some((order) => order.id === req.params.orderId)) {
      return res.status(404).json({ error: "order_not_found" });
    }

    const orderQuery = new URLSearchParams({
      fields: "+payment_status,+fulfillment_status",
    });
    const data = await fetchMedusaStore(
      `/store/orders/${encodeURIComponent(req.params.orderId)}?${orderQuery}`,
      { token }
    );
    return res.json({ order: data.order });
  } catch (error) {
    return sendCheckoutError(res, error, "order_unavailable");
  }
});

app.get("/order/:orderId", (req, res) => {
  res.sendFile(path.join(staticPath, "order.html"));
});

// app.post("/order", (req, res) => {
//   const { order, email, add } = req.body;

//   let transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL,
//       pass: process.env.PASSWORD,
//     },
//   });

//   const mailOption = {
//     from: "testsixmilles@gmail.com",
//     to: email,
//     subject: "Clothing : Order Placed",
//     html: `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//             <meta charset="UTF-8">
//             <meta http-equiv="X-UA-Compatible" content="IE=edge">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Document</title>

//             <style>
//                 body{
//                     min-height: 90vh;
//                     background: #f5f5f5;
//                     font-family: sans-serif;
//                     display: flex;
//                     justify-content: center;
//                     align-items: center;
//                 }
//                 .heading{
//                     text-align: center;
//                     font-size: 40px;
//                     width: 50%;
//                     display: block;
//                     line-height: 50px;
//                     margin: 30px auto 60px;
//                     text-transform: capitalize;
//                 }
//                 .heading span{
//                     font-weight: 300;
//                 }
//                 .btn{
//                     width: 200px;
//                     height: 50px;
//                     border-radius: 5px;
//                     background: #3f3f3f;
//                     color: #fff;
//                     display: block;
//                     margin: auto;
//                     font-size: 18px;
//                     text-transform: capitalize;
//                 }
//             </style>

//         </head>
//         <body>

//             <div>
//                 <h1 class="heading">dear ${email.split("@")[0]}, <span>your order is successfully placed</span></h1>
//                 <button class="btn">check status</button>
//             </div>

//         </body>
//         </html>
//         `,
//   };

//   let docName = email + Math.floor(Math.random() * 123719287419824);
//   db.collection("order")
//     .doc(docName)
//     .set(req.body)
//     .then((data) => {
//       transporter.sendMail(mailOption, (err, info) => {
//         if (err) {
//           res.json({ alert: "opps! its seems like some err occured. Try again" });
//         } else {
//           res.json({ alert: "your order is placed", type: "success" });
//         }
//       });
//     });
// });

// 404 route
app.get("/404", (req, res) => {
  res.sendFile(path.join(staticPath, "404.html"));
});

app.use((req, res) => {
  res.redirect("/404");
});

app.listen(5000, () => {
  console.log("listening on port 5000 Or 3000 with Docker Contener");
});
