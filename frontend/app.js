// ================= API KONFIGURATSIYA =================
const API_BASE = "http://127.0.0.1:8000/api";

// State (Holatlar)
let currentUser = JSON.parse(localStorage.getItem("kitobbor_session")) || null;
let books = [];
let queues = JSON.parse(localStorage.getItem("kitobbor_queues")) || {};
let logs = JSON.parse(localStorage.getItem("kitobbor_logs")) || [
  { time: new Date().toTimeString().slice(0, 5), text: "FastAPI + PostgreSQL tizimiga ulandi." }
];

let currentTab = "catalog";
let selectedCategory = "Barchasi";

// ================= AUTH (LOGIN / GUEST / LOGOUT) =================
async function performLogin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) return null;

    const user = await res.json();
    currentUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.full_name,
      badge: user.role === "admin" ? "Administrator" : (user.nfc_uid ? `NFC: ${user.nfc_uid}` : "Talaba")
    };
    localStorage.setItem("kitobbor_session", JSON.stringify(currentUser));
    return currentUser;
  } catch (err) {
    showToast("❌ Serverga ulanib bo'lmadi (FastAPI yoniqmi?)");
    return null;
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");

  const user = await performLogin(username, password);
  if (user) {
    errEl.classList.add("hidden");
    e.target.reset();
    await applySessionUI();
    showToast(`Xush kelibsiz, ${user.name}!`);
  } else {
    errEl.classList.remove("hidden");
  }
});

async function enterAsGuest() {
  currentUser = {
    id: null,
    username: "guest",
    role: "guest",
    name: "Mehmon",
    badge: "Parolsiz ko'rish"
  };
  localStorage.setItem("kitobbor_session", JSON.stringify(currentUser));
  await applySessionUI();
  showToast("👤 Mehmon rejimida kirdingiz!");
}

async function quickLogin(roleKey) {
  const creds = roleKey === "admin" ? ["admin", "admin123"] : ["user", "1234"];
  const user = await performLogin(creds[0], creds[1]);
  if (user) {
    await applySessionUI();
    showToast(`Xush kelibsiz, ${user.name}!`);
  }
}

function logout() {
  localStorage.removeItem("kitobbor_session");
  currentUser = null;
  applySessionUI();
  showToast("Tizimdan chiqdingiz.");
}

async function applySessionUI() {
  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");

  if (!currentUser) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    return;
  }

  loginView.classList.add("hidden");
  appView.classList.remove("hidden");

  document.getElementById("userDisplayName").textContent = currentUser.name;
  document.getElementById("userRoleBadge").textContent = currentUser.badge;

  const role = currentUser.role;
  document.getElementById("tabReserved").classList.toggle("hidden", role !== "user");
  document.getElementById("tabAdmin").classList.toggle("hidden", role !== "admin");

  await fetchBooks();
  switchTab(role === "admin" ? "admin" : "catalog");
}

// ================= BACKEND BILAN ALOQA (API) =================
async function fetchBooks() {
  try {
    const res = await fetch(`${API_BASE}/books`);
    if (!res.ok) throw new Error("Server xatosi");
    books = await res.json();
    renderCategoryChips();
    updateBadgesAndStats();
    renderBooks();
  } catch (err) {
    showToast("❌ Kitoblarni bazadan yuklab bo'lmadi!");
    console.error(err);
  }
}

