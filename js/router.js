// public/js/router.js
const router = (() => {
  const outlet = () => document.getElementById('app');

  // Known pages (lazy getters so load order doesn't matter)

const routeGetters = {
  '#/login':     () => window.pageLogin,
  '#/dashboard': () => window.pageDashboard,
  '#/reports':   () => window.pageReports,
  '#/students':  () => window.pageStudents,
  '#/users':     () => window.pageUsers,
  '#/master':    () => window.pageMaster,
  '#/employees': () => window.pageEmployees,
  '#/schools':   () => window.pageSchools,
  '#/courses':   () => window.pageCourses,
  '#/books':     () => window.pageBooks,
  '#/chapters':  () => window.pageChapters,
  '#/videos':    () => window.pageVideos,
  '#/lesson-plans':       () => window.pageLessonPlans,
  '#/faculty-assign':     () => window.pageFacultyAssign,
  '#/payments':           () => window.pagePayments,
  '#/payrolls':           () => window.pagePayrolls,
  '#/expenses':           () => window.pageExpenses,
  '#/faculty-dp':         () => window.pageFacultyDp,
  '#/emp-video-progress': () => window.pageEmpVideoProgress,
  '#/notebook-checks':    () => window.pageNotebookChecks,
  // Attendance pages
  '#/emp-attendance':     () => window.pageEmpAttendance,
  '#/student-attendance': () => window.pageStudentAttendance,

  // Delivery / timetable pages
  '#/timetables':         () => window.pageTimetables,      // <-- NEW
  '#/class-sessions':     () => window.pageClassSessions,  // <-- NEW
};


  const isAuthedNow = () =>
    !!localStorage.getItem('token') || (window.auth && auth.isAuthed && auth.isAuthed());

  function normalizeHash(h) {
    const raw = h || '';
    const base = raw.split('?')[0].split('&')[0]; // strip query fragments
    return base || (isAuthedNow() ? '#/dashboard' : '#/login');
  }

  function titleFromHash(hash) {
    const t = (hash || '#/').replace(/^#\//, '').replace(/-/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Page';
  }

  // Generic "coming soon" stub so every route is navigable
  function makeStubPage(title) {
    const nice = titleFromHash(title);
    return {
      render() {
        return `
          <div class="card shadow-sm">
            <div class="card-body">
              <h5 class="mb-2">📄 ${nice}</h5>
              <p class="text-muted mb-3">This screen isn't wired yet. You can keep building the API + UI and replace this stub later.</p>
              <div class="alert alert-info small mb-0">
                Route: <code>${title}</code>
              </div>
            </div>
          </div>`;
      },
      mount(){ /* no-op */ }
    };
  }

  function resolvePage(hash) {
    const getter = routeGetters[hash];
    if (getter) {
      const page = getter();
      if (page) return page;
    }
    // fallback: render a stub for unknown routes (so clicks always "work")
    return makeStubPage(hash);
  }

  function setActiveSidebar(hash) {
  const root = document.getElementById('sidebarMenu');
  if (!root) return;

  const currentRaw  = location.hash || '';
  const currentNorm = normalizeHash(hash);

  root.querySelectorAll('a[data-route]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const hasQuery = href.includes('?');
    const sameRaw  = href === currentRaw; // exact match wins when there’s a query
    const sameNorm = !hasQuery && normalizeHash(href) === currentNorm;
    a.classList.toggle('active', sameRaw || sameNorm);
  });
}

  async function navigate() {
    const root = outlet();
    if (!root) {
      console.error('Router: #app outlet not found');
      return;
    }

    let hash = normalizeHash(location.hash);

    // guard protected routes
    if (!isAuthedNow() && hash !== '#/login') {
      location.replace('#/login');
      hash = '#/login';
    }

    const page = resolvePage(hash);
    root.innerHTML = (page && typeof page.render === 'function')
      ? page.render()
      : `<div class="p-4 text-danger">Page not found.</div>`;

    if (page && typeof page.mount === 'function') {
      try { await page.mount(); } catch (e) { console.error('mount error:', e); }
    }

    // set logout visibility + active menu item
    document.getElementById('btnLogout')?.classList.toggle('d-none', !isAuthedNow());
    setActiveSidebar(hash);
  }

  window.addEventListener('hashchange', navigate);
  return { navigate };
})();
