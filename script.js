/* =========================
   THEME + FONT (persistent)
   ========================= */
const THEMES = [
  "theme-default","theme-dark","theme-pastel","theme-contrast",
  "theme-ocean","theme-forest","theme-sunset","theme-neon","theme-earth","theme-rose"
];

function applyTheme(themeClass) {
  THEMES.forEach(t => document.body.classList.remove(t));
  document.body.classList.add(themeClass);
}

function applyFont(fontValue) {
  // one global CSS variable used everywhere
  document.documentElement.style.setProperty("--note-font", fontValue);
}

function applySettingsFromStorage() {
  const theme = localStorage.getItem("theme") || "theme-default";
  const font  = localStorage.getItem("font")  || "'Poppins', sans-serif";
  applyTheme(theme);
  applyFont(font);
}

/* =========================
   SERVICE WORKER + PWA
   ========================= */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
}

/* =========================
   NOTIFICATIONS (simple)
   ========================= */
function notificationsEnabled() {
  return localStorage.getItem("notificationsEnabled") === "true";
}
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  Notification.requestPermission().then(res => console.log('Notification permission:', res));
}
function ensurePermissionIfEnabled() {
  if (notificationsEnabled()) requestNotificationPermission();
}
function sendBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: 'icon-192.png' });
  setTimeout(() => n.close(), 5000);
}

/* ===== In-app notif panel ===== */
function wireBell() {
  const btn = document.getElementById('bellBtn');
  const panel = document.getElementById('notifPanel');
  const reqBtn = document.getElementById('reqPermBtn');

  if (btn) btn.addEventListener('click', () => {
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) refreshNotificationPanel();
  });
  if (reqBtn) reqBtn.addEventListener('click', requestNotificationPermission);

  ensurePermissionIfEnabled();
}

function refreshNotificationPanel() {
  const list = document.getElementById('notifList');
  const badge = document.getElementById('bellBadge');
  if (!list || !badge) return;

  const now = Date.now();
  const tasks = getTasks().filter(t => !t.deleted && !t.done);
  const upcoming = tasks
    .map(t => ({...t, due: new Date(t.deadline).getTime()}))
    .filter(t => t.due > now && t.due - now <= 24 * 3600 * 1000) // within 24h
    .sort((a,b) => a.due - b.due);

  list.innerHTML = upcoming.length
    ? upcoming.map(t => `
      <div class="notif-item">
        <strong>${t.text}</strong>
        <div><small>Due: ${new Date(t.deadline).toLocaleString()}</small></div>
        <div><small>Category: ${t.category}</small></div>
      </div>
    `).join('')
    : '<p>No upcoming tasks within 24 hours.</p>';

  if (upcoming.length) {
    badge.hidden = false;
    badge.textContent = upcoming.length > 9 ? '9+' : String(upcoming.length);
  } else {
    badge.hidden = true;
  }
}

/* ===== Due checker (fires at due time) ===== */
let dueLoopStarted = false;
function startDueCheckLoop() {
  if (dueLoopStarted) return;
  dueLoopStarted = true;
  const notifiedKey = 'notifiedTaskIds';
  if (!localStorage.getItem(notifiedKey)) localStorage.setItem(notifiedKey, JSON.stringify([]));

  setInterval(() => {
    if (!notificationsEnabled()) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notified = new Set(JSON.parse(localStorage.getItem(notifiedKey) || '[]'));
    const now = Date.now();
    getTasks().forEach(t => {
      if (t.deleted || t.done) return;
      const due = new Date(t.deadline).getTime();
      if (!notified.has(t.id) && Math.abs(due - now) <= 30000) {
        sendBrowserNotification('Task due', `${t.text} — ${new Date(t.deadline).toLocaleString()}`);
        notified.add(t.id);
      }
    });
    localStorage.setItem(notifiedKey, JSON.stringify([...notified]));
    refreshNotificationPanel();
  }, 15000);
}

/* =========================
   STORAGE helpers
   ========================= */
function getTasks() { return JSON.parse(localStorage.getItem("tasks") || "[]"); }
function saveTasks(tasks) { localStorage.setItem("tasks", JSON.stringify(tasks)); }
function randomRotation() { return `${(Math.random() * 6 - 3).toFixed(2)}deg`; }

/* =========================
   To-Do: CRUD + UI
   ========================= */
function wireTodoPage() {
  const addBtn = document.getElementById("addTaskBtn");
  const filterSel = document.getElementById("filterCategory");
  if (addBtn) addBtn.addEventListener("click", addTaskFromForm);
  if (filterSel) filterSel.addEventListener("change", renderWall);
  renderWall();
}

