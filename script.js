/* =====================================================
   VISITOR MANAGEMENT SYSTEM
   FRONTEND JAVASCRIPT WITH REST API CONNECTIVITY
===================================================== */

let visitors = [];
let dashboardData = null;
let authToken = localStorage.getItem('vms_auth_token') || '';

// Escape HTML helper
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Format time from ISO
function formatTime(isoStr) {
    if (!isoStr || isoStr === '-') return '-';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return isoStr;
    }
}

// Format date from ISO
function formatDate(isoStr) {
    if (!isoStr || isoStr === '-') return '-';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return String(isoStr).slice(0, 10);
        return d.toISOString().slice(0, 10);
    } catch (e) {
        return String(isoStr).slice(0, 10);
    }
}

// Status badge helper
function getStatus(visitor) {
    const isCheckedIn = visitor.status === 'checked_in' || (visitor.checkOut === '-' && visitor.status !== 'checked_out');
    if (isCheckedIn) {
        return `<span class="status in">Checked In</span>`;
    }
    return `<span class="status out">Checked Out</span>`;
}

/* =========================
   API COMMUNICATION
========================= */

async function ensureAuth() {
    if (authToken) return authToken;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
        });
        if (res.ok) {
            const data = await res.json();
            authToken = data.access_token;
            localStorage.setItem('vms_auth_token', authToken);
        }
    } catch (err) {
        console.warn('Authentication request failed:', err);
    }
    return authToken;
}

async function apiFetch(url, options = {}) {
    let token = await ensureAuth();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        authToken = '';
        localStorage.removeItem('vms_auth_token');
        token = await ensureAuth();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            res = await fetch(url, { ...options, headers });
        }
    }
    return res;
}

async function loadAllData() {
    try {
        const [visitorsRes, dashboardRes] = await Promise.all([
            apiFetch('/api/visitors'),
            apiFetch('/api/dashboard')
        ]);

        if (visitorsRes.ok) {
            visitors = await visitorsRes.json();
        }
        if (dashboardRes.ok) {
            dashboardData = await dashboardRes.json();
        }
    } catch (err) {
        console.error('Failed to load data from API:', err);
    }

    renderAll();
}

/* =========================
   NAVIGATION
========================= */

const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.page-section');

function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });

    navItems.forEach(item => {
        item.classList.remove('active');
    });

    const selectedSection = document.getElementById(sectionId);
    const selectedNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);

    if (selectedSection) {
        selectedSection.classList.add('active');
    }

    if (selectedNav) {
        selectedNav.classList.add('active');
    }

    closeMobileMenu();

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

navItems.forEach(item => {
    item.addEventListener('click', function () {
        const sectionId = this.getAttribute('data-section');
        showSection(sectionId);
    });
});

document.querySelectorAll('[data-go]').forEach(button => {
    button.addEventListener('click', function () {
        const sectionId = this.getAttribute('data-go');
        showSection(sectionId);
    });
});

/* =========================
   DASHBOARD TABLE
========================= */

function renderDashboard() {
    const table = document.getElementById('dashboardTable');
    if (!table) return;
    table.innerHTML = '';

    const recentVisitors = (dashboardData && dashboardData.recent) ? dashboardData.recent : visitors.slice(0, 5);

    if (recentVisitors.length === 0) {
        table.innerHTML = `<tr><td colspan="6" class="empty-state">No recent visitor records.</td></tr>`;
        return;
    }

    recentVisitors.forEach(visitor => {
        const row = document.createElement('tr');
        const name = visitor.full_name || visitor.name;
        const date = formatDate(visitor.check_in_time || visitor.date);
        const checkIn = formatTime(visitor.check_in_time || visitor.checkIn);
        const checkOut = formatTime(visitor.check_out_time || visitor.checkOut);

        row.innerHTML = `
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(visitor.purpose)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(checkIn)}</td>
            <td>${escapeHtml(checkOut)}</td>
            <td>${getStatus(visitor)}</td>
        `;

        table.appendChild(row);
    });
}

/* =========================
   RECORDS TABLE
========================= */

