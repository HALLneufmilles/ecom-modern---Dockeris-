const productImages = document.querySelectorAll(".product-images img"); // selecting all image thumbs
const productImageSlide = document.querySelector(".image-slider"); // seclecting image slider element
const loaderDiv = document.querySelector(".loader-div");

let activeImageSlide = 0; // default slider image

productImages.forEach((item, i) => {
  // loopinh through each image thumb
  item.addEventListener("click", () => {
    // adding click event to each image thumbnail
    productImages[activeImageSlide].classList.remove("active"); // removing active class from current image thumb
    item.classList.add("active"); // adding active class to the current or clicked image thumb
    productImageSlide.style.backgroundImage = `url('${item.src}')`; // setting up image slider's background image
    activeImageSlide = i; // updating the image slider variable to track current thumb
  });
});

// toggle size buttons

const sizeBtns = document.querySelectorAll(".size-radio-btn"); // selecting size buttons
let checkedBtn = 0; // current selected button
let hasCheckedSize = false;
let size;

sizeBtns.forEach((item, i) => {
  loaderDiv.style.display = "block";
  // looping through each button
  item.addEventListener("click", () => {
    for (let sizeBtn of sizeBtns) {
      if (sizeBtn.classList.contains("uncheck")) {
        sizeBtn.classList.remove("uncheck");
      }
    }

    hasCheckedSize = true;
    // console.log(`foreach :`, checkedBtn);
    // adding click event to each
    sizeBtns[checkedBtn].classList.remove("check"); // removing check class from the current button
    item.classList.add("check"); // adding check class to clicked button
    checkedBtn = i; // upading the variable
    size = item.innerHTML;
  });
});

const setData = (data) => {
  let title = document.querySelector("title");

  // setup the images
  productImages.forEach((img, i) => {
    if (data.images[i]) {
      img.src = data.images[i];
    } else {
      img.style.display = "none";
    }
  });
  productImages[0].click();

  // setup size buttons
  sizeBtns.forEach((item) => {
    if (!data.sizes.includes(item.innerHTML)) {
      item.style.display = "none";
    }
  });

  //setting up texts
  const name = document.querySelector(".product-brand");
  const shortDes = document.querySelector(".product-short-des");
  const des = document.querySelector(".des");

  title.innerHTML += name.innerHTML = data.name;
  shortDes.innerHTML = data.shortDes;
  des.innerHTML = data.des;

  // pricing
  const sellPrice = document.querySelector(".product-price");
  const actualPrice = document.querySelector(".product-actual-price");
  const discount = document.querySelector(".product-discount");

  sellPrice.innerHTML = `$${data.sellPrice}`;
  actualPrice.innerHTML = `$${data.actualPrice}`;
  discount.innerHTML = `( ${data.discount}% off )`;

  // wishlist and cart btn
  const wishlistBtn = document.querySelector(".wishlist-btn");
  wishlistBtn.addEventListener("click", () => {
    if (hasCheckedSize) {
      wishlistBtn.innerHTML = add_product_to_cart_or_wishlist("wishlist", data);
    } else {
      addRedClass();
    }
  });

  const cartBtn = document.querySelector(".cart-btn");
  cartBtn.addEventListener("click", () => {
    // console.log(checkedBtn);
    if (hasCheckedSize) {
      cartBtn.innerHTML = add_product_to_cart_or_wishlist("cart", data);
    } else {
      addRedClass();
    }
  });
};

const addRedClass = () => {
  for (let sizeBtn of sizeBtns) {
    sizeBtn.classList.add("uncheck");
  }
};

// fetch data
const getProductDataId = () => {
  fetch("/get-products", {
    method: "post",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: productId }),
  })
    .then((res) => res.json())
    .then((data) => {
      // console.log(`getProductDataId : `, data);
      setData(data);
      loaderDiv.style.display = null;
      tagsArray = data.tags;
      // console.log(`tagsArray :`, tagsArray);
      tagsArray.forEach((tag) => {
        // console.log(tag);
        getProducts(tag).then((data) => createProductSlider(data, ".container-for-card-slider", `similar products: ${tag}`));
      });
      // getProducts(data.tags[1]).then((data) => createProductSlider(data, ".container-for-card-slider", "similar products"));
    })

    .catch((err) => {
      loaderDiv.style.display = null;
      // location.replace("/404");
    });
};

let productId = null;
if (location.pathname != "/products") {
  productId = decodeURI(location.pathname.split("/").pop());

  getProductDataId();
}
