// public/js/pages/notebook-checks.js
(() => {
  'use strict';

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"'`=\/]/g, function (c) {
      return ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
      })[c];
    });
  }

  /* =====================
     Modal abstraction:
     - If window.ui.modal is a function, use it.
     - Otherwise create a Bootstrap modal DOM and provide a wait-for-result helper.
     The return value of openModal(...) is the modal element (for selection). Use waitModal(modalEl) to await OK.
     ===================== */
  function buildBootstrapModalHtml({ title = '', body = '', okText = 'OK', size = '' } = {}) {
    const sizeClass = size === 'lg' ? 'modal-lg' : (size === 'sm' ? 'modal-sm' : '');
    return `
      <div class="modal fade" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog ${sizeClass}">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${escapeHtml(title)}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary">${escapeHtml(okText)}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function openModal(opts = {}) {
    // Prioritize existing UI helper if it's a function
    try {
      if (window.ui && typeof window.ui.modal === 'function') {
        // Some implementations return the DOM element directly or a promise that resolves to it
        const modal = await window.ui.modal(opts);
        return modal;
      }
    } catch (e) {
      // fall through to bootstrap fallback
      console.warn('window.ui.modal threw, falling back to bootstrap modal', e);
    }

    // Bootstrap fallback: create modal element and show it
    const container = document.createElement('div');
    container.innerHTML = buildBootstrapModalHtml(opts);
    const modalEl = container.firstElementChild;
    document.body.appendChild(modalEl);

    const bsModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    bsModal.show();

    // return the DOM element (consumer can query within)
    return modalEl;
  }

  // Wait for modal OK or Cancel. Works with window.ui.modalWait if provided.
  function waitModal(modalEl) {
    // If ui provides modalWait, use it
    if (window.ui && typeof window.ui.modalWait === 'function') {
      return window.ui.modalWait(modalEl);
    }

    // Otherwise implement our own promise-based wait for bootstrap fallback
    return new Promise((resolve) => {
      // find the primary button (OK) and the cancel/close buttons
      const okBtn = modalEl.querySelector('.modal-footer .btn-primary');
      const cancelBtns = Array.from(modalEl.querySelectorAll('[data-bs-dismiss="modal"], .modal-footer .btn-secondary, .btn-close'));

      let finished = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        // hide and dispose bs modal
        try {
          const m = bootstrap.Modal.getInstance(modalEl);
          if (m) m.hide();
        } catch (e) {}
        // remove element after hidden event (or immediately)
        setTimeout(() => {
          modalEl.remove();
        }, 250);
        // remove listeners
        okBtn && okBtn.removeEventListener('click', onOk);
        cancelBtns.forEach(b => b.removeEventListener('click', onCancel));
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      const onHidden = () => {
        cleanup();
        resolve(false);
      };

      // wire listeners (defensive checks)
      if (okBtn) okBtn.addEventListener('click', onOk);
      cancelBtns.forEach(b => b.addEventListener('click', onCancel));
      modalEl.addEventListener('hidden.bs.modal', onHidden);
    });
  }

  // If you need to programmatically close a ui.modal created by window.ui.modal, you may want a helper.
  // We rely on bootstrap fallback cleanup above. For window.ui modal, assume ui.modalWait handles removal.

  // ---------------- Lookup loaders ----------------
  async function loadSchools() {
    try {
      const res = await api.get('/api/schools', { query: { pageSize: 1000 } });
      return res?.data || [];
    } catch (e) {
      return [];
    }
  }
  async function loadLookupMaster(table) {
    try {
      const res = await api.get('/api/master', { query: { table, pageSize: 1000 } });
      return res?.data || [];
    } catch (e) {
      return [];
    }
  }
  async function loadEmployees() {
    try {
      const res = await api.get('/api/employees', { query: { pageSize: 1000 } });
      return res?.data || [];
    } catch (e) {
      return [];
    }
  }

  // ---------------- Render helpers ----------------
  function renderFilters({ filters = {}, lookups = {} } = {}) {
    const { schools = [], standards = [], divisions = [], employees = [] } = lookups;

    const schoolOpts = ['<option value="">All (RLS)</option>']
      .concat(schools.map(s => `<option value="${escapeHtml(s.school_name)}" ${filters.school_name==s.school_name?'selected':''}>${escapeHtml(s.school_name)}</option>`))
      .join('');
    const stdOpts = ['<option value="">— any —</option>']
      .concat(standards.map(st => `<option value="${escapeHtml(st.std_name)}" ${filters.std_name==st.std_name?'selected':''}>${escapeHtml(st.std_name)}</option>`))
      .join('');
    const divOpts = ['<option value="">— any —</option>']
      .concat(divisions.map(d => `<option value="${escapeHtml(d.division_name)}" ${filters.division_name==d.division_name?'selected':''}>${escapeHtml(d.division_name)}</option>`))
      .join('');
    const empOpts = ['<option value="">— any —</option>']
      .concat(employees.map(e => `<option value="${escapeHtml(e.full_name)}" ${filters.employee_name==e.full_name?'selected':''}>${escapeHtml(e.full_name)}</option>`))
      .join('');

    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-md-3">
              <label class="form-label">School</label>
              <select id="fSchool" class="form-select">${schoolOpts}</select>
              <div class="small text-muted">List is RLS-scoped via backend /api/schools</div>
            </div>
            <div class="col-md-3">
              <label class="form-label">Employee</label>
              <select id="fEmployee" class="form-select">${empOpts}</select>
            </div>
            <div class="col-md-2">
              <label class="form-label">Standard</label>
              <select id="fStd" class="form-select">${stdOpts}</select>
            </div>
            <div class="col-md-2">
              <label class="form-label">Division</label>
              <select id="fDiv" class="form-select">${divOpts}</select>
            </div>
            <div class="col-md-2">
              <label class="form-label">Date</label>
              <input id="fDate" type="date" class="form-control" value="">
            </div>

            <div class="col-md-6">
              <label class="form-label">Search</label>
              <input id="fSearch" class="form-control" placeholder="school, std, div, employee, remarks" value="${escapeHtml(filters.search||'')}">
            </div>

            <div class="col-md-2 d-grid">
              <button id="btnSearch" class="btn btn-primary">
                <i class="bi bi-search me-1"></i> Search
              </button>
            </div>

            <div class="col-md-4 d-flex gap-2">
              <button id="btnNew" class="btn btn-sm btn-success"><i class="bi bi-plus-circle me-1"></i> New</button>
              <button id="btnImport" class="btn btn-sm btn-outline-secondary"><i class="bi bi-upload me-1"></i> Import CSV</button>
              <button id="btnExport" class="btn btn-sm btn-outline-primary"><i class="bi bi-download me-1"></i> Export CSV</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function notebookRowHtml(n) {
    return `
      <tr data-id="${n.nc_id}">
        <td class="text-muted">${n.nc_id}</td>
        <td>${escapeHtml(n.date_checked || '')}</td>
        <td>${escapeHtml(n.school_name || '')}</td>
        <td>${escapeHtml((n.std_name || '') + (n.division_name ? ' / ' + n.division_name : ''))}</td>
        <td>${escapeHtml(n.employee_name || '')}</td>
        <td class="text-end">${n.count_checked ?? 0}</td>
        <td>${escapeHtml(n.remarks || '')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1 btn-edit" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-del" title="Delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }

  function renderList({ rows = [], pagination = {} } = {}) {
    if (!rows.length) {
      return `<div class="card"><div class="card-body">${window.ui.emptyState('No notebook checks')}</div></div>`;
    }
    const trs = rows.map(notebookRowHtml).join('');
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || DEFAULT_PAGE_SIZE;
    const total = pagination.total || rows.length;
    const pagerTxt = `Showing ${(page-1)*pageSize+1} - ${Math.min(page*pageSize, total)} of ${total}`;

    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-sm align-middle">
              <thead><tr>
                <th>#</th><th>Date</th><th>School</th><th>Class</th><th>Employee</th><th class="text-end">Count</th><th>Remarks</th><th></th>
              </tr></thead>
              <tbody>${trs}</tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <small class="text-muted">${pagerTxt}</small>
            <div id="nbPager"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- Data APIs ----------------
  async function fetchNotebookChecks({ page=1, pageSize=DEFAULT_PAGE_SIZE, filters={} } = {}) {
    const q = {
      page, pageSize,
      search: filters.search || '',
      school_name: filters.school_name || '',
      std_name: filters.std_name || '',
      division_name: filters.division_name || '',
      employee_name: filters.employee_name || '',
      date: filters.date || ''
    };
    const res = await api.get('/api/notebook-checks', { query: q });
    return { data: res?.data || [], pagination: res?.pagination || { page, pageSize, total: 0 } };
  }
  async function getNotebookCheck(id) {
    const res = await api.get(`/api/notebook-checks/${id}`);
    return res?.data || null;
  }
  async function createNotebookCheck(payload) {
    const res = await api.post('/api/notebook-checks', payload);
    return res?.data || {};
  }
  async function updateNotebookCheck(id, payload) {
    const res = await api.put(`/api/notebook-checks/${id}`, payload);
    return res?.data || {};
  }
  async function deleteNotebookCheck(id) {
    const res = await api.delete(`/api/notebook-checks/${id}`);
    return res?.data || {};
  }

  // ---------------- Helper: get students count for a class (school + std [+ division])
  async function getStudentsCount({ school_name = '', std_name = '', division_name = '' } = {}) {
    try {
      // Use students endpoint (returns pagination.total) to get the total matching students
      const q = {
        page: 1,
        pageSize: 1,
        search: '',
        school_name: school_name || '',
        std_name: std_name || '',
        division_name: division_name || ''
      };
      const res = await api.get('/api/students', { query: q });
      return (res?.pagination?.total != null) ? Number(res.pagination.total) : 0;
    } catch (e) {
      // on error, return 0 (caller should handle gracefully)
      return 0;
    }
  }

  // ---------------- Modal (create/edit) ----------------
  async function showNotebookModal(existing = null, lookups = {}) {
    const schools = lookups.schools || [];
    const standards = lookups.standards || [];
    const divisions = lookups.divisions || [];
    const employees = lookups.employees || [];

    const schoolOptions = ['<option value="">— select school —</option>']
      .concat(schools.map(s => `<option value="${escapeHtml(s.school_name)}" ${existing && existing.school_name === s.school_name ? 'selected' : ''}>${escapeHtml(s.school_name)}</option>`)).join('');
    const stdOptions = ['<option value="">— select std —</option>']
      .concat(standards.map(st => `<option value="${escapeHtml(st.std_name)}" ${existing && existing.std_name == st.std_name ? 'selected' : ''}>${escapeHtml(st.std_name)}</option>`)).join('');
    const divOptions = ['<option value="">— select div —</option>']
      .concat(divisions.map(d => `<option value="${escapeHtml(d.division_name)}" ${existing && existing.division_name == d.division_name ? 'selected' : ''}>${escapeHtml(d.division_name)}</option>`)).join('');
    const empOptions = ['<option value="">— none —</option>']
      .concat(employees.map(e => `<option value="${escapeHtml(e.full_name)}" ${existing && existing.employee_name == e.full_name ? 'selected' : ''}>${escapeHtml(e.full_name)}</option>`)).join('');

    const payload = Object.assign({
      employee_name: '', school_name: '', date_checked: '', std_name: '', division_name: '', count_checked: 0, remarks: ''
    }, existing || {});

    const formHtml = `
      <div class="row g-2">
        <div class="col-12 d-flex align-items-center mb-2">
          <img src="/images/Ank_Logo.png" alt="logo" style="height:36px;margin-right:10px">
          <div>
            <div class="fw-semibold">${existing ? 'Edit Notebook Check' : 'New Notebook Check'}</div>
            <div class="small text-muted">Fill details and click ${existing ? 'Save' : 'Create'}</div>
          </div>
        </div>

        <div class="col-md-6">
          <label class="form-label">School *</label>
          <select id="nb_school" class="form-select">${schoolOptions}</select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Employee</label>
          <select id="nb_employee" class="form-select">${empOptions}</select>
        </div>

        <div class="col-md-4">
          <label class="form-label">Date *</label>
          <input id="nb_date" type="date" class="form-control" value="${escapeHtml(payload.date_checked || '')}">
        </div>
        <div class="col-md-4">
          <label class="form-label">Standard</label>
          <select id="nb_std" class="form-select">${stdOptions}</select>
        </div>
        <div class="col-md-4">
          <label class="form-label">Division</label>
          <select id="nb_div" class="form-select">${divOptions}</select>
        </div>

        <div class="col-md-4">
          <label class="form-label">Count Checked</label>
          <input id="nb_count" type="number" min="0" class="form-control" value="${escapeHtml(payload.count_checked ?? 0)}" />
          <div id="nb_max_help" class="form-text small text-muted">Max students: —</div>
          <div id="nb_count_err" class="form-text small text-danger d-none">students counts must he match with total students</div>
        </div>

        <div class="col-12">
          <label class="form-label">Remarks</label>
          <textarea id="nb_remarks" class="form-control" rows="3">${escapeHtml(payload.remarks || '')}</textarea>
        </div>
      </div>
    `;

    // show the modal (ui.modal if available else bootstrap fallback)
    const modalEl = await openModal({
      title: existing ? 'Edit Notebook Check' : 'New Notebook Check',
      body: formHtml,
      okText: existing ? 'Save' : 'Create',
      size: 'lg'
    });
    if (!modalEl) return null;

    // elements
    const elSchool = modalEl.querySelector('#nb_school');
    const elStd = modalEl.querySelector('#nb_std');
    const elDiv = modalEl.querySelector('#nb_div');
    const elCount = modalEl.querySelector('#nb_count');
    const elMaxHelp = modalEl.querySelector('#nb_max_help');
    const elErr = modalEl.querySelector('#nb_count_err');

    // try to find ok button: prefer window.ui's modal footer if available, else bootstrap modal .btn-primary
    let okBtn = modalEl.querySelector('.modal-footer .btn-primary');
    if (!okBtn && window.ui && typeof window.ui.getModalOkButton === 'function') {
      // some UI toolings expose helpers; try them (optional fallback)
      try { okBtn = window.ui.getModalOkButton(modalEl); } catch (e) {}
    }

    // helper to update max and validation
    let currentMax = null;
    async function updateMaxAndValidate() {
      const school_name = elSchool?.value || '';
      const std_name = elStd?.value || '';
      const division_name = elDiv?.value || '';

      // fetch only when at least school+std provided — else set to 0
      let total = 0;
      if (school_name && std_name) {
        total = await getStudentsCount({ school_name, std_name, division_name });
      } else {
        total = 0;
      }
      currentMax = Number(total || 0);
      elMaxHelp.textContent = `Max students: ${currentMax}`;

      // apply max attr for numeric input (0 meaning unknown)
      if (currentMax > 0) elCount.setAttribute('max', String(currentMax));
      else elCount.removeAttribute('max');

      // validate current value
      const cur = Number(elCount.value || 0);
      if (currentMax > 0 && cur > currentMax) {
        elErr.classList.remove('d-none');
        elCount.classList.add('is-invalid');
        if (okBtn) okBtn.disabled = true;
      } else {
        elErr.classList.add('d-none');
        elCount.classList.remove('is-invalid');
        if (okBtn) okBtn.disabled = false;
      }
    }

    // wire change handlers
    elSchool?.addEventListener('change', updateMaxAndValidate);
    elStd?.addEventListener('change', updateMaxAndValidate);
    elDiv?.addEventListener('change', updateMaxAndValidate);
    elCount?.addEventListener('input', updateMaxAndValidate);

    // set initial selections (also trigger initial max computation)
    elSchool.value = payload.school_name || '';
    elStd.value = payload.std_name || '';
    elDiv.value = payload.division_name || '';

    // initial validation
    await updateMaxAndValidate();

    // Wait for user to click OK / Cancel
    const ok = await waitModal(modalEl);
    if (!ok) return null;

    // when user accepted, re-check final validation
    const finalCount = Number(modalEl.querySelector('#nb_count')?.value || 0);
    if (currentMax > 0 && finalCount > currentMax) {
      window.ui?.toast ? window.ui.toast('students counts must he match with total students', 'danger') : (alert('students counts must he match with total students'));
      return null;
    }

    // build payload to return
    const nb = {
      school_name: modalEl.querySelector('#nb_school')?.value || '',
      employee_name: modalEl.querySelector('#nb_employee')?.value || '',
      date_checked: modalEl.querySelector('#nb_date')?.value || '',
      std_name: modalEl.querySelector('#nb_std')?.value || '',
      division_name: modalEl.querySelector('#nb_div')?.value || '',
      count_checked: Number(modalEl.querySelector('#nb_count')?.value || 0),
      remarks: modalEl.querySelector('#nb_remarks')?.value || ''
    };
    return nb;
  }

  // ---------------- CSV Import ----------------
  async function showImportModal() {
    const form = `
      <div>
        <div class="mb-2">
          <div class="small text-muted">Paste CSV text (header row required) or choose a file.</div>
        </div>
        <div class="mb-2">
          <textarea id="nb_csv_text" class="form-control" rows="8" placeholder="nc_id,employee_name,school_name,std_name,division_name,date_checked,count_checked,remarks,..."></textarea>
        </div>
        <div class="mb-2">
          <input id="nb_csv_file" type="file" accept=".csv,text/csv" class="form-control form-control-sm" />
        </div>
      </div>
    `;
    const modalEl = await openModal({ title: 'Import Notebook Checks (CSV)', body: form, okText: 'Import', size: 'lg' });
    if (!modalEl) return;

    const txtEl = modalEl.querySelector('#nb_csv_text');
    const fileEl = modalEl.querySelector('#nb_csv_file');

    // wire file -> textarea
    fileEl?.addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = e => { txtEl.value = e.target.result || ''; };
      fr.readAsText(f);
    });

    const ok = await waitModal(modalEl);
    if (!ok) return;

    const csvText = txtEl.value.trim();
    if (!csvText) { window.ui?.toast ? window.ui.toast('CSV required', 'warning') : alert('CSV required'); return; }

    // POST to import endpoint (controller expects body.csv or body.data)
    try {
      await api.post('/api/notebook-checks/import', { csv: csvText });
      window.ui?.toast ? window.ui.toast('Import started/completed', 'success') : alert('Import started/completed');
      await reloadList(); // reload current list
    } catch (e) {
      window.ui?.toast ? window.ui.toast(e?.message || 'Import failed', 'danger') : alert(e?.message || 'Import failed');
    }
  }

  // ---------------- Page lifecycle ----------------
  let page = DEFAULT_PAGE;
  let pageSize = DEFAULT_PAGE_SIZE;
  let currentFilters = { search: '', school_name: '', std_name: '', division_name: '', employee_name: '', date: '' };
  let lookups = {};

  async function refreshList() {
    const listRoot = qs('#notebookList');
    listRoot.innerHTML = window.ui ? window.ui.spinner() : '<div class="p-3">Loading...</div>';

    try {
      const out = await fetchNotebookChecks({ page, pageSize, filters: currentFilters });
      listRoot.innerHTML = renderList({ rows: out.data, pagination: out.pagination });

      // pager
      const pagerRoot = qs('#nbPager');
      pagerRoot.innerHTML = '';
      pagerRoot.appendChild(window.ui ? window.ui.pager({
        page: out.pagination.page, pageSize: out.pagination.pageSize, total: out.pagination.total,
        onPage: p => { page = p; refreshList(); }
      }) : document.createElement('div'));

      // wire row actions
      qsa('.btn-edit').forEach(b => b.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.closest('tr')?.getAttribute('data-id');
        if (!id) return;
        try {
          const r = await getNotebookCheck(id);
          const payload = await showNotebookModal(r, lookups);
          if (!payload) return;
          await updateNotebookCheck(id, payload);
          window.ui?.toast ? window.ui.toast('Saved', 'success') : alert('Saved');
          await refreshList();
        } catch (e) {
          window.ui?.toast ? window.ui.toast(e?.message || 'Save failed', 'danger') : alert(e?.message || 'Save failed');
        }
      }));

      qsa('.btn-del').forEach(b => b.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.closest('tr')?.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Delete notebook check?')) return;
        try {
          await deleteNotebookCheck(id);
          window.ui?.toast ? window.ui.toast('Deleted', 'success') : alert('Deleted');
          // adjust page if needed
          if (out.data.length === 1 && page > 1) page--;
          await refreshList();
        } catch (e) {
          window.ui?.toast ? window.ui.toast(e?.message || 'Delete failed', 'danger') : alert(e?.message || 'Delete failed');
        }
      }));
    } catch (e) {
      qs('#notebookList').innerHTML = window.ui ? window.ui.emptyState(e?.message || 'Failed to load notebook checks') : `<div class="p-3 text-danger">${escapeHtml(e?.message || 'Failed to load notebook checks')}</div>`;
    }
  }

  async function applyFiltersFromUI() {
    const selSchool = qs('#fSchool');
    const selEmp = qs('#fEmployee');
    const selStd = qs('#fStd');
    const selDiv = qs('#fDiv');
    const txt = qs('#fSearch')?.value || '';
    const date = qs('#fDate')?.value || '';

    currentFilters = {
      search: txt.trim(),
      school_name: selSchool && selSchool.value ? selSchool.value : '',
      employee_name: selEmp && selEmp.value ? selEmp.value : '',
      std_name: selStd && selStd.value ? selStd.value : '',
      division_name: selDiv && selDiv.value ? selDiv.value : '',
      date: date || ''
    };
    page = 1;
    await refreshList();
  }

  async function reloadList() { await refreshList(); }

  // ---------------- Export ----------------
  function buildExportUrl() {
    const params = new URLSearchParams();
    if (currentFilters.search) params.set('search', currentFilters.search);
    if (currentFilters.school_name) params.set('school_name', currentFilters.school_name);
    if (currentFilters.std_name) params.set('std_name', currentFilters.std_name);
    if (currentFilters.division_name) params.set('division_name', currentFilters.division_name);
    if (currentFilters.employee_name) params.set('employee_name', currentFilters.employee_name);
    if (currentFilters.date) params.set('date', currentFilters.date);
    // endpoint: /api/notebook-checks/export (controller name exportNotebookChecksCSV)
    return `/api/notebook-checks/export?${params.toString()}`;
  }

  // ---------------- Mount / page ----------------
  async function mount(root) {
    root.innerHTML = `
      <div id="filtersRoot"></div>
      <div id="notebookList">${window.ui ? window.ui.spinner() : 'Loading...'}</div>
    `;

    // load lookups
    const [schools, standards, divisions, employees] = await Promise.all([
      loadSchools(), loadLookupMaster('standards'), loadLookupMaster('divisions'), loadEmployees()
    ]);
    lookups = { schools, standards, divisions, employees };

    qs('#filtersRoot').innerHTML = renderFilters({ filters: {}, lookups });

    // wire filter buttons
    qs('#btnSearch')?.addEventListener('click', applyFiltersFromUI);

    // quick enter search
    qs('#fSearch')?.addEventListener('input', window.ui?.debounce ? window.ui.debounce(() => { applyFiltersFromUI(); }, 400) : (() => {}));

    qs('#btnNew')?.addEventListener('click', async () => {
      const payload = await showNotebookModal(null, lookups);
      if (!payload) return;
      try {
        await createNotebookCheck(payload);
        window.ui?.toast ? window.ui.toast('Created', 'success') : alert('Created');
        await refreshList();
      } catch (e) {
        window.ui?.toast ? window.ui.toast(e?.message || 'Create failed', 'danger') : alert(e?.message || 'Create failed');
      }
    });

    qs('#btnImport')?.addEventListener('click', showImportModal);

    qs('#btnExport')?.addEventListener('click', () => {
      const url = buildExportUrl();
      // simply navigate to export endpoint to trigger download (GET)
      window.location = url;
    });

    // initial load
    await refreshList();
  }

  window.pageNotebookChecks = {
    render() { return `<div id="notebookPage" class="p-2">${window.ui ? window.ui.spinner() : 'Loading...'}</div>`; },
    async mount() { const root = document.getElementById('notebookPage'); if (!root) return; await mount(root); }
  };

})();
