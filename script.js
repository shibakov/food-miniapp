let API_SEARCH = "https://shibakovk.app.n8n.cloud/webhook/product_list";
let API_LOG    = "https://shibakovk.app.n8n.cloud/webhook/food_log";

let tg = window.Telegram && window.Telegram.WebApp;

if (tg) {
  tg.ready();
  if (tg.colorScheme === "dark") {
    document.body.classList.add("dark");
  }
}

let searchInput   = document.getElementById("searchInput");
let resultsDiv    = document.getElementById("results");
let selectedList  = document.getElementById("selectedList");
let counterSpan   = document.getElementById("selectedCounter");

let debounce = null;
let selectedItems = []; // {id, product, quantity}
let currentPickerItem = null;

// === Поиск продуктов ===
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();

  if (debounce) clearTimeout(debounce);

  if (!query) {
    resultsDiv.style.visibility = "hidden";
    resultsDiv.innerHTML = "";
    return;
  }

  debounce = setTimeout(() => {
    fetchProducts(query);
  }, 200);
});

async function fetchProducts(query) {
  try {
    const res = await fetch(API_SEARCH + "?query=" + encodeURIComponent(query));
    const data = await res.json();

    const products = data.products || (data[0] && data[0].products) || [];
    renderSearchResults(products);
  } catch (e) {
    resultsDiv.style.visibility = "visible";
    resultsDiv.innerHTML = '<div class="results-empty">Ошибка поиска, попробуй ещё раз</div>';
    resultsDiv.offsetHeight; // force reflow
  }
}

function renderSearchResults(products) {
  if (!products.length) {
    resultsDiv.style.visibility = "visible";
    resultsDiv.innerHTML = '<div class="results-empty">Нет совпадений</div>';
    resultsDiv.offsetHeight; // force reflow для WebApp
    return;
  }

  const html = products
    .map(p => `
      <div class="product" onclick="selectProduct('${p.product.replace(/'/g, "\\'")}')">
        <div class="product-name">${p.product}</div>
        <div class="product-add">Добавить</div>
      </div>
    `)
    .join("");

  resultsDiv.style.visibility = "visible";
  resultsDiv.innerHTML = html;
  resultsDiv.offsetHeight; // force reflow
}

// === Добавление продукта ===
window.selectProduct = function(productName) {
  const itemId = Date.now() + Math.random();

  selectedItems.push({
    id: itemId,
    product: productName,
    quantity: 0
  });

  renderSelectedList();
  resultsDiv.style.visibility = "hidden";
  resultsDiv.innerHTML = "";
  searchInput.value = "";
};

function renderSelectedList() {
  if (!selectedItems.length) {
    selectedList.innerHTML = `
      <div class="selected-list-empty">
        Пока ничего не выбрано. Найди продукт выше и добавь его в этот приём.
      </div>
    `;
    updateCounter();
    return;
  }

  selectedList.innerHTML = selectedItems
    .map(item => `
      <div class="selected-item">
        <div class="selected-row">
          <div class="selected-name">${item.product}</div>
          <div class="selected-controls">
            <div class="gram-picker-trigger ${item.quantity ? "" : "gram-picker-trigger-empty"}"
              onclick="openPicker(${item.id})">
              ${item.quantity ? (item.quantity + " г") : "граммы"}
            </div>
            <button class="remove-pill" onclick="removeItem(${item.id})">Убрать</button>
          </div>
        </div>
        <div class="small-hint">Укажи вес продукта в граммах</div>
      </div>
    `)
    .join("");

  updateCounter();
}

function updateCounter() {
  const count = selectedItems.length;
  if (!counterSpan) return;

  if (count === 0) {
    counterSpan.textContent = "0 продуктов";
  } else if (count === 1) {
    counterSpan.textContent = "1 продукт";
  } else if (count >= 2 && count <= 4) {
    counterSpan.textContent = count + " продукта";
  } else {
    counterSpan.textContent = count + " продуктов";
  }
}

window.removeItem = function(id) {
  selectedItems = selectedItems.filter(i => i.id !== id);
  renderSelectedList();
};

// === Picker граммовки ===
function openPicker(itemId) {
  currentPickerItem = selectedItems.find(i => i.id === itemId);
  if (!currentPickerItem) return;

  const wheel = document.getElementById("pickerWheel");
  wheel.innerHTML = "";

  for (let v = 10; v <= 500; v += 10) {
    const div = document.createElement("div");
    div.textContent = v + " г";
    div.style.padding = "12px";
    div.style.fontSize = "20px";
    div.style.textAlign = "center";
    div.style.scrollSnapAlign = "center";
    div.style.cursor = "pointer";
    div.style.color = (currentPickerItem.quantity === v ? "#007aff" : "#111");

    div.onclick = () => {
      currentPickerItem.quantity = v;
      renderSelectedList();
      // обновим подсветку
      Array.from(wheel.children).forEach(child => {
        child.style.color = "#111";
      });
      div.style.color = "#007aff";
    };

    wheel.appendChild(div);
  }

  const index = currentPickerItem.quantity
    ? (currentPickerItem.quantity / 10) - 1
    : 0;
  const rowHeight = 44; // примерно высота строки
  wheel.scrollTop = index * rowHeight;

  document.getElementById("pickerOverlay").style.display = "flex";
}

function closePicker() {
  document.getElementById("pickerOverlay").style.display = "none";
}

// === Сохранение в БД ===
document.getElementById("saveButton").addEventListener("click", async () => {
  if (!selectedItems.length) {
    if (tg) tg.showAlert("Добавь хотя бы один продукт");
    else alert("Добавь хотя бы один продукт");
    return;
  }

  const invalidItem = selectedItems.find(i => !i.quantity || i.quantity <= 0);

  if (invalidItem) {
    if (tg) {
      tg.showAlert(`У продукта «${invalidItem.product}» не указана граммовка`);
    } else {
      alert(`У продукта «${invalidItem.product}» не указана граммовка`);
    }
    return;
  }

  const mealType = document.getElementById("mealType").value;

  const logInfoString = selectedItems
    .map(i => JSON.stringify({ product: i.product, quantity: i.quantity }))
    .join("\n");

  const payload = {
    meal_type: mealType,
    request_type: "ready to insert",
    log_info: logInfoString
  };

  try {
    await fetch(API_LOG, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    showSuccessScreen();
  } catch (e) {
    if (tg) tg.showAlert("Ошибка при сохранении");
    else alert("Ошибка при сохранении");
  }
});

function showSuccessScreen() {
  const table = selectedItems.length
    ? selectedItems
        .map(i => `<div>${i.product} — <strong>${i.quantity} г</strong></div>`)
        .join("")
    : "<div>Без продуктов (пустой приём)</div>";

  document.getElementById("successTable").innerHTML = table;
  document.getElementById("successScreen").style.display = "flex";

  // очищаем список для следующего приёма
  selectedItems = [];
  renderSelectedList();
}

function closeSuccess() {
  if (tg) tg.close();
  else document.getElementById("successScreen").style.display = "none";
}
