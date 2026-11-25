/* NASKA — buyer.js : halaman pembeli (Menu, Keranjang, Checkout, Invoice, Lacak). */
(function () {
  'use strict';
  const { $, $$, esc, rp, ic, api, swr, Store, toast, modal, tgl, jam, waktu } = N;
  const PREF = ['Secepatnya', 'Istirahat setelah jam ke-1', 'Istirahat setelah jam ke-2', 'Istirahat setelah jam ke-3', 'Istirahat setelah jam ke-4', 'Istirahat setelah jam ke-5'];
  const S = { boot: null, cart: Store.get('cart', { tipe: 'Langsung', tanggal: '', items: {} }), cat: 'Semua', page: '', poll: null, co: null, root: null };
  if (!S.cart || typeof S.cart.items !== 'object') S.cart = { tipe: 'Langsung', tanggal: '', items: {} };

  const normWa = (s) => { s = String(s || '').replace(/[^\d+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s[0] === '0') s = '62' + s.slice(1); else if (s[0] === '8') s = '62' + s; return /^62\d{8,13}$/.test(s) ? s : null; };
  const saveCart = () => Store.set('cart', S.cart);
  const cfg = () => (S.boot ? S.boot.config : {});
  const menuById = (id) => (S.boot ? S.boot.menu.filter((m) => m.id_menu === id)[0] : null);
  function sisaOf(id) {
    if (!S.boot) return 0; const st = S.boot.stok || {};
    return S.cart.tipe === 'Langsung' ? ((st.langsung || {})[id] || 0) : (((st.preorder || {})[S.cart.tanggal] || {})[id] || 0);
  }
  function preDates() {
    const pre = (S.boot && S.boot.stok && S.boot.stok.preorder) || {};
    return Object.keys(pre).sort().filter((d) => Object.keys(pre[d]).some((k) => pre[d][k] > 0));
  }
  const cartLines = () => Object.keys(S.cart.items).map((id) => ({ m: menuById(id), id: id, qty: S.cart.items[id] })).filter((l) => l.m);
  const cartTotal = () => cartLines().reduce((a, l) => a + l.m.harga * l.qty, 0);
  const cartQty = () => cartLines().reduce((a, l) => a + l.qty, 0);
  const tokoBuka = () => !!(S.boot && S.boot.toko && S.boot.toko.buka);
  function bersihkanCart() {          // buang item yang sudah tidak ada / melebihi stok
    if (!S.boot) return; let ubah = false;
    Object.keys(S.cart.items).forEach((id) => { const m = menuById(id), s = sisaOf(id); if (!m || s <= 0) { delete S.cart.items[id]; ubah = true; } else if (S.cart.items[id] > s) { S.cart.items[id] = s; ubah = true; } });
    if (S.cart.tipe === 'Preorder') { const d = preDates(); if (!d.length) { S.cart.tipe = 'Langsung'; S.cart.items = {}; ubah = true; } else if (d.indexOf(S.cart.tanggal) === -1) { S.cart.tanggal = d[0]; ubah = true; } }
    if (ubah) saveCart();
  }

  /* ============================== SHELL ============================== */
  function mount(root) {
    S.root = root;
    root.innerHTML =
      '<div class="flex min-h-dvh flex-col bg-white">' +
      '<header class="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md"><div class="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5">' +
      '<a href="#/" class="flex min-w-0 items-center gap-2.5" aria-label="Beranda">' + N.logoHtml('size-10 rounded-2xl bg-gradient-to-br from-sky to-ocean text-white') + '<span class="truncate font-display text-xl font-extrabold text-deep" data-brand-name>' + esc(N.brand.nama) + '</span></a>' +
      '<nav class="ml-6 hidden items-center gap-1 lg:flex" aria-label="Utama"><a href="#/" data-nav="menu" class="rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-tint">Menu</a><a href="#/lacak" data-nav="lacak" class="rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-tint">Lacak Pesanan</a></nav>' +
      '<div class="ml-auto flex items-center gap-1"><button class="relative icon-btn lg:hidden" data-act="buka-cart" aria-label="Keranjang">' + ic('bag', 'size-6') + '<span data-cart-badge class="absolute right-1 top-1 hidden min-w-5 rounded-full bg-sun px-1 text-center text-[11px] font-extrabold leading-5 text-ink"></span></button>' +
      '<a href="#/admin" class="hidden rounded-full px-3 py-2 text-xs font-bold text-muted/70 hover:bg-tint hover:text-deep lg:inline-flex" aria-label="Masuk admin">Admin</a></div></div></header>' +
      '<main class="mx-auto w-full max-w-6xl flex-1 px-5 pb-40 lg:pb-16">' +
      '<section data-page="menu" hidden></section><section data-page="checkout" hidden></section><section data-page="invoice" hidden></section><section data-page="lacak" hidden></section></main>' +
      '<div data-cartbar hidden class="fixed inset-x-0 bottom-[4.6rem] z-30 px-4 lg:hidden"><button data-act="buka-cart" class="mx-auto flex w-full max-w-md items-center gap-3 rounded-full bg-ocean px-5 py-3.5 text-white animate-rise" style="box-shadow:0 14px 28px -10px color-mix(in srgb,var(--color-ocean) 70%,transparent)"><span class="relative">' + ic('bag', 'size-6') + '</span><span class="flex-1 text-left text-sm font-bold" data-cartbar-text></span><span class="font-display text-lg font-bold tnum" data-cartbar-total></span>' + ic('right', 'size-5') + '</button></div>' +
      '<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-b lg:hidden" aria-label="Navigasi bawah"><div class="mx-auto grid max-w-md grid-cols-3">' +
      navItem('menu', '#/', 'coffee', 'Menu') + '<button data-act="buka-cart" class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted">' + ic('bag', 'size-6') + 'Keranjang</button>' + navItem('lacak', '#/lacak', 'receipt', 'Pesanan') + '</div></nav></div>';
    N.actions(root, {
      'buka-cart': () => bukaCart()
    });
    S.pages = { menu: pageMenu(), checkout: pageCheckout(), invoice: pageInvoice(), lacak: pageLacak() };
    Object.keys(S.pages).forEach((k) => S.pages[k].init($('[data-page="' + k + '"]', root)));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.page && S.pages[S.page].resume) S.pages[S.page].resume(); });
  }
  const navItem = (k, href, icon, label) => '<a href="' + href + '" data-nav="' + k + '" class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted">' + ic(icon, 'size-6') + label + '</a>';

  function route(segs) {
    const name = segs[0] === 'checkout' ? 'checkout' : segs[0] === 'invoice' ? 'invoice' : segs[0] === 'lacak' ? 'lacak' : 'menu';
    if (S.page && S.page !== name && S.pages[S.page].hide) S.pages[S.page].hide();
    S.page = name;
    $$('[data-page]', S.root).forEach((el) => (el.hidden = el.dataset.page !== name));
    $$('[data-nav]', S.root).forEach((a) => { const on = a.dataset.nav === (name === 'invoice' ? 'lacak' : name); a.classList.toggle('text-ocean', on); a.classList.toggle('text-muted', !on); if (a.tagName === 'A' && a.closest('nav.hidden')) a.classList.toggle('bg-tint', on); });
    $('[data-cartbar]', S.root).hidden = !(name === 'menu' && cartQty() > 0);
    if (name !== 'menu') document.title = N.brand.nama;
    S.pages[name].show(segs.slice(1));
  }

  /* ============================== BOOT DATA ============================== */
  function applyBoot(d) {
    S.boot = d; N.applyBrand(d.config); N.Clock.sync(Date.parse(String(d.server.waktu).replace(' ', 'T') + '+07:00'));
    bersihkanCart(); updateCartUI();
    if (S.page === 'menu') S.pages.menu.paint(); else if (S.page === 'checkout') S.pages.checkout.refresh();
    if (S.pages.invoice && S.page === 'invoice') S.pages.invoice.refreshAlt();
  }
  function ensureBoot(force) {
    return swr('boot', 'publicBootstrap', {}, applyBoot, { fresh: force ? 0 : 20000, force: !!force, onError: (r) => { const el = $('[data-page="menu"]', S.root); if (el && !S.boot) el.innerHTML = errState(r.message); } });
  }
  const errState = (msg) => '<div class="mx-auto mt-16 max-w-sm text-center"><div class="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-bad-bg text-bad">' + ic('alert', 'size-8') + '</div><p class="font-display text-lg font-bold text-deep">Belum bisa memuat data</p><p class="mt-1 text-sm text-muted">' + esc(msg || 'Periksa koneksi internet kamu.') + '</p><button class="btn btn-primary mt-4" data-act="retry-boot">' + ic('refresh', 'size-4') + 'Coba lagi</button></div>';

  /* ============================== KERANJANG ============================== */
  function updateCartUI() {
    const q = cartQty(), t = cartTotal();
    $$('[data-cart-badge]', S.root).forEach((b) => { b.hidden = !q; b.classList.toggle('hidden', !q); b.textContent = q; });
    const bar = $('[data-cartbar]', S.root);
    if (bar) { bar.hidden = !(S.page === 'menu' && q > 0); $('[data-cartbar-text]', bar).textContent = q + ' item · ' + (S.cart.tipe === 'Preorder' ? 'Preorder' : 'Langsung'); $('[data-cartbar-total]', bar).textContent = rp(t); }
    const panel = $('[data-cartpanel]', S.root); if (panel) panel.innerHTML = cartHtml(true);
    const m = modal.top(); if (m && m.el.dataset.cart) { m.body.innerHTML = cartHtml(false); const f = m.footer; if (f) f.innerHTML = cartFooter(); }
  }
  function add(id) {
    const m = menuById(id); if (!m) return;
    if (S.cart.tipe === 'Langsung' && !tokoBuka()) return toast('Toko sedang tutup. Coba Preorder untuk besok.', 'warn');
    const s = sisaOf(id), now = S.cart.items[id] || 0;
    if (now >= s) return toast(s <= 0 ? m.nama + ' sudah habis.' : 'Stok ' + m.nama + ' tinggal ' + s + '.', 'warn');
    S.cart.items[id] = now + 1; saveCart(); updateCartUI(); paintCard(id, true);
  }
  function dec(id) {
    const n = (S.cart.items[id] || 0) - 1; if (n <= 0) delete S.cart.items[id]; else S.cart.items[id] = n;
    saveCart(); updateCartUI(); paintCard(id, true);
  }
  function kosongkan() { S.cart.items = {}; saveCart(); updateCartUI(); S.pages.menu.paint(); }
  function cartHtml(panel) {
    const L = cartLines();
    if (!L.length) return '<div class="px-5 py-10 text-center"><div class="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-tint text-sky">' + ic('bag', 'size-8') + '</div><p class="font-display text-lg font-bold text-deep">Keranjang masih kosong</p><p class="mt-1 text-sm text-muted">Pilih menu favoritmu dulu ya.</p></div>';
    const mode = '<div class="mb-3 flex items-center gap-2 text-sm"><span class="pill ' + (S.cart.tipe === 'Preorder' ? 'pill-sun' : 'pill-info') + '">' + esc(S.cart.tipe) + '</span>' + (S.cart.tipe === 'Preorder' ? '<span class="font-semibold text-deep">' + esc(tgl(S.cart.tanggal)) + '</span>' : '') + '</div>';
    const rows = L.map((l) => '<li class="flex items-center gap-3 py-3"><span class="size-14 shrink-0 overflow-hidden rounded-2xl bg-tint">' + N.foto(l.m.foto_url, l.m.nama) + '</span><div class="min-w-0 flex-1"><p class="truncate font-semibold text-deep">' + esc(l.m.nama) + '</p><p class="text-sm text-muted tnum">' + rp(l.m.harga) + '</p></div>' + stepper(l.id, l.qty) + '</li>').join('');
    return '<div class="' + (panel ? 'p-5' : 'px-5 py-3') + '">' + (panel ? '<div class="mb-1 flex items-center justify-between"><h2 class="font-display text-xl font-bold text-deep">Keranjang</h2><button class="text-sm font-semibold text-muted hover:text-bad" data-act="kosongkan">Kosongkan</button></div>' : '') + mode + '<ul class="divide-y divide-line">' + rows + '</ul>' +
      '<div class="mt-3 flex items-center justify-between border-t border-dashed border-line pt-4"><span class="font-semibold text-muted">Total</span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(cartTotal()) + '</span></div><p class="mt-1 text-xs text-muted">Antar ke kelas gratis, tanpa minimal belanja.</p>' +
      (panel ? '<button class="btn btn-primary btn-lg mt-4 w-full" data-act="checkout">Lanjut Checkout' + ic('right', 'size-5') + '</button>' : '') + '</div>';
  }
  const cartFooter = () => (cartQty() ? '<div class="flex gap-3"><button class="btn btn-soft" data-act="kosongkan">Kosongkan</button><button class="btn btn-primary btn-lg flex-1" data-act="checkout">Checkout · ' + rp(cartTotal()) + '</button></div>' : '<button class="btn btn-soft w-full" data-close>Pilih menu</button>');
  const stepper = (id, q) => '<div class="inline-flex items-center rounded-full border border-line bg-tint p-1"><button class="grid size-9 place-items-center rounded-full bg-white text-deep shadow-sm active:scale-90" data-act="dec" data-id="' + esc(id) + '" aria-label="Kurangi">' + ic('minus', 'size-4') + '</button><span class="w-9 text-center font-bold tnum" aria-live="polite">' + q + '</span><button class="grid size-9 place-items-center rounded-full bg-ocean text-white active:scale-90" data-act="inc" data-id="' + esc(id) + '" aria-label="Tambah">' + ic('plus', 'size-4') + '</button></div>';
  function bukaCart() {
    if (modal.top() && modal.top().el.dataset.cart) return;
    const m = modal.open({ title: 'Keranjang', size: 'bottom', body: cartHtml(false), footer: cartFooter() });
    m.el.dataset.cart = '1';
    N.actions(m.el, cartActs(m));
  }
  const cartActs = (m) => ({
    inc: (t) => add(t.dataset.id), dec: (t) => dec(t.dataset.id),
    kosongkan: async () => { if (await N.confirm({ title: 'Kosongkan keranjang?', text: 'Semua item akan dihapus.', ok: 'Kosongkan', danger: true })) kosongkan(); },
    checkout: () => { m && m.close(); N.go('#/checkout'); }
  });

  /* ============================== HALAMAN MENU ============================== */
  function pageMenu() {
    let el;
    const kategori = () => ['Semua'].concat(Array.from(new Set((S.boot ? S.boot.menu : []).map((m) => m.kategori).filter(Boolean))));
    function skeleton() { return '<div class="sky-hero -mx-5 mb-4 h-52 sm:mx-0 sm:rounded-b-[32px]"></div><div class="grid grid-cols-2 gap-3 lg:grid-cols-3">' + '<div class="skel h-56"></div>'.repeat(6) + '</div>'; }
    function paint() {
      if (!S.boot) return; const c = cfg(), q = cartQty();
      const buka = tokoBuka(), pre = preDates(), lang = S.cart.tipe === 'Langsung';
      const habisSemua = lang && buka && S.boot.menu.every((m) => !(S.boot.stok.langsung || {})[m.id_menu]);
      let banner = '';
      if (lang && !buka) banner = '<div class="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-warn-bg p-4 text-warn"><span class="shrink-0">' + ic('clock', 'size-6') + '</span><div class="min-w-0 flex-1"><p class="font-bold">Toko sedang tutup</p><p class="text-sm">' + (S.boot.toko.alasan === 'manual' ? 'Penjual menutup toko sementara.' : 'Buka setiap hari pukul ' + esc(c.jam_buka) + '–' + esc(c.jam_tutup) + ', selama stok ada.') + '</p></div>' + (pre.length ? '<button class="btn btn-sun btn-sm" data-act="mode" data-v="Preorder">Pesan Preorder</button>' : '') + '</div>';
      else if (habisSemua) banner = '<div class="mb-4 flex items-center gap-3 rounded-2xl bg-warn-bg p-4 text-warn">' + ic('alert', 'size-6') + '<div class="flex-1"><p class="font-bold">Stok hari ini habis</p><p class="text-sm">Kamu masih bisa Preorder untuk hari berikutnya.</p></div></div>';
      const dates = !lang ? '<div class="mb-4"><p class="mb-2 text-sm font-bold text-deep">Pilih tanggal ambil</p>' + (pre.length ? '<div class="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">' + pre.map((d) => '<button class="chip ' + (d === S.cart.tanggal ? 'on' : '') + '" data-act="tanggal" data-v="' + d + '">' + ic('calendar', 'size-4') + esc(tgl(d)) + '</button>').join('') + '</div><p class="hint">Preorder untuk besok ditutup pukul ' + esc(c.batas_preorder) + '.</p>' : '<div class="rounded-2xl bg-tint p-4 text-sm text-muted">Belum ada tanggal preorder yang dibuka. Cek lagi nanti ya.</div>') + '</div>' : '';
      const cats = kategori(); if (cats.indexOf(S.cat) === -1) S.cat = 'Semua';
      el.innerHTML =
        '<div class="sky-hero relative -mx-5 overflow-hidden px-5 pb-16 pt-8 text-white sm:mx-0 sm:mt-4 sm:rounded-[32px] sm:px-10 sm:pb-20 sm:pt-12">' +
        '<span class="cloud left-[-2rem] top-6 h-10 w-32 animate-float"></span><span class="cloud right-6 top-10 h-8 w-24 animate-float" style="animation-delay:-3s"></span><span class="cloud right-[30%] bottom-6 h-6 w-20 animate-float" style="animation-delay:-5s"></span>' +
        '<div class="relative max-w-xl"><div class="mb-3 flex flex-wrap gap-2"><span class="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-bold backdrop-blur">' + ic('clock', 'size-3.5') + esc(c.jam_buka) + '–' + esc(c.jam_tutup) + '</span><span class="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-bold backdrop-blur">' + ic('pin', 'size-3.5') + 'Lapak Gedung LIPIA</span></div>' +
        '<h1 class="font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">' + esc(c.tagline || 'Kopi siap, tinggal ambil') + '</h1><p class="mt-3 max-w-md text-[15px] text-white/90">Pilih kopimu, bayar mudah, ambil di lapak atau diantar gratis sampai kelas.</p></div></div>' +
        '<div class="relative -mt-10 grid gap-6 lg:grid-cols-[1fr_22rem]"><div class="min-w-0">' +
        '<div class="card relative z-10 mb-5 flex flex-wrap items-center justify-between gap-3 p-3"><div class="seg" role="tablist" aria-label="Mode pesan"><button role="tab" aria-selected="' + lang + '" class="' + (lang ? 'on' : '') + '" data-act="mode" data-v="Langsung">Langsung</button><button role="tab" aria-selected="' + !lang + '" class="' + (!lang ? 'on' : '') + '" data-act="mode" data-v="Preorder">Preorder</button></div><p class="px-2 text-xs text-muted sm:text-sm">' + (lang ? 'Beli hari ini selama stok ada' : 'Pesan untuk hari berikutnya') + '</p></div>' +
        banner + dates +
        '<div class="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Kategori">' + cats.map((k) => '<button role="tab" class="chip ' + (k === S.cat ? 'on' : '') + '" data-act="kat" data-v="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>' +
        '<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" data-grid></div></div>' +
        '<aside class="hidden lg:block"><div class="card sticky top-24" data-cartpanel></div></aside></div>';
      paintGrid(); updateCartUI();
    }
    function cardHtml(m) {
      const s = sisaOf(m.id_menu), n = S.cart.items[m.id_menu] || 0, habis = s <= 0, tutup = S.cart.tipe === 'Langsung' && !tokoBuka();
      const pill = habis ? '<span class="pill pill-mute absolute right-2.5 top-2.5">Habis</span>' : '<span class="pill ' + (s <= 3 ? 'pill-sun' : 'pill-info') + ' absolute right-2.5 top-2.5">Sisa ' + s + '</span>';
      return '<article class="card relative flex flex-col items-center p-3 pb-4 text-center ' + (habis ? 'opacity-70' : '') + '" data-card="' + esc(m.id_menu) + '">' + pill +
        '<span class="mt-5 size-28 overflow-hidden rounded-full bg-tint ring-4 ring-tint sm:size-32 ' + (habis ? 'grayscale' : '') + '">' + N.foto(m.foto_url, m.nama) + '</span>' +
        '<h3 class="mt-3 line-clamp-2 min-h-[2.6rem] font-display text-[17px] font-bold leading-tight text-deep">' + esc(m.nama) + '</h3>' +
        (m.deskripsi ? '<p class="mt-0.5 line-clamp-1 text-xs text-muted">' + esc(m.deskripsi) + '</p>' : '') +
        '<p class="mt-1 font-display text-lg font-extrabold text-ocean tnum">' + rp(m.harga) + '</p><div class="mt-3 flex min-h-11 w-full items-center justify-center" data-ctl>' + ctlHtml(m, n, habis, tutup) + '</div></article>';
    }
    const ctlHtml = (m, n, habis, tutup) => habis ? '<span class="text-sm font-bold text-muted">Habis</span>' : n > 0 ? stepper(m.id_menu, n) : '<button class="btn btn-primary btn-sm w-full max-w-[10rem]" data-act="inc" data-id="' + esc(m.id_menu) + '"' + (tutup ? ' aria-disabled="true"' : '') + '>' + ic('plus', 'size-4') + 'Tambah</button>';
    function paintGrid() {
      const g = $('[data-grid]', el); if (!g) return;
      const list = S.boot.menu.filter((m) => S.cat === 'Semua' || m.kategori === S.cat);
      g.innerHTML = list.length ? list.map(cardHtml).join('') : '<div class="col-span-full rounded-3xl bg-tint p-10 text-center"><div class="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white text-sky">' + ic('coffee', 'size-7') + '</div><p class="font-display text-lg font-bold text-deep">Menu belum tersedia</p><p class="text-sm text-muted">Penjual belum menambahkan menu di kategori ini.</p></div>';
    }
    function init(root) {
      el = root; el.innerHTML = skeleton();
      N.actions(el, {
        inc: (t) => add(t.dataset.id), dec: (t) => dec(t.dataset.id), kosongkan: async () => { if (await N.confirm({ title: 'Kosongkan keranjang?', text: 'Semua item akan dihapus.', ok: 'Kosongkan', danger: true })) kosongkan(); },
        checkout: () => N.go('#/checkout'),
        kat: (t) => { S.cat = t.dataset.v; paint(); },
        tanggal: (t) => { if (S.cart.tanggal !== t.dataset.v) { S.cart.tanggal = t.dataset.v; saveCart(); bersihkanCart(); paint(); } },
        mode: async (t) => {
          const v = t.dataset.v; if (v === S.cart.tipe) return;
          if (cartQty() > 0 && !(await N.confirm({ title: 'Ganti mode pesan?', text: 'Keranjang akan dikosongkan karena stok Langsung dan Preorder berbeda.', ok: 'Ganti mode' }))) return;
          S.cart = { tipe: v, tanggal: v === 'Preorder' ? (preDates()[0] || '') : '', items: {} }; saveCart(); paint();
        },
        'retry-boot': () => { el.innerHTML = skeleton(); ensureBoot(true); }
      });
    }
    function paintCard(id) {
      const c = $('[data-card="' + CSS.escape(id) + '"]', el); const m = menuById(id); if (!c || !m) return paint();
      const n = S.cart.items[id] || 0, habis = sisaOf(id) <= 0, tutup = S.cart.tipe === 'Langsung' && !tokoBuka();
      const ctl = $('[data-ctl]', c); const ae = document.activeElement, keep = ae && ae.closest && ae.closest('[data-card]') === c ? ae.dataset.act : '';
      ctl.innerHTML = ctlHtml(m, n, habis, tutup);
      if (keep) { const b = $('[data-act="' + keep + '"]', ctl) || $('[data-act="inc"]', ctl); b && b.focus({ preventScroll: true }); }
      const q = $('span.tnum', ctl); if (q) q.classList.add('qty-bump');
    }
    window.paintCard = paintCard;
    let timer = null;
    const poll = async () => {
      if (S.page !== 'menu' || document.hidden) return;
      const r = await api('getStok', {}, { silent: true });
      if (r.success && S.boot) { S.boot.stok = r.data.stok; S.boot.toko = r.data.toko; N.Clock.sync(Date.parse(String(r.data.server.waktu).replace(' ', 'T') + '+07:00')); bersihkanCart(); paint(); }
    };
    return {
      init: init, paint: paint,
      show() {
        document.title = N.brand.nama + ' — ' + (N.brand.tagline || 'Pesan kopi');
        if (S.boot) paint(); ensureBoot();
        clearInterval(timer); timer = setInterval(poll, 30000);
      },
      hide() { clearInterval(timer); },
      resume() { ensureBoot(); }
    };
  }
  function paintCard(id) { window.paintCard && window.paintCard(id); }

  /* ============================== CHECKOUT ============================== */
  function pageCheckout() {
    let el; const F = { nama: '', wa: '', cara: 'Ambil', gedung: '', lantai: '', id_lokasi: '', pref: PREF[0], catatan: '', metode: '', step: 1, reqId: null, err: {} };
    const saved = Store.get('buyer', {}); F.nama = saved.nama || ''; F.wa = saved.wa || '';
    function summary() {
      const L = cartLines();
      return '<div class="card p-5"><h2 class="font-display text-lg font-bold text-deep">Ringkasan pesanan</h2><div class="mt-1 flex items-center gap-2 text-sm"><span class="pill ' + (S.cart.tipe === 'Preorder' ? 'pill-sun' : 'pill-info') + '">' + esc(S.cart.tipe) + '</span>' + (S.cart.tipe === 'Preorder' ? '<span class="font-semibold text-deep">' + esc(tgl(S.cart.tanggal)) + '</span>' : '') + '</div><ul class="mt-3 divide-y divide-line">' +
        L.map((l) => '<li class="flex items-center justify-between gap-3 py-2.5 text-sm"><span class="min-w-0"><span class="font-semibold text-deep">' + l.qty + '×</span> ' + esc(l.m.nama) + '</span><span class="font-semibold tnum">' + rp(l.m.harga * l.qty) + '</span></li>').join('') + '</ul>' +
        (F.cara === 'Antar' ? '<div class="mt-2 flex justify-between text-sm text-muted"><span>Ongkos antar</span><span class="font-bold text-ok">Gratis</span></div>' : '') + '<div class="mt-3 flex items-center justify-between border-t border-dashed border-line pt-3"><span class="font-semibold text-muted">Total</span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(cartTotal()) + '</span></div></div>';
    }
    const field = (k, label, inner) => '<div><label class="label" for="co-' + k + '">' + label + '</label>' + inner + (F.err[k] ? '<p class="err-text" role="alert">' + esc(F.err[k]) + '</p>' : '') + '</div>';
    function lokasiSel() {
      const lok = (S.boot && S.boot.lokasi) || [], gedung = Array.from(new Set(lok.map((l) => l.gedung)));
      const lantai = Array.from(new Set(lok.filter((l) => l.gedung === F.gedung).map((l) => l.lantai)));
      const kelas = lok.filter((l) => l.gedung === F.gedung && l.lantai === F.lantai);
      const opt = (arr, cur, ph, val) => '<option value="">' + ph + '</option>' + arr.map((a) => { const v = val ? val(a) : a; return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(val ? a.kelas : a) + '</option>'; }).join('');
      return '<div class="grid gap-3 sm:grid-cols-3">' + field('gedung', 'Gedung', '<select id="co-gedung" class="input ' + (F.err.gedung ? 'err' : '') + '" data-f="gedung">' + opt(gedung, F.gedung, 'Pilih gedung') + '</select>') +
        field('lantai', 'Lantai', '<select id="co-lantai" class="input" data-f="lantai"' + (F.gedung ? '' : ' disabled') + '>' + opt(lantai, F.lantai, 'Pilih lantai') + '</select>') +
        field('id_lokasi', 'Kelas', '<select id="co-id_lokasi" class="input ' + (F.err.id_lokasi ? 'err' : '') + '" data-f="id_lokasi"' + (F.lantai ? '' : ' disabled') + '>' + opt(kelas, F.id_lokasi, 'Pilih kelas', (l) => l.id_lokasi) + '</select>') + '</div>';
    }
    function metodeCards() {
      const M = (S.boot && S.boot.metode) || [];
      if (!M.length) return '<div class="rounded-2xl bg-warn-bg p-4 text-sm text-warn">Belum ada metode pembayaran aktif. Hubungi penjual.</div>';
      return '<div class="grid gap-3" role="radiogroup" aria-label="Metode pembayaran">' + M.map((m) => '<button type="button" role="radio" aria-checked="' + (F.metode === m.id_metode) + '" data-act="metode" data-id="' + esc(m.id_metode) + '" class="flex min-h-[4.5rem] items-center gap-4 rounded-[20px] border-2 p-3.5 text-left transition active:scale-[.99] ' + (F.metode === m.id_metode ? 'border-ocean bg-tint' : 'border-line bg-white hover:bg-tint/60') + '"><span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white p-1 text-ocean">' + (m.logo_url ? '<img src="' + esc(m.logo_url) + '" alt="" class="size-full object-contain" data-foto>' : ic(tipeIcon(m.tipe), 'size-6')) + '</span><span class="min-w-0 flex-1"><span class="block truncate font-bold text-deep">' + esc(m.nama_tampil) + '</span><span class="block text-xs text-muted">' + esc(m.tipe) + (m.tipe === 'Cash' ? (F.cara === 'Ambil' ? ' · bayar di lapak' : ' · bayar saat terima') : '') + '</span></span><span class="grid size-6 place-items-center rounded-full border-2 ' + (F.metode === m.id_metode ? 'border-ocean bg-ocean text-white' : 'border-line') + '">' + (F.metode === m.id_metode ? ic('check', 'size-3.5') : '') + '</span></button>').join('') + '</div>';
    }
    function paint() {
      if (!S.boot) { el.innerHTML = '<div class="skel mt-6 h-96"></div>'; return; }
      if (!cartQty()) { el.innerHTML = '<div class="mx-auto mt-16 max-w-sm text-center"><div class="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-tint text-sky">' + ic('bag', 'size-8') + '</div><p class="font-display text-lg font-bold text-deep">Keranjang kosong</p><a href="#/" class="btn btn-primary mt-4">Pilih menu</a></div>'; return; }
      const s1 = F.step === 1;
      const step = (n, t) => '<div class="flex items-center gap-2 ' + (F.step >= n ? 'text-ocean' : 'text-muted') + '"><span class="grid size-7 place-items-center rounded-full text-sm font-extrabold ' + (F.step >= n ? 'bg-ocean text-white' : 'bg-line text-muted') + '">' + (F.step > n ? ic('check', 'size-4') : n) + '</span><span class="text-sm font-bold">' + t + '</span></div>';
      el.innerHTML = '<div class="pt-5"><a href="#/" class="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-deep">' + ic('left', 'size-4') + 'Kembali ke menu</a><h1 class="font-display text-3xl font-extrabold text-deep">Checkout</h1>' +
        '<div class="mt-4 flex items-center gap-3">' + step(1, 'Data & penerimaan') + '<span class="h-0.5 w-8 rounded bg-line"></span>' + step(2, 'Pembayaran') + '</div>' +
        '<div class="mt-5 grid gap-6 lg:grid-cols-[1fr_22rem]"><div class="card p-5 sm:p-6" data-form>' + (s1 ? step1() : step2()) + '</div><aside class="lg:sticky lg:top-24 lg:self-start">' + summary() + '</aside></div></div>';
    }
    function step1() {
      const antar = F.cara === 'Antar', lapak = F.cara === 'Ambil' && S.cart.tipe === 'Langsung';
      return '<div class="grid gap-4">' + field('nama', 'Nama', '<input id="co-nama" class="input ' + (F.err.nama ? 'err' : '') + '" data-f="nama" autocomplete="name" placeholder="Nama kamu" value="' + esc(F.nama) + '" maxlength="60">') +
        field('wa', 'Nomor WhatsApp', '<input id="co-wa" class="input ' + (F.err.wa ? 'err' : '') + '" data-f="wa" inputmode="tel" autocomplete="tel" placeholder="0812xxxxxxx" value="' + esc(F.wa) + '" maxlength="20"><p class="hint">Dipakai penjual untuk konfirmasi pesanan.</p>') +
        '<div><span class="label">Cara terima</span><div class="grid grid-cols-2 gap-3" role="radiogroup">' +
        ['Ambil', 'Antar'].map((c) => '<button type="button" role="radio" aria-checked="' + (F.cara === c) + '" data-act="cara" data-v="' + c + '" class="flex min-h-16 items-center gap-3 rounded-[20px] border-2 p-3 text-left transition ' + (F.cara === c ? 'border-ocean bg-tint' : 'border-line hover:bg-tint/60') + '"><span class="grid size-10 place-items-center rounded-xl ' + (F.cara === c ? 'bg-ocean text-white' : 'bg-line text-deep') + '">' + ic(c === 'Ambil' ? 'store' : 'truck', 'size-5') + '</span><span><span class="block font-bold text-deep">' + (c === 'Ambil' ? 'Ambil di lapak' : 'Antar ke kelas') + '</span><span class="block text-xs ' + (c === 'Antar' ? 'font-bold text-ok' : 'text-muted') + '">' + (c === 'Ambil' ? 'Tanpa biaya' : 'Gratis') + '</span></span></button>').join('') + '</div></div>' +
        (lapak ? '<div class="flex gap-3 rounded-2xl bg-tint p-3.5 text-sm text-deep">' + ic('store', 'size-5 shrink-0 text-ocean') + '<p><b>Bayar di lapak.</b> Produk sudah ada dan langsung diserahkan setelah penjual memastikan pembayaran masuk, tanpa menunggu disiapkan.</p></div>' : '') +
        (antar ? '<div class="rounded-[20px] bg-tint/70 p-4"><p class="mb-3 flex items-center gap-2 text-sm font-bold text-deep">' + ic('pin', 'size-4') + 'Lokasi pengantaran</p>' + lokasiSel() +
          '<div class="mt-3">' + field('pref', 'Preferensi waktu antar', '<select id="co-pref" class="input" data-f="pref">' + PREF.map((p) => '<option' + (p === F.pref ? ' selected' : '') + '>' + p + '</option>').join('') + '</select><p class="hint">Hanya informasi untuk pengantar, bukan jadwal pasti.</p>') + '</div></div>' : '') +
        field('catatan', 'Catatan (opsional)', '<textarea id="co-catatan" class="input" data-f="catatan" maxlength="200" placeholder="Contoh: less sugar, duduk di baris belakang">' + esc(F.catatan) + '</textarea>') +
        '<button class="btn btn-primary btn-lg w-full" data-act="lanjut">Lanjut ke pembayaran' + ic('right', 'size-5') + '</button></div>';
    }
    function step2() {
      return '<div class="grid gap-5"><div><h2 class="font-display text-xl font-bold text-deep">Pilih metode pembayaran</h2><p class="text-sm text-muted">' + (F.cara === 'Ambil' && S.cart.tipe === 'Langsung' ? 'Setelah pesanan dibuat, kode pembayaran langsung tampil. Pesananmu diserahkan begitu penjual memastikan dana masuk.' : 'Detail pembayaran muncul di invoice setelah pesanan dibuat.') + '</p></div>' + metodeCards() + (F.err.metode ? '<p class="err-text" role="alert">' + esc(F.err.metode) + '</p>' : '') +
        '<div class="flex gap-3"><button class="btn btn-soft" data-act="balik">' + ic('left', 'size-4') + 'Kembali</button><button class="btn btn-primary btn-lg flex-1" data-act="buat">Buat Pesanan · ' + rp(cartTotal()) + '</button></div></div>';
    }
    function validasi1() {
      const e = {}; const n = normWa(F.wa);
      if (F.nama.trim().length < 2) e.nama = 'Isi nama minimal 2 huruf.';
      if (!n) e.wa = 'Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxx.';
      if (F.cara === 'Antar') { if (!F.gedung) e.gedung = 'Pilih gedung.'; if (!F.id_lokasi) e.id_lokasi = 'Pilih kelas.'; }
      F.err = e; return !Object.keys(e).length;
    }
    function init(root) {
      el = root;
      el.addEventListener('input', (e) => { const f = e.target.dataset && e.target.dataset.f; if (!f) return; F[f] = e.target.value; if (F.err[f]) { delete F.err[f]; const er = e.target.parentElement.querySelector('.err-text'); er && er.remove(); e.target.classList.remove('err'); } });
      el.addEventListener('change', (e) => {
        const f = e.target.dataset && e.target.dataset.f; if (!f) return;
        F[f] = e.target.value;
        if (f === 'gedung') { F.lantai = ''; F.id_lokasi = ''; refreshLokasi(); } else if (f === 'lantai') { F.id_lokasi = ''; refreshLokasi(); }
      });
      N.actions(el, {
        cara: (t) => { F.cara = t.dataset.v; paint(); },
        lanjut: () => { if (validasi1()) { Store.set('buyer', { nama: F.nama.trim(), wa: F.wa.trim() }); F.step = 2; paint(); window.scrollTo(0, 0); } else { paint(); const bad = $('.input.err', el); bad && bad.focus(); } },
        balik: () => { F.step = 1; paint(); },
        metode: (t) => { F.metode = t.dataset.id; delete F.err.metode; paint(); },
        buat: (t) => buat(t)
      });
    }
    function refreshLokasi() { const box = $('[data-form] .rounded-\\[20px\\].bg-tint\\/70', el); if (!box) return paint(); const w = box.querySelector('.grid'); w.outerHTML = lokasiSel(); }
    async function buat(btn) {
      if (!F.metode) { F.err.metode = 'Pilih salah satu metode pembayaran.'; return paint(); }
      F.reqId = F.reqId || N.uid();
      const items = cartLines().map((l) => ({ id_menu: l.id, qty: l.qty }));
      const payload = { nama: F.nama.trim(), wa: F.wa.trim(), tipe: S.cart.tipe, tanggal: S.cart.tanggal, cara_terima: F.cara, id_lokasi: F.cara === 'Antar' ? F.id_lokasi : '', pref_antar: F.cara === 'Antar' ? F.pref : '', catatan: F.catatan.trim(), id_metode: F.metode, items: items };
      const r = await N.busy(btn, 'Membuat pesanan…', () => api('createOrder', payload, { reqId: F.reqId }));
      if (!r) return;
      if (!r.success) {
        if (r.code === 'NET') return;
        toast(r.message, 'bad', 4500);
        if (['STOK', 'MENU', 'TUTUP', 'BATAS'].indexOf(r.code) > -1) { F.reqId = null; await ensureBoot(true); N.go('#/'); }
        else if (r.code === 'LIMIT') F.reqId = null;
        return;
      }
      const d = r.data, list = Store.get('orders', []).filter((o) => o.kode !== d.kode); list.unshift({ kode: d.kode, key: d.key, t: Date.now(), nama: payload.nama, total: d.order.total });
      Store.set('orders', list.slice(0, 30)); Store.set('c:' + 'inv:' + d.kode, { order: d.order });
      F.reqId = null; F.step = 1; F.metode = ''; S.cart.items = {}; saveCart(); updateCartUI();
      N.go('#/invoice/' + d.kode + '/' + d.key);
    }
    return { init: init, refresh: paint, show() { F.err = {}; ensureBoot().then(() => { if (S.page === 'checkout') paint(); }); if (S.boot) paint(); else paint(); document.title = 'Checkout — ' + N.brand.nama; }, hide() {} };
  }
  const tipeIcon = (t) => ({ 'QRIS': 'qr', 'Transfer Bank': 'bank', 'E-Wallet': 'phone', 'Cash': 'wallet' }[t] || 'wallet');

  /* ============================== INVOICE ============================== */
  function pageInvoice() {
    let el, cur = null, timer = null, kode = '', key = '', stopCd = null;
    const final = (o) => o.status_order === 'Selesai' || o.status_order === 'Batal' || o.status_bayar === 'Kedaluwarsa';
    const TL = ['Baru', 'Diproses', 'Siap', 'Selesai'], TLL = ['Dipesan', 'Dibayar', 'Diserahkan'];
    function paymentBlock(o) {
      const m = o.metode; if (!m) return '';
      const nominal = '<div class="flex items-center justify-between gap-3 rounded-2xl bg-tint p-3.5"><span class="text-sm font-semibold text-muted">Nominal bayar</span><span class="flex items-center gap-2"><span class="font-display text-xl font-extrabold text-deep tnum">' + rp(o.total) + '</span><button class="icon-btn !size-9" data-act="salin" data-v="' + o.total + '" aria-label="Salin nominal">' + ic('copy', 'size-4') + '</button></span></div>';
      let body = '';
      if (m.tipe === 'QRIS') body = (m.gambar_qr_url ? '<div class="mx-auto w-64 max-w-full rounded-3xl border-2 border-line bg-white p-3"><img src="' + esc(m.gambar_qr_url) + '" alt="Kode QRIS" class="aspect-square w-full object-contain" data-foto></div>' : '<div class="rounded-2xl bg-warn-bg p-4 text-sm text-warn">Gambar QR belum tersedia. Pilih cara bayar lain atau hubungi penjual.</div>') + '<p class="text-center text-sm text-muted">Pindai dengan aplikasi bank atau e-wallet apa pun.</p>' + nominal;
      else if (m.tipe === 'Cash') body = '<div class="rounded-2xl bg-tint p-4 text-sm text-deep">' + esc(m.instruksi || 'Bayar tunai saat pesanan diterima.') + '</div>' + nominal;
      else body = '<div class="flex items-center gap-3 rounded-2xl border border-line p-3.5"><span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white p-1 text-ocean">' + (m.logo_url ? '<img src="' + esc(m.logo_url) + '" alt="" class="size-full object-contain" data-foto>' : ic(tipeIcon(m.tipe), 'size-6')) + '</span><div class="min-w-0 flex-1"><p class="text-xs font-semibold text-muted">' + esc(m.nama_tampil) + (m.atas_nama ? ' · a.n. ' + esc(m.atas_nama) : '') + '</p><p class="truncate font-display text-xl font-extrabold tracking-wide text-deep tnum">' + esc(m.nomor) + '</p></div><button class="btn btn-soft btn-sm" data-act="salin" data-v="' + esc(m.nomor) + '">' + ic('copy', 'size-4') + 'Salin</button></div>' + nominal + (m.instruksi ? '<p class="text-sm text-muted">' + esc(m.instruksi) + '</p>' : '');
      return '<section class="grid gap-3"><h3 class="font-display text-lg font-bold text-deep">Cara pembayaran · ' + esc(m.nama_tampil) + '</h3>' + body + '</section>';
    }
    function progress(o) {
      if (o.status_order === 'Batal') return '';
      const lapak = !!o.serah_langsung, steps = lapak ? TLL : TL;
      const idx = lapak ? (o.status_order === 'Selesai' ? 3 : o.status_bayar === 'Lunas' ? 2 : 1) : Math.max(0, TL.indexOf(o.status_order === 'Diantar' ? 'Siap' : o.status_order));
      const label = lapak ? { Dipesan: 'Dipesan', Dibayar: 'Dibayar', Diserahkan: 'Diserahkan' } : { Baru: 'Diterima', Diproses: 'Diproses', Siap: o.cara_terima === 'Antar' ? (o.status_order === 'Diantar' ? 'Diantar' : 'Siap') : 'Siap diambil', Selesai: 'Selesai' };
      return '<ol class="flex items-start" aria-label="Progres pesanan">' + steps.map((s, i) => '<li class="flex flex-1 flex-col items-center gap-1.5 text-center"><div class="flex w-full items-center"><span class="h-0.5 flex-1 ' + (i === 0 ? 'opacity-0' : i <= idx ? 'bg-ocean' : 'bg-line') + '"></span><span class="grid size-8 place-items-center rounded-full text-xs font-extrabold ' + (i <= idx ? 'bg-ocean text-white' : 'bg-line text-muted') + '">' + (i < idx ? ic('check', 'size-4') : i + 1) + '</span><span class="h-0.5 flex-1 ' + (i === steps.length - 1 ? 'opacity-0' : i < idx ? 'bg-ocean' : 'bg-line') + '"></span></div><span class="text-[11px] font-bold ' + (i <= idx ? 'text-deep' : 'text-muted') + '">' + label[s] + '</span></li>').join('') + '</ol>';
    }
    function render(o) {
      cur = o; N.Clock.sync(o.now_ms);
      const cash = o.metode && o.metode.tipe === 'Cash', tertutup = o.status_order === 'Batal' || o.status_bayar === 'Kedaluwarsa';
      const bb = o.status_bayar, tungguBayar = !tertutup && !cash && bb === 'Belum Bayar';
      const lapak = !!o.serah_langsung, selesai = o.status_order === 'Selesai';
      const banner = o.status_bayar === 'Kedaluwarsa' ? '<div class="mb-4 flex gap-3 rounded-2xl bg-slate-100 p-4 text-slate-700">' + ic('clock', 'size-6 shrink-0') + '<div><p class="font-bold">Pesanan kedaluwarsa</p><p class="text-sm">Waktu pembayaran habis dan stok sudah dikembalikan. Silakan buat pesanan baru.</p></div></div>'
        : o.status_order === 'Batal' ? '<div class="mb-4 flex gap-3 rounded-2xl bg-bad-bg p-4 text-bad">' + ic('x', 'size-6 shrink-0') + '<div><p class="font-bold">Pesanan dibatalkan</p><p class="text-sm">' + esc(o.alasan_batal || 'Pesanan dibatalkan oleh penjual.') + '</p></div></div>'
        : lapak && selesai ? '<div class="mb-4 flex gap-3 rounded-2xl bg-ok-bg p-4 text-ok">' + ic('check', 'size-6 shrink-0') + '<div><p class="font-bold">Pembayaran diterima</p><p class="text-sm">Pesananmu sudah diserahkan. Terima kasih, selamat menikmati!</p></div></div>' : '';
      const info = !tertutup && bb === 'Menunggu Konfirmasi' ? '<div class="flex gap-3 rounded-2xl bg-tint p-4 text-deep">' + ic('clock', 'size-6 shrink-0 text-ocean') + '<div class="flex-1"><p class="font-bold">Menunggu konfirmasi admin</p><p class="text-sm text-muted">' + (lapak ? 'Penjual sedang memastikan dana masuk. Tunjukkan layar ini ke penjual. Halaman ini otomatis diperbarui.</p></div></div>' : 'Pastikan bukti bayar sudah terkirim di WhatsApp. Halaman ini otomatis diperbarui.</p><button class="btn btn-wa btn-sm mt-3" data-act="wa-bayar">' + ic('wa', 'size-4') + 'Buka WhatsApp lagi</button></div></div>') : '';
      const kasLapak = lapak && cash && !tertutup && !selesai ? '<div class="flex gap-3 rounded-2xl bg-tint p-4 text-deep">' + ic('store', 'size-6 shrink-0 text-ocean') + '<div><p class="font-bold">Bayar tunai di lapak</p><p class="text-sm text-muted">Serahkan uang ke penjual dan sebutkan kode ' + esc(o.kode) + '. Pesananmu langsung diserahkan setelah dibayar.</p></div></div>' : '';
      const wa = tungguBayar ? '<div class="grid gap-3"><div class="flex items-center justify-between rounded-2xl bg-warn-bg px-4 py-3 text-warn"><span class="flex items-center gap-2 text-sm font-bold">' + ic('clock', 'size-5') + 'Selesaikan pembayaran dalam</span><span class="font-display text-2xl font-extrabold tnum" data-cd>--:--</span></div>' +
        (lapak ? '<ol class="grid gap-1.5 rounded-2xl bg-tint p-4 text-sm text-deep"><li><b>1.</b> Bayar sesuai nominal di atas.</li><li><b>2.</b> Tekan "Saya sudah bayar" agar penjual tahu.</li><li><b>3.</b> Penjual memastikan dana masuk, lalu pesananmu langsung diserahkan.</li></ol>' : '<ol class="grid gap-1.5 rounded-2xl bg-tint p-4 text-sm text-deep"><li><b>1.</b> Bayar sesuai nominal di atas.</li><li><b>2.</b> Tekan tombol hijau, kirim bukti bayar di WhatsApp.</li><li><b>3.</b> Tunggu admin menandai pesananmu lunas.</li></ol>') +
        (lapak ? '<button class="btn btn-primary btn-lg w-full" data-act="sudah-bayar">' + ic('check', 'size-5') + 'Saya sudah bayar</button>' : '<button class="btn btn-wa btn-lg w-full" data-act="wa-bayar">' + ic('wa', 'size-5') + 'Konfirmasi Pembayaran via WhatsApp</button>') +
        '<button class="btn btn-soft w-full" data-act="alt">' + ic('qr', 'size-4') + (o.metode && o.metode.tipe === 'QRIS' ? 'QR tidak terbaca? Bayar dengan cara lain' : 'Ganti cara pembayaran') + '</button></div>' : '';
      const lok = o.cara_terima === 'Antar' ? esc(o.lokasi) + '<span class="block text-xs text-muted">' + esc(o.pref_antar) + '</span>' : 'Ambil di lapak';
      const kv = (k, v) => '<div><dt class="text-xs font-semibold text-muted">' + k + '</dt><dd class="mt-0.5 font-semibold text-deep">' + v + '</dd></div>';
      el.innerHTML = '<div class="mx-auto max-w-2xl pt-5"><a href="#/lacak" class="no-print mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-deep">' + ic('left', 'size-4') + 'Pesanan saya</a>' + banner +
        '<article class="print-area card overflow-hidden"><header class="sky-hero relative p-5 text-white sm:p-6"><span class="cloud right-4 top-3 h-6 w-20"></span><div class="relative flex items-start justify-between gap-3"><div class="flex items-center gap-3">' + N.logoHtml('size-11 rounded-2xl bg-white/25') + '<div><p class="font-display text-lg font-extrabold leading-none" data-brand-name>' + esc(N.brand.nama) + '</p><p class="mt-1 text-xs font-semibold text-white/85">INVOICE PESANAN</p></div></div><div class="text-right"><p class="font-display text-2xl font-extrabold leading-none tnum">' + esc(o.kode) + '</p><p class="mt-1 text-xs text-white/85">' + esc(waktu(o.dibuat_pada)) + '</p></div></div></header>' +
        '<div class="grid gap-5 p-5 sm:p-6"><div class="flex flex-wrap items-center gap-2">' + N.pillBayar(o.status_bayar) + N.pillOrder(o.status_order) + '<span class="pill ' + (o.tipe === 'Preorder' ? 'pill-sun' : 'pill-info') + '">' + esc(o.tipe) + (o.tipe === 'Preorder' ? ' · ' + esc(tgl(o.tanggal_target)) : '') + '</span></div>' +
        (tertutup ? '' : '<div class="no-print">' + progress(o) + '</div>') +
        '<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">' + kv('Pembeli', esc(o.nama)) + kv('WhatsApp', esc(N.tampilWa(o.wa))) + kv('Cara terima', lok) + kv('Catatan', esc(o.catatan || '-')) + '</dl>' +
        '<div class="ticket-cut"></div>' +
        '<table class="tbl"><thead><tr><th class="!px-0">Item</th><th class="text-center">Qty</th><th class="text-right !px-0">Subtotal</th></tr></thead><tbody>' + o.items.map((i) => '<tr><td class="!px-0"><p class="font-semibold text-deep">' + esc(i.nama) + '</p><p class="text-xs text-muted tnum">' + rp(i.harga) + '</p></td><td class="text-center tnum">' + i.qty + '</td><td class="!px-0 text-right font-semibold tnum">' + rp(i.subtotal) + '</td></tr>').join('') + '</tbody></table>' +
        '<div class="flex items-center justify-between"><span class="text-sm text-muted">Ongkos antar <b class="text-ok">Gratis</b></span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(o.total) + '</span></div>' +
        (tertutup || (lapak && bb === 'Lunas') ? '' : '<div class="ticket-cut"></div>' + paymentBlock(o) + wa + info + kasLapak) +
        '</div></article>' +
        '<div class="no-print mt-4 flex flex-wrap gap-3"><button class="btn btn-soft flex-1" data-act="cetak">' + ic('printer', 'size-4') + 'Cetak / Simpan PDF</button>' + (N.brand.wa ? '<button class="btn btn-soft flex-1" data-act="hubungi">' + ic('wa', 'size-4') + 'Hubungi Admin</button>' : '') + '</div>' +
        '<p class="no-print mt-5 text-center text-xs text-muted">' + esc(cfg().catatan_footer || '') + '</p></div>';
      if (stopCd) stopCd(); const cd = $('[data-cd]', el);
      if (cd && o.batas_ms) stopCd = N.countdown(cd, o.batas_ms, () => load(true));
    }
    function waBayarUrl(o) {
      const t = N.isiTemplate(cfg().template_wa_konfirmasi_bayar || 'Konfirmasi pembayaran {kode} sebesar {total}', { brand: N.brand.nama, nama: o.nama, kode: o.kode, total: rp(o.total), metode: o.metode ? o.metode.nama_tampil : '' });
      return N.waLink(N.brand.wa, t);
    }
    async function load(force) {
      if (!kode) return;
      const r = await api('getOrder', { kode: kode, key: key }, { silent: !!cur });
      if (!r.success) { if (!cur) el.innerHTML = '<div class="mx-auto mt-16 max-w-sm text-center"><div class="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-bad-bg text-bad">' + ic('alert', 'size-8') + '</div><p class="font-display text-lg font-bold text-deep">Pesanan tidak ditemukan</p><p class="mt-1 text-sm text-muted">' + esc(r.message) + '</p><a href="#/lacak" class="btn btn-primary mt-4">Lacak pesanan</a></div>'; return; }
      if (r.data.terbatas) { el.innerHTML = limited(r.data); return; }
      const o = r.data.order; Store.set('c:inv:' + kode, { order: o });
      const same = cur && cur.status_bayar === o.status_bayar && cur.status_order === o.status_order && cur.id_metode === o.id_metode && !force;
      if (!same) render(o); else cur = o;
      if (final(o)) clearInterval(timer);
    }
    const limited = (d) => '<div class="mx-auto max-w-md pt-8"><div class="card p-6 text-center"><p class="text-xs font-bold text-muted">STATUS PESANAN</p><p class="mt-1 font-display text-3xl font-extrabold text-deep tnum">' + esc(d.kode) + '</p><div class="mt-3 flex justify-center gap-2">' + N.pillBayar(d.status_bayar) + N.pillOrder(d.status_order) + '</div><p class="mt-3 text-sm text-muted">Atas nama ' + esc(d.nama) + '. Untuk melihat rincian lengkap, buka dari link invoice yang diterima saat memesan.</p></div></div>';
    function init(root) {
      el = root;
      N.actions(el, {
        salin: (t) => N.copy(t.dataset.v), cetak: () => window.print(),
        hubungi: () => window.open(N.waLink(N.brand.wa, 'Halo Admin ' + N.brand.nama + ', saya ingin bertanya tentang pesanan ' + (cur ? cur.kode : '') + '.'), '_blank', 'noopener'),
        'wa-bayar': async (t) => {
          if (!N.brand.wa) return toast('Nomor WhatsApp admin belum diatur. Hubungi penjual langsung.', 'warn', 4500);
          window.open(waBayarUrl(cur), '_blank', 'noopener');           // dibuka seketika agar tidak diblokir popup
          if (cur.status_bayar === 'Belum Bayar') {
            const r = await api('markWaSent', { kode: kode, key: key });
            if (r.success) { render(r.data.order); toast('Kirim bukti bayar di WhatsApp, lalu tunggu admin menandai lunas.', 'ok', 4500); } else if (r.code !== 'NET') { toast(r.message, 'bad', 4500); load(true); }
          }
        },
        'sudah-bayar': async (t) => {
          const r = await N.busy(t, 'Mengirim…', () => api('markWaSent', { kode: kode, key: key, via: 'lapak' }));
          if (!r) return; if (r.success) { render(r.data.order); toast('Terima kasih! Tunjukkan layar ini ke penjual.', 'ok', 4000); } else if (r.code !== 'NET') { toast(r.message, 'bad', 4500); load(true); }
        },
        alt: () => bukaAlt()
      });
    }
    function bukaAlt() {
      const M = (S.boot && S.boot.metode || []).filter((m) => cur && m.id_metode !== cur.id_metode);
      if (!M.length) return toast('Tidak ada metode pembayaran lain yang aktif.', 'warn');
      const m = modal.open({ title: 'Bayar dengan cara lain', size: 'center', body: '<div class="grid gap-3 p-5"><p class="text-sm text-muted">Pesananmu tidak perlu dibuat ulang. Pilih cara lain di bawah ini.</p>' + M.map((x) => '<button class="flex min-h-[4.5rem] items-center gap-4 rounded-[20px] border-2 border-line p-3.5 text-left hover:bg-tint" data-pm="' + esc(x.id_metode) + '"><span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white p-1 text-ocean">' + (x.logo_url ? '<img src="' + esc(x.logo_url) + '" alt="" class="size-full object-contain" data-foto>' : ic(tipeIcon(x.tipe), 'size-6')) + '</span><span class="flex-1"><span class="block font-bold text-deep">' + esc(x.nama_tampil) + '</span><span class="text-xs text-muted">' + esc(x.tipe) + '</span></span>' + ic('right', 'size-5 text-muted') + '</button>').join('') + '</div>' });
      m.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pm]'); if (!b) return;
        const r = await N.busy(b, 'Mengganti…', () => api('changePayMethod', { kode: kode, key: key, id_metode: b.dataset.pm }));
        if (r && r.success) { m.close(); render(r.data.order); toast('Cara pembayaran diganti.', 'ok'); } else if (r && r.code !== 'NET') toast(r.message, 'bad');
      });
    }
    return {
      init: init, refreshAlt() {},
      show(p) {
        const k2 = p[0] || '', key2 = p[1] || '';
        if (k2 !== kode || key2 !== key) { kode = k2; key = key2; cur = null; el.innerHTML = '<div class="mx-auto max-w-2xl pt-8"><div class="skel h-[28rem]"></div></div>'; }
        const cache = Store.get('c:inv:' + kode, null); if (cache && !cur && key) render(cache.order);
        document.title = kode + ' — ' + N.brand.nama;
        ensureBoot(); load(true); clearInterval(timer);
        let tick = 0; timer = setInterval(() => { tick++; if (!document.hidden && cur && !final(cur) && (cur.serah_langsung || tick % 3 === 0)) load(); }, 7000);   // ambil di lapak: cek tiap 7 dtk agar status lunas cepat terlihat
      },
      hide() { clearInterval(timer); stopCd && stopCd(); },
      resume() { load(); }
    };
  }

  /* ============================== LACAK ============================== */
  function pageLacak() {
    let el;
    function paint(hasil) {
      const list = Store.get('orders', []);
      el.innerHTML = '<div class="mx-auto max-w-xl pt-6"><h1 class="font-display text-3xl font-extrabold text-deep">Lacak pesanan</h1><p class="mt-1 text-sm text-muted">Masukkan kode pesanan, atau buka dari riwayat di perangkat ini.</p>' +
        '<form class="mt-4 flex gap-2" data-form><label class="sr-only" for="lc-kode">Kode pesanan</label><input id="lc-kode" class="input uppercase" placeholder="NSK-0001" maxlength="12" autocomplete="off"><button class="btn btn-primary">' + ic('search', 'size-4') + 'Cari</button></form><div data-hasil class="mt-4">' + (hasil || '') + '</div>' +
        '<h2 class="mt-8 font-display text-lg font-bold text-deep">Riwayat di perangkat ini</h2>' +
        (list.length ? '<ul class="mt-3 grid gap-3">' + list.map((o) => '<li><a href="#/invoice/' + esc(o.kode) + '/' + esc(o.key) + '" class="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5"><span class="grid size-11 place-items-center rounded-2xl bg-tint text-ocean">' + ic('receipt', 'size-5') + '</span><span class="min-w-0 flex-1"><span class="block font-display font-bold text-deep tnum">' + esc(o.kode) + '</span><span class="block truncate text-xs text-muted">' + esc(o.nama) + ' · ' + esc(waktu(new Date(o.t + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' '))) + '</span></span><span class="font-bold text-deep tnum">' + rp(o.total) + '</span>' + ic('right', 'size-5 text-muted') + '</a></li>').join('') + '</ul>' : '<div class="mt-3 rounded-3xl bg-tint p-8 text-center"><div class="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-white text-sky">' + ic('receipt', 'size-6') + '</div><p class="font-semibold text-deep">Belum ada pesanan</p><a href="#/" class="btn btn-primary btn-sm mt-3">Pesan sekarang</a></div>') + '</div>';
    }
    return {
      init(root) {
        el = root;
        el.addEventListener('submit', async (e) => {
          e.preventDefault(); const k = $('#lc-kode', el).value.trim().toUpperCase(); if (!k) return;
          const sv = Store.get('orders', []).filter((o) => o.kode === k)[0];
          if (sv) return N.go('#/invoice/' + sv.kode + '/' + sv.key);
          const r = await N.busy($('button', e.target), 'Mencari…', () => api('getOrder', { kode: k }));
          const box = $('[data-hasil]', el);
          if (!r) return;
          if (!r.success) box.innerHTML = '<div class="rounded-2xl bg-bad-bg p-4 text-sm font-semibold text-bad">' + esc(r.message) + '</div>';
          else { const d = r.data; box.innerHTML = '<div class="card p-5"><p class="font-display text-2xl font-extrabold text-deep tnum">' + esc(d.kode) + '</p><div class="mt-2 flex flex-wrap gap-2">' + N.pillBayar(d.status_bayar) + N.pillOrder(d.status_order) + '</div><p class="mt-3 text-sm text-muted">Atas nama ' + esc(d.nama) + '. Rincian lengkap hanya tampil dari link invoice milik pemesan.</p></div>'; }
        });
      },
      show(p) { paint(); document.title = 'Lacak pesanan — ' + N.brand.nama; ensureBoot(); if (p[0]) { $('#lc-kode', el).value = p[0]; $('form', el).requestSubmit(); } },
      hide() {}
    };
  }

  N.register('buyer', { mount: mount, route: route });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-act="retry-boot"]'); if (t) { const m = $('[data-page="menu"]'); if (m) m.innerHTML = '<div class="skel mt-6 h-96"></div>'; ensureBoot(true); } });
})();
