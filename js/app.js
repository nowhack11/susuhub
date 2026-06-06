// ========== DATA STORE (localStorage) ==========
const DB = {
  users: JSON.parse(localStorage.getItem('susu_users') || '[]'),
  currentUser: JSON.parse(localStorage.getItem('susu_currentUser') || 'null'),
  savings: JSON.parse(localStorage.getItem('susu_savings') || '[]'),
  transactions: JSON.parse(localStorage.getItem('susu_transactions') || '[]'),
  withdrawals: JSON.parse(localStorage.getItem('susu_withdrawals') || '[]'),
  complaints: JSON.parse(localStorage.getItem('susu_complaints') || '[]'),
  settings: JSON.parse(localStorage.getItem('susu_settings') || '{"fee":3,"minDep":2,"maxDep":100,"procTime":24}'),
  auditLogs: JSON.parse(localStorage.getItem('susu_auditLogs') || '[]'),
  announcements: JSON.parse(localStorage.getItem('susu_announcements') || '[]')
};

function save() {
  Object.keys(DB).forEach(key => {
    localStorage.setItem('susu_' + key, JSON.stringify(DB[key]));
  });
}

// Seed admin if not exists
if (!DB.users.find(u => u.phone === 'admin')) {
  DB.users.push({
    name: 'Super Admin',
    phone: 'admin',
    pin: '1234',
    role: 'admin',
    email: '',
    momo: '',
    notifications: { deposit: true, withdrawal: true, reminder: true, complaint: true }
  });
  save();
}

// Set default settings if missing
if (!localStorage.getItem('susu_settings')) {
  DB.settings = { fee: 3, minDep: 2, maxDep: 100, procTime: 24 };
  save();
}

// ========== NAVIGATION ==========
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');

  // update dynamic content
  if (screenId === 'dashboard-screen') updateDashboard();
  if (screenId === 'savings-screen') renderSavings();
  if (screenId === 'transactions-screen') renderTransactions();
  if (screenId === 'withdrawals-screen') updateWithdrawalScreen();
  if (screenId === 'complaints-screen') renderComplaints();
  if (screenId === 'profile-screen') updateProfile();
  if (screenId === 'admin-dashboard-screen') updateAdminDashboard();
  if (screenId === 'admin-users-screen') renderAdminUsers();
  if (screenId === 'admin-withdrawals-screen') renderAdminWithdrawals();
  if (screenId === 'admin-complaints-screen') renderAdminComplaints();
  if (screenId === 'admin-settings-screen') populateSettings();
  if (screenId === 'admin-logs-screen') renderAuditLogs();

  // Update bottom nav active class
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.textContent.includes('Home') && screenId === 'dashboard-screen') el.classList.add('active');
    else if (el.textContent.includes('Savings') && screenId === 'savings-screen') el.classList.add('active');
    else if (el.textContent.includes('Transactions') && screenId === 'transactions-screen') el.classList.add('active');
    else if (el.textContent.includes('Complaints') && screenId === 'complaints-screen') el.classList.add('active');
    else if (el.textContent.includes('Profile') && screenId === 'profile-screen') el.classList.add('active');
    else el.classList.remove('active');
  });
}

function goBack() {
  if (!DB.currentUser) return navigateTo('welcome-screen');
  if (DB.currentUser.role === 'admin') navigateTo('admin-dashboard-screen');
  else navigateTo('dashboard-screen');
}

// ========== AUTH ==========
function handleLogin() {
  const phone = document.getElementById('login-phone').value.trim();
  if (!phone) return alert('Phone number required');
  const user = DB.users.find(u => u.phone === phone);
  if (!user) return alert('Phone not registered. Please sign up (demo: register via admin or code).');
  // Simulate sending OTP
  sessionStorage.setItem('otp_phone', phone);
  navigateTo('otp-screen');
}

function handleOTP() {
  const otp = document.getElementById('otp-input').value.trim();
  if (otp !== '123456') return alert('Invalid OTP. Demo OTP: 123456');
  const phone = sessionStorage.getItem('otp_phone');
  const user = DB.users.find(u => u.phone === phone);
  if (!user) return alert('User not found');
  DB.currentUser = user;
  save();
  if (user.role === 'admin') navigateTo('admin-dashboard-screen');
  else if (!user.name || user.name.trim() === '') navigateTo('profile-setup-screen');
  else navigateTo('dashboard-screen');
  document.getElementById('otp-input').value = '';
}

function resendOTP() {
  alert('OTP resent (demo: 123456)');
}

function logout() {
  DB.currentUser = null;
  save();
  navigateTo('welcome-screen');
}