function addTaskFromForm() {
  const text = (document.getElementById("taskInput")?.value || "").trim();
  const date = document.getElementById("dateInput")?.value || "";
  const time = document.getElementById("timeInput")?.value || "";
  const ampm = document.getElementById("ampmInput")?.value || "AM";
  const category = document.getElementById("categoryInput")?.value || "Other";
  const color = document.getElementById("colorInput")?.value || "#FFEB3B";

  if (!text || !date || !time) {
    alert("Enter task, date, and time.");
    return;
  }
  // time (HH:MM) + AM/PM -> 24h
  let [hh, mm] = time.split(":").map(Number);
  if (ampm === "PM" && hh < 12) hh += 12;
  if (ampm === "AM" && hh === 12) hh = 0;

  const [yyyy, mon, dd] = date.split("-").map(Number);
  const deadline = new Date(yyyy, mon - 1, dd, hh, mm, 0, 0);
  if (isNaN(deadline.getTime())) {
    alert("Invalid date/time.");
    return;
  }
  if (deadline <= new Date()) {
    alert("Deadline must be in the future.");
    return;
  }

  const tasks = getTasks();
  const task = {
    id: Date.now(),
    text,
    deadline: deadline.toISOString(),
    category,
    color,
    done: false,
    deleted: false
  };
  tasks.push(task);
  saveTasks(tasks);

  // clear form
  document.getElementById("taskInput").value = "";
  document.getElementById("dateInput").value = "";
  document.getElementById("timeInput").value = "";
  document.getElementById("ampmInput").value = "AM";
  document.getElementById("categoryInput").value = "Study";
  document.getElementById("colorInput").value = "#FFEB3B";

  renderWall();
  refreshNotificationPanel();
}

function renderWall() {
  const wall = document.getElementById("taskWall");
  if (!wall) return;
  wall.innerHTML = "";

  const filterVal = document.getElementById("filterCategory")?.value || "all";
  const tasks = getTasks().filter(t => !t.deleted);

  const filtered = filterVal === "all" ? tasks : tasks.filter(t => t.category === filterVal);

  filtered.forEach(t => {
    const note = document.createElement("div");
    note.className = "note";
    note.style.setProperty("--rotate", randomRotation());
    note.style.setProperty("--note-color", t.color);

    // overdue / soon styles
    const now = Date.now();
    const due = new Date(t.deadline).getTime();
    if (due < now) note.classList.add("overdue");
    else if (due - now < 24 * 3600 * 1000) note.classList.add("soon");
    if (t.done) note.style.opacity = 0.6;

    note.innerHTML = `
      <strong>${t.text}</strong><br>
      <small>${new Date(t.deadline).toLocaleString()}</small><br>
      <small>${t.category}</small><br>
      <div style="margin-top:.5rem;">
        <button data-action="toggle" data-id="${t.id}">${t.done ? "Undo" : "Done"}</button>
        <button data-action="delete" data-id="${t.id}">Delete</button>
      </div>
    `;

    note.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === "toggle") toggleTask(id);
      if (action === "delete") deleteTask(id);
    });

    wall.appendChild(note);
  });
}

function toggleTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveTasks(tasks);
  renderWall();
  refreshNotificationPanel();
}

function deleteTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.deleted = true;
  saveTasks(tasks);
  renderWall();
  refreshNotificationPanel();
}

/* =========================
   Recycle Bin
   ========================= */
function loadDeleted() {
  const bin = document.getElementById("deletedTasks");
  if (!bin) return;
  bin.innerHTML = "";
  const tasks = getTasks().filter(t => t.deleted);
  tasks.forEach(t => {
    const el = document.createElement("div");
    el.className = "recycle-item";
    el.innerHTML = `
      ${t.text} 
      <button data-action="restore" data-id="${t.id}">Restore</button>
      <button data-action="permadelete" data-id="${t.id}">Delete Forever</button>`;
    el.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === "restore") restoreTask(id);
      if (action === "permadelete") permanentlyDelete(id);
    });
    bin.appendChild(el);
  });
}
function restoreTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.deleted = false;
  saveTasks(tasks);
  loadDeleted();
}
function permanentlyDelete(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  loadDeleted();
}

/* =========================
   Dashboard chart (Chart.js)
   ========================= */
