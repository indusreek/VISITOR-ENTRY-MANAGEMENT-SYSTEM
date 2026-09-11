/**
 * Visitor Entry Management System (VEMS)
 * Frontend Application Script
 * Source of Truth: SRS.md & REQUIREMENTS.md
 */

// ================= CONSTANTS & DOM REFERENCES =================
const TOKEN_KEY = "vems_token";

// Views
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const sidebar = document.getElementById("sidebar");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const toastContainer = document.getElementById("toast-container");

// Forms & Modals
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const visitorDialog = document.getElementById("visitor-dialog");
const visitorForm = document.getElementById("visitor-form");
const visitorFormError = document.getElementById("visitor-form-error");
const viewDialog = document.getElementById("view-dialog");
const deleteDialog = document.getElementById("delete-dialog");

// Live Clock
const liveTimeText = document.getElementById("live-time-text");

// Page metadata
const PAGE_META = {
  dashboard: { title: "Dashboard", kicker: "OVERVIEW" },
  visitors: { title: "Visitors Directory", kicker: "DIRECTORY" },
  reports: { title: "Date-Range Reports", kicker: "ANALYTICS" },
};

// Application State
let currentUser = null;
let currentViewingVisitorId = null;
let pendingDeleteVisitorId = null;
let searchDebounceTimer = null;

// ================= AUTHENTICATION & API UTILITIES =================

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Format server error responses into user-friendly message strings
 */
function parseApiError(errorData) {
  if (!errorData) return "An unexpected error occurred. Please try again.";
  if (typeof errorData.detail === "string") return errorData.detail;
  if (Array.isArray(errorData.detail)) {
    return errorData.detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join(" • ");
  }
  return "Request could not be completed.";
}

/**
 * Core API fetch wrapper with Bearer token authentication and 401 handling
 */
async function api(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(endpoint, { ...options, headers });
  } catch (netErr) {
    throw new Error("Unable to connect to server. Please check your network or server status.");
  }

  if (response.status === 401) {
    clearToken();
    showLoginView();
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (response.status === 204) {
    return null;
  }

  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(parseApiError(responseData));
  }

  return responseData;
}

// ================= TOAST NOTIFICATIONS =================

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ================= FORMATTERS & HELPERS =================

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderStatusBadge(status) {
  const isInside = status === "checked_in";
  return `<span class="status-badge ${isInside ? "in" : "out"}">
    <span class="status-dot"></span>
    ${isInside ? "Checked in" : "Checked out"}
  </span>`;
}

function getTodayIsoDate() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function getIsoDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

// ================= VIEW TOGGLING =================

function showLoginView() {
  appView.hidden = true;
  loginView.hidden = false;
}

function showAppView() {
  loginView.hidden = true;
  appView.hidden = false;
}

function setPage(pageName) {
  // Hide all pages, show target page
  document.querySelectorAll(".page-view").forEach((view) => {
    view.hidden = view.id !== `page-${pageName}`;
    view.classList.toggle("active", view.id === `page-${pageName}`);
  });

  // Update nav links
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageName);
  });

  // Update topbar titles
  const meta = PAGE_META[pageName] || { title: "Visitor System", kicker: "PORTAL" };
  document.getElementById("page-title").textContent = meta.title;
  document.getElementById("page-kicker").textContent = meta.kicker;

  // Close mobile drawer
  closeSidebarDrawer();

  // Load data for page
  if (pageName === "dashboard") loadDashboard();
  if (pageName === "visitors") loadVisitors();
  if (pageName === "reports") {
    // If reports haven't been run yet, populate with today's report
    const fromInput = document.getElementById("report-from");
    const toInput = document.getElementById("report-to");
    if (!fromInput.value || !toInput.value) {
      fromInput.value = getTodayIsoDate();
      toInput.value = getTodayIsoDate();
      generateReport();
    }
  }
}

function openSidebarDrawer() {
  sidebar.classList.add("open");
  drawerBackdrop.hidden = false;
}