// ========== PROFILE SETUP (after OTP) ==========
function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const momo = document.getElementById('profile-momo').value.trim();
  if (!name || !momo) return alert('Name and Mobile Money number required');
  DB.currentUser.name = name;
  DB.currentUser.email = email;
  DB.currentUser.momo = momo;
  // update in users array
  const idx = DB.users.findIndex(u => u.phone === DB.currentUser.phone);
  if (idx >= 0) DB.users[idx] = { ...DB.users[idx], name, email, momo };
  save();
  navigateTo('dashboard-screen');
}

// pre-fill phone
document.addEventListener('DOMContentLoaded', () => {
  if (DB.currentUser) {
    if (DB.currentUser.role === 'admin') navigateTo('admin-dashboard-screen');
    else navigateTo('dashboard-screen');
  } else {
    navigateTo('welcome-screen');
  }
});

// ========== DASHBOARD ==========
function updateDashboard() {
  if (!DB.currentUser) return;
  const userPlans = DB.savings.filter(p => p.userPhone === DB.currentUser.phone && p.active);
  const totalSaved = userPlans.reduce((sum, p) => sum + p.totalDeposited, 0);
  document.getElementById('total-saved').textContent = `GHS ${totalSaved}`;
  document.getElementById('active-plans-count').textContent = userPlans.length;

  // Next maturity
  const maturities = userPlans.map(p => new Date(p.maturityDate)).filter(d => d > new Date());
  if (maturities.length) {
    const next = new Date(Math.min(...maturities));
    document.getElementById('next-maturity').textContent = next.toLocaleDateString();
  } else {
    document.getElementById('next-maturity').textContent = '—';
  }

  // Recent activity
  const recentTx = DB.transactions.filter(t => t.userPhone === DB.currentUser.phone).slice(-3);
  const activityDiv = document.getElementById('recent-activity');
  if (recentTx.length) {
    activityDiv.innerHTML = recentTx.map(tx => `
      <p class="small">${tx.date} - ${tx.type}: GHS ${tx.amount} (${tx.status})</p>
    `).join('');
  } else {
    activityDiv.innerHTML = '<p class="small">No transactions yet.</p>';
  }
}

// ========== SAVINGS PLANS ==========
function createSavingsPlan(e) {
  e.preventDefault();
  if (!DB.currentUser) return;
  const name = document.getElementById('plan-name').value.trim();
  const amount = parseInt(document.getElementById('plan-amount').value);
  const freq = document.getElementById('plan-frequency').value;
  if (!name || amount < DB.settings.minDep || amount > DB.settings.maxDep)
    return alert(`Amount must be between GHS ${DB.settings.minDep} and GHS ${DB.settings.maxDep}`);
  const start = new Date();
  const maturity = new Date(start.getTime() + 30 * 24*60*60*1000); // 30 days demo
  const plan = {
    id: Date.now(),
    userPhone: DB.currentUser.phone,
    name,
    amount,
    frequency: freq,
    startDate: start.toISOString(),
    maturityDate: maturity.toISOString(),
    totalDeposited: 0,
    active: true
  };
  DB.savings.push(plan);
  // record transaction
  addTransaction('Deposit', amount, 'Successful', DB.currentUser.phone);
  plan.totalDeposited += amount;
  save();
  renderSavings();
  if (document.getElementById('dashboard-screen').classList.contains('active')) updateDashboard();
  alert('Savings plan created!');
}

function renderSavings() {
  const plans = DB.savings.filter(p => p.userPhone === DB.currentUser?.phone);
  const div = document.getElementById('existing-plans');
  if (!plans.length) {
    div.innerHTML = '<p>No savings plans yet.</p>';
    return;
  }
  div.innerHTML = plans.map(p => `
    <div class="card" style="margin:8px 0">
      <strong>${p.name}</strong> (${p.frequency})<br>
      Amount: GHS ${p.amount} | Saved: GHS ${p.totalDeposited}<br>
      Matures: ${new Date(p.maturityDate).toLocaleDateString()}<br>
      Status: ${p.active ? 'Active' : 'Inactive'}
    </div>
  `).join('');
}

// ========== TRANSACTIONS ==========
function addTransaction(type, amount, status, userPhone) {
  DB.transactions.push({
    id: Date.now(),
    userPhone,
    type,
    amount,
    status,
    date: new Date().toLocaleString()
  });
  save();
}

