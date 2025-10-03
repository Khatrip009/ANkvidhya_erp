// public/js/pages/emp-video-progress.js
(() => {
  function row(r) {
    const likedBadge = r.liked ? `<span class="badge text-bg-warning"><i class="bi bi-hand-thumbs-up-fill me-1"></i>Liked</span>` : '';
    return `
      <tr>
        <td>${r.video_title || '-'}</td>
        <td>${r.employee_name || '-'}</td>
        <td class="text-end">${r.watched_seconds ?? 0}</td>
        <td class="text-end">${(r.watch_percentage ?? 0).toFixed ? (r.watch_percentage.toFixed(1)) : r.watch_percentage}%</td>
        <td class="text-nowrap">${likedBadge}</td>
        <td class="text-muted small">${r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
      </tr>
    `;
  }

  window.pageEmpVideoProgress = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Video Progress</h2>
          <div>
            <a class="btn btn-sm btn-outline-secondary" target="_blank" href="/api/emp-video-progress/export/csv"><i class="bi bi-filetype-csv"></i> CSV</a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="vpSearch" class="form-control form-control-sm" placeholder="Search video title / employee">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">From</label>
                <input id="vpFrom" type="date" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">To</label>
                <input id="vpTo" type="date" class="form-control form-control-sm">
              </div>
              <div class="col-6 col-md-2 form-check d-flex align-items-center ms-2">
                <input id="vpLikedOnly" type="checkbox" class="form-check-input me-2">
                <label class="form-check-label">Liked only</label>
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="vpSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="vpReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Video</th>
                    <th>Employee</th>
                    <th class="text-end">Watched (s)</th>
                    <th class="text-end">Progress</th>
                    <th>Flag</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody id="vpBody"><tr><td colspan="6" class="p-3">${ui.spinner()}</td></tr></tbody>
              </table>
            </div>
          </div>
          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="vpStats"></div>
            <div id="vpPager"></div>
          </div>
        </div>
      `;
    },

    async mount() {
      const body  = document.getElementById('vpBody');
      const pager = document.getElementById('vpPager');
      const stats = document.getElementById('vpStats');

      const qSearch = document.getElementById('vpSearch');
      const qFrom   = document.getElementById('vpFrom');
      const qTo     = document.getElementById('vpTo');
      const likedOnly = document.getElementById('vpLikedOnly');
      const sizeSel = document.getElementById('vpSize');
      const btnReload = document.getElementById('vpReload');

      let page=1, pageSize=parseInt(sizeSel.value,10)||20, search='', date_from='', date_to='', liked = false;

      function setStats(pg) {
        if (!pg?.total) { stats.textContent = ''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        stats.textContent = `${start}–${end} of ${pg.total}`;
      }

      async function reload() {
        body.innerHTML = `<tr><td colspan="6" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search, date_from, date_to };
          if (liked) query.liked = true; // controller may ignore if not supported
          const res = await api.get('/api/emp-video-progress', { query });
          const rows = (res?.data || []).map(r => ({
            ...r,
            // in case backend adds liked later; default false
            liked: !!r.liked
          }));
          const pg = res?.pagination || { page, pageSize, total: rows.length };

          if (!rows.length) {
            body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-muted">No data</td></tr>`;
            pager.innerHTML=''; setStats({ total:0 }); return;
          }

          body.innerHTML = rows.map(row).join('');
          pager.innerHTML = '';
          pager.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page = p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          pager.innerHTML=''; setStats({ total:0 });
        }
      }

      qSearch.addEventListener('input', ui.debounce(() => { search = qSearch.value.trim(); page=1; reload(); }, 350));
      qFrom.addEventListener('change', () => { date_from = qFrom.value; page=1; reload(); });
      qTo.addEventListener('change',   () => { date_to   = qTo.value;   page=1; reload(); });
      likedOnly.addEventListener('change', () => { liked = likedOnly.checked; page=1; reload(); });
      sizeSel.addEventListener('change', () => { pageSize = parseInt(sizeSel.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      reload();
    }
  };
})();
