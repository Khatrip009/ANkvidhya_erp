// public/js/pages/reports.js
/* global DataGrid, api */
window.pageReports = (() => {
  // small helper to build querystring from params object (ignores empty values)
  function buildQs(params = {}) {
    const parts = [];
    for (const k in params) {
      if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
      const v = params[k];
      if (v === undefined || v === null || v === '') continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
  }

  // Toolbar HTML (search, school filter, employee filter, page size, export dropdown)
  function createToolbarHtml(storageKey, reportSlug) {
    return `
      <div class="d-flex align-items-center mb-2 report-toolbar" data-storage="${storageKey}" data-report="${reportSlug}">
        <input class="form-control form-control-sm me-2 rp-search" placeholder="Search..." style="width:220px" />
        <input class="form-control form-control-sm me-2 rp-filter-school" placeholder="School name" style="width:180px" />
        <input class="form-control form-control-sm me-2 rp-filter-employee" placeholder="Employee name" style="width:180px" />
        <select class="form-select form-select-sm me-2 rp-page-size" style="width:90px">
          <option value="10">10</option>
          <option value="25" selected>25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Export</button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item rp-export-pdf" href="#">Export PDF</a></li>
            <li><a class="dropdown-item rp-export-excel" href="#">Export Excel</a></li>
          </ul>
        </div>
      </div>
    `;
  }

  // Render tabs and containers
  function render() {
    return `
      <ul class="nav nav-tabs" id="reportTabs" role="tablist">
        <li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#tabSessions">Class Sessions</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabFdp">Faculty Daily Progress</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabStrength">Class Strength</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabAttendanceDaily">Attendance Daily</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabAttendanceMonthly">Attendance Monthly</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabEmployees">Employees</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabEmpAttendance">Employee Attendance</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabTeacherLoad">Teacher Load</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabExpenses">Expenses Monthly</a></li>
        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#tabStudents">Students</a></li>
      </ul>
      <div class="tab-content mt-3">
        <div class="tab-pane fade show active" id="tabSessions"><div id="wrap-rSessions"></div><div id="rSessions"></div></div>
        <div class="tab-pane fade" id="tabFdp"><div id="wrap-rFdp"></div><div id="rFdp"></div></div>
        <div class="tab-pane fade" id="tabStrength"><div id="wrap-rStrength"></div><div id="rStrength"></div></div>
        <div class="tab-pane fade" id="tabAttendanceDaily"><div id="wrap-rAttDaily"></div><div id="rAttDaily"></div></div>
        <div class="tab-pane fade" id="tabAttendanceMonthly"><div id="wrap-rAttMonthly"></div><div id="rAttMonthly"></div></div>
        <div class="tab-pane fade" id="tabEmployees"><div id="wrap-rEmployees"></div><div id="rEmployees"></div></div>
        <div class="tab-pane fade" id="tabEmpAttendance"><div id="wrap-rEmpAtt"></div><div id="rEmpAtt"></div></div>
        <div class="tab-pane fade" id="tabTeacherLoad"><div id="wrap-rTLoad"></div><div id="rTLoad"></div></div>
        <div class="tab-pane fade" id="tabExpenses"><div id="wrap-rExpenses"></div><div id="rExpenses"></div></div>
        <div class="tab-pane fade" id="tabStudents"><div id="wrap-rStudents"></div><div id="rStudents"></div></div>
      </div>
    `;
  }

  // mount function: create grid + toolbar + wire events for export/search/filters
  async function mount() {
    // store grids
    const grids = {};

    // helper to attach toolbar and wire events for a grid
    function attachToolbar({ storageKey, reportSlug, targetWrapSelector }) {
      const wrap = document.querySelector(targetWrapSelector);
      if (!wrap) return null;
      wrap.innerHTML = createToolbarHtml(storageKey, reportSlug);
      const toolbar = wrap.querySelector('.report-toolbar');
      const searchEl = toolbar.querySelector('.rp-search');
      const schoolEl = toolbar.querySelector('.rp-filter-school');
      const empEl = toolbar.querySelector('.rp-filter-employee');
      const pageSizeEl = toolbar.querySelector('.rp-page-size');
      const exportPdfEl = toolbar.querySelector('.rp-export-pdf');
      const exportExcelEl = toolbar.querySelector('.rp-export-excel');

      // wiring: when user types Enter in search field, reload grid
      const reloadGrid = () => {
        const grid = grids[storageKey];
        if (!grid) return;
        // try grid.reload or grid.load or recreate by reading state - support common APIs
        if (typeof grid.reload === 'function') return grid.reload();
        if (typeof grid.load === 'function') return grid.load();
        // fallback: if grid has a fetcher we can call it and let grid handle internal state
        try {
          grid.refresh && grid.refresh();
        } catch(e) { console.warn('Cannot reload grid', e); }
      };

      // common helper to read params from toolbar
      function toolbarParams() {
        return {
          search: searchEl.value.trim() || undefined,
          school_name: schoolEl.value.trim() || undefined,
          employee_name: empEl.value.trim() || undefined,
          pageSize: parseInt(pageSizeEl.value || '25', 10)
        };
      }

      // search Enter / blur triggers
      searchEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') reloadGrid(); });
      schoolEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') reloadGrid(); });
      empEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') reloadGrid(); });
      // page size change triggers reload and sets grid pageSize if API available
      pageSizeEl.addEventListener('change', () => {
        const grid = grids[storageKey];
        if (grid && typeof grid.setPageSize === 'function') grid.setPageSize(parseInt(pageSizeEl.value, 10));
        reloadGrid();
      });
      
      
// helper: read token from common places (adjust names to your app)
function readAuthToken() {
  if (window.APP_TOKEN) return window.APP_TOKEN;
  const keys = ['token', 'auth_token', 'access_token', 'jwt'];
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k);
      if (v) return v;
    } catch (e) { /* ignore localStorage errors */ }
  }
  return null;
}

// helper: download blob response with filename
async function fetchAndDownload(url, opts = {}, defaultName = 'download') {
  try {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>null);
      throw new Error(`Export failed: ${resp.status} ${resp.statusText} ${txt ? '- ' + txt : ''}`);
    }
    const disposition = resp.headers.get('Content-Disposition') || '';
    let filename = defaultName;
    const m = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/i);
    if (m && m[1]) {
      try { filename = decodeURIComponent(m[1]); } catch (e) { filename = m[1]; }
    } else {
      // try to infer extension from content-type
      const ct = (resp.headers.get('Content-Type') || '').toLowerCase();
      if (ct.includes('pdf')) filename = `${defaultName}.pdf`;
      else if (ct.includes('csv') || ct.includes('text')) filename = `${defaultName}.csv`;
      else if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('vnd.openxmlformats')) filename = `${defaultName}.xlsx`;
    }

    const blob = await resp.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000 * 60); // revoke later
  } catch (err) {
    console.error('Export error', err);
    alert(err.message || 'Export failed');
  }
}


      // Now wire export button clicks to use fetch + token/cookies
