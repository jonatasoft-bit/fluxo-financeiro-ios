const storageKey = "fluxo-financeiro-entradas-v1";
const expenseStorageKey = "fluxo-financeiro-saidas-v1";
const authKey = "fluxo-financeiro-auth-v1";
const sessionKey = "fluxo-financeiro-unlocked";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const categoryLabels = {
  mercado: "Mercado",
  casa: "Casa",
  gasolina: "Gasolina",
  alimentacao: "Alimentacao",
  saude: "Saude",
  lazer: "Lazer",
  transporte: "Transporte",
  extras: "Extras"
};
const categoryColors = {
  mercado: "#1f7a54",
  casa: "#3467c9",
  gasolina: "#b15c22",
  alimentacao: "#8a5bce",
  saude: "#c14e6c",
  lazer: "#0f8b8d",
  transporte: "#6f7d1b",
  extras: "#a33a38"
};

const lockScreen = document.querySelector("#lockScreen");
const lockTitle = document.querySelector("#lockTitle");
const lockCopy = document.querySelector("#lockCopy");
const pinInput = document.querySelector("#pinInput");
const generatePinButton = document.querySelector("#generatePinButton");
const unlockButton = document.querySelector("#unlockButton");
const biometricButton = document.querySelector("#biometricButton");
const lockMessage = document.querySelector("#lockMessage");
const lockButton = document.querySelector("#lockButton");
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
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const expenseForm = document.querySelector("#expenseForm");
const expenseId = document.querySelector("#expenseId");
const expenseDescription = document.querySelector("#expenseDescription");
const expenseAmount = document.querySelector("#expenseAmount");
const expenseDate = document.querySelector("#expenseDate");
const expenseCategory = document.querySelector("#expenseCategory");
const expenseNote = document.querySelector("#expenseNote");
const expenseList = document.querySelector("#expenseList");
const expenseEmptyState = document.querySelector("#expenseEmptyState");
const expenseTemplate = document.querySelector("#expenseTemplate");
const expenseEditingBadge = document.querySelector("#expenseEditingBadge");
const cancelExpenseEdit = document.querySelector("#cancelExpenseEdit");
const exportExpensesButton = document.querySelector("#exportExpensesButton");
const expenseFilterButtons = [...document.querySelectorAll("[data-expense-filter]")];
const installmentFields = document.querySelector("#installmentFields");
const installmentCurrent = document.querySelector("#installmentCurrent");
const installmentTotal = document.querySelector("#installmentTotal");
const expenseTypeInputs = [...document.querySelectorAll('[name="expenseType"]')];
const dashboardMonth = document.querySelector("#dashboardMonth");
const dashboardSpent = document.querySelector("#dashboardSpent");
const topCategory = document.querySelector("#topCategory");
const pendingExpenses = document.querySelector("#pendingExpenses");
const categoryCount = document.querySelector("#categoryCount");
const dashboardEmpty = document.querySelector("#dashboardEmpty");
const categoryChart = document.querySelector("#categoryChart");
const statusChart = document.querySelector("#statusChart");

let entries = loadEntries();
let expenses = loadExpenses();
let activeFilter = "all";
let activeExpenseFilter = "all";
let authConfig = loadAuthConfig();

date.valueAsDate = new Date();
expenseDate.valueAsDate = new Date();
initSecurity();
render();

unlockButton.addEventListener("click", handlePinSubmit);

pinInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handlePinSubmit();
  }
});

generatePinButton.addEventListener("click", () => {
  const generatedPin = generatePin();
  pinInput.type = "text";
  pinInput.value = generatedPin;
  setLockMessage("PIN gerado. Anote em local seguro antes de continuar.");
});

biometricButton.addEventListener("click", handleBiometric);

lockButton.addEventListener("click", () => {
  sessionStorage.removeItem(sessionKey);
  lockApp();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && authConfig) {
    sessionStorage.removeItem(sessionKey);
    lockApp();
  }
});

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

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(expenseForm);
  const value = Number(expenseAmount.value);
  const type = formData.get("expenseType");

  if (!expenseDescription.value.trim() || Number.isNaN(value) || value <= 0 || !expenseDate.value) {
    return;
  }

  const payload = {
    id: expenseId.value || crypto.randomUUID(),
    description: expenseDescription.value.trim(),
    amount: value,
    date: expenseDate.value,
    category: formData.get("expenseCategory"),
    type,
    status: formData.get("expenseStatus"),
    installmentCurrent: type === "extra" ? Number(installmentCurrent.value || 1) : null,
    installmentTotal: type === "extra" ? Number(installmentTotal.value || 1) : null,
    note: expenseNote.value.trim(),
    updatedAt: new Date().toISOString()
  };

  const index = expenses.findIndex((expense) => expense.id === payload.id);
  if (index >= 0) {
    expenses[index] = payload;
  } else {
    expenses.push(payload);
  }

  saveExpenses();
  resetExpenseForm();
  render();
});

