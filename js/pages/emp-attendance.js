// public/js/pages/emp-attendance.js
(() => {
  async function loadMySchoolMediums() {
    // Ask the API for school_mediums visible to me; RLS limits rows server-side.
    const sm = await api.get('/api/schools/school-mediums', { query: { pageSize: 500 } }).catch(() => ({ data: [] }));
    return sm?.data || [];
  }

  function renderForm(opts) {
    const { combos = [] } = opts;
    const options = combos.map(c => {
      const label = `${c.school_name} — ${c.medium_name}`;
      return `<option value="${c.school_id}:${c.school_medium_id}">${label}</option>`;
    }).join('');

    return `
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="mb-3"><i class="bi bi-person-check me-2"></i>Faculty Attendance</h5>
          <div class="row g-2 align-items-end">
            <div class="col-sm-6">
              <label class="form-label">School / Medium</label>
              <select id="eaCombo" class="form-select">
                ${options || '<option value="">No schools available</option>'}
              </select>
            </div>
            <div class="col-sm-3">
              <label class="form-label">Time</label>
              <input id="eaTime" type="datetime-local" class="form-control" />
            </div>
            <div class="col-sm-3">
              <button id="eaPunch" class="btn btn-primary w-100"><i class="bi bi-geo-alt me-1"></i>Punch Now</button>
            </div>
          </div>

          <hr class="my-4" />
          <h6 class="mb-2">Today’s punches</h6>
          <div id="eaList">${window.ui.spinner('sm')}</div>
        </div>
      </div>
    `;
  }

  function attachHandlers(root, lookup) {
    root.querySelector('#eaPunch')?.addEventListener('click', async () => {
      const combo = root.querySelector('#eaCombo')?.value || '';
      if (!combo) { window.ui.toast('Select a School/Medium first', 'warning'); return; }
      const [school_id, school_medium_id] = combo.split(':').map(x => parseInt(x, 10));

      // browser input (local) -> ISO string. If empty, use current ISO.
      const timeInput = root.querySelector('#eaTime')?.value;
      // Convert local datetime-local string (no timezone) to ISO by appending ':00' if needed
      let punched_at;
      if (timeInput) {
        // timeInput looks like "2025-09-29T19:43"
        // Convert to a proper ISO by treating it as local time
        const dt = new Date(timeInput);
        if (!isNaN(dt.getTime())) punched_at = dt.toISOString();
        else punched_at = new Date().toISOString();
      } else {
        punched_at = new Date().toISOString();
      }

      try {
        await api.post('/api/employee-attendance', { school_id, school_medium_id, punched_at });
        window.ui.toast('Punch recorded', 'success');
        await refreshToday(root, lookup);
      } catch (e) {
        window.ui.toast(e?.data?.message || e.message || 'Failed to punch', 'danger');
      }
    });
  }

  // Helper to format timestamp or date
  function fmtDateTime(value) {
    if (!value) return '—';
    // If value includes time (ISO), new Date works fine
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    // maybe it's YYYY-MM-DD:
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d2 = new Date(value + 'T00:00:00');
      return !isNaN(d2.getTime()) ? d2.toLocaleString() : '—';
    }
    return '—';
  }

  async function refreshToday(root, combos = []) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0,10); // YYYY-MM-DD
    const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1).toISOString().slice(0,10); // next day

    try {
      // Note: backend expects date_from / date_to
      const { data } = await api.get('/api/employee-attendance', { query: { date_from: from, date_to: to, pageSize: 200 } });
      const rows = data || [];
      if (!rows.length) {
        root.querySelector('#eaList').innerHTML = window.ui.emptyState('No punches yet today.');
        return;
      }

      // Build quick lookup maps from combos
      const schoolMap = {};
      const schoolMediumMap = {}; // prefers a specific medium per school if available
      combos.forEach(c => {
        if (c.school_id) schoolMap[c.school_id] = c.school_name || schoolMap[c.school_id] || c.school_id;
        if (c.school_medium_id) schoolMediumMap[c.school_id] = schoolMediumMap[c.school_id] || c.medium_name || null;
      });

      const lis = rows.map(r => {
        // prefer created_at timestamp as punch time; fallback to date
        const time = fmtDateTime(r.created_at || r.punched_at || r.date);

        // school name: prefer r.school_name then lookup
        const schoolName = r.school_name || schoolMap[r.school_id] || r.school_id || '—';

        // medium name: prefer r.medium_name then lookup via combos (best-effort)
        const mediumName = r.medium_name || schoolMediumMap[r.school_id] || (r.medium_id || '—');

        // remarks/status fallback
        const remarks = r.remarks || r.status || '';

        return `
          <tr>
            <td>${time}</td>
            <td>${escapeHtml(schoolName)}</td>
            <td>${escapeHtml(mediumName)}</td>
            <td class="text-muted">${escapeHtml(remarks)}</td>
          </tr>
        `;
      }).join('');

      root.querySelector('#eaList').innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Time</th><th>School</th><th>Medium</th><th>Remarks</th></tr></thead>
            <tbody>${lis}</tbody>
          </table>
        </div>`;
    } catch (e) {
      // RLS/403 or just empty — show informative empty without leaking details
      root.querySelector('#eaList').innerHTML = window.ui.emptyState('No data visible.');
    }
  }

  // small helper to avoid XSS when inserting names into HTML
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.pageEmpAttendance = {
    render() { return `<div id="eaWrap">${window.ui.spinner()}</div>`; },
    async mount() {
      const wrap = document.getElementById('eaWrap');
      try {
        const combos = await loadMySchoolMediums();
        wrap.innerHTML = renderForm({ combos });
        attachHandlers(wrap, combos);
        await refreshToday(wrap, combos);
      } catch (e) {
        wrap.innerHTML = `<div class="alert alert-warning">No visible schools/mediums for your account.</div>`;
      }
    }
  };
})();
