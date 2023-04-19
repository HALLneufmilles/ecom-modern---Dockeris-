let user = JSON.parse(sessionStorage.user || null);
let loader = document.querySelector(".loader");

// checknig user is logged in or not
window.onload = () => {
  if (user) {
    if (!compareToken(user.authToken, user.email)) {
      location.replace("/login");
    }
  } else {
    location.replace("/login");
  }
};

// price inputs

const actualPrice = document.querySelector("#actual-price");
const discountPercentage = document.querySelector("#discount");
const sellingPrice = document.querySelector("#sell-price");

discountPercentage.addEventListener("keypress", (event) => {
  if (event.keyCode === 13 && !isNaN(actualPrice.value) && !isNaN(discountPercentage.value)) {
    if (discountPercentage.value > 100) {
      discountPercentage.value = 100;
    } else {
      let discount = (actualPrice.value * discountPercentage.value) / 100;
      sellingPrice.value = parseFloat(actualPrice.value - discount).toFixed(2);
      // sellingPrice.value = parseFloat((actualPrice.value * discountPercentage.value) / 100).toFixed(2);
      // console.log(`actualPrice.value`, actualPrice.value);
      // console.log(`discountPercentage.value`, discountPercentage.value);
      // console.log(`sellingPrice.value`, sellingPrice.value);
    }
  }
});

sellingPrice.addEventListener("keypress", (event) => {
  if (event.keyCode === 13 && !isNaN(sellingPrice.value) && !isNaN(actualPrice.value)) {
    let discount = (sellingPrice.value / actualPrice.value) * 100;
    discountPercentage.value = parseFloat(100 - discount).toFixed(0);
    // discountPercentage.value = (sellingPrice.value * 100) / actualPrice.value;
    // discountPercentage.value = discount;
  }
});

// upload image handle
let uploadImages = document.querySelectorAll(".fileupload");
const deleteButtons = document.querySelectorAll(".delete-image");
let imagePaths = [null, null, null, null]; // will store all uploaded images paths;
// l'affichage des bouton de de suppression des images fonctionne avec les nouveau produits.

uploadImages.forEach((fileupload, index) => {
  fileupload.addEventListener("change", () => {
    const file = fileupload.files[0];
    let imageUrl;

    if (file.type.includes("image")) {
      // means user uploaded an image
      fetch("/s3url")
        .then((res) => res.json())
        .then((url) => {
          fetch(url, {
            method: "PUT",
            headers: new Headers({ "Content-Type": "image/jpeg" }), // modif en image/jpeg pour transformer les image en jpeg afin que stripe puisse les afficher
            body: file,
          }).then((res) => {
            imageUrl = url.split("?")[0];
            imagePaths[index] = imageUrl;
            let label = document.querySelector(`label[for=${fileupload.id}]`);
            label.style.backgroundImage = `url(${imageUrl})`;
            let productImage = document.querySelector(".product-image");
            productImage.style.backgroundImage = `url(${imageUrl})`;
            // console.log(`imagePaths en dessous de window.onload : `, imagePaths);
            updateDeleteButtonVisibility();
          });
        });
    } else {
      showAlert("upload image only");
    }
  });
});

deleteButtons.forEach((deleteButton, index) => {
  deleteButton.addEventListener("click", () => {
    imagePaths[index] = null;
    let label = document.querySelector(`label[for=${deleteButton.parentNode.htmlFor}]`);
    label.style.backgroundImage = null;
    let productImage = document.querySelector(".product-image");
    imageLinks = imagePaths.filter((value) => value);
    productImage.style.backgroundImage = `url(${imageLinks[imageLinks.length - 1]})`;
    // console.log(imagePaths);
    updateDeleteButtonVisibility();
  });
});

function updateDeleteButtonVisibility() {
  const uploadLabels = document.querySelectorAll(".upload-image"); // labels
  const buttons = document.querySelectorAll(".delete-image");
  uploadLabels.forEach((label, i) => {
    if (imagePaths[i] !== null) {
      buttons[i].style.display = "flex";
    } else {
      buttons[i].style.display = "none";
    }
  });
}

// form submission

const productName = document.querySelector("#product-name");
const shortLine = document.querySelector("#short-des");
const des = document.querySelector("#des");

let sizes = []; // will store all the sizes

const stock = document.querySelector("#stock");
const tags = document.querySelector("#tags");
const tac = document.querySelector("#tac");

// buttons
const addProductBtn = document.querySelector("#add-btn");
const saveDraft = document.querySelector("#save-btn");

// store size function
const storeSizes = () => {
  sizes = [];
  let sizeCheckBox = document.querySelectorAll(".size-checkbox");
  sizeCheckBox.forEach((item) => {
    if (item.checked) {
      sizes.push(item.value);
    }
  });
};

