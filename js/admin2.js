/* NASKA — admin2.js : Stok, Menu, Lokasi, Pengaturan, Rekap. Dimuat saat salah satunya dibuka. */
(function () {
  'use strict';
  const { $, $$, esc, rp, ic, api, Sesi, toast, modal, tgl, waktu } = N;

  function make(A) {
    const kosong = (t, s, aksi) => '<div class="rounded-3xl border-2 border-dashed border-line bg-white p-10 text-center"><div class="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-tint text-sky">' + ic('coffee', 'size-7') + '</div><p class="font-display text-lg font-bold text-deep">' + t + '</p><p class="mt-1 text-sm text-muted">' + s + '</p>' + (aksi || '') + '</div>';
    const sw = (on, act, extra) => '<button type="button" role="switch" aria-checked="' + !!on + '" class="switch ' + (on ? 'on' : '') + '" data-act="' + act + '" ' + (extra || '') + '><span></span></button>';
    const gagal = (r) => { if (r && r.code !== 'NET') toast(r.message, 'bad', 4500); };
    /** Input gambar: pilih → kompres → unggah. Mengisi input hidden [data-img] dan pratinjau [data-prev]. */
    function bindUpload(root, sel, folder, maks, png) {
      const inp = $(sel, root); if (!inp) return;
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        const box = inp.closest('[data-upl]'), lbl = $('[data-lbl]', box), hid = $('[data-img]', box), prev = $('[data-prev]', box);
        lbl.textContent = 'Mengunggah…'; box.classList.add('opacity-70');
        try { const url = await A.uploadImage(f, folder, maks, png); hid.value = url; prev.innerHTML = '<img src="' + esc(url) + '" alt="" class="size-full object-contain" data-foto>'; lbl.textContent = 'Ganti gambar'; hid.dispatchEvent(new Event('input', { bubbles: true })); toast('Gambar terunggah.', 'ok', 1800); }
        catch (e) { lbl.textContent = 'Pilih gambar'; toast(e.message || 'Gagal mengunggah.', 'bad', 4000); }
        box.classList.remove('opacity-70'); inp.value = '';
      });
    }
    const uploadBox = (id, label, url, rounded) => '<div data-upl class="flex items-center gap-3"><span data-prev class="grid size-20 shrink-0 place-items-center overflow-hidden ' + (rounded ? 'rounded-full' : 'rounded-2xl') + ' border border-line bg-tint text-sky">' + (url ? '<img src="' + esc(url) + '" alt="" class="size-full object-contain" data-foto>' : ic('image', 'size-7')) + '</span><div class="min-w-0 flex-1"><label class="btn btn-soft btn-sm cursor-pointer" for="' + id + '">' + ic('upload', 'size-4') + '<span data-lbl>' + (url ? 'Ganti gambar' : label) + '</span></label><input id="' + id + '" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"><input type="hidden" data-img value="' + esc(url || '') + '"><p class="hint">JPG, PNG, atau WebP. Otomatis dikecilkan.</p></div></div>';

    /* ============================== STOK ============================== */
    function pageStok() {
      let el, tanggal = '', data = null, loading = false;
      const lewat = () => tanggal < A.hari;
      async function load(t, force) {
        if (loading) return; loading = true; tanggal = t || tanggal || A.hari;
        const cached = tanggal === A.hari && A.boot && A.boot.stok && !force ? A.boot.stok : null;
        if (cached && !data) { data = cached; paint(); }
        const r = await api('adminGetStok', { tanggal: tanggal }, { silent: !!data }); loading = false;
        if (r.success) { data = r.data; tanggal = data.tanggal; paint(); } else if (!data) el.innerHTML = '<p class="p-6 text-center text-sm font-semibold text-bad">' + esc(r.message) + '</p>';
      }
      function paint() {
        if (!data) { el.innerHTML = '<div class="skel h-72"></div>'; return; }
        const tgls = Array.from(new Set([A.hari].concat(data.tanggal_ada || []).concat([tanggal]))).sort(), ro = lewat();
        el.innerHTML = '<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">' + tgls.map((d) => '<button class="chip ' + (d === tanggal ? 'on' : '') + '" data-act="tgl" data-v="' + d + '">' + (d === A.hari ? 'Hari ini · ' : '') + esc(tgl(d)) + '</button>').join('') +
          '<label class="chip cursor-pointer">' + ic('calendar', 'size-4') + 'Tanggal lain<input type="date" min="' + esc(A.hari) + '" class="sr-only" data-act="tglpilih"></label></div>' +
          '<div class="mt-4 rounded-2xl bg-tint p-4 text-sm text-deep"><b>Cara kerja:</b> isi jumlah cup yang <b>siap dijual</b> untuk tanggal ini. Stok Langsung dipakai pembeli yang datang hari itu, stok Preorder dipakai pemesan sebelumnya. Angka di kolom Terpesan sudah termasuk pesanan yang belum dibayar.</div>' +
          (data.rows.length ? '<div class="mt-4 grid gap-3 lg:grid-cols-2">' + data.rows.map((r) => {
            const sisaL = Math.max(0, r.stok_langsung - r.terpesan_langsung), sisaP = Math.max(0, r.stok_preorder - r.terpesan_preorder);
            const f = (k, v, min, lbl, sisa, tp) => '<div><label class="label !mb-1" for="st-' + k + r.id_menu + '">' + lbl + '</label><div class="flex items-center gap-2"><input id="st-' + k + r.id_menu + '" type="number" inputmode="numeric" min="' + min + '" max="9999" class="input tnum !w-24 text-center" data-k="' + k + '" data-id="' + esc(r.id_menu) + '" data-min="' + min + '" value="' + v + '"' + (ro ? ' disabled' : '') + '><span class="text-xs leading-tight text-muted">terpesan <b class="text-deep tnum">' + tp + '</b><br>sisa <b class="' + (sisa ? 'text-ok' : 'text-bad') + ' tnum">' + sisa + '</b></span></div></div>';
            return '<article class="card p-4' + (r.aktif ? '' : ' opacity-60') + '"><div class="mb-3 flex items-center justify-between gap-2"><div class="min-w-0"><p class="truncate font-display text-lg font-bold text-deep">' + esc(r.nama) + '</p><p class="text-xs text-muted">' + esc(r.kategori) + (r.aktif ? '' : ' · nonaktif') + '</p></div></div><div class="grid grid-cols-2 gap-4">' + f('stok_langsung', r.stok_langsung, r.terpesan_langsung, 'Langsung', sisaL, r.terpesan_langsung) + f('stok_preorder', r.stok_preorder, r.terpesan_preorder, 'Preorder', sisaP, r.terpesan_preorder) + '</div></article>';
          }).join('') + '</div>' : '<div class="mt-4">' + kosong('Belum ada menu', 'Tambahkan menu dulu di halaman Menu.') + '</div>') +
          (ro ? '<p class="mt-4 text-sm font-semibold text-warn">Tanggal ini sudah lewat, stok hanya bisa dilihat.</p>' : '<div class="sticky bottom-20 z-10 mt-5 lg:bottom-4"><div class="card flex flex-wrap items-center gap-3 p-3"><p class="min-w-0 flex-1 text-sm text-muted">Stok untuk <b class="text-deep">' + esc(tgl(tanggal)) + '</b></p><button class="btn btn-soft" data-act="samakan">Samakan Preorder = Langsung</button><button class="btn btn-primary btn-lg" data-act="simpan">Simpan Stok</button></div></div>');
      }
      async function simpan(btn) {
        const rows = data.rows.map((r) => ({ id_menu: r.id_menu, stok_langsung: +$('[data-k="stok_langsung"][data-id="' + CSS.escape(r.id_menu) + '"]', el).value || 0, stok_preorder: +$('[data-k="stok_preorder"][data-id="' + CSS.escape(r.id_menu) + '"]', el).value || 0 }));
        const r = await N.busy(btn, 'Menyimpan…', () => api('adminSaveStok', { tanggal: tanggal, rows: rows }));
        if (!r) return; if (r.success) { data = r.data; if (tanggal === A.hari) A.patchBoot({ stok: data }); paint(); toast('Stok disimpan.', 'ok'); } else gagal(r);
      }
      return {
        init(root) {
          el = root;
          N.actions(el, {
            tgl: (t) => { data = null; paint(); load(t.dataset.v); }, simpan: (t) => simpan(t),
            samakan: () => $$('[data-k="stok_langsung"]', el).forEach((i) => { const p = $('[data-k="stok_preorder"][data-id="' + CSS.escape(i.dataset.id) + '"]', el); p.value = Math.max(+i.value || 0, +p.dataset.min); })
          });
          el.addEventListener('change', (e) => { if (e.target.dataset.act === 'tglpilih' && e.target.value) { data = null; paint(); load(e.target.value); } if (e.target.dataset.k) { const mn = +e.target.dataset.min || 0; if ((+e.target.value || 0) < mn) { e.target.value = mn; toast('Tidak boleh di bawah jumlah yang sudah terpesan (' + mn + ').', 'warn', 2800); } } });
        },
        show() { if (!tanggal || tanggal < A.hari) tanggal = A.hari; load(tanggal, true); }, reload: () => load(tanggal, true), repaint() { if (data && tanggal === A.hari && A.boot && A.boot.stok && !loading) { /* data lokal tetap */ } }
      };
    }

    /* ============================== MENU ============================== */
    function pageMenu() {
      let el;
      const list = () => (A.boot && A.boot.menu) || [];
      function paint() {
        const L = list(); if (!A.boot) { el.innerHTML = '<div class="skel h-72"></div>'; return; }
        el.innerHTML = '<div class="mb-4 flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-muted">' + L.filter((m) => m.aktif).length + ' menu aktif dari ' + L.length + '. Menu tidak pernah dihapus agar riwayat pesanan tetap utuh, cukup nonaktifkan.</p><button class="btn btn-primary" data-act="tambah">' + ic('plus', 'size-5') + 'Tambah Menu</button></div>' +
          (L.length ? '<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">' + L.map((m, i) => '<article class="card flex gap-3 p-3.5' + (m.aktif ? '' : ' opacity-60') + '"><span class="size-20 shrink-0 overflow-hidden rounded-full bg-tint ring-4 ring-tint">' + N.foto(m.foto_url, m.nama) + '</span><div class="flex min-w-0 flex-1 flex-col"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="truncate font-display text-lg font-bold text-deep">' + esc(m.nama) + '</p><p class="text-xs text-muted">' + esc(m.kategori) + '</p></div>' + sw(m.aktif, 'aktif', 'data-id="' + esc(m.id_menu) + '" aria-label="Aktifkan ' + esc(m.nama) + '"') + '</div><p class="mt-1 font-display text-lg font-extrabold text-ocean tnum">' + rp(m.harga) + '</p><div class="mt-auto flex items-center gap-1 pt-2"><button class="btn btn-soft btn-sm" data-act="edit" data-id="' + esc(m.id_menu) + '">' + ic('edit', 'size-4') + 'Ubah</button><span class="ml-auto flex"><button class="icon-btn !size-9" data-act="naik" data-i="' + i + '" aria-label="Naikkan urutan"' + (i === 0 ? ' disabled' : '') + '>' + ic('up', 'size-4') + '</button><button class="icon-btn !size-9" data-act="turun" data-i="' + i + '" aria-label="Turunkan urutan"' + (i === L.length - 1 ? ' disabled' : '') + '>' + ic('down', 'size-4') + '</button></span></div></div></article>').join('') + '</div>' : kosong('Belum ada menu', 'Tambahkan menu pertama untuk mulai berjualan.', '<button class="btn btn-primary mt-4" data-act="tambah">Tambah Menu</button>'));
      }
      function form(m) {
        m = m || { nama: '', kategori: 'Kopi', harga: '', deskripsi: '', foto_url: '', aktif: true };
        const cats = Array.from(new Set(['Kopi', 'Non-Kopi', 'Makanan'].concat(list().map((x) => x.kategori).filter(Boolean))));
        const mod = modal.open({ title: m.id_menu ? 'Ubah menu' : 'Tambah menu', size: 'center', wide: true, body:
          '<div class="grid gap-6 p-5 md:grid-cols-[1fr_15rem]"><form class="grid gap-4" data-form novalidate>' +
          A.fld('Nama menu', '<input id="mn-n" class="input" data-f="nama" maxlength="60" value="' + esc(m.nama) + '" placeholder="Contoh: Kopi Susu Aren" required>', '', 'mn-n') +
          '<div class="grid gap-4 sm:grid-cols-2">' + A.fld('Kategori', '<input id="mn-k" class="input" data-f="kategori" list="mn-kl" maxlength="30" value="' + esc(m.kategori) + '"><datalist id="mn-kl">' + cats.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>', '', 'mn-k') +
          A.fld('Harga (Rp)', '<input id="mn-h" class="input tnum" data-f="harga" inputmode="numeric" value="' + (m.harga ? Number(m.harga).toLocaleString('id-ID') : '') + '" placeholder="15.000" required>', '', 'mn-h') + '</div>' +
          A.fld('Deskripsi singkat', '<textarea id="mn-d" class="input" data-f="deskripsi" maxlength="200" placeholder="Opsional">' + esc(m.deskripsi) + '</textarea>', '', 'mn-d') +
          '<div><span class="label">Foto menu</span>' + uploadBox('mn-up', 'Pilih foto', m.foto_url, true) + '<input class="input mt-2" data-f="foto_url" placeholder="atau tempel alamat gambar (https://…)" value="' + esc(m.foto_url) + '" aria-label="Alamat gambar"></div>' +
          '<label class="flex items-center gap-3"><span class="switch ' + (m.aktif ? 'on' : '') + '" role="switch" tabindex="0" data-sw><span></span></span><span class="text-sm font-semibold text-deep">Tampilkan di menu pembeli</span></label></form>' +
          '<aside><p class="label">Pratinjau kartu</p><div data-prev-card></div></aside></div>', footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>Batal</button><button class="btn btn-primary flex-1" data-ok>Simpan Menu</button></div>' });
        const root = mod.el, F = () => ({ nama: $('[data-f=nama]', root).value, kategori: $('[data-f=kategori]', root).value, harga: $('[data-f=harga]', root).value, deskripsi: $('[data-f=deskripsi]', root).value, foto_url: $('[data-f=foto_url]', root).value.trim() });
        const hargaIn = $('[data-f=harga]', root); N.moneyInput(hargaIn, () => prev()); if (m.harga) hargaIn.dataset.val = m.harga;
        const sw2 = $('[data-sw]', root); let aktif = !!m.aktif; const flip = () => { aktif = !aktif; sw2.classList.toggle('on', aktif); sw2.setAttribute('aria-checked', aktif); };
        sw2.addEventListener('click', flip); sw2.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } }); sw2.setAttribute('aria-checked', aktif);
        function prev() { const v = F(), h = +hargaIn.dataset.val || 0; $('[data-prev-card]', root).innerHTML = '<article class="card relative flex flex-col items-center p-3 pb-4 text-center"><span class="pill pill-info absolute right-2.5 top-2.5">Sisa 12</span><span class="mt-5 size-28 overflow-hidden rounded-full bg-tint ring-4 ring-tint">' + N.foto(v.foto_url, v.nama) + '</span><h3 class="mt-3 line-clamp-2 font-display text-[17px] font-bold leading-tight text-deep">' + esc(v.nama || 'Nama menu') + '</h3>' + (v.deskripsi ? '<p class="mt-0.5 line-clamp-1 text-xs text-muted">' + esc(v.deskripsi) + '</p>' : '') + '<p class="mt-1 font-display text-lg font-extrabold text-ocean tnum">' + rp(h) + '</p><span class="btn btn-primary btn-sm mt-3">' + ic('plus', 'size-4') + 'Tambah</span></article>'; }
        root.addEventListener('input', prev); bindUpload(root, '#mn-up', 'Menu', 800, false); prev();
        $('[data-ok]', mod.footer).addEventListener('click', async (e) => {
          const v = F(); if (v.nama.trim().length < 2) { toast('Nama menu minimal 2 huruf.', 'warn'); return $('[data-f=nama]', root).focus(); }
          const h = +hargaIn.dataset.val || 0; if (h <= 0) { toast('Isi harga lebih dari 0.', 'warn'); return hargaIn.focus(); }
          const r = await N.busy(e.currentTarget, 'Menyimpan…', () => api('adminSaveMenu', Object.assign({ id_menu: m.id_menu || '', aktif: aktif }, v, { harga: h })));
          if (!r) return; if (r.success) { A.patchBoot({ menu: r.data.menu }); mod.close(); paint(); toast('Menu disimpan.', 'ok'); } else gagal(r);
        });
      }
      return {
        init(root) {
          el = root;
          N.actions(el, {
            tambah: () => form(), edit: (t) => form(list().filter((m) => m.id_menu === t.dataset.id)[0]),
            aktif: async (t) => {
              const id = t.dataset.id, m = list().filter((x) => x.id_menu === id)[0], baru = !m.aktif;
              m.aktif = baru; paint();                                   // optimistik, rollback bila gagal
              const r = await api('adminSetMenuActive', { id_menu: id, aktif: baru });
              if (r.success) { A.patchBoot({ menu: r.data.menu }); toast(r.message, 'ok', 2200); } else { m.aktif = !baru; paint(); gagal(r); }
            },
            naik: (t) => geser(+t.dataset.i, -1), turun: (t) => geser(+t.dataset.i, 1)
          });
        },
        show() { paint(); }, repaint() { if (A.page === 'menu') paint(); }, reload: () => paint()
      };
      async function geser(i, d) {
        const L = list(), j = i + d; if (j < 0 || j >= L.length) return;
        const prev = L.slice(); const t = L[i]; L[i] = L[j]; L[j] = t; paint();
        const r = await api('adminReorder', { sheet: 'Menu', ids: L.map((m) => m.id_menu) });
        if (!r.success) { A.boot.menu = prev; paint(); gagal(r); } else A.patchBoot({ menu: L });
      }
    }

    /* ============================== LOKASI ============================== */
    function pageLokasi() {
      let el;
      const list = () => (A.boot && A.boot.lokasi) || [];
      function paint() {
        if (!A.boot) { el.innerHTML = '<div class="skel h-64"></div>'; return; }
        const L = list(), g = {}; L.forEach((l) => { (g[l.gedung] = g[l.gedung] || []).push(l); });
        el.innerHTML = '<div class="mb-4 flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-muted">Daftar kelas tujuan antar. Pembeli memilih Gedung → Lantai → Kelas saat checkout.</p><button class="btn btn-primary" data-act="tambah">' + ic('plus', 'size-5') + 'Tambah Lokasi</button></div>' +
          (L.length ? Object.keys(g).map((k) => '<section class="mb-5"><h3 class="mb-2 flex items-center gap-2 font-display text-lg font-bold text-deep">' + ic('pin', 'size-5 text-ocean') + esc(k) + '</h3><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">' + g[k].map((l) => '<article class="card flex items-center gap-3 p-3.5' + (l.aktif ? '' : ' opacity-60') + '"><div class="min-w-0 flex-1"><p class="truncate font-bold text-deep">' + esc(l.kelas) + '</p><p class="text-xs text-muted">Lantai ' + esc(l.lantai || '-') + '</p></div><button class="icon-btn !size-10" data-act="edit" data-id="' + esc(l.id_lokasi) + '" aria-label="Ubah ' + esc(l.kelas) + '">' + ic('edit', 'size-4') + '</button>' + sw(l.aktif, 'aktif', 'data-id="' + esc(l.id_lokasi) + '" aria-label="Aktifkan ' + esc(l.kelas) + '"') + '</article>').join('') + '</div></section>').join('') : kosong('Belum ada lokasi antar', 'Tambahkan kelas tujuan agar pembeli bisa memilih Antar.', '<button class="btn btn-primary mt-4" data-act="tambah">Tambah Lokasi</button>'));
      }
      function form(l) {
        l = l || { gedung: '', lantai: '', kelas: '', aktif: true }; const L = list(), gd = Array.from(new Set(L.map((x) => x.gedung))), lt = Array.from(new Set(L.map((x) => x.lantai)));
        const m = modal.open({ title: l.id_lokasi ? 'Ubah lokasi' : 'Tambah lokasi', size: 'center', body: '<form class="grid gap-4 p-5" novalidate>' +
          A.fld('Gedung', '<input id="lk-g" class="input" list="lk-gl" maxlength="40" value="' + esc(l.gedung) + '" placeholder="Contoh: Gedung A"><datalist id="lk-gl">' + gd.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>', '', 'lk-g') +
          '<div class="grid grid-cols-2 gap-4">' + A.fld('Lantai', '<input id="lk-l" class="input" list="lk-ll" maxlength="20" value="' + esc(l.lantai) + '" placeholder="1"><datalist id="lk-ll">' + lt.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>', '', 'lk-l') + A.fld('Kelas', '<input id="lk-k" class="input" maxlength="40" value="' + esc(l.kelas) + '" placeholder="Kelas 1A" required>', '', 'lk-k') + '</div></form>',
          footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>Batal</button><button class="btn btn-primary flex-1" data-ok>Simpan</button></div>' });
        $('[data-ok]', m.footer).addEventListener('click', async (e) => {
          const g = $('#lk-g', m.el).value.trim(), k = $('#lk-k', m.el).value.trim(); if (!g || !k) return toast('Isi gedung dan kelas.', 'warn');
          const r = await N.busy(e.currentTarget, 'Menyimpan…', () => api('adminSaveLokasi', { id_lokasi: l.id_lokasi || '', gedung: g, lantai: $('#lk-l', m.el).value.trim(), kelas: k, aktif: l.aktif }));
          if (!r) return; if (r.success) { A.patchBoot({ lokasi: r.data.lokasi }); m.close(); paint(); toast('Lokasi disimpan.', 'ok'); } else gagal(r);
        });
      }
      return {
        init(root) {
          el = root;
          N.actions(el, {
            tambah: () => form(), edit: (t) => form(list().filter((x) => x.id_lokasi === t.dataset.id)[0]),
            aktif: async (t) => { const x = list().filter((q) => q.id_lokasi === t.dataset.id)[0], baru = !x.aktif; x.aktif = baru; paint(); const r = await api('adminSetLokasiActive', { id_lokasi: x.id_lokasi, aktif: baru }); if (r.success) A.patchBoot({ lokasi: r.data.lokasi }); else { x.aktif = !baru; paint(); gagal(r); } }
          });
        },
        show() { paint(); }, repaint() { if (A.page === 'lokasi') paint(); }, reload: () => paint()
      };
    }

    /* ============================== PENGATURAN ============================== */
    const STABS = [['identitas', 'Identitas', 'tag'], ['operasional', 'Operasional', 'clock'], ['pos', 'Mode POS', 'grid'], ['pembayaran', 'Pembayaran', 'wallet'], ['template', 'Template WA', 'wa'], ['akun', 'Akun Saya', 'user']];
    const SAMPLE = { brand: 'Naska', nama: 'Raka', kode: 'NSK-0042', total: 'Rp 36.000', metode: 'QRIS', lokasi: 'Gedung A · Lt 2 · Kelas 2B', items: '2× Kopi Susu\n1× Americano' };
    function pagePengaturan() {
      let el, tab = 'identitas';
      const S = () => A.settings(), val = (k) => esc(S()[k] === undefined ? '' : S()[k]);
      const save = (btn, keys, root) => {
        const values = {}; keys.forEach((k) => { const i = $('[data-k="' + k + '"]:not([data-act])', root); if (i) values[k] = i.dataset.val !== undefined && i.dataset.money ? i.dataset.val : i.value; });
        return N.busy(btn, 'Menyimpan…', async () => { const r = await api('adminSaveSettings', { values: values }); if (r.success) { A.patchBoot({ settings: r.data.settings, toko: r.data.toko }); toast('Pengaturan disimpan.', 'ok'); } else gagal(r); return r; });
      };
      const seg = (k, opts, cur) => '<div class="seg" role="radiogroup" data-seg="' + k + '">' + opts.map((o) => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" class="' + (cur === o[0] ? 'on' : '') + '" data-act="seg" data-k="' + k + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div><input type="hidden" data-k="' + k + '" value="' + esc(cur) + '">';
      const card = (title, sub, body, keys) => '<form class="card grid gap-5 p-5 sm:p-6" data-keys="' + (keys || []).join(',') + '" novalidate><div><h2 class="font-display text-xl font-bold text-deep">' + title + '</h2>' + (sub ? '<p class="text-sm text-muted">' + sub + '</p>' : '') + '</div>' + body + (keys ? '<div><button class="btn btn-primary btn-lg" type="submit">Simpan Pengaturan</button></div>' : '') + '</form>';
      const inp = (k, label, extra, hint, type) => A.fld(label, '<input id="s-' + k + '" class="input" ' + (type ? 'type="' + type + '" ' : '') + 'data-k="' + k + '" value="' + val(k) + '" ' + (extra || '') + '>', hint, 's-' + k);
      const tabs = {
        identitas: () => card('Identitas brand', 'Nama sementara bisa diganti kapan saja. Perubahan langsung tampil di halaman pembeli.',
          '<div class="grid gap-4 sm:grid-cols-2">' + inp('nama_brand', 'Nama brand', 'maxlength="40" required') + inp('tagline', 'Tagline', 'maxlength="80"') + '</div>' +
          '<div><span class="label">Logo</span>' + uploadBox('s-logo', 'Pilih logo', S().logo_url, false) + '<input type="hidden" data-k="logo_url" value="' + val('logo_url') + '"></div>' +
          '<div class="grid gap-4 sm:grid-cols-2">' + A.fld('Warna utama', '<div class="flex items-center gap-3"><input type="color" id="s-wc" class="size-12 shrink-0 cursor-pointer rounded-xl border border-line bg-white p-1" value="' + (N.validHex(S().warna_utama) ? S().warna_utama : '#0B7BD0') + '" aria-label="Pilih warna"><input class="input tnum uppercase" data-k="warna_utama" maxlength="7" value="' + val('warna_utama') + '" aria-label="Kode warna"></div>', 'Dipakai untuk tombol dan aksen di seluruh aplikasi.') +
          inp('wa_admin', 'Nomor WhatsApp admin', 'inputmode="tel" placeholder="0812xxxxxxx"', 'Tujuan konfirmasi pembayaran dari pembeli.') + '</div>' + A.fld('Catatan footer', '<textarea class="input" data-k="catatan_footer" maxlength="200">' + val('catatan_footer') + '</textarea>', 'Tampil di bagian bawah invoice.'), ['nama_brand', 'tagline', 'logo_url', 'warna_utama', 'wa_admin', 'catatan_footer']),
        operasional: () => card('Jam operasional', 'Toko otomatis buka dan tutup mengikuti jam ini, selama stok masih ada.',
          '<div class="grid gap-4 sm:grid-cols-3">' + inp('jam_buka', 'Jam buka', 'required', '', 'time') + inp('jam_tutup', 'Jam tutup', 'required', '', 'time') + inp('batas_preorder', 'Batas preorder besok', 'required', 'Preorder untuk esok hari ditutup jam ini.', 'time') + '</div>' +
          '<div class="grid gap-4 sm:grid-cols-2">' + inp('batas_bayar_menit', 'Batas waktu bayar (menit)', 'type="number" min="1" max="240" inputmode="numeric"', 'Pesanan non-tunai yang belum dibayar otomatis kedaluwarsa dan stok dikembalikan.') + A.fld('Status toko', seg('toko_buka_manual', [['auto', 'Otomatis'], ['buka', 'Buka'], ['tutup', 'Tutup']], S().toko_buka_manual || 'auto'), 'Buka atau tutup paksa tanpa menunggu jam.') + '</div>', ['jam_buka', 'jam_tutup', 'batas_preorder', 'batas_bayar_menit', 'toko_buka_manual']),
        pos: () => card('Mode POS', 'Pengaturan untuk mode kasir di tablet.',
          '<div class="grid gap-4 sm:grid-cols-2">' + inp('pos_nomor_cepat', 'Nomor tombol cepat', 'inputmode="tel" placeholder="0812xxxxxxx"', 'Satu ketukan mengisi nomor ini untuk pelanggan yang tidak mau memberi nomor. Kosongkan untuk menonaktifkan.') + inp('pos_nama_default', 'Nama default pelanggan', 'maxlength="30"', 'Dipakai bila nama dikosongkan.') + '</div>' +
          A.fld('Status awal pesanan POS', seg('pos_status_awal', [['Selesai', 'Langsung Selesai'], ['Diproses', 'Diproses dulu']], S().pos_status_awal === 'Diproses' ? 'Diproses' : 'Selesai'), 'Pilih "Langsung Selesai" bila kopi sudah jadi dan langsung diserahkan.') +
          '<div class="grid gap-4 sm:grid-cols-2">' + inp('pos_nominal_cepat', 'Nominal uang cepat', 'placeholder="10000,20000,50000,100000"', 'Maksimal 6 angka dipisah koma. Dipakai pada pembayaran tunai.') + inp('pos_tutup_otomatis_detik', 'Tutup struk otomatis (detik)', 'type="number" min="0" max="60" inputmode="numeric"', '0 = tidak ditutup otomatis.') + '</div>', ['pos_nomor_cepat', 'pos_nama_default', 'pos_status_awal', 'pos_nominal_cepat', 'pos_tutup_otomatis_detik']),
        pembayaran: () => '<div class="card p-5 sm:p-6"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-display text-xl font-bold text-deep">Metode pembayaran</h2><p class="text-sm text-muted">Tambahkan alternatif bila QRIS tidak terbaca: rekening bank atau e-wallet lengkap dengan logo.</p></div><button class="btn btn-primary" data-act="mtambah">' + ic('plus', 'size-5') + 'Tambah Metode</button></div><div class="grid gap-3" data-mlist>' + metodeList() + '</div></div>',
        template: () => card('Template pesan WhatsApp', 'Gunakan kata kunci dalam kurung kurawal. Tersedia: <code class="rounded bg-tint px-1.5 py-0.5 text-xs">{brand} {nama} {kode} {total} {metode} {lokasi} {items}</code>',
          [['template_wa_konfirmasi_bayar', 'Konfirmasi pembayaran (dikirim pembeli ke admin)'], ['template_wa_konfirmasi', 'Pembayaran diterima (admin ke pembeli)'], ['template_wa_siap', 'Pesanan siap diambil'], ['template_wa_antar', 'Pesanan sedang diantar'], ['template_wa_struk', 'Struk']].map((t) => '<div>' + A.fld(t[1], '<textarea id="s-' + t[0] + '" class="input min-h-24" data-k="' + t[0] + '" data-tpl maxlength="500">' + val(t[0]) + '</textarea>', '', 's-' + t[0]) + '<p class="mt-2 whitespace-pre-line rounded-2xl bg-wa/10 p-3 text-sm text-ink" data-tp="' + t[0] + '"></p></div>').join(''), ['template_wa_konfirmasi_bayar', 'template_wa_konfirmasi', 'template_wa_siap', 'template_wa_antar', 'template_wa_struk']),
        akun: () => { const a = (A.boot && A.boot.akun) || {}; return (a.sandi_awal ? '<div class="mb-4 flex gap-3 rounded-2xl bg-warn-bg p-4 text-warn">' + ic('alert', 'size-6 shrink-0') + '<div><p class="font-bold">Ganti kata sandi awal sekarang</p><p class="text-sm">Kata sandi awal tertulis di log pembuatan sistem. Gantilah sebelum dipakai berjualan.</p></div></div>' : '') +
          '<div class="grid gap-5 lg:grid-cols-2"><form class="card grid gap-4 p-5 sm:p-6" data-pw novalidate><div><h2 class="font-display text-xl font-bold text-deep">Ganti kata sandi</h2><p class="text-sm text-muted">Masuk sebagai <b class="text-deep">' + esc(a.username || '') + '</b>' + (a.login_terakhir ? ' · login terakhir ' + esc(waktu(a.login_terakhir)) : '') + '</p></div>' +
          A.fld('Kata sandi lama', '<input id="pw-l" type="password" class="input" autocomplete="current-password" required>', '', 'pw-l') + A.fld('Kata sandi baru', '<input id="pw-b" type="password" class="input" autocomplete="new-password" required>', 'Minimal 8 karakter, kombinasi huruf dan angka.', 'pw-b') + A.fld('Ulangi kata sandi baru', '<input id="pw-k" type="password" class="input" autocomplete="new-password" required>', '', 'pw-k') +
          '<p class="err-text hidden" data-err role="alert"></p><div><button class="btn btn-primary btn-lg" type="submit">Ganti Kata Sandi</button></div></form>' +
          '<div class="card grid content-start gap-4 p-5 sm:p-6"><div><h2 class="font-display text-xl font-bold text-deep">Sesi & keamanan</h2><p class="text-sm text-muted">Login berlaku 12 jam. Bila perangkat hilang atau dipinjam, keluarkan semua perangkat.</p></div><button class="btn btn-soft" data-act="keluarSemua">' + ic('shield', 'size-5') + 'Keluar dari semua perangkat</button><button class="btn btn-ghost !text-bad" data-act="keluarIni">' + ic('logout', 'size-5') + 'Keluar dari perangkat ini</button></div></div>'; }
      };
      const metodeList = () => { const M = (A.boot && A.boot.metode) || []; return M.length ? M.map((m, i) => '<article class="flex flex-wrap items-center gap-3 rounded-[20px] border border-line p-3.5' + (m.aktif ? '' : ' bg-tint/50 opacity-70') + '"><span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white p-1 text-ocean">' + (m.logo_url || (m.tipe === 'QRIS' && m.gambar_qr_url) ? '<img src="' + esc(m.logo_url || m.gambar_qr_url) + '" alt="" class="size-full object-contain" data-foto>' : ic(m.tipe === 'QRIS' ? 'qr' : m.tipe === 'Transfer Bank' ? 'bank' : m.tipe === 'E-Wallet' ? 'phone' : 'wallet', 'size-6')) + '</span><div class="min-w-0 flex-1"><p class="truncate font-bold text-deep">' + esc(m.nama_tampil) + '</p><p class="truncate text-xs text-muted">' + esc(m.tipe) + (m.nomor ? ' · ' + esc(m.nomor) : '') + (m.atas_nama ? ' · a.n. ' + esc(m.atas_nama) : '') + '</p></div><div class="flex items-center gap-1"><button class="icon-btn !size-9" data-act="mnaik" data-i="' + i + '" aria-label="Naikkan"' + (i === 0 ? ' disabled' : '') + '>' + ic('up', 'size-4') + '</button><button class="icon-btn !size-9" data-act="mturun" data-i="' + i + '" aria-label="Turunkan"' + (i === M.length - 1 ? ' disabled' : '') + '>' + ic('down', 'size-4') + '</button><button class="icon-btn !size-10" data-act="medit" data-id="' + esc(m.id_metode) + '" aria-label="Ubah">' + ic('edit', 'size-4') + '</button>' + sw(m.aktif, 'maktif', 'data-id="' + esc(m.id_metode) + '" aria-label="Aktifkan ' + esc(m.nama_tampil) + '"') + '</div></article>').join('') : '<p class="text-sm text-muted">Belum ada metode pembayaran.</p>'; };
      function metodeForm(m) {
        m = m || { tipe: 'QRIS', nama_tampil: '', logo_url: '', gambar_qr_url: '', nomor: '', atas_nama: '', instruksi: '', aktif: true }; let tipe = m.tipe, aktif = !!m.aktif;
        const md = modal.open({ title: m.id_metode ? 'Ubah metode pembayaran' : 'Tambah metode pembayaran', size: 'center', wide: true, body: '<form class="grid gap-4 p-5" novalidate>' +
          A.fld('Tipe', '<select id="pm-t" class="input">' + ['QRIS', 'Transfer Bank', 'E-Wallet', 'Cash'].map((t) => '<option' + (t === tipe ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>', '', 'pm-t') +
          A.fld('Nama tampil', '<input id="pm-n" class="input" maxlength="30" value="' + esc(m.nama_tampil) + '" placeholder="Contoh: QRIS, BCA, DANA" required>', '', 'pm-n') +
          '<div data-w="logo"><span class="label">Logo (opsional)</span>' + uploadBox('pm-logo', 'Pilih logo', m.logo_url, false) + '</div><div data-w="qr"><span class="label">Gambar QRIS</span>' + uploadBox('pm-qr', 'Pilih gambar QR', m.gambar_qr_url, false) + '<p class="hint">Wajib sebelum QRIS bisa diaktifkan. Unggah gambar QR yang tajam dan tidak terpotong.</p></div>' +
          '<div class="grid gap-4 sm:grid-cols-2" data-w="nomor">' + A.fld('Nomor rekening / e-wallet', '<input id="pm-no" class="input tnum" inputmode="numeric" maxlength="40" value="' + esc(m.nomor) + '">', '', 'pm-no') + A.fld('Atas nama', '<input id="pm-an" class="input" maxlength="60" value="' + esc(m.atas_nama) + '">', '', 'pm-an') + '</div>' +
          A.fld('Instruksi untuk pembeli (opsional)', '<textarea id="pm-i" class="input" maxlength="200" placeholder="Contoh: Cantumkan kode pesanan di catatan transfer.">' + esc(m.instruksi) + '</textarea>', '', 'pm-i') +
          '<label class="flex items-center gap-3"><span class="switch ' + (aktif ? 'on' : '') + '" role="switch" tabindex="0" data-sw><span></span></span><span class="text-sm font-semibold text-deep">Aktifkan metode ini</span></label></form>', footer: '<div class="flex gap-3"><button class="btn btn-soft flex-1" data-close>Batal</button><button class="btn btn-primary flex-1" data-ok>Simpan</button></div>' });
        const root = md.el, vis = () => { tipe = $('#pm-t', root).value; $('[data-w=qr]', root).hidden = tipe !== 'QRIS'; $('[data-w=nomor]', root).hidden = tipe === 'Cash' || tipe === 'QRIS' && false; $('[data-w=logo]', root).hidden = tipe === 'Cash'; $('[data-w=nomor]', root).hidden = tipe === 'Cash'; };
        $('#pm-t', root).addEventListener('change', vis); vis(); bindUpload(root, '#pm-logo', 'Brand', 256, true); bindUpload(root, '#pm-qr', 'Brand', 900, false);
        const sw2 = $('[data-sw]', root), flip = () => { aktif = !aktif; sw2.classList.toggle('on', aktif); sw2.setAttribute('aria-checked', aktif); }; sw2.setAttribute('aria-checked', aktif); sw2.addEventListener('click', flip); sw2.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
        $('[data-ok]', md.footer).addEventListener('click', async (e) => {
          const n = $('#pm-n', root).value.trim(); if (!n) { toast('Isi nama tampil.', 'warn'); return $('#pm-n', root).focus(); }
          const imgs = $$('[data-img]', root), logo = imgs[0] ? imgs[0].value : '', qr = imgs[1] ? imgs[1].value : '';
          const r = await N.busy(e.currentTarget, 'Menyimpan…', () => api('adminSavePayMethod', { id_metode: m.id_metode || '', tipe: tipe, nama_tampil: n, logo_url: tipe === 'Cash' ? '' : logo, gambar_qr_url: tipe === 'QRIS' ? qr : '', nomor: tipe === 'Cash' ? '' : $('#pm-no', root).value.trim(), atas_nama: tipe === 'Cash' ? '' : $('#pm-an', root).value.trim(), instruksi: $('#pm-i', root).value.trim(), aktif: aktif }));
          if (!r) return; if (r.success) { A.patchBoot({ metode: r.data.metode }); md.close(); const l = $('[data-mlist]', el); if (l) l.innerHTML = metodeList(); toast('Metode pembayaran disimpan.', 'ok'); } else gagal(r);
        });
      }
      function paintTpl() { $$('[data-tpl]', el).forEach((t) => { const p = $('[data-tp="' + t.dataset.k + '"]', el); if (p) p.textContent = N.isiTemplate(t.value, SAMPLE); }); }
      function paint() {
        if (!A.boot) { el.innerHTML = '<div class="skel h-72"></div>'; return; }
        el.innerHTML = '<div class="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">' + STABS.map((t) => '<a role="tab" aria-selected="' + (t[0] === tab) + '" href="#/admin/pengaturan/' + t[0] + '" class="chip ' + (t[0] === tab ? 'on' : '') + '">' + ic(t[2], 'size-4') + t[1] + '</a>').join('') + '</div><div data-body>' + tabs[tab]() + '</div>';
        if (tab === 'identitas') { bindUpload(el, '#s-logo', 'Brand', 512, true); const c = $('#s-wc', el), h = $('[data-k=warna_utama]', el); c.addEventListener('input', () => (h.value = c.value.toUpperCase())); h.addEventListener('input', () => { if (N.validHex(h.value)) c.value = h.value; }); $('[data-img]', el).addEventListener('input', (e) => { $('[data-k=logo_url]', el).value = e.target.value; }); }
        if (tab === 'template') paintTpl();
      }
      return {
        init(root) {
          el = root;
          el.addEventListener('submit', async (e) => {
            e.preventDefault(); const f = e.target;
            if (f.dataset.keys) { const b = $('button[type=submit]', f); await save(b, f.dataset.keys.split(','), f); if (tab === 'identitas') $$('[data-brand-name]').forEach((x) => (x.textContent = N.brand.nama)); return; }
            if (f.hasAttribute('data-pw')) {
              const err = $('[data-err]', f); err.classList.add('hidden'); const l = $('#pw-l', f).value, b = $('#pw-b', f).value, k = $('#pw-k', f).value;
              const show = (t) => { err.textContent = t; err.classList.remove('hidden'); };
              if (!l || !b || !k) return show('Isi semua kolom.'); if (b !== k) return show('Konfirmasi kata sandi tidak sama.'); if (b.length < 8 || !/[A-Za-z]/.test(b) || !/\d/.test(b)) return show('Kata sandi baru minimal 8 karakter dan mengandung huruf dan angka.');
              const r = await N.busy($('button[type=submit]', f), 'Menyimpan…', () => api('adminChangePassword', { lama: l, baru: b, konfirmasi: k }));
              if (!r) return; if (r.success) { Sesi.set(r.data.token); A.patchBoot({ akun: Object.assign({}, A.boot.akun, { sandi_awal: false }) }); f.reset(); toast('Kata sandi diganti. Perangkat lain perlu masuk ulang.', 'ok', 4500); paint(); } else show(r.message);
            }
          });
          el.addEventListener('input', (e) => { if (e.target.hasAttribute('data-tpl')) paintTpl(); });
          N.actions(el, {
            seg: (t) => { const k = t.dataset.k; $$('[data-seg="' + k + '"] button', el).forEach((b) => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); $('input[data-k="' + k + '"]', el).value = t.dataset.v; },
            mtambah: () => metodeForm(), medit: (t) => metodeForm(A.boot.metode.filter((m) => m.id_metode === t.dataset.id)[0]),
            maktif: async (t) => { const m = A.boot.metode.filter((x) => x.id_metode === t.dataset.id)[0], baru = !m.aktif; const r = await api('adminSetPayMethodActive', { id_metode: m.id_metode, aktif: baru }); if (r.success) { A.patchBoot({ metode: r.data.metode }); $('[data-mlist]', el).innerHTML = metodeList(); toast(r.message, 'ok', 2200); } else { $('[data-mlist]', el).innerHTML = metodeList(); gagal(r); } },
            mnaik: (t) => gesM(+t.dataset.i, -1), mturun: (t) => gesM(+t.dataset.i, 1),
            keluarSemua: async () => { if (!(await N.confirm({ title: 'Keluar dari semua perangkat?', text: 'Semua perangkat, termasuk ini, harus masuk ulang.', ok: 'Keluarkan semua', danger: true }))) return; const r = await api('adminLogoutAll', {}); if (r.success) { toast('Semua perangkat dikeluarkan.', 'ok'); A.keluar(); } else gagal(r); },
            keluarIni: () => A.keluar()
          });
        },
        show(p) { const t = p && p[0]; tab = STABS.some((s) => s[0] === t) ? t : (tab || 'identitas'); paint(); }, repaint() { if (A.page === 'pengaturan' && !el.contains(document.activeElement)) paint(); }, reload: () => paint()
      };
      async function gesM(i, d) {
        const M = A.boot.metode, j = i + d; if (j < 0 || j >= M.length) return; const prev = M.slice(); const t = M[i]; M[i] = M[j]; M[j] = t; $('[data-mlist]', el).innerHTML = metodeList();
        const r = await api('adminReorder', { sheet: 'Metode_Pembayaran', ids: M.map((m) => m.id_metode) });
        if (!r.success) { A.boot.metode = prev; $('[data-mlist]', el).innerHTML = metodeList(); gagal(r); } else A.patchBoot({ metode: M });
      }
    }

    /* ============================== REKAP ============================== */
    function pageRekap() {
      let el, F = { from: '', to: '', sumber: '' }, lap = null, preset = '7';
      const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const geserHari = (s, n) => { const [y, m, d] = s.split('-').map(Number), t = new Date(y, m - 1, d + n); return iso(t); };
      function setPreset(p) {
        preset = p; const h = A.hari;
        if (p === '1') { F.from = h; F.to = h; } else if (p === '7') { F.from = geserHari(h, -6); F.to = h; } else if (p === '30') { F.from = geserHari(h, -29); F.to = h; } else if (p === 'bulan') { F.from = h.slice(0, 8) + '01'; F.to = h; }
      }
      const stat = (l, v, sub, tone) => '<div class="card p-4"><p class="text-xs font-semibold text-muted">' + l + '</p><p class="mt-1 font-display text-2xl font-extrabold ' + (tone || 'text-deep') + ' tnum">' + v + '</p>' + (sub ? '<p class="mt-0.5 text-xs text-muted">' + sub + '</p>' : '') + '</div>';
      function chart(h) {
        const W = 640, H = 220, pl = 46, pb = 28, pt = 12, pr = 8, n = h.length, maks = Math.max.apply(null, h.map((x) => x.omzet).concat([1000]));
        const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(maks))); return Math.ceil(maks / p) * p; })(), bw = (W - pl - pr) / n, ih = H - pt - pb, ket = (v) => (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + ' jt' : v >= 1e3 ? Math.round(v / 1e3) + ' rb' : v);
        const grid = [0, 0.5, 1].map((f) => { const y = pt + ih - ih * f; return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" style="stroke:#D6EAF8" stroke-width="1"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" style="fill:#5B7389;font-size:11px">' + ket(nice * f) + '</text>'; }).join('');
        const skip = Math.ceil(n / 10);
        const bars = h.map((x, i) => { const bh = Math.max(x.omzet ? 3 : 0, (x.omzet / nice) * ih), bx = pl + i * bw + bw * 0.18, w = bw * 0.64; return '<g><rect x="' + bx.toFixed(1) + '" y="' + (pt + ih - bh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="' + Math.min(6, w / 2).toFixed(1) + '" style="fill:var(--brand,#0B7BD0)"><title>' + esc(tgl(x.tanggal)) + ': ' + rp(x.omzet) + ' · ' + x.cup + ' cup</title></rect>' + (i % skip === 0 ? '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" style="fill:#5B7389;font-size:11px">' + x.tanggal.slice(8) + '/' + x.tanggal.slice(5, 7) + '</text>' : '') + '</g>'; }).join('');
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="h-auto w-full" role="img" aria-label="Grafik omzet harian">' + grid + bars + '</svg>';
      }
      function paintHasil() {
        const box = $('[data-hasil]', el); if (!lap) { box.innerHTML = '<div class="skel h-96"></div>'; return; }
        const r = lap.ringkas, maksM = Math.max.apply(null, lap.menu_terlaris.map((m) => m.qty).concat([1])), tot = r.tunai + r.non_tunai || 1;
        box.innerHTML = '<div class="print-area"><div class="mb-3 hidden print:block"><h2 class="font-display text-2xl font-extrabold">Rekap ' + esc(N.brand.nama) + '</h2><p class="text-sm">' + esc(tgl(lap.from, 1)) + ' s/d ' + esc(tgl(lap.to, 1)) + '</p></div>' +
          '<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">' + stat('Omzet (lunas)', rp(r.omzet), 'Web ' + rp(r.omzet_web) + ' · POS ' + rp(r.omzet_pos), 'text-ocean') + stat('Pesanan', r.pesanan, r.batal + ' batal/kedaluwarsa') + stat('Cup terjual', r.cup, 'Ambil ' + r.ambil + ' · Antar ' + r.antar) + stat('Belum lunas', rp(r.belum_lunas), 'Tunai ' + rp(r.tunai) + ' · Non-tunai ' + rp(r.non_tunai), r.belum_lunas ? 'text-warn' : '') + '</div>' +
          '<div class="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]"><div class="card p-4 sm:p-5"><h3 class="mb-2 font-display text-lg font-bold text-deep">Omzet harian</h3>' + (r.omzet ? chart(lap.harian) : '<p class="py-10 text-center text-sm text-muted">Belum ada penjualan lunas pada rentang ini.</p>') + '</div>' +
          '<div class="card p-4 sm:p-5"><h3 class="mb-3 font-display text-lg font-bold text-deep">Menu terlaris</h3>' + (lap.menu_terlaris.length ? '<ul class="grid gap-3">' + lap.menu_terlaris.slice(0, 6).map((m) => '<li><div class="flex justify-between gap-2 text-sm"><span class="truncate font-semibold text-deep">' + esc(m.nama) + '</span><span class="shrink-0 font-bold tnum">' + m.qty + ' cup</span></div><div class="mt-1 h-2 overflow-hidden rounded-full bg-tint"><div class="h-full rounded-full" style="width:' + Math.round((m.qty / maksM) * 100) + '%;background:var(--brand,#0B7BD0)"></div></div></li>').join('') + '</ul>' : '<p class="py-6 text-center text-sm text-muted">Belum ada data.</p>') +
          '<div class="mt-5 border-t border-dashed border-line pt-4"><p class="mb-2 text-xs font-bold text-muted">Komposisi pembayaran</p><div class="flex h-3 overflow-hidden rounded-full bg-tint"><div style="width:' + Math.round((r.tunai / tot) * 100) + '%;background:var(--brand,#0B7BD0)"></div><div class="bg-sun" style="width:' + Math.round((r.non_tunai / tot) * 100) + '%"></div></div><p class="mt-2 flex justify-between text-xs text-muted"><span><i class="mr-1 inline-block size-2 rounded-full" style="background:var(--brand,#0B7BD0)"></i>Tunai ' + rp(r.tunai) + '</span><span><i class="mr-1 inline-block size-2 rounded-full bg-sun"></i>Non-tunai ' + rp(r.non_tunai) + '</span></p></div></div></div>' +
          '<div class="card mt-4 overflow-hidden"><div class="flex items-center justify-between gap-2 border-b border-line p-4"><h3 class="font-display text-lg font-bold text-deep">Rincian transaksi</h3><span class="text-xs text-muted">' + lap.total_baris + ' baris' + (lap.total_baris > lap.baris.length ? ' (1000 pertama)' : '') + '</span></div>' +
          (lap.baris.length ? '<div class="max-h-[32rem] overflow-auto"><table class="tbl"><thead><tr><th>Tanggal</th><th>Kode</th><th>Pembeli</th><th>Item</th><th class="text-right">Total</th><th>Metode</th><th>Status</th></tr></thead><tbody>' + lap.baris.slice(0, 200).map((b) => '<tr><td class="whitespace-nowrap text-sm">' + esc(tgl(b.tanggal)) + ' ' + esc(b.waktu) + '</td><td class="font-bold tnum">' + esc(b.kode) + '</td><td>' + esc(b.nama) + '</td><td class="max-w-[14rem] truncate text-sm text-muted">' + esc(b.item) + '</td><td class="text-right font-semibold tnum">' + rp(b.total) + '</td><td class="text-sm">' + esc(b.metode) + '</td><td class="text-xs">' + esc(b.status_bayar) + ' · ' + esc(b.status_order) + '</td></tr>').join('') + '</tbody></table></div>' + (lap.baris.length > 200 ? '<p class="p-3 text-center text-xs text-muted">Menampilkan 200 baris pertama. Ekspor Excel atau CSV untuk data lengkap.</p>' : '') : '<p class="p-8 text-center text-sm text-muted">Tidak ada transaksi pada rentang ini.</p>') + '</div></div>';
      }
      async function load() {
        const r0 = ++load.n; lap = null; paintHasil();
        const r = await api('adminReport', { from: F.from, to: F.to, sumber: F.sumber });
        if (r0 !== load.n) return; if (r.success) { lap = r.data; F.from = lap.from; F.to = lap.to; $('[data-f=from]', el).value = F.from; $('[data-f=to]', el).value = F.to; paintHasil(); } else { $('[data-hasil]', el).innerHTML = '<p class="p-6 text-center text-sm font-semibold text-bad">' + esc(r.message) + '</p>'; }
      }
      load.n = 0;
      function csv() {
        if (!lap || !lap.baris.length) return toast('Tidak ada data untuk diekspor.', 'warn');
        const q = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"', kep = ['Tanggal', 'Jam', 'Kode', 'Sumber', 'Pembeli', 'Item', 'Total', 'Metode', 'Status Bayar', 'Status Order'];
        const baris = [kep.map(q).join(',')].concat(lap.baris.map((b) => [b.tanggal, b.waktu, b.kode, b.sumber, b.nama, b.item, b.total, b.metode, b.status_bayar, b.status_order].map(q).join(',')));
        A.download('Naska-rekap-' + lap.from + '_' + lap.to + '.csv', new Blob(['﻿' + baris.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      }
      async function xlsx(btn) {
        const r = await N.busy(btn, 'Menyiapkan…', () => api('adminExport', { from: F.from, to: F.to, sumber: F.sumber }));
        if (!r) return; if (!r.success) { gagal(r); if (r.code !== 'NET') toast('Gunakan tombol CSV sebagai cadangan.', 'info', 4000); return; }
        const bin = atob(r.data.base64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        A.download(r.data.filename, new Blob([u], { type: r.data.mime })); toast('File Excel diunduh.', 'ok');
      }
      return {
        init(root) {
          el = root; setPreset('7');
          el.innerHTML = '<div class="no-print card grid gap-3 p-4"><div class="no-scrollbar flex gap-2 overflow-x-auto" role="tablist">' + [['1', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['bulan', 'Bulan ini']].map((p) => '<button role="tab" class="chip" data-act="preset" data-v="' + p[0] + '">' + p[1] + '</button>').join('') + '</div>' +
            '<div class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><input type="date" class="input" data-f="from" aria-label="Dari tanggal"><input type="date" class="input" data-f="to" aria-label="Sampai tanggal"><select class="input" data-f="sumber" aria-label="Sumber"><option value="">Web + POS</option><option value="Web">Web saja</option><option value="POS">POS saja</option></select><button class="btn btn-primary" data-act="terapkan">Tampilkan</button></div>' +
            '<div class="flex flex-wrap gap-2"><button class="btn btn-soft btn-sm" data-act="xlsx">' + ic('download', 'size-4') + 'Excel</button><button class="btn btn-soft btn-sm" data-act="csv">' + ic('file', 'size-4') + 'CSV</button><button class="btn btn-soft btn-sm" data-act="pdf">' + ic('printer', 'size-4') + 'PDF / Cetak</button></div></div><div class="mt-4" data-hasil></div>';
          N.actions(el, {
            preset: (t) => { setPreset(t.dataset.v); $$('[data-act=preset]', el).forEach((b) => b.classList.toggle('on', b === t)); $('[data-f=from]', el).value = F.from; $('[data-f=to]', el).value = F.to; load(); },
            terapkan: () => { F.from = $('[data-f=from]', el).value; F.to = $('[data-f=to]', el).value; F.sumber = $('[data-f=sumber]', el).value; $$('[data-act=preset]', el).forEach((b) => b.classList.remove('on')); if (F.from && F.to && F.from > F.to) return toast('Tanggal awal harus sebelum tanggal akhir.', 'warn'); load(); },
            xlsx: (t) => xlsx(t), csv: csv, pdf: () => { if (!lap) return; window.print(); }
          });
          el.addEventListener('change', (e) => { if (e.target.dataset.f === 'sumber') { F.sumber = e.target.value; load(); } });
        },
        show() { if (!F.to || F.to < A.hari && preset !== '') { /* pertahankan pilihan */ } if (!lap) { const b = $$('[data-act=preset]', el)[1]; b && b.classList.add('on'); $('[data-f=from]', el).value = F.from; $('[data-f=to]', el).value = F.to; load(); } },
        reload: () => load(), repaint() {}
      };
    }

    return { stok: pageStok, menu: pageMenu, lokasi: pageLokasi, pengaturan: pagePengaturan, rekap: pageRekap };
  }

  N.register('admin2', { mount() {}, route() {}, make: make });
})();
