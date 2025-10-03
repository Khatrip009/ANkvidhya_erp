// public/js/pages/dashboard.js
(() => {
  'use strict';

  const charts = { att: null, strength: null };
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  // ---------- helpers ----------
  function toInt(v, fallback = null) {
    if (v == null || v === '') return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  async function fetchSchools() {
    // RLS on /api/schools will already scope this to the caller.
    const res = await api.get('/api/schools', { query: { pageSize: 1000 } });
    return res?.data || [];
  }

  function monthInputValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function renderFilters(schools) {
    const opts = ['<option value="">All schools</option>']
      .concat(schools.map(s => `<option value="${s.school_id}">${escapeHtml(s.school_name)}</option>`))
      .join('');
    return `
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-5">
          <label class="form-label">School</label>
          <select id="fSchool" class="form-select">${opts}</select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Month</label>
          <input id="fMonth" type="month" class="form-control" value="${monthInputValue()}">
        </div>
        <div class="col-6 col-md-2">
          <button id="btnLoad" class="btn btn-primary w-100">
            <span class="btn-text"><i class="bi bi-arrow-repeat me-1"></i>Load</span>
            <span class="btn-spin d-none ms-1 spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    `;
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"'`=\/]/g, function (c) {
      return ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
      })[c];
    });
  }

  function renderKPIs(k) {
    const fmtPct = v => (v == null ? '-%' : `${v}%`);
    const tile = (label, value, icon = 'bi-activity') => `
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-tile">
          <div class="kpi-value"><i class="bi ${icon} me-2"></i>${value ?? '-'}</div>
          <div class="kpi-label">${label}</div>
        </div>
      </div>`;
    return `
      <div class="row g-3 mt-2">
        ${tile('Attendance', fmtPct(k.attendance_pct), 'bi-people')}
        ${tile('LP Coverage', fmtPct(k.lp_coverage_pct), 'bi-mortarboard')}
        ${tile('Class Strength', k.class_strength ?? 0, 'bi-graph-up')}
        ${tile('Sessions', k.sessions ?? 0, 'bi-calendar2-week')}
        ${tile('Lectures', k.lectures ?? 0, 'bi-easel')}
        ${tile('Notebooks', k.notebooks ?? 0, 'bi-journal-check')}
      </div>`;
  }

  function buildCard(title, bodyHtml, toolbarHtml = '') {
    return `
      <div class="card shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="fw-semibold">${escapeHtml(title)}</span>
          <div class="table-toolbar d-flex">${toolbarHtml}</div>
        </div>
        <div class="card-body">${bodyHtml}</div>
      </div>`;
  }

  function getSelectedSchoolIdSafe(allowedSchools) {
    const selEl = document.getElementById('fSchool');
    const chosen = (selEl?.value || '').trim();
    if (!chosen) return ''; // All schools (still RLS-scoped on backend)
    // Only allow ids present in the RLS-scoped list
    return Array.isArray(allowedSchools) && allowedSchools.some(s => String(s.school_id) === String(chosen)) ? chosen : '';
  }

  function setBtnBusy(b) {
    const btn = document.getElementById('btnLoad');
    if (!btn) return;
    btn.disabled = b;
    btn.querySelector('.btn-text')?.classList.toggle('opacity-50', !!b);
    btn.querySelector('.btn-spin')?.classList.toggle('d-none', !b);
  }

  // ---------- draw ----------
  function drawCharts(attRows = [], strRows = []) {
    const attCtx = document.getElementById('attChart');
    const strCtx = document.getElementById('strengthChart');
    if (!window.Chart) return;

    // Attendance trend labels might come as day or label or date
    const attLbl = attRows.map(r => r.day ?? r.label ?? r.date ?? '');
    const attVal = attRows.map(r => Number(r.attendance_pct ?? 0));

    if (charts.att) charts.att.destroy();
    if (attCtx) {
      charts.att = new Chart(attCtx, {
        type: 'line',
        data: { labels: attLbl, datasets: [{ label: 'Attendance %', data: attVal, tension: .3 }] },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
      });
    }

    // Class strength by standard/division
    const sLbl = strRows.map(r => r.name ?? `${r.std_name ?? ''}${r.division_name ? ' - ' + r.division_name : ''}`);
    const sVal = strRows.map(r => Number(r.count ?? r.strength ?? r.students_count ?? 0));

    if (charts.strength) charts.strength.destroy();
    if (strCtx) {
      charts.strength = new Chart(strCtx, {
        type: 'bar',
        data: { labels: sLbl, datasets: [{ label: 'Class Strength', data: sVal }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }
  }

  // ---------- data loads ----------
  async function loadAll(allowedSchools = []) {
    const school_id = getSelectedSchoolIdSafe(allowedSchools);
    const month = document.getElementById('fMonth').value || monthInputValue();

    setBtnBusy(true);

    // KPIs
    let k = {};
    try {
      const kpis = await api.get('/api/dashboard/summary', { query: { school_id, month } });
      k = kpis?.data || {};
    } catch (e) {
      if (e?.status === 401) ui.toast('Session expired. Please sign in again.', 'danger');
      else if (e?.status === 403) ui.toast('You do not have access to this school’s KPIs.', 'warning');
      else ui.toast(e?.message || 'Failed to load KPIs', 'warning');
    }
    const kpiArea = document.getElementById('kpiArea');
    if (kpiArea) kpiArea.innerHTML = renderKPIs(k);

    // Charts
    let att = [], strength = [];
    try {
      const r = await api.get('/api/dashboard/attendance-trend', { query: { school_id, month } });
      att = r?.data || [];
    } catch (e) {
      if (e?.status === 403) ui.toast('Attendance trend is restricted by RLS.', 'warning');
    }
    try {
      const r = await api.get('/api/dashboard/class-strength', { query: { school_id, month } });
      strength = r?.data || [];
    } catch (e) {
      if (e?.status === 403) ui.toast('Class strength is restricted by RLS.', 'warning');
    }
    drawCharts(att, strength);

    // Table (recent sessions) reloaded with same filters
    try {
      await reloadRecentSessionsTable({ school_id, month });
    } catch (ignore) {}

    setBtnBusy(false);
  }

  async function bootstrapNotifications() {
    try {
      const notif = (await api.get('/api/dashboard/notifications'))?.data || [];
      const list = document.getElementById('notifList');
      if (!list) return;
      list.innerHTML = '';
      if (!notif.length) {
        list.innerHTML = '<div class="list-group-item text-muted small">No notifications</div>';
      } else {
        document.getElementById('notifDot')?.classList.remove('d-none');
        notif.slice(0, 20).forEach(n => {
          const li = document.createElement('a');
          li.href = '#';
          li.className = 'list-group-item list-group-item-action';
          li.innerHTML = `<div class="d-flex w-100 justify-content-between">
                            <strong class="mb-1">${escapeHtml(n.title || 'Notification')}</strong>
                            <small class="text-muted">${escapeHtml(n.time || '')}</small>
                          </div>
                          <div class="small text-muted">${escapeHtml(n.body || '')}</div>`;
          list.appendChild(li);
        });
      }
    } catch {
      // silent: notifications are non-critical
    }
  }

  async function loadEmployeeSnapshot() {
    const name = (document.getElementById('empSnapName')?.value || '').trim();
    const month = document.getElementById('empSnapMonth')?.value || monthInputValue();
    const area = document.getElementById('empSnapArea');
    if (!area) return;
    if (!name) { area.textContent = 'Enter employee name & month.'; return; }

    area.innerHTML = ui.spinner('sm');
    try {
      const r = await api.get('/api/dashboard/employee-snapshot', { query: { employee_name: name, month } });
      const d = r?.data || {};
      area.innerHTML = `
        <div class="list-group list-group-flush small">
          <div class="list-group-item d-flex justify-content-between">
            <span>Employee</span><span class="fw-semibold">${escapeHtml(d.employee_name || name)}</span>
          </div>
          <div class="list-group-item d-flex justify-content-between">
            <span>Days Present</span><span class="fw-semibold">${d.present_days ?? '-'}</span>
          </div>
          <div class="list-group-item d-flex justify-content-between">
            <span>Sessions</span><span class="fw-semibold">${d.sessions ?? '-'}</span>
          </div>
          <div class="list-group-item d-flex justify-content-between">
            <span>Notebooks Checked</span><span class="fw-semibold">${d.notebooks ?? '-'}</span>
          </div>
          <div class="list-group-item d-flex justify-content-between">
            <span>Attendance %</span><span class="fw-semibold">${d.attendance_pct != null ? d.attendance_pct + '%' : '-'}</span>
          </div>
        </div>`;
    } catch (e) {
      if (e?.status === 403) area.innerHTML = `<div class="text-muted small">Snapshot restricted by RLS.</div>`;
      else area.innerHTML = `<div class="text-danger small">${escapeHtml(e?.message || 'Failed to load snapshot.')}</div>`;
    }
  }

  // ---------- recent sessions table ----------
  async function setupRecentSessionsTable(allowedSchools = []) {
    const wrap = document.getElementById('tblWrap');
    const pager = document.getElementById('tblPager');
    const search = document.getElementById('tblSearch');
    const selSize = document.getElementById('tblPageSize');

    if (!wrap || !pager || !search || !selSize) return;

    let page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE, q = '';

    async function reloadRecentSessions() {
      wrap.innerHTML = ui.spinner('sm');
      try {
        const school_id = getSelectedSchoolIdSafe(allowedSchools);
        const month = document.getElementById('fMonth').value || monthInputValue();

        const res = await api.get('/api/dashboard/recent-sessions', {
          query: { page, pageSize, search: q, school_id, month }
        });

        const rows = res?.data || [];
        const pg = res?.pagination || { page, pageSize, total: rows.length };

        if (!rows.length) { wrap.innerHTML = ui.emptyState(); pager.innerHTML = ''; return; }

        const thead = `<thead><tr>
            <th>Date</th><th>School</th><th>Std/Div</th><th>Lesson Plan</th><th>Employee</th>
          </tr></thead>`;
        const tb = rows.map(r => `<tr>
            <td>${escapeHtml(r.session_date || r.date || '')}</td>
            <td>${escapeHtml(r.school_name || '')}</td>
            <td>${escapeHtml((r.std_name || '') + (r.division_name ? ' - ' + r.division_name : ''))}</td>
            <td>${escapeHtml(r.lesson_title || r.lesson_plan || '')}</td>
            <td>${escapeHtml(r.employee_name || '')}</td>
          </tr>`).join('');
        wrap.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover align-middle">${thead}<tbody>${tb}</tbody></table></div>`;

        pager.innerHTML = '';
        pager.appendChild(ui.pager({
          page: pg.page, pageSize: pg.pageSize, total: pg.total,
          onPage: p => { page = p; reloadRecentSessions(); }
        }));
      } catch (e) {
        if (e?.status === 403) wrap.innerHTML = ui.emptyState('Restricted by RLS.');
        else wrap.innerHTML = ui.emptyState(e?.message || 'Failed to load.');
      }
    }

    // expose for outer reload
    window.reloadRecentSessionsTable = reloadRecentSessions;

    search.addEventListener('input', ui.debounce(() => { q = search.value.trim(); page = 1; reloadRecentSessions(); }, 400));
    selSize.addEventListener('change', () => { pageSize = parseInt(selSize.value, 10) || DEFAULT_PAGE_SIZE; page = 1; reloadRecentSessions(); });

    reloadRecentSessions();
  }

  // ---------- page ----------
  window.pageDashboard = {
    render() {
      return `
        <div class="row g-3">
          <div class="col-12 col-lg-9">
            ${buildCard('Dashboard Filters', `<div id="filterArea">${ui.spinner()}</div>`)}
            <div id="kpiArea" class="mt-3">${ui.spinner()}</div>

            <div class="row mt-3 g-3">
              <div class="col-12 col-lg-6">
                ${buildCard('Attendance Trend', `<canvas id="attChart" height="160"></canvas>`)}
              </div>
              <div class="col-12 col-lg-6">
                ${buildCard('Class Strength', `<canvas id="strengthChart" height="160"></canvas>`)}
              </div>
            </div>

            <!-- Recent sessions -->
            <div class="mt-3">
              ${buildCard('Recent Sessions',
                `<div class="d-flex table-toolbar">
                   <input id="tblSearch" class="form-control form-control-sm" placeholder="Search...">
                   <div class="ms-auto">
                     <select id="tblPageSize" class="form-select form-select-sm" style="width:auto;display:inline-block">
                       <option>10</option><option>20</option><option>50</option>
                     </select>
                   </div>
                 </div>
                 <div id="tblWrap" class="mt-3">${ui.emptyState('No sessions')}</div>
                 <div id="tblPager" class="mt-2"></div>`
              )}
            </div>
          </div>

          <div class="col-12 col-lg-3">
            ${buildCard('Employee Snapshot',
              `<div class="mb-2">
                 <label class="form-label">Employee Name</label>
                 <input id="empSnapName" class="form-control" placeholder="e.g. Priya Shah">
               </div>
               <div class="mb-2">
                 <label class="form-label">Month</label>
                 <input id="empSnapMonth" type="month" class="form-control" value="${monthInputValue()}">
               </div>
               <button id="btnLoadEmpSnap" class="btn btn-secondary w-100"><i class="bi bi-search"></i> Load</button>
               <div id="empSnapArea" class="mt-3 text-muted small">Enter employee name & month.</div>`
            )}
          </div>
        </div>`;
    },

    async mount() {
      // Profile header (optional)
      try {
        const me = await api.get('/api/auth/me');
        if (me?.data) {
          const el = document.getElementById('topProfileName');
          if (el) {
            el.textContent = me.data.username || me.data.employee_name || me.data.full_name || 'Profile';
          }
        }
      } catch (e) {
        if (e?.status === 401) {
          ui.toast('Session expired. Please sign in again.', 'danger');
          return;
        }
      }

      // Try role-aware bootstrap (doesn't block anything)
      try {
        const roleDash = await api.get('/api/dashboard/my');
        if (roleDash?.bootstrap?.notifications?.length) {
          document.getElementById('notifDot')?.classList.remove('d-none');
        }
      } catch {
        // ignore; feature optional
      }

      // Notifications (non-blocking)
      bootstrapNotifications();

      // Filters: RLS-scoped schools + month
      let schools = [];
      try {
        schools = await fetchSchools();
      } catch (e) {
        ui.toast(e?.message || 'Failed to load schools', 'danger');
      }

      const filterArea = document.getElementById('filterArea');
      if (filterArea) filterArea.innerHTML = renderFilters(schools);

      // If user has exactly one school in scope, preselect it
      const selSchool = document.getElementById('fSchool');
      if (Array.isArray(schools) && schools.length === 1 && selSchool) {
        selSchool.value = String(schools[0].school_id);
      }

      document.getElementById('btnLoad')?.addEventListener('click', () => loadAll(schools));
      document.getElementById('btnLoadEmpSnap')?.addEventListener('click', loadEmployeeSnapshot);

      // Table setup
      await setupRecentSessionsTable(schools);

      // Initial load
      await loadAll(schools);
    }
  };

  // expose for other modules if needed
  async function reloadRecentSessionsTable({ school_id, month } = {}) {
    // The table reload function already reads #fMonth and #fSchool,
    // this wrapper keeps API consistent with existing callers.
    if (typeof window.reloadRecentSessionsTable === 'function') {
      await window.reloadRecentSessionsTable();
    }
  }
})();
