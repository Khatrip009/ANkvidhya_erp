// public/js/pages/login.js
window.pageLogin = (() => {
  // ---- view ----
  function render() {
    return `
<div class="container py-5 login-wrap">
  <div class="row g-0 shadow-lg rounded-4 overflow-hidden bg-white mx-auto" style="max-width:980px;">
    <!-- Left: Login Form -->
    <div class="col-md-6 p-5 d-flex flex-column justify-content-center">
      <div class="text-center mb-4">
        <img src="./images/Ank_Logo.png" alt="AnkVidhya Logo" class="img-fluid mb-3" style="height:70px;">
        <h1 class="h3 fw-bold mb-2 text-brand-2">Welcome to AnkVidhya ERP System</h1>
        <p class="text-muted">Where Numbers Meet Life Wisdom</p>
      </div>

      <form id="loginForm" novalidate>
        <div class="mb-3">
          <div class="input-group">
            <span class="input-group-text"><i class="fa-solid fa-user"></i></span>
            <input type="text" id="identifier" name="identifier" class="form-control" placeholder="Email or Username" required>
          </div>
        </div>

        <div class="mb-3">
          <div class="input-group">
            <span class="input-group-text"><i class="fa-solid fa-lock"></i></span>
            <input type="password" id="password" name="password" class="form-control" placeholder="Password" required>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="remember-me">
            <label class="form-check-label" for="remember-me">Remember me</label>
          </div>
          <a href="#" class="text-decoration-none text-brand-2 small">Forgot password?</a>
        </div>

        <button type="submit" id="loginBtn" class="btn login-btn w-100 py-2 text-white">
          <span class="btn-text">Sign in</span>
          <span class="btn-spin d-none ms-2 spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        </button>
      </form>
    </div>

    <!-- Right: Quotes / Art Panel -->
    <div class="col-md-6 position-relative d-flex flex-column justify-content-center align-items-center text-center text-white p-5 login-art">
      <!-- Floating doodles -->
      <span class="doodle doodle-1">π</span>
      <span class="doodle doodle-2">∞</span>
      <span class="doodle doodle-3">Σ</span>
      <span class="doodle doodle-4">√</span>
      <span class="doodle doodle-5">Δ</span>
      <span class="doodle doodle-6">&#8747;</span>
      <span class="doodle doodle-7">∮</span>
      <span class="doodle doodle-8">&#8710;</span>
      <span class="doodle doodle-9">&#8706;</span>
      <span class="doodle doodle-10">≈</span>

      <div class="position-absolute top-0 bottom-0 start-0 end-0 bg-dark opacity-25"></div>

      <div class="position-relative z-1 w-100" style="max-width:480px;">
        <i class="fa-solid fa-quote-left fs-2 mb-3 text-warning"></i>
        <div id="quote-container" class="mb-3"></div>
        <div>
          <button id="prev-quote" class="btn btn-link text-white fs-4 me-3"><i class="fa-solid fa-chevron-left"></i></button>
          <button id="next-quote" class="btn btn-link text-white fs-4"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>
    </div>
  </div>
</div>
    `;
  }

  // ---- behavior ----
  function mount() {
    // fonts (only once)
    if (!document.getElementById('gfonts-login')) {
      const l1 = document.createElement('link');
      l1.id = 'gfonts-login';
      l1.rel = 'stylesheet';
      l1.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Poppins:wght@400;500&display=swap';
      document.head.appendChild(l1);
    }
    // fontawesome (only once)
    if (!document.getElementById('fa-login')) {
      const fa = document.createElement('link');
      fa.id = 'fa-login';
      fa.rel = 'stylesheet';
      fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
      fa.crossOrigin = 'anonymous';
      document.head.appendChild(fa);
    }

    const form = document.getElementById('loginForm');
    const identifier = document.getElementById('identifier');
    const password = document.getElementById('password');
    const remember = document.getElementById('remember-me');
    const btn = document.getElementById('loginBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnSpin = btn.querySelector('.btn-spin');

    // Prefill remember-me
    const remembered = localStorage.getItem('remember_identifier');
    if (remembered) { identifier.value = remembered; remember.checked = true; }

    // Quotes carousel
    (function quotes() {
      const el = document.getElementById('quote-container');
      const prev = document.getElementById('prev-quote');
      const next = document.getElementById('next-quote');
      const quotes = [
        { q: 'Mathematics is the language with which God has written the universe.', a: 'Galileo Galilei' },
        { q: 'Education is not the learning of facts, but the training of the mind to think.', a: 'Albert Einstein' },
        { q: 'The only limit to our realization of tomorrow is our doubts of today.', a: 'F. D. Roosevelt' },
        { q: 'An investment in knowledge pays the best interest.', a: 'Benjamin Franklin' },
        { q: 'Tell me and I forget. Teach me and I remember. Involve me and I learn.', a: 'Benjamin Franklin' },
        { q: 'The beautiful thing about learning is that no one can take it away from you.', a: 'B. B. King' },
        { q: 'Pure mathematics is, in its way, the poetry of logical ideas.', a: 'Albert Einstein' },
        { q: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.', a: 'Malcolm X' },
        { q: 'It always seems impossible until it’s done.', a: 'Nelson Mandela' },
        { q: 'The expert in anything was once a beginner.', a: 'Helen Hayes' }
      ];
      let i = 0;
      const renderQ = () => el.innerHTML =
        `<p class="fs-5 fw-medium mb-1">${quotes[i].q}</p><p class="small opacity-75">— ${quotes[i].a}</p>`;
      renderQ();
      prev.addEventListener('click', () => { i = (i - 1 + quotes.length) % quotes.length; renderQ(); });
      next.addEventListener('click', () => { i = (i + 1) % quotes.length; renderQ(); });
    })();

    function setBusy(b) {
      btn.disabled = b;
      btnSpin.classList.toggle('d-none', !b);
      btnText.textContent = b ? 'Signing in…' : 'Sign in';
    }

    // Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idVal = identifier.value.trim();
      const pwVal = password.value;

      if (!idVal || !pwVal) return ui.toast('Please enter username/email and password', 'danger');

      try {
        setBusy(true);

        // Try compatibility-first: prefer API-prefixed route, then fallback.
        const payload = { usernameOrEmail: idVal, password: pwVal };
        let resp = null;

        // Try /api/auth/login first (works if API_BASE configured)
        try {
          resp = await api.post('/api/auth/login', payload);
        } catch (err1) {
          // Fallback to /auth/login (some deployments)
          try {
            resp = await api.post('/auth/login', payload);
          } catch (err2) {
            // if both fail, propagate the last error (helps ui messaging)
            throw err2 || err1;
          }
        }

        // Defensive token extraction (support { token } or { data: { token } })
        const token = resp?.token || resp?.data?.token || (typeof resp === 'string' ? resp : null);
        if (!token) {
          throw new Error('Login succeeded but no token returned');
        }

        // Save token (clear any stale role/user first to avoid incorrect UI render)
        try { localStorage.removeItem('role'); localStorage.removeItem('user'); } catch (e) { /* ignore */ }
        auth.setToken(token);

        if (remember.checked) localStorage.setItem('remember_identifier', idVal);
        else localStorage.removeItem('remember_identifier');

        // Hydrate session (this will call /api/auth/me or fallbacks)
        await auth.loadMe();

        ui.toast('Welcome!', 'success');

        // Use hash navigation so router handles mounting
        location.hash = '#/dashboard';
      } catch (err) {
        console.error('Login error', err);
        // nicer messages
        if (err?.status === 401) {
          ui.toast(err?.data?.message || 'Invalid credentials', 'danger');
        } else if (err?.status === 403) {
          ui.toast('Signed in, but your role/school scope is restricted (RLS). Please contact admin.', 'warning');
        } else if (err?.message && err.message.includes('No token')) {
          ui.toast('Login failed: no token received from server', 'danger');
        } else {
          ui.toast(err?.data?.message || err?.message || 'Login failed', 'danger');
        }
      } finally {
        setBusy(false);
      }
    });
  }

  return { render, mount };
})();
