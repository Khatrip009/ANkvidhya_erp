// public/js/ui.js
window.ui = (() => {
  function toast(msg, type='info') {
    const area = document.getElementById('toastArea');
    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.role = 'alert'; el.ariaLive = 'assertive'; el.ariaAtomic = 'true';
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${msg}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>`;
    area.appendChild(el);
    new bootstrap.Toast(el, { delay: 2500 }).show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }

  function spinner(size='md') {
    const s = size === 'sm' ? 'spinner-border-sm' : '';
    return `<div class="d-flex justify-content-center my-4">
      <div class="spinner-border ${s}" role="status"><span class="visually-hidden">Loading...</span></div>
    </div>`;
  }

  function emptyState(text='No data found') {
    return `<div class="text-center text-muted py-5">${text}</div>`;
  }

  function pager({ page, pageSize, total, onPage }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const items = [];
    const mk = (p, lbl, dis=false, active=false) =>
      `<li class="page-item ${dis?'disabled':''} ${active?'active':''}">
         <a href="#" class="page-link" data-p="${p}">${lbl}</a>
       </li>`;
    items.push(mk(page-1, '&laquo;', page<=1));
    for (let p=1;p<=pages;p++) items.push(mk(p, p, false, p===page));
    items.push(mk(page+1, '&raquo;', page>=pages));
    const html = `<nav><ul class="pagination pagination-sm">${items.join('')}</ul></nav>`;
    const wrap = document.createElement('div'); wrap.innerHTML = html;
    wrap.addEventListener('click', e => {
      const a = e.target.closest('a[data-p]');
      if (!a) return;
      e.preventDefault();
      const p = parseInt(a.dataset.p, 10);
      if (p>=1 && p<=pages) onPage(p);
    });
    return wrap.firstElementChild;
  }

  function debounce(fn, ms=300) {
    let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
  }

  return { toast, spinner, emptyState, pager, debounce };
})();

