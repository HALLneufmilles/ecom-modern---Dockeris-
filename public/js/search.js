const getSearchKey = () => {
  const encodedKey = location.pathname.split("/").pop() || "";

  try {
    return decodeURIComponent(encodedKey).trim();
  } catch {
    return "";
  }
};

const formatSearchPrice = (value, currencyCode) => {
  if (currencyCode?.toLowerCase() === "eur") {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
  }

  return `$${value}`;
};

const renderSearchCards = (products) => {
  const cardContainer = document.querySelector(".card-container");
  const productContainer = document.createElement("div");
  productContainer.className = "product-container";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.addEventListener("click", () => {
      location.href = `/products/${encodeURIComponent(product.id)}`;
    });

    const imageContainer = document.createElement("div");
    imageContainer.className = "product-image";
    const discount = Number(product.discount) || 0;

    if (discount > 0) {
      const discountTag = document.createElement("span");
      discountTag.className = "discount-tag";
      discountTag.textContent = `${discount}% off`;
      imageContainer.append(discountTag);
    }

    const image = document.createElement("img");
    image.className = "product-thumb";
    image.src = product.image || "/img/no image.png";
    image.alt = product.name || "Produit";
    imageContainer.append(image);

    const productInfo = document.createElement("div");
    productInfo.className = "product-info";
    const name = document.createElement("h2");
    name.className = "product-brand";
    name.textContent = product.name || "Produit";
    const description = document.createElement("p");
    description.className = "product-short-des";
    description.textContent = product.shortDes || "";
    const price = document.createElement("span");
    price.className = "price";
    price.textContent = formatSearchPrice(product.sellPrice, product.currencyCode);

    productInfo.append(name, description, price);

    if (discount > 0) {
      const actualPrice = document.createElement("span");
      actualPrice.className = "actual-price";
      actualPrice.textContent = formatSearchPrice(product.actualPrice, product.currencyCode);
      productInfo.append(document.createTextNode(" "), actualPrice);
    }

    card.append(imageContainer, productInfo);
    productContainer.append(card);
  });

  cardContainer.replaceChildren(productContainer);
};

const loadSearchResults = async () => {
  const searchKey = getSearchKey();
  const searchSpanElement = document.querySelector("#search-key");
  const searchState = document.querySelector(".search-state");

  searchSpanElement.textContent = searchKey;

  if (!searchKey) {
    searchState.textContent = "La recherche est invalide.";
    return;
  }

  try {
    const searchUrl = new URL("/medusa-search-products", location.origin);
    searchUrl.searchParams.set("q", searchKey);
    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error("Medusa catalogue search is unavailable");
    }

    const products = await response.json();

    if (!Array.isArray(products) || products.length === 0) {
      searchState.textContent = "Aucun produit ne correspond à votre recherche.";
      return;
    }

    renderSearchCards(products);
  } catch {
    searchState.textContent = "La recherche est temporairement indisponible. Veuillez réessayer.";
  }
};

loadSearchResults();
