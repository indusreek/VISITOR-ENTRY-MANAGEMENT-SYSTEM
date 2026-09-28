/* =====================================================
   VISITOR MANAGEMENT SYSTEM
   FRONTEND APPLICATION SCRIPT (SRS Compliant)
===================================================== */

let visitors = [];
let dashboardData = null;
let authToken = localStorage.getItem('vms_auth_token') || '';
let currentUser = null;
let visitorPendingDeleteId = null;

// Modal Helpers
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

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

// Format full datetime
function formatDateTime(isoStr) {
    if (!isoStr || isoStr === '-') return '-';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleString();
    } catch (e) {
        return isoStr;
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

/* =====================================================
   AUTHENTICATION & API COMMUNICATION (FR-1)
===================================================== */

async function apiFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    let res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        authToken = '';
        currentUser = null;
        localStorage.removeItem('vms_auth_token');
        showLoginModal();
    }
    return res;
}

function showLoginModal() {
    const errBox = document.getElementById('loginErrorMsg');
    if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
    }
    openModal('loginModal');
}

async function verifyAuthSession() {
    if (!authToken) {
        showLoginModal();
        return false;
    }

    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            currentUser = await res.json();
            updateStaffProfileUI(currentUser);
            closeModal('loginModal');
            return true;
        } else {
            authToken = '';
            localStorage.removeItem('vms_auth_token');
            showLoginModal();
            return false;
        }
    } catch (err) {
        console.warn('Session verification error:', err);
        return false;
    }
}

function updateStaffProfileUI(user) {
    if (!user) return;
    const name = user.full_name || 'College Staff';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CS';

    const headerName = document.getElementById('headerStaffName');
    const headerRole = document.getElementById('headerStaffRole');
    const headerAvatar = document.getElementById('headerAvatar');

    const sidebarName = document.getElementById('sidebarStaffName');
    const sidebarRole = document.getElementById('sidebarStaffRole');
    const sidebarAvatar = document.getElementById('sidebarAvatar');

    if (headerName) headerName.textContent = name;
    if (headerRole) headerRole.textContent = `@${user.username || 'admin'}`;
    if (headerAvatar) headerAvatar.textContent = initials;

    if (sidebarName) sidebarName.textContent = name;
    if (sidebarRole) sidebarRole.textContent = `@${user.username || 'admin'}`;
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errBox = document.getElementById('loginErrorMsg');
        const submitBtn = document.getElementById('loginSubmitBtn');

        if (errBox) errBox.style.display = 'none';
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                const data = await res.json();
                authToken = data.access_token;
                localStorage.setItem('vms_auth_token', authToken);
                closeModal('loginModal');
                loginForm.reset();
                await verifyAuthSession();
                await loadAllData();
            } else {
                const err = await res.json().catch(() => ({}));
                if (errBox) {
                    errBox.textContent = err.detail || 'Invalid username or password';
                    errBox.style.display = 'block';
                }
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = 'Server communication error. Please try again.';
                errBox.style.display = 'block';
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Fill demo credentials
const fillDemoLink = document.getElementById('fillDemoCredentials');
if (fillDemoLink) {
    fillDemoLink.addEventListener('click', function (e) {
        e.preventDefault();
        const u = document.getElementById('loginUsername');
        const p = document.getElementById('loginPassword');
        if (u) u.value = 'admin';
        if (p) p.value = 'Admin@123';
    });
}

// Logout handlers
async function handleLogout() {
    try {
        if (authToken) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
        }
    } catch (e) {}

    authToken = '';
    currentUser = null;
    localStorage.removeItem('vms_auth_token');
    showLoginModal();
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);

/* =====================================================
   DATABASE STATUS & DIAGNOSTICS
===================================================== */

async function checkDatabaseStatus() {
    const badge = document.getElementById('dbStatusBadge');
    const textElem = document.getElementById('dbStatusText');

    try {
        const res = await fetch('/api/database/status');
        if (res.ok) {
            const data = await res.json();
            if (textElem && badge) {
                if (data.configured) {
                    textElem.textContent = `Supabase PostgreSQL (${data.total_records} records)`;
                    badge.classList.remove('fallback');
                    badge.title = `Connected to Supabase PostgreSQL at ${data.url || 'cloud'}. Click for info.`;
                } else {
                    textElem.textContent = `Local In-Memory (${data.total_records} records)`;
                    badge.classList.add('fallback');
                    badge.title = `Operating in local fallback mode. Click for Supabase connection guide.`;
                }
            }
        }
    } catch (err) {
        console.warn('Database status check error:', err);
    }
}

