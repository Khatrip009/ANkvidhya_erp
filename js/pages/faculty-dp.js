// public/js/pages/faculty-dp.js
(() => {
  const STATE = {
    me: null,
    schools: [],
    standards: [],
    divisions: [],
    // table state
    page: 1,
    pageSize: 10,
    search: '',
    // form state
    editingId: null,
  };

  // ------- helpers -------
  const fmtDate = (d) => (d ? String(d).slice(0, 10) : '');
  const safe = (v) => (v ?? '');

  function card(title, bodyHtml, rightHtml = '') {
    return `
      <div class="card shadow-sm position-relative">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="fw-semibold">${title}</span>
          <div class="d-flex align-items-center gap-2">${rightHtml}</div>
        </div>
        <div class="card-body">${bodyHtml}</div>
      </div>`;
  }

  function headerBlock() {
    const empName = STATE.me?.employee_name || STATE.me?.full_name || STATE.me?.username || '—';
    const schoolSel = `
      <select id="hdrSchool" class="form-select form-select-sm" style="min-width:220px">
        <option value="">Select school</option>
        ${STATE.schools.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join('')}
      </select>`;
    const stdSel = `
      <select id="hdrStd" class="form-select form-select-sm" style="min-width:140px">
        <option value="">Std</option>
        ${STATE.standards.map(s => `<option value="${s.std_id}">${s.std_name}</option>`).join('')}
      </select>`;
    const divSel = `
      <select id="hdrDiv" class="form-select form-select-sm" style="min-width:140px">
        <option value="">Div</option>
        ${STATE.divisions.map(d => `<option value="${d.div_id}">${d.division_name}</option>`).join('')}
      </select>`;

    const body = `
      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label mb-1">Faculty</label>
          <div class="form-control-plaintext fw-semibold">${empName}</div>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <label class="form-label mb-1">School</label>
          ${schoolSel}
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label mb-1">Standard</label>
          ${stdSel}
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label mb-1">Division</label>
          ${divSel}
        </div>
      </div>`;
    const right = `<img src="/images/Ank_Logo.png" alt="Ank Logo" style="height:34px">`;
    return card('Faculty Daily Progress', body, right);
  }

  function formBlock() {
    return card('Add / Edit Entry', `
      <form id="fdpForm" class="row g-3">
        <div class="col-6 col-md-3">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="fDate" required>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Status</label>
          <select class="form-select" id="fStatus">
            <option value="completed">completed</option>
            <option value="planned">planned</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Lectures</label>
          <input type="number" min="0" step="1" class="form-control" id="fLectures" value="1">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Notebooks Checked</label>
          <input type="number" min="0" step="1" class="form-control" id="fNotebooks" value="0">
        </div>

        <div class="col-12">
          <label class="form-label">Remarks</label>
          <input type="text" class="form-control" id="fRemarks" placeholder="Any notes...">
        </div>

        <div class="col-12 d-flex gap-2">
          <button class="btn btn-primary" type="submit"><i class="bi bi-save me-1"></i><span id="btnSaveLbl">Save</span></button>
          <button class="btn btn-outline-secondary d-none" type="button" id="btnCancelEdit"><i class="bi bi-x-circle me-1"></i>Cancel</button>
        </div>
      </form>
    `);
  }

  function tableBlock() {
    return card('My Daily Progress', `
      <div class="d-flex align-items-center gap-2 mb-2">
        <input id="tblSearch" class="form-control form-control-sm" placeholder="Search remarks or employee name">
        <select id="tblPageSize" class="form-select form-select-sm" style="width:auto">
          <option>10</option><option selected>20</option><option>50</option>
        </select>
        <div class="ms-auto">
          <button id="btnExportCsv" class="btn btn-outline-secondary btn-sm"><i class="bi bi-filetype-csv me-1"></i>Export CSV</button>
        </div>
      </div>
      <div id="tblWrap">${ui.spinner('sm')}</div>
      <div id="tblPager" class="mt-2"></div>
    `);
  }

  function renderRow(r) {
    return `<tr data-id="${r.fpd_id}">
      <td>${fmtDate(r.date)}</td>
      <td>${safe(r.school_name)}</td>
      <td>${safe(r.std_name)} ${r.division_name ? ' - ' + r.division_name : ''}</td>
      <td>${safe(r.status)}</td>
      <td>${r.lecture_count ?? 0}</td>
      <td>${r.notebooks_checked ?? 0}</td>
      <td>${safe(r.remarks)}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary" data-act="edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger ms-1" data-act="del"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  }

  async function loadMaster() {
    // RLS will scope these: schools visible to this user; standards/divisions are global refs
    const [sch, std, div] = await Promise.allSettled([
      api.get('/api/schools', { query: { pageSize: 1000 } }),
      api.get('/api/master', { query: { table: 'standards', pageSize: 1000 } }),
      api.get('/api/master', { query: { table: 'divisions', pageSize: 1000 } }),
    ]);
    STATE.schools   = sch.value?.data || [];
    STATE.standards = std.value?.data || [];
    STATE.divisions = div.value?.data || [];
  }

  async function loadMe() {
    const { data } = await api.get('/api/auth/me');
    STATE.me = data || {};
  }

  async function loadTable() {
    const wrap = document.getElementById('tblWrap');
    const pager = document.getElementById('tblPager');
    wrap.innerHTML = ui.spinner('sm');

    const query = {
      page: STATE.page,
      pageSize: STATE.pageSize,
      search: STATE.search || undefined,
      // header context
      school_name: selectedText('hdrSchool') || undefined,
      std_name: selectedText('hdrStd') || undefined,
      division_name: selectedText('hdrDiv') || undefined,
    };

    try {
      const res = await api.get('/api/faculty-daily-progress', { query });
      const rows = res?.data || [];
      const pg = res?.pagination || { page: 1, pageSize: rows.length, total: rows.length };

      if (!rows.length) {
        wrap.innerHTML = ui.emptyState('No daily progress found.');
        pager.innerHTML = '';
        return;
      }

      const head = `<thead><tr>
        <th>Date</th><th>School</th><th>Std/Div</th>
        <th>Status</th><th>Lectures</th><th>Notebooks</th><th>Remarks</th><th></th>
      </tr></thead>`;
      const body = `<tbody>${rows.map(renderRow).join('')}</tbody>`;
      wrap.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover align-middle">${head}${body}</table></div>`;

      // pager
      pager.innerHTML = '';
      pager.appendChild(ui.pager({
        page: pg.page, pageSize: pg.pageSize, total: pg.total,
        onPage: (p) => { STATE.page = p; loadTable(); }
      }));

      // wire row actions
      wrap.querySelectorAll('button[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => onRowAction(e, btn.closest('tr')?.dataset.id, btn.dataset.act));
      });
    } catch (e) {
      wrap.innerHTML = ui.emptyState(e.message || 'Failed to load.');
      pager.innerHTML = '';
    }
  }

  function selectedText(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    const opt = el.options?.[el.selectedIndex];
    return opt?.text?.trim() || '';
  }

  function selectedValue(id) {
    return document.getElementById(id)?.value || '';
  }

  function resetForm() {
    STATE.editingId = null;
    document.getElementById('fDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('fStatus').value = 'completed';
    document.getElementById('fLectures').value = 1;
    document.getElementById('fNotebooks').value = 0;
    document.getElementById('fRemarks').value = '';
    document.getElementById('btnCancelEdit').classList.add('d-none');
    document.getElementById('btnSaveLbl').textContent = 'Save';
  }

  async function onRowAction(e, id, act) {
    e.preventDefault();
    if (!id) return;
    if (act === 'edit') {
      try {
        const { data } = await api.get(`/api/faculty-daily-progress/${id}`);
        STATE.editingId = data.fpd_id;
        // set header selects to row context (if present in options)
        setSelectByText('hdrSchool', data.school_name);
        setSelectByText('hdrStd', data.std_name);
        setSelectByText('hdrDiv', data.division_name);
        // load form
        document.getElementById('fDate').value = fmtDate(data.date) || new Date().toISOString().slice(0,10);
        document.getElementById('fStatus').value = data.status || 'completed';
        document.getElementById('fLectures').value = data.lecture_count ?? 1;
        document.getElementById('fNotebooks').value = data.notebooks_checked ?? 0;
        document.getElementById('fRemarks').value = data.remarks || '';
        document.getElementById('btnCancelEdit').classList.remove('d-none');
        document.getElementById('btnSaveLbl').textContent = 'Update';
        ui.toast('Loaded entry for editing', 'info');
      } catch (err) {
        ui.toast(err.message || 'Failed to load entry', 'danger');
      }
    } else if (act === 'del') {
      if (!confirm('Delete this entry?')) return;
      try {
        await api.del(`/api/faculty-daily-progress/${id}`);
        ui.toast('Deleted', 'success');
        loadTable();
      } catch (err) {
        ui.toast(err?.data?.message || err.message || 'Delete failed', 'danger');
      }
    }
  }

  function setSelectByText(id, text) {
    if (!text) return;
    const el = document.getElementById(id);
    if (!el) return;
    const t = (text || '').toLowerCase();
    for (let i=0;i<el.options.length;i++){
      if ((el.options[i].text || '').toLowerCase() === t) {
        el.selectedIndex = i; break;
      }
    }
  }

  async function onSave(e) {
    e.preventDefault();

    const payload = {
      // header context
      school_name: selectedText('hdrSchool') || undefined,
      std_name: selectedText('hdrStd') || undefined,
      division_name: selectedText('hdrDiv') || undefined,
      // form fields
      date: document.getElementById('fDate').value || null,
      status: document.getElementById('fStatus').value || null,
      lecture_count: parseInt(document.getElementById('fLectures').value || '0', 10),
      notebooks_checked: parseInt(document.getElementById('fNotebooks').value || '0', 10),
      remarks: document.getElementById('fRemarks').value || null,
      // employee context (optional convenience; RLS also ensures self)
      employee_id: STATE.me?.employee_id || null,
      employee_name: STATE.me?.employee_name || STATE.me?.full_name || STATE.me?.username || null,
    };

    try {
      if (STATE.editingId) {
        await api.put(`/api/faculty-daily-progress/${STATE.editingId}`, payload);
        ui.toast('Updated', 'success');
      } else {
        await api.post('/api/faculty-daily-progress', payload);
        ui.toast('Saved', 'success');
      }
      resetForm();
      // refresh list
      STATE.page = 1;
      await loadTable();
    } catch (err) {
      ui.toast(err?.data?.message || err.message || 'Save failed', 'danger');
    }
  }

  function wireEvents() {
    // header selects reload list
    ['hdrSchool','hdrStd','hdrDiv'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => { STATE.page = 1; loadTable(); });
    });

    // form save / cancel
    document.getElementById('fdpForm')?.addEventListener('submit', onSave);
    document.getElementById('btnCancelEdit')?.addEventListener('click', () => resetForm());

    // table filters
    document.getElementById('tblSearch')?.addEventListener('input', ui.debounce(() => {
      STATE.search = document.getElementById('tblSearch').value.trim();
      STATE.page = 1; loadTable();
    }, 350));
    document.getElementById('tblPageSize')?.addEventListener('change', () => {
      STATE.pageSize = parseInt(document.getElementById('tblPageSize').value, 10) || 20;
      STATE.page = 1; loadTable();
    });

    // export
    document.getElementById('btnExportCsv')?.addEventListener('click', () => {
      const q = new URLSearchParams({
        search: STATE.search || '',
        school_name: selectedText('hdrSchool') || '',
        std_name: selectedText('hdrStd') || '',
        division_name: selectedText('hdrDiv') || '',
      }).toString();
      const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
      window.open(`${base}/api/faculty-daily-progress/export.csv?${q}`, '_blank');
    });
  }

  window.pageFacultyDp = {
    render() {
      return `
        <div class="row g-3">
          <div class="col-12">
            ${headerBlock()}
          </div>
          <div class="col-12">
            ${formBlock()}
          </div>
          <div class="col-12">
            ${tableBlock()}
          </div>
        </div>`;
    },

    async mount() {
      // load profile (sets employee_id for convenience)
      await loadMe();
      // load reference data (RLS will scope schools)
      await loadMaster();

      // paint header again (now we have masters)
      const container = document.getElementById('app');
      const nodes = container.querySelectorAll('.card');
      // re-render header block
      nodes[0].outerHTML = headerBlock();

      // defaults
      resetForm();

      // wire listeners
      wireEvents();

      // initial table
      await loadTable();
    }
  };
})();
