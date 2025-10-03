// public/js/pages/expenses.js
(() => {
  // ---------- Masters ----------
  // Load employees (we need employee.full_name + employee.user_id)
  const fetchEmployees = async () => {
    const r = await api.get('/api/employees', { query: { pageSize: 1000 } });
    return r?.data || [];
  };

  // ---------- Helpers ----------
  const escapeHtml = s => String(s || '').replace(/[&<>"'`=\/]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' }[c]));
  const opt = (v, t, sel='') =>
    `<option value="${escapeHtml(v)}" ${String(v)===String(sel)?'selected':''}>${escapeHtml(t)}</option>`;
  const buildOptions = (list, idKey, nameKey, sel='') =>
    `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');

  const money = (n) => (n==null || n==='') ? '-' : new Intl.NumberFormat().format(+n);
  const short = (s, n=60) => {
    s = String(s||''); return s.length>n ? (s.slice(0,n-1)+'…') : s;
  };

  function rowHtml(r) {
    return `
      <tr data-id="${r.expense_id}">
        <td>${escapeHtml(r.category) || '-'}</td>
        <td class="text-end">${money(r.amount)}</td>
        <td>${r.incurred_on ? new Date(r.incurred_on).toLocaleDateString() : '-'}</td>
        <td>${r.notes ? short(r.notes,50) : '-'}</td>
        <td>${escapeHtml(r.created_by_name || '-')}</td>
        <td>${r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // ---------- Page ----------
  window.pageExpenses = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Expenses</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus-lg"></i> New Expense</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/finance/expenses/export/csv" target="_blank">
              <i class="bi bi-filetype-csv"></i> CSV
            </a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="exSearch" class="form-control form-control-sm" placeholder="Category / notes">
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label mb-1">From Date</label>
                <input id="fFrom" type="date" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label mb-1">To Date</label>
                <input id="fTo" type="date" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Page</label>
                <select id="exPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="exReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Category</th>
                    <th class="text-end">Amount</th>
                    <th>Incurred On</th>
                    <th>Notes</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="exTbody">
                  <tr><td colspan="7" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="exStats"></div>
            <div id="exPager"></div>
          </div>
        </div>

        <!-- Modal: Expense Form -->
        <div class="modal fade" id="exModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>

              <form id="exForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="expense_id">

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Category <span class="text-danger">*</span></label>
                      <input name="category" class="form-control" required>
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="form-label">Amount <span class="text-danger">*</span></label>
                      <input name="amount" type="number" step="0.01" min="0" class="form-control" required>
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Incurred On <span class="text-danger">*</span></label>
                      <input name="incurred_on" type="date" class="form-control" required>
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="form-label">Notes</label>
                      <textarea name="notes" rows="2" class="form-control"></textarea>
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Created By</label>
                      <select name="created_by" class="form-select"></select>
                      <div class="form-text">Optional: leave blank to default to current user.</div>
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
      const tbody   = document.getElementById('exTbody');
      const pagerEl = document.getElementById('exPager');
      const statsEl = document.getElementById('exStats');

      const inpSearch = document.getElementById('exSearch');
      const dFrom     = document.getElementById('fFrom');
      const dTo       = document.getElementById('fTo');
      const selSize   = document.getElementById('exPageSize');
      const btnReload = document.getElementById('exReload');

      const btnNew    = document.getElementById('btnNew');
      const modalEl   = document.getElementById('exModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('exForm');

      const selFormUser= form.querySelector('select[name="created_by"]');

      // Masters: load employees
      const employees = await fetchEmployees();
      // Only use employees that have a linked user_id (so saving created_by -> user_id will be valid)
      const empWithUser = employees.filter(e => e.user_id != null);
      selFormUser.innerHTML = `<option value="">Select</option>` + empWithUser.map(e =>
        `<option value="${e.user_id}">${escapeHtml(e.full_name || ('Emp#'+e.employee_id))}</option>`).join('');

      // Local state
      let page=1, pageSize = parseInt(selSize.value,10)||20, q='';
      let f_from='', f_to='';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="7" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = {
            page, pageSize, search: q,
            date_from: f_from || undefined,
            date_to:   f_to   || undefined
          };
          const res   = await api.get('/api/finance/expenses', { query });
          const rows  = res?.data || [];
          const pg    = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted">No expenses found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total:0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');
          // actions
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
            const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this expense?')) return;
            try { await api.del(`/api/finance/expenses/${id}`); ui.toast('Expense deleted','success'); reload(); }
            catch(e){ ui.toast(e.message || 'Delete failed','danger'); }
          }));

          pagerEl.innerHTML='';
          pagerEl.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page=p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total:0 });
        }
      }

      function fillForm(row) {
        form.reset();
        form.querySelector('[name="expense_id"]').value = row?.expense_id || '';
        form.querySelector('[name="category"]').value   = row?.category || '';
        form.querySelector('[name="amount"]').value     = row?.amount ?? '';
        form.querySelector('[name="incurred_on"]').value= row?.incurred_on ? new Date(row.incurred_on).toISOString().slice(0,10) : '';
        form.querySelector('[name="notes"]').value      = row?.notes || '';
        selFormUser.value = row?.created_by || '';
      }

      function openForm(_mode, btnOrNull) {
        let row = null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.expense_id)===String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      dFrom.addEventListener('change', () => { f_from = dFrom.value; page=1; reload(); });
      dTo.addEventListener('change',   () => { f_to   = dTo.value; page=1; reload(); });
      selSize.addEventListener('change', () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());

        const id = payload.expense_id || '';
        delete payload.expense_id;

        payload.amount = payload.amount === '' ? null : Number(payload.amount);
        payload.incurred_on = payload.incurred_on || null;
        // created_by is user_id (we set option value to employee.user_id above)
        payload.created_by = payload.created_by === '' ? null : Number(payload.created_by);

        if (!payload.category || !payload.amount || !payload.incurred_on) {
          ui.toast('Category, Amount and Incurred On are required', 'danger'); return;
        }

        try {
          if (id) {
            await api.put(`/api/finance/expenses/${id}`, payload);
            ui.toast('Expense updated','success');
          } else {
            await api.post('/api/finance/expenses', payload);
            ui.toast('Expense created','success');
          }
          modal.hide();
          page=1; await reload();
        } catch (err) {
          ui.toast(err?.message || 'Save failed', 'danger');
        }
      });

      btnNew.addEventListener('click', () => openForm('new', null));

      // Initial load
      await reload();
    }
  };
})();
