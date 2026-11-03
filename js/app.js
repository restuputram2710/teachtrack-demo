/* ==========================================================================
   TeachTrack — app.js
   Router hash (#/...), kerangka tampilan (guru: mobile + bottom nav,
   admin: sidebar desktop / bottom nav HP), halaman autentikasi.
   ========================================================================== */
(function () {
  'use strict';
  const T = TT, esc = T.esc, $ = T.$;

  const App = window.App = {
    routes: {}, cfg: { googleClientId: '' }, badge: { persetujuan: 0 }, _cleanup: null, _clock: null,
    reg(name, def) { this.routes[name] = def; },
    me() { return T.Sesi.me; },
    isAdmin() { const m = T.Sesi.me; return !!m && m.peran === 'admin'; },
    canAbsen() { const m = T.Sesi.me; return !!m && m.ikut_absen === true; },
    home() { return this.isAdmin() ? 'a/dashboard' : 'beranda'; },
    go(h, replace) { const url = '#/' + h; if (replace) { history.replaceState(null, '', url); this.render(); } else if (location.hash === url) this.render(); else location.hash = url; },
    parse() {
      const raw = (location.hash || '').replace(/^#\/?/, '');
      const qi = raw.indexOf('?'), name = (qi >= 0 ? raw.slice(0, qi) : raw) || '', params = {};
      if (qi >= 0) raw.slice(qi + 1).split('&').forEach(function (p) { const kv = p.split('='); if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
      return { name: name, params: params };
    },
    logout(msg) {
      if (window.google && google.accounts && google.accounts.id) try { google.accounts.id.disableAutoSelect(); } catch (e) { }
      T.Sesi.hapus(); if (msg) T.toast(msg, 'info'); this.go('login', true);
    },
    setBadge(n) { this.badge.persetujuan = n || 0; T.$$('[data-badge="persetujuan"]').forEach(function (b) { b.textContent = n; b.classList.toggle('hidden', !n); }); },
    async render() {
      if (this._cleanup) { try { this._cleanup(); } catch (e) { } this._cleanup = null; }
      clearInterval(this._clock);
      T.newGen();
      T.$$('.mod-root').forEach(function (m) { m.remove(); });
      const r = this.parse(); let name = r.name;
      const pub = ['login', 'darurat', 'menunggu'];
      if (!T.Sesi.token) { if (pub.indexOf(name) < 0) return this.go(T.LS.get('pend', '') ? 'menunggu' : 'login', true); }
      else {
        if (pub.indexOf(name) >= 0 || !name) return this.go(this.home(), true);
        if (T.Sesi.me && T.Sesi.me.wajib_ganti && name !== 'ganti-sandi') return this.go('ganti-sandi', true);
      }
      const def = this.routes[name];
      if (!def) return this.go(T.Sesi.token ? this.home() : 'login', true);
      if (def.admin && !this.isAdmin()) return this.go(this.home(), true);
      if (def.guru && !this.canAbsen()) { T.toast('Akun Anda tidak terdaftar ikut absen.', 'info'); return this.go(this.home(), true); }
      document.body.className = def.shell === 'admin' ? 'admin-mode' : def.shell === 'auth' ? 'auth-mode' : 'guru-mode';
      const root = $('#app');
      let view;
      if (def.shell === 'admin') view = shellAdmin(root, name, def);
      else if (def.shell === 'auth') { root.innerHTML = '<div id="view"></div>'; view = $('#view'); }
      else view = shellGuru(root, name, def, r.params);
      window.scrollTo(0, 0);
      try {
        const c = await def.render(view, r.params, def);
        if (typeof c === 'function') this._cleanup = c;
      } catch (e) {
        console.error(e);
        view.innerHTML = '<div class="empty">' + '<div class="itile">' + ic('alert', 26) + '</div><b>Terjadi kesalahan tampilan</b>' + esc(e.message) + '</div>';
      }
    }
  };

  // ------------------------------------------------------------------------
  //  KERANGKA GURU (mobile)
  // ------------------------------------------------------------------------
  function logoTile(cls) {
    const s = T.Set.v;
    return '<span class="logo-tile ' + (cls || '') + '">' + (s.logo_thumb ? '<img src="' + esc(s.logo_thumb) + '" alt="">' : ic('cap', 20)) + '</span>';
  }
  App.logoTile = logoTile;
  /** Kredit pembuat — tampil di bawah halaman masuk & setiap halaman aplikasi. */
  function kredit() { return '© ' + new Date().getFullYear() + ' ' + (T.Set.v.nama_aplikasi || 'TeachTrack') + ', site by Restu Putra Mulyana'; }
  function kreditHtml() { return '<div class="credit">© ' + new Date().getFullYear() + ' ' + esc(T.Set.v.nama_aplikasi || 'TeachTrack') + ', site by <b>Restu Putra Mulyana</b></div>'; }
  App.kreditHtml = kreditHtml;
  function shellGuru(root, name, def, params) {
    const s = T.Set.v, nav = def.nav || '';
    let top;
    if (def.brand) {
      top = '<header class="m-top"><div class="brand">' + logoTile() + '<b>' + esc(s.nama_aplikasi) + '</b></div>' +
        (App.isAdmin() ? '<a class="icon-btn" href="#/a/dashboard" aria-label="Panel admin" title="Panel admin">' + ic('grid', 21) + '</a>' : '') +
        '<button class="icon-btn" id="btnNotif" aria-label="Notifikasi">' + ic('bell', 22) + '<span class="notif-dot hidden" id="notifDot"></span></button></header>';
    } else {
      const t = typeof def.title === 'function' ? def.title(params) : def.title;
      top = '<header class="m-top"><button class="icon-btn back" id="btnBack" aria-label="Kembali">' + ic('arrowLeft', 22) + '</button>' +
        '<div class="ttl ' + (def.centerTitle ? 'center' : '') + '"><b>' + esc(t || '') + '</b>' + (def.sub ? '<span>' + esc(def.sub) + '</span>' : '') + '</div>' +
        '<div id="topAct" class="row" style="gap:2px">' + (def.topAct || '') + '</div></header>';
    }
    const navHtml = def.noNav ? '' : '<nav class="bnav" aria-label="Navigasi utama">' +
      navItem('beranda', 'home', 'Beranda', nav) + navItem('jadwal', 'calendar', 'Jadwal', nav) +
      '<a href="#/scan" class="fab-slot ' + (nav === 'scan' ? 'on' : '') + '" aria-label="Scan QR absen"><span class="fab">' + ic('scan', 26) + '</span>Scan QR</a>' +
      navItem('riwayat', 'history', 'Riwayat', nav) + navItem('profil', 'user', 'Profil', nav) + '</nav>';
    root.innerHTML = '<div class="m-shell">' + top + '<main id="view" class="page page-in ' + (def.noNav ? 'no-nav' : '') + '" data-credit="' + esc(kredit()) + '"></main>' + navHtml + '</div>';
    const back = $('#btnBack'); if (back) back.onclick = function () { if (def.onBack) return def.onBack(); if (history.length > 1 && document.referrer !== undefined && App._prev) history.back(); else App.go(def.back || 'beranda'); };
    const nb = $('#btnNotif'); if (nb) nb.onclick = function () { if (App.notifGuru) App.notifGuru(); };
    return $('#view');
  }
  function navItem(r, icon, label, cur) { return '<a href="#/' + r + '" class="' + (cur === r ? 'on' : '') + '"' + (cur === r ? ' aria-current="page"' : '') + '>' + ic(icon, 22) + label + '</a>'; }

  // ------------------------------------------------------------------------
  //  KERANGKA ADMIN (sidebar desktop + bottom nav HP)
  // ------------------------------------------------------------------------
  const MENU_ADMIN = [
    ['a/dashboard', 'grid', 'Dashboard'], ['a/absensi', 'userCheck', 'Data Absensi'], ['a/persetujuan', 'shield', 'Persetujuan', 'persetujuan'],
    ['a/guru', 'users', 'Data Guru'], ['a/tkb', 'building', 'Data TKB'], ['a/jadwal', 'calendar', 'Jadwal Mengajar'], ['a/agenda', 'calendarEdit', 'Agenda'],
    ['a/laporan', 'fileText', 'Laporan & Honor'], ['a/pengaturan', 'settings', 'Pengaturan Sistem']
  ];
  App.MENU_ADMIN = MENU_ADMIN;
  function shellAdmin(root, name, def) {
    const s = T.Set.v, me = T.Sesi.me || {};
    const items = MENU_ADMIN.map(function (m) {
      return '<a href="#/' + m[0] + '" class="' + (name === m[0] ? 'on' : '') + '">' + ic(m[1], 21) + '<span>' + m[2] + '</span>' +
        (m[3] ? '<span class="badge badge-err ' + (App.badge.persetujuan ? '' : 'hidden') + '" data-badge="' + m[3] + '">' + App.badge.persetujuan + '</span>' : '') + '</a>';
    }).join('');
    const absenSaya = App.canAbsen() ? '<div class="grp">Absen Saya</div><a href="#/beranda">' + ic('home', 21) + '<span>Beranda Guru</span></a><a href="#/scan">' + ic('scan', 21) + '<span>Scan Absen</span></a>' : '';
    const crumbs = { 'a/dashboard': 'Dashboard Overview' };
    root.innerHTML = '<div class="a-shell">' +
      '<aside class="side" id="side"><div class="brand">' + logoTile() + '<div class="grow"><b class="ellipsis">' + esc(s.nama_aplikasi) + '</b><span class="ellipsis">Admin Portal ' + esc(s.wilayah || '') + '</span></div></div>' +
      '<nav><div class="grp">Navigasi Utama</div>' + items + absenSaya + '</nav>' +
      '<div class="sys"><span class="live-dot"></span><span class="grow">Online · GAS Synced</span><span class="mono muted xs">v' + T.VER + '</span></div>' +
      '<div class="me">' + T.avatar(me.nama) + '<div class="grow" style="min-width:0"><b class="ellipsis">' + esc(me.nama || '-') + '</b><span>' + (me.darurat ? 'Akses Darurat' : 'Administrator') + '</span></div>' +
      '<button class="icon-btn" id="btnOut" aria-label="Keluar" title="Keluar">' + ic('logOut', 20) + '</button></div></aside>' +
      '<div class="scrim hidden" id="scrim"></div>' +
      '<div class="a-main"><header class="a-top"><button class="icon-btn menu-btn" id="btnMenu" aria-label="Buka menu">' + ic('menu', 22) + '</button>' +
      '<div class="crumb grow"><span class="only-d">Admin Portal</span><span class="only-d">' + ic('chevronRight', 14) + '</span><b class="ellipsis">' + esc(crumbs[name] || def.title || '') + '</b></div>' +
      '<span class="clock" id="clock">' + ic('clock', 16) + '<span>--:--:-- WIB</span></span>' +
      '<a class="icon-btn" href="#/a/persetujuan" aria-label="Persetujuan menunggu">' + ic('bell', 22) + '<span class="notif-dot ' + (App.badge.persetujuan ? '' : 'hidden') + '" data-badge-dot></span></a></header>' +
      '<main id="view" class="a-page page-in" data-credit="' + esc(kredit()) + '"></main></div>' +
      '<nav class="bnav bnav-a ' + (App.canAbsen() ? '' : 'n4') + '" aria-label="Navigasi admin">' +
      navItem('a/dashboard', 'grid', 'Dashboard', name) + navItem('a/absensi', 'userCheck', 'Absensi', name) +
      (App.canAbsen() ? '<a href="#/scan" class="fab-slot"><span class="fab">' + ic('scan', 26) + '</span>Scan QR</a>' : '') +
      navItem('a/laporan', 'fileText', 'Laporan', name) +
      '<button id="btnMenu2" class="' + (['a/dashboard', 'a/absensi', 'a/laporan'].indexOf(name) < 0 ? 'on' : '') + '">' + ic('menu', 22) + 'Menu<span class="badge badge-err ' + (App.badge.persetujuan ? '' : 'hidden') + '" data-badge="persetujuan">' + App.badge.persetujuan + '</span></button></nav></div>';
    const side = $('#side'), scrim = $('#scrim');
    const open = function () { side.classList.add('open'); scrim.classList.remove('hidden'); };
    const close = function () { side.classList.remove('open'); scrim.classList.add('hidden'); };
    $('#btnMenu').onclick = open; $('#btnMenu2').onclick = open; scrim.onclick = close;
    side.querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', close); });
    $('#btnOut').onclick = async function () { if (await T.confirm({ title: 'Keluar dari akun?', sub: 'Anda perlu masuk kembali untuk membuka panel admin.', ok: 'Keluar' })) App.logout('Anda telah keluar.'); };
    const tick = function () { const c = $('#clock span'); if (c) c.textContent = T.nowWib().detik + ' WIB'; };
    tick(); App._clock = setInterval(tick, 1000);
    return $('#view');
  }

  // ------------------------------------------------------------------------
  //  LOGIN
  // ------------------------------------------------------------------------
  App.reg('login', { shell: 'auth', render: function (el) {
    const s = T.Set.v;
    T.warmUp('pub');
    el.innerHTML = '<div class="auth">' +
      '<div class="auth-logo"><div class="inner">' + (s.logo_thumb ? '<img src="' + esc(s.logo_thumb) + '" alt="Logo">' : ic('cap', 34) + '<small>' + esc((s.nama_sekolah_induk || '').slice(0, 12)) + '</small>') + '</div><span class="ver">' + ic('check', 14) + '</span></div>' +
      '<h1>' + esc(s.nama_aplikasi) + '</h1>' +
      '<div class="tag"><span class="chip chip-p chip-lg"><span class="dot"></span>' + esc(s.subjudul || s.wilayah) + '</span></div>' +
      '<p class="lead">Silakan masuk untuk melanjutkan presensi<br>belajar &amp; mengajar</p>' +
      (T.configured ? '' : '<div class="note note-err mt-16">' + ic('alertCircle', 18) + '<div><b>Konfigurasi belum lengkap.</b> Isi <span class="mono">GAS_URL</span> di <span class="mono">js/config.js</span> dengan URL /exec dari Apps Script, lalu unggah ulang.</div></div>') +
      '<form id="fLogin" class="mt-24" novalidate autocomplete="on">' +
      '<div class="field"><label class="label" for="lgUser">NIP / Username</label><div class="ifield">' + ic('user', 20) + '<input class="input" id="lgUser" name="username" autocomplete="username" inputmode="text" placeholder="Contoh: 198503152010012015" required></div>' +
      '<div class="help mono">Gunakan NIP / NUPTK / username dari admin</div></div>' +
      '<div class="field"><label class="label" for="lgPass">Kata Sandi <button type="button" class="link" id="lnkLupa">Lupa sandi?</button></label><div class="ifield">' + ic('lock', 20) +
      '<input class="input" id="lgPass" type="password" name="password" autocomplete="current-password" placeholder="Masukkan kata sandi akun" required>' +
      '<button type="button" class="icon-btn eye" id="eye" aria-label="Tampilkan sandi">' + ic('eye', 20) + '</button></div></div>' +
      '<label class="check mt-16"><input type="checkbox" id="lgIngat" checked> Simpan sesi login di perangkat ini</label>' +
      '<div id="lgErr" class="note note-err mt-12 hidden" role="alert"></div>' +
      '<button class="btn btn-primary btn-block btn-lg mt-16" id="btnLogin" type="submit">Masuk ' + ic('arrowRight', 20) + '</button></form>' +
      '<div class="or">atau masuk lebih cepat</div><div class="gbtn-wrap" id="gbtn"></div>' +
      '<div class="card card-pad mt-20 row gap-12" style="background:var(--bg);box-shadow:none"><span class="itile itile-sm">' + ic('headset', 20) + '</span><div class="grow small"><b class="b" style="font-family:var(--f-head)">Kendala akses akun?</b><div class="muted">Hubungi operator TKB atau admin sekolah.</div></div><button class="link" id="lnkBantu">Bantuan</button></div>' +
      '<div class="auth-foot"><div class="row">' + ic('building', 15) + ' ' + esc(s.wilayah || '') + ' Induk ' + esc(s.nama_sekolah_induk || '') + ' • <span class="mono">Versi ' + T.VER + '</span></div><div>Dikelola untuk kemudahan presensi guru pamong di Tempat Kegiatan Belajar (TKB)</div>' + kreditHtml() + '</div></div>';
    $('#eye').onclick = function () { const p = $('#lgPass'); p.type = p.type === 'password' ? 'text' : 'password'; this.innerHTML = ic(p.type === 'password' ? 'eye' : 'eyeOff', 20); };
    const bantuan = function () {
      const wa = T.waLink(s.kontak_admin_wa, 'Halo admin ' + s.nama_aplikasi + ', saya butuh bantuan akses akun. NIP saya: ');
      T.modal({ title: 'Bantuan akses akun', body: '<div class="col gap-12"><div class="note note-p">' + ic('info', 18) + '<div>Kata sandi hanya bisa direset oleh <b>admin</b>. Hubungi admin dengan menyebutkan NIP/username Anda. Setelah direset, Anda wajib membuat sandi baru saat masuk.</div></div>' +
        (wa ? '<a class="btn btn-ok btn-block" target="_blank" rel="noopener" href="' + wa + '">' + ic('message', 20) + ' Hubungi Admin via WhatsApp</a>' : '<div class="muted small center">Nomor WhatsApp admin belum diatur. Hubungi admin sekolah secara langsung.</div>') + '</div>' });
    };
    $('#lnkLupa').onclick = bantuan; $('#lnkBantu').onclick = bantuan;
    $('#fLogin').onsubmit = async function (e) {
      e.preventDefault();
      const u = $('#lgUser').value.trim(), p = $('#lgPass').value, err = $('#lgErr');
      err.classList.add('hidden');
      if (!u || !p) { err.innerHTML = ic('alertCircle', 18) + '<div>Isi NIP/username dan kata sandi.</div>'; err.classList.remove('hidden'); return; }
      const btn = $('#btnLogin');
      const r = await T.withBtn(btn, function () { return T.api('auth.login', { username: u, password: p, ingat: $('#lgIngat').checked }); });
      if (!r.success) { err.innerHTML = ic('alertCircle', 18) + '<div>' + esc(r.message) + '</div>'; err.classList.remove('hidden'); return; }
      masuk(r.data);
    };
    pasangGoogle($('#gbtn'));
  } });

  function masuk(d) {
    T.LS.del('pend'); T.Cache.drop();
    T.Sesi.simpan(d.token, d.me);
    if (d.set) T.Set.terapkan(d.set);
    T.toast('Selamat datang, ' + (d.me.nama || '') + '!', 'ok');
    T.warmUp(d.me.peran === 'admin' ? 'admin' : 'pub');
    App.go(d.me.wajib_ganti ? 'ganti-sandi' : App.home(), true);
  }
  App.masuk = masuk;

  async function pasangGoogle(box) {
    const fallback = function (msg) {
      box.innerHTML = '<button class="btn btn-outline btn-block btn-lg" type="button" id="gFake">' + ic('google', 20) + ' Masuk dengan Google</button>';
      $('#gFake').onclick = function () { T.toast(msg, 'info', 4500); };
    };
    let cid = App.cfg.googleClientId;
    if (!cid && T.configured) { const r = await T.api('app.config'); if (r.success) { App.cfg.googleClientId = r.data.googleClientId || ''; cid = App.cfg.googleClientId; T.Set.terapkan(r.data.set); } }
    if (!cid) return fallback('Login Google belum diaktifkan admin. Gunakan NIP & kata sandi.');
    try {
      await T.loadScript(T.LIB.gis);
      google.accounts.id.initialize({ client_id: cid, callback: onGoogle, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true });
      box.innerHTML = '';
      google.accounts.id.renderButton(box, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'center', width: Math.min(400, box.clientWidth || 360), locale: 'id' });
    } catch (e) { fallback('Layanan Google tidak dapat dimuat. Periksa koneksi atau gunakan NIP & kata sandi.'); }
  }
  async function onGoogle(resp) {
    const r = await T.api('auth.google', { credential: resp.credential, ingat: true });
    if (!r.success) return T.toast(r.message, 'err', 6000);
    if (r.data.pending) { T.LS.set('pend', { token: r.data.token, email: r.data.email, nama: r.data.nama }); return App.go('menunggu', true); }
    masuk(r.data);
  }

  // ------------------------------------------------------------------------
  //  MENUNGGU PERSETUJUAN (akun Google baru)
  // ------------------------------------------------------------------------
  App.reg('menunggu', { shell: 'auth', render: function (el) {
    const pend = T.LS.get('pend', null);
    if (!pend) return App.go('login', true);
    const s = T.Set.v, wa = T.waLink(s.kontak_admin_wa, 'Halo admin, mohon persetujuan akun Google saya: ' + pend.email);
    el.innerHTML = '<div class="auth" style="padding-top:0">' +
      '<div class="row-b" style="margin:0 -20px;padding:16px 20px;border-bottom:1px solid var(--line)"><b style="font:700 17px var(--f-head)">VERIFIKASI AKUN</b><span class="chip chip-warn chip-lg">' + ic('hourglass', 14) + ' Pending</span></div>' +
      '<div class="center mt-24"><div style="width:120px;height:120px;margin:0 auto;border-radius:50%;background:var(--p-50);display:flex;align-items:center;justify-content:center;position:relative"><div style="width:80px;height:80px;border-radius:50%;background:#FEF3C7;color:#D97706;display:flex;align-items:center;justify-content:center">' + ic('hourglass', 36) + '</div><span style="position:absolute;right:6px;bottom:6px;width:34px;height:34px;border-radius:50%;background:var(--p);color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center">' + ic('clock', 16) + '</span></div></div>' +
      '<h1 style="font-size:23px;margin-top:20px">Akun Anda Menunggu Persetujuan</h1>' +
      '<p class="lead">Terima kasih telah mendaftar. Akun Google Anda sudah terhubung dan sedang dalam antrean verifikasi oleh admin ' + esc(s.nama_aplikasi) + '.</p>' +
      '<div class="card card-pad mt-20"><div class="row eyebrow" style="padding-bottom:12px;border-bottom:1px solid var(--line-2)"><span class="itile itile-xs">' + ic('user', 16) + '</span>Email Terhubung</div>' +
      '<div class="row-b mt-12" style="padding:12px;border-radius:12px;background:var(--bg);border:1px solid var(--line)"><span class="row mono small ellipsis">' + ic('mail', 18) + esc(pend.email) + '</span><span class="row small" style="color:var(--ok-tx)">' + ic('checkCircle', 16) + 'Terverifikasi</span></div>' +
      (pend.nama ? '<div class="small muted mt-12">Nama akun Google</div><div class="row b mt-4">' + ic('cap', 18) + esc(pend.nama) + '</div>' : '') + '</div>' +
      '<div class="card card-pad card-tint mt-16 row" style="align-items:flex-start;gap:14px"><span class="itile itile-sm" style="background:var(--p);color:#fff">' + ic('shield', 20) + '</span><div><h4>Proses Validasi</h4><p class="small muted mt-4">Admin akan mencocokkan akun ini dengan data NIP dan TKB penugasan Anda. Setelah disetujui, tekan "Periksa Status Ulang".</p></div></div>' +
      '<div id="pendMsg"></div>' +
      '<button class="btn btn-outline-p btn-block btn-lg mt-20" id="btnCek">' + ic('refresh', 20) + ' Periksa Status Ulang</button>' +
      '<button class="btn btn-danger-soft btn-block btn-lg mt-12" id="btnKeluar">' + ic('logOut', 20) + ' Keluar dari Akun</button>' +
      (wa ? '<a class="card card-pad mt-20 center small" style="display:block" target="_blank" rel="noopener" href="' + wa + '"><div class="muted">Butuh persetujuan segera?</div><div class="b mt-4" style="color:var(--p);font-family:var(--f-head)">' + ic('message', 16) + ' Hubungi Admin via WhatsApp</div></a>' : '') +
      '<div class="auth-foot">' + esc(s.nama_aplikasi) + ' • ' + esc(s.wilayah || '') + kreditHtml() + '</div></div>';
    const cek = async function (diam) {
      const r = await T.withBtn($('#btnCek'), function () { return T.api('auth.status', {}, { token: pend.token }); });
      if (!r.success) { if (r.code === 'AUTH') { T.LS.del('pend'); T.toast('Sesi verifikasi berakhir. Silakan masuk dengan Google lagi.', 'warn'); return App.go('login', true); } if (!diam) T.toast(r.message, 'err'); return; }
      if (r.data.approved) return masuk(r.data);
      if (r.data.ditolak) { $('#pendMsg').innerHTML = '<div class="note note-err mt-16">' + ic('xCircle', 18) + '<div>Permintaan akun ini <b>ditolak</b> admin. Hubungi admin sekolah bila ini keliru.</div></div>'; return; }
      if (!diam) T.toast('Akun masih menunggu persetujuan admin.', 'info');
    };
    $('#btnCek').onclick = function () { cek(false); };
    $('#btnKeluar').onclick = function () { T.LS.del('pend'); App.go('login', true); };
    cek(true);
    const iv = setInterval(function () { if (document.visibilityState === 'visible') cek(true); }, 45000);
    return function () { clearInterval(iv); };
  } });

  // ------------------------------------------------------------------------
  //  AKSES DARURAT (tidak ditautkan dari mana pun)
  // ------------------------------------------------------------------------
  App.reg('darurat', { shell: 'auth', render: function (el) {
    el.innerHTML = '<div class="auth"><div class="center"><span class="itile" style="width:64px;height:64px;border-radius:20px;background:var(--err-bg);color:var(--err)">' + ic('shield', 30) + '</span></div>' +
      '<h1 style="font-size:23px">Akses Darurat</h1><p class="lead">Khusus pemilik aplikasi saat akun admin tidak bisa dipakai. Setiap percobaan dicatat di log audit.</p>' +
      '<form id="fDar" class="mt-24"><div class="field"><label class="label" for="dU">Nama pengguna</label><input class="input mono" id="dU" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="dP">Kata sandi darurat</label><input class="input mono" id="dP" type="password" autocomplete="off"></div>' +
      '<button class="btn btn-danger btn-block btn-lg mt-20" id="bDar">Masuk Darurat</button></form><div class="auth-foot"><a href="#/login">Kembali ke halaman masuk</a>' + kreditHtml() + '</div></div>';
    $('#fDar').onsubmit = async function (e) {
      e.preventDefault();
      const r = await T.withBtn($('#bDar'), function () { return T.api('auth.darurat', { username: $('#dU').value.trim(), password: $('#dP').value }); });
      if (!r.success) return T.toast(r.message, 'err');
      masuk(r.data);
    };
  } });

  // ------------------------------------------------------------------------
  //  GANTI SANDI (wajib saat login pertama / setelah reset)
  // ------------------------------------------------------------------------
  App.formSandi = function (wajib) {
    return '<form id="fSandi" novalidate>' +
      '<div class="field"><label class="label" for="sLama">Kata sandi ' + (wajib ? 'sementara (dari admin)' : 'lama') + '</label><input class="input" id="sLama" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label class="label" for="sBaru">Kata sandi baru</label><input class="input" id="sBaru" type="password" autocomplete="new-password"><div class="help">Minimal 8 karakter, memuat huruf dan angka.</div></div>' +
      '<div class="field"><label class="label" for="sUlang">Ulangi kata sandi baru</label><input class="input" id="sUlang" type="password" autocomplete="new-password"></div>' +
      '<button class="btn btn-primary btn-block btn-lg mt-20" id="bSandi">Simpan Kata Sandi</button></form>';
  };
  App.pasangFormSandi = function (onOk) {
    $('#fSandi').onsubmit = async function (e) {
      e.preventDefault();
      const lama = $('#sLama').value, baru = $('#sBaru').value, ulang = $('#sUlang').value;
      if (baru !== ulang) return T.toast('Ulangi kata sandi baru dengan benar.', 'warn');
      if (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) return T.toast('Sandi baru minimal 8 karakter, memuat huruf dan angka.', 'warn');
      const r = await T.withBtn($('#bSandi'), function () { return T.api('auth.gantiSandi', { lama: lama, baru: baru }); });
      if (!r.success) return T.toast(r.message, 'err');
      T.Sesi.setMe(r.data.me); T.toast(r.message, 'ok'); onOk && onOk();
    };
  };
  App.reg('ganti-sandi', { shell: 'auth', render: function (el) {
    const me = T.Sesi.me || {};
    el.innerHTML = '<div class="auth"><div class="center"><span class="itile" style="width:64px;height:64px;border-radius:20px">' + ic('key', 30) + '</span></div>' +
      '<h1 style="font-size:23px">Buat Kata Sandi Baru</h1><p class="lead">Halo <b>' + esc(me.nama || '') + '</b>, demi keamanan akun, ganti kata sandi sementara Anda sebelum melanjutkan.</p>' +
      '<div class="mt-24">' + App.formSandi(true) + '</div><button class="btn btn-ghost btn-block mt-12" id="bOut">' + ic('logOut', 18) + ' Keluar</button><div class="auth-foot">' + kreditHtml() + '</div></div>';
    App.pasangFormSandi(function () { App.go(App.home(), true); });
    $('#bOut').onclick = function () { App.logout(); };
  } });

  // ------------------------------------------------------------------------
  //  BOOT
  // ------------------------------------------------------------------------
  T.setAuthLost(function (msg) { App.logout(msg || 'Sesi berakhir. Silakan masuk kembali.'); });
  async function boot() {
    T.Set.terapkan();
    window.addEventListener('hashchange', function () { App._prev = true; App.render(); });
    window.addEventListener('offline', function () { T.toast('Koneksi internet terputus. Data tetap tampil dari penyimpanan terakhir.', 'warn'); });
    App.render();
    if (!T.configured) return;
    const r = await T.apiQ('app.config');
    if (r.success) {
      App.cfg.googleClientId = r.data.googleClientId || '';
      const lama = JSON.stringify(T.Set.v); T.Set.terapkan(r.data.set);
      if (JSON.stringify(T.Set.v) !== lama && ['login', 'menunggu'].indexOf(App.parse().name) >= 0) App.render();
    }
    if (T.Sesi.token) {
      const m = await T.apiQ('auth.me');
      if (m.success) {
        const beda = JSON.stringify(m.data.me) !== JSON.stringify(T.Sesi.me);
        T.Sesi.setMe(m.data.me); T.Set.terapkan(m.data.set);
        if (beda) App.render();
      }
    }
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
