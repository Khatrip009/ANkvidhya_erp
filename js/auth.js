// public/js/auth.js
// Global auth helper for managing JWT token and the logged-in user session.
// Exposes: window.auth  (used by api.js, app.js, login.js, etc.)

window.auth = (function () {
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

  function safeSetLocal(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function safeRemoveLocal(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function setSession(me) {
    if (!me) return;
    const roleName = (me.role_name || me.role || '').toString().toLowerCase();

    try {
      safeSetLocal('role', roleName);
      safeSetLocal('user', JSON.stringify(me));
      if (me.permissions) safeSetLocal('permissions', JSON.stringify(me.permissions));
      const el = document.getElementById('topProfileName');
      if (el) el.textContent = me.username || me.employee_name || me.student_name || 'Profile';
      // re-render sidebar — use the stored permissions (defensive)
      const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
      window.renderSidebar?.({ role: roleName || 'faculty', permissions: perms });
    } catch (e) { /* ignore storage errors */ }
  }

  // Low-level try: use window.api first (if available), else try absolute fetch.
  async function tryEndpoint(ep) {
    // 1) try via api helper (uses API_BASE if configured)
    if (window.api && typeof window.api.get === 'function') {
      try {
        const r = await window.api.get(ep);
        return r;
      } catch (e) {
        // continue to absolute attempt
      }
    }

    // 2) if API_BASE configured, try absolute fetch
    try {
      const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
      if (!base) throw new Error('No API_BASE configured');

      // ensure no double slash
      const url = (base.endsWith('/') ? base.slice(0, -1) : base) + (ep.startsWith('/') ? ep : '/' + ep);
      const r = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${getToken()}` }
      });

      // if ok, return parsed JSON (or null)
      if (r.ok) {
        const json = await r.json().catch(()=>null);
        return json || null;
      }

      // try to parse error JSON and throw
      const errJson = await r.json().catch(()=>null);
      const err = new Error((errJson && errJson.message) || r.statusText || 'Request failed');
      err.status = r.status;
      err.data = errJson;
      throw err;
    } catch (fetchErr) {
      throw fetchErr;
    }
  }

  // loadMe — try a set of endpoints and set the session if successful.
  async function loadMe() {
    const token = getToken();
    if (!token) throw new Error('No token');

    function extract(res) {
      if (!res) return null;
      if (res.data) return res.data;
      return res;
    }

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
        // if no data returned, treat as failure and continue
      } catch (e) {
        lastErr = e;
        console.warn('[auth.loadMe] failed for', ep, e && (e.message || e.status) ? (e.message || e.status) : e);
        // continue to next endpoint
      }
    }

    // if all endpoints failed, clear token/session to avoid stale UI and throw last error
    try { setToken(''); } catch (_) {}
    safeRemoveLocal('user');
    safeRemoveLocal('role');
    safeRemoveLocal('permissions');

    throw lastErr || new Error('Failed to load session');
  }

  async function logout() {
    // Clear client-side session and redirect to login
    setToken('');
    safeRemoveLocal('user');
    safeRemoveLocal('role');
    safeRemoveLocal('permissions');
    // navigate to login page via hash so SPA router handles it
    location.hash = '#/login';
  }

  return { getToken, setToken, isAuthed, setSession, loadMe, logout };
})();