async function reserveBook(bookId) {
  if (currentUser?.role !== "user") return;
  try {
    const res = await fetch(`${API_BASE}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUser.id, book_id: bookId })
    });
    if (!res.ok) throw new Error();
    const book = books.find((b) => b.id === bookId);
    addLog(`${currentUser.name} "${book?.title}" kitobini 2 soatga bron qildi.`);
    showToast("✅ Kitob 2 soatga bron qilindi!");
    await fetchBooks();
  } catch {
    showToast("❌ Bron qilishda xatolik yuz berdi.");
  }
}

async function cancelReservation(bookId) {
  try {
    const res = await fetch(`${API_BASE}/reserve/${bookId}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    const book = books.find((b) => b.id === bookId);
    addLog(`"${book?.title}" broni bekor qilindi.`);
    showToast("❌ Bron bekor qilindi.");
    await fetchBooks();
  } catch {
    showToast("❌ Bekor qilishda xatolik.");
  }
}

async function confirmNfcPickup(bookId) {
  try {
    const res = await fetch(`${API_BASE}/nfc/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUser.id, book_id: bookId })
    });
    if (!res.ok) throw new Error();
    const book = books.find((b) => b.id === bookId);
    addLog(`📡 NFC TASDIQLANDI: "${book?.title}" ${currentUser.name} ga berildi.`);
    showToast("📡 NFC orqali kitob muvaffaqiyatli topshirildi!");
    await fetchBooks();
  } catch {
    showToast("❌ NFC tasdiqlashda xatolik.");
  }
}

async function toggleBookAvailability(bookId) {
  if (currentUser?.role !== "admin") return;
  try {
    const res = await fetch(`${API_BASE}/books/${bookId}/toggle`, { method: "PATCH" });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    addLog(`Admin "${updated.title}" holatini "${updated.available ? "Mavjud" : "Band"}" qildi.`);
    showToast("🔄 Kitob holati yangilandi.");
    await fetchBooks();
  } catch {
    showToast("❌ Holatni o'zgartirishda xatolik.");
  }
}

document.getElementById("addBookForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById("newTitle").value.trim(),
    author: document.getElementById("newAuthor").value.trim(),
    category: document.getElementById("newCategory").value.trim(),
    location: `Zal: ${document.getElementById("newHall").value.trim()} | Javon: ${document.getElementById("newRack").value.trim()} | Tokcha: ${document.getElementById("newShelf").value.trim()}`
  };

  try {
    const res = await fetch(`${API_BASE}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error();
    addLog(`Admin yangi kitob qo'shdi: "${payload.title}"`);
    e.target.reset();
    showToast("✅ Yangi kitob PostgreSQL bazasiga qo'shildi!");
    await fetchBooks();
  } catch {
    showToast("❌ Kitob qo'shishda xatolik yuz berdi.");
  }
});

// ================= YORDAMCHI FUNKSIYALAR =================
function toggleQueue(bookId) {
  if (currentUser?.role !== "user") return;
  const book = books.find((b) => b.id === bookId);
  if (queues[bookId]) {
    delete queues[bookId];
    showToast("Navbatdan chiqdingiz.");
  } else {
    queues[bookId] = true;
    if (book) addLog(`${currentUser.name} "${book.title}" uchun navbatga yozildi.`);
    showToast("🔔 Elektron navbatga yozildingiz!");
  }
  localStorage.setItem("kitobbor_queues", JSON.stringify(queues));
  renderBooks();
}

function addLog(text) {
  const time = new Date().toTimeString().slice(0, 5);
  logs.unshift({ time, text });
  if (logs.length > 20) logs.pop();
  localStorage.setItem("kitobbor_logs", JSON.stringify(logs));
  renderAdminLogs();
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function formatTimeLeft(ms) {
  if (ms <= 0) return "00:00:00";
  const sec = Math.floor(ms / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ================= NAVIGATSIYA VA RENDER =================
function switchTab(tab) {
  currentTab = tab;
  ["catalog", "reserved", "library", "admin"].forEach((t) => {
    const btn = document.getElementById("tab" + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle("active", t === tab);
  });

  document.getElementById("catalogSection").classList.toggle("hidden", tab !== "catalog" && tab !== "reserved");
  document.getElementById("librarySection").classList.toggle("hidden", tab !== "library");
  document.getElementById("adminSection").classList.toggle("hidden", tab !== "admin");

  if (tab === "admin") {
    updateBadgesAndStats();
    renderAdminLogs();
  } else if (tab === "catalog" || tab === "reserved") {
    renderBooks();
  }
}

function selectCategory(cat) {
  selectedCategory = cat;
  renderCategoryChips();
  renderBooks();
}

function renderCategoryChips() {
  const container = document.getElementById("categoryChips");
  const categories = ["Barchasi", ...new Set(books.map((b) => b.category))];
  container.innerHTML = categories
    .map((cat) => `<button onclick="selectCategory('${cat}')" class="chip-btn ${selectedCategory === cat ? "active" : ""} px-3 py-1.5 rounded-lg text-xs font-medium transition">${cat}</button>`)
    .join("");
}

function updateBadgesAndStats() {
  const myReservedCount = books.filter((b) => b.reserved_by && b.reserved_by === currentUser?.id).length;
  const totalActiveReserved = books.filter((b) => Boolean(b.reserved_by)).length;

  document.getElementById("reservedCount").textContent = myReservedCount;
  document.getElementById("statTotal").textContent = books.length;
  document.getElementById("statAvailable").textContent = books.filter((b) => b.available && !b.reserved_by).length;
  document.getElementById("statReserved").textContent = totalActiveReserved;
}

function renderAdminLogs() {
  const container = document.getElementById("adminLogs");
  container.innerHTML = logs
    .map((l) => `<div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5"><span class="text-xs font-mono text-slate-400 mt-0.5">${l.time}</span><span class="text-slate-700">${l.text}</span></div>`)
    .join("");
}

function renderBooks() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const statusVal = document.getElementById("statusFilter").value;
  const grid = document.getElementById("booksGrid");
  const emptyState = document.getElementById("emptyState");
  const role = currentUser?.role || "guest";

  const filtered = books.filter((book) => {
    const isReserved = Boolean(book.reserved_by);
    const isReservedByMe = isReserved && book.reserved_by === currentUser?.id;
    const isQueued = Boolean(queues[book.id]);

    const matchesSearch =
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query) ||
      book.location.toLowerCase().includes(query);
    const matchesCategory = selectedCategory === "Barchasi" || book.category === selectedCategory;
    const matchesStatus =
      statusVal === "all" ||
      (statusVal === "available" && book.available && !isReserved) ||
      (statusVal === "busy" && (!book.available || isReserved));

    if (currentTab === "reserved") return matchesSearch && (isReservedByMe || isQueued);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  grid.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach((book) => {
    const isReserved = Boolean(book.reserved_by);
    const isReservedByMe = isReserved && book.reserved_by === currentUser?.id;
    const isQueuedByMe = Boolean(queues[book.id]);
    const expireMs = book.expires_at ? new Date(book.expires_at).getTime() : 0;

    let statusBadge = `<span class="text-xs font-semibold text-emerald-600">● Mavjud</span>`;
    let actionHTML = "";

    if (role === "guest") {
      if (!book.available || isReserved) {
        statusBadge = `<span class="text-xs font-semibold text-amber-600">● Band</span>`;
      }
      actionHTML = `
        <button onclick="logout()" class="mt-4 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center text-xs font-medium text-slate-600 transition">
          🔑 Bron qilish uchun Talaba sifatida kiring
        </button>
      `;
    } else if (role === "admin") {
      if (!book.available || isReserved) {
        statusBadge = `<span class="text-xs font-semibold text-amber-600">● Band</span>`;
      }
      actionHTML = `
        <button onclick="toggleBookAvailability(${book.id})" class="mt-4 w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition">
          ${book.available ? "Band deb belgilash" : "Qaytarib olish (Mavjud qilish)"}
        </button>
      `;
    } else {
      if (isReservedByMe) {
        statusBadge = `<span class="text-xs font-semibold text-blue-600">● Siz bron qildingiz</span>`;
        actionHTML = `
          <div class="mt-4 space-y-2">
            <div class="w-full py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-center text-sm font-semibold">
              ⏳ <span data-expire-ms="${expireMs}">${formatTimeLeft(expireMs - Date.now())}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="confirmNfcPickup(${book.id})" class="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition">📡 NFC Olish</button>
              <button onclick="cancelReservation(${book.id})" class="py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition">Bekor qilish</button>
            </div>
          </div>
        `;
      } else if (!book.available || isReserved) {
        statusBadge = `<span class="text-xs font-semibold text-amber-600">● Band</span>`;
        actionHTML = `
          <button onclick="toggleQueue(${book.id})" class="mt-4 w-full py-2.5 rounded-xl ${isQueuedByMe ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} text-sm font-medium transition">
            ${isQueuedByMe ? "🔔 Navbatdasiz (Bekor qilish)" : "Navbatga yozilish"}
          </button>
        `;
      } else {
        actionHTML = `
          <button onclick="reserveBook(${book.id})" class="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition">
            2 soatga bron qilish
          </button>
        `;
      }
    }

    const card = document.createElement("div");
    card.className = "book-card bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">${book.category}</span>
          ${statusBadge}
        </div>
        <h3 class="text-base font-bold text-slate-900 leading-snug">${book.title}</h3>
        <p class="text-sm text-slate-500 mt-1">${book.author}</p>
        <div class="mt-4 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs font-medium text-blue-800">
          📍 ${book.location}
        </div>
      </div>
      ${actionHTML}
    `;
    grid.appendChild(card);
  });
}

// Har soniyada taymerlarni yangilash
setInterval(() => {
  if (!currentUser) return;
  const spans = document.querySelectorAll("[data-expire-ms]");
  const now = Date.now();
  let expired = false;
  spans.forEach((span) => {
    const expireMs = Number(span.getAttribute("data-expire-ms"));
    const left = expireMs - now;
    if (left <= 0) expired = true;
    else span.textContent = formatTimeLeft(left);
  });
  if (expired) fetchBooks();
}, 1000);

document.getElementById("searchInput").addEventListener("input", renderBooks);

// Ishga tushirish
applySessionUI();
