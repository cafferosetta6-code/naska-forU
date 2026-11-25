/* NASKA — pos.js : Mode POS (kasir) untuk tablet. Tap menu → Bayar → pilih metode → konfirmasi → struk. */
(function () {
  'use strict';
  const { $, $$, esc, rp, ic, api, swr, Store, Sesi, toast, modal, jam, waktu } = N;
  const P = { boot: null, cart: {}, cat: 'Semua', root: null, timer: null, reqId: null, sig: '', inflight: false };
  const normWa = (s) => { s = String(s || '').replace(/[^\d+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s[0] === '0') s = '62' + s.slice(1); else if (s[0] === '8') s = '62' + s; return /^62\d{8,13}$/.test(s) ? s : null; };
  const menu = () => (P.boot ? P.boot.menu : []);
  const byId = (id) => menu().filter((m) => m.id_menu === id)[0];
  const lines = () => Object.keys(P.cart).map((id) => ({ m: byId(id), id: id, qty: P.cart[id] })).filter((l) => l.m);
  const total = () => lines().reduce((a, l) => a + l.m.harga * l.qty, 0);
  const qty = () => lines().reduce((a, l) => a + l.qty, 0);
  const tipeIcon = (t) => ({ 'QRIS': 'qr', 'Transfer Bank': 'bank', 'E-Wallet': 'phone', 'Cash': 'wallet' }[t] || 'wallet');
  const gagal = (r) => { if (r && r.code !== 'NET') toast(r.message, 'bad', 4500); };

  /* ============================== KERANGKA ============================== */
  function mount(root) {
    P.root = root;
    root.innerHTML = '<div class="flex h-dvh flex-col bg-tint/60">' +
      '<header class="no-print z-20 flex shrink-0 items-center gap-2 border-b border-line bg-white px-3 py-2.5 sm:gap-3 sm:px-5"><a href="#/admin" class="icon-btn" aria-label="Kembali ke admin">' + ic('left', 'size-6') + '</a>' + N.logoHtml('size-10 rounded-2xl bg-gradient-to-br from-sky to-ocean text-white') +
      '<div class="min-w-0 flex-1"><p class="truncate font-display text-lg font-extrabold leading-tight text-deep" data-brand-name>' + esc(N.brand.nama) + '</p><p class="text-xs font-semibold text-muted">Mode POS · <span data-tgl></span></p></div>' +
      '<span data-net class="pill pill-ok hidden sm:inline-flex"><span class="size-2 rounded-full bg-current"></span>Online</span>' +
      '<a href="#/admin/antrian" data-act-link class="btn btn-soft btn-sm relative">' + ic('bell', 'size-4') + '<span class="hidden sm:inline">Pesanan online</span><span data-online class="hidden min-w-5 rounded-full bg-sun px-1.5 text-center text-xs font-extrabold leading-5 text-ink"></span></a>' +
      '<button class="btn btn-soft btn-sm" data-act="riwayat">' + ic('history', 'size-4') + '<span class="hidden sm:inline">Riwayat</span></button><button class="icon-btn hidden sm:grid" data-act="layar" aria-label="Layar penuh">' + ic('grid', 'size-5') + '</button></header>' +
      '<div class="grid min-h-0 flex-1 lg:grid-cols-[1fr_25rem]"><section class="flex min-h-0 flex-col"><div class="no-scrollbar no-print flex shrink-0 gap-2 overflow-x-auto px-3 py-3 sm:px-5" data-cats role="tablist"></div><div class="min-h-0 flex-1 overflow-y-auto px-3 pb-28 sm:px-5 lg:pb-5" data-grid></div></section>' +
      '<aside class="no-print hidden min-h-0 flex-col border-l border-line bg-white lg:flex" data-cart></aside></div>' +
      '<div class="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 safe-b lg:hidden" data-mbar></div></div>';
    N.actions(root, {
      riwayat: () => riwayat(), layar: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); },
      add: (t) => add(t.dataset.id), inc: (t) => add(t.dataset.id), dec: (t) => dec(t.dataset.id),
      kat: (t) => { P.cat = t.dataset.v; paintCats(); paintGrid(); },
      kosongkan: async () => { if (qty() && (await N.confirm({ title: 'Kosongkan pesanan?', text: 'Semua item di keranjang dihapus.', ok: 'Kosongkan', danger: true }))) { P.cart = {}; P.reqId = null; paintAll(); } },
      bayar: () => bayar(), keranjang: () => sheetCart()
    });
    bindLongPress(root);
    window.addEventListener('online', netPill); window.addEventListener('offline', netPill);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && N.state.shell === 'pos') sinkron(); });
  }
  function netPill() { const p = $('[data-net]', P.root); if (!p) return; const on = navigator.onLine !== false; p.className = 'pill ' + (on ? 'pill-ok' : 'pill-bad') + ' hidden sm:inline-flex'; p.innerHTML = '<span class="size-2 rounded-full bg-current"></span>' + (on ? 'Online' : 'Offline'); if (!on) p.classList.remove('hidden'); }

  /* ============================== DATA ============================== */
  function apply(d) {
    const sig = JSON.stringify([d.menu.map((m) => [m.id_menu, m.nama, m.harga, m.sisa, m.foto_url, m.kategori]), d.metode.map((m) => m.id_metode), d.pos, d.counts]);
    P.boot = d; N.applyBrand({ nama_brand: d.brand.nama_brand, logo_url: d.brand.logo_url });
    Object.keys(P.cart).forEach((id) => { const m = byId(id); if (!m || m.sisa <= 0) delete P.cart[id]; else if (P.cart[id] > m.sisa) P.cart[id] = m.sisa; });
    if (sig !== P.sig) { P.sig = sig; paintAll(); } else paintHead();
  }
  function sinkron() { return swr('posBoot', 'adminPosBootstrap', {}, (d) => apply(d), { fresh: 0, alwaysRender: false, onError: (r) => { $('[data-grid]', P.root).innerHTML = '<div class="mx-auto mt-16 max-w-sm text-center"><p class="font-display text-lg font-bold text-deep">Belum bisa memuat menu</p><p class="mt-1 text-sm text-muted">' + esc(r.message) + '</p><button class="btn btn-primary mt-4" onclick="location.reload()">Coba lagi</button></div>'; } }); }
  async function segarkanSenyap() { if (document.hidden || N.state.shell !== 'pos' || P.inflight) return; const r = await api('adminPosBootstrap', {}, { silent: true }); if (r.success) { Store.set('c:a:posBoot', { t: Date.now(), h: N.hashStr(JSON.stringify(r.data)), v: N.VERSION, data: r.data }); apply(r.data); } }

  /* ============================== RENDER ============================== */
  function paintHead() {
    const o = $('[data-online]', P.root), c = (P.boot && P.boot.counts) || {}, n = (c.online_baru || 0) + (c.menunggu_konfirmasi || 0);
    if (o) { o.textContent = n; o.classList.toggle('hidden', !n); }
    const t = $('[data-tgl]', P.root); if (t && P.boot) t.textContent = N.tgl(P.boot.tanggal);
    netPill(); $$('[data-brand-name]', P.root).forEach((e) => (e.textContent = N.brand.nama));
  }
  function paintCats() {
    const cats = ['Semua'].concat(Array.from(new Set(menu().map((m) => m.kategori).filter(Boolean)))); if (cats.indexOf(P.cat) < 0) P.cat = 'Semua';
    $('[data-cats]', P.root).innerHTML = cats.map((k) => '<button role="tab" aria-selected="' + (k === P.cat) + '" class="chip !min-h-12 !px-5 ' + (k === P.cat ? 'on' : '') + '" data-act="kat" data-v="' + esc(k) + '">' + esc(k) + '</button>').join('');
  }
  function paintGrid() {
    const g = $('[data-grid]', P.root); if (!P.boot) { g.innerHTML = '<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">' + '<div class="skel h-44"></div>'.repeat(8) + '</div>'; return; }
    const L = menu().filter((m) => P.cat === 'Semua' || m.kategori === P.cat);
    g.innerHTML = L.length ? '<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">' + L.map((m) => {
      const q = P.cart[m.id_menu] || 0, habis = m.sisa <= 0;
      return '<button class="card relative flex min-h-[10.5rem] select-none flex-col items-center p-3 text-center transition active:scale-[.97] ' + (habis ? 'opacity-60' : 'hover:-translate-y-0.5') + '" data-act="add" data-id="' + esc(m.id_menu) + '" data-lp="' + esc(m.id_menu) + '"' + (habis ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(m.nama) + ', ' + rp(m.harga) + ', sisa ' + m.sisa + '">' +
        (q ? '<span data-qb class="absolute left-2 top-2 grid min-w-7 place-items-center rounded-full bg-ocean px-1.5 text-sm font-extrabold leading-7 text-white tnum animate-pop">' + q + '</span>' : '') + '<span class="pill ' + (habis ? 'pill-mute' : m.sisa <= 3 ? 'pill-sun' : 'pill-info') + ' absolute right-2 top-2 tnum">' + (habis ? 'Habis' : 'Sisa ' + m.sisa) + '</span>' +
        '<span class="mt-5 size-20 overflow-hidden rounded-full bg-tint ring-4 ring-tint ' + (habis ? 'grayscale' : '') + '">' + N.foto(m.foto_url, m.nama) + '</span><span class="mt-2 line-clamp-2 min-h-[2.5rem] font-display text-base font-bold leading-tight text-deep">' + esc(m.nama) + '</span><span class="font-display text-lg font-extrabold text-ocean tnum">' + rp(m.harga) + '</span></button>';
    }).join('') + '</div>' : '<div class="rounded-3xl bg-white p-10 text-center"><p class="font-display text-lg font-bold text-deep">Belum ada menu aktif</p><p class="mt-1 text-sm text-muted">Tambahkan menu dan stok di panel admin.</p></div>';
  }
  function cartBody(modalMode) {
    const L = lines();
    const rows = L.length ? '<ul class="divide-y divide-line">' + L.map((l) => '<li class="flex items-center gap-3 py-3"><span class="size-12 shrink-0 overflow-hidden rounded-2xl bg-tint">' + N.foto(l.m.foto_url, l.m.nama) + '</span><div class="min-w-0 flex-1"><p class="truncate font-semibold text-deep">' + esc(l.m.nama) + '</p><p class="text-xs text-muted tnum">' + rp(l.m.harga) + ' × ' + l.qty + ' = <b class="text-deep">' + rp(l.m.harga * l.qty) + '</b></p></div>' + stepper(l.id, l.qty) + '</li>').join('') + '</ul>'
      : '<div class="grid h-full place-items-center py-10 text-center"><div><div class="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-tint text-sky">' + ic('bag', 'size-8') + '</div><p class="font-display text-lg font-bold text-deep">Belum ada pesanan</p><p class="text-sm text-muted">Ketuk menu di sebelah kiri.</p></div></div>';
    return rows;
  }
  const stepper = (id, q) => '<div class="inline-flex items-center rounded-full border border-line bg-tint p-1"><button class="grid size-11 place-items-center rounded-full bg-white text-deep shadow-sm active:scale-90" data-act="dec" data-id="' + esc(id) + '" aria-label="Kurangi">' + ic('minus', 'size-5') + '</button><span class="w-9 text-center text-lg font-bold tnum" aria-live="polite">' + q + '</span><button class="grid size-11 place-items-center rounded-full bg-ocean text-white active:scale-90" data-act="inc" data-id="' + esc(id) + '" aria-label="Tambah">' + ic('plus', 'size-5') + '</button></div>';
  function paintCart() {
    const a = $('[data-cart]', P.root), t = total(), q = qty();
    a.innerHTML = '<div class="flex shrink-0 items-center justify-between border-b border-line px-5 py-4"><div><h2 class="font-display text-xl font-extrabold text-deep">Pesanan</h2><p class="text-xs font-semibold text-muted">' + q + ' item</p></div><button class="text-sm font-bold text-muted hover:text-bad disabled:opacity-40" data-act="kosongkan"' + (q ? '' : ' disabled') + '>Kosongkan</button></div><div class="min-h-0 flex-1 overflow-y-auto px-5">' + cartBody() + '</div>' +
      '<div class="shrink-0 border-t border-line p-5"><div class="mb-3 flex items-center justify-between"><span class="font-semibold text-muted">Total</span><span class="font-display text-3xl font-extrabold text-deep tnum">' + rp(t) + '</span></div><button class="btn btn-primary btn-xl w-full" data-act="bayar"' + (q ? '' : ' disabled') + '>Bayar' + (q ? ' · ' + rp(t) : '') + '</button></div>';
    $('[data-mbar]', P.root).innerHTML = '<button class="btn btn-primary btn-xl w-full justify-between" data-act="keranjang"' + (q ? '' : ' disabled') + '><span class="flex items-center gap-2">' + ic('bag', 'size-6') + (q ? q + ' item' : 'Pesanan kosong') + '</span><span class="tnum">' + rp(t) + '</span></button>';
    const m = modal.top(); if (m && m.el.dataset.pcart) { if (!q) m.close(); else { m.body.innerHTML = '<div class="px-5">' + cartBody() + '</div>'; m.footer.innerHTML = '<div class="mb-3 flex items-center justify-between"><span class="font-semibold text-muted">Total</span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(t) + '</span></div><button class="btn btn-primary btn-xl w-full" data-act="bayar">Bayar</button>'; } }
  }
  function paintAll() { paintHead(); paintCats(); paintGrid(); paintCart(); }
  function sheetCart() {
    if (!qty()) return; const m = modal.open({ title: 'Pesanan', size: 'bottom', body: '<div class="px-5">' + cartBody() + '</div>', footer: '<div class="mb-3 flex items-center justify-between"><span class="font-semibold text-muted">Total</span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(total()) + '</span></div><button class="btn btn-primary btn-xl w-full" data-act="bayar">Bayar</button>' });
    m.el.dataset.pcart = '1'; N.actions(m.el, { inc: (t) => add(t.dataset.id), dec: (t) => dec(t.dataset.id), bayar: () => { m.close(); bayar(); } });
  }
  function add(id) {
    const m = byId(id); if (!m) return; const n = P.cart[id] || 0;
    if (n >= m.sisa) return toast(m.sisa <= 0 ? m.nama + ' sudah habis.' : 'Stok ' + m.nama + ' tinggal ' + m.sisa + '.', 'warn', 1800);
    P.cart[id] = n + 1; P.reqId = null; paintCart(); updateCard(id);
  }
  function dec(id) { const n = (P.cart[id] || 0) - 1; if (n <= 0) delete P.cart[id]; else P.cart[id] = n; P.reqId = null; paintCart(); updateCard(id); }
  function updateCard(id) {
    const b = $('[data-grid] [data-lp="' + CSS.escape(id) + '"]', P.root); if (!b) return; const q = P.cart[id] || 0; let k = $('[data-qb]', b);
    if (q) { if (!k) { k = document.createElement('span'); k.setAttribute('data-qb', ''); k.className = 'absolute left-2 top-2 grid min-w-7 place-items-center rounded-full bg-ocean px-1.5 text-sm font-extrabold leading-7 text-white tnum animate-pop'; b.prepend(k); } k.textContent = q; } else if (k) k.remove();
  }

  /* ============================== TAHAN LAMA: KOREKSI STOK ============================== */
  function bindLongPress(root) {
    let t = null, moved = false, sx = 0, sy = 0, fired = false;
    root.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-lp]'); if (!b) return; moved = false; fired = false; sx = e.clientX; sy = e.clientY; t = setTimeout(() => { fired = true; if (navigator.vibrate) navigator.vibrate(30); koreksi(b.dataset.lp); }, 650); });
    root.addEventListener('pointermove', (e) => { if (t && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { moved = true; clearTimeout(t); t = null; } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => root.addEventListener(ev, () => { clearTimeout(t); t = null; }));
    root.addEventListener('click', (e) => { if (fired && e.target.closest('[data-lp]')) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
    root.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-lp]')) e.preventDefault(); });
  }
  function koreksi(id) {
    const m0 = byId(id); if (!m0) return;
    const md = modal.open({ title: 'Koreksi stok · ' + m0.nama, size: 'center', body: '<div class="grid gap-4 p-5"><div class="rounded-2xl bg-tint p-4 text-center"><p class="text-xs font-semibold text-muted">Sisa hari ini</p><p class="font-display text-5xl font-extrabold text-deep tnum" data-sisa>' + m0.sisa + '</p><p class="mt-1 text-xs text-muted">Stok ' + m0.stok + ' · Terjual/terpesan ' + m0.terpesan + '</p></div>' +
      '<div class="grid grid-cols-4 gap-2">' + [-5, -1, 1, 5].map((d) => '<button class="btn ' + (d < 0 ? 'btn-soft' : 'btn-primary') + ' btn-lg" data-d="' + d + '">' + (d > 0 ? '+' : '') + d + '</button>').join('') + '</div><p class="text-center text-xs text-muted">Menambah stok bila ada yang baru dibuat, mengurangi bila ada yang tumpah atau rusak.</p></div>' });
    md.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d;
      const r = await N.busy(b, '…', () => api('adminAdjustStok', { id_menu: id, delta: d })); if (!r) return;
      if (r.success) { const m = byId(id); m.stok = r.data.stok; m.terpesan = r.data.terpesan; m.sisa = r.data.sisa; $('[data-sisa]', md.el).textContent = m.sisa; paintGrid(); paintCart(); } else gagal(r);
    });
  }

  /* ============================== PEMBAYARAN ============================== */
  function bayar() {
    if (!qty()) return; if (!P.boot.metode.length) return toast('Belum ada metode pembayaran aktif. Atur di panel admin.', 'warn', 4000);
    P.reqId = P.reqId || N.uid();
    const pos = P.boot.pos, M = P.boot.metode, tot = total(), S = { metode: (M.filter((x) => x.tipe === 'Cash')[0] || M[0]).id_metode, uang: 0, nama: '', wa: '', catatan: '' };
    const cur = () => M.filter((x) => x.id_metode === S.metode)[0], cash = () => cur().tipe === 'Cash';
    const md = modal.open({ title: 'Pembayaran', size: 'center', wide: true, dismissable: false, body: '<div class="grid gap-6 p-5 md:grid-cols-2" data-pay></div>', footer: '<div class="grid gap-2 sm:grid-cols-[1fr_2fr]"><button class="btn btn-soft btn-lg" data-act="nanti">Simpan, bayar nanti</button><button class="btn btn-primary btn-xl" data-act="lunas">Konfirmasi Lunas</button></div>' });
    const root = $('[data-pay]', md.el);
    function kembali() { return S.uang - tot; }
    function paintDetail() {
      const m = cur(), box = $('[data-detail]', root);
      const nominal = '<div class="flex items-center justify-between rounded-2xl bg-tint p-3.5"><span class="text-sm font-semibold text-muted">Total bayar</span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(tot) + '</span></div>';
      if (m.tipe === 'Cash') {
        const q = pos.nominal_cepat || [];
        box.innerHTML = nominal + '<div class="mt-3"><label class="label" for="ps-u">Uang diterima</label><input id="ps-u" class="input !min-h-14 text-right font-display text-2xl font-bold tnum" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (S.uang ? S.uang.toLocaleString('id-ID') : '') + '"></div><div class="mt-3 flex flex-wrap gap-2"><button class="chip !min-h-12" data-act="pas">Uang Pas</button>' + q.map((n) => '<button class="chip !min-h-12 tnum" data-act="nom" data-n="' + n + '">' + rp(n) + '</button>').join('') + '</div><div class="mt-3 rounded-2xl p-4 text-center" data-kb></div>';
        const inp = $('#ps-u', box); N.moneyInput(inp, (n) => { S.uang = n; paintKb(); }); inp.dataset.val = S.uang; paintKb();
      } else if (m.tipe === 'QRIS') {
        box.innerHTML = nominal + '<div class="mt-3 grid place-items-center">' + (m.gambar_qr_url ? '<div class="w-60 max-w-full rounded-3xl border-2 border-line bg-white p-3"><img src="' + esc(m.gambar_qr_url) + '" alt="Kode QRIS" class="aspect-square w-full object-contain" data-foto></div>' : '<p class="rounded-2xl bg-warn-bg p-4 text-sm text-warn">Gambar QR belum diunggah.</p>') + '<p class="mt-2 text-center text-sm text-muted">Minta pelanggan memindai, lalu pastikan dana masuk sebelum menekan Konfirmasi Lunas.</p></div>';
      } else {
        box.innerHTML = nominal + '<div class="mt-3 flex items-center gap-3 rounded-2xl border border-line p-3.5"><span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white p-1 text-ocean">' + (m.logo_url ? '<img src="' + esc(m.logo_url) + '" alt="" class="size-full object-contain" data-foto>' : ic(tipeIcon(m.tipe), 'size-6')) + '</span><div class="min-w-0 flex-1"><p class="text-xs font-semibold text-muted">' + esc(m.nama_tampil) + (m.atas_nama ? ' · a.n. ' + esc(m.atas_nama) : '') + '</p><p class="truncate font-display text-xl font-extrabold tracking-wide text-deep tnum">' + esc(m.nomor) + '</p></div><button class="btn btn-soft btn-sm" data-act="salin" data-v="' + esc(m.nomor) + '">' + ic('copy', 'size-4') + 'Salin</button></div>' + (m.instruksi ? '<p class="mt-2 text-sm text-muted">' + esc(m.instruksi) + '</p>' : '');
      }
      cekTombol();
    }
    function paintKb() {
      const k = $('[data-kb]', root); if (!k) return; const d = kembali();
      if (!S.uang) { k.className = 'mt-3 rounded-2xl bg-tint p-4 text-center text-sm text-muted'; k.textContent = 'Masukkan uang yang diterima'; } else if (d >= 0) { k.className = 'mt-3 rounded-2xl bg-ok-bg p-4 text-center text-ok'; k.innerHTML = '<span class="text-sm font-semibold">Kembalian</span><span class="block font-display text-3xl font-extrabold tnum">' + rp(d) + '</span>'; } else { k.className = 'mt-3 rounded-2xl bg-bad-bg p-4 text-center text-bad'; k.innerHTML = '<span class="text-sm font-semibold">Uang kurang</span><span class="block font-display text-3xl font-extrabold tnum">' + rp(-d) + '</span>'; }
      cekTombol();
    }
    function cekTombol() { const b = $('[data-act="lunas"]', md.footer); b.disabled = cash() && S.uang < tot; b.innerHTML = 'Konfirmasi Lunas · ' + rp(tot); }
    function frame() {
      root.innerHTML = '<div class="grid content-start gap-4"><div><h3 class="font-display text-lg font-bold text-deep">Data pelanggan</h3><p class="text-xs text-muted">Boleh dikosongkan untuk pembeli umum.</p></div>' +
        A_fld('Nama', '<input id="ps-n" class="input !min-h-14" maxlength="60" autocomplete="off" placeholder="' + esc(pos.nama_default) + '">', 'ps-n') +
        A_fld('No. telepon / WhatsApp', '<input id="ps-w" class="input !min-h-14" inputmode="tel" autocomplete="off" placeholder="0812xxxxxxx">' + (pos.nomor_cepat ? '<button type="button" class="chip mt-2 !min-h-12" data-act="cepat">' + ic('phone', 'size-4') + 'Pakai nomor owner</button>' : ''), 'ps-w') + '<p class="err-text hidden" data-werr></p>' +
        A_fld('Catatan', '<input id="ps-c" class="input" maxlength="200" placeholder="Opsional, misal less sugar">', 'ps-c') +
        '<div class="rounded-2xl border border-line p-3"><p class="mb-1 text-xs font-bold text-muted">Ringkasan</p>' + lines().map((l) => '<p class="flex justify-between gap-2 text-sm"><span class="truncate">' + l.qty + '× ' + esc(l.m.nama) + '</span><b class="tnum">' + rp(l.m.harga * l.qty) + '</b></p>').join('') + '</div></div>' +
        '<div class="grid content-start gap-4"><div><h3 class="font-display text-lg font-bold text-deep">Metode pembayaran</h3></div><div class="grid grid-cols-2 gap-2" role="radiogroup" data-metode>' + M.map((m) => '<button type="button" role="radio" class="flex min-h-16 items-center gap-2.5 rounded-[18px] border-2 p-2.5 text-left transition" data-act="metode" data-id="' + esc(m.id_metode) + '"><span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white p-0.5 text-ocean">' + (m.logo_url ? '<img src="' + esc(m.logo_url) + '" alt="" class="size-full object-contain" data-foto>' : ic(tipeIcon(m.tipe), 'size-5')) + '</span><span class="min-w-0 text-sm font-bold leading-tight text-deep">' + esc(m.nama_tampil) + '</span></button>').join('') + '</div><div data-detail></div></div>';
      markMetode(); paintDetail();
    }
    const A_fld = (l, i, id) => '<div><label class="label" for="' + id + '">' + l + '</label>' + i + '</div>';
    function markMetode() { $$('[data-metode] button', root).forEach((b) => { const on = b.dataset.id === S.metode; b.setAttribute('aria-checked', on); b.className = 'flex min-h-16 items-center gap-2.5 rounded-[18px] border-2 p-2.5 text-left transition ' + (on ? 'border-ocean bg-tint' : 'border-line hover:bg-tint/60'); }); }
    frame();
    N.actions(md.el, {
      metode: (t) => { S.metode = t.dataset.id; markMetode(); paintDetail(); }, salin: (t) => N.copy(t.dataset.v),
      pas: () => { S.uang = tot; const i = $('#ps-u', root); i.value = tot.toLocaleString('id-ID'); i.dataset.val = tot; paintKb(); },
      nom: (t) => { S.uang = +t.dataset.n; const i = $('#ps-u', root); i.value = S.uang.toLocaleString('id-ID'); i.dataset.val = S.uang; paintKb(); },
      cepat: () => { $('#ps-w', root).value = N.tampilWa(pos.nomor_cepat); $('[data-werr]', root).classList.add('hidden'); },
      lunas: (t) => kirim(t, false), nanti: (t) => kirim(t, true)
    });
    async function kirim(btn, nanti) {
      const nama = $('#ps-n', root).value.trim(), waRaw = $('#ps-w', root).value.trim(), wa = normWa(waRaw), we = $('[data-werr]', root);
      if (wa === null) { we.textContent = 'Nomor tidak valid. Contoh 0812xxxxxxx atau kosongkan.'; we.classList.remove('hidden'); return $('#ps-w', root).focus(); }
      if (!nanti && cash() && S.uang < tot) return toast('Uang diterima kurang dari total.', 'warn');
      P.inflight = true;
      const payload = { items: lines().map((l) => ({ id_menu: l.id, qty: l.qty })), nama: nama, wa: wa, catatan: $('#ps-c', root).value.trim(), id_metode: nanti ? '' : S.metode, uang_diterima: !nanti && cash() ? S.uang : 0, bayar_nanti: !!nanti };
      const r = await N.busy(btn, 'Menyimpan…', () => api('adminCreatePosOrder', payload, { reqId: P.reqId })); P.inflight = false;
      if (!r) return;
      if (!r.success) { gagal(r); if (r.code === 'AUTH') md.close(); else if (r.code !== 'NET') { P.reqId = null; segarkanSenyap(); } return; }
      md.close(); P.reqId = null; const o = r.data.order; Object.keys(r.data.stok || {}).forEach((id) => { const m = byId(id); if (m) { m.sisa = r.data.stok[id]; } });
      P.cart = {}; paintAll(); struk(o, nanti); segarkanSenyap();
    }
    setTimeout(() => { const i = $('#ps-n', root); i && i.focus({ preventScroll: true }); }, 80);
    const tutup = $('[data-close]', md.el); if (tutup) tutup.addEventListener('click', () => {});
  }

  /* ============================== STRUK ============================== */
  function strukVars(o) { return { brand: P.boot.brand.nama_brand, nama: o.nama, kode: o.kode, total: rp(o.total), metode: o.metode ? o.metode.nama_tampil : (o.status_bayar === 'Lunas' ? '-' : 'Belum dibayar'), lokasi: '', items: o.items.map((i) => i.qty + '× ' + i.nama + ' ' + rp(i.subtotal)).join('\n') }; }
  function struk(o, nanti) {
    const sec = P.boot.pos.tutup_otomatis, b = P.boot.brand;
    const md = modal.open({ title: false, size: 'center', dismissable: false, body: '<div class="print-area p-5"><div class="grid place-items-center text-center"><span class="grid size-16 place-items-center rounded-full ' + (nanti ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok') + ' animate-pop">' + ic(nanti ? 'clock' : 'check', 'size-9') + '</span><h2 class="mt-3 font-display text-2xl font-extrabold text-deep">' + (nanti ? 'Tersimpan, belum dibayar' : 'Pembayaran berhasil') + '</h2><p class="font-display text-lg font-bold text-ocean tnum">' + esc(o.kode) + '</p></div>' +
      '<div class="ticket-cut my-4"></div><p class="text-center text-xs text-muted">' + esc(b.nama_brand) + ' · ' + esc(waktu(o.dibuat_pada)) + '</p><p class="mt-1 text-center font-semibold text-deep">' + esc(o.nama) + '</p>' +
      '<ul class="mt-3 grid gap-1.5 text-sm">' + o.items.map((i) => '<li class="flex justify-between gap-3"><span>' + i.qty + '× ' + esc(i.nama) + '</span><b class="tnum">' + rp(i.subtotal) + '</b></li>').join('') + '</ul><div class="ticket-cut my-4"></div>' +
      '<div class="grid gap-1 text-sm"><p class="flex justify-between"><span class="text-muted">Total</span><b class="font-display text-xl text-deep tnum">' + rp(o.total) + '</b></p>' + (o.metode ? '<p class="flex justify-between"><span class="text-muted">Metode</span><b>' + esc(o.metode.nama_tampil) + '</b></p>' : '') + (o.uang_diterima ? '<p class="flex justify-between"><span class="text-muted">Uang diterima</span><b class="tnum">' + rp(o.uang_diterima) + '</b></p><p class="flex justify-between"><span class="text-muted">Kembalian</span><b class="text-ok tnum">' + rp(o.kembalian) + '</b></p>' : '') + '</div>' + (b.catatan_footer ? '<p class="mt-4 text-center text-xs text-muted">' + esc(b.catatan_footer) + '</p>' : '') + '</div>',
      footer: '<div class="grid gap-2"><div class="grid grid-cols-2 gap-2">' + (o.wa ? '<button class="btn btn-wa" data-act="wa">' + ic('wa', 'size-5') + 'Kirim struk WA</button>' : '<button class="btn btn-soft" disabled>' + ic('wa', 'size-5') + 'Tanpa nomor</button>') + '<button class="btn btn-soft" data-act="cetak">' + ic('printer', 'size-5') + 'Cetak</button></div><button class="btn btn-primary btn-xl" data-act="baru">Pesanan Baru' + (sec ? ' <span class="opacity-80 tnum" data-cd></span>' : '') + '</button></div>' });
    let stop = null; const tutup = () => { stop && stop(); md.close(); };
    N.actions(md.el, { baru: tutup, cetak: () => { stop && stop(); const c = $('[data-cd]', md.el); c && (c.textContent = ''); window.print(); }, wa: () => { stop && stop(); window.open(N.waLink(o.wa, N.isiTemplate(b.template_struk, strukVars(o))), '_blank', 'noopener'); } });
    if (sec) { let s = sec; const c = $('[data-cd]', md.el); c.textContent = '(' + s + ')'; const iv = setInterval(() => { s--; if (md.closed) return clearInterval(iv); if (s <= 0) { clearInterval(iv); tutup(); } else c.textContent = '(' + s + ')'; }, 1000); stop = () => clearInterval(iv); md.el.addEventListener('pointerdown', () => { stop && stop(); const cc = $('[data-cd]', md.el); cc && (cc.textContent = ''); }, { once: true }); }
  }

  /* ============================== RIWAYAT ============================== */
  function riwayat() {
    let tab = 'hari', data = null;
    const md = modal.open({ title: 'Riwayat POS', size: 'right', body: '<div data-r class="p-4"><div class="skel h-64"></div></div>' });
    const root = $('[data-r]', md.el);
    const baris = (o) => '<li><button class="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left hover:bg-tint" data-act="rinci" data-k="' + o.kode + '"><div class="min-w-0 flex-1"><p class="font-display font-bold text-deep tnum">' + o.kode + ' <span class="text-xs font-medium text-muted">' + esc(jam(o.dibuat_pada)) + '</span></p><p class="truncate text-sm text-muted">' + esc(o.nama) + ' · ' + esc(o.items.map((i) => i.qty + '× ' + i.nama).join(', ')) + '</p></div><div class="text-right"><p class="font-bold tnum">' + rp(o.total) + '</p>' + N.pillBayar(o.status_bayar) + '</div></button></li>';
    function paint() {
      if (!data) return; const L = tab === 'hari' ? data.hari_ini : data.belum_dibayar, r = data.ringkas;
      root.innerHTML = '<div class="grid grid-cols-2 gap-3"><div class="rounded-2xl bg-tint p-3"><p class="text-xs font-semibold text-muted">Transaksi hari ini</p><p class="font-display text-2xl font-extrabold text-deep tnum">' + r.transaksi + '</p></div><div class="rounded-2xl bg-tint p-3"><p class="text-xs font-semibold text-muted">Omzet POS (lunas)</p><p class="font-display text-2xl font-extrabold text-ocean tnum">' + rp(r.omzet) + '</p></div></div>' +
        '<div class="seg mt-4 w-full"><button class="flex-1 ' + (tab === 'hari' ? 'on' : '') + '" data-act="tab" data-v="hari">Hari ini</button><button class="flex-1 ' + (tab === 'nanti' ? 'on' : '') + '" data-act="tab" data-v="nanti">Belum dibayar (' + data.belum_dibayar.length + ')</button></div>' +
        (L.length ? '<ul class="mt-4 grid gap-2">' + L.map(baris).join('') + '</ul>' : '<p class="mt-8 text-center text-sm text-muted">' + (tab === 'hari' ? 'Belum ada transaksi hari ini.' : 'Tidak ada tagihan yang tertunda.') + '</p>');
    }
    async function load() { const r = await api('adminPosHistory', {}); if (md.closed) return; if (r.success) { data = r.data; paint(); } else root.innerHTML = '<p class="p-6 text-center text-sm font-semibold text-bad">' + esc(r.message) + '</p>'; }
    N.actions(md.el, { tab: (t) => { tab = t.dataset.v; paint(); }, rinci: (t) => rinci(((data.hari_ini.concat(data.belum_dibayar)).filter((o) => o.kode === t.dataset.k))[0], load) });
    load();
  }
  function rinci(o, after) {
    if (!o) return; const tutup = o.status_order === 'Batal' || o.status_bayar === 'Kedaluwarsa', nanti = o.status_bayar !== 'Lunas' && !tutup;
    const md = modal.open({ title: o.kode, size: 'center', body: '<div class="grid gap-3 p-5"><div class="flex flex-wrap gap-2">' + N.pillBayar(o.status_bayar) + N.pillOrder(o.status_order) + '</div><p class="text-sm text-muted">' + esc(o.nama) + (o.wa ? ' · ' + esc(N.tampilWa(o.wa)) : '') + ' · ' + esc(waktu(o.dibuat_pada)) + '</p><ul class="grid gap-1.5 text-sm">' + o.items.map((i) => '<li class="flex justify-between"><span>' + i.qty + '× ' + esc(i.nama) + '</span><b class="tnum">' + rp(i.subtotal) + '</b></li>').join('') + '</ul><p class="flex justify-between border-t border-dashed border-line pt-3"><span class="font-semibold text-muted">Total</span><b class="font-display text-xl tnum">' + rp(o.total) + '</b></p>' + (o.alasan_batal ? '<p class="text-sm text-bad">Alasan batal: ' + esc(o.alasan_batal) + '</p>' : '') + '</div>',
      footer: tutup ? '' : '<div class="flex flex-wrap gap-2">' + (nanti ? '<button class="btn btn-primary flex-1" data-act="lunasi">Tandai Lunas</button>' : '') + (o.wa ? '<button class="btn btn-wa" data-act="wa">' + ic('wa', 'size-4') + '</button>' : '') + '<button class="btn btn-ghost !text-bad" data-act="batal">Batalkan</button></div>' });
    N.actions(md.el, {
      wa: () => window.open(N.waLink(o.wa, N.isiTemplate(P.boot.brand.template_struk, strukVars(o))), '_blank', 'noopener'),
      lunasi: () => lunasi(o, () => { md.close(); after(); segarkanSenyap(); }),
      batal: () => batal(o, () => { md.close(); after(); segarkanSenyap(); })
    });
  }
  function lunasi(o, done) {
    const M = P.boot.metode, S = { id: (M.filter((x) => x.tipe === 'Cash')[0] || M[0]).id_metode, uang: 0 };
    const md = modal.open({ title: 'Lunasi ' + o.kode, size: 'center', body: '<div class="grid gap-4 p-5"><div class="flex justify-between rounded-2xl bg-tint p-4"><span class="font-semibold text-muted">Total</span><b class="font-display text-2xl tnum">' + rp(o.total) + '</b></div><div class="grid grid-cols-2 gap-2" data-m>' + M.map((m) => '<button class="flex min-h-14 items-center gap-2 rounded-2xl border-2 p-2.5 text-left text-sm font-bold" data-id="' + esc(m.id_metode) + '">' + esc(m.nama_tampil) + '</button>').join('') + '</div><div data-cash><label class="label" for="ls-u">Uang diterima</label><input id="ls-u" class="input !min-h-14 text-right font-display text-2xl font-bold tnum" inputmode="numeric" placeholder="0"><p class="mt-2 text-sm font-semibold" data-kb></p></div></div>', footer: '<button class="btn btn-primary btn-xl w-full" data-ok>Konfirmasi Lunas</button>' });
    const mark = () => { $$('[data-m] button', md.el).forEach((b) => { const on = b.dataset.id === S.id; b.className = 'flex min-h-14 items-center gap-2 rounded-2xl border-2 p-2.5 text-left text-sm font-bold ' + (on ? 'border-ocean bg-tint' : 'border-line'); }); const c = M.filter((x) => x.id_metode === S.id)[0].tipe === 'Cash'; $('[data-cash]', md.el).hidden = !c; kb(); };
    const kb = () => { const c = M.filter((x) => x.id_metode === S.id)[0].tipe === 'Cash', k = $('[data-kb]', md.el); if (!c) { k.textContent = ''; return; } const d = S.uang - o.total; k.textContent = !S.uang ? '' : d >= 0 ? 'Kembalian ' + rp(d) : 'Uang kurang ' + rp(-d); k.className = 'mt-2 text-sm font-semibold ' + (d >= 0 ? 'text-ok' : 'text-bad'); };
    N.moneyInput($('#ls-u', md.el), (n) => { S.uang = n; kb(); }); mark();
    md.el.addEventListener('click', (e) => { const b = e.target.closest('[data-m] button'); if (b) { S.id = b.dataset.id; mark(); } });
    $('[data-ok]', md.footer).addEventListener('click', async (e) => {
      const c = M.filter((x) => x.id_metode === S.id)[0].tipe === 'Cash'; if (c && S.uang < o.total) return toast('Uang diterima kurang dari total.', 'warn');
      const r = await N.busy(e.currentTarget, 'Menyimpan…', () => api('adminPosPayLater', { kode: o.kode, id_metode: S.id, uang_diterima: c ? S.uang : 0 }));
      if (!r) return; if (r.success) { md.close(); toast('Pesanan ditandai lunas.', 'ok'); done(); } else gagal(r);
    });
  }
  function batal(o, done) {
    const md = modal.open({ title: 'Batalkan ' + o.kode + '?', size: 'center', body: '<div class="grid gap-3 p-5"><p class="text-sm text-muted">Stok dikembalikan otomatis.</p><label class="label" for="bt-a">Alasan</label><input id="bt-a" class="input" maxlength="160" placeholder="Contoh: salah input"></div>', footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>Kembali</button><button class="btn btn-danger flex-1" data-ok>Batalkan</button></div>' });
    $('[data-ok]', md.footer).addEventListener('click', async (e) => {
      const a = $('#bt-a', md.el).value.trim(); if (a.length < 3) return toast('Isi alasan pembatalan.', 'warn');
      const r = await N.busy(e.currentTarget, 'Membatalkan…', () => api('adminCancelOrder', { kode: o.kode, alasan: a })); if (!r) return;
      if (r.success) { md.close(); toast('Pesanan dibatalkan, stok dikembalikan.', 'ok'); done(); } else gagal(r);
    });
  }

  /* ============================== ROUTE ============================== */
  function route() {
    if (!Sesi.token) { Store.set('next', '#/pos'); return N.go('#/admin/login'); }
    document.title = 'POS — ' + N.brand.nama; paintHead(); if (!P.boot) { paintCats(); paintGrid(); paintCart(); }
    sinkron(); clearInterval(P.timer); P.timer = setInterval(segarkanSenyap, 30000);
  }
  window.addEventListener('hashchange', () => { if (N.state.shell !== 'pos') clearInterval(P.timer); });
  N.register('pos', { mount: mount, route: route });
})();
