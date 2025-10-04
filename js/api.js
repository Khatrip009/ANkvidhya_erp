// public/js/api.js
// Lightweight fetch wrapper used by the app. No top-level await; safe IIFE style.
(function () {
  'use strict';

  // utility: build query string
  function qs(obj = {}) {
    const params = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v.forEach(iv => { if (iv !== undefined && iv !== null && iv !== '') params.append(k, iv); });
      else params.append(k, v);
    });
    const s = params.toString();
    return s ? `?${s}` : '';
  }

  function escapeForRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function readCookie(name) {
    try {
      const re = new RegExp('(?:^|; )' + escapeForRegex(name) + '=([^;]*)');
      const m = document.cookie.match(re);
      return m ? decodeURIComponent(m[1]) : '';
    } catch { return ''; }
  }

  // Keep token resolution defensive and fresh
  function getTokenFresh() {
    try {
      if (window.auth && typeof window.auth.getToken === 'function') {
        const t1 = auth.getToken();
        if (t1) return t1;
      }
    } catch (e) {}
    try {
      const t2 = localStorage.getItem('token') || '';
      if (t2) return t2;
    } catch (e) {}
    try {
      const t3 = readCookie('token') || '';
      if (t3) return t3;
    } catch (e) {}
    return '';
  }

  function isJsonResponse(resp) {
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json');
  }

  let warnedOnceNoToken = false;

  async function request(
    url,
    { method = 'GET', body, query, headers = {}, background = false, expect = 'auto', _retried } = {}
  ) {
    const base = (window.CONFIG && (window.CONFIG.API_BASE || '')) || '';
    let token = getTokenFresh();

    const h = new Headers(headers);
    const isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);

    if (!h.has('Content-Type') && body !== undefined && !isFormData && typeof body !== 'string') {
      h.set('Content-Type', 'application/json');
    }
    if (!h.has('Accept')) h.set('Accept', 'application/json, text/plain, */*');

    if (token) h.set('Authorization', `Bearer ${token}`);
    else if ((url.startsWith('/api/') || url.startsWith('http')) && !background) {
      if (!warnedOnceNoToken) {
        console.warn('[api] No token available — /api/* calls will 401 until login.');
        warnedOnceNoToken = true;
      }
    }

    // build full url; if url already absolute, use it
    const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
    const finalUrl = `${fullUrl}${qs(query)}`;

    let resp;
    try {
      resp = await fetch(finalUrl, {
        method,
        headers: h,
        body:
          body === undefined
            ? undefined
            : (isFormData || typeof body === 'string')
              ? body
              : JSON.stringify(body),
      });
    } catch (networkErr) {
      const e = new Error('Network error: ' + (networkErr && networkErr.message ? networkErr.message : networkErr));
      e.status = 0;
      throw e;
    }

    const shouldParseJson = expect === 'json' || (expect === 'auto' && isJsonResponse(resp));

    if (!resp.ok) {
      // If server returned 401 and token might have changed, try one retry
      if (resp.status === 401 && !_retried) {
        const fresh = getTokenFresh();
        if (fresh && fresh !== token) {
          return request(url, { method, body, query, headers, background, expect, _retried: true });
        }
      }

      let errPayload = null;
      if (shouldParseJson) {
        try { errPayload = await resp.json(); } catch (e) { /* ignore parse error */ }
      } else {
        try { const txt = await resp.text(); errPayload = { message: txt }; } catch {}
      }

      // Handle common status cases
      if (resp.status === 401 && !background) {
        try { window.auth?.setToken && window.auth.setToken(''); } catch {}
        try { localStorage.removeItem('token'); } catch {}
        if (errPayload?.message) window.ui?.toast?.(errPayload.message, 'danger');
        // redirect to login page (SPA style)
        if (location.hash !== '#/login') location.replace('#/login');
      }

      if (resp.status === 403 && errPayload?.message) {
        window.ui?.toast?.(errPayload.message, 'warning');
      }

      const err = new Error((errPayload && errPayload.message) || resp.statusText || 'Request failed');
      err.status = resp.status;
      err.data = errPayload;
      throw err;
    }

    if (expect === 'blob') {
      return await resp.blob();
    }

    if (shouldParseJson) {
      try { return await resp.json(); } catch { return null; }
    }
    try { return await resp.text(); } catch { return null; }
  }

  async function download(url, { query, filename, headers } = {}) {
    const blob = await request(url, { method: 'GET', query, headers, expect: 'blob' });
    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(href); a.remove(); }, 0);
  }

  window.api = {
    request,
    download,
    get:  (url, opts) => request(url, { ...opts, method: 'GET' }),
    post: (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
    put:  (url, body, opts) => request(url, { ...opts, method: 'PUT',  body }),
    del:  (url, opts) => request(url, { ...opts, method: 'DELETE' }),
    background: (url, body, opts) => request(url, { method: 'POST', body, background: true, ...(opts || {}) } ),
  };
})();
