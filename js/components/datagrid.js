// A tiny grid builder: api-backed search/sort/paginate + saved views + export
window.DataGrid = class {
  constructor({ el, columns, fetcher, pageSize=10, storageKey }) {
    this.root = typeof el === 'string' ? document.querySelector(el) : el;
    this.columns = columns;               // [{key,label,width?,render?}]
    this.fetcher = fetcher;               // async ({page,pageSize,search,sort}) => {data, pagination}
    this.page = 1; this.pageSize = pageSize; this.search = ''; this.sort = null;
    this.storageKey = storageKey;
    this.saved = this.loadSaved();
    this.render();
    this.reload();
  }

  loadSaved() {
    if (!this.storageKey) return [];
    try { return JSON.parse(localStorage.getItem(this.storageKey) || '[]'); } catch { return []; }
  }
  saveViews() {
    if (!this.storageKey) return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.saved));
  }

  render() {
    this.root.innerHTML = `
      <div class="card">
        <div class="card-header d-flex align-items-center gap-2">
          <input class="form-control form-control-sm" style="max-width:260px" placeholder="Search…" id="dg-q">
          <div class="ms-auto d-flex gap-2">
            <div class="dropdown">
              <button class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown">
                Saved views
              </button>
              <div class="dropdown-menu dropdown-menu-end" id="dg-views"></div>
            </div>
            <button class="btn btn-outline-secondary btn-sm" id="dg-save"><i class="bi bi-bookmark"></i> Save</button>
            <button class="btn btn-outline-secondary btn-sm" id="dg-csv"><i class="bi bi-filetype-csv"></i> CSV</button>
            <button class="btn btn-outline-secondary btn-sm" id="dg-xlsx"><i class="bi bi-filetype-xlsx"></i> XLSX</button>
          </div>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead><tr id="dg-head"></tr></thead>
              <tbody id="dg-body"><tr><td class="p-4"><div class="skeleton" style="height:32px;"></div></td></tr></tbody>
            </table>
          </div>
        </div>
        <div class="card-footer d-flex align-items-center justify-content-between">
          <div class="small text-muted" id="dg-info"></div>
          <div class="d-flex align-items-center gap-2">
            <select id="dg-ps" class="form-select form-select-sm" style="width:auto">
              <option>10</option><option>20</option><option>50</option>
            </select>
            <div class="btn-group" id="dg-pager"></div>
          </div>
        </div>
      </div>
    `;

    // header with sort
    const head = this.root.querySelector('#dg-head');
    head.innerHTML = this.columns.map(c =>
      `<th style="${c.width ? `width:${c.width}`:''}">
         <button class="btn btn-link p-0 fw-semibold text-decoration-none sort" data-key="${c.key}">
           ${c.label} <i class="bi bi-arrow-down-up ms-1 text-muted"></i>
         </button>
       </th>`).join('');

    // events
    const q = this.root.querySelector('#dg-q');
    q.addEventListener('input', this.debounce(() => { this.search=q.value.trim(); this.page=1; this.reload(); }, 350));
    this.root.querySelector('#dg-ps').addEventListener('change', e => { this.pageSize=parseInt(e.target.value,10)||10; this.page=1; this.reload(); });
    head.querySelectorAll('.sort').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.key;
      this.sort = (!this.sort || this.sort.key!==key) ? { key, dir:'asc' }
                : (this.sort.dir==='asc' ? { key, dir:'desc' } : null);
      this.page=1; this.reload();
    }));
    this.root.querySelector('#dg-csv').addEventListener('click', () => this.export('csv'));
    this.root.querySelector('#dg-xlsx').addEventListener('click', () => this.export('xlsx'));
    this.root.querySelector('#dg-save').addEventListener('click', () => this.saveCurrentView());
    this.renderSavedViews();
  }

  renderSavedViews() {
    const menu = this.root.querySelector('#dg-views');
    if (!menu) return;
    if (!this.saved.length) { menu.innerHTML = `<span class="dropdown-item-text text-muted small">No saved views</span>`; return; }
    menu.innerHTML = this.saved.map((v,i)=>`
      <button class="dropdown-item d-flex justify-content-between align-items-center" data-i="${i}">
        <span>${v.name}</span>
        <i class="bi bi-x text-danger remove" title="Delete"></i>
      </button>
    `).join('');
    menu.querySelectorAll('.dropdown-item').forEach(el=>{
      el.addEventListener('click', (e)=>{
        if (e.target.classList.contains('remove')) {
          const idx = +el.dataset.i; this.saved.splice(idx,1); this.saveViews(); this.renderSavedViews(); return;
        }
        const v = this.saved[+el.dataset.i];
        this.search=v.search||''; this.pageSize=v.pageSize||10; this.sort=v.sort||null; this.page=1;
        this.root.querySelector('#dg-q').value=this.search;
        this.root.querySelector('#dg-ps').value=String(this.pageSize);
        this.reload();
      });
    });
  }

  saveCurrentView() {
    const name = prompt('Name this view (search/sort/pageSize will be saved):');
    if (!name) return;
    this.saved.unshift({ name, search:this.search, pageSize:this.pageSize, sort:this.sort });
    this.saved = this.saved.slice(0,20);
    this.saveViews(); this.renderSavedViews();
  }

  async reload() {
    const body = this.root.querySelector('#dg-body');
    body.innerHTML = `<tr><td colspan="${this.columns.length}" class="p-4"><div class="skeleton" style="height:32px"></div></td></tr>`;
    try{
      const { data=[], pagination={page:this.page,pageSize:this.pageSize,total:0} } =
        await this.fetcher({ page:this.page, pageSize:this.pageSize, search:this.search, sort:this.sort });

      this.page = pagination.page; this.pageSize = pagination.pageSize;
      const total = pagination.total || 0;

      if (!data.length) {
        body.innerHTML = `<tr><td colspan="${this.columns.length}" class="p-4 text-muted text-center">No records</td></tr>`;
      } else {
        body.innerHTML = data.map(row => {
          const tds = this.columns.map(c => {
            const val = (c.render ? c.render(row[c.key], row) : (row[c.key] ?? ''));
            return `<td>${val}</td>`;
          }).join('');
          return `<tr>${tds}</tr>`;
        }).join('');
      }

      // info & pager
      const info = this.root.querySelector('#dg-info');
      const from = (this.page-1)*this.pageSize + (data.length?1:0);
      const to = (this.page-1)*this.pageSize + data.length;
      info.textContent = `${from}-${to} of ${total}`;

      const pager = this.root.querySelector('#dg-pager');
      pager.innerHTML = '';
      const pages = Math.max(1, Math.ceil(total/this.pageSize));
      const mk = (p, label=String(p), dis=false, act=false) => {
        const b = document.createElement('button');
        b.className = `btn btn-outline-secondary btn-sm${act?' active':''}`;
        b.textContent = label; b.disabled = dis;
        b.addEventListener('click', ()=>{ this.page=p; this.reload(); });
        pager.appendChild(b);
      };
      mk(Math.max(1,this.page-1), '‹', this.page===1);
      for (let i=1;i<=pages && i<=7;i++) mk(i, String(i), false, i===this.page);
      if (pages>7) { const d=document.createElement('span'); d.className='px-2 small text-muted'; d.textContent='…'; pager.appendChild(d); mk(pages, String(pages)); }
      mk(Math.min(pages,this.page+1), '›', this.page===pages);

    }catch(e){
      body.innerHTML = `<tr><td colspan="${this.columns.length}" class="p-4 text-danger">${e.message||'Load failed'}</td></tr>`;
    }
  }

  async export(kind='csv') {
    // naive client-side export (ask API for server-side export if heavy)
    const q = new URLSearchParams({ page:this.page, pageSize:this.pageSize, search:this.search }).toString();
    window.open(`/api/reports-export/generic.${kind}?${q}`, '_blank');
  }

  debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
};