function renderRecords(data = visitors) {
    const table = document.getElementById('recordsTable');
    if (!table) return;
    table.innerHTML = '';

    if (!data || data.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No visitor records found.
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(visitor => {
        const row = document.createElement('tr');
        const name = visitor.full_name || visitor.name;
        const date = formatDate(visitor.check_in_time || visitor.date);
        const checkIn = formatTime(visitor.check_in_time || visitor.checkIn);
        const checkOut = formatTime(visitor.check_out_time || visitor.checkOut);
        const isCheckedIn = visitor.status === 'checked_in';

        const checkoutBtn = isCheckedIn
            ? `<button class="action-button checkout-button" onclick="checkoutVisitor(${visitor.id})">Check Out</button>`
            : '';

        row.innerHTML = `
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(visitor.phone)}</td>
            <td>${escapeHtml(visitor.purpose)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(checkIn)}</td>
            <td>${escapeHtml(checkOut)}</td>
            <td>
                <div class="action-buttons">
                    ${checkoutBtn}
                    <button class="action-button edit-button" onclick="updateVisitor(${visitor.id})">
                        Update
                    </button>
                    <button class="action-button delete-button" onclick="deleteVisitor(${visitor.id})">
                        Delete
                    </button>
                </div>
            </td>
        `;

        table.appendChild(row);
    });
}

/* =========================
   VISITOR LOG
========================= */

function renderLog() {
    const table = document.getElementById('logTable');
    if (!table) return;
    table.innerHTML = '';

    if (visitors.length === 0) {
        table.innerHTML = `<tr><td colspan="5" class="empty-state">No log records found.</td></tr>`;
        return;
    }

    visitors.forEach(visitor => {
        const row = document.createElement('tr');
        const name = visitor.full_name || visitor.name;
        const date = formatDate(visitor.check_in_time || visitor.date);
        const checkIn = formatTime(visitor.check_in_time || visitor.checkIn);
        const checkOut = formatTime(visitor.check_out_time || visitor.checkOut);

        row.innerHTML = `
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(checkIn)}</td>
            <td>${escapeHtml(checkOut)}</td>
            <td>${getStatus(visitor)}</td>
        `;

        table.appendChild(row);
    });
}

/* =========================
   SUMMARY
========================= */

function updateSummary() {
    let total = visitors.length;
    let checkedIn = visitors.filter(v => v.status === 'checked_in').length;
    let checkedOut = visitors.filter(v => v.status === 'checked_out').length;
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayVisitors = visitors.filter(v => {
        const vDate = (v.check_in_time || v.created_at || v.date || '').slice(0, 10);
        return vDate === todayStr;
    }).length;

    if (dashboardData) {
        total = dashboardData.total_visitors ?? total;
        checkedIn = dashboardData.currently_inside ?? checkedIn;
        checkedOut = dashboardData.checked_out_today ?? checkedOut;
        todayVisitors = dashboardData.checked_in_today ?? todayVisitors;
    }

    const totalElem = document.getElementById('totalVisitors');
    const inElem = document.getElementById('checkedIn');
    const outElem = document.getElementById('checkedOut');
    const todayElem = document.getElementById('todayVisitors');

    if (totalElem) totalElem.textContent = total;
    if (inElem) inElem.textContent = checkedIn;
    if (outElem) outElem.textContent = checkedOut;
    if (todayElem) todayElem.textContent = todayVisitors;
}

/* =========================
   REGISTER VISITOR
========================= */

const visitorForm = document.getElementById('visitorForm');

if (visitorForm) {
    visitorForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const name = document.getElementById('visitorName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const purpose = document.getElementById('purpose').value.trim();

        const hostElem = document.getElementById('hostName');
        const host_name = hostElem && hostElem.value.trim() ? hostElem.value.trim() : 'College Staff';

        const idTypeElem = document.getElementById('idProofType');
        const id_proof_type = idTypeElem && idTypeElem.value ? idTypeElem.value : 'Aadhaar';

        const idNumElem = document.getElementById('idProofNumber');
        const id_proof_number = idNumElem && idNumElem.value.trim() ? idNumElem.value.trim() : 'N/A';

        const orgElem = document.getElementById('organization');
        const organization = orgElem ? orgElem.value.trim() : '';

        const emailElem = document.getElementById('email');
        const email = emailElem ? emailElem.value.trim() : '';

        const notesElem = document.getElementById('notes');
        const notes = notesElem ? notesElem.value.trim() : '';

        if (!/^\d{10}$/.test(phone)) {
            alert('Contact number must be exactly 10 digits.');
            return;
        }

        try {
            const res = await apiFetch('/api/visitors', {
                method: 'POST',
                body: JSON.stringify({
                    full_name: name,
                    phone,
                    purpose,
                    host_name,
                    id_proof_type,
                    id_proof_number,
                    organization,
                    email,
                    notes
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.detail || 'Failed to register visitor.');
                return;
            }

            visitorForm.reset();
            await loadAllData();
            showSection('records');
        } catch (err) {
            console.error('Error creating visitor:', err);
            alert('Failed to connect to the server.');
        }
    });
}

/* =========================
   CHECKOUT VISITOR
========================= */

async function checkoutVisitor(id) {
    try {
        const res = await apiFetch(`/api/visitors/${id}/checkout`, {
            method: 'POST'
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Failed to check out visitor.');
            return;
        }

        await loadAllData();
    } catch (err) {
        console.error('Error checking out visitor:', err);
        alert('Failed to connect to the server.');
    }
}

/* =========================
   UPDATE VISITOR
========================= */

async function updateVisitor(id) {
    const visitor = visitors.find(item => item.id === id);
    if (!visitor) return;

    const currentName = visitor.full_name || visitor.name || '';
    const currentPhone = visitor.phone || '';
    const currentPurpose = visitor.purpose || '';
    const currentHost = visitor.host_name || 'College Staff';

    const newName = prompt('Enter updated visitor name:', currentName);
    if (newName === null) return;
    if (newName.trim().length < 2) {
        alert('Visitor name must be at least 2 characters.');
        return;
    }

    const newPhone = prompt('Enter updated contact number (10 digits):', currentPhone);
    if (newPhone === null) return;
    if (!/^\d{10}$/.test(newPhone.trim())) {
        alert('Phone number must be exactly 10 digits.');
        return;
    }

    const newPurpose = prompt('Enter updated purpose:', currentPurpose);
    if (newPurpose === null) return;
    if (newPurpose.trim().length < 2) {
        alert('Purpose must be at least 2 characters.');
        return;
    }

    const newHost = prompt('Enter updated person to meet (host):', currentHost);
    if (newHost === null) return;

    try {
        const res = await apiFetch(`/api/visitors/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                full_name: newName.trim(),
                phone: newPhone.trim(),
                purpose: newPurpose.trim(),
                host_name: newHost.trim(),
                id_proof_type: visitor.id_proof_type || 'Aadhaar',
                id_proof_number: visitor.id_proof_number || '123456789012',
                organization: visitor.organization || '',
                email: visitor.email || '',
                notes: visitor.notes || ''
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Failed to update visitor.');
            return;
        }

        await loadAllData();
    } catch (err) {
        console.error('Error updating visitor:', err);
        alert('Failed to connect to the server.');
    }
}

/* =========================
   DELETE VISITOR
========================= */

async function deleteVisitor(id) {
    const visitor = visitors.find(item => item.id === id);
    if (!visitor) return;

    const name = visitor.full_name || visitor.name || 'this visitor';
    const confirmation = confirm(`Delete the visitor record for ${name}?`);
    if (!confirmation) return;

    try {
        const res = await apiFetch(`/api/visitors/${id}`, {
            method: 'DELETE'
        });

        if (!res.ok && res.status !== 204) {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Failed to delete visitor record.');
            return;
        }

        await loadAllData();
    } catch (err) {
        console.error('Error deleting visitor:', err);
        alert('Failed to connect to the server.');
    }
}

/* =========================
   RECORD SEARCH
========================= */

const recordSearch = document.getElementById('recordSearch');

if (recordSearch) {
    recordSearch.addEventListener('input', function () {
        const searchText = this.value.toLowerCase().trim();

        const filteredVisitors = visitors.filter(visitor => {
            const name = (visitor.full_name || visitor.name || '').toLowerCase();
            const phone = (visitor.phone || '').toLowerCase();
            const purpose = (visitor.purpose || '').toLowerCase();
            const host = (visitor.host_name || '').toLowerCase();
            const org = (visitor.organization || '').toLowerCase();

            return (
                name.includes(searchText) ||
                phone.includes(searchText) ||
                purpose.includes(searchText) ||
                host.includes(searchText) ||
                org.includes(searchText)
            );
        });

        renderRecords(filteredVisitors);
    });
}

/* =========================
   MAIN SEARCH
========================= */

const mainSearch = document.getElementById('mainSearch');
const searchButton = document.getElementById('searchButton');

async function performSearch() {
    if (!mainSearch) return;
    const searchText = mainSearch.value.toLowerCase().trim();
    const table = document.getElementById('searchTable');
    const resultText = document.getElementById('searchResultText');

    if (!table) return;
    table.innerHTML = '';

    if (searchText === '') {
        if (resultText) resultText.textContent = 'Enter a search term to find visitor records.';
        return;
    }

    try {
        const res = await apiFetch(`/api/visitors?q=${encodeURIComponent(searchText)}`);
        let results = [];
        if (res.ok) {
            results = await res.json();
        } else {
            results = visitors.filter(v =>
                (v.full_name || v.name || '').toLowerCase().includes(searchText) ||
                (v.phone || '').toLowerCase().includes(searchText) ||
                (v.purpose || '').toLowerCase().includes(searchText)
            );
        }

        if (resultText) resultText.textContent = `${results.length} visitor record(s) found.`;

        if (results.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        No matching visitor records found.
                    </td>
                </tr>
            `;
            return;
        }

        results.forEach(visitor => {
            const row = document.createElement('tr');
            const name = visitor.full_name || visitor.name;
            const date = formatDate(visitor.check_in_time || visitor.date);
            const checkIn = formatTime(visitor.check_in_time || visitor.checkIn);
            const checkOut = formatTime(visitor.check_out_time || visitor.checkOut);

            row.innerHTML = `
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(visitor.phone)}</td>
                <td>${escapeHtml(visitor.purpose)}</td>
                <td>${escapeHtml(date)}</td>
                <td>${escapeHtml(checkIn)}</td>
                <td>${escapeHtml(checkOut)}</td>
            `;

            table.appendChild(row);
        });
    } catch (err) {
        console.error('Search error:', err);
    }
}

if (searchButton) {
    searchButton.addEventListener('click', performSearch);
}

if (mainSearch) {
    mainSearch.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
}

/* =========================
   MOBILE SIDEBAR
========================= */

const menuButton = document.getElementById('menuButton');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

if (menuButton && sidebar && overlay) {
    menuButton.addEventListener('click', function () {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', closeMobileMenu);
}

function closeMobileMenu() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

/* =========================
   REPORTS SECTION (FR-9)
========================= */

const reportsFilterForm = document.getElementById('reportsFilterForm');
const reportDateFrom = document.getElementById('reportDateFrom');
const reportDateTo = document.getElementById('reportDateTo');

// Set default dates to today
const todayDateString = new Date().toISOString().slice(0, 10);
if (reportDateFrom && !reportDateFrom.value) reportDateFrom.value = todayDateString;
if (reportDateTo && !reportDateTo.value) reportDateTo.value = todayDateString;

async function generateReport(e) {
    if (e) e.preventDefault();
    const fromVal = reportDateFrom ? reportDateFrom.value : '';
    const toVal = reportDateTo ? reportDateTo.value : '';

    if (fromVal && toVal && fromVal > toVal) {
        alert('Date From cannot be after Date To.');
        return;
    }

    try {
        const queryParams = new URLSearchParams();
        if (fromVal) queryParams.set('date_from', fromVal);
        if (toVal) queryParams.set('date_to', toVal);

        const res = await apiFetch(`/api/reports?${queryParams.toString()}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Failed to generate report.');
            return;
        }

        const data = await res.json();
        const totalElem = document.getElementById('reportTotalVisits');
        const insideElem = document.getElementById('reportCurrentlyInside');
        const checkedOutElem = document.getElementById('reportCheckedOut');
        const tableBody = document.getElementById('reportTable');

        if (totalElem) totalElem.textContent = data.summary?.total ?? 0;
        if (insideElem) insideElem.textContent = data.summary?.currently_inside ?? 0;
        if (checkedOutElem) checkedOutElem.textContent = data.summary?.checked_out ?? 0;

        if (tableBody) {
            tableBody.innerHTML = '';
            const list = data.visitors || [];
            if (list.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No visitors found for the selected date range.</td></tr>`;
                return;
            }

            list.forEach(visitor => {
                const row = document.createElement('tr');
                const name = visitor.full_name || visitor.name;
                const checkIn = formatTime(visitor.check_in_time || visitor.checkIn);
                const checkOut = formatTime(visitor.check_out_time || visitor.checkOut);

                row.innerHTML = `
                    <td><strong>${escapeHtml(name)}</strong></td>
                    <td>${escapeHtml(visitor.phone)}</td>
                    <td>${escapeHtml(visitor.purpose)}</td>
                    <td>${escapeHtml(visitor.host_name || 'College Staff')}</td>
                    <td>${escapeHtml(checkIn)}</td>
                    <td>${escapeHtml(checkOut)}</td>
                    <td>${getStatus(visitor)}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    } catch (err) {
        console.error('Error generating report:', err);
    }
}

if (reportsFilterForm) {
    reportsFilterForm.addEventListener('submit', generateReport);
}

/* =========================
   INITIAL RENDER
========================= */

function renderAll() {
    renderDashboard();
    renderRecords();
    renderLog();
    updateSummary();
    generateReport();
}

// Make functions globally accessible for inline onclick handlers
window.updateVisitor = updateVisitor;
window.deleteVisitor = deleteVisitor;
window.checkoutVisitor = checkoutVisitor;
window.showSection = showSection;

// Start data load
loadAllData();