exportPdfEl.addEventListener('click', async (e) => {
  e.preventDefault();
  const params = toolbarParams();
  const qs = buildQs(Object.assign({}, params, { format: 'pdf', report: reportSlug }));
  const url = `/api/reports/export${qs}`;

  // prefer bearer token in localStorage (if your app uses header auth)
  const token = readAuthToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Use fetch with credentials: 'same-origin' so cookie-based sessions also work
  await fetchAndDownload(url, { method: 'GET', headers, credentials: 'same-origin' }, `${reportSlug}.pdf`);
});

exportExcelEl.addEventListener('click', async (e) => {
  e.preventDefault();
  const params = toolbarParams();
  const qs = buildQs(Object.assign({}, params, { format: 'excel', report: reportSlug }));
  const url = `/api/reports/export${qs}`;

  const token = readAuthToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Use fetch with credentials: 'same-origin'
  await fetchAndDownload(url, { method: 'GET', headers, credentials: 'same-origin' }, `${reportSlug}.xlsx`);
});

      // return helper to fetch toolbar params externally (if needed)
      return {
        params: toolbarParams,
        reload: reloadGrid,
        setSearch: v => { searchEl.value = v || ''; },
        setSchool: v => { schoolEl.value = v || ''; },
        setEmployee: v => { empEl.value = v || ''; },
        setPageSize: v => { pageSizeEl.value = String(v || '25'); }
      };
    }

    // helper: instantiate grid if element exists
    function mountGridIfEl(opts) {
      const elSelector = typeof opts.el === 'string' ? opts.el : null;
      const el = elSelector ? document.querySelector(elSelector) : opts.el;
      if (!el) {
        console.warn(`DataGrid target not found: ${elSelector || opts.el}. Skipping grid instantiation.`);
        return null;
      }
      try {
        const grid = new DataGrid(opts);
        if (opts.storageKey) grids[opts.storageKey] = grid;
        grid._targetEl = el;
        return grid;
      } catch (err) {
        console.error('Failed to create DataGrid for', elSelector, err);
        return null;
      }
    }

    // ----------- Grid definitions & mounting --------------

    // Class Sessions
    mountGridIfEl({
      el: '#rSessions',
      storageKey: 'grid.sessions.v1',
      columns: [
        { key:'session_date', label:'Date' },
        { key:'school_name',  label:'School' },
        { key:'std_name',     label:'Std' },
        { key:'division_name',label:'Div' },
        { key:'lesson_title', label:'Lesson Plan' },
        { key:'employee_name',label:'Employee' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/class-sessions', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.sessions.v1', reportSlug: 'class-sessions', targetWrapSelector: '#wrap-rSessions' });

    // Faculty Daily Progress
    mountGridIfEl({
      el: '#rFdp',
      storageKey: 'grid.fdp.v1',
      columns: [
        { key:'date',          label:'Date' },
        { key:'employee_name', label:'Employee' },
        { key:'school_name',   label:'School' },
        { key:'book_name',     label:'Book' },
        { key:'chapter_name',  label:'Chapter' },
        { key:'status',        label:'Status' },
        { key:'lecture_count', label:'Lectures' },
        { key:'notebooks_checked', label:'Notebooks' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/faculty-daily-progress', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.fdp.v1', reportSlug: 'faculty-daily-progress', targetWrapSelector: '#wrap-rFdp' });

    // Class Strength
    mountGridIfEl({
      el: '#rStrength',
      storageKey: 'grid.classStrength.v1',
      columns: [
        { key: 'school_name', label: 'School' },
        { key: 'medium_name', label: 'Medium' },
        { key: 'std_name',    label: 'Std' },
        { key: 'division_name', label: 'Div' },
        { key: 'students_count', label: 'Count' }
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/class-strength', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.classStrength.v1', reportSlug: 'class-strength', targetWrapSelector: '#wrap-rStrength' });

    // Attendance Daily
    mountGridIfEl({
      el: '#rAttDaily',
      storageKey: 'grid.attdaily.v1',
      columns: [
        { key:'date', label:'Date' },
        { key:'school_name', label:'School' },
        { key:'std_name', label:'Std' },
        { key:'division_name', label:'Div' },
        { key:'marked_count', label:'Marked' },
        { key:'present_count', label:'Present' },
        { key:'absent_count', label:'Absent' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/attendance-daily', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.attdaily.v1', reportSlug: 'attendance-daily', targetWrapSelector: '#wrap-rAttDaily' });

    // Attendance Monthly
    mountGridIfEl({
      el: '#rAttMonthly',
      storageKey: 'grid.attmonthly.v1',
      columns: [
        { key:'month', label:'Month' },
        { key:'school_name', label:'School' },
        { key:'std_name', label:'Std' },
        { key:'division_name', label:'Div' },
        { key:'attendance_pct', label:'Attendance %' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/attendance-monthly', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.attmonthly.v1', reportSlug: 'attendance-monthly', targetWrapSelector: '#wrap-rAttMonthly' });

    // Employees (with image column + fallback)
    mountGridIfEl({
      el: '#rEmployees',
      storageKey: 'grid.employees.v1',
      columns: [
        { key:'employee_id', label:'ID' },
        { key:'full_name', label:'Name' },
        { key:'role_name', label:'Role' },
        { key:'school_name', label:'School' },
        {
          key:'image',
          label:'Image',
          render: (row) => {
            try {
              const fallback = '/images/ANK.png';
              if (!row) return `<img src="${fallback}" alt="avatar" style="height:40px;border-radius:50%;">`;
              const raw = row.image || '';
              const src = raw.trim()
                ? (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/'))
                    ? raw
                    : `/uploads/employees/${raw}`
                : fallback;
              const alt = (row.full_name || '').replace(/"/g, '&quot;');
              return `<img src="${src}" alt="${alt}" style="height:40px;border-radius:50%;" onerror="this.onerror=null;this.src='${fallback}';">`;
            } catch (e) { return `<img src="/images/ANK.png" alt="avatar" style="height:40px;border-radius:50%;">`; }
          }
        }
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/employees', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.employees.v1', reportSlug: 'employees', targetWrapSelector: '#wrap-rEmployees' });

    // Employee Attendance
    mountGridIfEl({
      el: '#rEmpAtt',
      storageKey: 'grid.empatt.v1',
      columns: [
        { key:'date', label:'Date' },
        { key:'employee_name', label:'Employee' },
        { key:'school_name', label:'School' },
        { key:'status', label:'Status' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/employee-attendance', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.empatt.v1', reportSlug: 'employee-attendance', targetWrapSelector: '#wrap-rEmpAtt' });

    // Teacher Load
    mountGridIfEl({
      el: '#rTLoad',
      storageKey: 'grid.tload.v1',
      columns: [
        { key:'month_for', label:'Month' },
        { key:'employee_name', label:'Employee' },
        { key:'school_name', label:'School' },
        { key:'std_name', label:'Std' },
        { key:'division_name', label:'Div' },
        { key:'sessions_count', label:'Sessions' },
        { key:'lectures_delivered', label:'Lectures' },
        { key:'notebooks_checked', label:'Notebooks' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/teacher-load', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.tload.v1', reportSlug: 'teacher-load', targetWrapSelector: '#wrap-rTLoad' });

    // Expenses Monthly
    mountGridIfEl({
      el: '#rExpenses',
      storageKey: 'grid.expenses.v1',
      columns: [
        { key:'month_for', label:'Month' },
        { key:'category', label:'Category' },
        { key:'expense_count', label:'Count' },
        { key:'amount_total', label:'Amount' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/expenses-monthly', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.expenses.v1', reportSlug: 'expenses-monthly', targetWrapSelector: '#wrap-rExpenses' });

    // Students Master
    mountGridIfEl({
      el: '#rStudents',
      storageKey: 'grid.students.v1',
      columns: [
        { key:'student_id', label:'ID' },
        { key:'full_name', label:'Student' },
        { key:'school_name', label:'School' },
        { key:'medium_name', label:'Medium' },
        { key:'std_name', label:'Std' },
        { key:'division_name', label:'Div' },
      ],
      fetcher: ({page,pageSize,search,sort}) =>
        api.get('/api/reports/students-master', { query:{page,pageSize,search, sort: sort?`${sort.key}:${sort.dir}`:''} }),
    });
    attachToolbar({ storageKey: 'grid.students.v1', reportSlug: 'students-master', targetWrapSelector: '#wrap-rStudents' });

    // optional: auto-focus first toolbar search for convenience
    setTimeout(() => {
      const el = document.querySelector('#wrap-rSessions .rp-search');
      if (el) el.focus();
    }, 200);
  }

  return { render, mount };
})();