function renderTransactions() {
  const txns = DB.transactions.filter(t => t.userPhone === DB.currentUser?.phone).reverse();
  const list = document.getElementById('transactions-list');
  if (!txns.length) {
    list.innerHTML = '<p>No transactions yet.</p>';
    return;
  }
  list.innerHTML = txns.map(t => `
    <div style="border-bottom:1px solid #eee; padding:10px 0">
      <strong>${t.type}</strong> - GHS ${t.amount}<br>
      <span class="small">${t.date}</span> • <span>${t.status}</span>
    </div>
  `).join('');
}

// ========== WITHDRAWALS ==========
function updateWithdrawalScreen() {
  if (!DB.currentUser) return;
  const eligiblePlans = DB.savings.filter(p => p.userPhone === DB.currentUser.phone && new Date(p.maturityDate) <= new Date() && p.active);
  let matured = 0;
  eligiblePlans.forEach(p => matured += p.totalDeposited);
  const fee = Math.round(matured * DB.settings.fee / 100);
  document.getElementById('matured-balance').textContent = `GHS ${matured}`;
  document.getElementById('withdrawal-fee').textContent = `GHS ${fee}`;
  document.getElementById('net-amount').textContent = `GHS ${matured - fee}`;

  // history
  const hist = document.getElementById('withdrawal-history');
  const wds = DB.withdrawals.filter(w => w.userPhone === DB.currentUser.phone);
  hist.innerHTML = wds.length ? wds.map(w => `
    <div class="card" style="margin:8px 0">
      <strong>GHS ${w.amount}</strong> (Fee: ${w.fee})<br>
      Status: ${w.status}<br>
      <span class="small">${w.date}</span>
      ${w.note ? `<br><small>Note: ${w.note}</small>` : ''}
    </div>
  `).join('') : '<p>No withdrawals yet.</p>';
}

function requestWithdrawal() {
  if (!DB.currentUser) return;
  const eligiblePlans = DB.savings.filter(p => p.userPhone === DB.currentUser.phone && new Date(p.maturityDate) <= new Date() && p.active);
  if (!eligiblePlans.length) return alert('No matured plans. You can only withdraw after maturity.');
  let totalMat = eligiblePlans.reduce((s, p) => s + p.totalDeposited, 0);
  const fee = Math.round(totalMat * DB.settings.fee / 100);
  const net = totalMat - fee;
  const amountInput = parseInt(document.getElementById('withdraw-amount').value);
  if (isNaN(amountInput) || amountInput > net || amountInput < 1) return alert(`Enter an amount up to GHS ${net}`);
  // Deactivate plans proportionally (simplified: deactivate all)
  eligiblePlans.forEach(p => p.active = false);
  DB.withdrawals.push({
    id: Date.now(),
    userPhone: DB.currentUser.phone,
    amount: amountInput,
    fee: Math.round(amountInput * DB.settings.fee / 100),
    status: 'Pending',
    date: new Date().toLocaleString(),
    note: ''
  });
  addTransaction('Withdrawal', amountInput, 'Pending', DB.currentUser.phone);
  save();
  updateWithdrawalScreen();
  alert('Withdrawal requested. 24-hour processing.');
}

// ========== COMPLAINTS ==========
function submitComplaint(e) {
  e.preventDefault();
  const category = document.getElementById('complaint-category').value;
  const desc = document.getElementById('complaint-desc').value.trim();
  if (!desc) return;
  DB.complaints.push({
    id: Date.now(),
    userPhone: DB.currentUser.phone,
    category,
    description: desc,
    status: 'Open',
    date: new Date().toLocaleString(),
    replies: []
  });
  save();
  renderComplaints();
  document.getElementById('complaint-desc').value = '';
  alert('Complaint submitted.');
}

function renderComplaints() {
  const userComps = DB.complaints.filter(c => c.userPhone === DB.currentUser?.phone);
  const div = document.getElementById('complaints-history');
  div.innerHTML = userComps.length ? userComps.map(c => `
    <div class="card" style="margin:8px 0">
      <strong>${c.category}</strong> - <span>${c.status}</span><br>
      ${c.description}<br>
      <span class="small">${c.date}</span>
      ${c.replies.length ? `<br><small>Reply: ${c.replies[c.replies.length-1].text}</small>` : ''}
    </div>
  `).join('') : '<p>No complaints.</p>';
}

