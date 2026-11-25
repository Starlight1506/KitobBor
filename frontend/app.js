// ================= AKKAUNTLAR VA KONFIGURATSIYA =================
const ACCOUNTS = {
  user:  { password: "1234", role: "user",  name: "Talaba #1042", badge: "NFC: 04 1A 2B 3C" },
  admin: { password: "admin123", role: "admin", name: "Kutubxonachi", badge: "Administrator" }
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const defaultBooks = [
  { id: 1, title: "Data Structures and Algorithms", author: "Thomas H. Cormen", category: "IT / Dasturlash", location: "Zal: 1 | Javon: A | Tokcha: 3", available: true },
  { id: 2, title: "Discrete Mathematics and Its Applications", author: "Kenneth H. Rosen", category: "Matematika", location: "Zal: 1 | Javon: B | Tokcha: 2", available: true },
  { id: 3, title: "Clean Code", author: "Robert C. Martin", category: "Software Engineering", location: "Zal: 2 | Javon: C | Tokcha: 1", available: true },
  { id: 4, title: "C++ Primer (5th Edition)", author: "Stanley B. Lippman", category: "IT / Dasturlash", location: "Zal: 1 | Javon: A | Tokcha: 5", available: false },
  { id: 5, title: "Computer Organization and Design", author: "David A. Patterson", category: "Arxitektura", location: "Zal: 2 | Javon: D | Tokcha: 4", available: true },
  { id: 6, title: "Calculus: Early Transcendentals", author: "James Stewart", category: "Matematika", location: "Zal: 1 | Javon: B | Tokcha: 1", available: true }
];

// State
let currentUser = JSON.parse(localStorage.getItem("kitobbor_session")) || null;
let books = JSON.parse(localStorage.getItem("kitobbor_books")) || defaultBooks;
let reservations = JSON.parse(localStorage.getItem("kitobbor_reservations")) || {};
let queues = JSON.parse(localStorage.getItem("kitobbor_queues")) || {};
let logs = JSON.parse(localStorage.getItem("kitobbor_logs")) || [
  { time: "14:20", text: "Tizim ishga tushdi. Arduino RFID-RC522 tayyor." }
];

let currentTab = "catalog";
let selectedCategory = "Barchasi";

// ================= AUTH (LOGIN / GUEST / LOGOUT) =================
function applySessionUI() {
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

  // Rolga qarab tab'larni ko'rsatish / yashirish
  const role = currentUser.role;
  document.getElementById("tabReserved").classList.toggle("hidden", role !== "user");
  document.getElementById("tabAdmin").classList.toggle("hidden", role !== "admin");

  renderCategoryChips();
  updateBadgesAndStats();

  switchTab(role === "admin" ? "admin" : "catalog");
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");

  const acc = ACCOUNTS[username];
  if (acc && acc.password === password) {
    currentUser = { username, ...acc };
    localStorage.setItem("kitobbor_session", JSON.stringify(currentUser));
    errEl.classList.add("hidden");
    e.target.reset();
    applySessionUI();
    showToast(`Xush kelibsiz, ${currentUser.name}!`);
  } else {
    errEl.classList.remove("hidden");
  }
});

function enterAsGuest() {
  currentUser = {
    username: "guest",
    role: "guest",
    name: "Mehmon",
    badge: "Parolsiz ko'rish"
  };
  localStorage.setItem("kitobbor_session", JSON.stringify(currentUser));
  applySessionUI();
  showToast("👤 Mehmon rejimida kirdingiz!");
}

function quickLogin(roleKey) {
  const acc = ACCOUNTS[roleKey];
  if (!acc) return;
  currentUser = { username: roleKey, ...acc };
  localStorage.setItem("kitobbor_session", JSON.stringify(currentUser));
  applySessionUI();
  showToast(`Xush kelibsiz, ${currentUser.name}!`);
}

function logout() {
  localStorage.removeItem("kitobbor_session");
  currentUser = null;
  applySessionUI();
  showToast("Tizimdan chiqdingiz.");
}

// ================= SAQLASH VA YORDAMCHILAR =================
function saveState() {
  localStorage.setItem("kitobbor_books", JSON.stringify(books));
  localStorage.setItem("kitobbor_reservations", JSON.stringify(reservations));
  localStorage.setItem("kitobbor_queues", JSON.stringify(queues));
  localStorage.setItem("kitobbor_logs", JSON.stringify(logs));
  updateBadgesAndStats();
}

