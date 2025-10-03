(() => {
  // ---------- Masters ----------
  // Correct master fetch: use /api/master?table=...
  async function fetchAll(table) {
    try {
      const res = await api.get('/api/master', { query: { table, pageSize: 1000 } });
      return res?.data || [];
    } catch (e) {
      return [];
    }
  }
  const fetchSchools  = async () => {
    try { const r = await api.get('/api/schools', { query: { pageSize: 1000 } }); return r?.data || []; } catch(e){ return []; }
  };
  const fetchStudents = async () => {
    try { const r = await api.get('/api/students', { query: { pageSize: 1000 } }); return r?.data || []; } catch(e){ return []; }
  };
  const fetchEmployees = async () => {
    try { const r = await api.get('/api/employees', { query: { pageSize: 1000 } }); return r?.data || []; } catch(e){ return []; }
  };

  // ---------- Helpers ----------
  const opt = (v, t, sel='') =>
    `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const buildOptions = (list, idKey, nameKey, sel='') =>
    `<option value="">Select</option>` +
    list.map(x => opt(x[idKey], x[nameKey], sel)).join('');

  const money = (n) => (n==null || n==='') ? '-' : new Intl.NumberFormat().format(+n);
  const short = (s, n=60) => {
    s = String(s||'');
    return s.length>n ? (s.slice(0, n-1)+'…') : s;
  };
  const toLocalDTInput = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (x)=> String(x).padStart(2,'0');
    const y = d.getFullYear();
    const M = pad(d.getMonth()+1);
    const D = pad(d.getDate());
    const H = pad(d.getHours());
    const m = pad(d.getMinutes());
    return `${y}-${M}-${D}T${H}:${m}`;
  };

  function rowHtml(r) {
    return `
      <tr data-id="${r.payment_id}">
        <td style="min-width:180px">
          <div class="fw-semibold">${r.student_name || '-'}</div>
          <div class="small text-muted">${r.school_name || ''}</div>
        </td>
        <td class="text-end">${money(r.amount)}</td>
        <td>${r.paid_on ? new Date(r.paid_on).toLocaleString() : '-'}</td>
        <td>${r.payment_method || '-'}</td>
        <td>${r.processed_by_name || '-'}</td>
        <td>${short(r.notes, 40) || '-'}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // ---------- Page ----------
  window.pagePayments = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Payments</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus-lg"></i> New Payment</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/finance/payments/export/csv" target="_blank">
              <i class="bi bi-filetype-csv"></i> CSV
            </a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-3">
                <label class="form-label mb-1">Search</label>
                <input id="paySearch" class="form-control form-control-sm" placeholder="Student / School / Notes / Processed by">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">School</label>
                <select id="fSchool" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Student</label>
                <select id="fStudent" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Paid From</label>
                <input id="fFrom" type="date" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Paid To</label>
                <input id="fTo" type="date" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="payPageSize" class="form-select form-select-sm">
                  <option>10</option><option selected>20</option><option>50</option>
                </select>
              </div>
              <div class="col-6 col-md-1">
                <button id="payReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Student / School</th>
                    <th class="text-end">Amount</th>
                    <th>Paid On</th>
                    <th>Method</th>
                    <th>Processed By</th>
                    <th>Notes</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="payTbody">
                  <tr><td colspan="7" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="payStats"></div>
            <div id="payPager"></div>
          </div>
        </div>

        <!-- Modal: Payment Form -->
        <div class="modal fade" id="payModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>

              <form id="payForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="payment_id">

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">School</label>
                      <select name="school_id" class="form-select" required></select>
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="form-label">Student</label>
                      <select name="student_id" class="form-select" required></select>
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-6 col-md-3">
                      <label class="form-label">Amount <span class="text-danger">*</span></label>
                      <input name="amount" type="number" step="0.01" min="0" class="form-control" required>
                    </div>
                    <div class="col-6 col-md-4">
                      <label class="form-label">Paid On</label>
                      <input name="paid_on" type="datetime-local" class="form-control">
                    </div>
                    <div class="col-12 col-md-5">
                      <label class="form-label">Payment Method</label>
                      <input name="payment_method" class="form-control" placeholder="Cash / UPI / Card / Bank">
                    </div>
                  </div>

                  <div class="row g-2">
                    <div class="col-12">
                      <label class="form-label">Notes</label>
                      <textarea name="notes" class="form-control" rows="2" placeholder="Optional"></textarea>
                    </div>
                  </div>

                  <div class="mt-3 small text-muted">
                    <i class="bi bi-info-circle me-1"></i>
                    “Processed by” is recorded server-side if you set it there; or you may pass a user id in the API as <code>processed_by</code>.
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
      const tbody   = document.getElementById('payTbody');
      const pagerEl = document.getElementById('payPager');
      const statsEl = document.getElementById('payStats');

      const inpSearch = document.getElementById('paySearch');
      const selSchool = document.getElementById('fSchool');
      const selStudent= document.getElementById('fStudent');
      const inpFrom   = document.getElementById('fFrom');
      const inpTo     = document.getElementById('fTo');
      const selSize   = document.getElementById('payPageSize');
      const btnReload = document.getElementById('payReload');

      const btnNew    = document.getElementById('btnNew');
      const modalEl   = document.getElementById('payModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('payForm');

      const selFormSchool = form.querySelector('select[name="school_id"]');
      const selFormStudent= form.querySelector('select[name="student_id"]');

      // Masters
      let [schools, students, employees] = await Promise.all([ fetchSchools(), fetchStudents(), fetchEmployees() ]);

      // build map user_id -> full_name for processed_by display
      const empByUserId = {};
      const empById = {};
      employees.forEach(e => {
        if (e?.user_id) empByUserId[String(e.user_id)] = e.full_name || '';
        if (e?.employee_id) empById[String(e.employee_id)] = e.full_name || '';
      });

      // Filter masters
      selSchool.innerHTML = `<option value="">All</option>` +
        schools.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join('');
      function refreshFilterStudents(schoolId) {
        const list = schoolId
          ? students.filter(st => String(st.school_id) === String(schoolId))
          : students;
        selStudent.innerHTML = `<option value="">All</option>` +
          list.map(st => `<option value="${st.student_id}">${st.full_name || st.student_name || ('ID#'+st.student_id)}</option>`).join('');
      }
      refreshFilterStudents('');

      // Form masters
      selFormSchool.innerHTML = buildOptions(schools, 'school_id', 'school_name');
      function refreshFormStudents(schoolId, sel='') {
        const list = schoolId
          ? students.filter(st => String(st.school_id) === String(schoolId))
          : [];
        selFormStudent.innerHTML = buildOptions(
          list, 'student_id', (list.length && list[0].full_name !== undefined) ? 'full_name' : 'student_name', sel
        );
      }

      selFormSchool.addEventListener('change', () => {
        refreshFormStudents(selFormSchool.value, '');
      });

      // Local state
      let page=1, pageSize = parseInt(selSize.value,10) || 20, q='';
      let f_school_id='', f_student_id='', f_from='', f_to='';
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
            school_id: f_school_id || undefined,
            student_id: f_student_id || undefined,
            paid_from: f_from || undefined,
            paid_to: f_to || undefined
          };
          const res   = await api.get('/api/finance/payments', { query });
          const rows  = res?.data || [];
          const pg    = res?.pagination || { page, pageSize, total: rows.length };

          // map processed_by (user_id) -> employee name if available
          rows.forEach(r => {
            const userId = r.processed_by != null ? String(r.processed_by) : null;
            r.processed_by_name = (userId && empByUserId[userId]) ? empByUserId[userId] : (r.processed_by_name || '');
          });

          lastRows = rows;
          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted">No payments found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total:0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');

          // actions
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
            const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this payment?')) return;
            try { await api.del(`/api/finance/payments/${id}`); ui.toast('Payment deleted','success'); reload(); }
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
          tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total:0 });
        }
      }

      function fillForm(row) {
        form.reset();
        form.querySelector('[name="payment_id"]').value = row?.payment_id || '';
        selFormSchool.value = row?.school_id || '';
        refreshFormStudents(selFormSchool.value || '', row?.student_id || '');
        selFormStudent.value = row?.student_id || '';
        form.querySelector('[name="amount"]').value = row?.amount ?? '';
        form.querySelector('[name="paid_on"]').value = toLocalDTInput(row?.paid_on) || '';
        form.querySelector('[name="payment_method"]').value = row?.payment_method || '';
        form.querySelector('[name="notes"]').value = row?.notes || '';
      }

      function openForm(_mode, btnOrNull) {
        let row=null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.payment_id)===String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selSchool.addEventListener('change', () => {
        f_school_id = selSchool.value; refreshFilterStudents(f_school_id); f_student_id=''; selStudent.value='';
        page=1; reload();
      });
      selStudent.addEventListener('change', () => { f_student_id = selStudent.value; page=1; reload(); });
      inpFrom.addEventListener('change', () => { f_from = inpFrom.value; page=1; reload(); });
      inpTo.addEventListener('change',   () => { f_to   = inpTo.value;   page=1; reload(); });
      selSize.addEventListener('change', () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        const id = payload.payment_id || '';
        delete payload.payment_id;

        // Normalize
        payload.school_id = payload.school_id ? Number(payload.school_id) : null;
        payload.student_id= payload.student_id ? Number(payload.student_id) : null;
        payload.amount    = payload.amount==='' ? null : Number(payload.amount);
        payload.paid_on   = payload.paid_on || null;
        payload.payment_method = (payload.payment_method || '').trim() || null;
        payload.notes          = (payload.notes || '').trim() || null;

        if (!payload.school_id || !payload.student_id || payload.amount==null) {
          ui.toast('School, Student and Amount are required', 'danger'); return;
        }

        try {
          if (id) {
            await api.put(`/api/finance/payments/${id}`, payload);
            ui.toast('Payment updated', 'success');
          } else {
            await api.post('/api/finance/payments', payload);
            ui.toast('Payment created', 'success');
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