// ========== PROFILE ==========
function updateProfile() {
  if (!DB.currentUser) return;
  document.getElementById('profile-display-name').textContent = DB.currentUser.name || '—';
  document.getElementById('profile-display-phone').textContent = DB.currentUser.phone;
  document.getElementById('profile-display-momo').textContent = DB.currentUser.momo || '—';
  // notification toggles
  if (DB.currentUser.notifications) {
    document.getElementById('notif-deposit').checked = DB.currentUser.notifications.deposit;
    document.getElementById('notif-withdrawal').checked = DB.currentUser.notifications.withdrawal;
    document.getElementById('notif-reminder').checked = DB.currentUser.notifications.reminder;
    document.getElementById('notif-complaint').checked = DB.currentUser.notifications.complaint;
  }
}

function editProfile() {
  const newName = prompt('Enter new name:', DB.currentUser.name);
  if (newName !== null && newName.trim()) {
    DB.currentUser.name = newName.trim();
    const idx = DB.users.findIndex(u => u.phone === DB.currentUser.phone);
    if (idx >= 0) DB.users[idx].name = DB.currentUser.name;
    save();
    updateProfile();
  }
}

function saveNotificationSettings() {
  if (!DB.currentUser) return;
  DB.currentUser.notifications = {
    deposit: document.getElementById('notif-deposit').checked,
    withdrawal: document.getElementById('notif-withdrawal').checked,
    reminder: document.getElementById('notif-reminder').checked,
    complaint: document.getElementById('notif-complaint').checked
  };
  const idx = DB.users.findIndex(u => u.phone === DB.currentUser.phone);
  if (idx >= 0) DB.users[idx].notifications = DB.currentUser.notifications;
  save();
  alert('Notification settings saved.');
}

// ========== ADMIN DASHBOARD ==========
function updateAdminDashboard() {
  document.getElementById('admin-total-users').textContent = DB.users.filter(u => u.role !== 'admin').length;
  const totalSav = DB.savings.reduce((s, p) => s + p.totalDeposited, 0);
  document.getElementById('admin-total-savings').textContent = `GHS ${totalSav}`;
  document.getElementById('admin-active-plans').textContent = DB.savings.filter(p => p.active).length;
  document.getElementById('admin-pending-wd').textContent = DB.withdrawals.filter(w => w.status === 'Pending').length;
  document.getElementById('admin-open-complaints').textContent = DB.complaints.filter(c => c.status === 'Open').length;
}

// ========== ADMIN USER MANAGEMENT ==========
function renderAdminUsers(searchTerm = '') {
  const users = DB.users.filter(u => u.role !== 'admin' && (u.name?.toLowerCase().includes(searchTerm) || u.phone.includes(searchTerm)));
  const list = document.getElementById('admin-users-list');
  list.innerHTML = users.map(u => `
    <div class="user-row">
      <strong>${u.name || '—'}</strong> (${u.phone})<br>
      Status: ${u.suspended ? 'Suspended' : 'Active'}<br>
      <button onclick="toggleSuspendUser('${u.phone}')">${u.suspended ? 'Reactivate' : 'Suspend'}</button>
      <button onclick="editUserInfo('${u.phone}')">Edit</button>
      <button onclick="viewUserPlans('${u.phone}')">Plans</button>
      <button onclick="viewUserTransactions('${u.phone}')">Tx</button>
    </div>
  `).join('');
}

function toggleSuspendUser(phone) {
  const user = DB.users.find(u => u.phone === phone);
  if (!user) return;
  user.suspended = !user.suspended;
  save();
  addAuditLog(`User ${phone} ${user.suspended ? 'suspended' : 'reactivated'}`);
  renderAdminUsers(document.getElementById('user-search')?.value || '');
}

function editUserInfo(phone) {
  const user = DB.users.find(u => u.phone === phone);
  if (!user) return;
  const name = prompt('Name:', user.name);
  const momo = prompt('Mobile Money:', user.momo);
  if (name !== null) user.name = name;
  if (momo !== null) user.momo = momo;
  save();
  renderAdminUsers(document.getElementById('user-search')?.value || '');
}

function viewUserPlans(phone) {
  const plans = DB.savings.filter(p => p.userPhone === phone);
  alert(plans.length ? plans.map(p => `${p.name} - GHS ${p.amount}`).join('\n') : 'No plans.');
}

function viewUserTransactions(phone) {
  const tx = DB.transactions.filter(t => t.userPhone === phone);
  alert(tx.length ? tx.map(t => `${t.type} ${t.amount} (${t.status})`).join('\n') : 'No transactions.');
}

// ========== ADMIN WITHDRAWALS ==========
function renderAdminWithdrawals() {
  const wds = DB.withdrawals;
  const list = document.getElementById('admin-withdrawals-list');
  list.innerHTML = wds.map(w => `
    <div class="wd-row">
      <strong>${w.userPhone}</strong> - GHS ${w.amount} (Fee: ${w.fee})<br>
      Status: ${w.status}<br>
      ${w.status === 'Pending' ? `
        <button onclick="approveWithdrawal(${w.id})">Approve</button>
        <button onclick="rejectWithdrawal(${w.id})">Reject</button>
      ` : '<small>No action needed</small>'}
    </div>
  `).join('');
}

