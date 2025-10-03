(() => {
  // ---------- Masters ----------
  const fetchEmployees = async () => {
    try {
      const r = await api.get('/api/employees', { query: { pageSize: 1000 } });
      return r?.data || [];
    } catch (e) {
      return [];
    }
  };

  // ---------- Helpers ----------
  const opt = (v, t, sel='') =>
    `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const buildOptions = (list, idKey, nameKey, sel='') =>
    `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');

  const money = (n) => (n==null || n==='') ? '-' : new Intl.NumberFormat().format(+n);

  const short = (s, n=60) => {
    s = String(s||''); return s.length>n ? (s.slice(0, n-1)+'…') : s;
  };

  const toMonthLabel = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    const m = dt.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    return m || '-';
  };

  // HTML month input (yyyy-MM) -> ISO date string yyyy-MM-01 (so backend date column stays valid)
  const monthToDate = (ym) => {
    if (!ym) return null;
    const [y, m] = ym.split('-').map(x => parseInt(x,10));
    if (!y || !m) return null;
    return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-01`;
  };
  // ISO date -> yyyy-MM for input
  const dateToMonth = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  };

  function rowHtml(r) {
    return `
      <tr data-id="${r.payroll_id}">
        <td style="min-width:200px">
          <div class="fw-semibold">${r.employee_name || '-'}</div>
          <div class="small text-muted">ID: ${r.employee_id ?? '-'}</div>
        </td>
        <td>${toMonthLabel(r.month_for)}</td>
        <td class="text-end">${money(r.gross_amount)}</td>
        <td class="text-end">${money(r.net_amount)}</td>
        <td>${r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // ---------- Page ----------
  window.pagePayrolls = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Payrolls</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus-lg"></i> New Payroll</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/finance/payrolls/export/csv" target="_blank">
              <i class="bi bi-filetype-csv"></i> CSV
            </a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="prSearch" class="form-control form-control-sm" placeholder="Employee / amounts">
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label mb-1">Employee</label>
                <select id="fEmployee" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">From (Month)</label>
                <input id="fFrom" type="month" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">To (Month)</label>
                <input id="fTo" type="month" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="prPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="prReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Employee</th>
                    <th>Month</th>
                    <th class="text-end">Gross</th>
                    <th class="text-end">Net</th>
                    <th>Created</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="prTbody">
                  <tr><td colspan="6" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="prStats"></div>
            <div id="prPager"></div>
          </div>
        </div>

        <!-- Modal: Payroll Form -->
        <div class="modal fade" id="prModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>

              <form id="prForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="payroll_id">

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Employee <span class="text-danger">*</span></label>
                      <select name="employee_id" class="form-select" required></select>
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="form-label">Month For <span class="text-danger">*</span></label>
                      <input name="month_for" type="month" class="form-control" required>
                    </div>
                  </div>

                  <div class="row g-2">
                    <div class="col-6 col-md-3">
                      <label class="form-label">Gross Amount</label>
                      <input name="gross_amount" type="number" step="0.01" min="0" class="form-control">
                    </div>
                    <div class="col-6 col-md-3">
                      <label class="form-label">Net Amount</label>
                      <input name="net_amount" type="number" step="0.01" min="0" class="form-control">
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
      // Elements
      const tbody   = document.getElementById('prTbody');
      const pagerEl = document.getElementById('prPager');
      const statsEl = document.getElementById('prStats');

      const inpSearch = document.getElementById('prSearch');
      const selEmp    = document.getElementById('fEmployee');
      const mFrom     = document.getElementById('fFrom');
      const mTo       = document.getElementById('fTo');
      const selSize   = document.getElementById('prPageSize');
      const btnReload = document.getElementById('prReload');

      const btnNew    = document.getElementById('btnNew');
      const modalEl   = document.getElementById('prModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('prForm');

      const selFormEmp= form.querySelector('select[name="employee_id"]');
      const inpFormMonth = form.querySelector('input[name="month_for"]');

      // Masters
      const employees = await fetchEmployees();

      // Filters
      selEmp.innerHTML = `<option value="">All</option>` +
        employees.map(e => `<option value="${e.employee_id}">${e.full_name || e.employee_name || ('Emp#'+e.employee_id)}</option>`).join('');

      // Form masters
      selFormEmp.innerHTML = buildOptions(
        employees, 'employee_id',
        (employees.length && employees[0].full_name !== undefined) ? 'full_name' : 'employee_name'
      );

      // Local state
      let page=1, pageSize = parseInt(selSize.value,10)||20, q='';
      let f_employee_id='', f_from='', f_to='';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="6" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = {
            page, pageSize, search: q,
            employee_id: f_employee_id || undefined,
            month_from: f_from ? monthToDate(f_from) : undefined,
            month_to:   f_to   ? monthToDate(f_to)   : undefined
          };
          const res   = await api.get('/api/finance/payrolls', { query });
          const rows  = res?.data || [];
          const pg    = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-muted">No payrolls found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total:0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');

          // actions
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
            const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this payroll?')) return;
            try { await api.del(`/api/finance/payrolls/${id}`); ui.toast('Payroll deleted','success'); reload(); }
            catch(e){ ui.toast(e.message || 'Delete failed','danger'); }
          }));

          // pager
          pagerEl.innerHTML='';
          pagerEl.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page=p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total:0 });
        }
      }

      function fillForm(row) {
        form.reset();
        form.querySelector('[name="payroll_id"]').value = row?.payroll_id || '';
        selFormEmp.value = row?.employee_id || '';
        inpFormMonth.value = dateToMonth(row?.month_for) || '';
        form.querySelector('[name="gross_amount"]').value = row?.gross_amount ?? '';
        form.querySelector('[name="net_amount"]').value   = row?.net_amount ?? '';
      }

      function openForm(_mode, btnOrNull) {
        let row = null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.payroll_id)===String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selEmp.addEventListener('change', () => { f_employee_id = selEmp.value; page=1; reload(); });
      mFrom.addEventListener('change',   () => { f_from = mFrom.value; page=1; reload(); });
      mTo.addEventListener('change',     () => { f_to   = mTo.value;   page=1; reload(); });
      selSize.addEventListener('change', () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());

        const id = payload.payroll_id || '';
        delete payload.payroll_id;

        // Normalize
        payload.employee_id = payload.employee_id ? Number(payload.employee_id) : null;
        payload.month_for   = monthToDate(payload.month_for) || null;
        payload.gross_amount= payload.gross_amount==='' ? null : Number(payload.gross_amount);
        payload.net_amount  = payload.net_amount===''   ? null : Number(payload.net_amount);

        if (!payload.employee_id || !payload.month_for) {
          ui.toast('Employee and Month are required', 'danger'); return;
        }

        try {
          if (id) {
            await api.put(`/api/finance/payrolls/${id}`, payload);
            ui.toast('Payroll updated', 'success');
          } else {
            await api.post('/api/finance/payrolls', payload);
            ui.toast('Payroll created', 'success');
          }
          modal.hide();
          page=1; await reload();
        } catch (err) {
          ui.toast(err?.message || 'Save failed', 'danger');
        }
      });

      // New
      btnNew.addEventListener('click', () => openForm('new', null));

      // Initial load
      await reload();
    }
  };
})();
