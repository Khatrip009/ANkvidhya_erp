// public/js/auth.js
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
    } catch (e) { /* ignore */ }
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
      const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
      window.renderSidebar?.({ role: roleName || 'faculty', permissions: perms });
    } catch (e) { /* ignore */ }
  }

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
        const res = await window.api.get(ep);
        const data = extract(res);
        if (data) {
          setSession(data);
          return data;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Failed to load session');
  }

  async function logout() {
    setToken('');
    try { localStorage.removeItem('user'); } catch {}
    try { localStorage.removeItem('role'); } catch {}
    try { localStorage.removeItem('permissions'); } catch {}
    location.href = '#/login';
  }

  return { getToken, setToken, isAuthed, setSession, loadMe, logout };
})();
