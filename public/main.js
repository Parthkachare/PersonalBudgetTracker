// main.js — replacement (keep API_BASE correct)
let token = localStorage.getItem("token") || null;
let incomeExpenseChart = null, categoryChart = null;
const API_BASE = "http://localhost:5000";

// small helper
function fmt(n) {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString('en-IN');
}

async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (token) options.headers["Authorization"] = "Bearer " + token;
  if (options.body && !options.headers["Content-Type"]) options.headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${url}`, options);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function verifyToken() {
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, { headers: { Authorization: "Bearer " + token } });
    return res.ok;
  } catch { return false; }
}

/* ------------------------------
   Page guards & DOM refs
------------------------------- */
const isDashboard = document.querySelector(".dashboard") !== null;
const isLogin = document.getElementById("loginForm");
const isSignup = document.getElementById("signupForm");

/* ------------------------------
   LOGIN / SIGNUP (unchanged behavior)
------------------------------- */
if (isLogin) {
  verifyToken().then(valid => { if (valid) window.location.href = "dashboard.html"; });

  isLogin.onsubmit = async (e) => {
    e.preventDefault();
    const btn = isLogin.querySelector("button");
    btn.disabled = true;
    try {
      const body = { email: document.getElementById("loginEmail").value, password: document.getElementById("loginPassword").value };
      const data = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
      token = data.token;
      localStorage.setItem("token", token);
      window.location.href = "dashboard.html";
    } catch (err) {
      const msg = document.getElementById("loginMessage");
      if (msg) { msg.textContent = err.message; msg.style.display = "block"; msg.className = "message error"; }
    } finally { btn.disabled = false; }
  };
}

if (isSignup) {
  verifyToken().then(valid => { if (valid) window.location.href = "dashboard.html"; });

  isSignup.onsubmit = async (e) => {
    e.preventDefault();
    const btn = isSignup.querySelector("button");
    btn.disabled = true;
    try {
      const body = { name: document.getElementById("signupName").value, email: document.getElementById("signupEmail").value, password: document.getElementById("signupPassword").value };
      await apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(body) });
      const msg = document.getElementById("signupMessage");
      if (msg) { msg.textContent = "Signup successful — please login"; msg.style.display = "block"; msg.className = "message success"; }
      setTimeout(() => window.location.href = "index.html", 800);
    } catch (err) {
      const msg = document.getElementById("signupMessage");
      if (msg) { msg.textContent = err.message; msg.style.display = "block"; msg.className = "message error"; }
    } finally { btn.disabled = false; }
  };
}

/* ------------------------------
   DASHBOARD
------------------------------- */
if (isDashboard) {
  // DOM refs (dashboard)
  const form = document.getElementById("txnForm");
  const listDiv = document.getElementById("transactions");
  const incomeEl = document.getElementById("income");
  const expenseEl = document.getElementById("expense");
  const savingsEl = document.getElementById("savings");
  const budgetForm = document.getElementById("budgetForm");
  const budgetList = document.getElementById("budgetList");
  const budgetMonthInput = document.getElementById("budgetMonth");
  const filterCategory = document.getElementById("filterCategory");
  const filterStart = document.getElementById("filterStart");
  const filterEnd = document.getElementById("filterEnd");
  const filterKeyword = document.getElementById("filterKeyword");
  const filterBtn = document.getElementById("filterBtn");
  const exportTxns = document.getElementById("exportTxns");
  const exportBudgets = document.getElementById("exportBudgets");
  const logoutBtn = document.getElementById("logoutBtn");

  // exports
  function downloadFile(url, filename) {
    fetch(url, { headers: { Authorization: "Bearer " + token } })
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      }).catch(err => alert("Download failed: "+err.message));
  }
  if (exportTxns) exportTxns.onclick = () => downloadFile(`${API_BASE}/api/transactions/export/csv`, "transactions.csv");
  if (exportBudgets) exportBudgets.onclick = () => downloadFile(`${API_BASE}/api/budgets/export/csv`, "budgets.csv");

  // ensure logged in then load
  verifyToken().then(valid => {
    if (!valid) { localStorage.removeItem("token"); window.location.href = "index.html"; }
    else reloadAll();
  });

  // --- Summary & Charts
  async function fetchSummary() {
    const data = await apiFetch("/api/transactions/summary");
    incomeEl.textContent = fmt(data.income ?? 0);
    expenseEl.textContent = fmt(data.expense ?? 0);
    savingsEl.textContent = fmt(data.savings ?? 0);

    // Bar
    try {
      const ctx1 = document.getElementById("incomeExpenseChart").getContext("2d");
      if (incomeExpenseChart) incomeExpenseChart.destroy();
      incomeExpenseChart = new Chart(ctx1, {
        type: "bar",
        data: {
          labels: ["Income", "Expense", "Savings"],
          datasets: [{ label: "Amount", data: [data.income ?? 0, data.expense ?? 0, data.savings ?? 0], backgroundColor: ["#2ecc71","#ff6b6b","#4da6ff"] }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero:true } }
        }
      });
    } catch (err) { console.warn("bar chart failed", err); }

    // Pie
    try {
      const ctx2 = document.getElementById("categoryChart").getContext("2d");
      if (categoryChart) categoryChart.destroy();
      const labels = (data.categoryBreakdown || []).map(c => c._id);
      const values = (data.categoryBreakdown || []).map(c => c.total);
      categoryChart = new Chart(ctx2, {
        type: "pie",
        data: { labels, datasets: [{ data: values, backgroundColor: ["#3fa2ff","#ff9a5b","#b78bff","#ff6b6b","#6bd58b"] }] },
        options:{ responsive:true, maintainAspectRatio:false }
      });
    } catch (err) { console.warn("pie chart failed", err); }
  }

  // --- Transactions list
  function renderTransactions(txns) {
    listDiv.innerHTML = "";
    txns.forEach(t => {
      const div = document.createElement("div");
      div.className = "txn";
      div.innerHTML = `
        <div>
          <strong class="${t.type === 'income' ? 'income' : 'expense'}">${t.type === 'income' ? '➕' : '➖'} ₹${fmt(t.amount)}</strong>
          <div style="color:var(--muted);margin-top:6px;">${t.category} ${t.date ? ' • ' + (new Date(t.date)).toLocaleDateString() : ''}</div>
        </div>
        <div class="txn-actions">
          <button class="btn-txn-edit" data-id="${t._id}">Edit</button>
          <button class="btn-txn-delete" data-id="${t._id}">Delete</button>
        </div>`;
      listDiv.appendChild(div);
    });

    // attach handlers after elements exist
    listDiv.querySelectorAll("button.btn-txn-delete").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Delete this transaction?")) return;
        try {
          await apiFetch(`/api/transactions/${btn.dataset.id}`, { method: "DELETE" });
          await reloadAll();
        } catch (err) { alert("Delete failed: " + err.message); }
      };
    });

    listDiv.querySelectorAll("button.btn-txn-edit").forEach(btn => {
      btn.onclick = async () => {
        // fetch single txn from server to be safe
        try {
          const t = (await apiFetch("/api/transactions")).find(x => x._id === btn.dataset.id);
          if (!t) return alert("Transaction not found");
          document.getElementById("type").value = t.type;
          document.getElementById("amount").value = t.amount;
          document.getElementById("category").value = t.category;
          document.getElementById("date").value = t.date ? t.date.split("T")[0] : "";
          document.getElementById("note").value = t.note || "";
          form.dataset.editId = t._id;
          document.getElementById("add").scrollIntoView({ behavior: "smooth" });
        } catch (err) { alert("Could not load transaction: " + err.message); }
      };
    });
  }

  async function fetchList() {
    const txns = await apiFetch("/api/transactions");
    renderTransactions(txns);
  }

  // Filter button
  if (filterBtn) {
    filterBtn.onclick = async () => {
      const q = new URLSearchParams();
      if (filterCategory && filterCategory.value) q.append("category", filterCategory.value);
      if (filterStart && filterStart.value) q.append("startDate", filterStart.value);
      if (filterEnd && filterEnd.value) q.append("endDate", filterEnd.value);
      if (filterKeyword && filterKeyword.value) q.append("keyword", filterKeyword.value);
      try {
        const txns = await apiFetch(`/api/transactions/search?${q.toString()}`);
        renderTransactions(txns);
      } catch (err) { alert("Filter failed: " + err.message); }
    };
  }

  // Transaction form submit (add / edit)
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        type: document.getElementById("type").value,
        amount: parseFloat(document.getElementById("amount").value),
        category: document.getElementById("category").value,
        date: document.getElementById("date").value || new Date().toISOString(),
        note: document.getElementById("note").value || ""
      };
      try {
        if (form.dataset.editId) {
          await apiFetch(`/api/transactions/${form.dataset.editId}`, { method: "PUT", body: JSON.stringify(body) });
          delete form.dataset.editId;
        } else {
          await apiFetch("/api/transactions", { method: "POST", body: JSON.stringify(body) });
        }
        form.reset();
        await reloadAll();
      } catch (err) { alert("Save failed: " + err.message); }
    };
  }

  // --- Budgets
  async function loadBudgets(month) {
    const budgets = await apiFetch("/api/budgets/" + (month || ""));
    const txns = await apiFetch("/api/transactions");

    budgetList.innerHTML = "";
    budgets.forEach(b => {
      let spent = (typeof b.spent === "number") ? b.spent : 0;
      const [byear, bmon] = (b.month || month || "").split("-");
      if (!b.spent) {
        const computed = txns.filter(t => {
          if (!t.date) return false;
          const d = new Date(t.date);
          const matchMonth = (bmon) ? (d.getFullYear() == +byear && (d.getMonth()+1) == +bmon) : true;
          return t.type === "expense" && t.category === b.category && matchMonth;
        }).reduce((acc, t) => acc + (Number(t.amount)||0), 0);
        spent = computed;
      }

      const percent = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
      let color = 'ok', msg = '✅ Within limit';
      if (spent > b.limit) { color = 'over'; msg = '❌ Exceeded'; }
      else if (percent >= 80) { color = 'warn'; msg = '⚠️ Approaching limit'; }

      const el = document.createElement("div");
      el.className = "budget";
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${b.category}</strong>
          <small style="color:var(--muted)">${msg}</small>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);">
          <div>Limit ₹${fmt(b.limit)}</div><div>Spent ₹${fmt(spent)}</div>
        </div>
        <div class="progress"><div class="progress-bar ${color}" style="width:${percent}%"></div></div>
        <div class="budget-actions">
          <button class="btn-bud-edit" data-id="${b._id}">Edit</button>
          <button class="btn-bud-delete" data-id="${b._id}">Delete</button>
        </div>
      `;
      budgetList.appendChild(el);
    });

    // attach handlers
    budgetList.querySelectorAll("button.btn-bud-delete").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Delete this budget?")) return;
        try {
          await apiFetch(`/api/budgets/${btn.dataset.id}`, { method: "DELETE" });
          loadBudgets(month);
        } catch (err) { alert("Delete budget failed: " + err.message); }
      };
    });

    budgetList.querySelectorAll("button.btn-bud-edit").forEach(btn => {
      btn.onclick = async () => {
        const budgetsNow = await apiFetch("/api/budgets/" + (month || ""));
        const b = budgetsNow.find(x => x._id === btn.dataset.id);
        if (!b) return alert("Budget not found");
        document.getElementById("budgetCategory").value = b.category;
        document.getElementById("budgetLimit").value = b.limit;
        document.getElementById("budgetMonth").value = b.month || month;
        budgetForm.dataset.editId = b._id;
        document.getElementById("budgets").scrollIntoView({ behavior: "smooth" });
      };
    });
  }

  if (budgetForm) {
    budgetForm.onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        category: document.getElementById("budgetCategory").value,
        limit: parseFloat(document.getElementById("budgetLimit").value) || 0,
        month: document.getElementById("budgetMonth").value
      };
      try {
        if (budgetForm.dataset.editId) {
          await apiFetch(`/api/budgets/${budgetForm.dataset.editId}`, { method: "PUT", body: JSON.stringify(body) });
          delete budgetForm.dataset.editId;
        } else {
          await apiFetch("/api/budgets", { method: "POST", body: JSON.stringify(body) });
        }
        budgetForm.reset();
        if (body.month) loadBudgets(body.month); else reloadAll();
      } catch (err) { alert("Budget save failed: " + err.message); }
    };
  }

  if (budgetMonthInput) {
    budgetMonthInput.addEventListener("change", () => {
      if (budgetMonthInput.value) loadBudgets(budgetMonthInput.value);
    });
  }

  // logout
  if (logoutBtn) logoutBtn.onclick = () => {
    token = null; localStorage.removeItem("token"); window.location.href = "index.html";
  };

  // reload function
  async function reloadAll() {
    await fetchSummary();
    await fetchList();
    if (budgetMonthInput && budgetMonthInput.value) {
      await loadBudgets(budgetMonthInput.value);
    } else {
      // try to load budgets for current month by default
      const now = new Date(); const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      await loadBudgets(defaultMonth);
      if (document.getElementById("budgetMonth")) document.getElementById("budgetMonth").value = defaultMonth;
    }
  }
}
