// public/js/pages/lessonplans.js
(() => {
  // ---------- Masters ----------
  async function fetchAll(table) {
    const res = await api.get(`/api/master/${table}`, { query: { pageSize: 1000 } });
    return res?.data || [];
  }
  const fetchMedium     = () => fetchAll('medium');
  const fetchStandards  = () => fetchAll('standards');
  const fetchBooks      = () => api.get('/api/books',    { query: { pageSize: 1000 } }).then(r => r?.data || []);
  const fetchChapters   = () => api.get('/api/chapters', { query: { pageSize: 1000 } }).then(r => r?.data || []);
  const fetchTopics     = () => fetchAll('topics');
  const fetchActivities = () => fetchAll('activities');
  const fetchVideosList = async (query={}) => {
    const res = await api.get('/api/videos', { query: { pageSize: 1000, ...query } });
    return res?.data || [];
  };

  // ---------- Helpers ----------
  const avatarSrc = (url) => (url && url.trim()) ? url : 'images/ANK.png';
  const opt = (v, t, sel='') => `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const buildOptions = (list, idKey, nameKey, sel='') =>
    `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');

  const byId = (list, idKey, id) => list.find(x => String(x[idKey])===String(id));
  const idByName = (list, nameKey, name, idKey) =>
    list.find(x => String(x[nameKey]||'').toLowerCase()===String(name||'').toLowerCase())?.[idKey];

  if (!ui.truncate) ui.truncate = (s, n=60) => (String(s||'').length>n ? (String(s).slice(0,n-1)+'…') : String(s||''));
  if (!ui.formatSeconds) ui.formatSeconds = (sec=0) => { sec = Math.max(0, parseInt(sec,10)||0); const m = Math.floor(sec/60), s = sec%60; return `${m}:${String(s).padStart(2,'0')}`; };

  // Player helpers
  function isDirectVideo(url='') { return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || ''); }
  function isYouTube(url='')     { return /youtu\.be\/|youtube\.com\/(watch|embed)/i.test(url || ''); }
  function isVimeo(url='')       { return /vimeo\.com\/(video\/)?\d+/i.test(url || ''); }
  function isGoogleDrive(url=''){ return /drive\.google\.com/i.test(url || ''); }

  function youTubeEmbedId(url='') {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = url.match(/\/embed\/([^?]+)/i);
      return m ? m[1] : null;
    } catch { return null; }
  }

  function vimeoEmbed(url='') {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  }
  function driveEmbed(url='') {
    const m = url.match(/\/file\/d\/([^/]+)\//);
    return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
  }
  function makeIframe(src, title='Video') {
    const titleAttr = title ? `title="${String(title).replace(/"/g,'&quot;')}"` : '';
    return `
      <div class="ratio ratio-16x9">
        <iframe ${titleAttr} src="${src}" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen
                class="rounded border" id="lpIframe"></iframe>
      </div>`;
  }
  function makePlayerHtml(link, titleText='') {
    if (!link) return `<div class="text-center text-muted p-4">No video link</div>`;
    if (isDirectVideo(link)) {
      return `
        <div class="ratio ratio-16x9">
          <video id="lpHtml5" class="w-100 rounded border" controls playsinline preload="metadata">
            <source src="${link}">
            Your browser does not support the video tag.
          </video>
        </div>`;
    }
    if (isYouTube(link)) {
      const id = youTubeEmbedId(link);
      return makeIframe(`https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0`, titleText);
    }
    if (isVimeo(link)) return makeIframe(vimeoEmbed(link), titleText);
    if (isGoogleDrive(link)) return makeIframe(driveEmbed(link), titleText);
    return makeIframe(link, titleText);
  }

  // ---------- Row ----------
  function rowHtml(r) {
    const chain = [r.medium_name, r.std_name, r.book_name, r.chapter_name].filter(Boolean).join(' • ');
    const videoBadge = r.video_link ? `<span class="badge text-bg-success">Video</span>` : `<span class="badge text-bg-secondary">No Video</span>`;
    return `
      <tr data-id="${r.lp_id}" data-video-id="${r.video_id || ''}" data-video-link="${(r.video_link||'').replace(/"/g,'&quot;')}">
        <td style="min-width:260px">
          <div class="d-flex align-items-start gap-2">
            <img src="${avatarSrc('')}" class="rounded" style="width:36px;height:36px;object-fit:cover;border:1px solid var(--bs-border-color)">
            <div>
              <div class="fw-semibold">${r.title || '-'}</div>
              <div class="small text-muted">${chain || ''}</div>
            </div>
          </div>
        </td>
        <td>${r.description ? ui.truncate(r.description, 60) : '-'}</td>
        <td>${r.explanation ? ui.truncate(r.explanation, 60) : '-'}</td>
        <td class="text-nowrap">${videoBadge}</td>
        <td class="text-end text-nowrap">
          ${r.video_link ? `<button class="btn btn-sm btn-outline-success me-1" data-act="play"><i class="bi bi-play-circle"></i></button>` : ''}
          <button class="btn btn-sm btn-outline-primary me-1" data-act="view"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }

  // ---------- Page ----------
  window.pageLessonPlans = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Lesson Plans</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus-lg"></i> New Lesson Plan</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/lesson-plans/export/csv" target="_blank"><i class="bi bi-filetype-csv"></i> CSV</a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="lpSearch" class="form-control form-control-sm" placeholder="Search title / description / explanation">
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Medium</label>
                <select id="fMedium" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Standard</label>
                <select id="fStd" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Book</label>
                <select id="fBook" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label mb-1">Chapter</label>
                <select id="fChapter" class="form-select form-select-sm"><option value="">All</option></select>
              </div>

              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="lpPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="lpReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Lesson</th>
                    <th>Description</th>
                    <th>Explanation</th>
                    <th>Video</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="lpTbody">
                  <tr><td colspan="5" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="lpStats"></div>
            <div id="lpPager"></div>
          </div>
        </div>

        <!-- Modal: Lesson Plan Form -->
        <div class="modal fade" id="lpModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header border-0 pb-0">
                <div class="flex-grow-1"></div>
                <img src="images/Ank_Logo.png" alt="Logo" style="height:40px;width:auto">
              </div>

              <form id="lpForm">
                <div class="modal-body pt-0">
                  <input type="hidden" name="lp_id">

                  <div class="mb-3">
                    <label class="form-label">Title <span class="text-danger">*</span></label>
                    <input name="title" class="form-control" placeholder="e.g. Fractions – Introduction" required>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Description</label>
                      <textarea name="description" class="form-control" rows="2"></textarea>
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="form-label">Explanation</label>
                      <textarea name="explanation" class="form-control" rows="2"></textarea>
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-6 col-md-3">
                      <label class="form-label">Medium</label>
                      <select name="medium_id" class="form-select"></select>
                    </div>
                    <div class="col-6 col-md-3">
                      <label class="form-label">Standard</label>
                      <select name="std_id" class="form-select"></select>
                    </div>
                    <div class="col-6 col-md-3">
                      <label class="form-label">Book</label>
                      <select name="book_id" class="form-select"></select>
                    </div>
                    <div class="col-6 col-md-3">
                      <label class="form-label">Chapter</label>
                      <select name="chapter_id" class="form-select"></select>
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-12 col-md-8">
                      <label class="form-label">Video (pick from list)</label>
                      <select name="video_id" class="form-select"></select>
                    </div>
                    <div class="col-12 col-md-4 d-flex align-items-end">
                      <button type="button" class="btn btn-outline-secondary w-100" id="btnRefreshVideos"><i class="bi bi-arrow-repeat"></i> Refresh Videos</button>
                    </div>
                    <div class="small text-muted mt-1">
                      Videos come from the <em>Videos</em> master. Add/update them there (course/book/chapter + video_link), then click Refresh.
                    </div>
                  </div>

                  <hr>

                  <!-- Topics -->
                  <div class="mb-2 d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Topics</h6>
                    <button type="button" class="btn btn-sm btn-outline-primary" id="btnAddTopic"><i class="bi bi-plus-lg"></i> Add Topic</button>
                  </div>
                  <div id="lpTopics" class="vstack gap-2"></div>

                  <hr>

                  <!-- Activities -->
                  <div class="mb-2 d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Activities</h6>
                    <button type="button" class="btn btn-sm btn-outline-primary" id="btnAddActivity"><i class="bi bi-plus-lg"></i> Add Activity</button>
                  </div>
                  <div id="lpActivities" class="vstack gap-2"></div>

                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                  <button type="submit" class="btn btn-primary"><i class="bi bi-check2"></i> Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal: Video Player (embedded + like/progress) -->
        <div class="modal fade" id="lpVideoModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title d-flex align-items-center gap-2">
                  <img src="images/Ank_Logo.png" alt="Logo" style="height:28px;width:auto" class="me-1">
                  <i class="bi bi-play-circle me-2"></i><span id="lpVideoTitle">Video</span>
                </h5>
                <div class="d-flex align-items-center gap-2 me-2">
                  <button id="lpLikeBtn" class="btn btn-outline-warning btn-sm" title="Like this video">
                    <i class="bi bi-hand-thumbs-up"></i> <span class="d-none d-sm-inline">Like</span>
                  </button>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div id="lpPlayerHolder" class="w-100"></div>
              </div>
              <div class="modal-footer justify-content-between">
                <div class="small text-muted" id="lpVideoStats">0:00 / 0:00</div>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    async mount() {
      // Elements
      const tbody    = document.getElementById('lpTbody');
      const pagerEl  = document.getElementById('lpPager');
      const statsEl  = document.getElementById('lpStats');

      const inpSearch= document.getElementById('lpSearch');
      const selMed   = document.getElementById('fMedium');
      const selStd   = document.getElementById('fStd');
      const selBook  = document.getElementById('fBook');
      const selChap  = document.getElementById('fChapter');
      const selSize  = document.getElementById('lpPageSize');
      const btnReload= document.getElementById('lpReload');

      const btnNew   = document.getElementById('btnNew');
      const modalEl  = document.getElementById('lpModal');
      const modal    = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form     = document.getElementById('lpForm');

      const topicsWrap = document.getElementById('lpTopics');
      const actsWrap   = document.getElementById('lpActivities');
      const btnAddTopic= document.getElementById('btnAddTopic');
      const btnAddAct  = document.getElementById('btnAddActivity');
      const btnRefreshVideos = document.getElementById('btnRefreshVideos');

      // Player (embedded)
      const vModalEl = document.getElementById('lpVideoModal');
      const vModal   = bootstrap.Modal.getOrCreateInstance(vModalEl);
      const vTitle   = document.getElementById('lpVideoTitle');
      const vStats   = document.getElementById('lpVideoStats');
      const playerHolder = document.getElementById('lpPlayerHolder');
      const likeBtn  = document.getElementById('lpLikeBtn');

      // Masters
      let [medium, standards, books, chapters, topics, activities] =
        await Promise.all([fetchMedium(), fetchStandards(), fetchBooks(), fetchChapters(), fetchTopics(), fetchActivities()]);
      let videosMaster = await fetchVideosList();

      // Filters
      selMed.innerHTML  = `<option value="">All</option>` + medium.map(x => `<option value="${x.medium_id}">${x.medium_name}</option>`).join('');
      selStd.innerHTML  = `<option value="">All</option>` + standards.map(x => `<option value="${x.std_id}">${x.std_name}</option>`).join('');
      selBook.innerHTML = `<option value="">All</option>` + books.map(x => `<option value="${x.book_id}">${x.book_name}</option>`).join('');
      selChap.innerHTML = `<option value="">All</option>` + chapters.map(x => `<option value="${x.chapter_id}">${x.chapter_name}</option>`).join('');

      // Form selects
      const selFormMed  = form.querySelector('select[name="medium_id"]');
      const selFormStd  = form.querySelector('select[name="std_id"]');
      const selFormBook = form.querySelector('select[name="book_id"]');
      const selFormChap = form.querySelector('select[name="chapter_id"]');
      const selFormVid  = form.querySelector('select[name="video_id"]');

      const buildOptions = (list, idKey, nameKey, sel='') =>
        `<option value="">Select</option>` + list.map(x => `<option value="${x[idKey]}" ${String(x[idKey])===String(sel)?'selected':''}>${x[nameKey]}</option>`).join('');

      selFormMed.innerHTML  = buildOptions(medium,   'medium_id','medium_name');
      selFormStd.innerHTML  = buildOptions(standards,'std_id','std_name');
      selFormBook.innerHTML = buildOptions(books,    'book_id','book_name');
      selFormChap.innerHTML = buildOptions(chapters, 'chapter_id','chapter_name');
      function refreshVideoSelect(selected='') {
        selFormVid.innerHTML = `<option value="">Select</option>` +
          videosMaster.map(v => `<option value="${v.video_id}" ${String(v.video_id)===String(selected)?'selected':''}>
            ${(v.tittle || v.title || 'Untitled')} — ${(v.book_name||'')} ${(v.chapter_name||'')}
          </option>`).join('');
      }
      refreshVideoSelect();

      btnRefreshVideos.addEventListener('click', async () => {
        try {
          const query = {};
          const bid = selFormBook.value; const cid = selFormChap.value;
          if (bid) query.book_name = byId(books,'book_id', bid)?.book_name || '';
          if (cid) query.chapter_name = byId(chapters,'chapter_id',cid)?.chapter_name || '';
          videosMaster = await fetchVideosList(query);
          refreshVideoSelect(selFormVid.value);
          ui.toast('Videos refreshed','success');
        } catch (e) { ui.toast(e.message || 'Failed to refresh', 'danger'); }
      });

      // Local state
      let page=1, pageSize=parseInt(selSize.value,10)||20, q='';
      let f_medium_id='', f_std_id='', f_book_id='', f_chapter_id='';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      function namesForFilters() {
        return {
          medium_name:  f_medium_id  ? (byId(medium,'medium_id',f_medium_id)?.medium_name || '') : '',
          std_name:     f_std_id     ? (byId(standards,'std_id',f_std_id)?.std_name || '') : '',
          book_name:    f_book_id    ? (byId(books,'book_id',f_book_id)?.book_name || '') : '',
          chapter_name: f_chapter_id ? (byId(chapters,'chapter_id',f_chapter_id)?.chapter_name || '') : '',
        };
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search:q, ...namesForFilters() };
          const res   = await api.get('/api/lesson-plans', { query });
          const rows  = res?.data || [];
          const pg    = res?.pagination || { page, pageSize, total: rows.length };
          lastRows = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-muted">No lesson plans found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total:0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');
          tbody.querySelectorAll('[data-act="play"]').forEach(btn => btn.addEventListener('click', () => openPlayer(btn)));
          tbody.querySelectorAll('[data-act="view"]').forEach(btn => btn.addEventListener('click', () => openForm('view', btn)));
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
            const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this lesson plan?')) return;
            try { await api.del(`/api/lesson-plans/${id}`); ui.toast('Lesson plan deleted','success'); reload(); }
            catch(e){ ui.toast(e.message || 'Delete failed','danger'); }
          }));

          pagerEl.innerHTML='';
          pagerEl.appendChild(ui.pager({
            page: pg.page, pageSize: pg.pageSize, total: pg.total,
            onPage: p => { page=p; reload(); }
          }));
          setStats(pg);
        } catch (e) {
          tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-danger">${e.message || 'Failed to load'}</td></tr>`;
          pagerEl.innerHTML=''; setStats({ total:0 });
        }
      }

      // ---- Topics & Activities row builders ----
      function topicRow(selId='', seq='') {
        return `
          <div class="row g-2 align-items-center border rounded p-2">
            <div class="col-8">
              <select class="form-select form-select-sm" name="topic_id">${buildOptions(topics,'topic_id','topic_name', selId)}</select>
            </div>
            <div class="col-3">
              <input class="form-control form-control-sm" name="sequence_no" type="number" min="1" placeholder="Seq" value="${seq||''}">
            </div>
            <div class="col-1 text-end">
              <button type="button" class="btn btn-sm btn-outline-danger" data-act="remove-row"><i class="bi bi-x"></i></button>
            </div>
          </div>`;
      }
      function activityRow(selId='', seq='') {
        return `
          <div class="row g-2 align-items-center border rounded p-2">
            <div class="col-8">
              <select class="form-select form-select-sm" name="activity_id">${buildOptions(activities,'activity_id','activity_name', selId)}</select>
            </div>
            <div class="col-3">
              <input class="form-control form-control-sm" name="sequence_no" type="number" min="1" placeholder="Seq" value="${seq||''}">
            </div>
            <div class="col-1 text-end">
              <button type="button" class="btn btn-sm btn-outline-danger" data-act="remove-row"><i class="bi bi-x"></i></button>
            </div>
          </div>`;
      }
      function wireRemovers(container) {
        container.querySelectorAll('[data-act="remove-row"]').forEach(b => b.addEventListener('click', () => {
          const row = b.closest('.row'); row?.remove();
        }));
      }
      btnAddTopic.addEventListener('click', () => { topicsWrap.insertAdjacentHTML('beforeend', topicRow()); wireRemovers(topicsWrap); });
      btnAddAct.addEventListener('click',   () => { actsWrap.insertAdjacentHTML('beforeend',   activityRow()); wireRemovers(actsWrap); });

      function fillForm(row) {
        form.reset();
        topicsWrap.innerHTML = '';
        actsWrap.innerHTML   = '';

        form.querySelector('[name="lp_id"]').value    = row?.lp_id || '';
        form.querySelector('[name="title"]').value    = row?.title || '';
        form.querySelector('[name="description"]').value = row?.description || '';
        form.querySelector('[name="explanation"]').value = row?.explanation || '';

        const mid = row?.medium_name  ? idByName(medium,'medium_name',row.medium_name,'medium_id') : '';
        const sid = row?.std_name     ? idByName(standards,'std_name',row.std_name,'std_id') : '';
        const bid = row?.book_name    ? idByName(books,'book_name',row.book_name,'book_id') : '';
        const cid = row?.chapter_name ? idByName(chapters,'chapter_name',row.chapter_name,'chapter_id') : '';

        selFormMed.value  = mid || '';
        selFormStd.value  = sid || '';
        selFormBook.value = bid || '';
        selFormChap.value = cid || '';
        selFormVid.value  = row?.video_id || '';

        (row?.topics || []).sort((a,b)=> (a.sequence_no||0)-(b.sequence_no||0))
          .forEach(t => topicsWrap.insertAdjacentHTML('beforeend', topicRow(t.topic_id||'', t.sequence_no||'')));
        (row?.activities || []).sort((a,b)=> (a.sequence_no||0)-(b.sequence_no||0))
          .forEach(a => actsWrap.insertAdjacentHTML('beforeend',   activityRow(a.activity_id||'', a.sequence_no||'')));

        wireRemovers(topicsWrap);
        wireRemovers(actsWrap);
      }

      function openForm(_mode, btnOrNull) {
        let row = null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.lp_id)===String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      // ---- PROGRESS + LIKE tracking ----
      let html5El = null;
      let ytPlayer = null;
      let progressMaxSeen = 0;
      let currentVideoId = null;
      let likeState = false;
      let intervalId = null;

      const throttle = (fn, wait) => {
        let last = 0, timer = null, lastArgs = null;
        return function(...args){
          const now = Date.now(); lastArgs = args;
          const later = () => { last = Date.now(); timer=null; fn.apply(this,lastArgs); };
          if (!last || (now - last) >= wait) return later();
          if (!timer) timer = setTimeout(later, wait - (now - last));
        };
      };

      const sendProgress = throttle(async (watched, duration) => {
        try {
          if (!currentVideoId) return;
          const payload = {
            video_id: Number(currentVideoId),
            watched_seconds: Math.max(0, Math.floor(watched||0)),
            duration_seconds: Math.max(0, Math.floor(duration||0)),
            liked: !!likeState
          };
          await api.post('/api/emp-video-progress/track', payload);
          vStats.textContent = `${ui.formatSeconds(payload.watched_seconds)} / ${ui.formatSeconds(payload.duration_seconds)}`;
        } catch (_) {}
      }, 4000);

      function detachAll() {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        if (html5El?._cleanupFns) {
          for (const [ev, fn] of html5El._cleanupFns) html5El.removeEventListener(ev, fn);
          html5El._cleanupFns = null;
        }
        html5El = null;

        // YouTube cleanup
        if (ytPlayer && ytPlayer.destroy) try { ytPlayer.destroy(); } catch {}
        ytPlayer = null;

        playerHolder.innerHTML = '';
        vStats.textContent = `0:00 / 0:00`;
        progressMaxSeen = 0;
        currentVideoId = null;
        likeState = false;
        likeBtn.classList.remove('btn-warning');
        likeBtn.classList.add('btn-outline-warning');
        likeBtn.innerHTML = `<i class="bi bi-hand-thumbs-up"></i> <span class="d-none d-sm-inline">Like</span>`;
      }

      function setLikedUI(on) {
        likeState = !!on;
        if (likeState) {
          likeBtn.classList.remove('btn-outline-warning');
          likeBtn.classList.add('btn-warning');
          likeBtn.innerHTML = `<i class="bi bi-hand-thumbs-up-fill"></i> <span class="d-none d-sm-inline">Liked</span>`;
        } else {
          likeBtn.classList.add('btn-outline-warning');
          likeBtn.classList.remove('btn-warning');
          likeBtn.innerHTML = `<i class="bi bi-hand-thumbs-up"></i> <span class="d-none d-sm-inline">Like</span>`;
        }
      }

      likeBtn.addEventListener('click', async () => {
        setLikedUI(!likeState);
        // send a “like” ping immediately
        try {
          await api.post('/api/emp-video-progress/track', {
            video_id: Number(currentVideoId),
            watched_seconds: progressMaxSeen,
            duration_seconds: html5El?.duration || ytPlayer?.getDuration?.() || 0,
            liked: likeState
          });
        } catch(_) {}
      });

      // HTML5 tracking
      function attachHtml5Tracking(videoId) {
        html5El = document.getElementById('lpHtml5');
        if (!html5El) return;
        html5El.dataset.videoId = videoId || '';
        progressMaxSeen = 0;

        const ping = () => {
          const current  = Math.floor(html5El.currentTime || 0);
          const duration = Math.floor(html5El.duration || 0);
          progressMaxSeen = Math.max(progressMaxSeen, current);
          if (duration > 0) sendProgress(progressMaxSeen, duration);
        };
        const onTime = () => ping();
        const onPause = () => ping();
        const onEnd = () => { progressMaxSeen = Math.max(progressMaxSeen, Math.floor(html5El.duration||0)); ping(); };
        const onMeta = () => ping();

        html5El.addEventListener('loadedmetadata', onMeta);
        html5El.addEventListener('timeupdate', onTime);
        html5El.addEventListener('pause', onPause);
        html5El.addEventListener('ended', onEnd);
        html5El._cleanupFns = [['loadedmetadata',onMeta],['timeupdate',onTime],['pause',onPause],['ended',onEnd]];

        intervalId = setInterval(ping, 8000);
        html5El.play?.().catch(()=>{});
      }

      // YouTube tracking (via IFrame API)
      let ytApiReady = false;
      function ensureYTApi() {
        return new Promise((resolve) => {
          if (ytApiReady || window.YT?.Player) { ytApiReady = true; resolve(); return; }
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.onload = () => {}; // YT fires global callback
          window.onYouTubeIframeAPIReady = () => { ytApiReady = true; resolve(); };
          document.head.appendChild(tag);
        });
      }
      function attachYoutubeTracking(videoId) {
        const iframe = document.getElementById('lpIframe');
        if (!iframe) return;
        ytPlayer = new YT.Player(iframe, {
          events: {
            onReady: () => {
              intervalId = setInterval(() => {
                const dur = ytPlayer.getDuration?.() || 0;
                const cur = ytPlayer.getCurrentTime?.() || 0;
                progressMaxSeen = Math.max(progressMaxSeen, Math.floor(cur));
                if (dur > 0) sendProgress(progressMaxSeen, dur);
              }, 4000);
            },
            onStateChange: (e) => {
              // On pause/end -> immediate ping
              if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                const dur = ytPlayer.getDuration?.() || 0;
                const cur = ytPlayer.getCurrentTime?.() || 0;
                progressMaxSeen = Math.max(progressMaxSeen, Math.floor(cur));
                if (dur > 0) sendProgress(progressMaxSeen, dur);
              }
            }
          }
        });
      }

      async function openPlayer(btn) {
        const tr = btn.closest('tr');
        const id = tr.getAttribute('data-id');
        const row = lastRows.find(x => String(x.lp_id)===String(id));
        if (!row?.video_link) { ui.toast('No video attached to this lesson plan','warning'); return; }

        detachAll();

        vTitle.textContent = row.title || 'Video';
        playerHolder.innerHTML = makePlayerHtml(row.video_link, row.title || 'Video');
        currentVideoId = tr.getAttribute('data-video-id') || row.video_id || null;
        setLikedUI(false); // we don't know previous liked state; backend return could be used here if desired

        if (isDirectVideo(row.video_link)) {
          attachHtml5Tracking(currentVideoId);
        } else if (isYouTube(row.video_link)) {
          await ensureYTApi();
          attachYoutubeTracking(currentVideoId);
        } else {
          // Other iframes: no reliable progress API; show dash
          vStats.textContent = `—`;
        }

        vModal.show();
      }

      vModalEl.addEventListener('hidden.bs.modal', detachAll);

      // ---- Filters ----
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selMed.addEventListener('change',   () => { f_medium_id = selMed.value; page=1; reload(); });
      selStd.addEventListener('change',   () => { f_std_id = selStd.value; page=1; reload(); });
      selBook.addEventListener('change',  () => { f_book_id = selBook.value; page=1; reload(); });
      selChap.addEventListener('change',  () => { f_chapter_id = selChap.value; page=1; reload(); });
      selSize.addEventListener('change',  () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // ---- Submit LP form ----
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());

        const id = payload.lp_id || '';
        delete payload.lp_id;

        payload.title       = (payload.title || '').trim();
        payload.description = (payload.description || '').trim() || null;
        payload.explanation = (payload.explanation || '').trim() || null;

        ['medium_id','std_id','book_id','chapter_id','video_id'].forEach(k => {
          payload[k] = payload[k] === '' ? null : Number(payload[k]);
        });

        const collectRows = (wrap) => {
          const rows = Array.from(wrap.querySelectorAll('.row'));
          return rows.map(r => {
            const id = r.querySelector('[name="topic_id"],[name="activity_id"]')?.value || '';
            const seq= r.querySelector('[name="sequence_no"]')?.value || '';
            return {
              topic_id: r.querySelector('[name="topic_id"]') ? (id ? Number(id) : null) : undefined,
              activity_id: r.querySelector('[name="activity_id"]') ? (id ? Number(id) : null) : undefined,
              sequence_no: seq ? Number(seq) : null
            };
          }).filter(x => (x.topic_id!=null) || (x.activity_id!=null));
        };
        const topicsPayload = collectRows(topicsWrap).map(x => ({ topic_id: x.topic_id, sequence_no: x.sequence_no }));
        const actsPayload   = collectRows(actsWrap).map(x => ({ activity_id: x.activity_id, sequence_no: x.sequence_no }));
        if (topicsPayload.length) payload.topics = topicsPayload;
        if (actsPayload.length)   payload.activities = actsPayload;

        if (!payload.title) { ui.toast('Title is required', 'danger'); return; }

        try {
          if (id) {
            await api.put(`/api/lesson-plans/${id}`, payload);
            ui.toast('Lesson plan updated', 'success');
          } else {
            await api.post('/api/lesson-plans', payload);
            ui.toast('Lesson plan created', 'success');
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