cancelExpenseEdit.addEventListener("click", resetExpenseForm);

expenseFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeExpenseFilter = button.dataset.expenseFilter;
    expenseFilterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderExpenseList();
  });
});

expenseTypeInputs.forEach((input) => {
  input.addEventListener("change", updateInstallmentVisibility);
});

exportExpensesButton.addEventListener("click", () => {
  const csv = expensesToCsv(expenses);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "saidas-financeiras.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(expenseStorageKey)) || [];
  } catch {
    return [];
  }
}

function loadAuthConfig() {
  try {
    return JSON.parse(localStorage.getItem(authKey));
  } catch {
    return null;
  }
}

function saveAuthConfig(config) {
  authConfig = config;
  localStorage.setItem(authKey, JSON.stringify(config));
}

async function initSecurity() {
  const isUnlocked = sessionStorage.getItem(sessionKey) === "yes";
  if (authConfig && isUnlocked) {
    unlockApp();
    return;
  }

  lockApp();
  updateLockMode();
}

function updateLockMode() {
  const hasPin = Boolean(authConfig?.pinHash);
  lockTitle.textContent = hasPin ? "Desbloquear Fluxo" : "Proteger Fluxo";
  lockCopy.textContent = hasPin
    ? "Digite seu PIN para ver seus valores."
    : "Crie um PIN para impedir que outras pessoas vejam seus valores neste aparelho.";
  unlockButton.textContent = hasPin ? "Desbloquear" : "Criar PIN";
  generatePinButton.hidden = hasPin;
  biometricButton.hidden = !authConfig?.credentialId;
  pinInput.value = "";
  pinInput.type = "password";
  pinInput.focus();
}

async function handlePinSubmit() {
  const pin = pinInput.value.trim();
  if (pin.length < 6) {
    setLockMessage("Use um PIN com pelo menos 6 numeros.");
    return;
  }

  if (!authConfig?.pinHash) {
    const salt = randomBase64(18);
    const pinHash = await hashPin(pin, salt);
    saveAuthConfig({ pinHash, salt, credentialId: null, createdAt: new Date().toISOString() });
    sessionStorage.setItem(sessionKey, "yes");
    unlockApp();
    setTimeout(offerBiometricSetup, 350);
    return;
  }

  const pinHash = await hashPin(pin, authConfig.salt);
  if (pinHash !== authConfig.pinHash) {
    setLockMessage("PIN incorreto.");
    pinInput.select();
    return;
  }

  sessionStorage.setItem(sessionKey, "yes");
  unlockApp();
}

async function offerBiometricSetup() {
  if (!(await canUseBiometric()) || authConfig?.credentialId) return;

  const shouldSetup = confirm("Quer ativar Face ID/Touch ID neste aparelho?");
  if (!shouldSetup) return;

  await registerBiometric();
}

async function handleBiometric() {
  if (!authConfig?.credentialId) {
    await registerBiometric();
    return;
  }

  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ id: base64ToBytes(authConfig.credentialId), type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
    sessionStorage.setItem(sessionKey, "yes");
    unlockApp();
  } catch {
    setLockMessage("Nao foi possivel desbloquear com Face ID/Touch ID.");
  }
}

async function registerBiometric() {
  if (!(await canUseBiometric())) {
    setLockMessage("Face ID/Touch ID nao esta disponivel neste navegador.");
    return;
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "Fluxo Financeiro" },
        user: {
          id: randomBytes(16),
          name: "fluxo-local",
          displayName: "Fluxo local"
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    saveAuthConfig({ ...authConfig, credentialId: bytesToBase64(new Uint8Array(credential.rawId)) });
    biometricButton.hidden = false;
    setLockMessage("Face ID/Touch ID ativado neste aparelho.");
  } catch {
    setLockMessage("Face ID/Touch ID nao foi ativado.");
  }
}

async function canUseBiometric() {
  return Boolean(
    window.PublicKeyCredential &&
    navigator.credentials &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  );
}

