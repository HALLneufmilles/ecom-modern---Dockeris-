localStorage.removeItem("medusa_cart_id");

// const { DOMAIN } = require("../../server.js");
// console.log(DOMAIN);
const createNav = () => {
  let nav = document.querySelector(".navbar");

  nav.innerHTML = `
        <div class="nav">
            <a href="../index.html" ><img src="../img/dark-logo.png" class="brand-logo" alt=""></a>
            <div class="nav-items">
                <div class="search">
                    <input type="text" class="search-box" placeholder="Rechercher une marque, un produit">
                    <button class="search-btn">Rechercher</button>
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
            <li class="link-item"><a href="https://ecom-modern.onrender.com/search/women" class="link">women</a></li>
            <li class="link-item"><a href="https://ecom-modern.onrender.com/search/men" class="link">men</a></li>
            <li class="link-item"><a href="https://ecom-modern.onrender.com/search/kids" class="link">kids</a></li>
            <li class="link-item"><a href="https://ecom-modern.onrender.com/seller" class="link"> || seller</a></li> 

           <!--   <li class="link-item"><a href="../index.html" class="link">home</a></li>
            <li class="link-item"><a href="http://localhost:5000/search/women" class="link">women</a></li>
            <li class="link-item"><a href="http://localhost:5000/search/men" class="link">men</a></li>
            <li class="link-item"><a href="http://localhost:5000/search/kids" class="link">kids</a></li>
            <li class="link-item"><a href="http://localhost:5000/seller" class="link"> || seller</a></li> -->
        </ul>
    `;
};

createNav();

// nav popup
const userImageButton = document.querySelector("#user-img");
const userPopup = document.querySelector(".login-logout-popup");
const popuptext = document.querySelector(".account-info");
const actionBtn = document.querySelector("#user-btn");

window.customerSessionState = { status: "pending", user: null };
window.customerSessionReady = (async () => {
  try {
    const response = await fetch("/medusa-customer/session", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.authenticated === true && data.user?.email) {
      sessionStorage.setItem("user", JSON.stringify(data.user));
      return (window.customerSessionState = { status: "authenticated", user: data.user });
    }

    if (response.ok || response.status === 401) {
      sessionStorage.removeItem("user");
      return (window.customerSessionState = { status: "anonymous", user: null });
    }
  } catch (error) {
    // Une indisponibilité temporaire ne doit pas invalider un cache UI existant.
  }

  return (window.customerSessionState = { status: "unavailable", user: null });
})();

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

const setLoggedOutNavigation = () => {
  popuptext.innerHTML = "log in to place order";
  actionBtn.innerHTML = "log in";
  actionBtn.disabled = false;
  actionBtn.addEventListener("click", () => {
    location.href = "/login";
  }, { once: true });
};

window.addEventListener("load", async () => {
  popuptext.textContent = "checking account session";
  actionBtn.disabled = true;

  const session = await window.customerSessionReady;
  const user = session.status === "authenticated" ? session.user : null;
  if (user) {
    // means user is logged in
    popuptext.innerHTML = `log in as, ${user.name}`;
    actionBtn.innerHTML = "log out";
    actionBtn.disabled = false;
    actionBtn.addEventListener("click", async () => {
      const dataToSend = {
        email: user.email
      };
      if (user.seller) {
        dataToSend.tagsSeller = user.tagsSeller;
      }
      actionBtn.disabled = true;
      try {
        await fetch("/save-user-state", {
          method: "POST",
          headers: new Headers({ "Content-Type": "application/json" }),
          body: JSON.stringify(dataToSend)
        });
      } finally {
        try {
          await fetch("/logout", { method: "POST" });
        } finally {
          sessionStorage.clear();
          localStorage.removeItem("medusa_cart_id");
          location.replace("/");
        }
      }
    });
  } else if (session.status === "unavailable") {
    popuptext.textContent = "account temporarily unavailable";
    actionBtn.textContent = "log in";
    actionBtn.disabled = true;
  } else {
    // user is logged out
    setLoggedOutNavigation();
  }
});

// search box

const searchBtn = document.querySelector(".search-btn");
const searchBox = document.querySelector(".search-box");
// 😊
//https://chat.openai.com/chat/b061d7f5-a1b4-408e-81c1-2374afc5f7fd#:~:text=bien%20sur%2C%20voici%20comment%20vous
searchBox.addEventListener("keydown", (event) => {
  if (searchBox.value.trim().length && event.key === "Enter") {
    event.preventDefault(); // Empêche l'envoi du formulaire
    document.querySelector(".search-btn").click(); // Clique sur le bouton de recherche
  }
});

searchBtn.addEventListener("click", () => {
  const searchValue = searchBox.value.trim();

  if (searchValue.length) {
    location.href = `/search/${encodeURIComponent(searchValue)}`;
  }
});
