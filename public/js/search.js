const searchKey = decodeURI(location.pathname.split("/").pop());

const searchSpanElement = document.querySelector("#search-key");
searchSpanElement.innerHTML = searchKey;

getProducts(searchKey).then((data) => createCard(data, ".card-container"));
