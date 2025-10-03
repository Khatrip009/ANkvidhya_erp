// public/js/pages/master.js
(() => {
  // 🔧 Configure master tables (id + editable columns)
// public/js/pages/master.js  (top)
        const MASTER_TABLES = {
        activities:   { id: 'activity_id',  columns: ['activity_name'] },
        departments:  { id: 'department_id',columns: ['department_name'] },
        designations: { id: 'designation_id', columns: ['designation_name'] },
        districts:    { id: 'district_id',  columns: ['district_name', 'state_id'] },
        divisions:    { id: 'div_id',       columns: ['division_name'] },
        medium:       { id: 'medium_id',    columns: ['medium_name'] },   // ✅ singular table name
        roles:        { id: 'role_id',      columns: ['role_name', 'description'] },
        standards:    { id: 'std_id',       columns: ['std_name'] },
        states:       { id: 'state_id',     columns: ['state_name'] },
        table_list:   { id: 'table_id',     columns: ['table_name'] },
        topics:       { id: 'topic_id',     columns: ['topic_name'] },
        };


  // --- URL helpers (hash query) ---
  function getHashQuery() {
    const m = (location.hash || '').split('?')[1] || '';
    const q = new URLSearchParams(m);
    return q;
  }
  function setHashQueryParam(key, val) {
    const base = (location.hash || '').split('?')[0] || '#/master';
    const q = getHashQuery();
    if (val === undefined || val === null || val === '') q.delete(key);
    else q.set(key, val);
    const s = q.toString();
    const next = s ? `${base}?${s}` : base;
    if (location.hash !== next) location.hash = next; // will trigger router.navigate()
  }

  // Small helpers
  const titleCase = s => (s || '').replace(/[_\-]+/g,' ').replace(/\b\w/g, m => m.toUpperCase());
  const isBool = k => /^is_/.test(k);
  const isNumeric = k => /(_id|_no|_count|_rank|_code)$/i.test(k);

  function buildFieldHTML(name, value='') {
    const label = titleCase(name);
    if (isBool(name)) {
      return `
        <div class="col-md-6">
          <div class="form-check mt-4">
            <input class="form-check-input" type="checkbox" name="${name}" id="f_${name}" ${value ? 'checked':''}>
            <label class="form-check-label" for="f_${name}">${label}</label>
          </div>
        </div>`;
    }
    if (name === 'description') {
      return `
        <div class="col-12">
          <label class="form-label">${label}</label>
          <textarea class="form-control" name="${name}" rows="3">${value ?? ''}</textarea>
        </div>`;
    }
    const type = isNumeric(name) ? 'number' : 'text';
    return `
      <div class="col-md-6">
        <label class="form-label">${label}</label>
        <input class="form-control" type="${type}" name="${name}" value="${value ?? ''}">
      </div>`;
  }

  function toCSV(headers, rows) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(headers.map(h => esc(r[h])).join(',')));
    return lines.join('\r\n');
  }

  window.pageMaster = {
    render() {
      const tableOpts = Object.keys(MASTER_TABLES)
        .map(t => `<option value="${t}">${titleCase(t)}</option>`)
        .join('');
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Master (Generic)</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus"></i> New</button>
            <button class="btn btn-sm btn-outline-secondary" id="btnExport"><i class="bi bi-download"></i> Export CSV</button>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Table</label>
                <div class="input-group">
                  <select id="mstTable" class="form-select">${tableOpts}</select>
                  <button id="btnLoad" class="btn btn-outline-primary"><i class="bi bi-arrow-repeat"></i> Load</button>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label mb-1">Search</label>
                <input id="mstSearch" class="form-control form-control-sm" placeholder="Search...">
              </div>
              <div class="col-3 col-md-2">
                <label class="form-label mb-1">Page Size</label>
                <select id="mstPageSize" class="form-select form-select-sm">
                  <option>10</option><option selected>20</option><option>50</option><option>100</option>
                </select>
              </div>
              <div class="col-3 col-md-3 text-end small text-muted">
                <div id="mstStats"></div>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div id="mstWrap" class="p-2">${ui.spinner()}</div>
          </div>
          <div class="card-footer">
            <div id="mstPager"></div>
          </div>
        </div>

        <!-- Modal: Create/Edit -->
        <div class="modal fade" id="mstModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="mstModalTitle">Add Record</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form id="mstForm">
                <div class="modal-body">
                  <input type="hidden" name="__table">
                  <input type="hidden" name="__id">
                  <div class="row g-3" id="mstFormFields"></div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-primary"><i class="bi bi-check2"></i> Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
    },

    async mount() {
      const wrap = document.getElementById('mstWrap');
      const pager = document.getElementById('mstPager');
      const stats = document.getElementById('mstStats');

      const selTable = document.getElementById('mstTable');
      const btnLoad  = document.getElementById('btnLoad');
      const inpSearch= document.getElementById('mstSearch');
      const selSize  = document.getElementById('mstPageSize');
      const btnNew   = document.getElementById('btnNew');
      const btnExport= document.getElementById('btnExport');

      const modalEl  = document.getElementById('mstModal');
      const modal    = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form     = document.getElementById('mstForm');
      const formFields = document.getElementById('mstFormFields');
      const modalTitle = document.getElementById('mstModalTitle');

      // --- Initial table from URL (?table=foo) ---
      const initialParam = (getHashQuery().get('table') || '').toLowerCase();
      if (initialParam && MASTER_TABLES[initialParam]) selTable.value = initialParam;

      // State
      let table = selTable.value || Object.keys(MASTER_TABLES)[0];
      let page = 1, pageSize = parseInt(selSize.value,10) || 20, q = '';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { stats.textContent = ''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        stats.textContent = `${start}–${end} of ${pg.total}`;
      }

      function tableColumnsForDisplay(tbl, rows) {
        const cfg = MASTER_TABLES[tbl] || { id: 'id', columns: [] };
        const base = [cfg.id, ...cfg.columns];
        if (!rows?.length) return base;
        const extra = Object.keys(rows[0]).filter(k => !base.includes(k));
        return base.concat(extra);
      }

      async function reload() {
        wrap.innerHTML = ui.spinner('sm');
        try {
          const res = await api.get(`/api/master/${table}`, {
            query: { page, pageSize, search: q }
          });
          const rows = res?.data || [];
          const pg   = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            wrap.innerHTML = ui.emptyState('No records');
            pager.innerHTML = '';
            setStats({ total: 0 });
            return;
          }

          const cols = tableColumnsForDisplay(table, rows);

          const thead = `<thead><tr>${
            cols.map(c => `<th>${titleCase(c)}</th>`).join('')
          }<th class="text-end">Actions</th></tr></thead>`;

          const tbody = rows.map(r => {
            const tds = cols.map(c => `<td>${r[c] ?? ''}</td>`).join('');
            return `<tr data-id="${r[MASTER_TABLES[table].id]}">${tds}
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`;
          }).join('');

          wrap.innerHTML = `
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                ${thead}
                <tbody>${tbody}</tbody>
              </table>
            </div>`;

          wrap.querySelectorAll('[data-act="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
              const tr = btn.closest('tr');
              const id = tr.getAttribute('data-id');
              const row = lastRows.find(r => String(r[MASTER_TABLES[table].id]) === String(id));
              openForm('edit', table, row);
            });
          });
          wrap.querySelectorAll('[data-act="delete"]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const tr = btn.closest('tr');
              const id = tr.getAttribute('data-id');
              if (!confirm('Delete this record?')) return;
              try {
                await api.del(`/api/master/${table}/${id}`);
                ui.toast('Deleted', 'success');
                reload();
              } catch (e) {
                ui.toast(e.message || 'Delete failed', 'danger');
              }
            });
          });

          pager.innerHTML = '';
          pager.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page = p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          wrap.innerHTML = ui.emptyState(e.message || 'Failed to load.');
          pager.innerHTML = '';
          setStats({ total: 0 });
        }
      }

      function openForm(mode, tbl, row=null) {
        const cfg = MASTER_TABLES[tbl] || { id: 'id', columns: [] };
        form.reset();
        form.querySelector('[name="__table"]').value = tbl;
        form.querySelector('[name="__id"]').value = row ? (row[cfg.id] ?? '') : '';

        modalTitle.textContent = mode === 'edit'
          ? `Edit ${titleCase(tbl)}`
          : `Add ${titleCase(tbl)}`;

        formFields.innerHTML = cfg.columns.map(c => buildFieldHTML(c, row ? row[c] : '')).join('');
        modal.show();
      }

      function getPayloadFromForm(tbl) {
        const cfg = MASTER_TABLES[tbl] || { id: 'id', columns: [] };
        const data = {};
        cfg.columns.forEach(c => {
          if (isBool(c)) {
            data[c] = !!form.querySelector(`[name="${c}"]`)?.checked;
          } else {
            let v = form.querySelector(`[name="${c}"]`)?.value ?? '';
            if (isNumeric(c) && v !== '') v = Number(v);
            data[c] = v === '' ? null : v;
          }
        });
        return data;
      }

      // Events
      btnLoad.addEventListener('click', () => { table = selTable.value; setHashQueryParam('table', table); });
      selTable.addEventListener('change', () => { table = selTable.value; setHashQueryParam('table', table); });
      selSize.addEventListener('change', () => { pageSize = parseInt(selSize.value,10) || 20; page = 1; reload(); });
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page = 1; reload(); }, 350));

      btnNew.addEventListener('click', () => openForm('new', table));

      btnExport.addEventListener('click', () => {
        if (!lastRows.length) { ui.toast('Nothing to export', 'warning'); return; }
        const headers = Object.keys(lastRows[0]);
        const csv = toCSV(headers, lastRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${table}_page${page}.csv`; a.click();
        URL.revokeObjectURL(url);
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tbl = form.querySelector('[name="__table"]').value;
        const id  = form.querySelector('[name="__id"]').value;
        const payload = getPayloadFromForm(tbl);
        try {
          if (id) {
            await api.put(`/api/master/${tbl}/${id}`, payload);
            ui.toast('Updated', 'success');
          } else {
            await api.post(`/api/master/${tbl}`, payload);
            ui.toast('Created', 'success');
          }
          modal.hide();
          page = 1;
          reload();
        } catch (err) {
          ui.toast(err?.message || 'Save failed', 'danger');
        }
      });

      // initial data load
      await reload();
    }
  };
})();