const dbStatusBadge = document.getElementById('dbStatusBadge');
if (dbStatusBadge) {
    dbStatusBadge.addEventListener('click', async function () {
        const detailsContainer = document.getElementById('dbStatusDetails');
        if (detailsContainer) {
            detailsContainer.innerHTML = '<p>Loading database status details...</p>';
            try {
                const res = await fetch('/api/database/status');
                const data = await res.json();
                detailsContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Current Database Engine</span>
                            <span class="detail-value"><strong>${escapeHtml(data.engine)}</strong></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value" style="color: ${data.configured ? '#16a34a' : '#2563eb'}; font-weight: 600;">
                                ${data.configured ? '● Connected & Active' : '● In-Memory / SQLite (Supabase Ready)'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Visitor Records</span>
                            <span class="detail-value">${data.total_records} record(s)</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Supabase URL</span>
                            <span class="detail-value"><code>${escapeHtml(data.url || 'Not configured in .env')}</code></span>
                        </div>
                    </div>
                `;
            } catch (err) {
                detailsContainer.innerHTML = `<p style="color: #dc2626;">Error retrieving status: ${escapeHtml(err.message)}</p>`;
            }
        }
        openModal('dbInfoModal');
    });
}

/* =====================================================
   DATA LOADING & CACHING
===================================================== */

async function loadAllData() {
    if (!authToken) return;

    try {
        const [dashRes, visRes] = await Promise.all([
            apiFetch('/api/dashboard'),
            apiFetch('/api/visitors')
        ]);

        if (dashRes && dashRes.ok) {
            dashboardData = await dashRes.json();
        }
        if (visRes && visRes.ok) {
            visitors = await visRes.json();
        }

        renderAll();
        checkDatabaseStatus();
    } catch (err) {
        console.error('Error loading data:', err);
    }
}

/* =====================================================
   NAVIGATION CONTROLLER
===================================================== */

const navItems = document.querySelectorAll('.nav-item');
const pageSections = document.querySelectorAll('.page-section');

function showSection(sectionId) {
    pageSections.forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === sectionId) {
            item.classList.add('active');
        }
    });

    closeMobileMenu();

    if (sectionId === 'reports') {
        generateReport();
    }

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

/* =====================================================
   DASHBOARD TABLE RENDERING (FR-8)
===================================================== */

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
            <td>
                <a href="#" onclick="event.preventDefault(); viewVisitor(${visitor.id})" style="font-weight: 600; color: var(--primary); text-decoration: none;">
                    ${escapeHtml(name)}
                </a>
            </td>
            <td>${escapeHtml(visitor.purpose)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(checkIn)}</td>
            <td>${escapeHtml(checkOut)}</td>
            <td>${getStatus(visitor)}</td>
        `;

        table.appendChild(row);
    });
}

/* =====================================================
   VISITOR RECORDS TABLE (FR-3, FR-4, FR-5, FR-6)
===================================================== */

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
            <td>
                <a href="#" onclick="event.preventDefault(); viewVisitor(${visitor.id})" style="font-weight: 600; color: var(--text-dark); text-decoration: none;">
                    ${escapeHtml(name)}
                </a>
            </td>
            <td>${escapeHtml(visitor.phone)}</td>
            <td>${escapeHtml(visitor.purpose)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(checkIn)}</td>
            <td>${escapeHtml(checkOut)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-button view-button" onclick="viewVisitor(${visitor.id})" title="View complete details">
                        View
                    </button>
                    ${checkoutBtn}
                    <button class="action-button edit-button" onclick="openUpdateVisitor(${visitor.id})" title="Update details">
                        Update
                    </button>
                    <button class="action-button delete-button" onclick="openDeleteVisitor(${visitor.id})" title="Delete record">
                        Delete
                    </button>
                </div>
            </td>
        `;

        table.appendChild(row);
    });
}

/* =====================================================
   VISITOR LOG TABLE
===================================================== */

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
            <td>
                <a href="#" onclick="event.preventDefault(); viewVisitor(${visitor.id})" style="font-weight: 600; color: var(--primary); text-decoration: none;">
                    ${escapeHtml(name)}
                </a>
            </td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(checkIn)}</td>
            <td>${escapeHtml(checkOut)}</td>
            <td>${getStatus(visitor)}</td>
        `;

        table.appendChild(row);
    });
}

/* =====================================================
   SUMMARY CARDS
===================================================== */

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

/* =====================================================
   SINGLE VISITOR DETAILS VIEW MODAL (FR-3)
===================================================== */

async function viewVisitor(id) {
    let visitor = visitors.find(v => v.id === id);
    if (!visitor) {
        try {
            const res = await apiFetch(`/api/visitors/${id}`);
            if (res.ok) visitor = await res.json();
        } catch (e) {}
    }

    if (!visitor) {
        alert('Visitor details could not be found.');
        return;
    }

    const detailsContainer = document.getElementById('viewVisitorDetails');
    const footerContainer = document.getElementById('viewVisitorFooter');
    if (!detailsContainer) return;

    const isCheckedIn = visitor.status === 'checked_in';

    detailsContainer.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Full Name</span>
            <span class="detail-value" style="font-size: 16px; font-weight: 700; color: var(--primary);">
                ${escapeHtml(visitor.full_name || visitor.name)}
            </span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Current Status</span>
            <span class="detail-value">${getStatus(visitor)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Phone Number</span>
            <span class="detail-value">${escapeHtml(visitor.phone)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Email Address</span>
            <span class="detail-value">${escapeHtml(visitor.email || 'None')}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Host (Person to Meet)</span>
            <span class="detail-value">${escapeHtml(visitor.host_name || 'College Staff')}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Purpose of Visit</span>
            <span class="detail-value">${escapeHtml(visitor.purpose)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Organization / Company</span>
            <span class="detail-value">${escapeHtml(visitor.organization || 'Self / Individual')}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">ID Proof Verification</span>
            <span class="detail-value">${escapeHtml(visitor.id_proof_type)}: <code>${escapeHtml(visitor.id_proof_number)}</code></span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Check-In Time</span>
            <span class="detail-value">${formatDateTime(visitor.check_in_time || visitor.created_at)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Check-Out Time</span>
            <span class="detail-value">${visitor.check_out_time ? formatDateTime(visitor.check_out_time) : 'Still Inside'}</span>
        </div>
        <div class="detail-item full-width">
            <span class="detail-label">Notes & Remarks</span>
            <span class="detail-value">${escapeHtml(visitor.notes || 'None')}</span>
        </div>
        <div class="detail-item full-width" style="margin-top: 4px; font-size: 11px; color: var(--text-light);">
            Database Record ID: #${visitor.id} | Created: ${formatDateTime(visitor.created_at)}
        </div>
    `;

    if (footerContainer) {
        const checkoutAction = isCheckedIn
            ? `<button type="button" class="btn-primary" onclick="checkoutVisitor(${visitor.id}); closeModal('viewVisitorModal');">Check Out Now</button>`
            : '';

        footerContainer.innerHTML = `
            ${checkoutAction}
            <button type="button" class="btn-secondary" onclick="closeModal('viewVisitorModal'); openUpdateVisitor(${visitor.id});">Edit Details</button>
            <button type="button" class="btn-secondary" onclick="closeModal('viewVisitorModal')">Close</button>
        `;
    }

    openModal('viewVisitorModal');
}

/* =====================================================
   REGISTER VISITOR (FR-2)
===================================================== */

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

/* =====================================================
   CHECKOUT VISITOR (FR-6)
===================================================== */

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

/* =====================================================
   UPDATE VISITOR (FR-4)
===================================================== */

function openUpdateVisitor(id) {
    const visitor = visitors.find(item => item.id === id);
    if (!visitor) return;

    document.getElementById('editVisitorId').value = visitor.id;
    document.getElementById('editVisitorName').value = visitor.full_name || visitor.name || '';
    document.getElementById('editPhone').value = visitor.phone || '';
    document.getElementById('editHostName').value = visitor.host_name || 'College Staff';
    document.getElementById('editPurpose').value = visitor.purpose || '';
    document.getElementById('editIdProofType').value = visitor.id_proof_type || 'Aadhaar';
    document.getElementById('editIdProofNumber').value = visitor.id_proof_number || '';
    document.getElementById('editOrganization').value = visitor.organization || '';
    document.getElementById('editEmail').value = visitor.email || '';
    document.getElementById('editNotes').value = visitor.notes || '';

    const errBox = document.getElementById('updateErrorMsg');
    if (errBox) errBox.style.display = 'none';

    openModal('updateVisitorModal');
}

const updateVisitorForm = document.getElementById('updateVisitorForm');
if (updateVisitorForm) {
    updateVisitorForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('editVisitorId').value;
        const errBox = document.getElementById('updateErrorMsg');
        const saveBtn = document.getElementById('saveVisitorEditBtn');

        const full_name = document.getElementById('editVisitorName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const host_name = document.getElementById('editHostName').value.trim();
        const purpose = document.getElementById('editPurpose').value.trim();
        const id_proof_type = document.getElementById('editIdProofType').value;
        const id_proof_number = document.getElementById('editIdProofNumber').value.trim();
        const organization = document.getElementById('editOrganization').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const notes = document.getElementById('editNotes').value.trim();

        if (!/^\d{10}$/.test(phone)) {
            if (errBox) {
                errBox.textContent = 'Contact number must be exactly 10 digits.';
                errBox.style.display = 'block';
            }
            return;
        }

        if (saveBtn) saveBtn.disabled = true;

        try {
            const res = await apiFetch(`/api/visitors/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    full_name,
                    phone,
                    host_name,
                    purpose,
                    id_proof_type,
                    id_proof_number,
                    organization,
                    email,
                    notes
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (errBox) {
                    errBox.textContent = err.detail || 'Failed to update visitor.';
                    errBox.style.display = 'block';
                }
                return;
            }

            closeModal('updateVisitorModal');
            await loadAllData();
        } catch (err) {
            if (errBox) {
                errBox.textContent = 'Server connection error during update.';
                errBox.style.display = 'block';
            }
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    });
}

/* =====================================================
   DELETE VISITOR (FR-5)
===================================================== */

function openDeleteVisitor(id) {
    const visitor = visitors.find(item => item.id === id);
    if (!visitor) return;

    visitorPendingDeleteId = id;
    const nameElem = document.getElementById('deleteVisitorName');
    if (nameElem) {
        nameElem.textContent = visitor.full_name || visitor.name || 'this visitor';
    }
    openModal('deleteConfirmModal');
}

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function () {
        if (!visitorPendingDeleteId) return;
        const id = visitorPendingDeleteId;
        confirmDeleteBtn.disabled = true;

        try {
            const res = await apiFetch(`/api/visitors/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok && res.status !== 204) {
                const err = await res.json().catch(() => ({}));
                alert(err.detail || 'Failed to delete visitor record.');
                return;
            }

            closeModal('deleteConfirmModal');
            visitorPendingDeleteId = null;
            await loadAllData();
        } catch (err) {
            console.error('Error deleting visitor:', err);
            alert('Failed to connect to the server.');
        } finally {
            confirmDeleteBtn.disabled = false;
        }
    });
}

/* =====================================================
   SEARCH VISITORS (FR-7)
===================================================== */

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
                (v.purpose || '').toLowerCase().includes(searchText) ||
                (v.host_name || '').toLowerCase().includes(searchText) ||
                (v.organization || '').toLowerCase().includes(searchText)
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
                <td>
                    <a href="#" onclick="event.preventDefault(); viewVisitor(${visitor.id})" style="font-weight: 600; color: var(--primary); text-decoration: none;">
                        ${escapeHtml(name)}
                    </a>
                </td>
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

/* =====================================================
   MOBILE SIDEBAR
===================================================== */

const menuButton = document.getElementById('menuButton');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

if (menuButton && sidebar && overlay) {
    menuButton.addEventListener('click', function () {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
        document.body.classList.toggle('sidebar-drawer-open');
    });

    overlay.addEventListener('click', closeMobileMenu);
}

if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileMenu);
}

// Close drawer or modals on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeMobileMenu();
        const activeModals = document.querySelectorAll('.modal-backdrop.active');
        activeModals.forEach(m => m.classList.remove('active'));
    }
});

function closeMobileMenu() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('sidebar-drawer-open');
}

/* =====================================================
   REPORTS SECTION (FR-9)
===================================================== */

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
                    <td>
                        <a href="#" onclick="event.preventDefault(); viewVisitor(${visitor.id})" style="font-weight: 700; color: var(--text-dark); text-decoration: none;">
                            ${escapeHtml(name)}
                        </a>
                    </td>
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

/* =====================================================
   INITIALIZATION
===================================================== */

function renderAll() {
    renderDashboard();
    renderRecords();
    renderLog();
    updateSummary();
    generateReport();
}

// Global function bindings
window.openModal = openModal;
window.closeModal = closeModal;
window.viewVisitor = viewVisitor;
window.openUpdateVisitor = openUpdateVisitor;
window.openDeleteVisitor = openDeleteVisitor;
window.updateVisitor = openUpdateVisitor;
window.deleteVisitor = openDeleteVisitor;
window.checkoutVisitor = checkoutVisitor;
window.showSection = showSection;

// Start session verification
(async function init() {
    const isAuthed = await verifyAuthSession();
    if (isAuthed) {
        await loadAllData();
    }
})();

/* =====================================================
   PROGRESSIVE WEB APP (PWA) CONTROLLER
   Service Worker, In-App Install Prompt, Offline State
===================================================== */

let deferredInstallPrompt = null;

function isRunningInStandalone() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://')
    );
}

function isIOSDevice() {
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function showPWAInstallButtons(show) {
    if (isRunningInStandalone()) {
        show = false;
    }
    const headerBtn = document.getElementById('pwaInstallHeaderBtn');
    const sidebarBtn = document.getElementById('pwaInstallSidebarBtn');
    if (headerBtn) {
        headerBtn.style.display = show ? 'inline-flex' : 'none';
    }
    if (sidebarBtn) {
        sidebarBtn.style.display = show ? 'flex' : 'none';
    }
}

async function triggerPWAInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('⚡ [PWA] User choice outcome:', outcome);
        if (outcome === 'accepted') {
            showPWAInstallButtons(false);
        }
        deferredInstallPrompt = null;
    } else if (isIOSDevice()) {
        openModal('pwaIOSInstallModal');
    } else {
        alert('To install VisitorMS:\n• On Chrome/Edge desktop: Click the Install icon (⬇) in the address bar.\n• On Android: Tap Menu (⋮) → "Install app" or "Add to Home screen".');
    }
}

// Attach event listeners to install buttons
const pwaHeaderBtn = document.getElementById('pwaInstallHeaderBtn');
if (pwaHeaderBtn) {
    pwaHeaderBtn.addEventListener('click', triggerPWAInstall);
}

const pwaSidebarBtn = document.getElementById('pwaInstallSidebarBtn');
if (pwaSidebarBtn) {
    pwaSidebarBtn.addEventListener('click', triggerPWAInstall);
}

// Capture Chromium install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showPWAInstallButtons(true);
    console.log('⚡ [PWA] beforeinstallprompt event captured.');
});

// App installed successfully event
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showPWAInstallButtons(false);
    console.log('⚡ [PWA] Application successfully installed.');
});

// Check initial installation and device state
if (!isRunningInStandalone()) {
    if (isIOSDevice()) {
        showPWAInstallButtons(true);
        const headerText = document.querySelector('#pwaInstallHeaderBtn .pwa-btn-text');
        if (headerText) headerText.textContent = 'Install on iOS';
    } else {
        showPWAInstallButtons(true);
    }
} else {
    showPWAInstallButtons(false);
}

// Offline / Online Connectivity Indicator
function updateOnlineStatus() {
    const banner = document.getElementById('offlineBanner');
    if (!banner) return;
    if (!navigator.onLine) {
        banner.classList.add('visible');
    } else {
        banner.classList.remove('visible');
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('⚡ [PWA] Service Worker active with scope:', registration.scope);

                // Auto update check
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('⚡ [PWA] New version installed and ready.');
                            }
                        });
                    }
                });
            })
            .catch((err) => {
                console.warn('⚡ [PWA] Service Worker registration failed:', err);
            });
    });
}
