// public/js/auth.js
'use strict';

const auth = (() => {
  const TOKEN_KEY = 'token';
  const ROLE_KEY = 'role';
  const PERMS_KEY = 'permissions';
  const USER_KEY = 'user';

  /**
   * Check if user has valid token.
   */
  function isAuthed() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Save session data locally.
   * Called after login or after /api/auth/me returns.
   */
  function setSession(data = {}) {
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    const role = (data.role_name || data.role || 'guest').toLowerCase();
    localStorage.setItem(ROLE_KEY, role);

    const perms = Array.isArray(data.permissions) ? data.permissions : (Array.isArray(data.perms) ? data.perms : []);
    localStorage.setItem(PERMS_KEY, JSON.stringify(perms));

    // Store user info (optional, useful for header/profile)
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: data.id || data.user_id || null,
      username: (data.username || (data.user && data.user.username) || ''),
      email: data.email || (data.user && data.user.email) || '',
      employee_id: data.employee_id || null,
    }));
  }

  /**
   * Clear all auth-related storage.
   */
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(PERMS_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Convenience: set token only (backwards compatibility for older code).
   */
  function setToken(token) {
    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Helper getters for older code.
   */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function getRole() {
    return (localStorage.getItem(ROLE_KEY) || 'guest').toLowerCase();
  }
  function getPermissions() {
    try {
      const p = JSON.parse(localStorage.getItem(PERMS_KEY) || '[]');
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    } catch {
      return {};
    }
  }

  /**
   * Login using username/password.
   * Expects backend to return { token, user, role, permissions }.
   */
  async function login(username, password) {
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      // try to surface server JSON message if available
      let msg = 'Invalid credentials or server error';
      try {
        const j = await res.json();
        if (j && j.message) msg = j.message;
      } catch (e) {
        // ignore parse error
      }
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data || !data.token) throw new Error('Invalid login response');

    setSession(data);
    return data;
  }

  /**
   * Fetch the current user via /api/auth/me.
   * Also updates local session (role + perms).
   */
  async function loadMe() {
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('No token present');

    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // expired/invalid token
      logout();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      let msg = 'Failed to load session';
      try {
        const j = await res.json();
        if (j && j.message) msg = j.message;
      } catch (_) {}
      throw new Error(msg);
    }

    const json = await res.json();
    const data = json.data || json;

    setSession(data);
    return data;
  }

  /**
   * Logout and redirect to login page.
   */
  function logout() {
    clearSession();
    // If already on login page, don't force navigation loop
    if (!location.pathname.endsWith('/login.html') && !location.pathname.endsWith('/login')) {
      window.location.href = '/login.html';
    } else {
      // If already on login page, simply clear state and reload so UI updates
      try { bootSidebar(); } catch (e) {}
    }
  }

  return {
    isAuthed,
    login,
    logout,
    loadMe,
    setSession,
    clearSession,
    // backward-compatible aliases / helpers
    setToken,
    getToken,
    getRole,
    getPermissions,
    getUser,
  };
})();
