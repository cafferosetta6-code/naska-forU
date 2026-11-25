/* NASKA — admin.js : login, kerangka admin, Antrian, Pesanan, detail pesanan. Halaman lain ada di admin2.js (dimuat saat dibuka). */
(function () {
  'use strict';
  const { $, $$, esc, rp, ic, api, swr, Store, Sesi, toast, modal, tgl, jam, waktu } = N;
  const PREF = ['Secepatnya', 'Istirahat setelah jam ke-1', 'Istirahat setelah jam ke-2', 'Istirahat setelah jam ke-3', 'Istirahat setelah jam ke-4', 'Istirahat setelah jam ke-5'];
  const NAV = [
    { k: 'antrian', t: 'Antrian', i: 'list' }, { k: 'pesanan', t: 'Pesanan', i: 'receipt' }, { k: 'stok', t: 'Stok Harian', i: 'box' },
    { k: 'menu', t: 'Menu', i: 'coffee' }, { k: 'lokasi', t: 'Lokasi Antar', i: 'pin' }, { k: 'rekap', t: 'Rekap', i: 'chart' }, { k: 'pengaturan', t: 'Pengaturan', i: 'sliders' }
  ];
  const BAWAH = ['antrian', 'pesanan', 'stok', 'menu'];
  const EXTRA = ['stok', 'menu', 'lokasi', 'pengaturan', 'rekap'];
  const A = (N.A = { boot: null, orders: [], counts: { baru: 0, menunggu_konfirmasi: 0, aktif: 0, belum_bayar: 0 }, hari: '', latest: '', page: '', pages: {}, root: null, qTab: '', timer: null, logged: false });

  /* ============================== UTIL BERSAMA ============================== */
  A.fld = (label, inner, hint, id) => '<div><label class="label"' + (id ? ' for="' + id + '"' : '') + '>' + label + '</label>' + inner + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  A.settings = () => (A.boot && A.boot.settings) || {};
  A.metodeAktif = () => ((A.boot && A.boot.metode) || []).filter((m) => m.aktif);
  A.download = (nama, blob) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nama; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  /** Pilih file gambar → kompres → unggah ke Drive → kembalikan URL. */
  A.uploadImage = async (file, folder, maks, png) => {
    const k = await N.kompres(file, maks || 900, !!png);
    const r = await api('adminUploadAsset', { folder: folder, mime: k.mime, base64: k.base64, filename: file.name });
    if (!r.success) throw new Error(r.message || 'Gagal mengunggah gambar.');
    return r.data.url;
  };
  A.setBoot = (b) => {
    A.boot = b; N.state.adminBoot = b; A.orders = b.orders || []; A.counts = b.counts || A.counts; A.hari = (b.server || {}).tanggal || A.hari;
    A.latest = A.orders.reduce((m, o) => (o.diperbarui_pada > m ? o.diperbarui_pada : m), '');
    N.applyBrand(b.settings || {});
    chrome(); badges(); if (A.page && A.pages[A.page]) A.pages[A.page].repaint && A.pages[A.page].repaint();
  };
  A.patchBoot = (patch) => { Object.assign(A.boot, patch); seedCache(); if (patch.settings) N.applyBrand(patch.settings); chrome(); };
  function seedCache() { try { Store.set('c:a:adminBoot', { t: Date.now(), h: N.hashStr(JSON.stringify(A.boot)), v: N.VERSION, data: Object.assign({}, A.boot, { orders: A.orders }) }); } catch (e) {} }
  function bersihkanCache() { try { Object.keys(localStorage).filter((k) => k.indexOf('naska:v1:c:a:') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) {} }
  const tokoLabel = () => { const t = (A.boot && A.boot.toko) || {}; return t.buka ? ['Toko Buka', 'pill-ok'] : [t.alasan === 'manual' ? 'Ditutup manual' : 'Di luar jam', 'pill-bad']; };

  /* ============================== LOGIN ============================== */
  function loginHtml() {
    return '<div class="sky-hero grid min-h-dvh place-items-center px-5 py-10"><span class="cloud left-[8%] top-[14%] h-10 w-32 animate-float"></span><span class="cloud right-[10%] top-[24%] h-8 w-24 animate-float" style="animation-delay:-3s"></span>' +
      '<div class="card relative w-full max-w-md p-6 sm:p-8 animate-rise"><div class="mb-6 flex flex-col items-center text-center">' + N.logoHtml('size-16 rounded-[22px] bg-gradient-to-br from-sky to-ocean text-white') + '<h1 class="mt-3 font-display text-3xl font-extrabold text-deep" data-brand-name>' + esc(N.brand.nama) + '</h1><p class="mt-1 text-sm text-muted">Masuk ke panel admin</p></div>' +
      '<form data-login class="grid gap-4" novalidate autocomplete="on">' +
      A.fld('Nama pengguna', '<input id="lg-u" class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>', '', 'lg-u') +
      A.fld('Kata sandi', '<div class="relative"><input id="lg-p" class="input pr-12" type="password" name="password" autocomplete="current-password" required><button type="button" class="icon-btn absolute right-1 top-1/2 -translate-y-1/2" data-act="lihat" aria-label="Tampilkan kata sandi">' + ic('eye') + '</button></div>', '', 'lg-p') +
      '<p class="err-text hidden" data-err role="alert"></p><button class="btn btn-primary btn-lg w-full" type="submit">Masuk</button></form>' +
      '<a href="#/" class="mt-5 block text-center text-sm font-semibold text-muted hover:text-deep">← Kembali ke halaman pemesanan</a></div></div>';
  }
  function showLogin() {
    A.logged = false; clearInterval(A.timer);
    A.root.innerHTML = loginHtml(); const f = $('[data-login]', A.root);
    $('[data-act="lihat"]', f).addEventListener('click', (e) => { const t = e.currentTarget, i = $('#lg-p', f); i.type = i.type === 'password' ? 'text' : 'password'; t.innerHTML = ic(i.type === 'password' ? 'eye' : 'lock'); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const err = $('[data-err]', f), u = $('#lg-u', f).value.trim(), p = $('#lg-p', f).value;
      err.classList.add('hidden');
      if (!u || !p) { err.textContent = 'Isi nama pengguna dan kata sandi.'; err.classList.remove('hidden'); return; }
      const r = await N.busy($('button[type=submit]', f), 'Masuk…', () => api('adminLogin', { username: u, password: p }));
      if (!r) return;
      if (!r.success) { err.textContent = r.message; err.classList.remove('hidden'); $('#lg-p', f).value = ''; $('#lg-p', f).focus(); return; }
      Sesi.set(r.data.token, r.data.me); A.me = r.data.me; A.root.__built = false;
      buildApp(); A.setBoot(r.data.boot); seedCache(); startPoll();
      const nx = Store.get('next', null); Store.del('next');
      if (r.data.me.wajib_ganti_sandi) N.go('#/admin/pengaturan/akun'); else N.go(nx || '#/admin');
    });
    setTimeout(() => $('#lg-u', A.root) && $('#lg-u', A.root).focus(), 50);
  }

  /* ============================== KERANGKA ============================== */
  function buildApp() {
    A.logged = true; A.pages = {}; A.root.__built = true;
    A.root.innerHTML =
      '<div class="min-h-dvh bg-tint/50 lg:pl-64">' +
      '<aside class="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex"><div class="flex items-center gap-3 px-5 py-5">' + N.logoHtml('size-11 rounded-2xl bg-gradient-to-br from-sky to-ocean text-white') + '<div class="min-w-0"><p class="truncate font-display text-xl font-extrabold text-deep" data-brand-name>' + esc(N.brand.nama) + '</p><p class="text-xs font-semibold text-muted">Panel Admin</p></div></div>' +
      '<nav class="flex-1 overflow-y-auto px-3" aria-label="Menu admin">' + NAV.map((n) => '<a href="#/admin/' + n.k + '" data-nav="' + n.k + '" class="mb-1 flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[15px] font-bold text-muted transition hover:bg-tint">' + ic(n.i, 'size-5') + '<span class="flex-1">' + n.t + '</span><span data-badge="' + n.k + '" class="hidden min-w-6 rounded-full bg-sun px-1.5 text-center text-xs font-extrabold leading-6 text-ink"></span></a>').join('') + '</nav>' +
      '<div class="grid gap-2 border-t border-line p-3"><a href="#/pos" class="btn btn-primary w-full">' + ic('grid', 'size-5') + 'Buka Mode POS</a><button class="btn btn-ghost w-full" data-act="keluar">' + ic('logout', 'size-4') + 'Keluar</button></div></aside>' +
      '<header class="no-print sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md"><div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6"><div class="flex items-center gap-2.5 lg:hidden">' + N.logoHtml('size-9 rounded-xl bg-gradient-to-br from-sky to-ocean text-white') + '</div><h1 class="min-w-0 flex-1 truncate font-display text-xl font-extrabold text-deep" data-title>Antrian</h1>' +
      '<button data-act="toko" class="pill ' + 'pill-mute' + ' min-h-9 !px-3 text-xs" data-toko aria-label="Atur status toko"></button><button class="icon-btn" data-act="segarkan" aria-label="Segarkan data">' + ic('refresh', 'size-5') + '</button></div></header>' +
      '<main class="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12" data-main></main>' +
      '<nav class="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-b lg:hidden" aria-label="Navigasi bawah"><div class="mx-auto grid max-w-lg grid-cols-5">' +
      BAWAH.map((k) => { const n = NAV.filter((x) => x.k === k)[0]; return '<a href="#/admin/' + k + '" data-nav="' + k + '" class="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted">' + ic(n.i, 'size-6') + n.t.split(' ')[0] + '<span data-badge="' + k + '" class="absolute right-[22%] top-1.5 hidden min-w-5 rounded-full bg-sun px-1 text-center text-[10px] font-extrabold leading-5 text-ink"></span></a>'; }).join('') +
      '<button data-act="lainnya" class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted" data-nav="lainnya">' + ic('dots', 'size-6') + 'Lainnya</button></div></nav></div>';
    A.main = $('[data-main]', A.root);
    if (!A._bound) { A._bound = true; N.actions(A.root, {
      keluar: async () => { if (await N.confirm({ title: 'Keluar dari panel admin?', text: 'Kamu perlu masuk lagi untuk membuka panel ini.', ok: 'Keluar' })) keluar(); },
      segarkan: async (t) => { t.firstElementChild.classList.add('animate-spin'); await Promise.all([refreshOrders(true), A.pages[A.page] && A.pages[A.page].reload ? A.pages[A.page].reload() : null]); t.firstElementChild.classList.remove('animate-spin'); toast('Data diperbarui', 'ok', 1400); },
      toko: () => bukaToko(),
      lainnya: () => {
        const m = modal.open({ title: 'Menu lainnya', size: 'bottom', body: '<div class="grid gap-1 p-3">' + NAV.filter((n) => BAWAH.indexOf(n.k) < 0).map((n) => '<a href="#/admin/' + n.k + '" class="flex min-h-14 items-center gap-3 rounded-2xl px-4 font-bold text-deep hover:bg-tint">' + ic(n.i, 'size-5 text-ocean') + n.t + ic('right', 'ml-auto size-4 text-muted') + '</a>').join('') + '<a href="#/pos" class="flex min-h-14 items-center gap-3 rounded-2xl px-4 font-bold text-deep hover:bg-tint">' + ic('grid', 'size-5 text-ocean') + 'Buka Mode POS' + ic('right', 'ml-auto size-4 text-muted') + '</a><button data-act="keluar" class="flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left font-bold text-bad hover:bg-bad-bg">' + ic('logout', 'size-5') + 'Keluar</button></div>' });
        N.actions(m.el, { keluar: () => { m.close(); A.root.querySelector('aside [data-act="keluar"]').click(); } });
      }
    }); }
    chrome();
  }
  function chrome() {
    if (!A.root || !A.logged) return;
    const b = $('[data-toko]', A.root); if (b) { const t = tokoLabel(); b.className = 'pill ' + t[1] + ' min-h-9 !px-3 text-xs'; b.innerHTML = '<span class="size-2 rounded-full bg-current"></span>' + t[0]; }
    $$('[data-brand-name]', A.root).forEach((e) => (e.textContent = N.brand.nama));
  }
  function badges() {
    if (!A.root || !A.logged) return;
    const n = (A.counts.baru || 0) + (A.counts.menunggu_konfirmasi || 0);
    $$('[data-badge="antrian"]', A.root).forEach((e) => { e.textContent = n > 99 ? '99+' : n; e.classList.toggle('hidden', !n); });
    document.title = (n ? '(' + n + ') ' : '') + 'Admin — ' + N.brand.nama;
  }
  function keluar() { A.root.__built = false; Sesi.clear(); bersihkanCache(); clearInterval(A.timer); A.logged = false; A.boot = null; A.orders = []; modal.closeAll(); N.go('#/admin/login'); }
  A.keluar = keluar;
  function bukaToko() {
    const cur = A.settings().toko_buka_manual || 'auto', t = (A.boot || {}).toko || {};
    const opt = [['auto', 'Otomatis', 'Mengikuti jam operasional ' + (A.settings().jam_buka || '') + '–' + (A.settings().jam_tutup || '')], ['buka', 'Buka sekarang', 'Terima pesanan langsung walau di luar jam'], ['tutup', 'Tutup sementara', 'Pembeli tidak bisa memesan Langsung']];
    const m = modal.open({ title: 'Status toko', size: 'center', body: '<div class="grid gap-3 p-5"><p class="text-sm text-muted">Saat ini: <b class="text-deep">' + (t.buka ? 'Buka' : 'Tutup') + '</b></p>' + opt.map((o) => '<button class="flex min-h-16 items-start gap-3 rounded-[20px] border-2 p-3.5 text-left ' + (cur === o[0] ? 'border-ocean bg-tint' : 'border-line hover:bg-tint/60') + '" data-v="' + o[0] + '"><span class="mt-0.5 grid size-5 place-items-center rounded-full border-2 ' + (cur === o[0] ? 'border-ocean bg-ocean text-white' : 'border-line') + '">' + (cur === o[0] ? ic('check', 'size-3') : '') + '</span><span><span class="block font-bold text-deep">' + o[1] + '</span><span class="text-xs text-muted">' + o[2] + '</span></span></button>').join('') + '</div>' });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-v]'); if (!b || b.dataset.v === cur) return;
      const r = await N.busy(b, 'Menyimpan…', () => api('adminSaveSettings', { values: { toko_buka_manual: b.dataset.v } }));
      if (r && r.success) { A.patchBoot({ settings: r.data.settings, toko: r.data.toko }); m.close(); toast('Status toko diperbarui.', 'ok'); if (A.pages.pengaturan) A.pages.pengaturan.repaint && A.pages.pengaturan.repaint(); } else if (r && r.code !== 'NET') toast(r.message, 'bad');
    });
  }

  /* ============================== POLLING ============================== */
  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.06, c.currentTime); o.start(); o.stop(c.currentTime + 0.18); } catch (e) {} }
  async function poll(force) {
    if (!A.logged || (document.hidden && !force)) return;
    const r = await api('adminPoll', {}, { silent: true }); if (!r.success) return;
    const d = r.data, prev = A.counts; A.counts = d.counts; A.hari = d.tanggal; if (A.boot) { A.boot.toko = d.toko; chrome(); }
    badges();
    if (d.latest !== A.latest || force) { A.latest = d.latest; await refreshOrders(); }
    if (prev && d.counts.baru > prev.baru) { toast('Ada pesanan baru masuk', 'ok', 4000); beep(); }
  }
  async function refreshOrders() {
    const r = await api('adminListOrders', { scope: 'aktif' }, { silent: true });
    if (r.success) { A.orders = r.data.orders; A.hari = r.data.server.tanggal; A.latest = A.orders.reduce((m, o) => (o.diperbarui_pada > m ? o.diperbarui_pada : m), A.latest); if (A.boot) seedCache(); const p = A.pages.antrian; p && p.repaint && p.repaint(); const q = A.pages.pesanan; q && q.onOrders && q.onOrders(); }
    return r;
  }
  function startPoll() { clearInterval(A.timer); A.timer = setInterval(() => poll(false), 20000); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.logged && N.state.shell === 'admin') poll(true); });

  /* ============================== LOGIKA PESANAN ============================== */
  const flowOf = (o) => (o.cara_terima === 'Antar' ? ['Baru', 'Diproses', 'Siap', 'Diantar', 'Selesai'] : ['Baru', 'Diproses', 'Siap', 'Selesai']);
  const NEXT_LABEL = { Diproses: 'Proses', Siap: 'Tandai Siap', Diantar: 'Antar Sekarang', Selesai: 'Selesaikan' };
  const tertutup = (o) => o.status_order === 'Batal' || o.status_bayar === 'Kedaluwarsa';
  const nextOf = (o) => { if (tertutup(o) || o.status_order === 'Selesai' || (o.serah_langsung && o.status_bayar !== 'Lunas')) return null; const f = flowOf(o), i = f.indexOf(o.status_order); return i > -1 ? f[i + 1] : null; };
  const perluBayar = (o) => !tertutup(o) && (o.status_bayar === 'Menunggu Konfirmasi' || (o.status_bayar === 'Belum Bayar' && o.metode_tipe !== 'Cash'));
  const ringkasItem = (o) => (o.items || []).map((i) => i.qty + '× ' + i.nama).join(', ');
  A.nextOf = nextOf; A.tertutup = tertutup;
  function applyOrder(o) {
    const i = A.orders.findIndex((x) => x.kode === o.kode), fin = o.status_order === 'Selesai' || tertutup(o);
    if (fin) { if (i > -1) A.orders.splice(i, 1); } else if (i > -1) A.orders[i] = o; else A.orders.unshift(o);
    if (A.pages.antrian) A.pages.antrian.repaint(); if (A.pages.pesanan && A.pages.pesanan.onOrder) A.pages.pesanan.onOrder(o);
    A.cacheOrders = A.cacheOrders || {}; A.cacheOrders[o.kode] = o;
    if (o.diperbarui_pada && o.diperbarui_pada > A.latest) A.latest = o.diperbarui_pada;
    const m = modal.top();
    if (m && m.el.dataset.kode === o.kode) { fillDetail(m, o); api('adminGetOrder', { kode: o.kode }, { silent: true }).then((r) => { if (r.success && !m.closed) fillDetail(m, r.data.order, r.data.log); }); }
    poll(false);
  }
  function findOrder(kode) { return A.orders.filter((o) => o.kode === kode)[0] || (A.cacheOrders || {})[kode] || null; }
  A.findOrder = findOrder;
  async function geser(kode, btn) {
    const o = findOrder(kode); if (!o) return; const tujuan = nextOf(o); if (!tujuan) return;
    if (tujuan === 'Selesai' && o.status_bayar !== 'Lunas') return toast('Tandai Lunas dulu sebelum menyelesaikan pesanan.', 'warn', 3500);
    const r = await N.busy(btn, '…', () => api('adminUpdateStatus', { kode: kode, status: tujuan }));
    if (!r) return; if (r.success) { applyOrder(r.data.order); toast(o.kode + ' → ' + tujuan, 'ok', 1800); } else if (r.code !== 'NET') { toast(r.message, 'bad', 4000); refreshOrders(); }
  }
  function bukaBayar(kode) {
    const o = findOrder(kode); if (!o) return; const M = A.metodeAktif();
    if (!M.length) return toast('Belum ada metode pembayaran aktif.', 'warn');
    const cur = o.id_metode && M.some((m) => m.id_metode === o.id_metode) ? o.id_metode : M[0].id_metode, lapak = !!o.serah_langsung;
    const m = modal.open({ title: (lapak ? 'Paid · ' : 'Tandai lunas · ') + o.kode, size: 'center', body: '<div class="grid gap-4 p-5"><div class="flex items-center justify-between rounded-2xl bg-tint p-4"><span class="text-sm font-semibold text-muted">Total tagihan</span><span class="font-display text-2xl font-extrabold text-deep tnum">' + rp(o.total) + '</span></div>' +
      A.fld('Dibayar dengan', '<select id="by-m" class="input">' + M.map((x) => '<option value="' + esc(x.id_metode) + '"' + (x.id_metode === cur ? ' selected' : '') + '>' + esc(x.nama_tampil) + ' · ' + esc(x.tipe) + '</option>').join('') + '</select>', 'Pastikan dana sudah masuk di rekening / e-wallet, atau uang tunai sudah diterima.', 'by-m') +
      (lapak ? '<p class="rounded-2xl bg-tint p-3 text-sm text-deep">Setelah dikonfirmasi, pesanan langsung <b>Selesai</b>: produk diserahkan ke pembeli di lapak.</p>' : '') + '</div>',
      footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>Batal</button><button class="btn btn-primary flex-1" data-ok>' + (lapak ? 'Paid & Serahkan' : 'Konfirmasi Lunas') + '</button></div>' });
    $('[data-ok]', m.footer).addEventListener('click', async (e) => {
      const r = await N.busy(e.currentTarget, 'Menyimpan…', () => api('adminSetPaid', { kode: kode, id_metode: $('#by-m', m.el).value }));
      if (!r) return; if (r.success) { m.close(); applyOrder(r.data.order); toast(lapak ? o.kode + ' lunas dan diserahkan.' : 'Pesanan ditandai lunas.', 'ok'); } else if (r.code !== 'NET') toast(r.message, 'bad', 4000);
    });
  }
  function bukaBatal(kode) {
    const o = findOrder(kode); if (!o) return; const pre = ['Stok habis', 'Pembeli membatalkan', 'Pembayaran tidak masuk', 'Pesanan ganda'];
    const m = modal.open({ title: 'Batalkan ' + o.kode + '?', size: 'center', body: '<div class="grid gap-4 p-5"><p class="text-sm text-muted">Stok pesanan ini akan dikembalikan otomatis. Tindakan ini tidak bisa dibatalkan.</p><div class="flex flex-wrap gap-2">' + pre.map((p) => '<button type="button" class="chip" data-p="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div>' + A.fld('Alasan pembatalan', '<textarea id="bt-a" class="input" maxlength="160" placeholder="Tulis alasan singkat"></textarea>', '', 'bt-a') + '</div>',
      footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>Kembali</button><button class="btn btn-danger flex-1" data-ok>Batalkan Pesanan</button></div>' });
    m.el.addEventListener('click', (e) => { const p = e.target.closest('[data-p]'); if (p) { $('#bt-a', m.el).value = p.dataset.p; $('#bt-a', m.el).focus(); } });
    $('[data-ok]', m.footer).addEventListener('click', async (e) => {
      const a = $('#bt-a', m.el).value.trim(); if (a.length < 3) { toast('Isi alasan pembatalan.', 'warn'); return $('#bt-a', m.el).focus(); }
      const r = await N.busy(e.currentTarget, 'Membatalkan…', () => api('adminCancelOrder', { kode: kode, alasan: a }));
      if (!r) return; if (r.success) { m.close(); applyOrder(r.data.order); toast('Pesanan dibatalkan, stok dikembalikan.', 'ok'); } else if (r.code !== 'NET') toast(r.message, 'bad', 4000);
    });
  }
  function bukaWa(kode) {
    const o = findOrder(kode); if (!o) return; if (!o.wa) return toast('Pesanan ini tidak memiliki nomor WhatsApp.', 'warn');
    const s = A.settings(), v = { brand: N.brand.nama, nama: o.nama, kode: o.kode, total: rp(o.total), metode: o.metode ? o.metode.nama_tampil : '', lokasi: o.lokasi || 'lapak', items: (o.items || []).map((i) => i.qty + '× ' + i.nama).join('\n') };
    const T = [['Pembayaran diterima', s.template_wa_konfirmasi], ['Pesanan siap diambil', s.template_wa_siap], ['Pesanan sedang diantar', s.template_wa_antar], ['Kirim struk', s.template_wa_struk]];
    const m = modal.open({ title: 'Kirim WhatsApp ke ' + o.nama, size: 'center', body: '<div class="grid gap-2 p-4"><p class="px-1 pb-1 text-sm text-muted">Nomor ' + esc(N.tampilWa(o.wa)) + '. Pilih pesan, WhatsApp akan terbuka dengan teks siap kirim.</p>' + T.map((t, i) => '<button class="flex min-h-14 items-center gap-3 rounded-2xl border border-line p-3 text-left hover:bg-tint" data-i="' + i + '"><span class="grid size-10 place-items-center rounded-xl bg-wa/15 text-wa">' + ic('wa', 'size-5') + '</span><span class="flex-1 font-bold text-deep">' + t[0] + '</span>' + ic('right', 'size-4 text-muted') + '</button>').join('') + '</div>' });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; window.open(N.waLink(o.wa, N.isiTemplate(T[+b.dataset.i][1], v)), '_blank', 'noopener'); m.close(); });
  }
  A.actions = { next: geser, pay: bukaBayar, cancel: bukaBatal, wa: bukaWa };
  function orderActions(o, lengkap) {
    if (tertutup(o)) return '';
    const n = nextOf(o), bayar = o.status_bayar !== 'Lunas', btn = [];
    if (bayar) btn.push('<button class="btn btn-sun btn-sm" data-act="pay" data-k="' + o.kode + '">' + ic('wallet', 'size-4') + (o.metode_tipe === 'Cash' ? 'Terima Tunai' : o.serah_langsung ? 'Paid' : 'Tandai Lunas') + '</button>');
    if (n) btn.push('<button class="btn btn-primary btn-sm" data-act="next" data-k="' + o.kode + '"' + (n === 'Selesai' && bayar ? ' aria-disabled="true" title="Tandai lunas dulu"' : '') + '>' + NEXT_LABEL[n] + ic('right', 'size-4') + '</button>');
    if (lengkap) { if (o.wa) btn.push('<button class="btn btn-wa btn-sm" data-act="wa" data-k="' + o.kode + '">' + ic('wa', 'size-4') + 'WhatsApp</button>'); if (o.status_order !== 'Selesai') btn.push('<button class="btn btn-ghost btn-sm !text-bad" data-act="cancel" data-k="' + o.kode + '">' + ic('x', 'size-4') + 'Batalkan</button>'); }
    return btn.join('');
  }

  /* ============================== DETAIL PESANAN ============================== */
  function detailHtml(o, log) {
    const kv = (k, v) => '<div><dt class="text-xs font-semibold text-muted">' + k + '</dt><dd class="mt-0.5 font-semibold text-deep">' + v + '</dd></div>';
    const tl = log ? '<ol class="relative ml-2 grid gap-3 border-l-2 border-line pl-5">' + (log.length ? log.map((l) => '<li class="relative"><span class="absolute -left-[1.62rem] top-1 size-3 rounded-full border-2 border-white bg-ocean"></span><p class="text-sm font-bold text-deep">' + esc(l.kejadian) + '</p><p class="text-xs text-muted">' + esc(waktu(l.waktu)) + (l.oleh ? ' · ' + esc(l.oleh) : '') + (l.catatan ? ' · ' + esc(l.catatan) : '') + '</p></li>').join('') : '<li class="text-sm text-muted">Belum ada riwayat.</li>') + '</ol>' : '<div class="skel h-24"></div>';
    return '<div class="grid gap-5 p-5"><div class="flex flex-wrap items-center gap-2">' + N.pillBayar(o.status_bayar) + N.pillOrder(o.status_order) + N.pillSumber(o.sumber) + '<span class="pill ' + (o.tipe === 'Preorder' ? 'pill-sun' : 'pill-mute') + '">' + esc(o.tipe) + (o.tipe === 'Preorder' ? ' · ' + esc(tgl(o.tanggal_target)) : '') + '</span></div>' +
      '<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">' + kv('Pembeli', esc(o.nama)) + kv('WhatsApp', o.wa ? esc(N.tampilWa(o.wa)) + (o.wa_nomor_cepat ? ' <span class="pill pill-sun !py-0">cepat</span>' : '') : '-') +
      kv('Dibuat', esc(waktu(o.dibuat_pada))) + kv('Metode', esc(o.metode ? o.metode.nama_tampil : '-')) +
      kv('Cara terima', o.cara_terima === 'Antar' ? esc(o.lokasi) + '<span class="block text-xs text-muted">' + esc(o.pref_antar) + '</span>' : 'Ambil di lapak') + kv('Catatan', esc(o.catatan || '-')) +
      (o.status_bayar === 'Lunas' && o.uang_diterima ? kv('Uang diterima', rp(o.uang_diterima)) + kv('Kembalian', rp(o.kembalian)) : '') + (o.alasan_batal ? kv('Alasan batal', esc(o.alasan_batal)) : '') + '</dl>' +
      '<div class="overflow-hidden rounded-2xl border border-line"><table class="tbl"><tbody>' + o.items.map((i) => '<tr><td><span class="font-semibold text-deep">' + esc(i.nama) + '</span><span class="block text-xs text-muted tnum">' + rp(i.harga) + '</span></td><td class="text-center tnum">×' + i.qty + '</td><td class="text-right font-semibold tnum">' + rp(i.subtotal) + '</td></tr>').join('') + '<tr class="bg-tint"><td colspan="2" class="font-bold text-deep">Total</td><td class="text-right font-display text-lg font-extrabold text-deep tnum">' + rp(o.total) + '</td></tr></tbody></table></div>' +
      '<div><h3 class="mb-3 font-display text-lg font-bold text-deep">Riwayat</h3>' + tl + '</div></div>';
  }
  function fillDetail(m, o, log) {
    m.el.dataset.kode = o.kode; if (log !== undefined) m.log = log;
    m.body.innerHTML = detailHtml(o, m.log);
    const f = orderActions(o, true); if (m.footer) m.footer.innerHTML = '<div class="flex flex-wrap gap-2">' + f + '</div>';
  }
  async function bukaDetail(kode, pre) {
    A.cacheOrders = A.cacheOrders || {}; if (pre) A.cacheOrders[kode] = pre;
    const cached = findOrder(kode);
    const m = modal.open({ title: kode, size: 'right', body: cached ? '' : '<div class="p-5"><div class="skel h-72"></div></div>', footer: '<div></div>' });
    m.el.dataset.kode = kode; N.actions(m.el, { next: (t) => geser(t.dataset.k, t), pay: (t) => bukaBayar(t.dataset.k), cancel: (t) => bukaBatal(t.dataset.k), wa: (t) => bukaWa(t.dataset.k) });
    if (cached) fillDetail(m, cached, null);
    const r = await api('adminGetOrder', { kode: kode }, { silent: !!cached });
    if (m.closed) return;
    if (r.success) { A.cacheOrders[kode] = r.data.order; fillDetail(m, r.data.order, r.data.log); } else if (!cached) m.body.innerHTML = '<div class="p-6 text-center text-sm font-semibold text-bad">' + esc(r.message) + '</div>';
  }
  A.openOrder = bukaDetail;

  /* ============================== HALAMAN: ANTRIAN ============================== */
  function pageAntrian() {
    let el;
    const hariIni = () => A.hari || '';
    function bucket() {
      const b = { bayar: [], ambil: [], antar: [], preorder: [] }, h = hariIni();
      A.orders.forEach((o) => {
        if (tertutup(o) || o.status_order === 'Selesai') return;
        if (perluBayar(o)) b.bayar.push(o);
        else if (o.tipe === 'Preorder' && o.tanggal_target > h) b.preorder.push(o);
        else (o.cara_terima === 'Antar' ? b.antar : b.ambil).push(o);
      });
      b.bayar.sort((x, y) => (x.status_bayar === 'Menunggu Konfirmasi' ? 0 : 1) - (y.status_bayar === 'Menunggu Konfirmasi' ? 0 : 1) || (x.dibuat_pada < y.dibuat_pada ? -1 : 1));
      ['ambil', 'antar'].forEach((k) => b[k].sort((x, y) => (x.dibuat_pada < y.dibuat_pada ? -1 : 1)));
      b.preorder.sort((x, y) => (x.tanggal_target < y.tanggal_target ? -1 : x.tanggal_target > y.tanggal_target ? 1 : x.dibuat_pada < y.dibuat_pada ? -1 : 1));
      return b;
    }
    function kartu(o) {
      const n = nextOf(o);
      return '<article class="card p-4" data-kode="' + o.kode + '"><div class="flex items-start gap-3"><button class="min-w-0 flex-1 text-left" data-act="detail" data-k="' + o.kode + '"><div class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="font-display text-lg font-extrabold text-deep tnum">' + o.kode + '</span>' + N.pillSumber(o.sumber) + '<span class="text-xs text-muted tnum">' + esc(jam(o.dibuat_pada)) + '</span></div>' +
        '<p class="mt-0.5 truncate font-semibold text-deep">' + esc(o.nama) + '</p><p class="mt-0.5 line-clamp-2 text-sm text-muted">' + esc(ringkasItem(o)) + '</p>' +
        (o.catatan ? '<p class="mt-1 flex gap-1.5 text-xs font-semibold text-warn">' + ic('info', 'mt-0.5 size-3.5 shrink-0') + esc(o.catatan) + '</p>' : '') + '</button>' +
        '<div class="text-right"><p class="font-display text-lg font-extrabold text-deep tnum">' + rp(o.total) + '</p><div class="mt-1 flex flex-col items-end gap-1">' + N.pillBayar(o.status_bayar) + N.pillOrder(o.status_order) + '</div></div></div>' +
        (o.serah_langsung && o.status_bayar !== 'Lunas' && !tertutup(o) ? '<p class="mt-2 flex items-center gap-1.5 text-xs font-bold text-ocean">' + ic('store', 'size-3.5') + 'Ambil di lapak · serahkan setelah Paid</p>' : '') +
        (o.tipe === 'Preorder' ? '<p class="mt-2 flex items-center gap-1.5 text-xs font-bold text-warn">' + ic('calendar', 'size-3.5') + 'Preorder ' + esc(tgl(o.tanggal_target)) + '</p>' : '') +
        '<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">' + orderActions(o, false) + (o.wa ? '<button class="btn btn-wa btn-sm" data-act="wa" data-k="' + o.kode + '" aria-label="WhatsApp">' + ic('wa', 'size-4') + '</button>' : '') + '<button class="btn btn-ghost btn-sm ml-auto" data-act="detail" data-k="' + o.kode + '">Detail' + ic('right', 'size-4') + '</button></div></article>';
    }
    function grupAntar(list) {
      if (!list.length) return kosong('Tidak ada pesanan antar', 'Pesanan diantar ke kelas akan dikelompokkan per lokasi di sini.');
      const g = {}; list.forEach((o) => { (g[o.lokasi || 'Tanpa lokasi'] = g[o.lokasi || 'Tanpa lokasi'] || []).push(o); });
      return Object.keys(g).sort().map((k) => {
        const arr = g[k].sort((a, b) => PREF.indexOf(a.pref_antar) - PREF.indexOf(b.pref_antar) || (a.dibuat_pada < b.dibuat_pada ? -1 : 1));
        return '<section class="mb-5"><h3 class="mb-2 flex items-center gap-2 font-display text-lg font-bold text-deep">' + ic('pin', 'size-5 text-ocean') + esc(k) + '<span class="pill pill-info">' + arr.length + ' pesanan</span></h3><div class="grid gap-3 md:grid-cols-2">' + arr.map((o) => '<div>' + (o.pref_antar ? '<p class="mb-1 ml-1 text-xs font-bold text-muted">' + esc(o.pref_antar) + '</p>' : '') + kartu(o) + '</div>').join('') + '</div></section>';
      }).join('');
    }
    const kosong = (t, s) => '<div class="rounded-3xl border-2 border-dashed border-line bg-white p-10 text-center"><div class="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-tint text-sky">' + ic('coffee', 'size-7') + '</div><p class="font-display text-lg font-bold text-deep">' + t + '</p><p class="mt-1 text-sm text-muted">' + s + '</p></div>';
    function paint() {
      if (!el) return; const b = bucket(), c = A.counts, tab = A.qTab || (b.bayar.some((o) => o.status_bayar === 'Menunggu Konfirmasi') ? 'bayar' : b.ambil.length || !b.antar.length ? 'ambil' : 'antar');
      A.qTab = tab;
      const stat = (l, v, icon, tone) => '<div class="card flex items-center gap-3 p-4"><span class="grid size-11 shrink-0 place-items-center rounded-2xl ' + tone + '">' + ic(icon, 'size-5') + '</span><div class="min-w-0"><p class="font-display text-2xl font-extrabold leading-none text-deep tnum">' + v + '</p><p class="mt-1 truncate text-xs font-semibold text-muted">' + l + '</p></div></div>';
      const TABS = [['bayar', 'Perlu Bayar', b.bayar.length], ['ambil', 'Ambil', b.ambil.length], ['antar', 'Antar', b.antar.length], ['preorder', 'Preorder', b.preorder.length]];
      const list = tab === 'antar' ? grupAntar(b.antar) : b[tab].length ? '<div class="grid gap-3 md:grid-cols-2">' + b[tab].map(kartu).join('') + '</div>' : kosong(tab === 'bayar' ? 'Tidak ada pembayaran menunggu' : tab === 'preorder' ? 'Belum ada preorder mendatang' : 'Antrian kosong', tab === 'bayar' ? 'Pesanan yang butuh konfirmasi pembayaran muncul di sini.' : 'Pesanan baru akan muncul otomatis.');
      el.innerHTML = '<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">' + stat('Pesanan baru', c.baru || 0, 'bell', 'bg-sun/25 text-warn') + stat('Menunggu konfirmasi', c.menunggu_konfirmasi || 0, 'clock', 'bg-tint text-ocean') + stat('Aktif', c.aktif || 0, 'coffee', 'bg-ok-bg text-ok') + stat('Belum bayar', c.belum_bayar || 0, 'wallet', 'bg-warn-bg text-warn') + '</div>' +
        '<div class="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">' + TABS.map((t) => '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="chip ' + (t[0] === tab ? 'on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + '<span class="ml-1 rounded-full ' + (t[0] === tab ? 'bg-white/25' : 'bg-line') + ' px-2 text-xs tnum">' + t[2] + '</span></button>').join('') + '</div><div class="mt-4">' + list + '</div>';
    }
    return {
      init(root) {
        el = root;
        N.actions(el, { tab: (t) => { A.qTab = t.dataset.v; paint(); }, detail: (t) => bukaDetail(t.dataset.k), next: (t) => geser(t.dataset.k, t), pay: (t) => bukaBayar(t.dataset.k), wa: (t) => bukaWa(t.dataset.k) });
      },
      repaint: paint, show() { paint(); }, reload: () => refreshOrders()
    };
  }

  /* ============================== HALAMAN: PESANAN (RIWAYAT) ============================== */
  function pagePesanan() {
    let el, F = { scope: 'hari', from: '', to: '', q: '', sumber: '', status_bayar: '', status_order: '' }, data = null, loading = false;
    const sel = (k, opts) => '<select class="input !min-h-11 !py-2" data-f="' + k + '" aria-label="' + k + '">' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (F[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    function frame() {
      el.innerHTML = '<div class="card p-4"><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><div class="relative sm:col-span-2 lg:col-span-2"><span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">' + ic('search', 'size-4') + '</span><input class="input !pl-10" data-f="q" placeholder="Cari kode, nama, nomor" value="' + esc(F.q) + '" aria-label="Cari pesanan"></div>' +
        sel('scope', [['hari', 'Hari ini'], ['aktif', 'Masih aktif'], ['rentang', 'Rentang tanggal']]) + sel('sumber', [['', 'Semua sumber'], ['Web', 'Web'], ['POS', 'POS']]) + sel('status_bayar', [['', 'Semua pembayaran'], ['Lunas', 'Lunas'], ['Belum Bayar', 'Belum Bayar'], ['Menunggu Konfirmasi', 'Menunggu Konfirmasi'], ['Kedaluwarsa', 'Kedaluwarsa']]) + sel('status_order', [['', 'Semua status'], ['Baru', 'Baru'], ['Diproses', 'Diproses'], ['Siap', 'Siap'], ['Diantar', 'Diantar'], ['Selesai', 'Selesai'], ['Batal', 'Batal']]) +
        '</div><div data-range class="mt-3 grid grid-cols-2 gap-3 sm:max-w-md ' + (F.scope === 'rentang' ? '' : 'hidden') + '"><input type="date" class="input" data-f="from" value="' + esc(F.from) + '" aria-label="Dari tanggal"><input type="date" class="input" data-f="to" value="' + esc(F.to) + '" aria-label="Sampai tanggal"></div></div><div class="mt-4" data-list></div>';
    }
    function listHtml() {
      const l = $('[data-list]', el); if (!l) return;
      if (!data) { l.innerHTML = '<div class="skel h-64"></div>'; return; }
      if (!data.orders.length) { l.innerHTML = '<div class="rounded-3xl border-2 border-dashed border-line bg-white p-10 text-center"><p class="font-display text-lg font-bold text-deep">Tidak ada pesanan</p><p class="mt-1 text-sm text-muted">Ubah filter untuk melihat pesanan lain.</p></div>'; return; }
      const rows = data.orders;
      l.innerHTML = '<p class="mb-2 text-sm text-muted">' + data.total + ' pesanan' + (data.total > rows.length ? ' (menampilkan ' + rows.length + ' terbaru)' : '') + '</p>' +
        '<div class="card hidden overflow-hidden md:block"><table class="tbl"><thead><tr><th>Kode</th><th>Waktu</th><th>Pembeli</th><th>Item</th><th class="text-right">Total</th><th>Status</th></tr></thead><tbody>' + rows.map((o) => '<tr class="cursor-pointer hover:bg-tint/60" data-act="detail" data-k="' + o.kode + '"><td class="font-display font-bold text-deep tnum">' + o.kode + '<span class="mt-1 block">' + N.pillSumber(o.sumber) + '</span></td><td class="whitespace-nowrap text-sm text-muted">' + esc(waktu(o.dibuat_pada)) + '</td><td class="font-semibold text-deep">' + esc(o.nama) + '</td><td class="max-w-[16rem] truncate text-sm text-muted">' + esc(ringkasItem(o)) + '</td><td class="text-right font-bold tnum">' + rp(o.total) + '</td><td><div class="flex flex-wrap gap-1">' + N.pillBayar(o.status_bayar) + N.pillOrder(o.status_order) + '</div></td></tr>').join('') + '</tbody></table></div>' +
        '<div class="grid gap-3 md:hidden">' + rows.map((o) => '<button class="card p-4 text-left" data-act="detail" data-k="' + o.kode + '"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-display text-lg font-extrabold text-deep tnum">' + o.kode + ' ' + N.pillSumber(o.sumber) + '</p><p class="truncate font-semibold text-deep">' + esc(o.nama) + '</p><p class="truncate text-sm text-muted">' + esc(ringkasItem(o)) + '</p><p class="mt-1 text-xs text-muted">' + esc(waktu(o.dibuat_pada)) + '</p></div><div class="text-right"><p class="font-bold text-deep tnum">' + rp(o.total) + '</p><div class="mt-1 flex flex-col items-end gap-1">' + N.pillBayar(o.status_bayar) + N.pillOrder(o.status_order) + '</div></div></div></button>').join('') + '</div>';
    }
    async function load() {
      if (loading) return; loading = true;
      const r = await api('adminListOrders', { scope: F.scope, from: F.from, to: F.to, q: F.q, sumber: F.sumber, status_bayar: F.status_bayar, status_order: F.status_order }, { silent: !!data });
      loading = false; if (r.success) { data = r.data; listHtml(); } else if (!data) $('[data-list]', el).innerHTML = '<div class="p-6 text-center text-sm font-semibold text-bad">' + esc(r.message) + '</div>';
    }
    const cari = N.debounce(() => load(), 350);
    return {
      init(root) {
        el = root; frame();
        el.addEventListener('input', (e) => { const k = e.target.dataset.f; if (k === 'q') { F.q = e.target.value; cari(); } });
        el.addEventListener('change', (e) => { const k = e.target.dataset.f; if (!k || k === 'q') return; F[k] = e.target.value; if (k === 'scope') $('[data-range]', el).classList.toggle('hidden', F.scope !== 'rentang'); if (k === 'scope' && F.scope === 'rentang' && !F.from) { F.from = F.to = A.hari; $$('[data-f="from"],[data-f="to"]', el).forEach((i) => (i.value = A.hari)); } load(); });
        N.actions(el, { detail: (t) => bukaDetail(t.dataset.k, data && data.orders.filter((o) => o.kode === t.dataset.k)[0]) });
      },
      show() { load(); }, reload: () => load(), onOrders() { if (A.page === 'pesanan' && !document.hidden) load(); }, onOrder() {}, repaint() {}
    };
  }

  /* ============================== ROUTER ADMIN ============================== */
  const JUDUL = { antrian: 'Antrian', pesanan: 'Pesanan', stok: 'Stok Harian', menu: 'Menu', lokasi: 'Lokasi Antar', rekap: 'Rekap Penjualan', pengaturan: 'Pengaturan' };
  const CORE = { antrian: pageAntrian, pesanan: pagePesanan };
  async function ensurePage(k, param) {
    let sec = $('[data-apage="' + k + '"]', A.main);
    if (!sec) {
      let p;
      if (CORE[k]) p = CORE[k]();
      else { try { const mod = await N.loadModule('admin2'); p = mod.make(A)[k](); } catch (e) { toast('Gagal memuat halaman. Periksa koneksi.', 'bad'); return null; } }
      sec = document.createElement('section'); sec.dataset.apage = k; sec.hidden = true; A.main.appendChild(sec); A.pages[k] = p; p.init(sec);
    }
    return sec;
  }
  async function showPage(k, param) {
    const sec = await ensurePage(k, param); if (!sec) return;
    A.page = k;
    $$('[data-apage]', A.main).forEach((s) => (s.hidden = s !== sec));
    $$('[data-nav]', A.root).forEach((a) => { const on = a.dataset.nav === k || (a.dataset.nav === 'lainnya' && BAWAH.indexOf(k) < 0); a.classList.toggle('text-ocean', on); a.classList.toggle('text-muted', !on); if (a.tagName === 'A' && a.closest('aside')) { a.classList.toggle('bg-tint', on); a.classList.toggle('text-ocean', on); } });
    $('[data-title]', A.root).textContent = JUDUL[k] || 'Admin';
    A.pages[k].show(param);
  }
  function route(segs) {
    A.root = A.root || $('#shell-admin');
    const sub = segs[1] || '';
    if (!Sesi.token) { if (sub !== 'login') return N.go('#/admin/login'); return showLogin(); }
    if (sub === 'login') return N.go('#/admin');
    if (!A.root.__built || !A.logged) {
      buildApp(); A.me = Sesi.me; startPoll();
      swr('adminBoot', 'adminBootstrap', {}, (b, cached) => { A.setBoot(b); if (!cached) badges(); }, { fresh: 10000, alwaysRender: true, onError: (r) => { A.main.innerHTML = '<div class="mx-auto mt-16 max-w-sm text-center"><p class="font-display text-lg font-bold text-deep">Belum bisa memuat data</p><p class="mt-1 text-sm text-muted">' + esc(r.message) + '</p><button class="btn btn-primary mt-4" onclick="location.reload()">Coba lagi</button></div>'; } });
    }
    const k = NAV.some((n) => n.k === sub) ? sub : 'antrian';
    if (sub && k !== sub) return N.go('#/admin/antrian');
    showPage(k, segs.slice(2));
  }

  N.register('admin', { mount(root) { A.root = root; }, route: route });
})();
