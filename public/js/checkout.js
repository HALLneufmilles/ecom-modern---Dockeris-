// https://chat.openai.com/chat/5302a492-0415-4b2f-bfcc-4332ad660837
window.addEventListener("load", () => {
  if (!sessionStorage.user) {
    location.replace("/login");
  }

  if (location.search.includes("payment=done")) {
    let items = [];
    localStorage.setItem("cart", JSON.stringify(items));
    showAlert("order is placed", "success");
  }

  if (location.search.includes("payment_fail=true")) {
    showAlert("some error occured. Please try again");
  }
});
let validateForm = false;

const placeOrderBtn = document.querySelector(".place-order-btn");
placeOrderBtn.addEventListener("click", () => {
  let address = getAddress();
  // console.log(`validateForm : `, validateForm);

  if (validateForm) {
    fetch("/stripe-checkout", {
      method: "post",
      headers: new Headers({ "Content-Type": "application/json" }),
      // on stringify le tout
      body: JSON.stringify({
        // on récupère 'cart' en JSON
        items: JSON.parse(localStorage.getItem("cart")),
        // on récupère l'adresse
        address: address,
        // on récupère l'email en JSON
        email: JSON.parse(sessionStorage.user).email,
      }),
    })
      // on traduit la réponse en JSON
      .then((res) => res.json())
      // on traite l'url renvoyée
      .then((url) => {
        // console.log(url);
        location.href = url;
      })
      .catch((err) => console.log(err));
  }
});

// if (address) {
//   fetch("/order", {
//     method: "post",
//     headers: new Headers({ "Content-Type": "application/json" }),
//     body: JSON.stringify({
//       order: JSON.parse(localStorage.cart),
//       email: JSON.parse(sessionStorage.user).email,
//       add: address,
//     }),
//   })
//     .then((res) => res.json())
//     .then((data) => {
//       if (data.alert == "your order is placed") {
//         delete localStorage.cart;
//         showAlert(data.alert, "success");
//       } else {
//         showAlert(data.alert);
//       }
//     });
// }
// });

const getAddress = () => {
  // validation
  let address = document.querySelector("#address").value;
  let street = document.querySelector("#street").value;
  let city = document.querySelector("#city").value;
  let state = document.querySelector("#state").value;
  let pincode = document.querySelector("#pincode").value;
  let landmark = document.querySelector("#landmark").value;

  if (!address.length || !street.length || !city.length || !state.length || !pincode.length || !landmark.length) {
    return showAlert("fill all the inputs first");
  } else {
    validateForm = true;
    return { address, street, city, state, pincode, landmark };
  }
};
