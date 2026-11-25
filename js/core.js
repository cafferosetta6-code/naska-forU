/* NASKA — core.js : API (fetch + retry + idempotensi), SWR cache, router, UI primitif (toast, modal), util. */
(function () {
  'use strict';
  const VERSION = '1.0.0';
  const CFG = window.APP_CONFIG || {};
  const GAS_URL = String(CFG.GAS_URL || '');
  const URL_OK = /^https?:\/\/[^\s]+$/i.test(GAS_URL) && !/GANTI|XXXX/i.test(GAS_URL);
  const N = (window.N = { VERSION: VERSION, mods: {}, pages: {}, state: {} });

  /* ============================== UTIL ============================== */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const debounce = (fn, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 250); }; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function tgl(s, panjang) {                        // 'yyyy-MM-dd' → 'Rab, 25 Nov'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return '';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return HARI[d.getDay()] + ', ' + (+m[3]) + ' ' + BLN[+m[2] - 1] + (panjang ? ' ' + m[1] : '');
  }
  const jam = (s) => (String(s || '').length >= 16 ? String(s).slice(11, 16) : '');
  const waktu = (s) => (s ? tgl(String(s).slice(0, 10)).replace(/^\w+, /, '') + ' ' + jam(s) : '');
  const isiTemplate = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : v[k]));
  const waLink = (nomor, teks) => 'https://wa.me/' + String(nomor || '').replace(/\D/g, '') + (teks ? '?text=' + encodeURIComponent(teks) : '');
  const tampilWa = (n) => { n = String(n || ''); return n.indexOf('62') === 0 ? '0' + n.slice(2) : n; };
  const validHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (x) {} t.remove(); }
    toast('Disalin: ' + text, 'ok');
  }
  Object.assign(N, { $, $$, esc, rp, uid, debounce, sleep, tgl, jam, waktu, isiTemplate, waLink, tampilWa, validHex, copy });

  /* ============================== IKON (SVG inline) ============================== */
  const P = {
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M18 6 6 18M6 6l12 12', check: 'M20 6 9 17l-5-5',
    right: 'm9 18 6-6-6-6', left: 'm15 18-6-6 6-6', down: 'm6 9 6 6 6-6', up: 'm18 15-6-6-6 6',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    coffee: '<path d="M10 2v2M14 2v2M6 2v2"/><path d="M5 8h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 13h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    store: '<path d="M3 9 5 3h14l2 6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 21V12M19 21V12M3 21h18"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M20 20h.01M17 20v-3"/>',
    bank: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-7 10 7Z"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    back: 'M19 12H5M12 19l-7-7 7-7', power: 'M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0',
    tag: '<path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4Z"/><path d="M7 7h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    wa: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.9.8c-.9-.4-1.7-1.2-2.1-2.1l.8-.9-1-2Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    filter: 'M22 3H2l8 9.5V19l4 2v-8.5Z', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trend: 'M22 7 13.5 15.5l-5-5L2 17M16 7h6v6', star: 'm12 2 3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7Z',
    cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 18.5Z"/>', cup: '<path d="M5 8h12l-1.5 12h-9Z"/><path d="M4 8h14M9 4h4l1 4"/>'
  };
  function ic(name, cls) {
    const p = P[name] || P.info;
    return '<svg class="' + (cls || 'size-5') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (p.charAt(0) === '<' ? p : '<path d="' + p + '"/>') + '</svg>';
  }
  const foto = (url, nama, cls) => url
    ? '<img src="' + esc(url) + '" alt="' + esc(nama || '') + '" loading="lazy" decoding="async" class="' + (cls || 'size-full object-cover') + '" data-foto>'
    : '<span class="grid size-full place-items-center bg-gradient-to-br from-line to-tint text-sky">' + ic('coffee', 'size-1/2') + '</span>';
  document.addEventListener('error', (e) => {
    const t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-foto')) { t.replaceWith(Object.assign(document.createElement('span'), { className: 'grid size-full place-items-center bg-gradient-to-br from-line to-tint text-sky', innerHTML: ic('coffee', 'size-1/2') })); }
  }, true);
  Object.assign(N, { ic, foto });

  /* ============================== PENYIMPANAN & SESI ============================== */
  const LS = 'naska:v1:';
  const Store = {
    get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      const s = JSON.stringify(v);
      try { localStorage.setItem(LS + k, s); }
      catch (e) { try { Object.keys(localStorage).filter((x) => x.indexOf(LS + 'c:') === 0).forEach((x) => localStorage.removeItem(x)); localStorage.setItem(LS + k, s); } catch (e2) {} }
    },
    del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} }
  };
  const Sesi = {
    get token() { return (Store.get('adm', null) || {}).t || ''; },
    get me() { return (Store.get('adm', null) || {}).me || null; },
    set(token, me) { Store.set('adm', { t: token, me: me || this.me }); },
    clear() { Store.del('adm'); N.state.adminBoot = null; }
  };
  const cacheKey = (k) => 'c:' + (Sesi.token ? 'a' : 'p') + ':' + k;
  const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; };
  Object.assign(N, { Store, Sesi, hashStr });

  /* ============================== API ============================== */
  const Perf = { rows: [], add(a, total, server) { this.rows.push({ action: a, total: total, server: server == null ? null : server, net: server == null ? null : total - server, at: Date.now() }); if (this.rows.length > 200) this.rows.shift(); }, table() { console.table(this.rows.slice(-30)); } };
  N.Perf = Perf;
  const READ = /^(publicBootstrap|getPublicConfig|getMenu|getStok|getOrder|adminBootstrap|adminPoll|adminListOrders|adminGetOrder|adminPosBootstrap|adminPosHistory|adminGetStok|adminReport|batch|ping)$/;
  const Clock = { off: 0, sync(ms) { if (ms) this.off = ms - Date.now(); }, now() { return Date.now() + this.off; } };
  N.Clock = Clock;

  function waitOnline() {
    if (navigator.onLine !== false) return Promise.resolve();
    return new Promise((res) => { const f = () => { window.removeEventListener('online', f); res(); }; window.addEventListener('online', f); setTimeout(f, 8000); });
  }
  async function apiOnce(action, data, timeout, reqId) {
    const ctl = new AbortController(), t0 = performance.now(), to = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(GAS_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, data: data || {}, token: Sesi.token, reqId: reqId || '' }), signal: ctl.signal });
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch (e) { return { retry: true, res: { success: false, message: 'Respons server tidak valid.', code: 'NET' } }; }
      Perf.add(action, Math.round(performance.now() - t0), j.ms);
      return { res: j };
    } catch (e) {
      return { retry: true, res: { success: false, message: e && e.name === 'AbortError' ? 'Server lambat merespons.' : 'Koneksi bermasalah.', code: 'NET' } };
    } finally { clearTimeout(to); }
  }
  /** api(action, data, {reqId, silent}) — selalu mengembalikan objek {success,data,message}; tidak pernah melempar. */
  async function api(action, data, opt) {
    opt = opt || {};
    if (!URL_OK) return { success: false, message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js.', code: 'CONFIG' };
    const baca = READ.test(action), reqId = opt.reqId || (baca ? '' : uid());
    const maks = baca ? 3 : 2, timeout = baca ? 25000 : 90000;
    let last;
    for (let i = 0; i < maks; i++) {
      await waitOnline();
      const o = await apiOnce(action, data, i === 0 && baca ? 25000 : timeout, reqId);
      last = o.res;
      if (!o.retry) break;
      if (i < maks - 1) await sleep(700 * (i + 1));
    }
    if (last && last.code === 'AUTH' && Sesi.token) {
      Sesi.clear(); toast('Sesi berakhir. Silakan masuk lagi.', 'warn');
      if (/^#\/(admin|pos)/.test(location.hash) && !/login/.test(location.hash)) location.hash = '#/admin/login';
    }
    if (last && !last.success && !opt.silent && last.code === 'NET') toast(last.message + ' Coba lagi.', 'bad');
    return last;
  }
  /** SWR: render dari cache perangkat dulu, segarkan di latar; render ulang hanya bila data berubah. */
  async function swr(key, action, data, render, opt) {
    opt = opt || {};
    const k = cacheKey(key), fresh = opt.fresh == null ? 60000 : opt.fresh, c = Store.get(k, null);
    if (c && c.v === VERSION) render(c.data, true);
    if (c && c.v === VERSION && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
    const res = await api(action, data, { silent: !!c });
    if (res.success) {
      const h = hashStr(JSON.stringify(res.data));
      Store.set(k, { t: Date.now(), h: h, v: VERSION, data: res.data });
      if (!c || c.h !== h || c.v !== VERSION || opt.alwaysRender) render(res.data, false);
    } else if (!c && opt.onError) opt.onError(res);
    return res;
  }
  Object.assign(N, { api, swr, URL_OK });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && URL_OK && Date.now() - (N.state.hiddenAt || 0) > 120000) api('ping', {}, { silent: true }); if (document.hidden) N.state.hiddenAt = Date.now(); });

  /* ============================== TOAST & MODAL ============================== */
  function toast(msg, type, ms) {
    const box = $('#toasts'); if (!box) return;
    const el = document.createElement('div');
    const warna = { ok: 'bg-ok text-white', bad: 'bg-bad text-white', warn: 'bg-sun text-ink', info: 'bg-ink text-white' }[type || 'info'];
    el.className = 'pointer-events-auto flex max-w-full items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-pop animate-rise ' + warna;
    el.innerHTML = ic(type === 'ok' ? 'check' : type === 'bad' || type === 'warn' ? 'alert' : 'info', 'size-4 shrink-0') + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, ms || 3200);
    while (box.children.length > 3) box.firstChild.remove();
  }
  N.toast = toast;

  let lockCount = 0; const stack = [];
  const lockScroll = (on) => { lockCount += on ? 1 : -1; document.body.style.overflow = lockCount > 0 ? 'hidden' : ''; };
  /** modal.open({title, body(html), size:'center'|'bottom'|'right', wide, footer(html), onClose, dismissable}) → {el, body, close} */
  const modal = {
    open(o) {
      const back = document.createElement('div'), sh = document.createElement('div');
      const narrow = window.innerWidth < 640;
      const size = o.size === 'right' ? 'right' : (o.size === 'bottom' || narrow) ? 'bottom' : 'center';
      back.className = 'sheet-backdrop'; sh.className = 'sheet sheet-' + size + (o.wide && size === 'center' ? ' !w-[min(94vw,56rem)]' : '') + (o.cls ? ' ' + o.cls : '');
      sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', o.title || 'Dialog'); sh.tabIndex = -1;
      sh.innerHTML = (o.title !== false ? '<div class="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5"><h2 class="font-display text-xl font-bold text-deep">' + esc(o.title || '') + '</h2><button class="icon-btn -mr-2" data-close aria-label="Tutup">' + ic('x') + '</button></div>' : '')
        + '<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-body>' + (o.body || '') + '</div>' + (o.footer ? '<div class="border-t border-line bg-white px-5 py-3 safe-b" data-footer>' + o.footer + '</div>' : '');
      const prev = document.activeElement;
      const api2 = { el: sh, back: back, body: $('[data-body]', sh), footer: $('[data-footer]', sh), closed: false, close(v) {
        if (api2.closed) return; api2.closed = true; lockScroll(false); stack.splice(stack.indexOf(api2), 1);
        sh.style.opacity = '0'; back.style.opacity = '0'; setTimeout(() => { sh.remove(); back.remove(); }, 150);
        try { prev && prev.focus && prev.focus(); } catch (e) {}
        o.onClose && o.onClose(v);
      } };
      if (o.dismissable !== false) { back.addEventListener('click', () => api2.close()); }
      sh.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api2.close(); });
      document.body.append(back, sh); lockScroll(true); stack.push(api2);
      setTimeout(() => { const f = $('[autofocus]', sh) || $('input,select,textarea', sh); (f || sh).focus({ preventScroll: true }); }, 30);
      return api2;
    },
    top() { return stack[stack.length - 1]; },
    closeAll() { stack.slice().forEach((m) => m.close()); }
  };
  document.addEventListener('keydown', (e) => {
    const m = modal.top(); if (!m) return;
    if (e.key === 'Escape') { e.preventDefault(); m.close(); }
    if (e.key === 'Tab') {
      const f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', m.el).filter((x) => x.offsetParent !== null);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  N.modal = modal;
  N.confirm = (o) => new Promise((res) => {
    const m = modal.open({ title: o.title || 'Konfirmasi', size: 'center', onClose: (v) => res(v === true),
      body: '<div class="p-5 text-[15px] leading-relaxed text-ink/90">' + (o.html || esc(o.text || '')) + '</div>',
      footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>' + esc(o.cancel || 'Batal') + '</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + ' flex-1" data-ok>' + esc(o.ok || 'Ya, lanjut') + '</button></div>' });
    $('[data-ok]', m.footer).addEventListener('click', () => m.close(true));
  });
  /** Tombol sibuk: nonaktif + label, jalankan fn, pulihkan. */
  N.busy = async (btn, label, fn) => {
    if (!btn || btn.disabled) return;
    const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-6.2-8.55" stroke-linecap="round"/></svg><span>' + esc(label || 'Memproses…') + '</span>';
    try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
  };
  /** Delegasi aksi: elemen dengan data-act="nama" → map[nama](el, event). */
  N.actions = (root, map, evt) => root.addEventListener(evt || 'click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t || !root.contains(t)) return;
    const fn = map[t.dataset.act]; if (fn) fn(t, e);
  });
  N.countdown = (el, endMs, onEnd) => {
    const tick = () => {
      if (!el.isConnected) return clearInterval(iv);
      const s = Math.max(0, Math.ceil((endMs - Clock.now()) / 1000));
      el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (s <= 0) { clearInterval(iv); onEnd && onEnd(); }
    };
    const iv = setInterval(tick, 1000); tick(); return () => clearInterval(iv);
  };
  /** Input uang: tampilkan pemisah ribuan; nilai angka lewat el.dataset.val. */
  N.moneyInput = (el, onChange) => {
    el.addEventListener('input', () => { const n = +el.value.replace(/\D/g, '') || 0; el.dataset.val = n; el.value = n ? n.toLocaleString('id-ID') : ''; onChange && onChange(n); });
  };
  /** Perkecil gambar di browser sebelum diunggah (target ≤ 500 KB). */
  N.kompres = (file, maks, png) => new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      const mime = png ? 'image/png' : 'image/jpeg'; let q = 0.85, d = c.toDataURL(mime, q);
      while (!png && d.length * 0.75 > 600 * 1024 && q > 0.4) { q -= 0.1; d = c.toDataURL(mime, q); }
      if (d.length * 0.75 > 850 * 1024) return rej(new Error('Gambar terlalu besar setelah dikompres.'));
      res({ mime: mime, base64: d.split(',')[1], dataUrl: d });
    };
    img.onerror = () => rej(new Error('File bukan gambar yang valid.')); img.src = u;
  });

  /* ============================== BRAND ============================== */
  N.brand = Store.get('brand', { nama: 'Naska', tagline: 'Kopi siap, tinggal ambil', logo: '', wa: '', warna: '#0B7BD0' });
  N.applyBrand = (cfg) => {
    if (!cfg) return;
    const b = { nama: cfg.nama_brand || N.brand.nama, tagline: cfg.tagline !== undefined ? cfg.tagline : N.brand.tagline, logo: cfg.logo_url !== undefined ? cfg.logo_url : N.brand.logo, wa: cfg.wa_admin !== undefined ? cfg.wa_admin : N.brand.wa, warna: validHex(cfg.warna_utama) ? cfg.warna_utama : N.brand.warna };
    N.brand = b; Store.set('brand', b);
    document.documentElement.style.setProperty('--brand', b.warna);
    if (!/^#\/(admin|pos)/.test(location.hash)) document.title = b.nama + ' — ' + (b.tagline || 'Pesan kopi');
    const sp = $('#splash-name'); if (sp) sp.textContent = b.nama;
    $$('[data-brand-name]').forEach((e) => (e.textContent = b.nama));
    $$('[data-brand-logo]').forEach((e) => { e.innerHTML = b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.nama) + '" class="size-full object-contain" data-foto>' : ic('coffee', 'size-1/2'); });
  };
  N.logoHtml = (cls) => '<span data-brand-logo class="grid shrink-0 place-items-center overflow-hidden ' + (cls || 'size-10 rounded-2xl bg-white/25') + '">' + (N.brand.logo ? '<img src="' + esc(N.brand.logo) + '" alt="" class="size-full object-contain" data-foto>' : ic('coffee', 'size-1/2')) + '</span>';
  document.documentElement.style.setProperty('--brand', N.brand.warna);

  /* ============================== STATUS (pill) ============================== */
  N.pillBayar = (s) => ({
    'Lunas': '<span class="pill pill-ok">' + ic('check', 'size-3') + 'Lunas</span>',
    'Belum Bayar': '<span class="pill pill-warn">' + ic('clock', 'size-3') + 'Belum Bayar</span>',
    'Menunggu Konfirmasi': '<span class="pill pill-info">' + ic('clock', 'size-3') + 'Menunggu Konfirmasi</span>',
    'Kedaluwarsa': '<span class="pill pill-mute">' + ic('x', 'size-3') + 'Kedaluwarsa</span>'
  }[s] || '<span class="pill pill-mute">' + esc(s) + '</span>');
  N.pillOrder = (s) => ({
    'Baru': 'pill-sun', 'Diproses': 'pill-info', 'Siap': 'pill-ok', 'Diantar': 'pill-info', 'Selesai': 'pill-ok', 'Batal': 'pill-bad'
  }[s] ? '<span class="pill ' + { 'Baru': 'pill-sun', 'Diproses': 'pill-info', 'Siap': 'pill-ok', 'Diantar': 'pill-info', 'Selesai': 'pill-ok', 'Batal': 'pill-bad' }[s] + '">' + esc(s) + '</span>' : '<span class="pill pill-mute">' + esc(s) + '</span>');
  N.pillSumber = (s) => '<span class="pill ' + (s === 'POS' ? 'pill-sun' : 'pill-info') + '">' + esc(s) + '</span>';

  /* ============================== ROUTER ============================== */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src + '?v=' + VERSION; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.appendChild(s);
    });
  }
  const loading = {};
  N.loadModule = (name) => {
    if (N.mods[name] && N.mods[name].loaded) return Promise.resolve(N.mods[name]);
    if (!loading[name]) loading[name] = loadScript('js/' + name + '.js').then(() => N.mods[name]).catch((e) => { delete loading[name]; throw e; });
    return loading[name];
  };
  const shells = { buyer: $('#shell-buyer'), admin: $('#shell-admin'), pos: $('#shell-pos') };
  N.go = (h) => { if (location.hash === h) route(); else location.hash = h; };
  N.back = (fallback) => { if (history.length > 1 && document.referrer !== '') history.back(); else N.go(fallback); };
  let routeSeq = 0;
  async function route() {
    const seq = ++routeSeq;
    const segs = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const shell = segs[0] === 'admin' ? 'admin' : segs[0] === 'pos' ? 'pos' : 'buyer';
    N.state.segs = segs; N.state.shell = shell;
    Object.keys(shells).forEach((k) => (shells[k].hidden = k !== shell));
    let mod = N.mods[shell];
    if (!mod || !mod.loaded) {
      if (shell !== 'buyer') shells[shell].innerHTML = '<div class="grid min-h-dvh place-items-center"><div class="skel h-10 w-48"></div></div>';
      try { mod = await N.loadModule(shell); } catch (e) { shells[shell].innerHTML = '<div class="p-8 text-center"><p class="font-semibold text-bad">Gagal memuat halaman. Periksa koneksi lalu muat ulang.</p><button class="btn btn-primary mt-4" onclick="location.reload()">Muat ulang</button></div>'; hideSplash(); return; }
      if (seq !== routeSeq) return;
    }
    if (!mod.mounted) { mod.mounted = true; mod.mount(shells[shell]); }
    mod.route(segs);
    window.scrollTo(0, 0);
    hideSplash();
  }
  function hideSplash() { const s = $('#splash'); if (s && !s.classList.contains('out')) { s.classList.add('out'); setTimeout(() => s.remove(), 450); } }
  N.route = route;
  window.addEventListener('hashchange', () => { modal.closeAll(); route(); });
  window.addEventListener('online', () => { $('#netbar').hidden = true; toast('Kembali online', 'ok'); });
  window.addEventListener('offline', () => { $('#netbar').hidden = false; });
  if (navigator.onLine === false) $('#netbar').hidden = false;

  /** Modul mendaftar diri: N.register('buyer', {mount(root), route(segs)}) */
  N.register = (name, mod) => { mod.loaded = true; N.mods[name] = mod; };
  N.start = () => {
    if (!URL_OK) {
      shells.buyer.hidden = false;
      shells.buyer.innerHTML = '<div class="grid min-h-dvh place-items-center p-6"><div class="card max-w-md p-6 text-center"><div class="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-warn-bg text-warn">' + ic('alert', 'size-7') + '</div><h1 class="font-display text-xl font-bold text-deep">Konfigurasi belum lengkap</h1><p class="mt-2 text-sm text-muted">Isi <code class="rounded bg-tint px-1.5 py-0.5">GAS_URL</code> di <code class="rounded bg-tint px-1.5 py-0.5">js/config.js</code> dengan URL Web App Apps Script (berakhiran <code>/exec</code>), lalu muat ulang.</p></div></div>';
      hideSplash(); return;
    }
    route();
  };
  const boot = () => { if (N.mods.buyer) N.start(); else setTimeout(boot, 10); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
