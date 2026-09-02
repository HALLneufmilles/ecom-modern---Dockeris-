// importing packages
const express = require("express");
const admin = require("firebase-admin");
const bcrypt = require("bcrypt");
const path = require("path");
const nodemailer = require("nodemailer");
const stripe = require("stripe"); // stripe payment 1
const dotenv = require("dotenv");

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

const fetchMedusaStore = async (pathname, { method = "GET", body, token } = {}) => {
  const { backendUrl, publishableApiKey } = getMedusaStoreConfig();
  const url = new URL(pathname, backendUrl);
  const response = await fetch(url, {
    method,
    headers: {
      "x-publishable-api-key": publishableApiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
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
  const productImages = product.images?.map((image) => image.url).filter(Boolean) || [];
  const variants = (product.variants || []).map((variant) => {
    const price = variant.calculated_price;
    const inventoryQuantity = variant.inventory_quantity;
    const available = variant.manage_inventory === false
      || variant.allow_backorder === true
      || Number(inventoryQuantity) > 0;

    return {
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
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
    thumbnail: product.thumbnail,
    options,
    variants,
    tags: (product.tags || []).map((tag) => tag.value).filter(Boolean),
  };
};

// F-14 - temporary proxy from the current storefront to the Medusa Store API
app.get("/medusa-home-products", async (req, res) => {
  const { publishableApiKey } = getMedusaStoreConfig();

  if (!publishableApiKey) {
    return res.status(503).json({ error: "catalogue_unavailable" });
  }

  try {
    const { backendUrl } = getMedusaStoreConfig();
    const regionId = await getDefaultMedusaRegionId();
    const productsUrl = new URL("/store/products", backendUrl);
    productsUrl.searchParams.set("limit", "4");
    productsUrl.searchParams.set("region_id", regionId);
    const productsData = await fetchMedusaStore(productsUrl.pathname + productsUrl.search);
    const medusaProducts = productsData.products;

    if (!Array.isArray(medusaProducts) || medusaProducts.length !== 4) {
      throw new Error("The Medusa seed catalogue does not contain exactly four products");
    }

    const products = medusaProducts.map((product) => {
      const pricedVariant = product.variants?.find((variant) => variant.calculated_price);
      const calculatedPrice = pricedVariant?.calculated_price;

      if (!calculatedPrice) {
        throw new Error(`No calculated price is available for Medusa product ${product.id}`);
      }

      const sellPrice = Number(calculatedPrice.calculated_amount);
      const actualPrice = Number(calculatedPrice.original_amount ?? sellPrice);
      const discount = actualPrice > sellPrice
        ? Math.round(((actualPrice - sellPrice) / actualPrice) * 100)
        : 0;

      return {
        id: product.id,
        name: product.title,
        shortDes: product.subtitle || product.description || "",
        image: product.thumbnail || product.images?.[0]?.url || "/img/no image.png",
        sellPrice,
        actualPrice,
        discount,
        currencyCode: calculatedPrice.currency_code,
      };
    });

    return res.json(products);
  } catch (error) {
    console.error("F-14 Medusa catalogue unavailable:", error.message);
    return res.status(502).json({ error: "catalogue_unavailable" });
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
    productUrl.searchParams.set("fields", "*variants.calculated_price,+variants.inventory_quantity");

    const data = await fetchMedusaStore(productUrl.pathname + productUrl.search);
    return res.json(mapMedusaProduct(data.product, regionId));
  } catch (error) {
    console.error("F-04 Medusa product unavailable:", error.message);
    const status = error.status === 404 ? 404 : 502;
    return res.status(status).json({ error: status === 404 ? "product_not_found" : "catalogue_unavailable" });
  }
});

const createMedusaCart = async (regionId, token) => {
  const data = await fetchMedusaStore("/store/carts", {
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

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
};

const getMedusaCustomerToken = (req) => readCookie(req, MEDUSA_AUTH_COOKIE);

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

const retrieveMedusaCart = async (cartId, token) => {
  const data = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cartId)}`, { token });
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

const transferMedusaCart = async (cartId, token) => {
  const data = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cartId)}/customer`, {
    method: "POST",
    token,
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

const mergeMedusaCarts = async (targetCart, sourceCart, token) => {
  let cart = targetCart;

  for (const item of sourceCart.items || []) {
    cart = await addMedusaCartItem(cart.id, item.variant_id, Number(item.quantity), token);
  }

  return cart;
};

const resolveCustomerCart = async (token, browserCartId) => {
  const customer = await retrieveMedusaCustomer(token);
  const customerCartId = typeof customer.metadata?.active_cart_id === "string"
    ? customer.metadata.active_cart_id
    : null;
  let customerCart = await findUsableMedusaCart(customerCartId, token);
  const browserCart = browserCartId === customerCartId
    ? customerCart
    : await findUsableMedusaCart(browserCartId, token);

  if (customerCart && browserCart) {
    customerCart = await mergeMedusaCarts(customerCart, browserCart, token);
  } else if (!customerCart && browserCart) {
    customerCart = browserCart;
  } else if (!customerCart) {
    customerCart = await createMedusaCart(await getDefaultMedusaRegionId(), token);
  }

  customerCart = await transferMedusaCart(customerCart.id, token);
  await updateMedusaCustomer(token, {
    metadata: {
      ...customer.metadata,
      active_cart_id: customerCart.id,
    },
  });

  return { customer, cart: customerCart };
};

const addMedusaCartItem = async (cartId, variantId, quantity, token) => {
  const data = await fetchMedusaStore(`/store/carts/${encodeURIComponent(cartId)}/line-items`, {
    method: "POST",
    body: { variant_id: variantId, quantity },
    token,
  });

  return data.cart;
};

app.post("/medusa-cart/items", async (req, res) => {
  const { publishableApiKey } = getMedusaStoreConfig();
  const { cartId, variantId, quantity = 1 } = req.body;
  const token = getMedusaCustomerToken(req);

  if (!publishableApiKey) {
    return res.status(503).json({ error: "cart_unavailable" });
  }

  if (typeof variantId !== "string" || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "invalid_cart_item" });
  }

  try {
    let activeCartId = typeof cartId === "string" && cartId ? cartId : null;

    if (!activeCartId) {
      activeCartId = (await createMedusaCart(await getDefaultMedusaRegionId(), token)).id;
    }

    let cart;
    try {
      cart = await addMedusaCartItem(activeCartId, variantId, quantity, token);
    } catch (error) {
      if (!cartId || error.status !== 404) {
        throw error;
      }

      activeCartId = (await createMedusaCart(await getDefaultMedusaRegionId(), token)).id;
      cart = await addMedusaCartItem(activeCartId, variantId, quantity, token);
    }

    if (token) {
      const customer = await retrieveMedusaCustomer(token);
      await updateMedusaCustomer(token, {
        metadata: { ...customer.metadata, active_cart_id: cart.id },
      });
    }

    return res.json({ cart });
  } catch (error) {
    console.error("F-04 Medusa cart unavailable:", error.message);
    return res.status(502).json({ error: "cart_unavailable" });
  }
});

app.get("/medusa-cart/:id", async (req, res) => {
  try {
    const cart = await retrieveMedusaCart(req.params.id, getMedusaCustomerToken(req));
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
    const data = await fetchMedusaStore(
      `/store/carts/${encodeURIComponent(req.params.cartId)}/line-items/${encodeURIComponent(req.params.lineId)}`,
      {
        method: "POST",
        body: { quantity },
        token: getMedusaCustomerToken(req),
      }
    );
    return res.json({ cart: data.cart });
  } catch (error) {
    return res.status(error.status === 404 ? 404 : 502).json({ error: "cart_update_failed" });
  }
});

app.delete("/medusa-cart/:cartId/items/:lineId", async (req, res) => {
  try {
    const data = await fetchMedusaStore(
      `/store/carts/${encodeURIComponent(req.params.cartId)}/line-items/${encodeURIComponent(req.params.lineId)}`,
      { method: "DELETE", token: getMedusaCustomerToken(req) }
    );
    return res.json({ cart: data.parent });
  } catch (error) {
    return res.status(error.status === 404 ? 404 : 502).json({ error: "cart_delete_failed" });
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
  const [user, saved, seller] = await Promise.all([
    db.collection("users").doc(email).get(),
    db.collection("saved").doc(email).get(),
    db.collection("sellers").doc(email).get(),
  ]);

  return { user, saved, seller };
};

const customerResponse = ({ customer, cart, legacy }) => ({
  name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email,
  email: customer.email,
  seller: legacy.user.exists ? Boolean(legacy.user.data().seller) : false,
  tagsSeller: legacy.seller.exists ? legacy.seller.data().tagsSeller : null,
  wishlist: legacy.saved.exists && Array.isArray(legacy.saved.data().wishlist)
    ? legacy.saved.data().wishlist
    : [],
  cartId: cart.id,
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

    const { customer, cart } = await resolveCustomerCart(token, req.body.cartId);
    const legacy = await getLegacyAccountState(email);
    setMedusaCustomerCookie(res, token);
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

// app.post("/login", (req, res) => {
//   let { email, password } = req.body;

//   if (!email.length || !password.length) {
//     return res.json({ alert: "fill all the inputs" });
//   }

//   const sellerPromise = db.collection("sellers").doc(email).get();

//   const userPromise = db.collection("users").doc(email).get();

//   const savedPromise = db.collection("saved").doc(email).get();

//   Promise.all([userPromise, savedPromise, sellerPromise]).then(([user, saved, seller]) => {
//     if (!user.exists) {
//       // if email does not exists
//       return res.json({ alert: "log in email does not exists" });
//     } else {
//       bcrypt.compare(password, user.data().password, (err, result) => {
//         if (result) {
//           let data = user.data();
//           let response = {
//             name: data.name,
//             email: data.email,
//             seller: data.seller,
//           };
//           if (seller.exists) {
//             const sellerData = seller.data();
//             response.tagsSeller = sellerData.tagsSeller;
//           }
//           if (saved.exists) {
//             const savedData = saved.data();
//             // console.log("saveData: ", savedData);
//             const { cart, wishlist } = savedData;
//             // console.log("cart: ", cart);
//             // console.log("cawishlistrt: ", wishlist);
//             response.cart = cart;
//             response.wishlist = wishlist;
//           } else {
//             response.cart = [];
//             response.wishlist = [];
//           }
//           // console.log("response: ", response);
//           return res.json(response);
//         } else {
//           return res.json({ alert: "password is incorrect" });
//         }
//       });
//     }
//   });
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

    const { customer, cart } = await resolveCustomerCart(token, req.body.cartId);
    setMedusaCustomerCookie(res, token);
    return res.json(customerResponse({ customer, cart, legacy }));
  } catch (error) {
    console.error("Medusa customer login failed:", error.message);
    return res.status(502).json({ alert: "account service unavailable" });
  }
});

app.post("/logout", (req, res) => {
  clearMedusaCustomerCookie(res);
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

app.post("/save-user-state", (req, res) => {
  const { email, wishlist, tagsSeller } = req.body;
  const docName = email;
  const savedState = { wishlist: Array.isArray(wishlist) ? wishlist : [] };

  const promises = [];

  promises.push(db.collection("saved").doc(docName).set(savedState));

  // Mise à jour de la collection "sellers"
  if (tagsSeller) {
    promises.push(
      db.collection("sellers").doc(docName).set({ tagsSeller }, { merge: true })
    );
  }

  // Exécution de toutes les promises
  Promise.all(promises)
    .then(() => {
      res.json("saved");
    })
    .catch((err) => {
      console.error(err);
      res.json("some error occurred in save. Try again");
    });
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

//stripe payment 2
// On prépare notre key utilisateur stripe
let stripeGateway = stripe(process.env.stripe_key);

// On prépare l'adresse de notre domaine qu'il faut communiquer à sprite pour qu'il nous retourne sa réponse.
let DOMAIN = process.env.DOMAIN;
// module.exports = { DOMAIN };

// On prépare une requete sever pour qu'il demande une url de paiement à stripe. Pour ça, il faut communiquer à stripe ce dont il à besoin
app.post("/stripe-checkout", async (req, res) => {
  try {
    const cart = await retrieveMedusaCart(req.body.cartId, getMedusaCustomerToken(req));
    if (!cart.items?.length) {
      return res.status(400).json({ error: "empty_cart" });
    }

    const orderItems = cart.items.map((item) => ({
      lineId: item.id,
      variantId: item.variant_id,
      item: Number(item.quantity),
      name: item.product_title || item.title,
      shortDes: item.variant_title || item.subtitle || "",
      image: item.thumbnail,
      sellPrice: Number(item.unit_price),
      currencyCode: cart.currency_code,
    }));

    const order = {
      email: req.body.email,
      address: req.body.address,
      cartId: cart.id,
      items: orderItems,
      total: Number(cart.total || 0),
      currencyCode: cart.currency_code,
    };

    const session = await stripeGateway.checkout.sessions.create({
    // strip à besoin de parametres :
    payment_method_types: ["card"], // la méthode de payment ( je croix que la carte est paramétrer par défaut donc peut-etre pas nécéssaire)
    // le mode
    mode: "payment",
    // stripe payment 3
    // On demande à stripe de rediriger l'utilisateur vers l'adresse (end-point) ${DOMAIN}/success donc http://localhost:5000/success
    // en lui passant en parametre, cad après le signe "?" 'session_id' et 'order' pour que lorsque le navigateur ateindra ce end-point,
    // une fetch est executer automatiquement pour enregistrer l'achat dans la base de données 'firebase', voir : stripe payment 4.
    success_url: `${DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}&order=${encodeURIComponent(
      JSON.stringify(order)
    )}`,
    // même chose en cas d'annulation de la commande par l'utilisateur ( sur la page stripe il y à une flache "retour" vers la gauche pour annuler le paiement)
    cancel_url: `${DOMAIN}/checkout?payment_fail=true`,
    // enfin on communique les items à payer sous forme d'un tableau d'objets correspondant à chaque items à partir de req.body.items qui donne accès à "cart",
    // qui est lui même un tableau d'objet.(ex: cart: [{"item":"2","name":"Porte-manteau gros plan jpeg"…st-3.amazonaws.com/89416347401679846304030.jpg"}] )
    // les items sont transmis par la fetch POST "/stripe-checkout" de checkout.js

    line_items: cart.items.map((item) => {
      return {
        price_data: {
          currency: cart.currency_code,
          product_data: {
            name: item.product_title || item.title,
            description: item.variant_title || item.subtitle || undefined,
            images: item.thumbnail ? [item.thumbnail] : [],
          },
          unit_amount: Number(item.unit_price) * 100,
        },
        quantity: Number(item.quantity),
      };
    }),
    });
    return res.json(session.url);
  } catch (error) {
    console.error("Stripe checkout cart preparation failed:", error.message);
    return res.status(502).json({ error: "checkout_unavailable" });
  }
});

// stripe payment 4
app.get("/success", async (req, res) => {
  // on recupère les parametres (?) 'order' et 'session_id' de l'url avec 'req.query' ... voir stripe payment 3
  let { order, session_id } = req.query;

  try {
    // Avec 'session_id' on récupère les données de la session stripe.
    const session = await stripeGateway.checkout.sessions.retrieve(session_id);
    // console.log(`session`, session);
    // on récupère l'email de la session qui va nous servir joindre les données à l'utilisateur dans firebase.
    const customer = session.customer_details.email;
    // on crée une date qui va nous servir à identifier l'ordre d'achat (l'identification du document) dans firebase.
    let date = new Date();
    // création du nom du doc pour firebase, puis on enregistre les données.
    let docName = `${customer.email}-order-${date.getTime()}`;
    db.collection("order")
      .doc(docName)
      .set(JSON.parse(order))
      .then((data) => {
        res.redirect("/checkout?payment=done");
        // si tout s'est bien passé il faut en informer l'utilisateur en lui affichant une alerte success sur la page ... voir stripe payment 5 dans checkout.js
      });
  } catch (err) {
    res.json("error, see your terminal");
    // console.log(err);
    res.redirect("/404");
  }
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