function renderCategoryChart() {
  const el = document.getElementById("categoryChart");
  if (!el || typeof Chart === "undefined") return;

  const tasks = getTasks().filter(t => !t.deleted);
  const counts = {};
  tasks.forEach(t => counts[t.category] = (counts[t.category] || 0) + 1);

  if (el._chart) { el._chart.destroy(); }

  el._chart = new Chart(el, {
    type: "pie",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ["#f39c12","#8e44ad","#3498db","#2ecc71","#e74c3c","#ffcc80","#ffd54f","#b0bec5"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

/* =========================
   Settings helpers (page-side)
   ========================= */
function wireSettingsPage() {
  const themeSelect = document.getElementById("themeSelect");
  const fontSelect  = document.getElementById("fontSelect");
  const notifToggle = document.getElementById("notifToggle");
  const notifStatus = document.getElementById("notifStatus");
  const saveBtn     = document.getElementById("saveBtn");

  if (!themeSelect || !fontSelect || !notifToggle || !notifStatus || !saveBtn) return;

  themeSelect.value = localStorage.getItem("theme") || "theme-default";
  fontSelect.value  = localStorage.getItem("font")  || "'Poppins', sans-serif";
  const enabled = localStorage.getItem("notificationsEnabled") === "true";
  notifToggle.checked = enabled;
  notifStatus.textContent = enabled ? "ON" : "OFF";

  themeSelect.addEventListener("change", e => applyTheme(e.target.value));
  fontSelect.addEventListener("change",  e => applyFont(e.target.value));
  notifToggle.addEventListener("change", e => {
    notifStatus.textContent = e.target.checked ? "ON" : "OFF";
    if (e.target.checked) requestNotificationPermission();
  });

  saveBtn.addEventListener("click", () => {
    localStorage.setItem("theme", themeSelect.value);
    localStorage.setItem("font",  fontSelect.value);
    localStorage.setItem("notificationsEnabled", notifToggle.checked);
    alert("Settings saved!");
    window.location.href = "home.html";
  });
}

/* =========================
   Boot per page
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  applySettingsFromStorage();
  registerServiceWorker();
  wireBell();
  refreshNotificationPanel();
  startDueCheckLoop();

  const page = document.body.getAttribute("data-page");
  if (page === "todo")       wireTodoPage();
  if (page === "recycle")    loadDeleted();
  if (page === "dashboard")  renderCategoryChart();
  if (page === "settings")   wireSettingsPage();
});
let tasks = [];

const taskInput = document.getElementById("taskInput");
const dateTimeInput = document.getElementById("dateTimeInput");
const categoryInput = document.getElementById("categoryInput");
const colorInput = document.getElementById("colorInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskWall = document.getElementById("taskWall");
const filterCategory = document.getElementById("filterCategory");
const bellBadge = document.getElementById("bellBadge");

addTaskBtn.addEventListener("click", addTask);
filterCategory.addEventListener("change", displayTasks);

function addTask() {
  const taskText = taskInput.value.trim();
  const dateTime = dateTimeInput.value;
  const category = categoryInput.value;
  const color = colorInput.value;

  if (!taskText || !dateTime) {
    alert("Please enter task and date/time");
    return;
  }

  const task = {
    id: Date.now(),
    text: taskText,
    dateTime: new Date(dateTime),
    category,
    color
  };

  tasks.push(task);
  taskInput.value = "";
  dateTimeInput.value = "";
  displayTasks();
}

function displayTasks() {
  taskWall.innerHTML = "";

  const selectedCategory = filterCategory.value;

  const filteredTasks = tasks.filter(t => selectedCategory === "all" || t.category === selectedCategory);

  filteredTasks.sort((a,b) => a.dateTime - b.dateTime);

  filteredTasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "task-card";
    card.style.borderLeft = `5px solid ${task.color}`;

    card.innerHTML = `
      <strong>${task.text}</strong>
      <p>${task.category}</p>
      <p>${task.dateTime.toLocaleString()}</p>
      <button class="deleteBtn" onclick="deleteTask(${task.id})">×</button>
    `;

    taskWall.appendChild(card);
  });

  updateNotifications();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  displayTasks();
}

function updateNotifications() {
  const now = new Date();
  const upcoming = tasks.filter(t => t.dateTime > now && t.dateTime - now <= 60*60*1000); // 1 hr
  if (upcoming.length) {
    bellBadge.hidden = false;
    bellBadge.textContent = upcoming.length;
  } else {
    bellBadge.hidden = true;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  applySettingsFromStorage();

  const fontSel = document.getElementById("fontSelector");
  if (fontSel) {
    fontSel.value = localStorage.getItem("font") || "'Poppins', sans-serif";
    fontSel.addEventListener("change", () => {
      const chosenFont = fontSel.value;
      localStorage.setItem("font", chosenFont);
      applyFont(chosenFont);
    });
  }
});



