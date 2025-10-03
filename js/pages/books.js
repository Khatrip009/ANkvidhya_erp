// public/js/pages/books.js
(() => {
  // ---------- Helpers to fetch master data ----------
  async function fetchAll(table) {
    const res = await api.get(`/api/master/${table}`, { query: { pageSize: 1000 } });
    return res?.data || [];
  }
  const fetchCourses  = () => api.get('/api/courses', { query: { pageSize: 1000 } }).then(r => r?.data || []);
  const fetchMediums  = () => fetchAll('medium');
  const fetchStandards= () => fetchAll('standards');

  const findByName = (list, name, nameKey, idKey='id') =>
    list.find(x => String(x[nameKey]||'').toLowerCase() === String(name||'').toLowerCase())?.[idKey] ?? '';

  const imgSrc = (url) => url && url.trim() ? url : 'images/placeholder.png';

  // ---------- Row HTML ----------
  function rowHtml(r) {
    return `
      <tr data-id="${r.book_id}">
        <td class="text-nowrap fw-semibold">${r.book_name || '-'}</td>
        <td>${r.course_name || '-'}</td>
        <td>${r.medium_name || '-'}</td>
        <td>${r.std_name || '-'}</td>
        <td>${r.price ?? '-'}</td>
        <td class="text-truncate" style="max-width:200px">${r.description || '-'}</td>
        <td class="text-center"><img src="${imgSrc(r.image)}" style="height:40px;width:auto;border-radius:4px"></td>
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
  window.pageBooks = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Books</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus"></i> New Book</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/books/export/csv" target="_blank"><i class="bi bi-filetype-csv"></i> CSV</a>
            <a class="btn btn-sm btn-outline-secondary" href="/api/books/export/excel" target="_blank"><i class="bi bi-file-earmark-spreadsheet"></i> Excel</a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="bookSearch" class="form-control form-control-sm" placeholder="Search book name">
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Course</label>
                <select id="fCourse" class="form-select form-select-sm"><option value="">All</option></select>
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
                <select id="bookPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="bookReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Name</th><th>Course</th><th>Medium</th><th>Standard</th>
                    <th>Price</th><th>Description</th><th>Image</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="bookTbody">
                  <tr><td colspan="8" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="bookStats"></div>
            <div id="bookPager"></div>
          </div>
        </div>

        <!-- Modal -->
        <div class="modal fade" id="bookModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>
              <form id="bookForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="book_id">
                  <div class="row g-2">
                    <div class="col-md-6">
                      <label class="form-label">Book Name <span class="text-danger">*</span></label>
                      <input name="book_name" class="form-control" required>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Price</label>
                      <input name="price" type="number" class="form-control">
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea name="description" class="form-control"></textarea>
                  </div>
                  <div class="row g-2 mb-3">
                    <div class="col-md-4">
                      <label class="form-label">Course</label>
                      <select name="course_id" class="form-select"></select>
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
                  <div class="mb-3">
                    <label class="form-label">Image URL</label>
                    <input name="image" class="form-control" placeholder="https://...">
                    <div class="mt-2">
                      <img id="bookPreview" src="images/placeholder.png" style="max-height:120px;border-radius:6px;">
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
      const tbody   = document.getElementById('bookTbody');
      const pagerEl = document.getElementById('bookPager');
      const statsEl = document.getElementById('bookStats');

      const inpSearch = document.getElementById('bookSearch');
      const selCourse = document.getElementById('fCourse');
      const selMedium = document.getElementById('fMedium');
      const selStd    = document.getElementById('fStd');
      const selSize   = document.getElementById('bookPageSize');
      const btnReload = document.getElementById('bookReload');
      const btnNew    = document.getElementById('btnNew');

      const modalEl   = document.getElementById('bookModal');
      const modal     = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form      = document.getElementById('bookForm');
      const imgPrev   = document.getElementById('bookPreview');

      let [courses, mediums, standards] = await Promise.all([fetchCourses(), fetchMediums(), fetchStandards()]);
      selCourse.innerHTML += courses.map(c => `<option value="${c.course_id}">${c.course_name}</option>`).join('');
      selMedium.innerHTML += mediums.map(m => `<option value="${m.medium_id}">${m.medium_name}</option>`).join('');
      selStd.innerHTML    += standards.map(s => `<option value="${s.std_id}">${s.std_name}</option>`).join('');
      form.course_id.innerHTML = buildOptions(courses,'course_id','course_name');
      form.medium_id.innerHTML = buildOptions(mediums,'medium_id','medium_name');
      form.std_id.innerHTML    = buildOptions(standards,'std_id','std_name');

      let page=1, pageSize=parseInt(selSize.value,10)||20;
      let q='', f_course='', f_medium='', f_std='';
      let lastRows=[];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start=(pg.page-1)*pg.pageSize+1, end=Math.min(pg.page*pg.pageSize,pg.total);
        statsEl.textContent=`${start}–${end} of ${pg.total}`;
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="8" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search:q };
          if (f_course) query.course_id = f_course;
          if (f_medium) query.medium_id = f_medium;
          if (f_std)    query.std_id = f_std;

          const res = await api.get('/api/books', { query });
          const rows = res?.data || [];
          const pg   = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-muted">No books found</td></tr>`;
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
              if (!confirm('Delete this book?')) return;
              try { await api.del(`/api/books/${id}`); ui.toast('Book deleted','success'); reload(); }
              catch(e){ ui.toast(e.message||'Delete failed','danger'); }
            }));
        } catch(e) {
          tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-danger">${e.message||'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total: 0 });
        }
      }

      function fillForm(row) {
        form.reset();
        form.book_id.value = row?.book_id || '';
        form.book_name.value = row?.book_name || '';
        form.description.value = row?.description || '';
        form.price.value = row?.price || '';
        form.image.value = row?.image || '';
        imgPrev.src = imgSrc(row?.image);

        const c_id = row?.course_name ? findByName(courses,row.course_name,'course_name','course_id') : '';
        const m_id = row?.medium_name ? findByName(mediums,row.medium_name,'medium_name','medium_id') : '';
        const s_id = row?.std_name    ? findByName(standards,row.std_name,'std_name','std_id')       : '';
        form.course_id.value = c_id || '';
        form.medium_id.value = m_id || '';
        form.std_id.value    = s_id || '';
      }

      function openForm(mode, btn) {
        let row = null;
        if (btn) {
          const tr = btn.closest('tr');
          const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.book_id) === String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q=inpSearch.value.trim(); page=1; reload(); },350));
      selCourse.addEventListener('change',()=>{ f_course=selCourse.value; page=1; reload(); });
      selMedium.addEventListener('change',()=>{ f_medium=selMedium.value; page=1; reload(); });
      selStd.addEventListener('change',   ()=>{ f_std=selStd.value; page=1; reload(); });
      selSize.addEventListener('change',  ()=>{ pageSize=parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Form
      form.image.addEventListener('input', () => {
        const val = form.image.value.trim();
        imgPrev.src = imgSrc(val);
      });

      form.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        const id = payload.book_id || '';
        delete payload.book_id;

        payload.book_name = (payload.book_name||'').trim();
        payload.description = (payload.description||'').trim() || null;
        payload.price = payload.price ? Number(payload.price) : null;
        payload.image = (payload.image||'').trim() || null;
        ['course_id','medium_id','std_id'].forEach(k=>{
          if (payload[k]==='') payload[k]=null;
          else if(payload[k]) payload[k]=Number(payload[k]);
        });

        if (!payload.book_name) { ui.toast('Book name required','danger'); return; }

        try {
          if (id) {
            await api.put(`/api/books/${id}`, payload);
            ui.toast('Book updated','success');
          } else {
            await api.post('/api/books', payload);
            ui.toast('Book created','success');
          }
          modal.hide();
          page=1; reload();
        } catch(err) {
          ui.toast(err?.message || 'Save failed','danger');
        }
      });

      btnNew.addEventListener('click', () => openForm('new', null));

      await reload();
    }
  };
})();