function closeSidebarDrawer() {
  sidebar.classList.remove("open");
  drawerBackdrop.hidden = true;
}

// Live Clock
function updateLiveClock() {
  const now = new Date();
  liveTimeText.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// ================= DASHBOARD (FR-8) =================

async function loadDashboard() {
  try {
    const data = await api("/api/dashboard");
    document.getElementById("stat-total").textContent = Number(data.total_visitors).toLocaleString();
    document.getElementById("stat-today").textContent = Number(data.checked_in_today).toLocaleString();
    document.getElementById("stat-inside").textContent = Number(data.currently_inside).toLocaleString();
    document.getElementById("stat-out").textContent = Number(data.checked_out_today).toLocaleString();

    renderRecentVisitsTable(data.recent || []);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderRecentVisitsTable(visitors) {
  const tbody = document.getElementById("recent-body");
  if (!visitors.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">
          <div class="empty-state-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <strong>No Recent Visits Yet</strong>
            <p>New visitor check-ins will appear here automatically.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = visitors
    .map((v) => {
      const checkoutBtn =
        v.status === "checked_in"
          ? `<button class="btn btn-sm btn-outline" data-action="checkout" data-id="${v.id}" title="Check out visitor">Check Out</button>`
          : "";

      return `
      <tr>
        <td>
          <strong>${escapeHtml(v.full_name)}</strong>
          ${v.organization ? `<div style="font-size:12px;color:var(--text-muted);">${escapeHtml(v.organization)}</div>` : ""}
        </td>
        <td>${escapeHtml(v.phone)}</td>
        <td>${escapeHtml(v.host_name)}</td>
        <td>${formatDateTime(v.check_in_time)}</td>
        <td>${renderStatusBadge(v.status)}</td>
        <td class="text-right">
          <div class="table-actions">
            ${checkoutBtn}
            <button class="btn btn-sm btn-outline" data-action="view" data-id="${v.id}">View</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// ================= VISITORS DIRECTORY (FR-2, FR-3, FR-4, FR-5, FR-6, FR-7) =================

async function loadVisitors() {
  const query = document.getElementById("search-input").value.trim();
  const status = document.getElementById("status-filter").value;
  const countEl = document.getElementById("visitors-count-text");

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);

  const queryString = params.toString();
  const url = `/api/visitors${queryString ? `?${queryString}` : ""}`;

  countEl.textContent = "Searching visitor directory…";

  try {
    const visitors = await api(url);
    const count = visitors.length;
    countEl.textContent = `Showing ${count} visitor ${count === 1 ? "record" : "records"}${
      query ? ` matching "${query}"` : ""
    }${status ? ` (${status === "checked_in" ? "Inside" : "Checked Out"})` : ""}`;

    renderVisitorsTable(visitors);
  } catch (err) {
    countEl.textContent = "Error loading visitor directory.";
    showToast(err.message, "error");
  }
}

function renderVisitorsTable(visitors) {
  const tbody = document.getElementById("visitors-body");

  if (!visitors.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">
          <div class="empty-state-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <strong>No Visitor Records Found</strong>
            <p>Try refining your search query or clear the status filter.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = visitors
    .map((v) => {
      const checkoutBtn =
        v.status === "checked_in"
          ? `<button class="btn btn-sm btn-success" data-action="checkout" data-id="${v.id}" title="Check out visitor">Check Out</button>`
          : "";

      return `
      <tr>
        <td>
          <strong>${escapeHtml(v.full_name)}</strong>
          ${v.organization ? `<div style="font-size:12px;color:var(--text-muted);">${escapeHtml(v.organization)}</div>` : ""}
        </td>
        <td>${escapeHtml(v.phone)}</td>
        <td>${escapeHtml(v.host_name)}</td>
        <td>${escapeHtml(v.purpose)}</td>
        <td>${formatDateTime(v.check_in_time)}</td>
        <td>${formatDateTime(v.check_out_time)}</td>
        <td>${renderStatusBadge(v.status)}</td>
        <td class="text-right">
          <div class="table-actions">
            ${checkoutBtn}
            <button class="btn btn-sm btn-outline" data-action="view" data-id="${v.id}" title="View Details">View</button>
            <button class="btn btn-sm btn-outline" data-action="edit" data-id="${v.id}" title="Edit Details">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${v.id}" data-name="${escapeHtml(v.full_name)}" title="Delete Record">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// ================= VISITOR FORM MODAL (CHECK-IN & EDIT) =================

function openVisitorModal(visitor = null) {
  visitorForm.reset();
  visitorFormError.hidden = true;
  visitorFormError.textContent = "";

  const titleEl = document.getElementById("dialog-title");
  const subtitleEl = document.getElementById("dialog-subtitle");
  const saveBtn = document.getElementById("save-visitor-btn");
  const idInput = document.getElementById("visitor-id");
  const charCount = document.getElementById("notes-char-count");

  if (visitor) {
    titleEl.textContent = "Edit Visitor Details";
    subtitleEl.textContent = `Update identity or visit details for #${visitor.id}`;
    saveBtn.innerHTML = `<span>Save Changes</span>`;
    idInput.value = visitor.id;

    document.getElementById("full_name").value = visitor.full_name || "";
    document.getElementById("phone").value = visitor.phone || "";
    document.getElementById("email").value = visitor.email || "";
    document.getElementById("organization").value = visitor.organization || "";
    document.getElementById("purpose").value = visitor.purpose || "";
    document.getElementById("host_name").value = visitor.host_name || "";
    document.getElementById("id_proof_type").value = visitor.id_proof_type || "Aadhaar";
    document.getElementById("id_proof_number").value = visitor.id_proof_number || "";
    document.getElementById("notes").value = visitor.notes || "";
    charCount.textContent = `${(visitor.notes || "").length} / 500`;
  } else {
    titleEl.textContent = "Register New Visitor";
    subtitleEl.textContent = "Fill in the required guest and visit details for check-in.";
    saveBtn.innerHTML = `<span>Save & Check In</span>`;
    idInput.value = "";
    document.getElementById("id_proof_type").value = "Aadhaar";
    charCount.textContent = "0 / 500";
  }

  visitorDialog.showModal();
}

function getVisitorFormData() {
  const emailVal = document.getElementById("email").value.trim();
  const orgVal = document.getElementById("organization").value.trim();
  const notesVal = document.getElementById("notes").value.trim();

  return {
    full_name: document.getElementById("full_name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: emailVal || null,
    organization: orgVal || null,
    purpose: document.getElementById("purpose").value.trim(),
    host_name: document.getElementById("host_name").value.trim(),
    id_proof_type: document.getElementById("id_proof_type").value,
    id_proof_number: document.getElementById("id_proof_number").value.trim(),
    notes: notesVal || null,
  };
}

function validateVisitorForm(data) {
  if (!data.full_name || data.full_name.length < 2 || data.full_name.length > 100) {
    return "Full name must be between 2 and 100 characters.";
  }
  if (!data.phone || !/^\d{10}$/.test(data.phone)) {
    return "Phone number must be exactly 10 digits.";
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return "Please enter a valid email address.";
  }
  if (data.organization && data.organization.length > 100) {
    return "Organization cannot exceed 100 characters.";
  }
  if (!data.purpose || data.purpose.length < 2 || data.purpose.length > 200) {
    return "Purpose of visit must be between 2 and 200 characters.";
  }
  if (!data.host_name || data.host_name.length < 2 || data.host_name.length > 100) {
    return "Person to meet (host) must be between 2 and 100 characters.";
  }
  if (!data.id_proof_type) {
    return "Please select an ID proof type.";
  }
  if (!data.id_proof_number || data.id_proof_number.length < 3 || data.id_proof_number.length > 50) {
    return "ID proof number must be between 3 and 50 characters.";
  }
  if (data.notes && data.notes.length > 500) {
    return "Notes cannot exceed 500 characters.";
  }
  return null;
}

visitorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  visitorFormError.hidden = true;
  visitorFormError.textContent = "";

  const payload = getVisitorFormData();
  const validationError = validateVisitorForm(payload);
  if (validationError) {
    visitorFormError.textContent = validationError;
    visitorFormError.hidden = false;
    return;
  }

  const saveBtn = document.getElementById("save-visitor-btn");
  const origBtnContent = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const visitorId = document.getElementById("visitor-id").value;

  try {
    if (visitorId) {
      // Update
      await api(`/api/visitors/${visitorId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast("Visitor record updated successfully");
    } else {
      // Create / Check-in
      await api("/api/visitors", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Visitor registered and checked in successfully");
    }

    visitorDialog.close();
    await loadVisitors();
    await loadDashboard();
  } catch (err) {
    visitorFormError.textContent = err.message;
    visitorFormError.hidden = false;
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = origBtnContent;
  }
});

// Enforce numeric phone input
document.getElementById("phone").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
});

// Notes character counter
document.getElementById("notes").addEventListener("input", (e) => {
  document.getElementById("notes-char-count").textContent = `${e.target.value.length} / 500`;
});

// Modal close button listeners
document.getElementById("cancel-dialog").addEventListener("click", () => visitorDialog.close());
document.getElementById("cancel-dialog-btn").addEventListener("click", () => visitorDialog.close());

// ================= VIEW VISITOR DETAILS MODAL (FR-3) =================

async function openVisitorDetails(visitorId) {
  try {
    const visitor = await api(`/api/visitors/${visitorId}`);
    currentViewingVisitorId = visitor.id;

    document.getElementById("view-visitor-name").textContent = `Visitor Record #${visitor.id}`;
    document.getElementById("view-full-name").textContent = visitor.full_name;
    document.getElementById("view-org").textContent = visitor.organization ? `Organization: ${visitor.organization}` : "Independent Guest";
    document.getElementById("view-status-pill").innerHTML = renderStatusBadge(visitor.status);

    document.getElementById("view-phone").textContent = visitor.phone;
    document.getElementById("view-email").textContent = visitor.email || "Not provided";
    document.getElementById("view-host").textContent = visitor.host_name;
    document.getElementById("view-purpose").textContent = visitor.purpose;
    document.getElementById("view-id-type").textContent = visitor.id_proof_type;
    document.getElementById("view-id-num").textContent = visitor.id_proof_number;

    document.getElementById("view-checkin").textContent = formatDateTime(visitor.check_in_time);
    document.getElementById("view-checkout").textContent = visitor.check_out_time
      ? formatDateTime(visitor.check_out_time)
      : "Currently on site (Checked in)";

    document.getElementById("view-notes").textContent = visitor.notes || "No additional notes recorded.";
    document.getElementById("view-created").textContent = formatDateTime(visitor.created_at);
    document.getElementById("view-updated").textContent = formatDateTime(visitor.updated_at);

    const checkoutBtn = document.getElementById("view-checkout-btn");
    if (visitor.status === "checked_in") {
      checkoutBtn.hidden = false;
    } else {
      checkoutBtn.hidden = true;
    }

    viewDialog.showModal();
  } catch (err) {
    showToast(err.message, "error");
  }
}

document.getElementById("close-view-dialog").addEventListener("click", () => viewDialog.close());
document.getElementById("close-view-btn").addEventListener("click", () => viewDialog.close());

document.getElementById("view-checkout-btn").addEventListener("click", async () => {
  if (!currentViewingVisitorId) return;
  try {
    await api(`/api/visitors/${currentViewingVisitorId}/checkout`, { method: "POST" });
    showToast("Visitor checked out successfully");
    viewDialog.close();
    await loadVisitors();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("view-edit-btn").addEventListener("click", async () => {
  if (!currentViewingVisitorId) return;
  try {
    const visitor = await api(`/api/visitors/${currentViewingVisitorId}`);
    viewDialog.close();
    openVisitorModal(visitor);
  } catch (err) {
    showToast(err.message, "error");
  }
});

// ================= DELETE CONFIRMATION MODAL (FR-5) =================

function promptDeleteVisitor(visitorId, visitorName) {
  pendingDeleteVisitorId = visitorId;
  document.getElementById("delete-visitor-name").textContent = visitorName || `#${visitorId}`;
  deleteDialog.showModal();
}

document.getElementById("cancel-delete-btn").addEventListener("click", () => {
  pendingDeleteVisitorId = null;
  deleteDialog.close();
});

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (!pendingDeleteVisitorId) return;
  const deleteBtn = document.getElementById("confirm-delete-btn");
  deleteBtn.disabled = true;
  deleteBtn.textContent = "Deleting…";

  try {
    await api(`/api/visitors/${pendingDeleteVisitorId}`, { method: "DELETE" });
    showToast("Visitor record permanently deleted");
    deleteDialog.close();
    pendingDeleteVisitorId = null;
    await loadVisitors();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = "Delete Permanently";
  }
});

// ================= DELEGATED TABLE ACTIONS =================

function setupTableActionDelegation(tableBodyId) {
  document.getElementById(tableBodyId).addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const name = button.dataset.name;

    if (action === "view") {
      openVisitorDetails(id);
    } else if (action === "edit") {
      try {
        const visitor = await api(`/api/visitors/${id}`);
        openVisitorModal(visitor);
      } catch (err) {
        showToast(err.message, "error");
      }
    } else if (action === "checkout") {
      try {
        await api(`/api/visitors/${id}/checkout`, { method: "POST" });
        showToast("Visitor checked out successfully");
        await loadVisitors();
        await loadDashboard();
      } catch (err) {
        showToast(err.message, "error");
      }
    } else if (action === "delete") {
      promptDeleteVisitor(id, name);
    }
  });
}

setupTableActionDelegation("recent-body");
setupTableActionDelegation("visitors-body");

// ================= SEARCH & STATUS FILTER (FR-7) =================

const searchInput = document.getElementById("search-input");
const searchClearBtn = document.getElementById("search-clear-btn");

searchInput.addEventListener("input", (e) => {
  searchClearBtn.hidden = !e.target.value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadVisitors();
  }, 250);
});

searchClearBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchClearBtn.hidden = true;
  loadVisitors();
});

document.getElementById("status-filter").addEventListener("change", () => {
  loadVisitors();
});

// ================= DATE-RANGE REPORTS (FR-9) =================

async function generateReport() {
  const dateFrom = document.getElementById("report-from").value;
  const dateTo = document.getElementById("report-to").value;

  if (!dateFrom || !dateTo) {
    showToast("Please specify both From and To dates.", "error");
    return;
  }

  if (dateFrom > dateTo) {
    showToast("From Date cannot be later than To Date.", "error");
    return;
  }

  const generateBtn = document.getElementById("generate-report-btn");
  generateBtn.disabled = true;

  try {
    const data = await api(`/api/reports?date_from=${dateFrom}&date_to=${dateTo}`);

    // Update KPIs
    document.getElementById("report-total").textContent = Number(data.summary.total).toLocaleString();
    document.getElementById("report-inside").textContent = Number(data.summary.currently_inside).toLocaleString();
    document.getElementById("report-out").textContent = Number(data.summary.checked_out).toLocaleString();

    // Update Print Metadata
    document.getElementById("report-heading").textContent = `Visit Report: ${data.date_from} to ${data.date_to}`;
    document.getElementById("report-generated-by").textContent = currentUser?.full_name || currentUser?.username || "Authorized Staff";
    document.getElementById("report-generated-at").textContent = new Date().toLocaleString();

    renderReportTable(data.visitors || []);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    generateBtn.disabled = false;
  }
}

function renderReportTable(visitors) {
  const tbody = document.getElementById("report-body");

  if (!visitors.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">
          <div class="empty-state-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <strong>No Visits Recorded in Selected Date Range</strong>
            <p>Select an alternate date range to view visitor records.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = visitors
    .map(
      (v) => `
    <tr>
      <td><strong>${escapeHtml(v.full_name)}</strong></td>
      <td>${escapeHtml(v.phone)}</td>
      <td>${escapeHtml(v.organization || "—")}</td>
      <td>${escapeHtml(v.host_name)}</td>
      <td>${escapeHtml(v.purpose)}</td>
      <td>${formatDateTime(v.check_in_time)}</td>
      <td>${formatDateTime(v.check_out_time)}</td>
      <td>${renderStatusBadge(v.status)}</td>
    </tr>`
    )
    .join("");
}

document.getElementById("report-form").addEventListener("submit", (e) => {
  e.preventDefault();
  generateReport();
});

// Quick Date Presets
document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const preset = btn.dataset.preset;
    const fromInput = document.getElementById("report-from");
    const toInput = document.getElementById("report-to");

    if (preset === "today") {
      fromInput.value = getTodayIsoDate();
      toInput.value = getTodayIsoDate();
    } else if (preset === "yesterday") {
      const yesterday = getIsoDateDaysAgo(1);
      fromInput.value = yesterday;
      toInput.value = yesterday;
    } else if (preset === "week") {
      fromInput.value = getIsoDateDaysAgo(7);
      toInput.value = getTodayIsoDate();
    } else if (preset === "month") {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const tzOffset = firstOfMonth.getTimezoneOffset() * 60000;
      fromInput.value = new Date(firstOfMonth.getTime() - tzOffset).toISOString().slice(0, 10);
      toInput.value = getTodayIsoDate();
    }

    generateReport();
  });
});

document.getElementById("print-report-btn").addEventListener("click", () => {
  window.print();
});

// ================= GENERAL BUTTON HANDLERS =================

// Add visitor buttons
document.getElementById("add-visitor-btn").addEventListener("click", () => openVisitorModal(null));
document.getElementById("quick-checkin-btn").addEventListener("click", () => openVisitorModal(null));
document.getElementById("dash-new-visitor-btn").addEventListener("click", () => openVisitorModal(null));

// Navigation buttons
document.querySelectorAll("[data-page]").forEach((el) => {
  el.addEventListener("click", () => setPage(el.dataset.page));
});

// Mobile Drawer
document.getElementById("menu-btn").addEventListener("click", openSidebarDrawer);
document.getElementById("sidebar-close-btn").addEventListener("click", closeSidebarDrawer);
drawerBackdrop.addEventListener("click", closeSidebarDrawer);

// ================= LOGIN & LOGOUT (FR-1) =================

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  loginError.textContent = "";

  const usernameInput = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");
  const submitBtn = document.getElementById("login-submit-btn");

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    loginError.textContent = "Please enter both username and password.";
    loginError.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  const origBtnHtml = submitBtn.innerHTML;
  submitBtn.textContent = "Authenticating…";

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    setToken(data.access_token);
    showToast("Signed in successfully");
    loginForm.reset();
    await initSession();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origBtnHtml;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  clearToken();
  currentUser = null;
  showToast("Logged out successfully");
  showLoginView();
});

// ================= APP INITIALIZATION =================

async function initSession() {
  try {
    currentUser = await api("/api/auth/me");

    // Populate user profile info
    const displayName = currentUser.full_name || currentUser.username;
    document.getElementById("user-display-name").textContent = displayName;
    document.getElementById("banner-user-name").textContent = displayName;

    // Generate initials for avatar
    const initials = displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    document.getElementById("user-avatar").textContent = initials || "AD";

    // Initialize report dates to today
    document.getElementById("report-from").value = getTodayIsoDate();
    document.getElementById("report-to").value = getTodayIsoDate();

    showAppView();
    setPage("dashboard");
  } catch (err) {
    clearToken();
    showLoginView();
  }
}

async function startApp() {
  if (!getToken()) {
    showLoginView();
    return;
  }
  await initSession();
}

// Start application
startApp();