function lockApp() {
  document.body.classList.add("locked");
  lockScreen.removeAttribute("aria-hidden");
  if (authConfig) updateLockMode();
}

function unlockApp() {
  document.body.classList.remove("locked");
  lockScreen.setAttribute("aria-hidden", "true");
  setLockMessage("");
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64(new Uint8Array(hash));
}

function generatePin() {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => String(byte % 10)).join("");
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomBase64(length) {
  return bytesToBase64(randomBytes(length));
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function setLockMessage(message) {
  lockMessage.textContent = message;
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function saveExpenses() {
  localStorage.setItem(expenseStorageKey, JSON.stringify(expenses));
}

function render() {
  renderSummary();
  renderDashboard();
  renderList();
  renderExpenseList();
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

  const spentMonth = expenses
    .filter((expense) => {
      const expenseDateValue = fromInputDate(expense.date);
      return expense.status === "paid" && expenseDateValue.getMonth() === month && expenseDateValue.getFullYear() === year;
    })
    .reduce(sumAmounts, 0);

  const expensesThisMonth = expenses
    .filter((expense) => {
      const expenseDateValue = fromInputDate(expense.date);
      return expenseDateValue.getMonth() === month && expenseDateValue.getFullYear() === year;
    })
    .reduce(sumAmounts, 0);

  const plannedBalance = receivedMonth + futureTotal - expensesThisMonth;

  document.querySelector("#receivedMonth").textContent = money.format(receivedMonth);
  document.querySelector("#futureTotal").textContent = money.format(futureTotal);
  document.querySelector("#next30").textContent = money.format(next30);
  document.querySelector("#spentMonth").textContent = money.format(spentMonth);
  document.querySelector("#plannedBalance").textContent = money.format(plannedBalance);
}

function renderDashboard() {
  const now = new Date();
  const monthExpenses = expenses.filter((expense) => isSameMonth(expense.date, now));
  const totalSpent = monthExpenses.reduce(sumAmounts, 0);
  const paidTotal = monthExpenses
    .filter((expense) => expense.status === "paid")
    .reduce(sumAmounts, 0);
  const pendingTotal = monthExpenses
    .filter((expense) => expense.status === "pending")
    .reduce(sumAmounts, 0);
  const categoryTotals = getCategoryTotals(monthExpenses);
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const top = sortedCategories[0];

  dashboardMonth.textContent = capitalize(monthFormatter.format(now));
  dashboardSpent.textContent = money.format(totalSpent);
  pendingExpenses.textContent = money.format(pendingTotal);
  topCategory.textContent = top ? `${categoryLabels[top[0]] || "Extras"} (${money.format(top[1])})` : "Sem dados";
  categoryCount.textContent = `${sortedCategories.length} ${sortedCategories.length === 1 ? "categoria" : "categorias"}`;
  dashboardEmpty.hidden = sortedCategories.length > 0;

  categoryChart.innerHTML = "";
  sortedCategories.forEach(([category, total]) => {
    const percent = totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0;
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-row-top">
        <span class="chart-label">${categoryLabels[category] || "Extras"}</span>
        <span class="chart-value">${money.format(total)} · ${percent}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${percent}%; --bar-color: ${categoryColors[category] || categoryColors.extras}"></div>
      </div>
    `;
    categoryChart.appendChild(row);
  });

  const paidShare = totalSpent > 0 ? (paidTotal / totalSpent) * 100 : 0;
  const pendingShare = totalSpent > 0 ? (pendingTotal / totalSpent) * 100 : 0;
  statusChart.innerHTML = `
    <div class="status-track" style="--paid-share: ${paidShare}%; --pending-share: ${pendingShare}%">
      <span class="status-paid" aria-label="Pago"></span>
      <span class="status-pending" aria-label="Pendente"></span>
      <span></span>
    </div>
    <div class="status-legend">
      <span class="status-label" style="--dot-color: var(--accent)">Pago ${money.format(paidTotal)}</span>
      <span class="status-label" style="--dot-color: var(--warning)">Pendente ${money.format(pendingTotal)}</span>
    </div>
  `;
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

function renderExpenseList() {
  expenseList.innerHTML = "";

  const visibleExpenses = expenses
    .filter((expense) => activeExpenseFilter === "all" || expense.type === activeExpenseFilter)
    .sort((a, b) => a.date.localeCompare(b.date));

  expenseEmptyState.hidden = visibleExpenses.length > 0;

  visibleExpenses.forEach((expense) => {
    const node = expenseTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle("pending", expense.status === "pending");
    node.querySelector(".entry-title").textContent = expense.description;
    node.querySelector(".entry-meta").textContent = buildExpenseMeta(expense);
    node.querySelector(".entry-value").textContent = money.format(expense.amount);

    node.querySelector(".entry-main").addEventListener("click", () => editExpense(expense.id));
    node.querySelector(".delete-button").addEventListener("click", () => deleteExpense(expense.id));
    expenseList.appendChild(node);
  });
}

function buildMeta(entry) {
  const status = entry.status === "received" ? "Entrou" : "Vai entrar";
  const formattedDate = dateFormatter.format(fromInputDate(entry.date));
  return entry.note ? `${status} em ${formattedDate} · ${entry.note}` : `${status} em ${formattedDate}`;
}

function buildExpenseMeta(expense) {
  const typeLabels = {
    monthly: "Mensal",
    extra: "Parcelada",
    daily: "Diaria"
  };
  const status = expense.status === "paid" ? "Paga" : "Pendente";
  const category = categoryLabels[expense.category || "extras"] || "Extras";
  const formattedDate = dateFormatter.format(fromInputDate(expense.date));
  const installment = expense.type === "extra"
    ? ` · ${expense.installmentCurrent || 1}/${expense.installmentTotal || 1}`
    : "";
  const note = expense.note ? ` · ${expense.note}` : "";

  return `${category} · ${typeLabels[expense.type]}${installment} · ${status} em ${formattedDate}${note}`;
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

function editExpense(id) {
  const expense = expenses.find((item) => item.id === id);
  if (!expense) return;

  expenseId.value = expense.id;
  expenseDescription.value = expense.description;
  expenseAmount.value = expense.amount;
  expenseDate.value = expense.date;
  expenseCategory.value = expense.category || "extras";
  expenseNote.value = expense.note || "";
  expenseForm.querySelector(`[name="expenseType"][value="${expense.type}"]`).checked = true;
  expenseForm.querySelector(`[name="expenseStatus"][value="${expense.status}"]`).checked = true;
  installmentCurrent.value = expense.installmentCurrent || "";
  installmentTotal.value = expense.installmentTotal || "";
  updateInstallmentVisibility();
  cancelExpenseEdit.hidden = false;
  expenseEditingBadge.hidden = false;
  expenseDescription.focus();
}

function deleteEntry(id) {
  entries = entries.filter((entry) => entry.id !== id);
  saveEntries();
  if (entryId.value === id) resetForm();
  render();
}

function deleteExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  if (expenseId.value === id) resetExpenseForm();
  render();
}

function resetForm() {
  form.reset();
  entryId.value = "";
  date.valueAsDate = new Date();
  cancelEdit.hidden = true;
  editingBadge.hidden = true;
}

function resetExpenseForm() {
  expenseForm.reset();
  expenseId.value = "";
  expenseDate.valueAsDate = new Date();
  installmentCurrent.value = "";
  installmentTotal.value = "";
  updateInstallmentVisibility();
  cancelExpenseEdit.hidden = true;
  expenseEditingBadge.hidden = true;
}

function updateInstallmentVisibility() {
  const selectedType = new FormData(expenseForm).get("expenseType");
  installmentFields.hidden = selectedType !== "extra";
}

function sumAmounts(total, entry) {
  return total + Number(entry.amount);
}

function getCategoryTotals(rows) {
  return rows.reduce((totals, expense) => {
    const category = expense.category || "extras";
    totals[category] = (totals[category] || 0) + Number(expense.amount);
    return totals;
  }, {});
}

function expensesToCsv(rows) {
  const header = ["descricao", "valor", "data", "categoria", "tipo", "status", "parcela_atual", "total_parcelas", "observacao"];
  const body = rows.map((expense) => [
    expense.description,
    expense.amount,
    expense.date,
    categoryLabels[expense.category || "extras"] || "Extras",
    expense.type,
    expense.status === "paid" ? "paga" : "pendente",
    expense.installmentCurrent || "",
    expense.installmentTotal || "",
    expense.note || ""
  ]);

  return [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
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

function isSameMonth(dateValue, compareDate) {
  const dateToCheck = fromInputDate(dateValue);
  return dateToCheck.getMonth() === compareDate.getMonth() && dateToCheck.getFullYear() === compareDate.getFullYear();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
