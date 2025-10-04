// public/js/app.js
'use strict';

(async () => {
  // --- Health check (non-blocking) ---
  try {
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const r = await fetch(`${base}/health`);
    // If backend returns an HTML error page (e.g. 404 or 500 with HTML),
    // parsing JSON will throw. Inspect content-type first.
    const ctype = r.headers.get('content-type') || '';
    if (r.ok && ctype.includes('application/json')) {
      try {
        const j = await r.json();
        if (j && j.now) console.log('Backend OK', j.now);
        else console.log('Backend OK (JSON)', j);
      } catch (parseErr) {
        console.warn('Health check: unable to parse JSON:', parseErr.message);
      }
    } else {
      // Not OK or not JSON — print useful diagnostics
      let text = '';
      try {
        text = await r.text();
      } catch (_) { text = ''; }
      console.warn(`Health check returned non-JSON or error (status ${r.status}):`, text || r.statusText);
    }
  } catch (e) {
    console.warn('Health check failed:', e?.message || e);
  }

  // --- Try to hydrate session if token present ---
  if (typeof auth !== 'undefined' && auth.isAuthed && auth.isAuthed()) {
    try {
      // auth.loadMe() will call /api/auth/me and call auth.setSession internally.
      // We capture returned data to ensure permissions & role are stored in localStorage.
      const me = await auth.loadMe();

      // Some older code expects permissions in localStorage; ensure it's saved.
      try {
        const perms = (me && (me.permissions || me.perms)) || [];
        localStorage.setItem('permissions', JSON.stringify(Array.isArray(perms) ? perms : []));
      } catch (ignore) {}

      // Ensure role is normalized and stored (some backends return role or role_name)
      try {
        const role = (me && (me.role_name || me.role)) || localStorage.getItem('role') || 'guest';
        localStorage.setItem('role', (role || 'guest').toLowerCase());
      } catch (ignore) {}

      // Render sidebar now that role & permissions exist
      try { bootSidebar(); } catch (e) { console.warn('bootSidebar error:', e); }
    } catch (e) {
      // loadMe handles logout on 401, but ensure we show guest UI
      console.warn('Session hydration failed:', e?.message || e);
      // Clean up any partial state
      try { localStorage.removeItem('permissions'); } catch (ignore) {}
      try { localStorage.removeItem('role'); } catch (ignore) {}
      try { bootSidebar(); } catch (ignore) {}
    }
  } else {
    // No token — guest UI
    try { bootSidebar(); } catch (ignore) {}
  }

  // --- End init IIFE ---
})();

// Theme toggle
document.getElementById('btnTheme')?.addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-bs-theme', next);
});

// Logout
document.getElementById('btnLogout')?.addEventListener('click', () => {
  if (typeof auth !== 'undefined' && auth.logout) auth.logout();
});

/**
 * Boot sidebar from localStorage role + permissions.
 * This is the canonical place used throughout your app to render sidebar.
 */
function bootSidebar() {
  const role = (localStorage.getItem('role') || 'guest').toLowerCase();
  let perms = [];
  try {
    perms = JSON.parse(localStorage.getItem('permissions') || '[]');
    if (!Array.isArray(perms)) perms = [];
  } catch {
    perms = [];
  }
  // Provide a safe fallback if renderSidebar is not defined
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar?.({ role, permissions: perms });
  } else {
    // Minimal fallback: add a simple guest/user indicator if sidebar can't render
    const sidebarEl = document.getElementById('appSidebar');
    if (sidebarEl) {
      sidebarEl.innerHTML = `<div class="p-3">Role: <strong>${role}</strong></div>`;
    }
  }
}

// Boot router when DOM is ready (existing behavior)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { router.navigate(); } catch (e) { console.warn('router.navigate error:', e); }
  }, { once: true });
} else {
  try { router.navigate(); } catch (e) { console.warn('router.navigate error:', e); }
}

// Sidebar toggle (hamburger)
(function wireSidebarToggle() {
  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sidebar-toggle]');
    if (!t) return;
    e.preventDefault();
    const el = document.getElementById('appSidebar');
    if (!el) return;
    try {
      bootstrap.Offcanvas.getOrCreateInstance(el).toggle();
    } catch (err) {
      console.warn('Offcanvas toggle failed:', err);
    }
  });
})();

// Sidebar link navigation (existing)
(function wireSidebarLinks() {
  document.body.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-route]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) location.hash = href;
    else if (href) location.hash = '#/' + href.replace(/^#?\/*/, '');
    const ocEl = document.getElementById('appSidebar');
    const oc = ocEl ? (bootstrap.Offcanvas.getInstance(ocEl) || bootstrap.Offcanvas.getOrCreateInstance(ocEl)) : null;
    if (oc) try { oc.hide(); } catch (_) {}
    try { router.navigate(); } catch (err) { console.warn('router.navigate error:', err); }
  });
})();
