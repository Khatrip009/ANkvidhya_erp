// public/js/pages/videos.js
(() => {
  // ---------- Masters ----------
  async function fetchAll(table) {
    const res = await api.get(`/api/master/${table}`, { query: { pageSize: 1000 } });
    return res?.data || [];
  }
  const fetchCourses  = () => api.get('/api/courses', { query: { pageSize: 1000 } }).then(r => r?.data || []);
  const fetchBooks     = () => api.get('/api/books', { query: { pageSize: 1000 } }).then(r => r?.data || []);
  const fetchChapters = () => api.get('/api/chapters', { query: { pageSize: 1000 } }).then(r => r?.data || []);

  // ---------- Helpers ----------
  const opt = (v, t, sel='') => `<option value="${v}" ${String(v)===String(sel)?'selected':''}>${t}</option>`;
  const buildOptions = (list, idKey, nameKey, sel='') =>
    `<option value="">Select</option>` + list.map(x => opt(x[idKey], x[nameKey], sel)).join('');
  const fmtDate = (s) => s ? new Date(s).toLocaleString() : '-';

  function isDirectVideo(url='') {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  }
  function isYouTube(url='') {
    return /youtu\.be\/|youtube\.com\/(watch|embed)/i.test(url);
  }
  function isVimeo(url='') {
    return /vimeo\.com\/(video\/)?\d+/i.test(url);
  }
  function isGoogleDrive(url='') {
    return /drive\.google\.com/i.test(url);
  }

  function youTubeEmbed(url='') {
    // Accept forms: https://www.youtube.com/watch?v=ID or youtu.be/ID
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      }
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      // already /embed/ID
      return url.replace('/watch?v=', '/embed/');
    } catch { return url; }
  }
  function vimeoEmbed(url='') {
    // Accept forms: https://vimeo.com/ID or /video/ID
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  }
  function driveEmbed(url='') {
    // If share link is like /file/d/FILEID/view —> embed/FILEID
    const m = url.match(/\/file\/d\/([^/]+)\//);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    // Fallback
    return url;
  }

  function makePlayerHtml(link, titleText='') {
    if (!link) {
      return `<div class="text-center text-muted p-4">No video link</div>`;
    }
    if (isDirectVideo(link)) {
      // HTML5 player
      return `
        <video id="pvHtml5" class="w-100 rounded border" controls playsinline preload="metadata" style="max-height:70vh">
          <source src="${link}">
          Your browser does not support the video tag.
        </video>`;
    }
    // Embed
    let src = link;
    if (isYouTube(link)) src = youTubeEmbed(link);
    else if (isVimeo(link)) src = vimeoEmbed(link);
    else if (isGoogleDrive(link)) src = driveEmbed(link);

    const titleAttr = titleText ? `title="${titleText.replace(/"/g,'&quot;')}"` : '';
    return `
      <div class="ratio ratio-16x9">
        <iframe ${titleAttr} src="${src}" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen
                class="rounded border"></iframe>
      </div>`;
  }

  function rowHtml(r) {
    return `
      <tr data-id="${r.video_id}">
        <td>
          <div class="fw-semibold">${r.tittle || '-'}</div>
          <div class="small text-muted text-truncate" style="max-width:420px">${r.description || ''}</div>
        </td>
        <td class="text-nowrap">${r.course_name || '-'}</td>
        <td class="text-nowrap">${r.book_name || '-'}</td>
        <td class="text-nowrap">${r.chapter_name || '-'}</td>
        <td class="text-nowrap">${fmtDate(r.created_at)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-1" data-act="play"><i class="bi bi-play-circle"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }

  // ---------- Page ----------
  window.pageVideos = {
    render() {
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">Videos</h2>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="btnNew"><i class="bi bi-plus-lg"></i> New Video</button>
            <a class="btn btn-sm btn-outline-secondary" href="/api/videos/export/csv" target="_blank"><i class="bi bi-filetype-csv"></i> CSV</a>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label mb-1">Search</label>
                <input id="vidSearch" class="form-control form-control-sm" placeholder="Search title">
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Course</label>
                <select id="fCourse" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Book</label>
                <select id="fBook" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label mb-1">Chapter</label>
                <select id="fChapter" class="form-select form-select-sm"><option value="">All</option></select>
              </div>
              <div class="col-6 col-md-1">
                <label class="form-label mb-1">Page</label>
                <select id="vidPageSize" class="form-select form-select-sm"><option>10</option><option selected>20</option><option>50</option></select>
              </div>
              <div class="col-6 col-md-1">
                <button id="vidReload" class="btn btn-outline-secondary btn-sm w-100"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Title / Description</th>
                    <th>Course</th>
                    <th>Book</th>
                    <th>Chapter</th>
                    <th>Created</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="vidTbody">
                  <tr><td colspan="6" class="p-3">${ui.spinner()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="small text-muted" id="vidStats"></div>
            <div id="vidPager"></div>
          </div>
        </div>

        <!-- Modal: Create/Edit Video -->
        <div class="modal fade" id="vidModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Video</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>

              <form id="vidForm">
                <div class="modal-body">
                  <input type="hidden" name="video_id">

                  <div class="row g-3">
                    <div class="col-12 col-md-6">
                      <label class="form-label">Title <span class="text-danger">*</span></label>
                      <input name="tittle" class="form-control" required placeholder="e.g. Introduction to Fractions">
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="form-label">Video Link</label>
                      <input name="video_link" class="form-control" placeholder="https://... (YouTube/Vimeo/Drive or MP4)">
                    </div>

                    <div class="col-12">
                      <label class="form-label">Description</label>
                      <textarea name="description" class="form-control" rows="2" placeholder="Short description"></textarea>
                    </div>

                    <div class="col-12 col-md-4">
                      <label class="form-label">Course</label>
                      <select name="course_id" class="form-select"></select>
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label">Book</label>
                      <select name="book_id" class="form-select"></select>
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label">Chapter</label>
                      <select name="chapter_id" class="form-select"></select>
                    </div>

                    <div class="col-12">
                      <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPreview">
                        <i class="bi bi-play-circle"></i> Preview
                      </button>
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

        <!-- Modal: Video Player -->
        <div class="modal fade" id="playerModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="playerTitle">Video</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div id="playerHolder" class="w-100"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    async mount() {
      // Elements
      const tbody    = document.getElementById('vidTbody');
      const pagerEl  = document.getElementById('vidPager');
      const statsEl  = document.getElementById('vidStats');

      const inpSearch = document.getElementById('vidSearch');
      const selCourse = document.getElementById('fCourse');
      const selBook   = document.getElementById('fBook');
      const selChap   = document.getElementById('fChapter');
      const selSize   = document.getElementById('vidPageSize');
      const btnReload = document.getElementById('vidReload');

      const btnNew   = document.getElementById('btnNew');
      const modalEl  = document.getElementById('vidModal');
      const modal    = bootstrap.Modal.getOrCreateInstance(modalEl);
      const form     = document.getElementById('vidForm');
      const btnPrev  = document.getElementById('btnPreview');

      const playerModalEl = document.getElementById('playerModal');
      const playerModal   = bootstrap.Modal.getOrCreateInstance(playerModalEl);
      const playerHolder  = document.getElementById('playerHolder');
      const playerTitle   = document.getElementById('playerTitle');

      // Masters
      let [courses, books, chapters] = await Promise.all([
        fetchCourses(), fetchBooks(), fetchChapters()
      ]);

      // Filters: populate
      selCourse.innerHTML = `<option value="">All</option>` + courses.map(c => `<option value="${c.course_id}">${c.course_name}</option>`).join('');
      function refreshFilterBooks(courseId) {
        const list = courseId ? books.filter(b => String(b.course_id)===String(courseId)) : books;
        selBook.innerHTML = `<option value="">All</option>` + list.map(b => `<option value="${b.book_id}">${b.book_name}</option>`).join('');
      }
      function refreshFilterChapters(bookId) {
        const list = bookId ? chapters.filter(ch => String(ch.book_id)===String(bookId)) : chapters;
        selChap.innerHTML = `<option value="">All</option>` + list.map(c => `<option value="${c.chapter_id}">${c.chapter_name}</option>`).join('');
      }
      refreshFilterBooks('');
      refreshFilterChapters('');

      // Form selects
      const selFormCourse = form.querySelector('select[name="course_id"]');
      const selFormBook   = form.querySelector('select[name="book_id"]');
      const selFormChap   = form.querySelector('select[name="chapter_id"]');

      selFormCourse.innerHTML = buildOptions(courses, 'course_id', 'course_name');
      selFormBook.innerHTML   = buildOptions([], 'book_id', 'book_name'); // depends on course
      selFormChap.innerHTML   = buildOptions([], 'chapter_id', 'chapter_name'); // depends on book

      function refreshFormBooks(courseId, selected='') {
        const list = courseId ? books.filter(b => String(b.course_id)===String(courseId)) : [];
        selFormBook.innerHTML = buildOptions(list, 'book_id', 'book_name', selected);
      }
      function refreshFormChaps(bookId, selected='') {
        const list = bookId ? chapters.filter(ch => String(ch.book_id)===String(bookId)) : [];
        selFormChap.innerHTML = buildOptions(list, 'chapter_id', 'chapter_name', selected);
      }

      // Local state
      let page=1, pageSize = parseInt(selSize.value,10)||20, q='';
      let f_course_id='', f_book_id='', f_chapter_id='';
      let lastRows = [];

      function setStats(pg) {
        if (!pg?.total) { statsEl.textContent=''; return; }
        const start = (pg.page - 1) * pg.pageSize + 1;
        const end   = Math.min(pg.page * pg.pageSize, pg.total);
        statsEl.textContent = `${start}–${end} of ${pg.total}`;
      }

      // API expects names for filters → map selected id -> name
      function namesForFilters() {
        const course_name = f_course_id ? (courses.find(x=>String(x.course_id)===String(f_course_id))?.course_name || '') : '';
        const book_name   = f_book_id ? (books.find(x=>String(x.book_id)===String(f_book_id))?.book_name || '') : '';
        const chapter_name= f_chapter_id ? (chapters.find(x=>String(x.chapter_id)===String(f_chapter_id))?.chapter_name || '') : '';
        return { course_name, book_name, chapter_name };
      }

      async function reload() {
        tbody.innerHTML = `<tr><td colspan="6" class="p-3">${ui.spinner('sm')}</td></tr>`;
        try {
          const query = { page, pageSize, search: q, ...namesForFilters() };
          const res   = await api.get('/api/videos', { query });
          const rows  = res?.data || [];
          const pg    = res?.pagination || { page, pageSize, total: rows.length };
          lastRows    = rows;

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-muted">No videos found</td></tr>`;
            pagerEl.innerHTML=''; setStats({ total:0 }); return;
          }

          tbody.innerHTML = rows.map(rowHtml).join('');

          // actions
          tbody.querySelectorAll('[data-act="play"]').forEach(btn => btn.addEventListener('click', () => openPlayer(btn)));
          tbody.querySelectorAll('[data-act="edit"]').forEach(btn => btn.addEventListener('click', () => openForm('edit', btn)));
          tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', async () => {
            const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
            if (!confirm('Delete this video?')) return;
            try { await api.del(`/api/videos/${id}`); ui.toast('Video deleted','success'); reload(); }
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
        form.querySelector('[name="video_id"]').value  = row?.video_id || '';
        form.querySelector('[name="tittle"]').value    = row?.tittle || '';
        form.querySelector('[name="description"]').value = row?.description || '';
        form.querySelector('[name="video_link"]').value  = row?.video_link || '';

        // map names to ids for selects
        const courseId = row?.course_name
          ? (courses.find(c => c.course_name?.toLowerCase()===row.course_name?.toLowerCase())?.course_id || '')
          : (row?.course_id || '');
        selFormCourse.value = courseId || '';
        refreshFormBooks(courseId || '',
          row?.book_name
            ? (books.find(b => b.book_name?.toLowerCase()===row.book_name?.toLowerCase())?.book_id || '')
            : (row?.book_id || '')
        );

        const bookId = selFormBook.value || '';
        refreshFormChaps(bookId || '',
          row?.chapter_name
            ? (chapters.find(ch => ch.chapter_name?.toLowerCase()===row.chapter_name?.toLowerCase())?.chapter_id || '')
            : (row?.chapter_id || '')
        );
      }

      function openForm(_mode, btnOrNull) {
        let row = null;
        if (btnOrNull) {
          const tr = btnOrNull.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.video_id) === String(id)) || null;
        }
        fillForm(row);
        modal.show();
      }

      function openPlayer(btnOrFromPreview, forcedLink=null, forcedTitle=null) {
        let row = null;
        if (btnOrFromPreview?.closest) {
          const tr = btnOrFromPreview.closest('tr'); const id = tr.getAttribute('data-id');
          row = lastRows.find(x => String(x.video_id) === String(id)) || null;
        }
        const link  = forcedLink ?? row?.video_link ?? '';
        const title = forcedTitle ?? row?.tittle ?? 'Video';
        playerTitle.textContent = title;
        playerHolder.innerHTML = makePlayerHtml(link, title);
        playerModal.show();
      }

      // Filters
      inpSearch.addEventListener('input', ui.debounce(() => { q = inpSearch.value.trim(); page=1; reload(); }, 350));
      selCourse.addEventListener('change', () => {
        f_course_id = selCourse.value; refreshFilterBooks(f_course_id); f_book_id=''; selBook.value=''; refreshFilterChapters(''); f_chapter_id='';
        page=1; reload();
      });
      selBook.addEventListener('change', () => {
        f_book_id = selBook.value; refreshFilterChapters(f_book_id); f_chapter_id=''; selChap.value='';
        page=1; reload();
      });
      selChap.addEventListener('change', () => { f_chapter_id = selChap.value; page=1; reload(); });
      selSize.addEventListener('change',   () => { pageSize = parseInt(selSize.value,10)||20; page=1; reload(); });
      btnReload.addEventListener('click', reload);

      // Form reactions (cascades)
      selFormCourse.addEventListener('change', () => {
        refreshFormBooks(selFormCourse.value, '');
        selFormChap.innerHTML = buildOptions([], 'chapter_id', 'chapter_name');
      });
      selFormBook.addEventListener('change', () => {
        refreshFormChaps(selFormBook.value, '');
      });

      // Preview from form
      btnPrev.addEventListener('click', () => {
        const title = (form.querySelector('[name="tittle"]').value || 'Video').trim();
        const link  = (form.querySelector('[name="video_link"]').value || '').trim();
        if (!link) { ui.toast('Enter a video link to preview', 'warning'); return; }
        openPlayer(null, link, title);
      });

      // Submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        const id = payload.video_id || '';
        delete payload.video_id;

        // Normalize
        payload.tittle      = (payload.tittle || '').trim();
        payload.video_link  = (payload.video_link || '').trim() || null;
        payload.description = (payload.description || '').trim() || null;

        ['course_id','book_id','chapter_id'].forEach(k => {
          payload[k] = payload[k] === '' ? null : Number(payload[k]);
        });

        if (!payload.tittle) {
          ui.toast('Title is required', 'danger'); return;
        }

        try {
          if (id) {
            await api.put(`/api/videos/${id}`, payload);
            ui.toast('Video updated', 'success');
          } else {
            await api.post('/api/videos', payload);
            ui.toast('Video created', 'success');
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

      // Clean player on modal hide (stops playback for iframes and <video>)
      playerModalEl.addEventListener('hidden.bs.modal', () => {
        playerHolder.innerHTML = '';
      });
    }
  };
})();
