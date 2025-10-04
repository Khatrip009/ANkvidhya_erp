// public/js/auth.js
// ---------------------------------------------------------------------------
// Global auth helper for managing JWT token and the logged-in user session.
// Exposes: window.auth  (used by api.js, app.js, login.js, etc.)
// ---------------------------------------------------------------------------

window.auth = (() => {
  const KEY = 'token';
  let _token = localStorage.getItem(KEY) || '';

  /** Return the stored JWT (empty string if none) */
  function getToken() {
    return _token || localStorage.getItem(KEY) || '';
  }

  /** Save/remove the JWT in both memory and localStorage */
  function setToken(t) {
    _token = t || '';
    if (t) {
      localStorage.setItem(KEY, t);
    } else {
      localStorage.removeItem(KEY);
    }
  }

  /** True if a token is currently stored */
  function isAuthed() {
    return !!getToken();
  }

  /** Store user/role info and update UI elements */
  function setSession(me) {
    if (!me) return;

    localStorage.setItem('role', (me.role_name || '').toLowerCase());
    localStorage.setItem('user', JSON.stringify(me));

    // Update top-bar profile name if the element exists
    const el = document.getElementById('topProfileName');
    if (el) {
      el.textContent =
        me.username ||
        me.employee_name ||
        me.student_name ||
        'Profile';
    }

    // Re-render sidebar with latest role + permissions
    const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
    window.renderSidebar?.({
      role: (me.role_name || 'faculty').toLowerCase(),
      permissions: perms
    });
  }

  /**
   * Fetch /api/auth/me to hydrate the session.
   * Throws if the token is invalid or expired; caller should handle logout.
   */
  async function loadMe() {
    const { data } = await window.api.get('/api/auth/me');
    setSession(data);
    return data;
  }

  /** Clear all auth data and redirect to login */
  function logout() {
    setToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    location.href = '#/login';
  }

  // Public API
  return {
    getToken,
    setToken,
    isAuthed,
    setSession,
    loadMe,
    logout
  };
})();
