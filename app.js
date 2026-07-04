const storageKey = "fluxo-financeiro-entradas-v1";
const authKey = "fluxo-financeiro-auth-v1";
const sessionKey = "fluxo-financeiro-unlocked";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

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

let entries = loadEntries();
let activeFilter = "all";
let authConfig = loadAuthConfig();

date.valueAsDate = new Date();
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

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
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
