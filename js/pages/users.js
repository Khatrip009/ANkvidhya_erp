// public/js/pages/users.js
(() => {
  // ---------- Masters ----------
  async function fetchAll(table) {
    const res = await api.get(`/api/master/${table}`, { query: { pageSize: 1000 } });
    return res?.data || [];
  }
  const fetchRoles = () => fetchAll('roles');

  // ---------- Helpers ----------
  const opt = (v, t, sel='') => `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const buildOptions = (list, idKey, nameKey, sel='') =>
    `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');
  const avatarSrc = (url) => (url && url.trim()) ? url : 'images/ANK.png';

  function rowHtml(r) {
    const activeBadge = r.is_active
      ? `<span class="badge text-bg-success">Active</span>`
      : `<span class="badge text-bg-secondary">Inactive</span>`;
    return `
      <tr data-id="${r.user_id}">
        <td class="text-nowrap">
          <div class="d-flex align-items-center">
            <img src="${avatarSrc('')}" class="rounded-circle me-2" style="width:32px;height:32px;object-fit:cover">
            <div>
              <div class="fw-semibold">${r.username || '-'}</div>
              <div class="small text-muted">${r.full_name || ''}</div>
            </div>
          </div>
        </td>
        <td>${r.role_name || '-'}</td>
        <td>${r.email || '-'}</td>
        <td>${activeBadge}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="view"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // If /api/users list returns role_id only (no role_name), we’ll map it using roles master.
  function attachRoleNames(rows, roles) {
    const byId = new Map(roles.map(r => [String(r.role_id), r.role_name]));
    rows.forEach(r => {
      if (!r.role_name && r.role_id != null) {
        r.role_name = byId.get(String(r.role_id)) || r.role_name || '';
      }
    });
    return rows;
  }

  // ---------- Page ----------
  window.pageUsers = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Users</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-person-plus"></i> New User</button>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="uSearch" class="form-control form-control-sm" placeholder="Search username / full name / email">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Role</label>
                <select id="fRole" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Status</label>
                <select id="fActive" class="form-select form-select-sm">
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="uPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="uReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="uTbody">
                  <tr><td colspan="5" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="uStats"></div>
            <div id="uPager"></div>
          </div>
        </div>

        <!-- Modal: User Form -->
        <div class="modal fade" id="uModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>

              <form id="uForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="user_id">

                  <div class="d-flex align-items-center gap-3 mb-3">
                    <img id="uAvatar" src="images/ANK.png" class="rounded-circle flex-shrink-0"
                         style="width:72px;height:72px;object-fit:cover;border:2px solid var(--bs-border-color)">
                    <div class="w-100">
                      <div class="row g-2">
                        <div class="col-12 col-md-3">
                          <label class="form-label">Username <span class="text-danger">*</span></label>
                          <input name="username" class="form-control" required placeholder="e.g. john_doe">
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label">Full name</label>
                          <input name="full_name" class="form-control" placeholder="e.g. John Doe">
                        </div>
                        <div class="col-12 col-md-3">
                          <label class="form-label">Email</label>
                          <input name="email" type="email" class="form-control" placeholder="email@example.com">
                        </div>
                        <div class="col-12 col-md-2">
                          <label class="form-label">Active</label>
                          <select name="is_active" class="form-select">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-4">
                      <label class="form-label">Role</label>
                      <select name="role_id" class="form-select"></select>
                    </div>
                    <div class="col-12 col-md-8">
                      <div class="border rounded p-2">
                        <div class="form-check form-switch mb-2">
                          <input class="form-check-input" type="checkbox" id="chkSetPassword">
                          <label class="form-check-label" for="chkSetPassword">Set / Change Password</label>
                        </div>
                        <div id="pwWrap" class="row g-2" style="display:none">
                          <div class="col-6">
                            <input type="password" class="form-control" name="password" placeholder="New password">
                          </div>
                          <div class="col-6">
                            <input type="password" class="form-control" name="password2" placeholder="Confirm password">
                          </div>
                          <div class="small text-muted mt-1">
                            Leave blank to keep existing password.
                          </div>
                        </div>
                      </div>
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
      `;
    },

    async mount() {
      const tbody   = document.getElementById('uTbody');
      const pagerEl = document.getElementById('uPager');
      const statsEl = document.getElementById('uStats');

      const inpSearch = document.getElementById('uSearch');
      const selRole   = document.getElementById('fRole');
      const selActive = document.getElementById('fActive');
      const selSize   = document.getElementById('uPageSize');
      const btnReload = document.getElementById('uReload');

      const btnNew    = document.getElementById('btnNew');
      const modalEl   = document.getElementById('uModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('uForm');
      const imgAvatar = document.getElementById('uAvatar');

      const chkSetPassword = document.getElementById('chkSetPassword');
      const pwWrap         = document.getElementById('pwWrap');

      // Masters
      let roles = await fetchRoles();

      // Filters: Roles
      selRole.innerHTML = `<option value="">All</option>` + roles.map(r => `<option value="${r.role_id}">${r.role_name}</option>`).join('');

      // Form selects
      const selFormRole = form.querySelector('select[name="role_id"]');
      selFormRole.innerHTML = buildOptions(roles, 'role_id', 'role_name');

      // State
      let page = 1, pageSize = parseInt(selSize.value,10)||20, q = '';
      let f_role_id = '', f_active = '';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      // If your backend filters by role_name instead of role_id, map it here
      function namesForFilters() {
        const role_name = f_role_id ? (roles.find(r => String(r.role_id)===String(f_role_id))?.role_name || '') : '';
        // active filter passes true/false if chosen
        const is_active = (f_active === 'true' || f_active === 'false') ? f_active : '';
        return { role_name, is_active };
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search: q, ...namesForFilters() };
          const res   = await api.get('/api/users', { query });
          const rows  = Array.isArray(res?.data) ? res.data : (res?.data?.rows || res || []);
          const pg    = res?.pagination || { page, pageSize, total: res?.pagination?.total ?? rows.length };

          attachRoleNames(rows, roles);
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-muted">No users found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total:0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');

          // actions
          tbody.querySelectorAll('[data-act="view"]').forEach(btn => btn.addEventListener('click', () => openForm('view', btn)));
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
            const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this user?')) return;
            try {
              await api.del(`/api/users/${id}`);
              ui.toast('User deleted', 'success'); reload();
            } catch (e) {
              // 409/constraint friendly message or fallback
              ui.toast(e?.data?.message || e.message || 'Delete failed', 'danger');
            }
          }));

          // pager
          pagerEl.innerHTML='';
          pagerEl.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page=p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total:0 });
        }
      }

      function fillForm(row, mode='edit') {
        form.reset();
        form.querySelector('[name="user_id"]').value  = row?.user_id || '';
        form.querySelector('[name="username"]').value = row?.username || '';
        form.querySelector('[name="full_name"]').value= row?.full_name || '';
        form.querySelector('[name="email"]').value    = row?.email || '';
        form.querySelector('[name="is_active"]').value= (row?.is_active===false ? 'false' : 'true');
        imgAvatar.src = avatarSrc('');

        // role
        const rid = row?.role_id || (row?.role_name
          ? (roles.find(r => String(r.role_name).toLowerCase() === String(row.role_name).toLowerCase())?.role_id || '')
          : '');
        selFormRole.value = rid || '';

        // password fields hidden by default (view/edit)
        chkSetPassword.checked = false;
        pwWrap.style.display = 'none';
        form.querySelector('[name="password"]').value  = '';
        form.querySelector('[name="password2"]').value = '';

        // View mode -> disable inputs
        const disable = (mode === 'view');
        Array.from(form.elements).forEach(el => {
          if (el.name === 'user_id') return;
          if (el.name === 'password' || el.name === 'password2') {
            el.disabled = disable || !chkSetPassword.checked;
          } else {
            el.disabled = disable;
          }
        });
      }

      function openForm(mode, btnOrNull) {
        let row = null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.user_id)===String(id)) || null;
        }
        fillForm(row, mode);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selRole.addEventListener('change',   () => { f_role_id = selRole.value; page=1; reload(); });
      selActive.addEventListener('change', () => { f_active  = selActive.value; page=1; reload(); });
      selSize.addEventListener('change',   () => { pageSize  = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Password toggle
      chkSetPassword.addEventListener('change', () => {
        pwWrap.style.display = chkSetPassword.checked ? '' : 'none';
        form.querySelectorAll('[name="password"],[name="password2"]').forEach(el => {
          el.disabled = !chkSetPassword.checked;
          if (!chkSetPassword.checked) el.value = '';
        });
      });

      // Submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());

        const id = payload.user_id || '';
        delete payload.user_id;

        payload.username  = (payload.username || '').trim();
        payload.full_name = (payload.full_name || '').trim() || null;
        payload.email     = (payload.email || '').trim() || null;
        payload.is_active = String(payload.is_active) === 'false' ? false : true;
        payload.role_id   = payload.role_id ? Number(payload.role_id) : null;

        // password (optional)
        const pw = (payload.password || '').trim();
        const pw2= (payload.password2 || '').trim();
        delete payload.password2;
        if (chkSetPassword.checked) {
          if (pw && pw !== pw2) { ui.toast('Passwords do not match', 'danger'); return; }
          // If empty + checked, we just won't send password key (no change)
          if (!pw) delete payload.password;
        } else {
          delete payload.password;
        }

        if (!payload.username) { ui.toast('Username is required', 'danger'); return; }

        try {
          if (id) {
            await api.put(`/api/users/${id}`, payload);
            ui.toast('User updated', 'success');
          } else {
            await api.post('/api/users', payload);
            ui.toast('User created', 'success');
          }
          modal.hide();
          page=1; await reload();
        } catch (err) {
          ui.toast(err?.data?.message || err?.message || 'Save failed', 'danger');
        }
      });

      // New
      btnNew.addEventListener('click', () => openForm('new', null));

      // Initial load
      await reload();
    }
  };
})();
