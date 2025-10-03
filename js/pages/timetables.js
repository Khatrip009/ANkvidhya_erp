// public/js/pages/timetables.js
(() => {
  'use strict';

  const todayISO = (d = new Date()) => d.toISOString().slice(0,10);
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const fmt = s => (s == null ? '' : String(s));
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 50;
  const SORTABLE_COLS = ['school_name','medium_name','std_name','division_name','employee_name','day_of_week','period_no'];

  const BULK_INSERT_URL = '/api/timetables/bulk/insert'; // must match your backend route

  /* ---------------- Utility ---------------- */
  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"'`=\/]/g, function (c) {
      return ({"&": '&amp;', "<": '&lt;', ">": '&gt;', '"': '&quot;', "'": '&#39;', "/": '&#x2F;', "`": '&#x60;', "=": '&#x3D;'})[c];
    });
  }

  function dayNameToNumber(name) {
    if (!name) return null;
    const m = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7
    };
    return m[String(name).trim().toLowerCase()] || null;
  }

  /* ---------------- Render UI ---------------- */
  function renderControls({ filters = {}, lookups = {}, sort = {} } = {}) {
    const { schools = [], mediums = [], standards = [], divisions = [], employees = [] } = lookups;
    const schoolOptions = ['<option value="">— any —</option>']
      .concat(schools.map(s => `<option value="${s.school_id}" ${filters.school_id==s.school_id?'selected':''}>${escapeHtml(s.school_name)}</option>`))
      .join('');
    const mediumOptions = ['<option value="">— any —</option>']
      .concat(mediums.map(m => `<option value="${m.medium_id}" ${filters.medium_id==m.medium_id?'selected':''}>${escapeHtml(m.medium_name)}</option>`))
      .join('');
    const stdOptions = ['<option value="">— any —</option>']
      .concat(standards.map(s => `<option value="${s.std_id}" ${filters.std_id==s.std_id?'selected':''}>${escapeHtml(s.std_name)}</option>`))
      .join('');
    const divOptions = ['<option value="">— any —</option>']
      .concat(divisions.map(d => `<option value="${d.div_id}" ${filters.div_id==d.div_id?'selected':''}>${escapeHtml(d.division_name)}</option>`))
      .join('');
    const empOptions = ['<option value="">— any —</option>']
      .concat(employees.map(e => `<option value="${e.employee_id}" ${filters.employee_id==e.employee_id?'selected':''}>${escapeHtml(e.full_name)}</option>`))
      .join('');

    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between mb-2">
            <div><strong>Timetables</strong></div>
            <div class="btn-group">
              <button id="ttAdd" class="btn btn-sm btn-success">Add Daily Timetable</button>
              <label class="btn btn-sm btn-outline-secondary mb-0">
                Import CSV <input id="ttImportFile" type="file" accept=".csv" hidden>
              </label>
              <button id="ttExportCSV" class="btn btn-sm btn-outline-secondary">Export CSV</button>
            </div>
          </div>

          <div class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label">Search</label>
              <input id="ttSearch" class="form-control" placeholder="school, medium, std, employee..." value="${escapeHtml(filters.search || '')}">
            </div>

            <div class="col-md-2">
              <label class="form-label">School</label>
              <select id="ttSchool" class="form-select">${schoolOptions}</select>
            </div>

            <div class="col-md-2">
              <label class="form-label">Medium</label>
              <select id="ttMedium" class="form-select">${mediumOptions}</select>
            </div>

            <div class="col-md-1">
              <label class="form-label">Std</label>
              <select id="ttStd" class="form-select">${stdOptions}</select>
            </div>

            <div class="col-md-1">
              <label class="form-label">Div</label>
              <select id="ttDiv" class="form-select">${divOptions}</select>
            </div>

            <div class="col-md-2">
              <label class="form-label">Faculty</label>
              <select id="ttEmployee" class="form-select">${empOptions}</select>
            </div>

            <div class="col-md-1 d-grid">
              <button id="ttSearchBtn" class="btn btn-primary">Search</button>
            </div>
          </div>

          <hr/>

          <div class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label">Date for sessions</label>
              <input id="ttSessionDate" type="date" class="form-control" value="${todayISO()}">
            </div>
            <div class="col-md-3 d-grid">
              <button id="ttCreateSessions" class="btn btn-outline-success">Create Sessions from Timetable</button>
            </div>
            <div class="col-md-3 d-grid">
              <button id="ttRefreshToday" class="btn btn-outline-primary">Refresh Today's Sessions</button>
            </div>
            <div class="col-md-3 d-grid">
              <select id="ttPageSize" class="form-select">
                <option ${DEFAULT_PAGE_SIZE==25?'selected':''}>25</option>
                <option ${DEFAULT_PAGE_SIZE==50?'selected':''}>50</option>
                <option ${DEFAULT_PAGE_SIZE==100?'selected':''}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function headerWithSort(display, col, sort) {
    const dir = (sort.col === col) ? sort.dir : null;
    const chevron = dir ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable" data-col="${col}" style="cursor:pointer">${escapeHtml(display)}${chevron}</th>`;
  }

  function renderTimetableTable({ rows = [], page = 1, pageSize = DEFAULT_PAGE_SIZE, total = 0, sort = {} } = {}) {
    if (!rows.length) {
      return `<div class="card"><div class="card-body">${window.ui.emptyState('No timetables')}</div></div>`;
    }
    const header = [
      '<th>#</th>',
      headerWithSort('School','school_name', sort),
      headerWithSort('Medium','medium_name', sort),
      headerWithSort('Class','std_name', sort),
      headerWithSort('Faculty','employee_name', sort),
      headerWithSort('Day / Period','day_of_week', sort),
      '<th>Remark</th>',
      '<th></th>'
    ].join('');

    const trs = rows.map(r => `
      <tr data-id="${r.timetable_id}">
        <td class="text-muted">${r.timetable_id}</td>
        <td data-field="school_name">${escapeHtml(r.school_name || '')}</td>
        <td data-field="medium_name">${escapeHtml(r.medium_name || '')}</td>
        <td data-field="std_name">${escapeHtml(r.std_name || '')}${r.division_name ? ' / ' + escapeHtml(r.division_name) : ''}</td>
        <td data-field="employee_name">${escapeHtml(r.employee_name || '')}</td>
        <td data-field="day_period">${escapeHtml(r.day_of_week || '')} (P${escapeHtml(r.period_no || '')})</td>
        <td data-field="remark">${escapeHtml(r.remark || '')}</td>
        <td class="text-end">
          <div class="btn-group table-actions">
            <button class="btn btn-sm btn-outline-primary tt-inline-edit" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger tt-delete" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    const pager = `Showing ${(page-1)*pageSize+1} - ${Math.min(page*pageSize, total)} of ${total}`;
    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-sm align-middle">
              <thead><tr>${header}</tr></thead>
              <tbody>${trs}</tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">${pager}</small>
            <div>
              <button id="ttPrev" class="btn btn-sm btn-outline-secondary me-1">Prev</button>
              <button id="ttNext" class="btn btn-sm btn-outline-secondary">Next</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCalendarList({ date, sessions = [] } = {}) {
    const title = `Sessions for ${date}`;
    if (!sessions.length) {
      return `<div class="card shadow-sm"><div class="card-body"><h6>${escapeHtml(title)}</h6>${window.ui.emptyState('No sessions for this date')}</div></div>`;
    }
    const items = sessions.map(s => `
      <div class="list-group-item">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <strong>${escapeHtml(s.school_name)} — Std ${escapeHtml(s.std_name)} ${s.division_name ? ' / ' + escapeHtml(s.division_name) : ''}</strong>
            <div class="small text-muted">${escapeHtml(s.employee_name)} — period ${escapeHtml(s.period_no)} ${s.start_time ? ' | ' + escapeHtml(s.start_time) + ' - ' + escapeHtml(s.end_time || '') : ''}</div>
            <div class="small">${s.lessonplan_id ? 'LessonPlan: ' + escapeHtml(s.lessonplan_id) : ''} ${escapeHtml(s.timetable_remark || '')}</div>
          </div>
          <div class="text-end">
            <small class="text-muted">cs_id: ${escapeHtml(s.cs_id)}</small><br/>
            <a href="#/student-attendance?school_class_id=${s.school_id}:${s.medium_id}:${s.std_id}:${s.div_id}&date=${date}" class="btn btn-sm btn-outline-primary mt-2">Open Attendance</a>
          </div>
        </div>
      </div>
    `).join('');
    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h6>${escapeHtml(title)}</h6>
          <div class="list-group">${items}</div>
        </div>
      </div>
    `;
  }

  /* ---------------- Lookup loaders ---------------- */
  async function loadLookupMaster(tableName) {
    try {
      const res = await api.get('/api/master', { query: { table: tableName, pageSize: 1000 } });
      return res?.data || [];
    } catch (e) {
      return [];
    }
  }

  async function loadLookup(path, params = {}) {
    try {
      const res = await api.get(path, { query: params });
      return res?.data || [];
    } catch (e) {
      return [];
    }
  }

  async function loadAllLookups() {
    const [schools, mediums, standards, divisions, employees] = await Promise.all([
      loadLookup('/api/schools', { pageSize: 500 }),
      loadLookupMaster('medium'),
      loadLookupMaster('standards'),
      loadLookupMaster('divisions'),
      loadLookup('/api/employees', { pageSize: 500 })
    ]);
    return { schools, mediums, standards, divisions, employees };
  }

  /* ---------------- Data loaders / actions ---------------- */
  async function loadTimetables({ page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE, filters = {}, sort = {} } = {}) {
    const q = Object.assign({
      page, pageSize,
      search: filters.search || '',
      school_name: filters.school_name || '',
      std_name: filters.std_name || '',
      employee_name: filters.employee_name || '',
      sort_by: sort.col || '',
      sort_dir: sort.dir || ''
    });
    const res = await api.get('/api/timetables', { query: q });
    return { data: res?.data || [], pagination: res?.pagination || { page, pageSize, total: 0 } };
  }

  async function createTimetable(payload) {
    const res = await api.post('/api/timetables', payload);
    return res?.data || {};
  }

  async function updateTimetable(id, payload) {
    const res = await api.put(`/api/timetables/${id}`, payload);
    return res?.data || {};
  }

  async function deleteTimetable(id) {
    const res = await api.delete(`/api/timetables/${id}`);
    return res?.data || {};
  }

  async function exportTimetablesCSV({ filters = {}, sort = {} } = {}) {
    try {
      const query = new URLSearchParams({
        search: filters.search || '',
        school_name: filters.school_name || '',
        std_name: filters.std_name || '',
        employee_name: filters.employee_name || '',
        sort_by: sort.col || '',
        sort_dir: sort.dir || ''
      });
      const url = '/api/timetables/export/csv?' + query.toString();
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      const u = URL.createObjectURL(blob);
      a.href = u;
      a.download = `timetables_${todayISO()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
      window.ui.toast('Export started', 'success');
    } catch (e) {
      window.ui.toast(e?.message || 'Export failed', 'danger');
    }
  }

  // Import preview: parse CSV client-side and show confirmation; if confirmed send entire CSV text as JSON.body.csv
  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const parseRow = (line) => {
      const out = []; let cur = ''; let q=false;
      for (let i=0;i<line.length;i++){
        const ch=line[i];
        if (ch === '"'){ if(q && line[i+1]==='"'){cur+='"'; i++; continue;} q=!q; continue; }
        if (!q && ch === ','){ out.push(cur); cur=''; continue; }
        cur += ch;
      }
      out.push(cur);
      return out;
    };
    const headers = parseRow(lines[0]).map(h=>h.trim().toLowerCase());
    const rows = [];
    for (let i=1;i<lines.length;i++){
      const cols = parseRow(lines[i]);
      const obj = {};
      for (let j=0;j<headers.length;j++) obj[headers[j]] = (cols[j] ?? '').trim();
      rows.push(obj);
    }
    return rows;
  }

  async function importTimetablesCSVText(csvText) {
    try {
      const res = await api.post('/api/timetables/import/csv', { csv: csvText });
      window.ui.toast(res?.data?.message || 'Import completed', 'success');
      return res;
    } catch (e) {
      window.ui.toast(e?.data?.message || e?.message || 'Import failed', 'danger');
      throw e;
    }
  }

  async function loadClassSessionsForDate(date) {
    try {
      const res = await api.get('/api/class-sessions', { query: { session_date: date, pageSize: 500 } });
      return res?.data || [];
    } catch (e) {
      window.ui.toast('Failed to load sessions for date', 'warning');
      return [];
    }
  }

  async function createSessionsFromTimetable(date, opts = {}) {
    const payload = Object.assign({ session_date: date }, opts);
    const res = await api.post('/api/class-sessions/from-timetable', payload);
    return res?.data || {};
  }

  /* ---------------- Inline edit helpers ---------------- */
  function makeRowEditable(tr, lookups) {
    const id = tr.getAttribute('data-id');
    const getText = sel => tr.querySelector(`[data-field="${sel}"]`)?.textContent?.trim() || '';
    const current = {
      school_name: getText('school_name'),
      medium_name: tr.querySelector('[data-field="medium_name"]')?.textContent?.trim() || '',
      std_name: (tr.querySelector('[data-field="std_name"]')?.textContent || '').split('/')[0].trim(),
      division_name: (tr.querySelector('[data-field="std_name"]')?.textContent || '').split('/')[1]?.trim() || '',
      employee_name: getText('employee_name'),
      day_of_week: (tr.querySelector('[data-field="day_period"]')?.textContent || '').split('(')[0].trim(),
      period_no: (tr.querySelector('[data-field="day_period"]')?.textContent || '').match(/\(P(\d+)\)/)?.[1] || '',
      remark: getText('remark')
    };

    // replace cells with inputs/selects
    tr.querySelector('[data-field="school_name"]').innerHTML = `<input class="form-control form-control-sm edt-school" value="${escapeHtml(current.school_name)}">`;
    tr.querySelector('[data-field="medium_name"]').innerHTML = `<input class="form-control form-control-sm edt-medium" value="${escapeHtml(current.medium_name)}">`;
    tr.querySelector('[data-field="std_name"]').innerHTML = `<input class="form-control form-control-sm edt-std" value="${escapeHtml(current.std_name)}">`;
    tr.querySelector('[data-field="employee_name"]').innerHTML = `<input class="form-control form-control-sm edt-emp" value="${escapeHtml(current.employee_name)}">`;
    tr.querySelector('[data-field="day_period"]').innerHTML = `<select class="form-select form-select-sm edt-day">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>`<option ${d===current.day_of_week?'selected':''}>${d}</option>`).join('')}</select><input class="form-control form-control-sm mt-1 edt-period" type="number" value="${escapeHtml(current.period_no)}">`;
    tr.querySelector('[data-field="remark"]').innerHTML = `<input class="form-control form-control-sm edt-remark" value="${escapeHtml(current.remark)}">`;

    // swap action buttons
    const actionTd = tr.querySelector('td:last-child');
    actionTd.innerHTML = `<div class="btn-group">
      <button class="btn btn-sm btn-primary tt-inline-save">Save</button>
      <button class="btn btn-sm btn-secondary tt-inline-cancel">Cancel</button>
    </div>`;

    // wire save/cancel
    actionTd.querySelector('.tt-inline-cancel').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('timetables.reloadRows'));
    });

    actionTd.querySelector('.tt-inline-save').addEventListener('click', async () => {
      const payload = {
        school_name: tr.querySelector('.edt-school')?.value || '',
        medium_name: tr.querySelector('.edt-medium')?.value || '',
        std_name: tr.querySelector('.edt-std')?.value || '',
        employee_name: tr.querySelector('.edt-emp')?.value || '',
        day_of_week: dayNameToNumber(tr.querySelector('.edt-day')?.value || '') || null,
        period_no: Number(tr.querySelector('.edt-period')?.value || '') || null,
        remark: tr.querySelector('.edt-remark')?.value || ''
      };
      try {
        await updateTimetable(id, payload);
        window.ui.toast('Saved', 'success');
        document.dispatchEvent(new CustomEvent('timetables.reloadRows'));
      } catch (e) {
        // api wrapper should show error
      }
    });
  }

  /* ---------------- Daily timetable builder (bulk insert) ---------------- */
  function renderDailyBuilder(lookups) {
    // lookups: schools, mediums, standards, divisions, employees
    const mediumOptions = (lookups.mediums||[]).map(m => `<option>${escapeHtml(m.medium_name)}</option>`).join('');
    const schoolOptions = (lookups.schools||[]).map(s => `<option value="${escapeHtml(s.school_name)}">${escapeHtml(s.school_name)}</option>`).join('');
    const empOptions = (lookups.employees||[]).map(e => `<option value="${escapeHtml(e.full_name)}">${escapeHtml(e.full_name)}</option>`).join('');
    const stdOptions = (lookups.standards||[]).map(s => `<option value="${escapeHtml(s.std_name)}">${escapeHtml(s.std_name)}</option>`).join('');
    const divOptions = (lookups.divisions||[]).map(d => `<option value="${escapeHtml(d.division_name)}">${escapeHtml(d.division_name)}</option>`).join('');

    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="mb-0">Create Daily Timetable</h5>
            <img src="/images/Ank_Logo.png" style="height:56px" alt="logo">
          </div>

          <div id="dtTop" class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label">Medium</label>
              <select id="dt_medium" class="form-select">${mediumOptions}</select>
            </div>
            <div class="col-md-3">
              <label class="form-label">School</label>
              <select id="dt_school" class="form-select"><option value="">-- select school --</option>${schoolOptions}</select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Faculty</label>
              <select id="dt_faculty" class="form-select"><option value="">-- select faculty --</option>${empOptions}</select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Day of Week</label>
              <select id="dt_day" class="form-select">
                <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option>
              </select>
            </div>
          </div>

          <hr/>

          <div id="dtRowsWrap">
            <div class="d-flex gap-2 mb-2 dt-row align-items-center">
              <div class="flex-shrink-0" style="min-width:90px">
                <label class="form-label small mb-1">Std</label>
                <select class="form-select form-select-sm dt-std">${stdOptions}</select>
              </div>
              <div class="flex-shrink-0" style="min-width:80px">
                <label class="form-label small mb-1">Div</label>
                <select class="form-select form-select-sm dt-div">${divOptions}</select>
              </div>
              <div class="flex-grow-1" style="min-width:120px">
                <label class="form-label small mb-1">Period</label>
                <input class="form-control form-control-sm dt-period" type="number" value="1">
              </div>
              <div class="flex-grow-1">
                <label class="form-label small mb-1">Remark</label>
                <input class="form-control form-control-sm dt-remark">
              </div>
              <div class="flex-shrink-0" style="min-width:32px; margin-top:22px">
                <button class="btn btn-sm btn-outline-danger dt-row-remove" title="Remove row">X</button>
              </div>
            </div>
          </div>

          <div class="d-flex gap-2">
            <button id="dtAddRow" class="btn btn-sm btn-outline-secondary">Add Row</button>
            <button id="dtInsert" class="btn btn-sm btn-success ms-auto">Insert Timetable</button>
          </div>
        </div>
      </div>
    `;
  }

  function createDtRowHtml(lookups) {
    const stdOptions = (lookups.standards||[]).map(s => `<option value="${escapeHtml(s.std_name)}">${escapeHtml(s.std_name)}</option>`).join('');
    const divOptions = (lookups.divisions||[]).map(d => `<option value="${escapeHtml(d.division_name)}">${escapeHtml(d.division_name)}</option>`).join('');
    return `
      <div class="d-flex gap-2 mb-2 dt-row align-items-center">
        <div class="flex-shrink-0" style="min-width:90px">
          <select class="form-select form-select-sm dt-std">${stdOptions}</select>
        </div>
        <div class="flex-shrink-0" style="min-width:80px">
          <select class="form-select form-select-sm dt-div">${divOptions}</select>
        </div>
        <div class="flex-grow-1" style="min-width:120px">
          <input class="form-control form-control-sm dt-period" type="number" value="1">
        </div>
        <div class="flex-grow-1">
          <input class="form-control form-control-sm dt-remark">
        </div>
        <div class="flex-shrink-0" style="min-width:32px;">
          <button class="btn btn-sm btn-outline-danger dt-row-remove" title="Remove row">X</button>
        </div>
      </div>
    `;
  }

  // collects rows and returns array suitable for bulk insert endpoint
  function collectDailyRows(container, topContext) {
    const rows = [];
    const schoolName = (topContext.school || '').trim();
    const faculty = (topContext.faculty || '').trim();
    const medium = (topContext.medium || '').trim();

    const dayName = (topContext.day || '').trim();
    const day = dayNameToNumber(dayName);

    if (!schoolName) throw new Error('Please select a school');
    if (!day) throw new Error('Please select a valid day');

    const rowEls = Array.from(container.querySelectorAll('.dt-row'));
    for (const r of rowEls) {
      const std = (r.querySelector('.dt-std')?.value || '').trim();
      const div = (r.querySelector('.dt-div')?.value || '').trim();
      const periodRaw = (r.querySelector('.dt-period')?.value || '').trim();
      const remark = (r.querySelector('.dt-remark')?.value || '').trim();

      const period_no = periodRaw === '' ? null : Number(periodRaw);

      if (!schoolName || !day || period_no == null || Number.isNaN(period_no)) {
        throw new Error('Each row requires school, day_of_week and period_no');
      }

      rows.push({
        school_name: schoolName,
        medium_name: medium || null,
        std_name: std || null,
        division_name: div || null,
        employee_name: faculty || null,
        day_of_week: day,   // numeric
        period_no: period_no,
        remark: remark || null
      });
    }

    if (!rows.length) throw new Error('Add at least one row');
    return rows;
  }

  // perform the bulk insert by posting to backend route
  async function bulkInsertTimetableRows(rows) {
    // POST to match server route
    const res = await api.post(BULK_INSERT_URL, rows);
    return res?.data || {};
  }

  /* ---------------- Page lifecycle ---------------- */
  async function mount(root) {
    let page = DEFAULT_PAGE;
    let pageSize = DEFAULT_PAGE_SIZE;
    let filters = { search: '', school_id: '', medium_id: '', std_id: '', div_id: '', employee_id: '' };
    let sort = { col: '', dir: '' };

    root.innerHTML = `
      <div id="ttControls"></div>
      <div id="dtBuilder"></div>
      <div id="ttCalendar"></div>
      <div id="ttList"></div>
    `;
    const controlsRoot = qs('#ttControls');
    const builderRoot = qs('#dtBuilder');
    const calendarRoot = qs('#ttCalendar');
    const listRoot = qs('#ttList');

    calendarRoot.innerHTML = window.ui.spinner();
    const lookups = await loadAllLookups();

    controlsRoot.innerHTML = renderControls({ filters, lookups, sort });
    builderRoot.innerHTML = renderDailyBuilder(lookups);

    // element refs after render
    const elSearch = qs('#ttSearch');
    const elSchool = qs('#ttSchool');
    const elStd = qs('#ttStd');
    const elEmployee = qs('#ttEmployee');
    const elPageSize = qs('#ttPageSize');

    // builder refs
    const dtRowsWrap = qs('#dtRowsWrap');
    const dtAddRowBtn = qs('#dtAddRow');
    const dtInsertBtn = qs('#dtInsert');

    // wire add-row
    dtAddRowBtn?.addEventListener('click', () => {
      dtRowsWrap.insertAdjacentHTML('beforeend', createDtRowHtml(lookups));
      // wire new row remove
      dtRowsWrap.querySelectorAll('.dt-row-remove').forEach(b => {
        b.onclick = (ev) => {
          ev.currentTarget.closest('.dt-row')?.remove();
        };
      });
    });

    // wire initial remove buttons
    dtRowsWrap.querySelectorAll('.dt-row-remove').forEach(b => {
      b.onclick = (ev) => {
        ev.currentTarget.closest('.dt-row')?.remove();
      };
    });

    // Insert timetable action (bulk)
    dtInsertBtn?.addEventListener('click', async () => {
      try {
        const topContext = {
          school: qs('#dt_school')?.value || '',
          faculty: qs('#dt_faculty')?.value || '',
          medium: qs('#dt_medium')?.value || '',
          day: qs('#dt_day')?.value || ''
        };
        const rows = collectDailyRows(dtRowsWrap, topContext);
        // confirm summary
        const summary = `${rows.length} rows — school: ${topContext.school}, day: ${topContext.day}, faculty: ${topContext.faculty || '—'}`;
        if (!confirm(`Insert the following daily timetable?\n${summary}`)) return;
        // call backend
        const resp = await bulkInsertTimetableRows(rows);
        window.ui.toast(`Inserted ${resp.inserted_count || rows.length} timetable rows`, 'success');
        // optionally refresh list and calendar
        document.dispatchEvent(new CustomEvent('timetables.reloadRows'));
      } catch (err) {
        window.ui.toast(err?.message || 'Failed to insert timetables', 'danger');
      }
    });

    async function refreshTimetables() {
      listRoot.innerHTML = window.ui.spinner();
      try {
        const reqFilters = {
          search: elSearch?.value || '',
          school_name: (elSchool && elSchool.value) ? elSchool.options[elSchool.selectedIndex].text : '',
          std_name: (elStd && elStd.value) ? elStd.options[elStd.selectedIndex].text : '',
          employee_name: (elEmployee && elEmployee.value) ? elEmployee.options[elEmployee.selectedIndex].text : ''
        };
        pageSize = Number(elPageSize?.value) || pageSize;
        const out = await loadTimetables({ page, pageSize, filters: reqFilters, sort });
        listRoot.innerHTML = renderTimetableTable({ rows: out.data, page: out.pagination.page, pageSize: out.pagination.pageSize, total: out.pagination.total, sort });

        // attach inline edit row actions
        qsa('.tt-inline-edit').forEach(btn => btn.addEventListener('click', (ev) => {
          const tr = ev.currentTarget.closest('tr[data-id]');
          if (!tr) return;
          makeRowEditable(tr, lookups);
        }));

        // attach delete
        qsa('.tt-delete').forEach(btn => btn.addEventListener('click', async (ev) => {
          const id = ev.currentTarget.closest('tr[data-id]')?.getAttribute('data-id');
          if (!id) return;
          if (!confirm(`Delete timetable ${id}?`)) return;
          try {
            await deleteTimetable(id);
            window.ui.toast('Deleted', 'success');
            // reload
            if (out.data.length === 1 && page > 1) page--;
            await refreshTimetables();
          } catch (e) {}
        }));

        // attach prev/next
        qs('#ttPrev')?.addEventListener('click', () => { if (page>1) { page--; refreshTimetables(); }});
        qs('#ttNext')?.addEventListener('click', () => { page++; refreshTimetables(); });

        // attach sortable headers
        qsa('th.sortable').forEach(th => {
          th.onclick = () => {
            const col = th.getAttribute('data-col');
            if (!SORTABLE_COLS.includes(col)) return;
            if (sort.col === col) sort.dir = (sort.dir === 'asc') ? 'desc' : 'asc';
            else { sort.col = col; sort.dir = 'asc'; }
            page = 1;
            refreshTimetables();
          };
        });
      } catch (e) {
        listRoot.innerHTML = window.ui.emptyState('Failed to load timetables');
      }
    }

    async function refreshCalendar() {
      const date = qs('#ttSessionDate')?.value || todayISO();
      calendarRoot.innerHTML = window.ui.spinner();
      const sessions = await loadClassSessionsForDate(date);
      calendarRoot.innerHTML = renderCalendarList({ date, sessions });
    }

    // wire controls
    qs('#ttSearchBtn')?.addEventListener('click', () => { page = 1; refreshTimetables(); });
    qs('#ttRefreshToday')?.addEventListener('click', () => refreshCalendar());
    qs('#ttPageSize')?.addEventListener('change', () => { page = 1; refreshTimetables(); });

    // Add daily builder focus (open builder present already)
    qs('#ttAdd')?.addEventListener('click', () => {
      // scroll to builder
      builderRoot.scrollIntoView({ behavior: 'smooth' });
    });

    // Export
    qs('#ttExportCSV')?.addEventListener('click', () => exportTimetablesCSV({}));

    // Import: preview step
    const importFileEl = qs('#ttImportFile');
    if (importFileEl) {
      importFileEl.addEventListener('change', async (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        const txt = await f.text();
        const parsed = parseCSVText(txt);
        if (!parsed.length) {
          window.ui.toast('No rows found in CSV', 'warning');
          importFileEl.value = '';
          return;
        }
        // build preview HTML
        const previewRows = parsed.slice(0, 50).map(r => `<tr>${Object.keys(r).map(k=>`<td>${escapeHtml(r[k])}</td>`).join('')}</tr>`).join('');
        const headers = Object.keys(parsed[0] || {}).map(h=>`<th>${escapeHtml(h)}</th>`).join('');
        const html = `<div><p>Previewing ${parsed.length} rows (${parsed.length>50? 'showing first 50':''})</p><div class="table-responsive"><table class="table table-sm"><thead><tr>${headers}</tr></thead><tbody>${previewRows}</tbody></table></div></div>`;
        const confirmed = await window.ui.confirm ? await window.ui.confirm({ title: 'Import preview', body: html, okText: 'Import' }) : confirm('Import CSV? Proceed?');
        if (confirmed) {
          try {
            await importTimetablesCSVText(txt);
            await refreshTimetables();
          } catch (e) { /* handled */ }
        }
        importFileEl.value = '';
      });
    }

    // Create sessions from timetable
    qs('#ttCreateSessions')?.addEventListener('click', async () => {
      const date = qs('#ttSessionDate')?.value || todayISO();
      if (!date) { window.ui.toast('Pick a date', 'warning'); return; }

      const payloadOpts = {};
      const schoolSel = qs('#ttSchool'); if (schoolSel && schoolSel.value) payloadOpts.school_id = Number(schoolSel.value);
      const mediumSel = qs('#ttMedium'); if (mediumSel && mediumSel.value) payloadOpts.medium_id = Number(mediumSel.value);
      const stdSel = qs('#ttStd'); if (stdSel && stdSel.value) payloadOpts.std_id = Number(stdSel.value);
      const divSel = qs('#ttDiv'); if (divSel && divSel.value) payloadOpts.div_id = Number(divSel.value);
      const empSel = qs('#ttEmployee'); if (empSel && empSel.value) payloadOpts.employee_id = Number(empSel.value);

      if (!payloadOpts.school_id && !payloadOpts.std_id && !payloadOpts.employee_id) {
        if (!confirm('No school/std/faculty filter selected — this will attempt to create sessions for all accessible timetables. Continue?')) return;
      }

      try {
        const resp = await createSessionsFromTimetable(date, payloadOpts);
        const created = resp?.created_count ?? resp?.data?.created_count ?? 0;
        window.ui.toast(`${created} sessions created`, 'success');
        refreshCalendar();
      } catch (e) {
        window.ui.toast(e?.data?.message || e?.message || 'Failed to create sessions', 'danger');
      }
    });

    // external reload hook (e.g., cancel inline edit)
    document.addEventListener('timetables.reloadRows', () => { refreshTimetables(); });

    // initial load
    await refreshTimetables();
    await refreshCalendar();
  }

  window.pageTimetables = {
    render() { return `<div id="ttPage" class="p-2">${window.ui.spinner()}</div>`; },
    async mount() { const root = document.getElementById('ttPage'); if (!root) return; await mount(root); }
  };
})();
