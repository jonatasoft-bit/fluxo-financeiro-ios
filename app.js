const storageKey = "fluxo-financeiro-entradas-v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const form = document.querySelector("#entryForm");
const entryId = document.querySelector("#entryId");
const description = document.querySelector("#description");
const amount = document.querySelector("#amount");
const date = document.querySelector("#date");
const note = document.querySelector("#note");
const entryList = document.querySelector("#entryList");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#entryTemplate");
const cancelEdit = document.querySelector("#cancelEdit");
const editingBadge = document.querySelector("#editingBadge");
const exportButton = document.querySelector("#exportButton");
const seedButton = document.querySelector("#seedButton");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let entries = loadEntries();
let activeFilter = "all";

date.valueAsDate = new Date();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const selectedStatus = new FormData(form).get("status");
  const value = Number(amount.value);

  if (!description.value.trim() || Number.isNaN(value) || value <= 0 || !date.value) {
    return;
  }

  const payload = {
    id: entryId.value || crypto.randomUUID(),
    description: description.value.trim(),
    amount: value,
    date: date.value,
    status: selectedStatus,
    note: note.value.trim(),
    updatedAt: new Date().toISOString()
  };

  const index = entries.findIndex((entry) => entry.id === payload.id);
  if (index >= 0) {
    entries[index] = payload;
  } else {
    entries.push(payload);
  }

  saveEntries();
  resetForm();
  render();
});

cancelEdit.addEventListener("click", resetForm);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderList();
  });
});

exportButton.addEventListener("click", () => {
  const csv = toCsv(entries);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "entradas-financeiras.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

seedButton.addEventListener("click", () => {
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 12);

  entries.push(
    {
      id: crypto.randomUUID(),
      description: "Comissao recebida",
      amount: 3500,
      date: toInputDate(today),
      status: "received",
      note: "Exemplo",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      description: "Pagamento previsto",
      amount: 2200,
      date: toInputDate(future),
      status: "future",
      note: "Exemplo",
      updatedAt: new Date().toISOString()
    }
  );

  saveEntries();
  render();
});

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function render() {
  renderSummary();
  renderList();
}

function renderSummary() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const nextLimit = new Date();
  nextLimit.setDate(now.getDate() + 30);

  const receivedMonth = entries
    .filter((entry) => {
      const entryDate = fromInputDate(entry.date);
      return entry.status === "received" && entryDate.getMonth() === month && entryDate.getFullYear() === year;
    })
    .reduce(sumAmounts, 0);

  const futureTotal = entries
    .filter((entry) => entry.status === "future")
    .reduce(sumAmounts, 0);

  const next30 = entries
    .filter((entry) => {
      const entryDate = fromInputDate(entry.date);
      return entry.status === "future" && entryDate >= startOfDay(now) && entryDate <= nextLimit;
    })
    .reduce(sumAmounts, 0);

  document.querySelector("#receivedMonth").textContent = money.format(receivedMonth);
  document.querySelector("#futureTotal").textContent = money.format(futureTotal);
  document.querySelector("#next30").textContent = money.format(next30);
}

function renderList() {
  entryList.innerHTML = "";

  const visibleEntries = entries
    .filter((entry) => activeFilter === "all" || entry.status === activeFilter)
    .sort((a, b) => a.date.localeCompare(b.date));

  emptyState.hidden = visibleEntries.length > 0;

  visibleEntries.forEach((entry) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.toggle("future", entry.status === "future");
    node.querySelector(".entry-title").textContent = entry.description;
    node.querySelector(".entry-meta").textContent = buildMeta(entry);
    node.querySelector(".entry-value").textContent = money.format(entry.amount);

    node.querySelector(".entry-main").addEventListener("click", () => editEntry(entry.id));
    node.querySelector(".delete-button").addEventListener("click", () => deleteEntry(entry.id));
    entryList.appendChild(node);
  });
}

function buildMeta(entry) {
  const status = entry.status === "received" ? "Entrou" : "Vai entrar";
  const formattedDate = dateFormatter.format(fromInputDate(entry.date));
  return entry.note ? `${status} em ${formattedDate} · ${entry.note}` : `${status} em ${formattedDate}`;
}

function editEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  entryId.value = entry.id;
  description.value = entry.description;
  amount.value = entry.amount;
  date.value = entry.date;
  note.value = entry.note || "";
  form.querySelector(`[name="status"][value="${entry.status}"]`).checked = true;
  cancelEdit.hidden = false;
  editingBadge.hidden = false;
  description.focus();
}

function deleteEntry(id) {
  entries = entries.filter((entry) => entry.id !== id);
  saveEntries();
  if (entryId.value === id) resetForm();
  render();
}

function resetForm() {
  form.reset();
  entryId.value = "";
  date.valueAsDate = new Date();
  cancelEdit.hidden = true;
  editingBadge.hidden = true;
}

function sumAmounts(total, entry) {
  return total + Number(entry.amount);
}

function toCsv(rows) {
  const header = ["descricao", "valor", "data", "status", "observacao"];
  const body = rows.map((entry) => [
    entry.description,
    entry.amount,
    entry.date,
    entry.status === "received" ? "entrou" : "vai entrar",
    entry.note || ""
  ]);

  return [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function fromInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
