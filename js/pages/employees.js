// public/js/pages/employees.js
(() => {
  // -------- Helpers to fetch master data --------
  async function fetchAll(table) {
    const res = await api.get(`/api/master/${table}`, { query: { pageSize: 1000 } });
    return res?.data || [];
  }
  const fetchStates       = () => fetchAll('states');
  const fetchDistricts    = () => fetchAll('districts'); // we'll filter client-side by state_id
  const fetchDepartments  = () => fetchAll('departments');
  const fetchDesignations = () => fetchAll('designations');
  const fetchRoles        = () => fetchAll('roles');

  // RLS-scoped schools list for filtering
  async function fetchSchools() {
    const res = await api.get('/api/schools', { query: { pageSize: 1000 } });
    return res?.data || [];
  }

  // Find id by name convenience (when editing; API returns names, not ids)
  const findByName = (list, name, nameKey, idKey='id') =>
    list.find(x => String(x[nameKey]||'').toLowerCase() === String(name||'').toLowerCase())?.[idKey] ?? '';

  // Avatar helper
  function avatarSrc(image) {
    return image && image.trim() ? image : 'images/ANK.png';
  }

  // validate selected school against allowed list from RLS
  function getSelectedSchoolIdSafe(allowedSchools, chosen) {
    if (!chosen) return '';
    return allowedSchools.some(s => String(s.school_id) === String(chosen)) ? chosen : '';
  }

  // ------- Row HTML for the index table -------
  function rowHtml(r) {
    return `
      <tr data-id="${r.employee_id}">
        <td class="text-nowrap">
          <div class="d-flex align-items-center">
            <img src="${avatarSrc(r.image)}" class="rounded-circle me-2" style="width:32px;height:32px;object-fit:cover">
            <div>
              <div class="fw-semibold">${r.full_name || '-'}</div>
              <div class="small text-muted">${r.username || ''}</div>
            </div>
          </div>
        </td>
        <td>${r.role_name || '-'}</td>
        <td>${r.department_name || '-'}</td>
        <td>${r.designation_name || '-'}</td>
        <td>${r.contact || '-'}</td>
        <td>${r.email || '-'}</td>
        <td>${r.district_name || '-'}</td>
        <td>${r.state_name || '-'}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="view"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // ------- Build options helpers -------
  const opt = (v, t, sel) => `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  function buildOptions(list, idKey, nameKey, sel='') {
    return `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');
  }

  // ------- The page -------
  window.pageEmployees = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Employees</h2>
          <div class="btn-group">
            <a class="btn btn-sm btn-outline-secondary" id="btnExportCsv" href="#" target="_blank"><i class="bi bi-filetype-csv"></i> CSV</a>
            <a class="btn btn-sm btn-outline-secondary" id="btnExportXlsx" href="#" target="_blank"><i class="bi bi-file-earmark-spreadsheet"></i> Excel</a>
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-person-plus"></i> New Employee</button>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-3">
                <label class="form-label mb-1">Search</label>
                <input id="empSearch" class="form-control form-control-sm" placeholder="Search name / username / email">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">School</label>
                <select id="fSchool" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">State</label>
                <select id="fState" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">District</label>
                <select id="fDistrict" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Role</label>
                <select id="fRole" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="empPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="empReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>District</th>
                    <th>State</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="empTbody">
                  <tr><td colspan="9" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="empStats"></div>
            <div id="empPager"></div>
          </div>
        </div>

        <!-- Modal: Resume-style Employee Form -->
        <div class="modal fade" id="empModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>

              <form id="empForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="employee_id">

                  <!-- Top: Avatar + Headline -->
                  <div class="d-flex align-items-center gap-3 mb-3">
                    <img id="empAvatar" src="images/ANK.png" class="rounded-circle flex-shrink-0" style="width:72px;height:72px;object-fit:cover;border:2px solid var(--bs-border-color)">
                    <div class="w-100">
                      <div class="row g-2">
                        <div class="col-12 col-md-4">
                          <label class="form-label">Employee Name <span class="text-danger">*</span></label>
                          <input name="full_name" class="form-control" required placeholder="e.g. Priya Shah">
                        </div>
                        <div class="col-6 col-md-3">
                          <label class="form-label">Username <span class="text-muted small">(create-only)</span></label>
                          <input name="username" class="form-control" placeholder="e.g. priyashah">
                        </div>
                        <div class="col-6 col-md-3">
                          <label class="form-label">Contact</label>
                          <input name="contact" class="form-control" placeholder="e.g. 98765 43210">
                        </div>
                        <div class="col-12 col-md-2">
                          <label class="form-label">Email</label>
                          <input name="email" type="email" class="form-control" placeholder="email@example.com">
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Image URL -->
                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Image URL</label>
                      <input name="image" class="form-control" placeholder="https://... (or leave blank)">
                    </div>
                    <div class="col-6 col-md-3">
                      <label class="form-label">Date of Birth</label>
                      <input name="dob" type="date" class="form-control">
                    </div>
                  </div>

                  <!-- Address / Geo -->
                  <div class="row g-2 mb-3">
                    <div class="col-12">
                      <label class="form-label">Address</label>
                      <textarea name="address" class="form-control" rows="2" placeholder="Street, Area"></textarea>
                    </div>
                    <div class="col-6 col-md-4">
                      <label class="form-label">State</label>
                      <select name="state_id" class="form-select"></select>
                    </div>
                    <div class="col-6 col-md-4">
                      <label class="form-label">District</label>
                      <select name="district_id" class="form-select"></select>
                    </div>
                  </div>

                  <!-- Org -->
                  <div class="row g-2">
                    <div class="col-6 col-md-4">
                      <label class="form-label">Department</label>
                      <select name="department_id" class="form-select"></select>
                    </div>
                    <div class="col-6 col-md-4">
                      <label class="form-label">Designation</label>
                      <select name="designation_id" class="form-select"></select>
                    </div>
                    <div class="col-6 col-md-4">
                      <label class="form-label">Role</label>
                      <select name="role_id" class="form-select"></select>
                    </div>
                  </div>

                  <div class="mt-3 small text-muted">
                    <i class="bi bi-info-circle me-1"></i>
                    Username is used only on creation. To change an existing user’s login, update it in Users.
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
      `;
    },

    async mount() {
      const tbody   = document.getElementById('empTbody');
      const pagerEl = document.getElementById('empPager');
      const statsEl = document.getElementById('empStats');

      const inpSearch = document.getElementById('empSearch');
      const selSchool = document.getElementById('fSchool');
      const selState  = document.getElementById('fState');
      const selDist   = document.getElementById('fDistrict');
      const selRole   = document.getElementById('fRole');
      const selSize   = document.getElementById('empPageSize');
      const btnReload = document.getElementById('empReload');

      const btnNew    = document.getElementById('btnNew');
      const modalEl   = document.getElementById('empModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('empForm');
      const imgAvatar = document.getElementById('empAvatar');

      // Masters
      let [states, districts, departments, designations, roles, schools] = [];
      try {
        [states, districts, departments, designations, roles, schools] =
          await Promise.all([fetchStates(), fetchDistricts(), fetchDepartments(), fetchDesignations(), fetchRoles(), fetchSchools()]);
      } catch (e) {
        ui.toast(e?.message || 'Failed to load masters', 'danger');
        [states, districts, departments, designations, roles, schools] = [[],[],[],[],[],[]];
      }

      // Filters population
      selSchool.innerHTML = `<option value="">All</option>` + schools.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join('');
      selState.innerHTML  = `<option value="">All</option>` + states.map(s => `<option value="${s.state_id}">${s.state_name}</option>`).join('');
      selRole.innerHTML   = `<option value="">All</option>` + roles.map(r => `<option value="${r.role_id}">${r.role_name}</option>`).join('');
      function refreshFilterDistricts(stateId) {
        const list = stateId ? districts.filter(d => String(d.state_id)===String(stateId)) : districts;
        selDist.innerHTML = `<option value="">All</option>` + list.map(d => `<option value="${d.district_id}">${d.district_name}</option>`).join('');
      }
      refreshFilterDistricts('');

      // Form selects
      const selFormState   = form.querySelector('select[name="state_id"]');
      const selFormDist    = form.querySelector('select[name="district_id"]');
      const selFormDept    = form.querySelector('select[name="department_id"]');
      const selFormDesig   = form.querySelector('select[name="designation_id"]');
      const selFormRole    = form.querySelector('select[name="role_id"]');

      selFormState.innerHTML = buildOptions(states, 'state_id', 'state_name');
      selFormDept.innerHTML  = buildOptions(departments, 'department_id', 'department_name');
      selFormDesig.innerHTML = buildOptions(designations, 'designation_id', 'designation_name');
      selFormRole.innerHTML  = buildOptions(roles, 'role_id', 'role_name');

      function refreshFormDistricts(stateId, selected='') {
        const list = stateId ? districts.filter(d => String(d.state_id)===String(stateId)) : [];
        selFormDist.innerHTML = buildOptions(list, 'district_id', 'district_name', selected);
      }

      // State
      let page = 1, pageSize = parseInt(selSize.value,10) || 20;
      let q = '', f_state_id = '', f_district_id = '', f_role_id = '', f_school_id = '';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      function buildExportUrl(path) {
        const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
        const params = new URLSearchParams();
        if (q) params.set('search', q);
        if (f_school_id) params.set('school_id', f_school_id);
        if (f_state_id) params.set('state_id', f_state_id);
        if (f_district_id) params.set('district_id', f_district_id);
        if (f_role_id) params.set('role_id', f_role_id);
        return `${base}${path}?${params.toString()}`;
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="9" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search: q };
          if (f_school_id)   query.school_id = f_school_id;
          if (f_state_id)    query.state_id = f_state_id;
          if (f_district_id) query.district_id = f_district_id;
          if (f_role_id)     query.role_id = f_role_id;

          const res  = await api.get('/api/employees', { query });
          const rows = res?.data || [];
          const pg   = res?.pagination || { page, pageSize, total: rows.length };

          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-muted">No employees found</td></tr>`;
            pagerEl.innerHTML = '';
            setStats({ total: 0 });
          } else {
            tbody.innerHTML = rows.map(rowHtml).join('');

            // Wire actions
            tbody.querySelectorAll('[data-act="view"]').forEach(btn => btn.addEventListener('click', () => openForm('view', btn)));
            tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
            tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
              const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
              if (!confirm('Delete this employee?')) return;
              try {
                await api.del(`/api/employees/${id}`);
                ui.toast('Employee deleted', 'success'); reload();
              } catch (e) {
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
          }

          // update exports with active filters
          const csv = document.getElementById('btnExportCsv');
          const xls = document.getElementById('btnExportXlsx');
          if (csv) csv.href = buildExportUrl('/api/employees/export/csv');
          if (xls) xls.href = buildExportUrl('/api/employees/export/excel');

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

      function fillForm(row, mode='edit') {
        // Reset + defaults
        form.reset();
        form.querySelector('[name="employee_id"]').value = row?.employee_id || '';
        form.querySelector('[name="full_name"]').value   = row?.full_name || '';
        form.querySelector('[name="username"]').value    = ''; // create-only
        form.querySelector('[name="contact"]').value     = row?.contact || '';
        form.querySelector('[name="email"]').value       = row?.email || '';
        form.querySelector('[name="address"]').value     = row?.address || '';
        form.querySelector('[name="dob"]').value         = row?.dob ? String(row.dob).substring(0,10) : '';
        form.querySelector('[name="image"]').value       = row?.image || '';
        imgAvatar.src = avatarSrc(row?.image);

        // Map names -> ids for selects
        const state_id  = row?.state_name ? findByName(states, row.state_name, 'state_name', 'state_id') : '';
        const role_id   = row?.role_name ? findByName(roles, row.role_name, 'role_name', 'role_id') : '';
        const dept_id   = row?.department_name ? findByName(departments, row.department_name, 'department_name', 'department_id') : '';
        const desig_id  = row?.designation_name ? findByName(designations, row.designation_name, 'designation_name', 'designation_id') : '';

        selFormState.value = state_id || '';
        selFormRole.value  = role_id || '';
        selFormDept.value  = dept_id || '';
        selFormDesig.value = desig_id || '';

        // districts depend on state
        const dist_id = row?.district_name ? findByName(districts, row.district_name, 'district_name', 'district_id') : '';
        refreshFormDistricts(state_id || '', dist_id || '');

        // toggle username field for create-only
        form.querySelector('[name="username"]').disabled = !!row?.employee_id;
      }

      function openForm(mode, btnOrNull) {
        let row = null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr');
          const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.employee_id) === String(id)) || null;
        }
        fillForm(row, mode);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selSchool.addEventListener('change', () => {
        const safe = getSelectedSchoolIdSafe(schools, selSchool.value);
        f_school_id = safe;
        if (selSchool.value && !safe) {
          ui.toast('You do not have access to that school (RLS).', 'warning');
          selSchool.value = '';
        }
        page = 1; reload();
      });
      selState.addEventListener('change', () => { f_state_id = selState.value; refreshFilterDistricts(f_state_id); f_district_id=''; selDist.value=''; page=1; reload(); });
      selDist.addEventListener('change',  () => { f_district_id = selDist.value; page=1; reload(); });
      selRole.addEventListener('change',  () => { f_role_id = selRole.value; page=1; reload(); });
      selSize.addEventListener('change',  () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Form reactions
      form.querySelector('input[name="image"]').addEventListener('input', () => {
        const url = form.querySelector('input[name="image"]').value.trim();
        imgAvatar.src = avatarSrc(url);
      });
      selFormState.addEventListener('change', () => {
        refreshFormDistricts(selFormState.value, '');
      });

      // Submit (create or update)
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());

        const id = payload.employee_id || '';
        delete payload.employee_id;

        // Normalize fields to expected types
        payload.full_name     = (payload.full_name || '').trim();
        payload.username      = (payload.username || '').trim(); // create-only; backend will create user if present
        payload.address       = (payload.address || '').trim() || null;
        payload.contact       = (payload.contact || '').trim() || null;
        payload.email         = (payload.email || '').trim() || null;
        payload.image         = (payload.image || '').trim() || null;
        payload.dob           = payload.dob || null;

        ['state_id','district_id','department_id','designation_id','role_id'].forEach(k => {
          if (payload[k] === '') payload[k] = null;
          else payload[k] = Number(payload[k]);
        });

        if (!payload.full_name) { ui.toast('Employee name is required', 'danger'); return; }

        try {
          if (id) {
            // On update, username is ignored (disabled)
            delete payload.username;
            await api.put(`/api/employees/${id}`, payload);
            ui.toast('Employee updated', 'success');
          } else {
            await api.post('/api/employees', payload);
            ui.toast('Employee created', 'success');
          }
          modal.hide();
          page = 1; await reload();
        } catch (err) {
          if (err?.status === 403) ui.toast('Restricted by RLS.', 'warning');
          else ui.toast(err?.message || 'Save failed', 'danger');
        }
      });

      // New
      btnNew.addEventListener('click', () => openForm('new', null));

      // Initial load
      await reload();
    }
  };
})();
