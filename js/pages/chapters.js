// public/js/pages/chapters.js
(() => {
  // ---------- Helpers ----------
  async function fetchAll(table) {
    const res = await api.get(`/api/master/${table}`, { query: { pageSize: 1000 } });
    return res?.data || [];
  }
  const fetchMediums   = () => fetchAll('medium');
  const fetchStandards = () => fetchAll('standards');
  const fetchBooks     = () => api.get('/api/books', { query: { pageSize: 1000 } }).then(r => r?.data || []);

  const findByName = (list, name, nameKey, idKey='id') =>
    list.find(x => String(x[nameKey]||'').toLowerCase() === String(name||'').toLowerCase())?.[idKey] ?? '';

  function rowHtml(r) {
    return `
      <tr data-id="${r.chapter_id}">
        <td class="fw-semibold">${r.chapter_name || '-'}</td>
        <td>${r.book_name   || '-'}</td>
        <td>${r.medium_name || '-'}</td>
        <td>${r.std_name    || '-'}</td>
       <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>

        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="view"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  const opt = (v,t,sel) => `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const buildOptions = (list,idKey,nameKey,sel='') =>
    `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');

  // ---------- Page ----------
  window.pageChapters = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Chapters</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus"></i> New Chapter</button>
            <button class="btn btn-sm btn-outline-secondary" id="btnImport"><i class="bi bi-upload"></i> Import CSV</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/chapters/export/csv" target="_blank"><i class="bi bi-filetype-csv"></i> Export CSV</a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="chSearch" class="form-control form-control-sm" placeholder="Search chapter name">
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Book</label>
                <select id="fBook" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Medium</label>
                <select id="fMedium" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Standard</label>
                <select id="fStd" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="chPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="chReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Chapter</th><th>Book</th><th>Medium</th><th>Standard</th><th>Created</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="chTbody">
                  <tr><td colspan="6" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="chStats"></div>
            <div id="chPager"></div>
          </div>
        </div>

        <!-- Modal -->
        <div class="modal fade" id="chModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>
              <form id="chForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="chapter_id">
                  <div class="mb-3">
                    <label class="form-label">Chapter Name <span class="text-danger">*</span></label>
                    <input name="chapter_name" class="form-control" required>
                  </div>
                  <div class="row g-2">
                    <div class="col-md-4">
                      <label class="form-label">Book</label>
                      <select name="book_id" class="form-select"></select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">Medium</label>
                      <select name="medium_id" class="form-select"></select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">Standard</label>
                      <select name="std_id" class="form-select"></select>
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

        <!-- Import CSV Modal -->
        <div class="modal fade" id="chImportModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Import Chapters CSV</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <textarea id="chImportText" class="form-control" rows="8" placeholder="Paste CSV content here"></textarea>
                <div class="small text-muted mt-2">Headers: chapter_name, book_name, medium_name, std_name</div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button id="chImportSubmit" type="button" class="btn btn-primary"><i class="bi bi-upload"></i> Import</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    async mount() {
      const tbody   = document.getElementById('chTbody');
      const pagerEl = document.getElementById('chPager');
      const statsEl = document.getElementById('chStats');

      const inpSearch = document.getElementById('chSearch');
      const selBook   = document.getElementById('fBook');
      const selMedium = document.getElementById('fMedium');
      const selStd    = document.getElementById('fStd');
      const selSize   = document.getElementById('chPageSize');
      const btnReload = document.getElementById('chReload');
      const btnNew    = document.getElementById('btnNew');
      const btnImport = document.getElementById('btnImport');

      const modalEl   = document.getElementById('chModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('chForm');

      const importModalEl = document.getElementById('chImportModal');
      const importModal   = bootstrap.Modal.getOrCreateInstance(importModalEl);
      const importText    = document.getElementById('chImportText');
      const importSubmit  = document.getElementById('chImportSubmit');

      let [books, mediums, standards] = await Promise.all([fetchBooks(), fetchMediums(), fetchStandards()]);
      selBook.innerHTML   += books.map(b => `<option value="${b.book_id}">${b.book_name}</option>`).join('');
      selMedium.innerHTML += mediums.map(m => `<option value="${m.medium_id}">${m.medium_name}</option>`).join('');
      selStd.innerHTML    += standards.map(s => `<option value="${s.std_id}">${s.std_name}</option>`).join('');
      form.book_id.innerHTML   = buildOptions(books,'book_id','book_name');
      form.medium_id.innerHTML = buildOptions(mediums,'medium_id','medium_name');
      form.std_id.innerHTML    = buildOptions(standards,'std_id','std_name');

      let page=1, pageSize=parseInt(selSize.value,10)||20;
      let q='', f_book='', f_medium='', f_std='';
      let lastRows=[];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start=(pg.page-1)*pg.pageSize+1, end=Math.min(pg.page*pg.pageSize,pg.total);
        statsEl.textContent=`${start}–${end} of ${pg.total}`;
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="6" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search:q };
          if (f_book)   query.book_name = f_book;
          if (f_medium) query.medium_name = f_medium;
          if (f_std)    query.std_name = f_std;

          const res = await api.get('/api/chapters', { query });
          const rows = res?.data || [];
          const pg   = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-muted">No chapters found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total: 0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');
          pagerEl.innerHTML='';
          pagerEl.appendChild(ui.pager({
            page:pg.page,pageSize:pg.pageSize,total:pg.total,
            onPage:p=>{ page=p; reload(); }
          }));
          setStats(pg);

          tbody.querySelectorAll('[data-act="view"]').forEach(btn =>
            btn.addEventListener('click', () => openForm('view', btn)));
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn =>
            btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn =>
            btn.addEventListener('click', async () => {
              const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
              if (!confirm('Delete this chapter?')) return;
              try { await api.del(`/api/chapters/${id}`); ui.toast('Chapter deleted','success'); reload(); }
              catch(e){ ui.toast(e.message||'Delete failed','danger'); }
            }));
        } catch(e) {
          tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-danger">${e.message||'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total: 0 });
        }
      }

      function fillForm(row) {
        form.reset();
        form.chapter_id.value = row?.chapter_id || '';
        form.chapter_name.value = row?.chapter_name || '';
        const b_id = row?.book_name   ? findByName(books,row.book_name,'book_name','book_id') : '';
        const m_id = row?.medium_name ? findByName(mediums,row.medium_name,'medium_name','medium_id') : '';
        const s_id = row?.std_name    ? findByName(standards,row.std_name,'std_name','std_id') : '';
        form.book_id.value   = b_id || '';
        form.medium_id.value = m_id || '';
        form.std_id.value    = s_id || '';
      }

      function openForm(mode, btn) {
        let row = null;
        if (btn) {
          const tr = btn.closest('tr');
          const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.chapter_id) === String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q=inpSearch.value.trim(); page=1; reload(); },350));
      selBook.addEventListener('change', ()=>{ f_book=selBook.value; page=1; reload(); });
      selMedium.addEventListener('change',()=>{ f_medium=selMedium.value; page=1; reload(); });
      selStd.addEventListener('change',   ()=>{ f_std=selStd.value; page=1; reload(); });
      selSize.addEventListener('change',  ()=>{ pageSize=parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Form submit
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        const id = payload.chapter_id || '';
        delete payload.chapter_id;

        payload.chapter_name = (payload.chapter_name||'').trim();
        ['book_id','medium_id','std_id'].forEach(k=>{
          if (payload[k]==='') payload[k]=null;
          else if(payload[k]) payload[k]=Number(payload[k]);
        });

        if (!payload.chapter_name) { ui.toast('Chapter name required','danger'); return; }

        try {
          if (id) {
            await api.put(`/api/chapters/${id}`, payload);
            ui.toast('Chapter updated','success');
          } else {
            await api.post('/api/chapters', payload);
            ui.toast('Chapter created','success');
          }
          modal.hide();
          page=1; reload();
        } catch(err) {
          ui.toast(err?.message || 'Save failed','danger');
        }
      });

      btnNew.addEventListener('click', () => openForm('new', null));

      // Import CSV
      btnImport.addEventListener('click', () => {
        importText.value='';
        importModal.show();
      });
      importSubmit.addEventListener('click', async () => {
        const csv = importText.value.trim();
        if (!csv) { ui.toast('Please paste CSV content','danger'); return; }
        try {
          await api.post('/api/chapters/import/csv', { csv });
          ui.toast('Import complete','success');
          importModal.hide();
          reload();
        } catch(e){ ui.toast(e.message||'Import failed','danger'); }
      });

      await reload();
    }
  };
})();
