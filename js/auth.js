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

    const perms = Array.isArray(data.permissions) ? data.permissions : [];
    localStorage.setItem(PERMS_KEY, JSON.stringify(perms));

    // Store user info (optional, useful for header/profile)
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: data.id || data.user_id || null,
      username: data.username || '',
      email: data.email || '',
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

    if (!res.ok) throw new Error('Invalid credentials or server error');
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

    if (!res.ok) throw new Error('Failed to load session');

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
    window.location.href = '/login.html';
  }

  return {
    isAuthed,
    login,
    logout,
    loadMe,
    setSession,
    clearSession,
  };
})();
