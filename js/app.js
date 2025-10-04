// public/js/app.js
'use strict';

(async () => {
  // --- Health check (non-blocking) ---
  try {
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const r = await fetch(`${base}/health`, { cache: 'no-store' });

    // content-type detection to avoid trying to parse HTML as JSON
    const ctype = (r.headers.get('content-type') || '').toLowerCase();

    if (r.ok && ctype.includes('application/json')) {
      try {
        const j = await r.json();
        if (j && j.now) console.log('Backend OK', j.now);
        else console.log('Backend OK (JSON)', j);
      } catch (parseErr) {
        console.warn('Health check: JSON parse error:', parseErr.message);
      }
    } else {
      // Not JSON (could be HTML from ngrok or a load balancer). Log a short, safe snippet.
      let bodyText = '';
      try {
        bodyText = await r.text();
      } catch (e) {
        bodyText = '';
      }
      const snippet = (bodyText || r.statusText || '').toString().slice(0, 300);
      if (ctype.includes('text/html') || snippet.trim().startsWith('<!DOCTYPE')) {
        console.warn(`Health check returned HTML (status ${r.status}). This often indicates your API host is a proxy/landing page (ngrok) or the path is wrong. Snippet:`, snippet + (bodyText.length > 300 ? '… (truncated)' : ''));
      } else {
        console.warn(`Health check returned non-JSON or error (status ${r.status}):`, snippet || `StatusText: ${r.statusText}`);
      }
    }
  } catch (e) {
    console.warn('Health check failed:', e?.message || e);
  }

  // --- Try to hydrate session if token present ---
  if (typeof auth !== 'undefined' && auth.isAuthed && auth.isAuthed()) {
    try {
      const me = await auth.loadMe();

      try {
        const perms = (me && (me.permissions || me.perms)) || [];
        localStorage.setItem('permissions', JSON.stringify(Array.isArray(perms) ? perms : []));
      } catch (ignore) {}

      try {
        const role = (me && (me.role_name || me.role)) || localStorage.getItem('role') || 'guest';
        localStorage.setItem('role', (role || 'guest').toLowerCase());
      } catch (ignore) {}

      try { bootSidebar(); } catch (e) { console.warn('bootSidebar error:', e); }
    } catch (e) {
      console.warn('Session hydration failed:', e?.message || e);
      try { localStorage.removeItem('permissions'); } catch (ignore) {}
      try { localStorage.removeItem('role'); } catch (ignore) {}
      try { bootSidebar(); } catch (ignore) {}
    }
  } else {
    try { bootSidebar(); } catch (ignore) {}
  }
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

function bootSidebar() {
  const role = (localStorage.getItem('role') || 'guest').toLowerCase();
  let perms = [];
  try {
    perms = JSON.parse(localStorage.getItem('permissions') || '[]');
    if (!Array.isArray(perms)) perms = [];
  } catch {
    perms = [];
  }
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar?.({ role, permissions: perms });
  } else {
    const sidebarEl = document.getElementById('appSidebar');
    if (sidebarEl) {
      sidebarEl.innerHTML = `<div class="p-3">Role: <strong>${role}</strong></div>`;
    }
  }
}

// Boot router when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { router.navigate(); } catch (e) { console.warn('router.navigate error:', e); }
  }, { once: true });
} else {
  try { router.navigate(); } catch (e) { console.warn('router.navigate error:', e); }
}

// Sidebar toggle
(function wireSidebarToggle() {
  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sidebar-toggle]');
    if (!t) return;
    e.preventDefault();
    const el = document.getElementById('appSidebar');
    if (!el) return;
    try { bootstrap.Offcanvas.getOrCreateInstance(el).toggle(); } catch (err) { console.warn('Offcanvas toggle failed:', err); }
  });
})();

// Sidebar nav links
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
