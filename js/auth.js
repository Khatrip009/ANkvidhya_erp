// public/js/auth.js
// Global auth helper for managing JWT token and the logged-in user session.
// Exposes: window.auth  (used by api.js, app.js, login.js, etc.)

window.auth = (() => {
  const KEY = 'token';
  let _token = null;
  try { _token = localStorage.getItem(KEY) || ''; } catch (e) { _token = ''; }

  function getToken() {
    return _token || (localStorage.getItem(KEY) || '') || '';
  }

  function setToken(t) {
    _token = t || '';
    try {
      if (t) localStorage.setItem(KEY, t);
      else localStorage.removeItem(KEY);
    } catch (e) { /* ignore storage errors */ }
  }

  function isAuthed() {
    return !!getToken();
  }

  function setSession(me) {
    if (!me) return;
    const roleName = (me.role_name || me.role || '').toString().toLowerCase();

    try {
      localStorage.setItem('role', roleName);
      localStorage.setItem('user', JSON.stringify(me));
      if (me.permissions) localStorage.setItem('permissions', JSON.stringify(me.permissions));
      const el = document.getElementById('topProfileName');
      if (el) el.textContent = me.username || me.employee_name || me.student_name || 'Profile';
      // re-render sidebar — use the stored permissions (defensive)
      const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
      window.renderSidebar?.({ role: roleName || 'faculty', permissions: perms });
    } catch (e) { /* ignore storage errors */ }
  }

  // Try a list of endpoints; for each, try both relative (api.js will prefix base) and absolute (prefixing API_BASE)
  async function tryEndpoint(ep) {
    // 1) try via api helper (uses API_BASE if configured)
    try {
      const res = await window.api.get(ep);
      return res;
    } catch (e) {
      // continue to absolute attempt
    }

    // 2) if API_BASE configured, try absolute
    try {
      const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
      if (base) {
        // ensure no double slashes
        const url = (base.endsWith('/') ? base.slice(0, -1) : base) + (ep.startsWith('/') ? ep : '/' + ep);
        // use fetch directly to avoid double-prefixing in api helper
        const r = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });
        if (r.ok) {
          const j = await r.json().catch(()=>null);
          return j || null;
        } else {
          // try to parse JSON error
          const j = await r.json().catch(()=>null);
          const err = new Error((j && j.message) || r.statusText || 'Request failed');
          err.status = r.status;
          err.data = j;
          throw err;
        }
      }
    } catch (e2) {
      throw e2;
    }

    // nothing worked
    throw new Error('Endpoint attempt failed: ' + ep);
  }

  async function loadMe() {
    const token = getToken();
    if (!token) throw new Error('No token');

    function extract(res) {
      if (!res) return null;
      if (res.data) return res.data;
      return res;
    }

    // endpoints (prefer /api/auth/me first)
    const endpoints = ['/api/auth/me', '/auth/me', '/api/me', '/me'];
    let lastErr = null;

    for (const ep of endpoints) {
      try {
        console.debug('[auth.loadMe] trying', ep, 'API_BASE=', (window.CONFIG && window.CONFIG.API_BASE));
        const res = await tryEndpoint(ep);
        console.debug('[auth.loadMe] raw response for', ep, res);
        const data = extract(res);
        if (data) {
          setSession(data);
          return data;
        }
      } catch (e) {
        lastErr = e;
        console.warn('[auth.loadMe] failed for', ep, e && (e.message || e.status) ? (e.message || e.status) : e);
        // try next endpoint
      }
    }
    throw lastErr || new Error('Failed to load session');
  }

  async function logout() {
    setToken('');
    try { localStorage.removeItem('user'); } catch {}
    try { localStorage.removeItem('role'); } catch {}
    try { localStorage.removeItem('permissions'); } catch {}
    // redirect to login
    location.href = '#/login';
  }

  return { getToken, setToken, isAuthed, setSession, loadMe, logout };
})();