const validateForm = () => {
  if (!productName.value.length) {
    return showAlert("enter product name");
  } else if (shortLine.value.length > 100 || shortLine.value.length < 10) {
    return showAlert("short description must be between 10 to 100 letters long");
  } else if (!des.value.length) {
    return showAlert("enter detail description about the product");
  } else if (!imagePaths.length) {
    // image link array
    return showAlert("upload atleast one product image");
  } else if (!sizes.length) {
    // size array
    return showAlert("select at least one size");
  } else if (!actualPrice.value.length || !discount.value.length || !sellingPrice.value.length) {
    return showAlert("you must add pricings");
  } else if (stock.value < 20) {
    return showAlert("you should have at least 20 items in stock");
  } else if (!tags.value.length) {
    return showAlert("enter few tags to help ranking your product in search");
  } else if (!tac.checked) {
    return showAlert("you must agree to our terms and conditions");
  }
  return true;
};

const productData = () => {
  // console.log(tags.value);
  let tagArr = tags.value.split(",");
  tagArr = tagArr.map((tag) => tag.trim().toLowerCase());
  console.log(tagArr);
  // Récupération des valeurs de tagsSeller depuis sessionStorage
  let userObject = JSON.parse(sessionStorage.getItem("user")); // JSON.parse(sessionStorage.user)
  // user.tagsSeller =
  let tagsSeller = userObject.tagsSeller;
  console.log(`In productData :`, tagsSeller);
  // Fusion des deux tableaux et suppression des doublons
  let mergedArr = tagsSeller.concat(tagArr);
  let uniqueArr = mergedArr.filter((item, index) => mergedArr.indexOf(item) === index);
  // Si l'index de l'élément actuel n'est pas égal à l'index de la première occurrence, cela signifie que l'élément est en double, donc il est filtré.
  //  une occurrence se réfère à l'apparition d'une valeur particulière dans un ensemble de données. Par exemple, dans ce tableau [1, 2, 3, 2, 4, 5], la valeur 2 apparaît deux fois, donc il y a deux occurrences de 2.
  // Donc la première occurence de 2 c'est à dire 'mergedArr.indexOf(2)' est égale à l'index en cours pour le premier 2 du tableau, mais pas pour le second, donc le second est supprimé.
  userObject.tagsSeller = uniqueArr;
  // Stockage du tableau unique dans sessionStorage
  sessionStorage.setItem("user", JSON.stringify(userObject));
  // console.log(tagArr);

  // sendData("/tagsSeller", {
  //   email: user.email,
  //   tagsSeller: user.tagsSeller,
  // });

  return (data = {
    name: productName.value,
    shortDes: shortLine.value,
    des: des.value,
    images: imagePaths,
    sizes: sizes,
    actualPrice: actualPrice.value,
    discount: discountPercentage.value,
    sellPrice: sellingPrice.value,
    stock: stock.value,
    tags: tagArr,
    tac: tac.checked,
    email: user.email,
  });
};

addProductBtn.addEventListener("click", () => {
  storeSizes();
  // validate form
  if (validateForm()) {
    // validateForm return true or false while doing validation
    loader.style.display = "block";
    let data = productData();
    if (productId) {
      data.id = productId;
    }
    sendData("/add-product", data);
  }
});

// save draft btn
saveDraft.addEventListener("click", () => {
  // store sizes
  storeSizes();
  // check for product name
  if (!productName.value.length) {
    showAlert("enter product name");
  } else {
    // don't validate the data
    let data = productData();
    data.draft = true;
    if (productId) {
      data.id = productId;
    }
    sendData("/add-product", data);
  }
});

// exisiting product detail handle

const setFormsData = (data) => {
  productName.value = data.name;
  shortLine.value = data.shortDes;
  des.value = data.des;
  actualPrice.value = data.actualPrice;
  discountPercentage.value = data.discount;
  sellingPrice.value = data.sellPrice;
  stock.value = data.stock;
  tags.value = data.tags;

  // set up images
  imagePaths = data.images;
  // console.log(`imagePaths in setFormData :`, imagePaths);
  /* Je met imagePaths dans localStorage */

  imagePaths.forEach((url, i) => {
    let label = document.querySelector(`label[for=${uploadImages[i].id}]`);
    label.style.backgroundImage = `url(${url})`;
    let productImage = document.querySelector(".product-image");
    // productImage.style.backgroundImage = `url(${url})`;
    imageLinks = imagePaths.filter((value) => value);
    productImage.style.backgroundImage = `url(${imageLinks[imageLinks.length - 1]})`;
    // console.log(`label.style.backgroundImage in setFormData :`, label.style.backgroundImage);
    // updateDeleteButtonVisibility();
  });

  // setup sizes
  sizes = data.sizes;

  let sizeCheckbox = document.querySelectorAll(".size-checkbox");
  sizeCheckbox.forEach((item) => {
    if (sizes.includes(item.value)) {
      item.setAttribute("checked", "");
    }
  });
  updateDeleteButtonVisibility();
};

const fetchAddProductDataId = () => {
  fetch("/get-products", {
    method: "post",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email: user.email, id: productId }),
  })
    .then((res) => res.json())
    .then((data) => {
      setFormsData(data);
      // updateDeleteButtonVisibility();
    })
    .catch((err) => {
      console.log(err);
    });
};

let productId = null;
if (location.pathname != "/add-product") {
  productId = decodeURI(location.pathname.split("/").pop());

  fetchAddProductDataId();
}
