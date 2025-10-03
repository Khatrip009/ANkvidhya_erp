// public/js/pages/faculty-assign.js
(() => {
  // ---------- Helpers ----------
  async function fetchAll(url, query = {}) {
    const res = await api.get(url, { query });
    return res?.data || [];
  }

  const fetchSchools   = () => fetchAll('/api/schools',   { pageSize: 1000 });              // RLS-scoped
  const fetchMediums   = () => fetchAll('/api/master/medium',   { pageSize: 1000 });
  const fetchStandards = () => fetchAll('/api/master/standards', { pageSize: 1000 });
  const fetchDivisions = () => fetchAll('/api/master/divisions', { pageSize: 1000 });
  const fetchRoles     = () => fetchAll('/api/master/roles', { pageSize: 1000 });

  // employees: allow passing filters (role_id, school_id)
  async function fetchEmployeesFiltered(filters = {}) {
    const query = { pageSize: 1000, ...filters };
    const res = await api.get('/api/employees', { query });
    return res?.data || [];
  }

  const opt  = (v, t, sel) => `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const opts = (list, idKey, nameKey, sel='') => `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';

  function rowHtml(r) {
    return `
      <tr data-id="${r.fa_id}">
        <td class="text-nowrap"><div class="fw-semibold">${r.employee_name || '-'}</div></td>
        <td>${r.school_name || '-'}</td>
        <td>${r.medium_name || '-'}</td>
        <td>${r.std_name || '-'}</td>
        <td>${r.division_name || '-'}</td>
        <td>${fmtDate(r.start_date)}</td>
        <td>${r.end_date ? fmtDate(r.end_date) : '-'}</td>
        <td class="text-truncate" style="max-width: 240px;" title="${r.notes || ''}">${r.notes || '-'}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="view"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // validate selected school against allowed list (RLS-safe)
  function getSelectedSchoolIdSafe(allowedSchools, chosen) {
    if (!chosen) return '';
    return allowedSchools.some(s => String(s.school_id) === String(chosen)) ? chosen : '';
  }

  async function loadFacultyEmployees(facultyRoleId, schoolIdSafe) {
    // Prefer server-side filtering (role_id + school_id); RLS narrows further
    const filters = {};
    if (facultyRoleId) filters.role_id = facultyRoleId;
    if (schoolIdSafe)  filters.school_id = schoolIdSafe;
    let emps = await fetchEmployeesFiltered(filters);

    // Fallback client-side if role lookup failed
    if (!facultyRoleId) {
      emps = emps.filter(e => String(e.role_name || '').toLowerCase() === 'faculty');
    }
    return emps;
  }

  window.pageFacultyAssign = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Faculty Assignments</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus-lg"></i> New Assignment</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/faculty-assignments/export/csv" target="_blank">
              <i class="bi bi-filetype-csv"></i> Export CSV
            </a>
            <button class="btn btn-sm btn-outline-secondary" id="btnImportCsv"><i class="bi bi-upload"></i> Import CSV</button>
            <button class="btn btn-sm btn-outline-secondary" id="btnBulkInsert"><i class="bi bi-box-arrow-in-down"></i> Bulk Insert (JSON)</button>
            <button class="btn btn-sm btn-outline-secondary" id="btnBulkUpsert"><i class="bi bi-arrow-repeat"></i> Bulk Upsert (JSON)</button>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="faSearch" class="form-control form-control-sm" placeholder="Search employee / notes">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">School</label>
                <select id="fSchool" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Medium</label>
                <select id="fMedium" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Standard</label>
                <select id="fStd" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="faPageSize" class="form-select form-select-sm">
                  <option>10</option><option selected>20</option><option>50</option>
                </select>
              </div>
              <div class="col-6 col-md-1">
                <button id="faReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Employee</th>
                    <th>School</th>
                    <th>Medium</th>
                    <th>Standard</th>
                    <th>Division</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Notes</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="faTbody">
                  <tr><td colspan="9" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="faStats"></div>
            <div id="faPager"></div>
          </div>
        </div>

        <!-- Modal: Create/Edit/View -->
        <div class="modal fade" id="faModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header align-items-start">
                <div class="d-flex align-items-center gap-2">
                  <img src="images/Ank_Logo.png" alt="Logo" style="height:32px;width:auto">
                  <div>
                    <h5 class="modal-title" id="faModalTitle">Faculty Assignment</h5>
                    <div class="text-muted small">Link faculty to school/medium/standard/division</div>
                  </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>

              <form id="faForm">
                <div class="modal-body">
                  <input type="hidden" name="fa_id">
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label">Employee <span class="text-danger">*</span></label>
                      <select name="employee_id" class="form-select"></select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">School <span class="text-danger">*</span></label>
                      <select name="school_id" class="form-select"></select>
                    </div>

                    <div class="col-md-4">
                      <label class="form-label">Medium</label>
                      <select name="medium_id" class="form-select"></select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">Standard</label>
                      <select name="std_id" class="form-select"></select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">Division</label>
                      <select name="div_id" class="form-select"></select>
                    </div>

                    <div class="col-md-4">
                      <label class="form-label">Start Date <span class="text-danger">*</span></label>
                      <input type="date" name="start_date" class="form-control">
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">End Date</label>
                      <input type="date" name="end_date" class="form-control">
                    </div>
                    <div class="col-md-12">
                      <label class="form-label">Notes</label>
                      <textarea name="notes" class="form-control" rows="2" placeholder="Optional"></textarea>
                    </div>
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                  <button type="submit" class="btn btn-primary"><i class="bi bi-check2"></i> Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal: CSV Import -->
        <div class="modal fade" id="faImportModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-upload me-1"></i> Import Faculty Assignments (CSV)</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form id="faImportForm">
                <div class="modal-body">
                  <p class="small text-muted mb-2">
                    Headers (case-insensitive): 
                    <code>employee_name, school_name, medium_name, std_name, division_name, start_date, end_date, notes</code>
                  </p>
                  <textarea class="form-control" name="csv" rows="10" placeholder="Paste CSV content here..." required></textarea>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">Import</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal: Bulk JSON -->
        <div class="modal fade" id="faBulkModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="faBulkTitle">Bulk Insert/Upsert (JSON)</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form id="faBulkForm">
                <div class="modal-body">
                  <p class="small text-muted mb-2">
                    Provide an array of objects. Fields: 
                    <code>fa_id?</code>, <code>employee_name|employee_id</code>, <code>school_name|school_id</code>, 
                    <code>medium_name|medium_id?</code>, <code>std_name|std_id?</code>, <code>division_name|div_id?</code>, 
                    <code>start_date</code>, <code>end_date?</code>, <code>notes?</code>
                  </p>
                  <textarea class="form-control" name="json" rows="10" placeholder='[{"employee_name":"...", "school_name":"...", "start_date":"2025-06-01"}]' required></textarea>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-primary" id="faBulkSubmit">Run</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
    },

    async mount() {
      const tbody   = document.getElementById('faTbody');
      const pagerEl = document.getElementById('faPager');
      const statsEl = document.getElementById('faStats');

      const inpSearch = document.getElementById('faSearch');
      const selSchool = document.getElementById('fSchool');
      const selMedium = document.getElementById('fMedium');
      const selStd    = document.getElementById('fStd');
      const selSize   = document.getElementById('faPageSize');
      const btnReload = document.getElementById('faReload');

      const btnNew        = document.getElementById('btnNew');
      const btnImportCsv  = document.getElementById('btnImportCsv');
      const btnBulkInsert = document.getElementById('btnBulkInsert');
      const btnBulkUpsert = document.getElementById('btnBulkUpsert');

      const modalEl  = document.getElementById('faModal');
      const modal    = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form     = document.getElementById('faForm');

      const importEl = document.getElementById('faImportModal');
      const importMd = bootstrap.Modal.getOrCreateInstance(importEl);
      const importFm = document.getElementById('faImportForm');

      const bulkEl   = document.getElementById('faBulkModal');
      const bulkMd   = bootstrap.Modal.getOrCreateInstance(bulkEl);
      const bulkFm   = document.getElementById('faBulkForm');
      const bulkTitle= document.getElementById('faBulkTitle');

      // Masters (roles needed to find faculty role_id)
      let roles = [], schools = [], mediums = [], standards = [], divisions = [];
      try {
        [roles, schools, mediums, standards, divisions] = await Promise.all([
          fetchRoles(), fetchSchools(), fetchMediums(), fetchStandards(), fetchDivisions()
        ]);
      } catch (e) {
        ui.toast(e?.message || 'Failed to load masters', 'danger');
      }

      const facultyRoleId =
        roles.find(r => String(r.role_name || '').toLowerCase() === 'faculty')?.role_id || null;

      // Populate filter selects
      selSchool.innerHTML = `<option value="">All</option>` + schools.map(s => opt(s.school_id, s.school_name)).join('');
      selMedium.innerHTML = `<option value="">All</option>` + mediums.map(m => opt(m.medium_id, m.medium_name)).join('');
      selStd.innerHTML    = `<option value="">All</option>` + standards.map(s => opt(s.std_id, s.std_name)).join('');

      // Form selects
      const selEmp = form.querySelector('select[name="employee_id"]');
      const selSch = form.querySelector('select[name="school_id"]');
      const selMed = form.querySelector('select[name="medium_id"]');
      const selStdF= form.querySelector('select[name="std_id"]');
      const selDiv = form.querySelector('select[name="div_id"]');

      // Initial set (employees only faculty; no school filter yet)
      let employees = [];
      try {
        employees = await loadFacultyEmployees(facultyRoleId, '');
      } catch (e) {
        ui.toast(e?.message || 'Failed to load employees', 'danger');
      }

      selEmp.innerHTML = opts(employees, 'employee_id', 'full_name');
      selSch.innerHTML = opts(schools, 'school_id', 'school_name');
      selMed.innerHTML = opts(mediums, 'medium_id', 'medium_name');
      selStdF.innerHTML= opts(standards, 'std_id', 'std_name');
      selDiv.innerHTML = opts(divisions, 'div_id', 'division_name');

      // Local state
      let page = 1, pageSize = parseInt(selSize.value, 10) || 20;
      let q = '', f_school_id = '', f_medium_id = '', f_std_id = '';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      async function reloadEmployeesForSchool() {
        // Re-load employees when school filter changes, so dropdown offers only faculty (and, if supported, scoped to that school)
        try {
          const safe = getSelectedSchoolIdSafe(schools, f_school_id);
          const emps = await loadFacultyEmployees(facultyRoleId, safe);
          selEmp.innerHTML = opts(emps, 'employee_id', 'full_name');
        } catch (e) {
          // keep previous employees if it fails; RLS will still protect
        }
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="9" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search: q };
          // pass names for ILIKE filters (backend joins)
          if (f_school_id) {
            const s = schools.find(x => String(x.school_id)===String(f_school_id));
            if (s) query.school_name = s.school_name;
          }
          if (f_medium_id) {
            const m = mediums.find(x => String(x.medium_id)===String(f_medium_id));
            if (m) query.medium_name = m.medium_name;
          }
          if (f_std_id) {
            const st = standards.find(x => String(x.std_id)===String(f_std_id));
            if (st) query.std_name = st.std_name;
          }

          const res  = await api.get('/api/faculty-assignments', { query });
          const rows = res?.data || [];
          const pg   = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-muted">No assignments found</td></tr>`;
            pagerEl.innerHTML = ''; setStats({ total: 0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');

          // Actions
          tbody.querySelectorAll('[data-act="view"]').forEach(b => b.addEventListener('click', () => openForm('view', b)));
          tbody.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openForm('edit', b)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', async () => {
            const tr = b.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this assignment?')) return;
            try { await api.del(`/api/faculty-assignments/${id}`); ui.toast('Deleted', 'success'); reload(); }
            catch (e) {
              if (e?.status === 403) ui.toast('Restricted by RLS.', 'warning');
              else ui.toast(e.message || 'Delete failed', 'danger');
            }
          }));

          // Pager
          pagerEl.innerHTML = '';
          pagerEl.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page = p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          if (e?.status === 401) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-danger">Session expired. Please sign in again.</td></tr>`;
          } else if (e?.status === 403) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-warning">Restricted by RLS.</td></tr>`;
          } else {
            tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          }
          pagerEl.innerHTML = ''; setStats({ total: 0 });
        }
      }

      function fillForm(row, readonly=false) {
        form.reset();
        form.querySelector('[name="fa_id"]').value     = row?.fa_id || '';
        form.querySelector('[name="employee_id"]').value = row?.employee_id || '';
        form.querySelector('[name="school_id"]').value   = row?.school_id   || '';
        form.querySelector('[name="medium_id"]').value   = row?.medium_id   || '';
        form.querySelector('[name="std_id"]').value      = row?.std_id      || '';
        form.querySelector('[name="div_id"]').value      = row?.div_id      || '';
        form.querySelector('[name="start_date"]').value  = row?.start_date ? String(row.start_date).slice(0,10) : '';
        form.querySelector('[name="end_date"]').value    = row?.end_date ? String(row.end_date).slice(0,10) : '';
        form.querySelector('[name="notes"]').value       = row?.notes || '';

        // Toggle readonly
        [...form.elements].forEach(el => {
          if (el.name === 'fa_id') return;
          el.disabled = readonly;
        });
      }

      function openForm(mode, btn) {
        const id = btn ? btn.closest('tr').getAttribute('data-id') : '';
        const row = id ? (lastRows.find(x => String(x.fa_id)===String(id)) || null) : null;

        const title = document.getElementById('faModalTitle');
        if (mode === 'view') {
          title.textContent = `View • ${row?.employee_name || row?.fa_id || ''}`;
          fillForm(row, true);
          modal.show();
          return;
        }

        if (mode === 'edit') {
          title.textContent = `Edit • ${row?.employee_name || row?.fa_id || ''}`;
          fillForm(row, false);
          modal.show();
          return;
        }

        // new
        title.textContent = 'New Assignment';
        fillForm(null, false);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selSchool.addEventListener('change', async () => {
        const picked = selSchool.value;
        const safe   = getSelectedSchoolIdSafe(schools, picked);
        if (picked && !safe) {
          ui.toast('You do not have access to that school (RLS).', 'warning');
          selSchool.value = '';
          f_school_id = '';
        } else {
          f_school_id = safe;
        }
        page=1;
        await reloadEmployeesForSchool(); // keep employee dropdown in sync (faculty only)
        reload();
      });
      selMedium.addEventListener('change', () => { f_medium_id = selMedium.value; page=1; reload(); });
      selStd.addEventListener('change',    () => { f_std_id    = selStd.value;    page=1; reload(); });
      selSize.addEventListener('change',   () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Create/Update submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        const id = payload.fa_id || '';
        delete payload.fa_id;

        // Normalize
        ['employee_id','school_id','medium_id','std_id','div_id'].forEach(k => {
          if (payload[k] === '') payload[k] = null; else payload[k] = Number(payload[k]);
        });
        payload.start_date = payload.start_date || null;
        payload.end_date   = payload.end_date || null;
        payload.notes      = (payload.notes || '').trim() || null;

        if (!payload.employee_id) { ui.toast('Employee is required', 'danger'); return; }
        if (!payload.school_id)   { ui.toast('School is required', 'danger'); return; }
        if (!payload.start_date)  { ui.toast('Start date is required', 'danger'); return; }

        // School must be within allowed RLS set
        if (!getSelectedSchoolIdSafe(schools, payload.school_id)) {
          ui.toast('You do not have access to that school (RLS).', 'warning');
          return;
        }

        try {
          if (id) {
            await api.put(`/api/faculty-assignments/${id}`, payload);
            ui.toast('Updated', 'success');
          } else {
            await api.post('/api/faculty-assignments', payload);
            ui.toast('Created', 'success');
          }
          modal.hide();
          page = 1; await reload();
        } catch (err) {
          if (err?.status === 403) ui.toast('Restricted by RLS.', 'warning');
          else ui.toast(err?.message || 'Save failed', 'danger');
        }
      });

      // New
      btnNew.addEventListener('click', () => openForm('new'));

      // CSV Import
      btnImportCsv.addEventListener('click', () => {
        importFm.reset();
        importMd.show();
      });
      importFm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = (importFm.querySelector('[name="csv"]').value || '').trim();
        if (!text) { ui.toast('Paste CSV first', 'danger'); return; }
        try {
          await api.post('/api/faculty-assignments/import-csv', { csv: text });
          ui.toast('Import done', 'success');
          importMd.hide();
          page = 1; await reload();
        } catch (err) {
          if (err?.status === 403) ui.toast('Restricted by RLS.', 'warning');
          else ui.toast(err?.message || 'Import failed', 'danger');
        }
      });

      // Bulk JSON
      let bulkMode = 'insert'; // or 'upsert'
      btnBulkInsert.addEventListener('click', () => {
        bulkMode = 'insert';
        bulkTitle.textContent = 'Bulk Insert (JSON)';
        bulkFm.reset();
        bulkMd.show();
      });
      btnBulkUpsert.addEventListener('click', () => {
        bulkMode = 'upsert';
        bulkTitle.textContent = 'Bulk Upsert (JSON)';
        bulkFm.reset();
        bulkMd.show();
      });
      bulkFm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = (bulkFm.querySelector('[name="json"]').value || '').trim();
        if (!text) { ui.toast('Provide JSON array', 'danger'); return; }
        let data;
        try { data = JSON.parse(text); }
        catch { ui.toast('Invalid JSON', 'danger'); return; }

        if (!Array.isArray(data)) { ui.toast('JSON must be an array', 'danger'); return; }

        try {
          if (bulkMode === 'insert') {
            await api.post('/api/faculty-assignments/bulk-insert', data);
          } else {
            await api.post('/api/faculty-assignments/bulk-upsert', data);
          }
          ui.toast('Bulk operation completed', 'success');
          bulkMd.hide();
          page = 1; await reload();
        } catch (err) {
          if (err?.status === 403) ui.toast('Restricted by RLS.', 'warning');
          else ui.toast(err?.message || 'Bulk operation failed', 'danger');
        }
      });

      // Initial load
      await reload();
    }
  };
})();
