const setupSlidingEffect = () => {
  const productContainers = [...document.querySelectorAll(".product-container")];
  const nxtBtn = [...document.querySelectorAll(".nxt-btn")];
  const preBtn = [...document.querySelectorAll(".pre-btn")];

  productContainers.forEach((item, i) => {
    let containerDimenstions = item.getBoundingClientRect();
    let containerWidth = containerDimenstions.width;

    nxtBtn[i].addEventListener("click", () => {
      item.scrollLeft += containerWidth;
    });

    preBtn[i].addEventListener("click", () => {
      item.scrollLeft -= containerWidth;
    });
  });
};

// fetch product cards
const getProducts = async (tag) => {
  const res = await fetch("/get-products", {
    method: "post",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ tag: tag }),
  });
  const data = await res.json();
  return data;
};

// F-14 - fetch the four Medusa seed products through the temporary Express proxy
const getMedusaHomeProducts = async () => {
  const res = await fetch("/medusa-home-products");

  if (!res.ok) {
    throw new Error("Medusa catalogue is unavailable");
  }

  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Medusa catalogue is empty");
  }

  return data;
};

// create product slider
const createProductSlider = (data, parent, title) => {
  let slideContainer = document.querySelector(`${parent}`);

  slideContainer.innerHTML += `
    <section class="product">
        <h2 class="product-category">${title}</h2>
        <button class="pre-btn"><img src="../img/arrow.png" alt=""></button>
        <button class="nxt-btn"><img src="../img/arrow.png" alt=""></button>
        ${createCard(data)}
    </section>
    `;
  setupSlidingEffect();
};

const createCard = (data, parent) => {
  // console.log(`ceateCard : `, data);
  //here parent is for search product
  let start = '<div class="product-container">';
  let middle = ""; // this will contain card HTML
  let end = "</div>";
  // console.log(data);
  for (let i = 0; i < data.length; i++) {
    if (data[i].id != decodeURI(location.pathname.split("/").pop())) {
      const image = data[i].image || data[i].images?.[0] || "../img/no image.png";
      const isEuroPrice = data[i].currencyCode?.toLowerCase() === "eur";
      const formatPrice = (value) => isEuroPrice
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value))
        : `$${value}`;
      const discount = Number(data[i].discount) || 0;
      const discountTag = discount > 0
        ? `<span class="discount-tag">${discount}% off</span>`
        : "";
      const actualPrice = discount > 0
        ? `<span class="actual-price">${formatPrice(data[i].actualPrice)}</span>`
        : "";

      middle += `
            <div class="product-card" onclick="location.href = '/products/${data[i].id}'">
                <div class="product-image">
                    ${discountTag}
                    <img src="${image}" class="product-thumb" alt="${data[i].name}">
                </div>
                <div class="product-info" >
                    <h2 class="product-brand">${data[i].name}</h2>
                    <p class="product-short-des">${data[i].shortDes}</p>
                    <span class="price">${formatPrice(data[i].sellPrice)}</span> ${actualPrice}
                </div>
            </div>
            `;
    }
  }

  if (parent) {
    let cardContainer = document.querySelector(parent);
    cardContainer.innerHTML = start + middle + end;
  } else {
    return start + middle + end;
  }
};

const showHomeCatalogueState = (parent) => {
  const slideContainer = document.querySelector(parent);

  slideContainer.innerHTML = `
    <section class="product">
      <h2 class="product-category">Catalogue</h2>
      <div class="product-container">
        <p class="catalogue-state" role="status">Catalogue temporairement indisponible.</p>
      </div>
    </section>
  `;
};

const add_product_to_cart_or_wishlist = (type, product) => {
  let data = JSON.parse(localStorage.getItem(type));
  if (data == null) {
    data = [];
  }

  product = {
    item: 1,
    name: product.name,
    sellPrice: product.sellPrice,
    size: size || null,
    shortDes: product.shortDes,
    image: product.images[0],
  };

  data.push(product);
  localStorage.setItem(type, JSON.stringify(data));
  return "added";
};
