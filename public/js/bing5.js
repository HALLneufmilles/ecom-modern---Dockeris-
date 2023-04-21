// const TagsSeller = ["Apple", "Apricot", "Banana", "Cherry"];
const TagsSeller = JSON.parse(sessionStorage.getItem("user")).tagsSeller;
const tagList = document.querySelector("#tagList");
const newElement = document.querySelector("#newElement");
const inputTag = document.querySelector("#inputTag");
const selected = document.querySelector("#selected");
const alphabetList = document.querySelector("#alphabetList");

let filterLetter = "";

const updateTagList = () => {
  tagList.innerHTML = "";
  for (let tag of TagsSeller) {
    if (!filterLetter || tag[0].toUpperCase() === filterLetter) {
      const li = document.createElement("li");
      li.textContent = tag;
      const span = document.createElement("span");
      span.textContent = " x";
      li.appendChild(span);
      tagList.appendChild(li);
      span.addEventListener("click", () => {
        const index = TagsSeller.indexOf(tag);
        if (index > -1) {
          TagsSeller.splice(index, 1);
          updateTagList();
        }
      });
      li.addEventListener("click", (e) => {
        if (e.target !== span) {
          selected.value += tag + ", ";
        }
      });
    }
  }
};

updateTagList();

newElement.addEventListener("click", () => {
  const newTag = inputTag.value;
  if (newTag && newTag.slice(-1) !== "s" && !newTag.includes("-")) {
    TagsSeller.push(newTag);
    updateTagList();
    inputTag.value = "";
  } else {
    alert("you must write a word that does not have the symbol '-' and does not end with the letter 's'.");
  }
});

alphabetList.addEventListener("click", (e) => {
  if (e.target.tagName === "LI") {
    filterLetter = e.target.textContent === "All" ? "" : e.target.textContent;
    updateTagList();
  }
});
