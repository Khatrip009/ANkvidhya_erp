// public/js/pages/student-attendance.js
(() => {
  async function loadMyClasses() {
    try {
      const { data } = await api.get('/api/me/classes', { query: { pageSize: 500 } });
      return data || [];
    } catch {
      return [];
    }
  }

  function renderForm({ classes = [] }) {
    const options = classes.map(c => {
      const label = `${c.school_name} — ${c.medium_name} — Std ${c.standard_name}${c.division_name ? ' / ' + c.division_name : ''}`;
      return `<option value="${c.school_class_id}">${label}</option>`;
    }).join('');

    const today = new Date().toISOString().slice(0,10);
    return `
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="mb-3"><i class="bi bi-people-fill me-2"></i>Student Attendance</h5>
          <div class="row g-2 align-items-end">
            <div class="col-lg-6">
              <label class="form-label">Class</label>
              <select id="saClass" class="form-select">
                ${options || '<option value="">No classes available</option>'}
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Date</label>
              <input id="saDate" type="date" class="form-control" value="${today}">
            </div>
            <div class="col-md-3">
              <button id="saLoad" class="btn btn-primary w-100"><i class="bi bi-arrow-repeat me-1"></i>Load</button>
            </div>
          </div>

          <hr class="my-4" />
          <div id="saGrid">${window.ui.emptyState('Pick class & date, then Load.')}</div>
        </div>
      </div>
    `;
  }

  function rosterTable({ rows }) {
    const trs = rows.map((s, i) => `
      <tr>
        <td class="text-muted">${i+1}</td>
        <td>${s.roll_no ?? ''}</td>
        <td>${s.student_name || s.full_name || s.name || ''}</td>

        <td>
          <div class="btn-group btn-group-sm" role="group" aria-label="status">
            ${['P','A','L','H'].map(st => `
              <input type="radio" class="btn-check" name="st_${s.student_id}" id="st_${s.student_id}_${st}" value="${st}">
              <label class="btn btn-outline-secondary" for="st_${s.student_id}_${st}">${st}</label>
            `).join('')}
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>#</th><th>Roll</th><th>Student</th><th>Status</th></tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
      <div class="d-flex justify-content-end">
        <button id="saSubmit" class="btn btn-success"><i class="bi bi-check2-circle me-1"></i>Submit Attendance</button>
      </div>
    `;
  }

  // helper to parse the UI's school_class_id string "<school>:<medium>:<std>:<div>"
  function parseSchoolClassId(sc) {
    const parts = String(sc || '').split(':').map(x => {
      const n = parseInt(x, 10);
      return Number.isFinite(n) ? n : null;
    });
    return {
      school_id: parts[0] || null,
      medium_id: parts[1] || null,
      std_id: parts[2] || null,
      div_id: parts[3] || null
    };
  }

  async function findClassSession({ school_id, std_id, div_id, date }) {
    // Query class sessions for that school/std/div and date.
    // The backend should implement GET /api/class-sessions with query params
    // (school_id,std_id,div_id,session_date). If not present, this will fail silently.
    try {
      const { data } = await api.get('/api/class-sessions', { query: { school_id, std_id, div_id, session_date: date, pageSize: 50 } });
      if (!data || !data.length) return null;
      // pick the first session (you can modify to allow choosing if multiple)
      return data[0];
    } catch (e) {
      // no sessions endpoint or no access — treat as none
      return null;
    }
  }

  async function loadRoster(root) {
    const school_class_id = root.querySelector('#saClass')?.value || '';
    const date = root.querySelector('#saDate')?.value || new Date().toISOString().slice(0,10);
    if (!school_class_id) { window.ui.toast('Select a class first', 'warning'); return; }

    const grid = root.querySelector('#saGrid');
    grid.innerHTML = window.ui.spinner();

    try {
      const parsed = parseSchoolClassId(school_class_id);

      // Attempt to find an existing class_session for this school/std/div/date
      let session = null;
      if (parsed.school_id && parsed.std_id) {
        session = await findClassSession({ school_id: parsed.school_id, std_id: parsed.std_id, div_id: parsed.div_id, date });
      }

      // Ask server for students in this class; server should accept school_class_id (original format)
      const { data } = await api.get('/api/students', { query: { school_class_id, pageSize: 1000 } });
      const roster = data || [];
      if (!roster.length) {
        grid.innerHTML = window.ui.emptyState('No students found for this class.');
        return;
      }
      grid.innerHTML = rosterTable({ rows: roster });

      root.querySelector('#saSubmit')?.addEventListener('click', async () => {
        const rows = roster.map(s => {
          const sid = s.student_id ?? s.id ?? s.studentId ?? null;
          const checked = root.querySelector(`input[name="st_${sid}"]:checked`);
          return { student_id: sid, status: (checked?.value || 'P') };
        });

        const bad = rows.find(r => !r.student_id);
        if (bad) {
          window.ui.toast('Missing student_id for one or more students — check the students API.', 'danger');
          return;
        }

        // build payload; include session_id if we found one
        const payload = { school_class_id, date, rows };
        if (session && session.cs_id) payload.session_id = session.cs_id;

        try {
          await api.post('/api/student-attendance', payload);
          window.ui.toast('Attendance saved', 'success');
        } catch (e) {
          window.ui.toast(e?.data?.message || 'Save failed', 'danger');
        }
      });
    } catch (e) {
      grid.innerHTML = window.ui.emptyState('No access to this class or no data.');
    }
  }

  window.pageStudentAttendance = {
    render() { return `<div id="saWrap">${window.ui.spinner()}</div>`; },
    async mount() {
      const wrap = document.getElementById('saWrap');
      const classes = await loadMyClasses();
      wrap.innerHTML = renderForm({ classes });
      wrap.querySelector('#saLoad')?.addEventListener('click', () => loadRoster(wrap));

      // Auto-load first class if any
      if (classes.length) loadRoster(wrap);
    }
  };
})();
