// public/js/api.js
(function () {
  // Build a query-string from an object, skipping empty keys (supports arrays)
  function qs(obj = {}) {
    const params = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) {
        v.forEach(iv => {
          if (iv !== undefined && iv !== null && iv !== '') params.append(k, iv);
        });
      } else {
        params.append(k, v);
      }
    });
    const s = params.toString();
    return s ? `?${s}` : '';
  }

  // Safe escaping for dynamic regex parts
  function escapeForRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Read a single cookie value
  function readCookie(name) {
    try {
      const re = new RegExp('(?:^|; )' + escapeForRegex(name) + '=([^;]*)');
      const m = document.cookie.match(re);
      return m ? decodeURIComponent(m[1]) : '';
    } catch {
      return '';
    }
  }

  // Always get the freshest token (auth helper → localStorage → cookie)
  function getTokenFresh() {
    const t1 = (window.auth && typeof window.auth.getToken === 'function' && auth.getToken()) || '';
    if (t1) return t1;

    const t2 = localStorage.getItem('token') || '';
    if (t2) return t2;

    const t3 = readCookie('token') || '';
    return t3;
  }

  // Detect whether response is JSON (so we don't parse CSV/XLSX as JSON)
  function isJsonResponse(resp) {
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json');
  }

  let warnedOnceNoToken = false;

  /**
   * Core request wrapper.
   * Options:
   *   - method: 'GET' | 'POST' | 'PUT' | 'DELETE'
   *   - body: object|string|FormData
   *   - query: object -> appended as ?k=v (arrays supported)
   *   - headers: object
   *   - background: boolean -> do not auto-logout on 401 (e.g., progress pings)
   *   - expect: 'json' | 'blob' | 'auto' (default 'auto')
   */
  async function request(
    url,
    { method = 'GET', body, query, headers = {}, background = false, expect = 'auto', _retried } = {}
  ) {
    // Always prepend API_BASE if provided
    const base = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const fullUrl = `${base}${url}${qs(query)}`;

    let token = getTokenFresh();
    const h = new Headers(headers);

    const isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);

    // Only set JSON content-type for plain objects; let browser set for FormData
    if (!h.has('Content-Type') && body !== undefined && !isFormData && typeof body !== 'string') {
      h.set('Content-Type', 'application/json');
    }

    // Be liberal in what we accept
    if (!h.has('Accept')) h.set('Accept', 'application/json, text/plain, */*');

    // Attach Authorization header if we have a token
    if (token) {
      h.set('Authorization', `Bearer ${token}`);
    } else if (url.startsWith('/api/')) {
      if (!warnedOnceNoToken) {
        console.warn('[api] No token available — /api/* calls will 401 until login.');
        warnedOnceNoToken = true;
      }
    }

    const resp = await fetch(fullUrl, {
      method,
      headers: h,
      body:
        body === undefined
          ? undefined
          : (isFormData || typeof body === 'string')
            ? body
            : JSON.stringify(body),
    });

    const shouldParseJson = expect === 'json' || (expect === 'auto' && isJsonResponse(resp));

    if (!resp.ok) {
      // If unauthorized, retry once in case a fresh token appeared
      if (resp.status === 401 && !_retried) {
        const fresh = getTokenFresh();
        if (fresh && fresh !== token) {
          return request(url, { method, body, query, headers, background, expect, _retried: true });
        }
      }

      // Parse JSON error payload if present
      let errPayload = null;
      if (shouldParseJson) {
        try { errPayload = await resp.json(); } catch {}
      }

      // 401: auto-logout if NOT a background ping
      if (resp.status === 401 && !background) {
        try { window.auth?.setToken(''); } catch {}
        try { localStorage.removeItem('token'); } catch {}
        if (errPayload?.message) window.ui?.toast?.(errPayload.message, 'danger');
        if (location.hash !== '#/login') location.replace('#/login');
      }

      // 403 (RLS forbidden): just warn
      if (resp.status === 403 && errPayload?.message) {
        window.ui?.toast?.(errPayload.message, 'warning');
      }

      const err = new Error(
        (errPayload && errPayload.message) || resp.statusText || 'Request failed'
      );
      err.status = resp.status;
      err.data = errPayload;
      console.error('[api] Request failed:', method, fullUrl, err.status, err.message);
      throw err;
    }

    // Success path: return as requested
    if (expect === 'blob') {
      return await resp.blob();
    }
    if (shouldParseJson) {
      try { return await resp.json(); } catch { return null; }
    }
    // Fallback: text (useful for CSV responses without JSON)
    try { return await resp.text(); } catch { return null; }
  }

  /**
   * Convenience for downloading (CSV/XLSX) with auth.
   * This fetches as a blob and triggers a browser download.
   */
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

  // Public API
  window.api = {
    request,
    download,
    get:  (url, opts) => request(url, { ...opts, method: 'GET' }),
    post: (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
    put:  (url, body, opts) => request(url, { ...opts, method: 'PUT', body }),
    del:  (url, opts) => request(url, { ...opts, method: 'DELETE' }),

    // Silent POST helper for trackers/pings (avoid auto-logout on 401)
    background: (url, body, opts) =>
      request(url, { method: 'POST', body, background: true, ...(opts || {}) }),
  };
})();
