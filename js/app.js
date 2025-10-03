  // public/js/app.js
  (async () => {
    try {
      const r = await fetch('/health'); const j = await r.json();
      console.log('Backend OK', j.now);
    } catch {}

    // If already authed (token present), hydrate session from /api/auth/me
    if (auth.isAuthed()) {
      try { await auth.loadMe(); } catch { /* loadMe handles logout on 401 */ }
    }
  })();

  // Theme toggle
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-bs-theme', next);
  });

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', () => auth.logout());

  // Init role-based sidebar once DOM is ready
  function bootSidebar() {
    const role = (localStorage.getItem('role') || 'faculty').toLowerCase();
    const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
    window.renderSidebar?.({ role, permissions: perms });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSidebar, { once: true });
  } else {
    bootSidebar();
  }

  // Boot router when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => router.navigate(), { once: true });
  } else {
    router.navigate();
  }

  // Sidebar toggle (hamburger)
  (function wireSidebarToggle(){
    document.body.addEventListener('click', (e) => {
      const t = e.target.closest('[data-sidebar-toggle]'); if (!t) return;
      e.preventDefault();
      const el = document.getElementById('appSidebar'); if (!el) return;
      bootstrap.Offcanvas.getOrCreateInstance(el).toggle();
    });
  })();

  // Sidebar link navigation
  (function wireSidebarLinks(){
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-route]'); if (!a) return;
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