function addLog(text) {
  const time = new Date().toTimeString().slice(0, 5);
  logs.unshift({ time, text });
  if (logs.length > 20) logs.pop();
  saveState();
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

function cleanupExpired() {
  const now = Date.now();
  let changed = false;
  for (const id in reservations) {
    if (reservations[id] <= now) {
      delete reservations[id];
      changed = true;
    }
  }
  if (changed) saveState();
}

// ================= AMALLAR =================
function reserveBook(bookId) {
  if (currentUser?.role !== "user") return;
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  reservations[bookId] = Date.now() + TWO_HOURS_MS;
  saveState();
  addLog(`${currentUser.name} "${book.title}" kitobini 2 soatga bron qildi.`);
  renderBooks();
  showToast("✅ Kitob 2 soatga bron qilindi!");
}

function cancelReservation(bookId) {
  const book = books.find((b) => b.id === bookId);
  delete reservations[bookId];
  saveState();
  if (book) addLog(`"${book.title}" broni bekor qilindi.`);
  renderBooks();
  showToast("❌ Bron bekor qilindi.");
}

function confirmNfcPickup(bookId) {
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  delete reservations[bookId];
  book.available = false;
  saveState();
  addLog(`📡 NFC TASDIQLANDI: "${book.title}" ${currentUser.name} ga berildi.`);
  renderBooks();
  showToast("📡 NFC orqali kitob muvaffaqiyatli topshirildi!");
}

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
  saveState();
  renderBooks();
}

function toggleBookAvailability(bookId) {
  if (currentUser?.role !== "admin") return;
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  book.available = !book.available;
  if (book.available) delete reservations[bookId];
  saveState();
  addLog(`Admin "${book.title}" holatini "${book.available ? "Mavjud" : "Band"}" qildi.`);
  renderBooks();
}

// ================= NAVIGATSIYA =================
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

// ================= RENDERING =================
function updateBadgesAndStats() {
  const resCount = Object.keys(reservations).length;
  document.getElementById("reservedCount").textContent = resCount;
  document.getElementById("statTotal").textContent = books.length;
  document.getElementById("statAvailable").textContent = books.filter((b) => b.available && !reservations[b.id]).length;
  document.getElementById("statReserved").textContent = resCount;
}

function renderAdminLogs() {
  const container = document.getElementById("adminLogs");
  container.innerHTML = logs
    .map((l) => `<div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5"><span class="text-xs font-mono text-slate-400 mt-0.5">${l.time}</span><span class="text-slate-700">${l.text}</span></div>`)
    .join("");
}

function renderBooks() {
  cleanupExpired();
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const statusVal = document.getElementById("statusFilter").value;
  const grid = document.getElementById("booksGrid");
  const emptyState = document.getElementById("emptyState");
  const role = currentUser?.role || "guest";

  const filtered = books.filter((book) => {
    const isReserved = Boolean(reservations[book.id]);
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

    if (currentTab === "reserved") return matchesSearch && (isReserved || isQueued);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  grid.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach((book) => {
    const expireTime = reservations[book.id];
    const isReservedByMe = Boolean(expireTime);
    const isQueuedByMe = Boolean(queues[book.id]);

    let statusBadge = `<span class="text-xs font-semibold text-emerald-600">● Mavjud</span>`;
    let actionHTML = "";

    if (role === "guest") {
      if (!book.available || isReservedByMe) {
        statusBadge = `<span class="text-xs font-semibold text-amber-600">● Band</span>`;
      }
      actionHTML = `
        <button onclick="logout()" class="mt-4 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center text-xs font-medium text-slate-600 transition">
          🔑 Bron qilish uchun Talaba sifatida kiring
        </button>
      `;
    } else if (role === "admin") {
      if (!book.available || isReservedByMe) {
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
              ⏳ <span data-timer-id="${book.id}">${formatTimeLeft(expireTime - Date.now())}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="confirmNfcPickup(${book.id})" class="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition">📡 NFC Olish</button>
              <button onclick="cancelReservation(${book.id})" class="py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition">Bekor qilish</button>
            </div>
          </div>
        `;
      } else if (!book.available) {
        statusBadge = `<span class="text-xs font-semibold text-amber-600">● Qo'lda (Band)</span>`;
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

// Yangi kitob qo'shish (Admin)
document.getElementById("addBookForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const newBook = {
    id: Date.now(),
    title: document.getElementById("newTitle").value.trim(),
    author: document.getElementById("newAuthor").value.trim(),
    category: document.getElementById("newCategory").value.trim(),
    location: `Zal: ${document.getElementById("newHall").value.trim()} | Javon: ${document.getElementById("newRack").value.trim()} | Tokcha: ${document.getElementById("newShelf").value.trim()}`,
    available: true
  };
  books.unshift(newBook);
  saveState();
  addLog(`Admin yangi kitob qo'shdi: "${newBook.title}"`);
  e.target.reset();
  renderCategoryChips();
  showToast("✅ Yangi kitob katalogga qo'shildi!");
});

setInterval(() => {
  if (!currentUser) return;
  const spans = document.querySelectorAll("[data-timer-id]");
  const now = Date.now();
  let expired = false;
  spans.forEach((span) => {
    const id = span.getAttribute("data-timer-id");
    const left = (reservations[id] || 0) - now;
    if (left <= 0) expired = true;
    else span.textContent = formatTimeLeft(left);
  });
  if (expired) renderBooks();
}, 1000);

document.getElementById("searchInput").addEventListener("input", renderBooks);

// Ishga tushirish
applySessionUI();
