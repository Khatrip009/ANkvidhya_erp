// public/js/pages/students.js
window.pageStudents = (() => {
  // ---------- tiny helpers ----------
  const $ = (id) => document.getElementById(id);
  const html = String.raw;
  const safeBadge = (v) => (v ? `<span class="badge-soft">${v}</span>` : '<span class="text-muted">—</span>');
  const initialsOf = (name='') =>
    name.split(' ').map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'ST';

  // RLS helpers
  const getRole = () => (localStorage.getItem('role') || '').toLowerCase();
  const isScopedRole = () => ['faculty', 'team_leader', 'school_admin'].includes(getRole());

  // ---------- caches ----------
  const cache = {
    mediums: null,
    standards: null,
    divisions: null,
    schools: [],          // current visible schools list (RLS)
    classes: []           // /api/me/classes for scoped roles
  };

  async function fetchList(url, query = {}) {
    try { return (await api.get(url, { query }))?.data || []; }
    catch { return []; }
  }

  const loadMediums   = async () => cache.mediums   ??= await fetchList('/api/master/medium',    { pageSize: 1000 });
  const loadStandards = async () => cache.standards ??= await fetchList('/api/master/standards', { pageSize: 1000 });
  const loadDivisions = async () => cache.divisions ??= await fetchList('/api/master/divisions', { pageSize: 1000 });

  // RLS-scoped discovery
  async function fetchMySchools()  { const { data } = await api.get('/api/me/schools').catch(()=>({data:[]})); return data||[]; }
  async function fetchMyClasses()  { const { data } = await api.get('/api/me/classes').catch(()=>({data:[]})); return data||[]; }

  // Schools loader honoring RLS. For scoped roles, filter client-side by search.
  async function loadSchools(search='') {
    if (isScopedRole()) {
      const rows = await fetchMySchools();
      const q = String(search || '').toLowerCase();
      const filtered = q ? rows.filter(r => String(r.school_name||'').toLowerCase().includes(q)) : rows;
      cache.schools = filtered;
      return filtered;
    } else {
      const rows = await fetchList('/api/schools', { pageSize: 1000, search });
      cache.schools = rows;
      return rows;
    }
  }

  function isAllowedSchool(id) {
    if (!id) return true; // empty means "any" (server will still scope)
    return cache.schools.some(s => String(s.school_id) === String(id));
  }

  // ---------- layout builders ----------
  function renderFilters() {
    return html`
      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label">School</label>
          <div class="d-flex gap-2">
            <select id="fSchool" class="form-select">
              <option value="">All (RLS)</option>
            </select>
            <input id="fSchoolQuick" class="form-control" placeholder="Type to filter schools…">
          </div>
          <div class="form-text">List is automatically restricted by RLS.</div>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label">Medium</label>
          <select id="fMedium" class="form-select"><option value="">Any</option></select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label">Standard</label>
          <select id="fStd" class="form-select"><option value="">Any</option></select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label">Division</label>
          <select id="fDiv" class="form-select"><option value="">Any</option></select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label">Page size</label>
          <select id="sPageSize" class="form-select"><option>10</option><option>20</option><option>50</option></select>
        </div>
      </div>
    `;
  }

  function toolbar() {
    return html`
      <div class="d-flex flex-wrap gap-2 table-toolbar">
        <div class="input-group input-group-sm" style="width:320px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input id="sSearch" class="form-control" placeholder="Search name / contact / email">
        </div>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" id="btnImport"><i class="bi bi-upload"></i> Import CSV</button>
          <button class="btn btn-outline-secondary" id="btnExportCsv"><i class="bi bi-filetype-csv"></i> CSV</button>
          <button class="btn btn-outline-secondary" id="btnExportXlsx"><i class="bi bi-filetype-xlsx"></i> Excel</button>
        </div>
        <button class="btn btn-primary btn-sm" id="btnNew"><i class="bi bi-plus-circle"></i> New Student</button>
      </div>
    `;
  }

  function tableBox() {
    return html`
      <div class="table-wrap card-table rounded-3 border">
        <table class="table table-hover table-modern align-middle mb-0">
          <thead>
            <tr>
              <th style="width:48px"></th>
              <th>Student</th>
              <th>Contact</th>
              <th>School</th>
              <th>Medium</th>
              <th>Std</th>
              <th>Div</th>
              <th>District</th>
              <th>State</th>
              <th style="width:120px">Actions</th>
            </tr>
          </thead>
          <tbody id="tblBody">
            <tr><td colspan="10">${ui.spinner()}</td></tr>
          </tbody>
        </table>
      </div>
      <div id="tblPager" class="mt-2"></div>
    `;
  }

  function card(title, body, tools='') {
    return html`
      <div class="card shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="fw-semibold">${title}</span>
          <div>${tools}</div>
        </div>
        <div class="card-body">${body}</div>
      </div>
    `;
  }

  // ---------- modal form ----------
  function modalHtml() {
    return html`
      <div class="modal fade" id="stuModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header border-0 pb-0">
              <div class="flex-grow-1"></div>
              <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
            </div>
            <form id="stuForm">
              <div class="modal-body pt-0">
                <input type="hidden" name="student_id">
                <div class="d-flex align-items-center gap-3 mb-3">
                  <div class="avatar-circle" id="stuAvatar" style="width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#f3f6f9;border:1px solid var(--bs-border-color);font-weight:600;">
                    ST
                  </div>
                  <div class="w-100">
                    <div class="row g-2">
                      <div class="col-12 col-md-4">
                        <label class="form-label">Full Name <span class="text-danger">*</span></label>
                        <input name="full_name" class="form-control" required placeholder="e.g. Meera Patel">
                      </div>
                      <div class="col-6 col-md-3">
                        <label class="form-label">Contact</label>
                        <input name="contact" class="form-control" placeholder="e.g. 98765 43210">
                      </div>
                      <div class="col-6 col-md-3">
                        <label class="form-label">Email</label>
                        <input name="email" type="email" class="form-control" placeholder="email@example.com">
                      </div>
                      <div class="col-12 col-md-2">
                        <label class="form-label">Roll No</label>
                        <input name="roll_no" class="form-control" placeholder="optional">
                      </div>
                    </div>
                  </div>
                </div>

                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label class="form-label">School <span class="text-danger">*</span></label>
                    <select name="school_id" class="form-select"></select>
                    <div class="form-text">Only schools you can access (RLS).</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <label class="form-label">Medium</label>
                    <select name="medium_id" class="form-select"></select>
                  </div>
                  <div class="col-6 col-md-2">
                    <label class="form-label">Standard</label>
                    <select name="std_id" class="form-select"></select>
                  </div>
                  <div class="col-6 col-md-2">
                    <label class="form-label">Division</label>
                    <select name="div_id" class="form-select"></select>
                  </div>
                </div>

                <div class="row g-2 mt-2">
                  <div class="col-6 col-md-3">
                    <label class="form-label">District (text)</label>
                    <input name="district_name" class="form-control" placeholder="optional">
                  </div>
                  <div class="col-6 col-md-3">
                    <label class="form-label">State (text)</label>
                    <input name="state_name" class="form-control" placeholder="optional">
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Address</label>
                    <input name="address" class="form-control" placeholder="optional">
                  </div>
                </div>

                <div class="mt-3 small text-muted">
                  <i class="bi bi-info-circle me-1"></i>
                  On create, a linked user may be auto-created server-side as per your controller.
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
  }

  // ---------- state ----------
  const state = {
    page: 1,
    pageSize: 10,
    q: ''
  };

  // ---------- list loader ----------
  async function reload() {
    const params = {
      page: state.page,
      pageSize: state.pageSize,
      search: state.q,
      school_id: $('fSchool').value || '',
      medium_id: $('fMedium').value || '',
      std_id: $('fStd').value || '',
      div_id: $('fDiv').value || ''
    };

    const body = $('tblBody');
    body.innerHTML = `<tr><td colspan="10">${ui.spinner('sm')}</td></tr>`;

    try {
      const res  = await api.get('/api/students', { query: params });
      const rows = res?.data || [];
      const pg   = res?.pagination || { page: state.page, pageSize: state.pageSize, total: rows.length };

      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="10" class="text-center text-muted p-4">No students found</td></tr>`;
      } else {
        body.innerHTML = rows.map(r => `
          <tr>
            <td><span class="avatar-soft">${initialsOf(r.full_name || '')}</span></td>
            <td>
              <div class="fw-semibold">${r.full_name || ''}</div>
              <div class="text-muted small">${r.username || ''}</div>
            </td>
            <td>
              <div>${r.contact || '—'}</div>
              <div class="text-muted small">${r.email || ''}</div>
            </td>
            <td>${safeBadge(r.school_name)}</td>
            <td>${safeBadge(r.medium_name)}</td>
            <td>${safeBadge(r.std_name)}</td>
            <td>${safeBadge(r.division_name)}</td>
            <td>${r.district_name || '—'}</td>
            <td>${r.state_name || '—'}</td>
            <td>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" data-act="edit" data-id="${r.student_id}" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-outline-danger" data-act="delete" data-id="${r.student_id}" title="Delete"><i class="bi bi-trash"></i></button>
              </div>
            </td>
          </tr>
        `).join('');
      }

      // actions
      body.querySelectorAll('[data-act="edit"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            const one = await api.get(`/api/students/${id}`);
            openForm('edit', one?.data || null);
          } catch (e) {
            ui.toast(e?.message || 'Failed to load student', 'danger');
          }
        });
      });
      body.querySelectorAll('[data-act="delete"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!confirm('Delete this student?')) return;
          try {
            await api.del(`/api/students/${id}`);
            ui.toast('Student deleted', 'success');
            reload();
          } catch (e) {
            if (e?.status === 403) ui.toast('Restricted by RLS.', 'warning');
            else ui.toast(e?.message || 'Failed to delete', 'danger');
          }
        });
      });

      // pager
      const pager = $('tblPager');
      pager.innerHTML = '';
      pager.appendChild(ui.pager({
        page: pg.page, pageSize: pg.pageSize, total: pg.total,
        onPage: (p) => { state.page = p; reload(); }
      }));
    } catch (e) {
      $('tblBody').innerHTML = `<tr><td colspan="10" class="text-danger p-4">${e.message || 'Failed to load.'}</td></tr>`;
      $('tblPager').innerHTML = '';
    }
  }

  // ---------- form helpers ----------
  async function fillFormSelects(form, selected = {}) {
    // ensure schools cache exists for RLS guard
    if (!cache.schools.length) await loadSchools('');

    const [mediums, stds, divs] = await Promise.all([loadMediums(), loadStandards(), loadDivisions()]);

    // If scoped, restrict Medium/Std/Div by allocations
    let medOpts = mediums, stdOpts = stds, divOpts = divs;
    if (isScopedRole() && cache.classes.length) {
      const uniq = (arr, key) => {
        const s = new Set(); const out=[];
        for (const x of arr) { const k=x[key]; if(k==null||s.has(k)) continue; s.add(k); out.push(x); }
        return out;
      };
      const meds = uniq(cache.classes, 'medium_id').map(c => ({
        medium_id: c.medium_id,
        medium_name: c.medium_name || (mediums.find(m=>m.medium_id===c.medium_id)?.medium_name) || c.medium_id
      }));
      const stdsR = uniq(cache.classes, 'standard_id').map(c => ({
        std_id: c.standard_id,
        std_name: c.standard_name || c.std_name || c.standard_id
      }));
      const divsR = uniq(cache.classes, 'division_id').map(c => ({
        div_id: c.division_id,
        division_name: c.division_name || c.div_name || c.division_id
      }));
      medOpts = meds; stdOpts = stdsR; divOpts = divsR;
    }

    const fill = (sel, rows, vk, lk, val) => {
      sel.innerHTML = `<option value="">—</option>` +
        rows.map(r => `<option value="${r[vk]}" ${String(val||'')===String(r[vk])?'selected':''}>${r[lk]}</option>`).join('');
    };
    fill(form.querySelector('select[name="school_id"]'), cache.schools, 'school_id', 'school_name', selected.school_id);
    fill(form.querySelector('select[name="medium_id"]'), medOpts, 'medium_id', 'medium_name', selected.medium_id);
    fill(form.querySelector('select[name="std_id"]'),    stdOpts,  'std_id',    'std_name',    selected.std_id);
    fill(form.querySelector('select[name="div_id"]'),    divOpts,  'div_id',    'division_name', selected.div_id);
  }

  function setAvatarFromName(name) {
    const el = $('stuAvatar');
    if (el) el.textContent = initialsOf(name || 'ST');
  }

  function openForm(mode, row) {
    const modalEl = $('stuModal');
    const modal   = bootstrap.Modal.getOrCreateInstance(modalEl);
    const form    = $('stuForm');

    // reset
    form.reset();
    setAvatarFromName(row?.full_name || '');
    form.querySelector('[name="student_id"]').value = row?.student_id || '';
    form.querySelector('[name="full_name"]').value  = row?.full_name || '';
    form.querySelector('[name="contact"]').value    = row?.contact || '';
    form.querySelector('[name="email"]').value      = row?.email || '';
    form.querySelector('[name="roll_no"]').value    = row?.roll_no || '';
    form.querySelector('[name="district_name"]').value = row?.district_name || '';
    form.querySelector('[name="state_name"]').value    = row?.state_name || '';
    form.querySelector('[name="address"]').value       = row?.address || '';

    // populate selects
    fillFormSelects(form, {
      school_id: row?.school_id || '',
      medium_id: row?.medium_id || '',
      std_id:    row?.std_id || '',
      div_id:    row?.div_id || ''
    }).then(() => {
      // safety: if preselected school is no longer allowed by RLS, clear it
      const sel = form.querySelector('select[name="school_id"]');
      if (sel && sel.value && !isAllowedSchool(sel.value)) sel.value = '';
    });

    // live avatar
    form.querySelector('[name="full_name"]').addEventListener('input', e => setAvatarFromName(e.target.value), { once:false });

    // submit handler
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const id = payload.student_id || '';
      delete payload.student_id;

      // normalize, and **RLS guard** for school
      payload.full_name     = (payload.full_name || '').trim();
      payload.contact       = (payload.contact || '').trim() || null;
      payload.email         = (payload.email || '').trim() || null;
      payload.roll_no       = (payload.roll_no || '').trim() || null;
      payload.address       = (payload.address || '').trim() || null;
      payload.district_name = (payload.district_name || '').trim() || null;
      payload.state_name    = (payload.state_name || '').trim() || null;

      ['school_id','medium_id','std_id','div_id'].forEach(k => {
        if (payload[k] === '') payload[k] = null; else payload[k] = Number(payload[k]);
      });

      if (!payload.full_name) { ui.toast('Full name is required', 'danger'); return; }
      if (!payload.school_id) { ui.toast('School is required', 'danger'); return; }
      if (!isAllowedSchool(payload.school_id)) {
        ui.toast('You do not have access to that school (RLS).', 'warning');
        return;
      }

      try {
        if (id) {
          await api.put(`/api/students/${id}`, payload);
          ui.toast('Student updated', 'success');
        } else {
          await api.post('/api/students', payload);
          ui.toast('Student created', 'success');
        }
        modal.hide();
        reload();
      } catch (e) {
        if (e?.status === 403) ui.toast('Restricted by RLS.', 'warning');
        else ui.toast(e?.message || 'Save failed', 'danger');
      }
    };

    modal.show();
  }

  // CSV upload (keeps auth header)
  async function uploadCSVFile(file) {
    const token = window.auth?.getToken?.() || (window.localStorage && localStorage.getItem('token')) || '';
    const fd = new FormData();
    const text = await file.text();
    fd.append('csv', text);

    const resp = await fetch('/api/students/import', {
      method: 'POST',
      headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      body: fd
    });
    if (!resp.ok) throw new Error((await resp.text().catch(()=>'')) || 'Upload failed');
    return await resp.json().catch(()=> ({}));
  }

  // ---------- public API ----------
  return {
    render() {
      // Inject modal (once)
      if (!document.getElementById('stuModal')) {
        const wrap = document.createElement('div');
        wrap.innerHTML = modalHtml();
        document.body.appendChild(wrap.firstElementChild);
      }

      return html`
        <div class="row g-3">
          <div class="col-12">
            ${card('Student Filters', renderFilters(), toolbar())}
          </div>
          <div class="col-12">
            ${card('Students', tableBox())}
          </div>
        </div>
      `;
    },

    async mount() {
      // masters
      const [mediums, stds, divs] = await Promise.all([loadMediums(), loadStandards(), loadDivisions()]);

      // If scoped role, prefetch classes (allocations) to build restricted filters
      if (isScopedRole()) {
        cache.classes = await fetchMyClasses();
      }

      // Fill Medium/Std/Div filters
      const fill = (sel, rows, vk, lk) => {
        sel.innerHTML = `<option value="">Any</option>` + rows.map(r => `<option value="${r[vk]}">${r[lk]}</option>`).join('');
      };

      if (isScopedRole() && cache.classes.length) {
        const uniq = (arr, key) => { const s=new Set(); const out=[]; for(const x of arr){const k=x[key]; if(k==null||s.has(k))continue; s.add(k); out.push(x);} return out; };

        const classMeds = uniq(cache.classes, 'medium_id').map(c => ({
          medium_id: c.medium_id,
          medium_name: c.medium_name || (mediums.find(m=>m.medium_id===c.medium_id)?.medium_name) || c.medium_id
        }));
        const classStds = uniq(cache.classes, 'standard_id').map(c => ({
          std_id: c.standard_id,
          std_name: c.standard_name || c.std_name || c.standard_id
        }));
        const classDivs = uniq(cache.classes, 'division_id').map(c => ({
          div_id: c.division_id,
          division_name: c.division_name || c.div_name || c.division_id
        }));

        fill($('fMedium'), classMeds, 'medium_id', 'medium_name');
        fill($('fStd'),    classStds, 'std_id',    'std_name');
        fill($('fDiv'),    classDivs, 'div_id',    'division_name');
      } else {
        fill($('fMedium'),  mediums, 'medium_id',  'medium_name');
        fill($('fStd'),     stds,    'std_id',     'std_name');
        fill($('fDiv'),     divs,    'div_id',     'division_name');
      }

      // RLS-scoped schools
      const schools = await loadSchools('');
      $('fSchool').innerHTML =
        `<option value="">All (RLS)</option>` +
        schools.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join('');

      // school quick filter
      $('fSchoolQuick').addEventListener('input', ui.debounce(async () => {
        const q = $('fSchoolQuick').value.trim();
        if (isScopedRole()) {
          // filter locally for scoped roles
          const all = await loadSchools(''); // refresh baseline
          const list = q ? all.filter(s => String(s.school_name||'').toLowerCase().includes(q.toLowerCase())) : all;
          cache.schools = list;
          $('fSchool').innerHTML = `<option value="">All (RLS)</option>` +
            list.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join('');
        } else {
          // admin can search server-side
          const list = await loadSchools(q);
          $('fSchool').innerHTML = `<option value="">All (RLS)</option>` +
            list.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join('');
        }
      }, 300));

      // filters
      ['fSchool','fMedium','fStd','fDiv'].forEach(id => {
        $(id).addEventListener('change', () => { state.page = 1; reload(); });
      });

      // search
      $('sSearch').addEventListener('input', ui.debounce(() => {
        state.q = $('sSearch').value.trim(); state.page = 1; reload();
      }, 300));

      // page size
      $('sPageSize').addEventListener('change', () => {
        state.pageSize = parseInt($('sPageSize').value, 10) || 10; state.page = 1; reload();
      });

      // exports
      $('btnExportCsv').addEventListener('click', () => {
        const qs = new URLSearchParams({
          school_id: $('fSchool').value || '',
          medium_id: $('fMedium').value || '',
          std_id: $('fStd').value || '',
          div_id: $('fDiv').value || '',
          search: $('sSearch').value || ''
        });
        const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
        window.open(`${base}/api/reports-export/students.csv?${qs}`, '_blank');
      });
      $('btnExportXlsx').addEventListener('click', () => {
        const qs = new URLSearchParams({
          school_id: $('fSchool').value || '',
          medium_id: $('fMedium').value || '',
          std_id: $('fStd').value || '',
          div_id: $('fDiv').value || '',
          search: $('sSearch').value || ''
        });
        const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
        window.open(`${base}/api/reports-export/students.xlsx?${qs}`, '_blank');
      });

      // import
      $('btnImport').addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.csv,text/csv';
        inp.onchange = async () => {
          const f = inp.files?.[0]; if (!f) return;
          try { ui.toast('Uploading CSV…', 'info'); await uploadCSVFile(f); ui.toast('Import complete', 'success'); reload(); }
          catch (e) { ui.toast(e?.message || 'Import failed', 'danger'); }
        };
        inp.click();
      });

      // new student
      $('btnNew').addEventListener('click', () => openForm('new', null));

      // initial load
      await reload();
    }
  };
})();
