// public/js/pages/schools.js
(() => {
  'use strict';

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;
  const MAX_LOGO_BYTES = 50 * 1024;
  const DEFAULT_LOGO = '/images/ank.png';
  const COMPANY_LOGO = '/images/Ank_Logo.png';

  /* ----------------- helpers ----------------- */
  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"'`=\/]/g, c => ( {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[c] ));
  }

  function toast(msg, type = 'info') {
    if (window.ui && typeof window.ui.toast === 'function') {
      window.ui.toast(msg, type === 'error' ? 'danger' : type);
      return;
    }
    // fallback
    if (type === 'error') console.error(msg);
    else console.log(msg);
    try { alert(msg); } catch (e) {}
  }

  function getAuthToken() {
    try {
      if (window.api && (window.api._token || window.api.token)) return window.api._token || window.api.token;
    } catch (e) {}
    const keys = ['token','auth_token','access_token','jwt'];
    for (const k of keys) {
      try { const v = localStorage.getItem(k); if (v) return v; } catch(e) {}
    }
    return null;
  }

  /* ----------------- API wrappers ----------------- */
  // Uses existing global `api` for normal JSON requests (keeps cookies/auth)
  async function listSchoolsApi(params) {
    // returns { data: [...], pagination: {...} }
    return await api.get('/api/schools', { query: params });
  }

  async function getSchoolApi(id) {
    return await api.get(`/api/schools/${id}`);
  }

  async function createSchoolApi(payload) {
    return await api.post('/api/schools', payload);
  }

  async function updateSchoolApi(id, payload) {
    return await api.put(`/api/schools/${id}`, payload);
  }

  async function deleteSchoolApi(id) {
    return await api.delete(`/api/schools/${id}`);
  }

  /* ----------------- upload helpers ----------------- */
  async function uploadLogoFile(file) {
    if (!file) throw new Error('No file selected');
    if (!file.type.startsWith('image/')) throw new Error('Only image files allowed');
    if (file.size > MAX_LOGO_BYTES) throw new Error('File too large (max 50 KB)');

    const fd = new FormData();
    fd.append('logo', file);

    const tok = getAuthToken();
    const headers = tok ? { 'Authorization': `Bearer ${tok}` } : {};

    const resp = await fetch('/api/schools/upload-logo', {
      method: 'POST',
      body: fd,
      headers,
      credentials: 'same-origin'
    });

    if (resp.status === 401) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    if (!resp.ok) {
      let msg = 'Upload failed';
      try { const j = await resp.json(); msg = j.error || j.message || msg; } catch (e) {}
      throw new Error(msg);
    }
    const j = await resp.json();
    return j.url;
  }

  /* ----------------- CSV import/export ----------------- */
  async function exportCSV(filters = {}) {
    const tok = getAuthToken();
    const qsObj = new URLSearchParams(filters || {}).toString();
    const url = '/api/schools/export/csv' + (qsObj ? ('?' + qsObj) : '');
    const headers = tok ? { 'Authorization': `Bearer ${tok}` } : {};
    const resp = await fetch(url, { method: 'GET', headers, credentials: 'same-origin' });
    if (resp.status === 401) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    if (!resp.ok) {
      let msg = 'Export failed';
      try { const j = await resp.json(); msg = j.message || j.error || msg; } catch (e) {}
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'schools.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCSV(file) {
    if (!file) throw new Error('No file chosen');
    const fd = new FormData();
    fd.append('file', file);
    const tok = getAuthToken();
    const headers = tok ? { 'Authorization': `Bearer ${tok}` } : {};
    const resp = await fetch('/api/schools/import', { method: 'POST', headers, body: fd, credentials: 'same-origin' });
    if (resp.status === 401) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    if (!resp.ok) {
      let msg = 'Import failed';
      try { const j = await resp.json(); msg = j.message || j.error || msg; } catch (e) {}
      throw new Error(msg);
    }
    return await resp.json();
  }

  /* ----------------- renderers ----------------- */
  function renderTopBar({ states = [], districts = [], media = [] } = {}) {
    const stateOpts = ['<option value="">All states</option>'].concat(states.map(s => `<option value="${s.state_id}">${escapeHtml(s.state_name)}</option>`)).join('');
    const districtOpts = ['<option value="">All districts</option>'].concat(districts.map(d => `<option value="${d.district_id}">${escapeHtml(d.district_name)}</option>`)).join('');
    const mediumOpts = ['<option value="">All media</option>'].concat(media.map(m => `<option value="${m.medium_id}">${escapeHtml(m.medium_name)}</option>`)).join('');

    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-4">
              <label class="form-label">Search</label>
              <input id="fSearch" class="form-control" placeholder="school name, email, contact person">
            </div>
            <div class="col-md-2">
              <label class="form-label">State</label>
              <select id="fState" class="form-select">${stateOpts}</select>
            </div>
            <div class="col-md-2">
              <label class="form-label">District</label>
              <select id="fDistrict" class="form-select">${districtOpts}</select>
            </div>
            <div class="col-md-2">
              <label class="form-label">Medium</label>
              <select id="fMedium" class="form-select">${mediumOpts}</select>
            </div>
            <div class="col-md-2 d-grid">
              <div class="btn-group" role="group">
                <button id="btnSearch" class="btn btn-primary"><i class="bi bi-search"></i> Search</button>
                <button id="btnNew" class="btn btn-success" title="Create"><i class="bi bi-plus-lg"></i></button>
                <button id="btnExport" class="btn btn-outline-secondary" title="Export CSV"><i class="bi bi-download"></i></button>
                <button id="btnImport" class="btn btn-outline-secondary" title="Import CSV"><i class="bi bi-upload"></i></button>
              </div>
              <input id="importFile" type="file" accept=".csv" class="d-none" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function schoolRowHtml(s) {
    const img = s.image || DEFAULT_LOGO;
    return `
      <tr data-id="${s.school_id}">
        <td style="width:64px">
          <img src="${escapeHtml(img)}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO}'" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #ddd" />
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(s.school_name || '')}</div>
          <div class="small text-muted">${escapeHtml(s.address || '')}</div>
        </td>
        <td>${escapeHtml(s.contact_person || '')}<div class="small text-muted">${escapeHtml(s.contact_no || '')}</div></td>
        <td>${escapeHtml(s.email || '')}</td>
        <td>${escapeHtml(s.medium_name || '')}</td>
        <td>${escapeHtml(s.state_name || '')}<div class="small text-muted">${escapeHtml(s.district_name || '')}</div></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary btn-edit" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-secondary btn-logo" title="Upload logo"><i class="bi bi-image"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete" title="Delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }

  function renderList({ rows = [], pagination = {} } = {}) {
    if (!rows || rows.length === 0) {
      return `<div class="card"><div class="card-body">No schools</div></div>`;
    }
    const trs = rows.map(schoolRowHtml).join('');
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || DEFAULT_PAGE_SIZE;
    const total = pagination.total || rows.length;
    const pagerTxt = `Showing ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, total)} of ${total}`;

    return `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-striped table-sm align-middle">
              <thead>
                <tr>
                  <th style="width:64px"></th>
                  <th>School</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Medium</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${trs}
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">${pagerTxt}</small>
            <div>
              <button id="prevPage" class="btn btn-sm btn-outline-secondary">Prev</button>
              <button id="nextPage" class="btn btn-sm btn-outline-secondary ms-1">Next</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ----------------- modal (ui.modal fallback) ----------------- */
  async function openModal({ title = '', body = '', okText = 'OK' } = {}) {
    if (window.ui && typeof window.ui.modal === 'function') {
      try {
        const m = await window.ui.modal({ title, body, okText });
        return m; // modal DOM or null
      } catch (e) {
        return null;
      }
    }

    // Bootstrap fallback - returns modal DOM element on OK (so caller can read fields immediately)
    const id = `modal_${Date.now()}`;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="${id}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <img src="${COMPANY_LOGO}" style="height:28px;margin-right:8px" alt="logo"/>
              <h5 class="modal-title">${escapeHtml(title)}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-cancel" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary btn-ok">${escapeHtml(okText)}</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper);
    const el = wrapper.querySelector('.modal');
    const bsModal = new bootstrap.Modal(el, { backdrop: 'static' });

    return await new Promise(resolve => {
      // If dismissed via close/cancel -> resolve null
      el.addEventListener('hidden.bs.modal', () => {
        resolve(null);
        // remove wrapper after hidden
        setTimeout(() => wrapper.remove(), 200);
      }, { once: true });

      el.querySelector('.btn-ok').addEventListener('click', () => {
        // Resolve with the modal DOM root to allow reading input values
        resolve(el);
        bsModal.hide();
      }, { once: true });

      bsModal.show();
    });
  }

  /* ----------------- page lifecycle ----------------- */
  async function mount(root) {
    let page = DEFAULT_PAGE;
    let pageSize = DEFAULT_PAGE_SIZE;

    // load lookups
    let lookups = { states: [], districts: [], media: [] };
    try {
      const [states, districts, media] = await Promise.all([
        api.get('/api/master', { query: { table: 'states', pageSize: 1000 } }).then(r => r.data).catch(()=>[]),
        api.get('/api/master', { query: { table: 'districts', pageSize: 1000 } }).then(r => r.data).catch(()=>[]),
        api.get('/api/master', { query: { table: 'medium', pageSize: 1000 } }).then(r => r.data).catch(()=>[])
      ]);
      lookups = { states: states || [], districts: districts || [], media: media || [] };
    } catch (e) {
      console.warn('Failed to load lookups', e);
    }

    root.innerHTML = `<div id="toolbar"></div><div id="content"></div>`;
    qs('#toolbar').innerHTML = renderTopBar(lookups);

    const fSearch = qs('#fSearch');
    const fState  = qs('#fState');
    const fDistrict = qs('#fDistrict');
    const fMedium = qs('#fMedium');
    const importFile = qs('#importFile');

    async function refresh() {
      try {
        const q = { page, pageSize };
        if (fSearch.value) q.search = fSearch.value.trim();
        if (fState.value) q.state_name = fState.options[fState.selectedIndex].text;
        if (fDistrict.value) q.district_name = fDistrict.options[fDistrict.selectedIndex].text;
        if (fMedium.value) q.medium_name = fMedium.options[fMedium.selectedIndex].text;

        const res = await listSchoolsApi(q);
        const rows = res?.data || [];
        const pagination = res?.pagination || { page, pageSize, total: rows.length };

        qs('#content').innerHTML = renderList({ rows, pagination });

        // wire actions via delegation
        qsa('.btn-edit').forEach(btn => {
          btn.onclick = async (ev) => {
            const tr = ev.currentTarget.closest('tr');
            const id = tr.dataset.id;
            try {
              const resp = await getSchoolApi(id);
              const data = resp?.data || {};
              const body = `
                <div class="row g-2">
                  <div class="col-12"><label class="form-label">School name</label><input id="m_name" class="form-control" value="${escapeHtml(data.school_name||'')}"></div>
                  <div class="col-md-6"><label class="form-label">Email</label><input id="m_email" class="form-control" value="${escapeHtml(data.email||'')}"></div>
                  <div class="col-md-6"><label class="form-label">Contact person</label><input id="m_contact_person" class="form-control" value="${escapeHtml(data.contact_person||'')}"></div>
                  <div class="col-md-6"><label class="form-label">Contact no</label><input id="m_contact_no" class="form-control" value="${escapeHtml(data.contact_no||'')}"></div>
                  <div class="col-md-6"><label class="form-label">Medium</label>
                    <select id="m_medium" class="form-select"><option value="">Medium</option>${lookups.media.map(m=>`<option value="${m.medium_id}" ${data.medium_id==m.medium_id?'selected':''}>${escapeHtml(m.medium_name)}</option>`).join('')}</select></div>
                  <div class="col-md-6"><label class="form-label">State</label>
                    <select id="m_state" class="form-select"><option value="">State</option>${lookups.states.map(s=>`<option value="${s.state_id}" ${data.state_id==s.state_id?'selected':''}>${escapeHtml(s.state_name)}</option>`).join('')}</select></div>
                  <div class="col-md-6"><label class="form-label">District</label>
                    <select id="m_district" class="form-select"><option value="">District</option>${lookups.districts.map(d=>`<option value="${d.district_id}" ${data.district_id==d.district_id?'selected':''}>${escapeHtml(d.district_name)}</option>`).join('')}</select></div>
                  <div class="col-12"><label class="form-label">Address</label><input id="m_address" class="form-control" value="${escapeHtml(data.address||'')}"></div>
                  <div class="col-9"><label class="form-label">Logo URL</label><input id="m_image" class="form-control" value="${escapeHtml(data.image||'')}" placeholder="Logo URL"></div>
                  <div class="col-3 d-grid align-self-end"><button id="btn_upload_modal" class="btn btn-outline-secondary">Upload</button></div>
                </div>
              `;
              const modalEl = await openModal({ title: 'Edit School', body, okText: 'Save' });
              if (!modalEl) return;

              // wire upload inside modal
              const btnUpload = modalEl.querySelector('#btn_upload_modal');
              if (btnUpload) {
                btnUpload.onclick = async () => {
                  try {
                    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
                    fi.onchange = async () => {
                      if (!fi.files || !fi.files[0]) return;
                      try {
                        const url = await uploadLogoFile(fi.files[0]);
                        const imgEl = modalEl.querySelector('#m_image');
                        if (imgEl) imgEl.value = url;
                        toast('Logo uploaded', 'success');
                      } catch (err) {
                        toast(err.message || 'Upload failed', 'error');
                      }
                    };
                    fi.click();
                  } catch (e) { toast('Upload failed', 'error'); }
                };
              }

              // Read values after modal OK
              const payload = {
                school_name: modalEl.querySelector('#m_name')?.value || data.school_name,
                email: modalEl.querySelector('#m_email')?.value || data.email,
                contact_person: modalEl.querySelector('#m_contact_person')?.value || data.contact_person,
                contact_no: modalEl.querySelector('#m_contact_no')?.value || data.contact_no,
                medium_id: modalEl.querySelector('#m_medium')?.value || data.medium_id,
                state_id: modalEl.querySelector('#m_state')?.value || data.state_id,
                district_id: modalEl.querySelector('#m_district')?.value || data.district_id,
                address: modalEl.querySelector('#m_address')?.value || data.address,
                image: modalEl.querySelector('#m_image')?.value || data.image
              };

              await updateSchoolApi(id, payload);
              toast('Saved', 'success');
              await refresh();
            } catch (err) {
              if (err?.status === 401) toast('Unauthorized. Please sign in.', 'error');
              else toast(err.message || 'Failed to fetch/save', 'error');
            }
          };
        });

        qsa('.btn-logo').forEach(btn => {
          btn.onclick = async (ev) => {
            const tr = ev.currentTarget.closest('tr');
            const id = tr.dataset.id;
            const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
            fi.onchange = async () => {
              if (!fi.files || !fi.files[0]) return;
              try {
                const url = await uploadLogoFile(fi.files[0]);
                await updateSchoolApi(id, { image: url });
                toast('Logo saved', 'success');
                await refresh();
              } catch (err) {
                if (err?.status === 401) toast('Unauthorized. Please sign in.', 'error');
                else toast(err.message || 'Upload failed', 'error');
              }
            };
            fi.click();
          };
        });

        qsa('.btn-delete').forEach(btn => {
          btn.onclick = async (ev) => {
            const tr = ev.currentTarget.closest('tr');
            const id = tr.dataset.id;
            if (!confirm('Delete school?')) return;
            try {
              await deleteSchoolApi(id);
              toast('Deleted', 'success');
              // reload content (adjust page if needed)
              await refresh();
            } catch (err) {
              if (err?.status === 401) toast('Unauthorized', 'error');
              else toast(err.message || 'Delete failed', 'error');
            }
          };
        });

        // pager wiring
        const prev = qs('#prevPage');
        const next = qs('#nextPage');
        if (prev) prev.onclick = () => { if (page > 1) { page--; refresh(); } };
        if (next) next.onclick = () => { page++; refresh(); };
      } catch (err) {
        toast(err.message || 'Failed to load schools', 'error');
        qs('#content').innerHTML = `<div class="card"><div class="card-body text-danger">Failed to load schools</div></div>`;
      }
    } // refresh

    // toolbar wiring
    qs('#btnSearch').onclick = () => { page = 1; refresh(); };

    qs('#btnNew').onclick = async () => {
      try {
        const body = `
          <div class="row g-2">
            <div class="col-12"><label class="form-label">School name</label><input id="m_name" class="form-control" placeholder="Name"></div>
            <div class="col-md-6"><label class="form-label">Email</label><input id="m_email" class="form-control" placeholder="Email"></div>
            <div class="col-md-6"><label class="form-label">Contact person</label><input id="m_contact_person" class="form-control"></div>
            <div class="col-md-6"><label class="form-label">Contact no</label><input id="m_contact_no" class="form-control"></div>
            <div class="col-md-6"><label class="form-label">Medium</label>
              <select id="m_medium" class="form-select"><option value="">Medium</option>${lookups.media.map(m=>`<option value="${m.medium_id}">${escapeHtml(m.medium_name)}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label">State</label>
              <select id="m_state" class="form-select"><option value="">State</option>${lookups.states.map(s=>`<option value="${s.state_id}">${escapeHtml(s.state_name)}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label">District</label>
              <select id="m_district" class="form-select"><option value="">District</option>${lookups.districts.map(d=>`<option value="${d.district_id}">${escapeHtml(d.district_name)}</option>`).join('')}</select></div>
            <div class="col-12"><label class="form-label">Address</label><input id="m_address" class="form-control"></div>
            <div class="col-9"><label class="form-label">Logo URL</label><input id="m_image" class="form-control" placeholder="Logo URL"></div>
            <div class="col-3 d-grid align-self-end"><button id="btn_upload_modal" class="btn btn-outline-secondary">Upload</button></div>
          </div>
        `;
        const modalEl = await openModal({ title: 'New School', body, okText: 'Create' });
        if (!modalEl) return;

        const btnUpload = modalEl.querySelector('#btn_upload_modal');
        if (btnUpload) {
          btnUpload.onclick = async () => {
            const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
            fi.onchange = async () => {
              if (!fi.files || !fi.files[0]) return;
              try {
                const url = await uploadLogoFile(fi.files[0]);
                modalEl.querySelector('#m_image').value = url;
                toast('Logo uploaded', 'success');
              } catch (err) { toast(err.message || 'Upload failed', 'error'); }
            };
            fi.click();
          };
        }

        const payload = {
          school_name: modalEl.querySelector('#m_name')?.value,
          email: modalEl.querySelector('#m_email')?.value,
          contact_person: modalEl.querySelector('#m_contact_person')?.value,
          contact_no: modalEl.querySelector('#m_contact_no')?.value,
          medium_id: modalEl.querySelector('#m_medium')?.value || null,
          state_id: modalEl.querySelector('#m_state')?.value || null,
          district_id: modalEl.querySelector('#m_district')?.value || null,
          address: modalEl.querySelector('#m_address')?.value || null,
          image: modalEl.querySelector('#m_image')?.value || null
        };

        if (!payload.school_name || !payload.email) {
          toast('Name and email are required', 'error');
          return;
        }

        await createSchoolApi(payload);
        toast('Created', 'success');
        page = 1;
        await refresh();
      } catch (err) {
        if (err?.status === 401) toast('Unauthorized - please login', 'error');
        else toast(err.message || 'Create failed', 'error');
      }
    };

    qs('#btnExport').onclick = async () => {
      try {
        const filters = {};
        if (fSearch.value) filters.search = fSearch.value;
        if (fState.value) filters.state_name = fState.options[fState.selectedIndex]?.text;
        if (fDistrict.value) filters.district_name = fDistrict.options[fDistrict.selectedIndex]?.text;
        if (fMedium.value) filters.medium_name = fMedium.options[fMedium.selectedIndex]?.text;
        await exportCSV(filters);
      } catch (err) {
        if (err?.status === 401) toast('Unauthorized - please login', 'error');
        else toast(err.message || 'Export failed', 'error');
      }
    };

    qs('#btnImport').onclick = () => { importFile.click(); };

    importFile.onchange = async () => {
      const f = importFile.files[0];
      importFile.value = '';
      if (!f) return;
      try {
        await importCSV(f);
        toast('Import successful', 'success');
        // refresh list after import
        page = 1;
        await refresh();
      } catch (err) {
        if (err?.status === 401) toast('Unauthorized - please login', 'error');
        else toast(err.message || 'Import failed', 'error');
      }
    };

    // initial load
    await refresh();
  }

  /* expose page */
  window.pageSchools = {
    render() { return `<div id="schoolsPage" class="p-2">${(window.ui && window.ui.spinner) ? window.ui.spinner() : 'Loading...'}</div>`; },
    async mount() {
      const el = document.getElementById('schoolsPage');
      if (!el) return;
      await mount(el);
    }
  };
})();
