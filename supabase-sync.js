// =============================================
//  SUSUHUB – Safe Supabase Sync Module
//  This script silently syncs localStorage data
//  to your Supabase project. It never blocks the
//  main app – if Supabase is unreachable, it
//  simply does nothing.
// =============================================

(function() {
  'use strict';

  const SUPABASE_URL = 'https://tgpfxktzvqjfljhodedv.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncGZ4a3R6dnFqZmxqaG9kZWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTM5NTAsImV4cCI6MjA5NjI4OTk1MH0.s7KgZI1x0a5ZOJZG-FjeFVAjAljBCHpDg9kDPr3s9ac';

  let supabase = null;

  try {
    // If the Supabase library is loaded, create the client
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('[SusuSync] Supabase client ready');
    } else {
      console.warn('[SusuSync] Supabase library not found – sync disabled');
      return;
    }
  } catch (e) {
    console.warn('[SusuSync] Could not create Supabase client:', e.message);
    return;
  }

  // =============================================
  //  HELPERS
  // =============================================
  function getLocalStore(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Keeps track of which items we've already pushed
  const pushedUsers = new Set();
  const pushedSavings = new Set();
  const pushedWithdrawals = new Set();
  const pushedComplaints = new Set();

  // =============================================
  //  SYNC: USERS
  // =============================================
  async function syncUsers() {
    const users = getLocalStore('susu_users');
    if (!users || !Array.isArray(users)) return;

    for (const user of users) {
      if (pushedUsers.has(user.phone)) continue;
      try {
        // Upsert: insert if not exists, update if exists
        const { error } = await supabase
          .from('users')
          .upsert({
            phone: user.phone,
            name: user.name || '',
            email: user.email || '',
            momo: user.momo || '',
            pin: user.pin || '',
            role: user.role || 'user',
            suspended: user.suspended || false,
            notifications: user.notifications || {}
          }, { onConflict: 'phone' });

        if (!error) {
          pushedUsers.add(user.phone);
          console.log('[SusuSync] User synced:', user.phone);
        }
      } catch (e) {
        // silently fail
      }
    }
  }

  // =============================================
  //  SYNC: SAVINGS
  // =============================================
  async function syncSavings() {
    const savings = getLocalStore('susu_savings');
    if (!savings || !Array.isArray(savings)) return;

    for (const plan of savings) {
      const uid = plan.id || plan.userPhone + '_' + plan.plan_name;
      if (pushedSavings.has(uid)) continue;

      try {
        const { error } = await supabase
          .from('savings')
          .upsert({
            id: plan.id,
            user_phone: plan.userPhone,
            plan_name: plan.plan_name || plan.name,
            amount: plan.amount,
            frequency: plan.frequency,
            maturity_date: plan.maturityDate || plan.maturity_date,
            total_deposited: plan.totalDeposited || 0,
            active: plan.active,
            created_at: plan.startDate || new Date().toISOString()
          }, { onConflict: 'id' });

        if (!error) {
          pushedSavings.add(uid);
          console.log('[SusuSync] Savings synced:', uid);
        }
      } catch (e) {}
    }
  }

  // =============================================
  //  SYNC: WITHDRAWALS
  // =============================================
  async function syncWithdrawals() {
    const wds = getLocalStore('susu_withdrawals');
    if (!wds || !Array.isArray(wds)) return;

    for (const w of wds) {
      if (pushedWithdrawals.has(w.id)) continue;

      try {
        const { error } = await supabase
          .from('withdrawals')
          .upsert({
            id: w.id,
            user_phone: w.userPhone,
            amount: w.amount,
            fee: w.fee,
            status: w.status || 'Pending',
            note: w.note || '',
            created_at: w.date || new Date().toISOString()
          }, { onConflict: 'id' });

        if (!error) {
          pushedWithdrawals.add(w.id);
          console.log('[SusuSync] Withdrawal synced:', w.id);
        }
      } catch (e) {}
    }
  }

  // =============================================
  //  SYNC: COMPLAINTS
  // =============================================
  async function syncComplaints() {
    const comps = getLocalStore('susu_complaints');
    if (!comps || !Array.isArray(comps)) return;

    for (const c of comps) {
      if (pushedComplaints.has(c.id)) continue;

      try {
        const { error } = await supabase
          .from('complaints')
          .upsert({
            id: c.id,
            user_phone: c.userPhone,
            category: c.category,
            description: c.description,
            status: c.status || 'Open',
            replies: c.replies || [],
            created_at: c.date || new Date().toISOString()
          }, { onConflict: 'id' });

        if (!error) {
          pushedComplaints.add(c.id);
          console.log('[SusuSync] Complaint synced:', c.id);
        }
      } catch (e) {}
    }
  }

  // =============================================
  //  MAIN SYNC LOOP
  // =============================================
  async function syncAll() {
    if (!supabase) return;

    try {
      await syncUsers();
      await syncSavings();
      await syncWithdrawals();
      await syncComplaints();
    } catch (e) {
      // never crash
    }
  }

  // Run sync every 10 seconds (lightweight polling)
  setInterval(syncAll, 10000);

  // Also run once on load
  window.addEventListener('load', () => {
    setTimeout(syncAll, 2000); // wait for main app to initialize
  });

  console.log('[SusuSync] Sync module active');
})();
