// public/js/app.js
(async () => {
  try {
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const url = `${base.replace(/\/$/, '')}/health`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    try {
      const j = JSON.parse(text);
      console.log('Backend OK', j.now);
    } catch {
      console.warn('Health check returned non-JSON (first 400 chars):', text.slice(0, 400));
      console.info('If this is an ngrok/GitHub pages landing page, set window.CONFIG.API_BASE correctly.');
    }
  } catch (e) {
    console.warn('Health check failed:', e?.message || e);
  }

  // If token present, try to hydrate session and only then boot sidebar/router.
  if (window.auth && auth.isAuthed && auth.isAuthed()) {
    try {
      await auth.loadMe();
      console.debug('Session hydrated at boot.');
    } catch (e) {
      console.warn('loadMe failed during boot:', e?.message || e);
      // clear stale session data to avoid rendering wrong role
      try { auth.setToken(''); } catch {}
      try { localStorage.removeItem('token'); } catch {}
      try { localStorage.removeItem('role'); } catch {}
      try { localStorage.removeItem('user'); } catch {}
    }
  } else {
    // ensure stale local role doesn't persist for unauthenticated user
    try {
      if (!localStorage.getItem('token')) localStorage.removeItem('role');
    } catch (e) {}
  }

  // Now boot sidebar with role + permissions (will use fresh role if loaded)
  bootSidebar();

  // Boot router (safe navigation)
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => router.navigate(), { once: true });
    } else {
      router.navigate();
    }
  } catch (e) {
    console.error('Router boot failed:', e);
  }
})();

document.getElementById('btnTheme')?.addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-bs-theme', next);
});

document.getElementById('btnLogout')?.addEventListener('click', () => {
  try { auth.logout(); } catch (e) { location.href = '#/login'; }
});

function bootSidebar() {
  const role = (localStorage.getItem('role') || 'guest').toLowerCase();
  const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
  window.renderSidebar?.({ role, permissions: perms });
}

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
