// public/js/auth.js
// Global auth helper for managing JWT token and the logged-in user session.
// Exposes: window.auth  (used by api.js, app.js, login.js, etc.)

window.auth = (() => {
  const KEY = 'token';
  let _token = null;
  try { _token = localStorage.getItem(KEY) || ''; } catch (e) { _token = ''; }

  // in-memory cached user object (keeps latest session without re-parsing localStorage)
  let _user = null;

  function getToken() {
    return _token || (localStorage.getItem(KEY) || '') || '';
  }

  function setToken(t) {
    _token = t || '';
    try {
      if (t) localStorage.setItem(KEY, t);
      else localStorage.removeItem(KEY);
    } catch (e) { /* ignore storage errors */ }
    // If token cleared, also clear in-memory user
    if (!t) _user = null;
  }

  function isAuthed() {
    return !!getToken();
  }

  // Safe role extraction helper — handles role_name string, role string, or role object { name: '...' }
  function extractRoleName(me) {
    if (!me) return '';
    if (typeof me.role_name === 'string' && me.role_name.trim()) return me.role_name.toLowerCase();
    if (typeof me.role === 'string' && me.role.trim()) return me.role.toLowerCase();
    if (me.role && typeof me.role.name === 'string' && me.role.name.trim()) return me.role.name.toLowerCase();
    return '';
  }

  function setSession(me) {
    if (!me) return;
    const roleName = extractRoleName(me);

    try {
      // persist canonical role + raw user
      localStorage.setItem('role', roleName);
      localStorage.setItem('user', JSON.stringify(me));
      if (me.permissions) localStorage.setItem('permissions', JSON.stringify(me.permissions));
      // update top profile display if present
      const el = document.getElementById('topProfileName');
      if (el) el.textContent = me.username || me.employee_name || me.student_name || 'Profile';
      // update in-memory user as convenience for other scripts
      _user = me;
      window.auth.user = me;
      // Do NOT force a sidebar render here — app.js / boot sequence should decide timing
    } catch (e) {
      // ignore storage errors (e.g. private mode) but keep in-memory _user
      _user = me;
      window.auth.user = me;
    }
  }

  // Try a single endpoint via two approaches:
  //  1) use window.api.get() (respects API_BASE and headers)
  //  2) fallback to direct absolute fetch to API_BASE + ep (avoids double prefix)
  async function tryEndpoint(ep) {
    // 1) try via api helper (uses API_BASE if configured)
    try {
      const res = await window.api.get(ep);
      return res;
    } catch (e) {
      // continue to absolute attempt
    }

    // 2) if API_BASE configured, try absolute direct fetch
    try {
      const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
      if (base) {
        const baseClean = base.replace(/\/$/, '');
        const path = ep.startsWith('/') ? ep : '/' + ep;
        const url = baseClean + path;
        const r = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });
        if (r.ok) {
          const j = await r.json().catch(()=>null);
          return j || null;
        } else {
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

    // prefer /api/auth/me first (session-scoped), then fallbacks
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

    // If none of the endpoints worked, throw the last error (helps UI bubble the correct message)
    throw lastErr || new Error('Failed to load session');
  }

  async function logout() {
    setToken('');
    try { localStorage.removeItem('user'); } catch (e) {}
    try { localStorage.removeItem('role'); } catch (e) {}
    try { localStorage.removeItem('permissions'); } catch (e) {}
    _user = null;
    window.auth.user = null;
    // redirect to login
    location.href = '#/login';
  }

  // expose user getter for convenience
  function getUser() {
    if (_user) return _user;
    try {
      const s = localStorage.getItem('user');
      if (s) {
        _user = JSON.parse(s);
        window.auth.user = _user;
        return _user;
      }
    } catch (e) { /* ignore parse errors */ }
    return null;
  }

  // expose public API
  return {
    getToken,
    setToken,
    isAuthed,
    setSession,
    loadMe,
    logout,
    // helpful runtime accessors
    user: _user,
    getUser
  };
})();