function approveWithdrawal(id) {
  const w = DB.withdrawals.find(w => w.id === id);
  if (!w) return;
  w.status = 'Approved';
  w.note = prompt('Add a note (optional):') || '';
  addAuditLog(`Withdrawal ${id} approved`);
  // update transaction status
  const tx = DB.transactions.find(t => t.userPhone === w.userPhone && t.type === 'Withdrawal' && t.amount === w.amount && t.status === 'Pending');
  if (tx) tx.status = 'Successful';
  save();
  renderAdminWithdrawals();
}

function rejectWithdrawal(id) {
  const w = DB.withdrawals.find(w => w.id === id);
  if (!w) return;
  w.status = 'Rejected';
  w.note = prompt('Reason for rejection:') || '';
  addAuditLog(`Withdrawal ${id} rejected`);
  const tx = DB.transactions.find(t => t.userPhone === w.userPhone && t.type === 'Withdrawal' && t.amount === w.amount && t.status === 'Pending');
  if (tx) tx.status = 'Failed';
  // re-activate plans? simplified
  save();
  renderAdminWithdrawals();
}

// ========== ADMIN COMPLAINTS ==========
function renderAdminComplaints() {
  const comps = DB.complaints;
  const list = document.getElementById('admin-complaints-list');
  list.innerHTML = comps.map(c => `
    <div class="comp-row">
      <strong>${c.userPhone}</strong> - ${c.category}<br>
      ${c.description}<br>
      Status: ${c.status}<br>
      <button onclick="replyComplaint(${c.id})">Reply</button>
      <select onchange="changeComplaintStatus(${c.id}, this.value)">
        <option ${c.status === 'Open' ? 'selected' : ''}>Open</option>
        <option ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
      </select>
    </div>
  `).join('');
}

function replyComplaint(id) {
  const c = DB.complaints.find(c => c.id === id);
  if (!c) return;
  const reply = prompt('Your reply:');
  if (reply) {
    c.replies.push({ text: reply, date: new Date().toLocaleString() });
    c.status = 'In Progress';
    save();
    renderAdminComplaints();
  }
}

function changeComplaintStatus(id, status) {
  const c = DB.complaints.find(c => c.id === id);
  if (c) {
    c.status = status;
    save();
  }
}

// ========== ADMIN SETTINGS ==========
function populateSettings() {
  document.getElementById('settings-fee').value = DB.settings.fee;
  document.getElementById('settings-min-dep').value = DB.settings.minDep;
  document.getElementById('settings-max-dep').value = DB.settings.maxDep;
  document.getElementById('settings-proc-time').value = DB.settings.procTime;
}

function saveSystemSettings() {
  const fee = parseFloat(document.getElementById('settings-fee').value) || 3;
  const min = parseInt(document.getElementById('settings-min-dep').value) || 2;
  const max = parseInt(document.getElementById('settings-max-dep').value) || 100;
  const proc = parseInt(document.getElementById('settings-proc-time').value) || 24;
  DB.settings = { fee, minDep: min, maxDep: max, procTime: proc };
  save();
  addAuditLog('System settings updated');
  alert('Settings saved.');
}

// ========== ANNOUNCEMENTS ==========
function sendAnnouncement() {
  const msg = document.getElementById('announcement-msg').value.trim();
  if (!msg) return;
  DB.announcements.push({ text: msg, date: new Date().toLocaleString() });
  save();
  addAuditLog('Announcement sent');
  alert('Announcement broadcasted.');
  document.getElementById('announcement-msg').value = '';
}

// ========== AUDIT LOGS ==========
function addAuditLog(action) {
  DB.auditLogs.push({ action, date: new Date().toLocaleString() });
  save();
}

function renderAuditLogs() {
  const logs = DB.auditLogs;
  document.getElementById('audit-logs').innerHTML = logs.slice(-20).reverse().map(l => `<p>${l.date} - ${l.action}</p>`).join('');
}

// ========== INITIAL SETUP ==========
document.addEventListener('DOMContentLoaded', () => {
  if (DB.currentUser) {
    if (DB.currentUser.role === 'admin') navigateTo('admin-dashboard-screen');
    else navigateTo('dashboard-screen');
  } else {
    navigateTo('welcome-screen');
  }
});
