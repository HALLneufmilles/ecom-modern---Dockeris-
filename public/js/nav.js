const createNav = () => {
  let nav = document.querySelector(".navbar");

  nav.innerHTML = `
        <div class="nav">
            <a href="../index.html" ><img src="../img/dark-logo.png" class="brand-logo" alt=""></a>
            <div class="nav-items">
                <div class="search">
                    <input type="text" class="search-box" placeholder="search brand, product">
                    <button class="search-btn">search</button>
                </div>
                <a>
                    <img src="../img/user.png" id="user-img" alt="">
                    <div class="login-logout-popup hide">
                        <p class="account-info">Log in as, name</p>
                        <button class="btn" id="user-btn">Log out</button>
                    </div>
                </a>
                <a href="/cart"><img src="../img/cart.png" alt=""></a>
            </div>
        </div>
        <ul class="links-container">
            <li class="link-item"><a href="../index.html" class="link">home</a></li>
            <li class="link-item"><a href="https://robe-oyster.cyclic.app/search/women" class="link">women</a></li>
            <li class="link-item"><a href="https://robe-oyster.cyclic.app/search/men" class="link">men</a></li>
            <li class="link-item"><a href="https://robe-oyster.cyclic.app/search/kids" class="link">kids</a></li>
            <li class="link-item"><a href="https://robe-oyster.cyclic.app/seller" class="link"> || seller</a></li>
        </ul>
    `;
};

createNav();

// nav popup
const userImageButton = document.querySelector("#user-img");
const userPopup = document.querySelector(".login-logout-popup");
const popuptext = document.querySelector(".account-info");
const actionBtn = document.querySelector("#user-btn");

userImageButton.addEventListener("click", (event) => {
  event.stopPropagation();
  userPopup.classList.toggle("hide");
});
// https://chat.openai.com/chat/fa5687ce-fb34-464c-a072-408fd71c9af7
window.addEventListener("click", (event) => {
  // if (!userPopup.contains(event.target)) {
  //   userPopup.classList.add("hide");
  // }
  userPopup.classList.add("hide");
});

// window.onload = () => {
//   let user = JSON.parse(sessionStorage.user || null);
//   if (user != null) {
//     // means user is logged in
//     popuptext.innerHTML = `log in as, ${user.name}`;
//     actionBtn.innerHTML = "log out";
//     actionBtn.addEventListener("click", () => {
//       fetch("/savecart", {
//         method: "post",
//         headers: new Headers({ "Content-Type": "application/json" }),
//         body: JSON.stringify({
//           cart: localStorage.cart ? JSON.parse(localStorage.cart) : null,
//           wishlist: localStorage.wishlist ? JSON.parse(localStorage.wishlist) : null,
//           email: JSON.parse(sessionStorage.user).email,
//           tagsSeller: JSON.parse(sessionStorage.user).tagsSeller,
//         }),
//       })
//         .then((res) => res.json())
//         .then((data) => {
//           // console.log(data);
//           sessionStorage.clear();
//           localStorage.clear();
//           location.replace("/");
//         });
//     });
//   } else {
//     // user is logged out
//     popuptext.innerHTML = "log in to place order";
//     actionBtn.innerHTML = "log in";
//     actionBtn.addEventListener("click", () => {
//       location.href = "/login";
//     });
//   }
// };

window.onload = () => {
  let user = JSON.parse(sessionStorage.user || null);
  if (user != null) {
    // means user is logged in
    popuptext.innerHTML = `log in as, ${user.name}`;
    actionBtn.innerHTML = "log out";
    actionBtn.addEventListener("click", () => {
      const dataToSend = {
        cart: localStorage.cart ? JSON.parse(localStorage.cart) : null,
        wishlist: localStorage.wishlist ? JSON.parse(localStorage.wishlist) : null,
        email: JSON.parse(sessionStorage.user).email,
      };
      if (JSON.parse(sessionStorage.user).seller) {
        dataToSend.tagsSeller = JSON.parse(sessionStorage.user).tagsSeller;
      }
      fetch("/savecart", {
        method: "post",
        headers: new Headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(dataToSend),
      })
        .then((res) => res.json())
        .then((data) => {
          // console.log(data);
          sessionStorage.clear();
          localStorage.clear();
          location.replace("/");
        });
    });
  } else {
    // user is logged out
    popuptext.innerHTML = "log in to place order";
    actionBtn.innerHTML = "log in";
    actionBtn.addEventListener("click", () => {
      location.href = "/login";
    });
  }
};

// search box

const searchBtn = document.querySelector(".search-btn");
const searchBox = document.querySelector(".search-box");
// 😊
//https://chat.openai.com/chat/b061d7f5-a1b4-408e-81c1-2374afc5f7fd#:~:text=bien%20sur%2C%20voici%20comment%20vous
searchBox.addEventListener("keypress", (event) => {
  if (searchBox.value.length && event.key === "Enter") {
    event.preventDefault(); // Empêche l'envoi du formulaire
    document.querySelector(".search-btn").click(); // Clique sur le bouton de recherche
  }
});

searchBtn.addEventListener("click", () => {
  // console.log(searchBox.value);
  if (searchBox.value.length) {
    const searchValue = searchBox.value.toLowerCase();
    location.href = `/search/${searchValue}`;
  }
});
