// public/js/app.js
'use strict';

(async () => {
  // --- Health check (non-blocking) ---
  try {
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const r = await fetch(`${base}/health`);
    const j = await r.json();
    console.log('Backend OK', j.now);
  } catch (e) {
    console.warn('Health check failed:', e.message);
  }

  // --- Try to hydrate session if token present ---
  if (auth.isAuthed()) {
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
      bootSidebar();
    } catch (e) {
      // loadMe handles logout on 401, but ensure we show guest UI
      console.warn('Session hydration failed:', e?.message || e);
      // Clean up any partial state
      try { localStorage.removeItem('permissions'); } catch (ignore) {}
      try { localStorage.removeItem('role'); } catch (ignore) {}
      bootSidebar();
    }
  } else {
    // No token — guest UI
    bootSidebar();
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
document.getElementById('btnLogout')?.addEventListener('click', () => auth.logout());

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
  window.renderSidebar?.({ role, permissions: perms });
}

// Boot router when DOM is ready (existing behavior)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => router.navigate(), { once: true });
} else {
  router.navigate();
}

// Sidebar toggle (hamburger)
(function wireSidebarToggle() {
  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sidebar-toggle]');
    if (!t) return;
    e.preventDefault();
    const el = document.getElementById('appSidebar');
    if (!el) return;
    bootstrap.Offcanvas.getOrCreateInstance(el).toggle();
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
    if (oc) oc.hide();
    router.navigate();
  });
})();
