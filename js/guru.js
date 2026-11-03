/* ==========================================================================
   TeachTrack — guru.js
   Beranda, Jadwal, Agenda, Izin/Sakit, Riwayat, Honor Saya, Profil.
   Semua layar membaca 1 sumber: guru.boot (di-cache SWR di perangkat).
   ========================================================================== */
(function () {
  'use strict';
  const T = TT, esc = T.esc, $ = T.$;
  const BOOT_AGE = 20000;

  function namaPanggil(n) { return String(n || '').replace(/,.*$/, '').trim(); }
  function bootLoad(onData, opt) { return T.load('guru.boot', {}, onData, Object.assign({ maxAge: BOOT_AGE }, opt || {})); }
  App.bootGuru = bootLoad;
  function errBox(r) { return '<div class="empty"><div class="itile">' + ic('wifiOff', 26) + '</div><b>Data belum bisa dimuat</b>' + esc((r && r.message) || '') + '<div class="mt-16"><button class="btn btn-tonal btn-sm" onclick="App.render()">' + ic('refresh', 16) + ' Coba lagi</button></div></div>'; }
  function skel(n) { let s = ''; for (let i = 0; i < (n || 3); i++) s += '<div class="skel" style="height:' + (i ? 84 : 180) + 'px;margin-bottom:14px"></div>'; return s; }
  /** Status sesi relatif terhadap jam sekarang & absen hari ini */
  function statusSesi(j, hariIni, isToday) {
    if (!isToday) return { cls: '', chip: '<span class="chip chip-slate chip-sm">Terjadwal</span>' };
    const now = T.menit(T.nowWib().jam), a = hariIni.absen;
    if (a && (a.id_jadwal === j.id || (!a.id_jadwal && a.id_tkb === j.id_tkb))) return { cls: a.status === 'terlambat' ? 'late' : 'done', chip: '<span class="chip chip-ok chip-sm">' + ic('checkCircle', 13) + ' Selesai Absen</span>' };
    if (hariIni.kode === 'I' || hariIni.kode === 'S') return { cls: '', chip: '<span class="chip chip-p chip-sm">' + (hariIni.kode === 'S' ? 'Sakit' : 'Izin') + '</span>' };
    if (now > T.menit(j.selesai)) return { cls: '', chip: '<span class="chip chip-slate chip-sm">' + (a ? 'Selesai' : 'Terlewat') + '</span>' };
    if (now >= T.menit(j.mulai)) return { cls: 'now', chip: '<span class="chip chip-p chip-sm"><span class="dot"></span>Berlangsung</span>' };
    if (T.menit(j.mulai) - now <= 60) return { cls: 'now', chip: '<span class="chip chip-err chip-sm">Segera Mulai</span>' };
    return { cls: '', chip: '<span class="chip chip-slate chip-sm">Terjadwal</span>' };
  }
  function sesiCard(j, hariIni, isToday, idx) {
    const st = statusSesi(j, hariIni, isToday);
    return '<div class="sess ' + st.cls + '"><div class="row-b"><span class="time">' + ic('clock', 15) + T.jam5(j.mulai) + ' – ' + T.jam5(j.selesai) + ' WIB</span>' + st.chip + '</div>' +
      '<div class="row-b"><h4 class="ellipsis">' + esc(j.mapel) + '</h4>' + (j.kelas ? '<span class="chip chip-p chip-sm">Kelas ' + esc(j.kelas) + '</span>' : '') + '</div>' +
      '<div class="meta">' + ic('mapPin', 15) + '<span class="ellipsis">' + esc(j.tkb) + (j.ruang ? ' (' + esc(j.ruang) + ')' : '') + '</span>' + (j.minggu_ke ? '<span class="chip chip-teal chip-sm" style="flex:none">Minggu ke-' + esc(j.minggu_ke) + '</span>' : '') + (idx !== undefined ? '<span class="grow"></span><span class="mono xs">Sesi ' + (idx + 1) + '</span>' : '') + '</div></div>';
  }
  function dblock(t, past) { const d = T.parseTgl(t); return '<span class="dblock ' + (past ? 'past' : '') + '"><b>' + T.pad(d.getUTCDate()) + '</b><span>' + T.BLN3[d.getUTCMonth()] + '</span></span>'; }
  function agendaRow(g) {
    const now = T.nowWib().tgl, past = g.selesai < now;
    return '<div class="agenda-row" data-agenda="' + esc(g.id) + '">' + dblock(g.mulai, past) + '<div class="grow" style="min-width:0"><div class="b ellipsis" style="font-family:var(--f-head);font-size:14.5px">' + esc(g.judul) + '</div>' +
      '<div class="small muted ellipsis">' + esc(g.lokasi || g.kategori || '') + '</div></div><span class="mono small muted" style="white-space:nowrap">' + (g.jam_mulai ? esc(g.jam_mulai) + ' WIB' : (g.mulai !== g.selesai ? 's.d. ' + T.tglIndo(g.selesai, { pendek: true, tanpaTahun: true }) : '')) + '</span></div>';
  }
  function detailAgenda(g) {
    T.modal({ title: g.judul, sub: '<span class="chip chip-p chip-sm">' + esc(g.kategori || 'Umum') + '</span>', body:
      '<div class="col gap-12"><div class="row small">' + ic('calendar', 17) + '<span>' + T.tglIndo(g.mulai, { hari: true }) + (g.selesai !== g.mulai ? ' – ' + T.tglIndo(g.selesai, { hari: true }) : '') + '</span></div>' +
      (g.jam_mulai ? '<div class="row small">' + ic('clock', 17) + '<span class="mono">' + esc(g.jam_mulai) + (g.jam_selesai ? ' – ' + esc(g.jam_selesai) : '') + ' WIB</span></div>' : '') +
      (g.lokasi ? '<div class="row small">' + ic('mapPin', 17) + '<span>' + esc(g.lokasi) + '</span></div>' : '') +
      '<div class="row small">' + ic('users', 17) + '<span>' + (g.sasaran === 'semua' ? 'Semua guru pamong' : 'Guru tertentu (termasuk Anda)') + '</span></div>' +
      (g.deskripsi ? '<hr class="divider"><p style="white-space:pre-wrap;line-height:1.6">' + esc(g.deskripsi) + '</p>' : '') + '</div>',
      actions: [{ label: 'Tutup', cls: 'btn-outline' }] });
  }
  App.detailAgenda = detailAgenda;

  // ------------------------------------------------------------------------
  //  BERANDA
  // ------------------------------------------------------------------------
  function heroHtml(d) {
    const h = d.hariIni, set = d.set || T.Set.v, now = T.menit(T.nowWib().jam);
    const jad = (h.jadwal || []).slice().sort(function (a, b) { return T.menit(a.jam_mulai || a.mulai) - T.menit(b.jam_mulai || b.mulai); });
    const next = jad.filter(function (j) { return T.menit(j.selesai) >= now; })[0] || jad[jad.length - 1];
    const tol = Number(set.toleransi_terlambat_menit || 15);
    const batas = next ? (function () { const m = T.menit(next.mulai) + tol; return T.pad(Math.floor(m / 60)) + ':' + T.pad(m % 60); })() : '';
    const tkb = next ? (d.tkb || []).filter(function (t) { return t.id === next.id_tkb; })[0] : null;
    const radius = tkb ? tkb.radius : set.radius_gps_meter;
    let cls = '', chip, title, sub, btn, foot;
    const a = h.absen;
    if (a) {
      const k = T.ABS_ST[a.status];
      cls = k === 'H' ? 'hero-ok' : k === 'T' ? 'hero-warn' : '';
      chip = k === 'H' ? '<span class="chip chip-ok chip-lg"><span class="dot"></span>TEPAT WAKTU — ' + T.jam5(a.jam) + '</span>'
        : k === 'T' ? '<span class="chip chip-warn chip-lg"><span class="dot"></span>TERLAMBAT ' + a.menit + ' MENIT</span>'
          : '<span class="chip chip-violet chip-lg"><span class="dot"></span>DI LUAR JADWAL</span>';
      title = 'Absen hari ini sudah tercatat';
      sub = esc(a.tkb) + ' · pukul <b class="mono">' + T.jam5(a.jam) + ' WIB</b>' + (k === 'L' ? '<br><span class="small">Menunggu verifikasi admin agar dihitung honor.</span>' : '');
      btn = '<a class="btn btn-tonal btn-block" href="#/riwayat?id=' + esc(a.id) + '">' + ic('fileCheck', 19) + ' Lihat Bukti Presensi</a>';
      foot = '<span class="row">' + ic('mapPin', 14) + ' ' + (a.jarak !== null ? Math.round(a.jarak) + ' m dari titik TKB' : 'Input manual admin') + '</span><span class="mono">' + esc(a.id || '').slice(-8) + '</span>';
    } else if (h.kode === 'I' || h.kode === 'S') {
      chip = '<span class="chip chip-p chip-lg"><span class="dot"></span>' + (h.kode === 'S' ? 'SAKIT' : 'IZIN') + ' DISETUJUI</span>';
      title = T.JENIS_IZIN[h.izin.jenis] || 'Izin';
      sub = 'Berlaku ' + T.tglIndo(h.izin.mulai, { pendek: true, tanpaTahun: true }) + ' – ' + T.tglIndo(h.izin.selesai, { pendek: true }) + '. Absen tidak diperlukan hari ini.';
      btn = '<a class="btn btn-outline btn-block" href="#/izin?tab=riwayat">' + ic('fileText', 19) + ' Lihat Pengajuan</a>';
      foot = '<span>Semoga lekas pulih &amp; urusan lancar</span><span></span>';
    } else if (next) {
      const alpa = h.kode === 'A';
      chip = alpa ? '<span class="chip chip-err chip-lg"><span class="dot"></span>SESI SUDAH BERAKHIR</span>' : '<span class="chip chip-err chip-lg"><span class="dot"></span>BELUM ABSEN</span>';
      title = 'Sesi ' + (jad.indexOf(next) + 1) + ': ' + esc(next.mapel) + (next.kelas ? ' Kelas ' + esc(next.kelas) : '');
      sub = 'Jadwal: <b class="mono">' + T.jam5(next.mulai) + ' WIB</b> di ' + esc(next.tkb) + (next.ruang ? ' (' + esc(next.ruang) + ')' : '');
      btn = alpa ? '<div class="grid2"><a class="btn btn-primary" href="#/scan">' + ic('scan', 19) + ' Scan</a><a class="btn btn-outline" href="#/izin">' + ic('filePlus', 19) + ' Ajukan Izin</a></div>'
        : '<a class="btn btn-primary btn-block btn-lg" href="#/scan">' + ic('scan', 21) + ' Scan Absen Sekarang ' + ic('chevronRight', 18) + '</a>';
      foot = '<span class="row">' + ic('checkCircle', 14) + ' Toleransi: ' + tol + ' menit</span><span class="mono">Batas Hadir: ' + batas + ' WIB</span>';
    } else {
      chip = '<span class="chip chip-slate chip-lg"><span class="dot"></span>TIDAK ADA JADWAL</span>';
      title = 'Hari ini tidak ada jadwal mengajar';
      sub = 'Bila tetap mengajar di TKB, Anda bisa absen. Absen akan ditandai <b>di luar jadwal</b> dan diverifikasi admin.';
      btn = '<a class="btn btn-outline-p btn-block" href="#/scan">' + ic('scan', 19) + ' Scan Absen di Luar Jadwal</a>';
      foot = '<span>' + esc(h.hari) + ', ' + T.tglIndo(h.tanggal) + '</span><span></span>';
    }
    return '<section class="hero ' + cls + '"><div class="row-b">' + chip + '<span class="chip chip-slate chip-mono">' + ic('locate', 13) + ' Radius ' + radius + ' m</span></div>' +
      '<div class="hero-body"><div class="hero-thumb">' + ic(a ? 'checkCircle' : 'building', 34) + '<span class="pin">' + ic('mapPin', 14) + '</span></div><div class="grow" style="min-width:0">' +
      '<div class="eyebrow" style="color:var(--p)">' + (a ? 'Presensi Hari Ini' : next ? 'Jadwal Terdekat' : 'Info Hari Ini') + '</div><h3 class="mt-4">' + title + '</h3><p class="small muted mt-4">' + sub + '</p></div></div>' + btn +
      '<div class="hero-foot">' + foot + '</div></section>';
  }
  function renderBeranda(el, d) {
    const me = d.me || T.Sesi.me, h = d.hariIni, r = d.bulan.ringkasan, isToday = true;
    const sesi = (h.jadwal || []).map(function (j) { return { id: j.id_jadwal, mulai: j.jam_mulai, selesai: j.jam_selesai, mapel: j.mata_pelajaran, kelas: j.kelas, ruang: j.ruang, tkb: j.tkb, id_tkb: j.id_tkb }; });
    // hariIni.jadwal sudah berbentuk publik dari server:
    const sesiPub = (h.jadwal || []).map(function (j) { return j.mapel ? j : null; }).filter(Boolean);
    const daftar = sesiPub.length ? sesiPub : sesi;
    daftar.sort(function (a, b) { return T.menit(a.mulai) - T.menit(b.mulai); });
    const ag = (d.agenda || []).filter(function (g) { return g.selesai >= h.tanggal; }).slice(0, 3);
    const pending = (d.izin || []).filter(function (z) { return z.status === 'menunggu'; }).length;
    const dot = $('#notifDot'); if (dot) dot.classList.toggle('hidden', !pending && !ag.filter(function (g) { return g.mulai <= T.addDays(h.tanggal, 2); }).length);
    el.innerHTML =
      '<div class="greet">' + T.avatar(me.nama, 'av-lg') + '<div class="grow" style="min-width:0"><h2>' + T.salam() + ', ' + esc(namaPanggil(me.nama).split(' ').slice(0, 2).join(' ')) + '</h2>' +
      '<div class="row small muted wrap" style="gap:6px 8px">' + esc(h.hari) + ', ' + T.tglIndo(h.tanggal) + (me.nip ? '<span class="chip chip-p chip-mono chip-sm">NIP ' + esc(me.nip) + '</span>' : '') + '</div></div></div>' +
      '<div class="mt-16">' + heroHtml(d) + '</div>' +
      '<div class="sec-title"><h3>Menu Cepat</h3><span class="small muted">Layanan Mandiri</span></div>' +
      '<div class="qgrid">' + [
        ['#/scan', 'camera', 't-blue', 'Scan Absen'], ['#/jadwal', 'calendar', 't-indigo', 'Jadwal'], ['#/agenda', 'calendarCheck', 't-green', 'Agenda'],
        ['#/izin', 'calendarEdit', 't-amber', 'Ajukan Izin', pending], ['#/riwayat', 'history', 't-violet', 'Riwayat'], ['#/honor', 'wallet', 't-teal', 'Honor Saya'],
        ['#/jurnal', 'book', 't-slate', 'Jurnal'], ['bantuan', 'headset', 't-sky', 'Bantuan']
      ].map(function (q) {
        const inner = '<span class="itile ' + q[2] + '">' + ic(q[1], 24) + '</span>' + q[3] + (q[4] ? '<span class="badge badge-err">' + q[4] + '</span>' : '');
        return q[0] === 'bantuan' ? '<button class="qitem" id="qBantu">' + inner + '</button>' : '<a class="qitem" href="' + q[0] + '">' + inner + '</a>';
      }).join('') + '</div>' +
      '<div class="sec-title"><h3 class="row">Jadwal Hari Ini <span class="chip chip-p chip-sm">' + daftar.length + ' Sesi</span></h3><a class="link" href="#/jadwal">Detail ' + ic('chevronRight', 15) + '</a></div>' +
      (daftar.length ? '<div class="col gap-12">' + daftar.map(function (j, i) { return sesiCard(j, h, isToday, i); }).join('') + '</div>' : '<div class="card card-pad center muted small">' + ic('sun', 20) + '<div class="mt-8">Tidak ada sesi mengajar terjadwal hari ini.</div></div>') +
      '<div class="sec-title"><h3>Agenda Terdekat</h3><a class="link" href="#/agenda">Lihat semua ' + ic('chevronRight', 15) + '</a></div>' +
      (ag.length ? '<div class="list" id="agList">' + ag.map(agendaRow).join('') + '</div>' : '<div class="card card-pad center muted small">Belum ada agenda terdekat.</div>') +
      '<div class="sec-title"><h3 style="white-space:nowrap">Ringkasan ' + T.bulanLabel(d.bulan.kode) + '</h3><span class="mono small muted" style="white-space:nowrap">' + r.hariJadwal + ' hari jadwal</span></div>' +
      '<div class="stats5"><div class="stile st-ok"><b>' + r.hadir + '</b><span>Hadir</span></div><div class="stile st-warn"><b>' + r.T + '</b><span>Terlambat</span></div>' +
      '<div class="stile st-p"><b>' + r.I + '</b><span>Izin</span></div><div class="stile st-slate"><b>' + r.S + '</b><span>Sakit</span></div><div class="stile st-err"><b>' + r.A + '</b><span>Alpa</span></div></div>' +
      '<a class="card card-pad mt-12 row-b" href="#/honor" style="color:inherit;background:linear-gradient(135deg,#fff,var(--p-50))"><div><div class="row"><span class="eyebrow">Perkiraan Honorarium</span><span class="chip chip-ok chip-sm">Bulan Berjalan</span></div>' +
      '<div class="money mt-8">' + T.rupiah(r.honor) + '</div><div class="small muted mt-4 mono">' + r.terverifikasi + ' kehadiran × ' + T.rupiah(d.tarif) + '/sesi</div></div><span class="icon-btn" style="background:#fff;border:1px solid var(--line);border-radius:50%">' + ic('chevronRight', 20) + '</span></a>' +
      '<div class="note mt-16">' + ic('info', 18) + '<div>Jika ada kendala GPS di TKB, minta verifikasi manual ke Penanggung Jawab TKB atau admin melalui menu Bantuan.</div></div>';
    const ab = $('#agList'); if (ab) T.on(ab, 'click', '[data-agenda]', function (e, t) { const g = d.agenda.filter(function (x) { return x.id === t.getAttribute('data-agenda'); })[0]; if (g) detailAgenda(g); });
    $('#qBantu').onclick = bantuan;
  }
  function bantuan() {
    const s = T.Set.v, me = T.Sesi.me || {};
    const wa = T.waLink(s.kontak_admin_wa, 'Halo admin ' + s.nama_aplikasi + ', saya ' + (me.nama || '') + ' (NIP ' + (me.nip || '-') + ') butuh bantuan: ');
    T.modal({ title: 'Bantuan & Panduan Absen', body: '<ol style="padding-left:20px;margin:0;line-height:1.75" class="small">' +
      '<li>Datang ke TKB, tekan tombol <b>Scan QR</b> di tengah bawah.</li><li>Arahkan kamera ke QR yang ditempel di TKB.</li><li>Izinkan akses <b>lokasi</b>; tunggu sampai jarak Anda tampil &lt; ' + esc(s.radius_gps_meter) + ' m.</li>' +
      '<li>Ambil <b>foto selfie</b> di lokasi atau foto kegiatan mengajar, lalu kirim.</li><li>Absen hanya <b>1 kali per hari</b>. Terlambat bila lewat ' + esc(s.toleransi_terlambat_menit) + ' menit dari jam mulai.</li></ol>' +
      '<div class="note note-warn mt-16">' + ic('alert', 18) + '<div>GPS tidak akurat? Keluar ke area terbuka, aktifkan mode lokasi <b>akurasi tinggi</b>, lalu tekan "Segarkan GPS".</div></div>' +
      (wa ? '<a class="btn btn-ok btn-block mt-16" target="_blank" rel="noopener" href="' + wa + '">' + ic('message', 19) + ' Hubungi Admin via WhatsApp</a>' : ''),
      actions: [{ label: 'Tutup', cls: 'btn-outline' }] });
  }
  App.bantuanGuru = bantuan;

  App.reg('beranda', { shell: 'guru', guru: true, brand: true, nav: 'beranda', render: function (el) {
    el.innerHTML = skel(4);
    let first = true;
    bootLoad(function (d, m) {
      if (!d) { el.innerHTML = errBox(m.error); return; }
      renderBeranda(el, d);
      if (first && m.fromCache === false) T.Sesi.setMe(Object.assign({}, T.Sesi.me, d.me));
      first = false;
    });
    // Perbarui label status sesi tiap menit tanpa ke server
    const iv = setInterval(function () { const c = T.Cache.peek('guru.boot', {}); if (c && document.visibilityState === 'visible' && $('.hero')) renderBeranda(el, c.d); }, 60000);
    return function () { clearInterval(iv); };
  } });

  // Notifikasi ringkas (ikon lonceng)
  App.notifGuru = function () {
    const c = T.Cache.peek('guru.boot', {}); if (!c) return;
    const d = c.d, now = d.hariIni.tanggal, items = [];
    (d.izin || []).slice(0, 5).forEach(function (z) {
      items.push('<a class="li" href="#/izin?tab=riwayat"><span class="itile itile-sm ' + (z.status === 'disetujui' ? 't-green' : z.status === 'ditolak' ? 't-red' : 't-amber') + '">' + ic('fileText', 18) + '</span><div class="grow"><div class="t">' + esc(T.JENIS_IZIN[z.jenis] || z.jenis) + ' ' + T.chipIzin(z.status) + '</div><div class="s">' + T.tglIndo(z.mulai, { pendek: true }) + (z.selesai !== z.mulai ? ' – ' + T.tglIndo(z.selesai, { pendek: true }) : '') + (z.catatan ? ' · ' + esc(z.catatan) : '') + '</div></div></a>');
    });
    (d.agenda || []).filter(function (g) { return g.selesai >= now && g.mulai <= T.addDays(now, 7); }).forEach(function (g) {
      items.push('<a class="li" href="#/agenda"><span class="itile itile-sm t-green">' + ic('calendarCheck', 18) + '</span><div class="grow"><div class="t">' + esc(g.judul) + '</div><div class="s">' + T.tglIndo(g.mulai, { hari: true }) + (g.jam_mulai ? ' · ' + esc(g.jam_mulai) : '') + '</div></div></a>');
    });
    const m = T.modal({ title: 'Notifikasi', body: items.length ? '<div class="list">' + items.join('') + '</div>' : '<div class="empty"><div class="itile">' + ic('bell', 24) + '</div><b>Belum ada notifikasi</b>Status pengajuan izin & agenda 7 hari ke depan tampil di sini.</div>' });
    m.root.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { m.close(); }); });
  };

  // ------------------------------------------------------------------------
  //  JADWAL
  // ------------------------------------------------------------------------
  App.reg('jadwal', { shell: 'guru', guru: true, nav: 'jadwal', title: 'Jadwal Mengajar', sub: 'Pamong Belajar SMA Terbuka', back: 'beranda', render: function (el, p) {
    el.innerHTML = skel(3);
    const now = T.nowWib();
    // Minggu berjalan (Senin–Minggu)
    const idxHari = (T.HARI.indexOf(now.hari) + 6) % 7, senin = T.addDays(now.tgl, -idxHari);
    const week = []; for (let i = 0; i < 7; i++) week.push(T.addDays(senin, i));
    let sel = p.t && week.indexOf(p.t) >= 0 ? p.t : now.tgl;
    bootLoad(function (d, m) {
      if (!d) { el.innerHTML = errBox(m.error); return; }
      const jad = d.jadwal || [];
      const menitTotal = jad.reduce(function (a, j) { return a + Math.max(0, T.menit(j.selesai) - T.menit(j.mulai)); }, 0);
      const tkbN = {}; jad.forEach(function (j) { tkbN[j.id_tkb] = 1; });
      const draw = function () { if (!el.isConnected) return;
        const hari = T.hariOf(sel), list = jad.filter(function (j) { return j.hari === hari && T.cocokMinggu(j, sel); }).sort(function (a, b) { return T.menit(a.mulai) - T.menit(b.mulai); });
        const isToday = sel === now.tgl;
        el.innerHTML = '<div class="card card-pad"><div class="row-b"><div><span class="chip chip-p chip-sm"><span class="dot"></span>Minggu ini · ' + T.tglIndo(week[0], { pendek: true, tanpaTahun: true }) + ' – ' + T.tglIndo(week[6], { pendek: true }) + '</span>' +
          '<h3 class="mt-8">' + esc(T.Set.v.wilayah || 'SMA Terbuka') + '</h3><div class="small muted">Induk: ' + esc(T.Set.v.nama_sekolah_induk || '-') + '</div></div><span class="itile">' + ic('cap', 24) + '</span></div>' +
          '<div class="grid2 mt-16"><div class="row" style="padding:10px 12px;border-radius:12px;background:var(--bg)">' + ic('clock', 18) + '<div><div class="xs muted">Beban Mengajar</div><b class="mono small">' + (Math.round(menitTotal / 6) / 10) + ' jam / minggu</b></div></div>' +
          '<div class="row" style="padding:10px 12px;border-radius:12px;background:var(--bg)">' + ic('building', 18) + '<div><div class="xs muted">Lokasi Belajar</div><b class="mono small">' + Object.keys(tkbN).length + ' TKB Binaan</b></div></div></div></div>' +
          '<div class="row-b mt-20" style="margin-bottom:10px"><span class="eyebrow">Pilih Hari Mengajar</span><span class="xs muted row">' + ic('chevronLeft', 13) + 'Geser' + ic('chevronRight', 13) + '</span></div>' +
          '<div class="days" id="days">' + week.map(function (t) {
            const n = jad.filter(function (j) { return j.hari === T.hariOf(t) && T.cocokMinggu(j, t); }).length, dd = T.parseTgl(t);
            return '<button class="day ' + (t === sel ? 'on' : '') + (t === now.tgl ? ' today' : '') + '" data-t="' + t + '"><small>' + T.hariOf(t).slice(0, 3) + '</small><b>' + dd.getUTCDate() + '</b><i>' + (n ? n + ' Sesi' : 'Off') + '</i></button>';
          }).join('') + '</div>' +
          '<div class="row-b mt-16" style="margin-bottom:12px"><h3 class="row" style="font-size:16px"><span class="live-dot" style="background:var(--p);box-shadow:0 0 0 3px var(--p-100)"></span>' + T.tglIndo(sel, { hari: true }) + '</h3>' + (isToday ? '<span class="chip chip-ok chip-sm">Hari Ini (' + list.length + ' Sesi)</span>' : '') + '</div>' +
          (list.length ? '<div class="col gap-12">' + list.map(function (j, i) { return sesiCard(j, d.hariIni, isToday, i); }).join('') + '</div>'
            : '<div class="card card-dash card-pad center"><span class="itile" style="background:var(--slate-bg);color:var(--tx-3)">' + ic('sun', 24) + '</span><h4 class="mt-12">Tidak ada jadwal di hari ini</h4><p class="small muted mt-4">Gunakan waktu untuk persiapan bahan ajar modul PJJ mandiri.</p></div>') +
          (d.tkb && d.tkb.length ? '<button class="btn btn-outline-p btn-block mt-20" id="btnJdwPdf">' + ic('download', 19) + ' Unduh Jadwal Pelajaran TKB (PDF)</button>' : '') +
          '<div class="card card-pad card-tint mt-20 row" style="align-items:flex-start;gap:12px">' + ic('help', 22) + '<div><h4>Penyesuaian Jadwal TKB?</h4><p class="small muted mt-4">Perlu bertukar sesi atau ada perubahan jadwal? Hubungi admin agar jadwal diperbarui.</p>' +
          (T.Set.v.kontak_admin_wa ? '<a class="link mt-8" target="_blank" rel="noopener" href="' + T.waLink(T.Set.v.kontak_admin_wa, 'Halo admin, saya ingin menyesuaikan jadwal mengajar.') + '">Hubungi Admin ' + ic('arrowRight', 15) + '</a>' : '') + '</div></div>';
        T.on($('#days'), 'click', '[data-t]', function (e, b) { sel = b.getAttribute('data-t'); draw(); });
        const bj = $('#btnJdwPdf'); if (bj) bj.onclick = function () { App.unduhJadwalTkb(d.tkb, this); };
        const on = $('.day.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      };
      draw();
    });
  } });

  // ------------------------------------------------------------------------
  //  AGENDA
  // ------------------------------------------------------------------------
  App.reg('agenda', { shell: 'guru', guru: true, nav: 'jadwal', title: 'Agenda Kegiatan', sub: 'Info & kegiatan guru pamong', back: 'beranda', render: function (el) {
    el.innerHTML = skel(3);
    let filter = 'mendatang';
    bootLoad(function (d, m) {
      if (!d) { el.innerHTML = errBox(m.error); return; }
      const now = d.hariIni.tanggal, all = d.agenda || [];
      const berlangsung = all.filter(function (g) { return g.mulai <= now && g.selesai >= now; });
      const mendatang = all.filter(function (g) { return g.mulai > now; });
      const selesai = all.filter(function (g) { return g.selesai < now; }).reverse();
      const draw = function () { if (!el.isConnected) return;
        const list = filter === 'berlangsung' ? berlangsung : filter === 'selesai' ? selesai : filter === 'semua' ? all : mendatang;
        el.innerHTML = '<div class="pills">' + [['semua', 'Semua', all.length], ['berlangsung', 'Sedang Berlangsung', berlangsung.length], ['mendatang', 'Mendatang', mendatang.length], ['selesai', 'Selesai', selesai.length]].map(function (f) {
          return '<button class="pill ' + (filter === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + (f[2] ? '<span class="badge">' + f[2] + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
          (berlangsung.length && filter !== 'selesai' ? berlangsung.slice(0, 1).map(function (g) {
            return '<div class="card card-pad card-elev mt-16" style="border-color:rgba(var(--p-rgb),.35);background:linear-gradient(135deg,#fff,var(--p-50))"><div class="row-b"><span class="chip chip-ok chip-sm"><span class="dot"></span>Sedang Berlangsung</span><span class="chip chip-p chip-mono chip-sm">HARI INI</span></div>' +
              '<h3 class="mt-12">' + esc(g.judul) + '</h3><div class="col mt-8 small" style="gap:6px">' + (g.jam_mulai ? '<span class="row">' + ic('clock', 16) + '<span class="mono">' + esc(g.jam_mulai) + (g.jam_selesai ? ' – ' + esc(g.jam_selesai) : '') + ' WIB</span></span>' : '') +
              (g.lokasi ? '<span class="row">' + ic('mapPin', 16) + esc(g.lokasi) + '</span>' : '') + '<span class="row">' + ic('users', 16) + (g.sasaran === 'semua' ? 'Semua guru pamong' : 'Guru tertentu') + '</span></div>' +
              '<button class="btn btn-primary btn-block mt-16" data-agenda="' + esc(g.id) + '">Lihat Detail Lengkap ' + ic('arrowRight', 18) + '</button></div>';
          }).join('') : '') +
          '<div class="sec-title"><h3 class="row"><span style="width:4px;height:18px;border-radius:4px;background:var(--p)"></span>' + ({ semua: 'Semua Agenda', berlangsung: 'Sedang Berlangsung', mendatang: 'Agenda Mendatang', selesai: 'Agenda Selesai' })[filter] + '</h3><span class="chip chip-slate chip-sm">' + list.length + ' Agenda</span></div>' +
          (list.length ? '<div class="col gap-12">' + list.map(function (g) {
            const past = g.selesai < now;
            return '<button class="card card-pad" data-agenda="' + esc(g.id) + '" style="text-align:left;cursor:pointer;width:100%"><div class="row" style="align-items:flex-start;gap:12px">' + dblock(g.mulai, past) +
              '<div class="grow" style="min-width:0"><span class="chip chip-sm ' + (/wajib/i.test(g.kategori) ? 'chip-p' : /pengembangan|workshop/i.test(g.kategori) ? 'chip-ok' : /batas|tenggat/i.test(g.kategori) ? 'chip-warn' : 'chip-slate') + '">' + esc(g.kategori || 'Umum') + '</span>' +
              '<h4 class="mt-8" style="font-size:15.5px">' + esc(g.judul) + '</h4></div></div>' +
              '<div class="col mt-12 small muted" style="gap:6px;padding:10px 12px;border-radius:12px;background:var(--bg)">' + (g.jam_mulai ? '<span class="row">' + ic('clock', 15) + '<span class="mono">' + esc(g.jam_mulai) + (g.jam_selesai ? ' – ' + esc(g.jam_selesai) : '') + ' WIB</span></span>' : '<span class="row">' + ic('calendar', 15) + T.tglIndo(g.mulai, { pendek: true }) + (g.selesai !== g.mulai ? ' – ' + T.tglIndo(g.selesai, { pendek: true }) : '') + '</span>') +
              (g.lokasi ? '<span class="row">' + ic('mapPin', 15) + '<span class="ellipsis">' + esc(g.lokasi) + '</span></span>' : '') + '</div>' +
              '<div class="row-b mt-12 small"><span class="muted">' + (past ? 'Selesai' : g.mulai <= now ? 'Berlangsung' : 'H-' + Math.round((T.parseTgl(g.mulai) - T.parseTgl(now)) / 864e5)) + '</span><span class="link">Rincian ' + ic('chevronRight', 15) + '</span></div></button>';
          }).join('') + '</div>' : '<div class="card card-pad"><div class="empty"><div class="itile">' + ic('calendar', 24) + '</div><b>Tidak ada agenda</b>Agenda dari admin akan tampil di sini.</div></div>');
        T.on(el, 'click', '[data-f]', function (e, b) { filter = b.getAttribute('data-f'); draw(); });
      };
      T.on(el, 'click', '[data-agenda]', function (e, b) { const g = all.filter(function (x) { return x.id === b.getAttribute('data-agenda'); })[0]; if (g) detailAgenda(g); });
      draw();
    });
  } });

  // ------------------------------------------------------------------------
  //  IZIN / SAKIT
  // ------------------------------------------------------------------------
  App.reg('izin', { shell: 'guru', guru: true, nav: '', title: 'Ajukan Izin / Sakit', sub: 'Ketidakhadiran guru pamong', back: 'beranda', render: function (el, p) {
    el.innerHTML = skel(3);
    let tab = p.tab === 'riwayat' ? 'riwayat' : 'form';
    const st = { jenis: 'sakit', mulai: T.nowWib().tgl, selesai: T.nowWib().tgl, alasan: '', lampiran: '', lampNama: '' };
    bootLoad(function (d, m) {
      if (!d) { el.innerHTML = errBox(m.error); return; }
      const me = d.me || T.Sesi.me;
      const draw = function () { if (!el.isConnected) return;
        const izin = d.izin || [];
        el.innerHTML = '<div class="seg"><button class="' + (tab === 'form' ? 'on' : '') + '" data-tab="form">' + ic('filePlus', 17) + 'Form Pengajuan</button><button class="' + (tab === 'riwayat' ? 'on' : '') + '" data-tab="riwayat">' + ic('history', 17) + 'Riwayat (' + izin.length + ')</button></div>' +
          '<div id="izBody" class="mt-16"></div>';
        T.on(el.firstChild, 'click', '[data-tab]', function (e, b) { tab = b.getAttribute('data-tab'); draw(); });
        if (tab === 'form') drawForm($('#izBody'), d, me); else drawRiwayat($('#izBody'), izin);
      };
      draw();
      function terdampak() {
        if (!T.parseTgl(st.mulai) || !T.parseTgl(st.selesai) || st.selesai < st.mulai) return [];
        const out = []; let t = st.mulai, g = 0;
        while (t <= st.selesai && g++ < 40) { const h = T.hariOf(t), tt = t; (d.jadwal || []).filter(function (j) { return j.hari === h && T.cocokMinggu(j, tt); }).forEach(function (j) { out.push({ t: t, j: j }); }); t = T.addDays(t, 1); }
        return out;
      }
      function drawForm(box, d, me) {
        const kat = [['izin', 'calendarX', 'Izin Kepentingan'], ['sakit', 'heartPulse', 'Sakit (Surat Dokter)'], ['dinas', 'briefcase', 'Tugas Dinas Luar']];
        const ter = terdampak();
        const hariN = st.selesai >= st.mulai ? Math.round((T.parseTgl(st.selesai) - T.parseTgl(st.mulai)) / 864e5) + 1 : 0;
        box.innerHTML = '<div class="card card-pad row">' + T.avatar(me.nama) + '<div class="grow" style="min-width:0"><b class="ellipsis" style="display:block;font-family:var(--f-head)">' + esc(me.nama) + '</b><span class="mono xs muted">NIP: ' + esc(me.nip || '-') + '</span></div><span class="chip chip-ok chip-sm"><span class="dot"></span>Aktif Mengajar</span></div>' +
          '<div class="row-b mt-20"><h4>1. Kategori Ketidakhadiran <span style="color:var(--err)">*</span></h4><span class="xs muted">Pilih satu jenis</span></div>' +
          '<div class="grid3 mt-12">' + kat.map(function (k) {
            const on = st.jenis === k[0];
            return '<button type="button" class="card" data-jenis="' + k[0] + '" style="padding:14px 8px;text-align:center;cursor:pointer;position:relative;' + (on ? 'border:2px solid var(--p);background:var(--p-50)' : '') + '">' + (on ? '<span class="chip chip-sm" style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--p);color:#fff">AKTIF</span>' : '') +
              '<span class="itile itile-sm" style="margin:0 auto;' + (on ? 'background:var(--p);color:#fff' : 'background:var(--slate-bg);color:var(--tx-3)') + '">' + ic(k[1], 20) + '</span><div class="small b mt-8" style="font-family:var(--f-head);line-height:1.3;' + (on ? 'color:var(--p)' : '') + '">' + k[2] + '</div></button>';
          }).join('') + '</div>' +
          '<h4 class="mt-20">2. Rentang Waktu <span style="color:var(--err)">*</span></h4>' +
          '<div class="card card-pad mt-12"><div class="grid2"><div class="field"><label class="label" for="izM" style="font-size:12.5px;font-weight:500;color:var(--tx-3)">Tanggal Mulai</label><input class="input input-sm" type="date" id="izM" value="' + st.mulai + '"></div>' +
          '<div class="field"><label class="label" for="izS" style="font-size:12.5px;font-weight:500;color:var(--tx-3)">Tanggal Selesai</label><input class="input input-sm" type="date" id="izS" value="' + st.selesai + '" min="' + st.mulai + '"></div></div>' +
          '<div class="row-b mt-12 small"><span class="row muted">' + ic('info', 15) + 'Kalkulasi durasi</span><span class="chip chip-p chip-mono">' + hariN + ' Hari</span></div></div>' +
          (ter.length ? '<div class="card card-tint card-pad mt-12"><div class="row-b"><b class="row small">' + ic('bell', 16) + ter.length + ' Sesi Mengajar Terdampak</b><span class="chip chip-sm" style="background:#fff">Otomatis</span></div>' +
            '<div class="col mt-12" style="gap:8px">' + ter.slice(0, 6).map(function (x) { return '<div class="row-b small" style="padding:10px 12px;border-radius:10px;background:#fff;border:1px solid var(--p-100)"><div style="min-width:0"><b class="ellipsis" style="display:block">' + T.hariOf(x.t) + ': ' + esc(x.j.mapel) + (x.j.kelas ? ' ' + esc(x.j.kelas) : '') + '</b><span class="xs muted row">' + ic('mapPin', 12) + esc(x.j.tkb) + '</span></div><span class="mono xs" style="color:var(--p)">' + x.j.mulai + ' – ' + x.j.selesai + '</span></div>'; }).join('') +
            (ter.length > 6 ? '<div class="xs muted center">+' + (ter.length - 6) + ' sesi lainnya</div>' : '') + '</div></div>' : '') +
          '<div class="row-b mt-20"><h4>3. Alasan / Keterangan <span style="color:var(--err)">*</span></h4><span class="mono xs muted" id="izCnt">' + st.alasan.length + '/300</span></div>' +
          '<textarea class="textarea mt-12" id="izA" maxlength="300" placeholder="Contoh: Demam tinggi dan disarankan dokter istirahat 2 hari.">' + esc(st.alasan) + '</textarea>' +
          '<div class="row-b mt-20"><h4>4. Lampiran Berkas</h4><span class="xs ' + (st.jenis === 'sakit' ? '' : 'muted') + '" style="' + (st.jenis === 'sakit' ? 'color:var(--warn-tx)' : '') + '">' + (st.jenis === 'sakit' ? 'Dianjurkan untuk Sakit' : 'Opsional') + '</span></div>' +
          '<div class="mt-12" id="izLamp" style="padding:12px;border-radius:16px;border:1.5px dashed var(--p-100);background:var(--p-50)">' +
          (st.lampiran ? '<div class="row" style="padding:10px 12px;border-radius:12px;background:#fff;border:1px solid var(--line)"><span class="itile itile-sm t-red">' + ic('fileText', 18) + '</span><div class="grow" style="min-width:0"><b class="small ellipsis" style="display:block">' + esc(st.lampNama) + '</b><span class="xs muted">' + Math.round(T.dataUrlBytes(st.lampiran) / 1024) + ' KB · ' + ic('checkCircle', 12) + ' Siap diunggah</span></div><button class="icon-btn" type="button" id="izHapus" aria-label="Hapus lampiran">' + ic('trash', 18) + '</button></div>'
            : '<label class="row" style="justify-content:center;min-height:56px;cursor:pointer;color:var(--p);font:600 14px var(--f-head)">' + ic('upload', 20) + 'Pilih foto surat / bukti<input type="file" id="izFile" accept="image/*,application/pdf" class="sr"></label>') +
          '<div class="xs muted center mt-8">Format JPG, PNG, atau PDF (maks. 2 MB)</div></div>' +
          '<button class="btn btn-primary btn-block btn-lg mt-20" id="izKirim">' + ic('send', 19) + ' Kirim Pengajuan Izin / Sakit</button>' +
          '<p class="xs muted center mt-8">Pengajuan diverifikasi oleh admin. Status dapat dilihat di tab Riwayat.</p>';
        T.on(box, 'click', '[data-jenis]', function (e, b) { st.jenis = b.getAttribute('data-jenis'); drawForm(box, d, me); });
        $('#izM').onchange = function () { st.mulai = this.value; if (st.selesai < st.mulai) st.selesai = st.mulai; drawForm(box, d, me); };
        $('#izS').onchange = function () { st.selesai = this.value; drawForm(box, d, me); };
        $('#izA').oninput = function () { st.alasan = this.value; $('#izCnt').textContent = this.value.length + '/300'; };
        const f = $('#izFile'); if (f) f.onchange = async function () {
          const file = this.files[0]; if (!file) return;
          try {
            if (file.type === 'application/pdf') { if (file.size > 2e6) return T.toast('PDF maksimal 2 MB.', 'warn'); st.lampiran = await T.fileToDataUrl(file); }
            else st.lampiran = await T.compressImage(await T.fileToDataUrl(file), 1600, .75);
            st.lampNama = file.name; drawForm(box, d, me);
          } catch (e) { T.toast('Berkas tidak bisa dibaca.', 'err'); }
        };
        const hp = $('#izHapus'); if (hp) hp.onclick = function () { st.lampiran = ''; st.lampNama = ''; drawForm(box, d, me); };
        $('#izKirim').onclick = async function () {
          if (st.alasan.trim().length < 5) return T.toast('Tuliskan alasan minimal 5 karakter.', 'warn');
          const r = await T.withBtn(this, function () { return T.api('izin.ajukan', { jenis: st.jenis, mulai: st.mulai, selesai: st.selesai, alasan: st.alasan, lampiran: st.lampiran || '' }); });
          if (!r.success) return T.toast(r.message, 'err');
          T.toast(r.message, 'ok');
          d.izin = [r.data.izin].concat(d.izin || []); T.Cache.put('guru.boot', {}, d);
          st.alasan = ''; st.lampiran = ''; st.lampNama = ''; tab = 'riwayat'; T.markStale(['guru.boot']); draw();
        };
      }
      function drawRiwayat(box, izin) {
        if (!izin.length) { box.innerHTML = '<div class="card card-pad"><div class="empty"><div class="itile">' + ic('fileText', 24) + '</div><b>Belum ada pengajuan</b>Pengajuan izin/sakit Anda akan tampil di sini.</div></div>'; return; }
        box.innerHTML = '<div class="col gap-12">' + izin.map(function (z) {
          const n = Math.round((T.parseTgl(z.selesai) - T.parseTgl(z.mulai)) / 864e5) + 1;
          return '<div class="card card-pad"><div class="row-b"><b style="font-family:var(--f-head)">' + esc(T.JENIS_IZIN[z.jenis] || z.jenis) + ' <span class="muted small" style="font-weight:400">· ' + n + ' hari</span></b>' + T.chipIzin(z.status) + '</div>' +
            '<div class="row small muted mt-8">' + ic('calendar', 15) + T.tglIndo(z.mulai, { pendek: true }) + (n > 1 ? ' – ' + T.tglIndo(z.selesai, { pendek: true }) : '') + '</div>' +
            '<p class="small mt-8">' + esc(z.alasan) + '</p>' +
            (z.status !== 'menunggu' && z.diproses_oleh ? '<div class="xs muted mt-8">' + (z.status === 'disetujui' ? 'Disetujui' : z.status === 'ditolak' ? 'Ditolak' : 'Diproses') + ' oleh ' + esc(z.diproses_oleh) + '</div>' : '') +
            (z.catatan ? '<div class="note ' + (z.status === 'ditolak' ? 'note-err' : 'note-p') + ' mt-8">' + ic('message', 16) + '<div>' + esc(z.catatan) + '</div></div>' : '') +
            '<div class="row mt-12">' + (z.ada_lampiran ? '<button class="btn btn-tonal btn-xs" data-lamp="' + esc(z.id) + '">' + ic('fileText', 15) + 'Lampiran</button>' : '') +
            (z.status === 'menunggu' ? '<button class="btn btn-danger-soft btn-xs" data-batal="' + esc(z.id) + '">' + ic('x', 15) + 'Batalkan</button>' : '') + '</div></div>';
        }).join('') + '</div>';
        T.on(box, 'click', '[data-lamp]', async function (e, b) { const r = await T.withBtn(b, function () { return T.api('izin.lampiran', { id: b.getAttribute('data-lamp') }); }); if (!r.success) return T.toast(r.message, 'err'); bukaLampiran(r.data.dataUrl); });
        T.on(box, 'click', '[data-batal]', async function (e, b) {
          if (!await T.confirm({ title: 'Batalkan pengajuan?', ok: 'Ya, batalkan', danger: true })) return;
          const r = await T.withBtn(b, function () { return T.api('izin.batal', { id: b.getAttribute('data-batal') }); });
          if (!r.success) return T.toast(r.message, 'err');
          T.toast(r.message, 'ok'); d.izin = d.izin.map(function (z) { return z.id === b.getAttribute('data-batal') ? Object.assign({}, z, { status: 'dibatalkan' }) : z; }); T.Cache.put('guru.boot', {}, d); draw();
        });
      }
    });
  } });
  function bukaLampiran(url) {
    if (/^data:application\/pdf/.test(url)) { T.downloadDataUrl(url, 'lampiran-izin.pdf'); return; }
    T.modal({ title: 'Lampiran', wide: true, body: '<img src="' + url + '" alt="Lampiran" style="width:100%;border-radius:12px">' });
  }
  App.bukaLampiran = bukaLampiran;

  // ------------------------------------------------------------------------
  //  RIWAYAT PRESENSI
  // ------------------------------------------------------------------------
  const fotoCache = {};
  async function fotoAbsen(id) {
    if (fotoCache[id]) return fotoCache[id];
    const r = await T.apiQ('foto.ambil', { id: id });
    if (r.success) fotoCache[id] = r.data.dataUrl;
    return r.success ? r.data.dataUrl : null;
  }
  App.fotoAbsen = fotoAbsen;
  function detailAbsen(a, ctx) {
    ctx = ctx || {};
    const m = T.modal({ title: 'Detail Bukti Presensi', sub: T.tglIndo(a.tanggal, { hari: true }) + ' • <span class="mono">' + esc(a.id) + '</span>', body:
      '<div class="photo-box" id="phBox"><div class="ph-load">' + (a.ada_foto ? ic('image', 18) + 'Memuat foto…' : ic('image', 18) + 'Tanpa foto (input manual admin)') + '</div>' +
      '<div class="tag"><span>' + (a.verifikasi ? ic('checkCircle', 13) + ' TERVERIFIKASI' : 'MENUNGGU VERIFIKASI') + (a.lat !== null ? '<br>LAT ' + Number(a.lat).toFixed(6) + ' | LON ' + Number(a.lng).toFixed(6) : '') + '</span><span class="chip chip-sm" style="background:rgba(2,6,23,.6);color:#fff;border-color:transparent">WIB (UTC+7)</span></div></div>' +
      (a.jarak !== null && a.jarak !== undefined ? '<div class="card card-pad mt-12" style="padding:12px"><div class="row-b"><span class="row b small">' + ic('mapPin', 16) + 'Area Geofence ' + esc(a.tkb) + '</span><span class="chip chip-ok chip-mono chip-sm">' + Math.round(a.jarak) + ' m</span></div><div class="radar mt-8">' + Charts.radar({ radius: Number(T.Set.v.radius_gps_meter) || 50, jarak: a.jarak, akurasi: a.akurasi, label: ctx.label || 'Posisi Guru' }) + '</div></div>' : '') +
      '<div class="col mt-12" style="gap:0">' + [
        ['Status', T.chipAbsen(a) + (a.ditandai ? ' <span class="chip chip-err chip-sm">Ditandai</span>' : '')], ['Lokasi TKB', esc(a.tkb)], ['Waktu Server Masuk', '<span class="mono">' + T.tglIndo(a.tanggal, { pendek: true }) + ', ' + esc(a.jam) + ' WIB</span>'],
        ['Akurasi GPS', a.akurasi !== null && a.akurasi !== undefined ? '<span class="mono">±' + a.akurasi + ' m</span>' : '-'], ['Jenis Foto', a.jenis_foto === 'kegiatan' ? 'Kegiatan mengajar' : a.jenis_foto ? 'Selfie di lokasi' : '-']
      ].concat(a.catatan ? [['Catatan Admin', '<span class="small">' + esc(a.catatan) + '</span>']] : []).map(function (r) { return '<div class="row-b" style="padding:11px 0;border-bottom:1px solid var(--line-2)"><span class="small muted">' + r[0] + '</span><span class="small b" style="text-align:right">' + r[1] + '</span></div>'; }).join('') + '</div>',
      actions: [{ label: 'Tutup Detail', cls: 'btn-outline' }].concat(navigator.share ? [{ label: ic('send', 17) + ' Bagikan Bukti', cls: 'btn-primary', onClick: function () { navigator.share({ title: 'Bukti Presensi', text: 'Presensi ' + (T.Sesi.me || {}).nama + ' — ' + T.tglIndo(a.tanggal, { hari: true }) + ' pukul ' + a.jam + ' WIB di ' + a.tkb + ' (' + (T.STATUS[T.ABS_ST[a.status]] || {}).t + '). ID: ' + a.id }).catch(function () { }); return false; } }] : []) });
    if (a.ada_foto) fotoAbsen(a.id).then(function (u) { const b = $('#phBox', m.root); if (!b) return; if (u) { const img = document.createElement('img'); img.src = u; img.alt = 'Foto bukti presensi'; b.insertBefore(img, b.firstChild); const l = $('.ph-load', b); if (l) l.remove(); } else { const l = $('.ph-load', b); if (l) l.textContent = 'Foto tidak dapat dimuat.'; } });
    return m;
  }
  App.detailAbsen = detailAbsen;

  App.reg('riwayat', { shell: 'guru', guru: true, nav: 'riwayat', title: 'Riwayat Presensi', sub: 'Rekam jejak kehadiran Anda', back: 'beranda', render: function (el, p) {
    el.innerHTML = skel(3);
    const nowYm = T.nowWib().tgl.slice(0, 7);
    let bulan = /^\d{4}-\d{2}$/.test(p.bulan || '') ? p.bulan : nowYm, filter = 'semua', data = null, bootData = null;
    const draw = function () { if (!el.isConnected) return;
      if (!data) return;
      const r = data.ringkasan || { hadir: 0, T: 0, I: 0, S: 0, A: 0, hariJadwal: 0, H: 0, L: 0 };
      const rows = (data.riwayat || []).filter(function (x) {
        if (x.kode === 'B') return false;
        if (filter === 'tepat') return x.kode === 'H'; if (filter === 'terlambat') return x.kode === 'T';
        if (filter === 'izin') return x.kode === 'I' || x.kode === 'S'; if (filter === 'alpa') return x.kode === 'A'; return true;
      });
      el.innerHTML = '<div class="card card-pad row-b"><button class="icon-btn" id="mPrev" aria-label="Bulan sebelumnya">' + ic('chevronLeft', 20) + '</button><div class="center"><div class="row" style="justify-content:center">' + ic('calendar', 18) + '<b style="font:700 16px var(--f-head)">' + T.bulanLabel(bulan) + '</b></div><div class="xs muted">' + (bulan === nowYm ? 'Bulan berjalan' : 'Arsip') + '</div></div>' +
        '<button class="icon-btn" id="mNext" aria-label="Bulan berikutnya" ' + (bulan >= nowYm ? 'disabled style="opacity:.3"' : '') + '>' + ic('chevronRight', 20) + '</button></div>' +
        '<div class="stats5 mt-12" style="grid-template-columns:repeat(4,1fr)"><div class="stile st-slate"><b>' + r.hariJadwal + '</b><span>Hari Jadwal</span></div><div class="stile st-ok"><b>' + r.hadir + '</b><span>Hadir</span></div><div class="stile st-warn"><b>' + r.T + '</b><span>Terlambat</span></div><div class="stile st-err"><b>' + r.A + '</b><span>Alpa</span></div></div>' +
        '<div class="row-b mt-20" style="margin-bottom:10px"><span class="eyebrow">Riwayat Kehadiran</span><span class="xs muted mono">' + rows.length + ' catatan</span></div>' +
        '<div class="pills">' + [['semua', 'Semua'], ['tepat', 'Tepat Waktu'], ['terlambat', 'Terlambat'], ['izin', 'Izin/Sakit'], ['alpa', 'Alpa']].map(function (f) { return '<button class="pill ' + (filter === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
        '<div class="col gap-12 mt-12">' + (rows.length ? rows.map(function (x) {
          const a = x.absen, j = x.jadwal[0];
          return '<button class="card card-pad" style="text-align:left;width:100%;cursor:' + (a ? 'pointer' : 'default') + ';' + (x.kode === 'T' ? 'border-left:4px solid var(--warn)' : x.kode === 'A' ? 'border-left:4px solid var(--err)' : x.kode === 'H' ? 'border-left:4px solid var(--ok)' : '') + '" ' + (a ? 'data-abs="' + esc(a.id) + '"' : '') + '>' +
            '<div class="row-b"><div style="min-width:0"><b style="font:700 15px var(--f-head)">' + T.tglIndo(x.tanggal, { hari: true }) + '</b><div class="small muted ellipsis">' + (j ? esc(j.mapel) + ' · ' + esc(j.mulai) + '–' + esc(j.selesai) : a ? 'Di luar jadwal' : '') + '</div></div>' + T.chipStatus(x.kode, x.kode === 'T' && a ? '+' + a.menit + 'm' : '') + '</div>' +
            (a ? '<div class="row mt-12 small" style="gap:14px;flex-wrap:wrap"><span class="row muted">' + ic('mapPin', 15) + esc(a.tkb) + '</span><span class="row mono">' + ic('clock', 15) + T.jam5(a.jam) + ' WIB</span>' + (a.jarak !== null ? '<span class="chip chip-ok chip-mono chip-sm">± ' + Math.round(a.jarak) + ' m</span>' : '<span class="chip chip-slate chip-sm">Manual</span>') + '<span class="grow"></span><span class="link">Detail ' + ic('chevronRight', 15) + '</span></div>'
              : x.izin ? '<p class="small muted mt-8">' + esc(T.JENIS_IZIN[x.izin.jenis] || '') + ' — ' + esc(x.izin.alasan || '') + '</p>' : x.kode === 'A' ? '<p class="small mt-8" style="color:var(--err-tx)">Tidak ada absen & tidak ada izin yang disetujui.</p>' : '') + '</button>';
        }).join('') : '<div class="card card-pad"><div class="empty"><div class="itile">' + ic('history', 24) + '</div><b>Belum ada catatan</b>Tidak ada data untuk filter ini.</div></div>') + '</div>';
      $('#mPrev').onclick = function () { bulan = T.addMonths(bulan, -1); muat(); };
      $('#mNext').onclick = function () { if (bulan < nowYm) { bulan = T.addMonths(bulan, 1); muat(); } };
      T.on(el, 'click', '[data-f]', function (e, b) { filter = b.getAttribute('data-f'); draw(); });
      T.on(el, 'click', '[data-abs]', function (e, b) { const x = (data.riwayat || []).filter(function (y) { return y.absen && y.absen.id === b.getAttribute('data-abs'); })[0]; if (x) detailAbsen(x.absen); });
    };
    const muat = function () { if (!el.isConnected) return;
      data = null; el.innerHTML = skel(3);
      if (bulan === nowYm) bootLoad(function (d, m) { if (!d) { el.innerHTML = errBox(m.error); return; } bootData = d; data = d.bulan; draw(); bukaDariParam(); });
      else T.load('guru.riwayat', { bulan: bulan }, function (d, m) { if (!d) { el.innerHTML = errBox(m.error); return; } data = d; draw(); }, { maxAge: 300000 });
    };
    let dibuka = false;
    const bukaDariParam = function () {
      if (dibuka || !p.id || !bootData) return; dibuka = true;
      const a = bootData.hariIni.absen && bootData.hariIni.absen.id === p.id ? bootData.hariIni.absen : null;
      const x = a ? { absen: a } : (data.riwayat || []).filter(function (y) { return y.absen && y.absen.id === p.id; })[0];
      if (x) detailAbsen(x.absen);
    };
    muat();
  } });

  // ------------------------------------------------------------------------
  //  HONOR SAYA
  // ------------------------------------------------------------------------
  App.reg('honor', { shell: 'guru', guru: true, nav: '', title: 'Honorarium Saya', sub: 'Estimasi & rekap kehadiran', back: 'beranda', render: function (el) {
    const nowYm = T.nowWib().tgl.slice(0, 7); let bulan = nowYm;
    const muat = function () { if (!el.isConnected) return;
      el.innerHTML = skel(3);
      T.load('guru.riwayat', { bulan: bulan }, function (d, m) {
        if (!d) { el.innerHTML = errBox(m.error); return; }
        const r = d.ringkasan || { H: 0, T: 0, L: 0, I: 0, S: 0, A: 0, hadir: 0, terverifikasi: 0, honor: 0, hariJadwal: 0 }, tarif = d.tarif || 0;
        const luarBelum = (d.riwayat || []).filter(function (x) { return x.absen && !x.absen.verifikasi; }).length;
        const total = Math.max(1, r.hariJadwal), pctOk = Math.min(100, (r.H) / total * 100), pctT = Math.min(100 - pctOk, r.T / total * 100);
        el.innerHTML = '<div class="card card-pad row-b"><button class="icon-btn" id="hPrev" aria-label="Bulan sebelumnya">' + ic('chevronLeft', 20) + '</button><div class="row">' + ic('calendar', 18) + '<div><b style="font:700 16px var(--f-head)">' + T.bulanLabel(bulan) + '</b><div class="xs muted">' + (bulan === nowYm ? 'Bulan berjalan' : 'Arsip') + '</div></div></div><button class="icon-btn" id="hNext" aria-label="Bulan berikutnya" ' + (bulan >= nowYm ? 'disabled style="opacity:.3"' : '') + '>' + ic('chevronRight', 20) + '</button></div>' +
          '<div class="card card-pad-lg mt-12" style="background:linear-gradient(140deg,#fff 30%,var(--p-50));border-color:var(--p-100)"><div class="row-b"><span class="small muted">' + (bulan === nowYm ? 'Estimasi Berjalan' : 'Total Bulan Ini') + '</span>' + (bulan === nowYm ? '<span class="chip chip-ok chip-sm"><span class="dot"></span>Berjalan</span>' : '<span class="chip chip-slate chip-sm">Ditutup ' + T.tglIndo(d.tutup || T.akhirBulan(bulan), { pendek: true }) + '</span>') + '</div>' +
          '<div class="money money-lg mt-8">' + T.rupiah(r.honor) + '</div>' +
          '<div class="card card-pad mt-16" style="box-shadow:none"><div class="row b small" style="color:var(--p)">' + ic('fileText', 17) + 'Formula Perhitungan Resmi:</div><div class="mono small mt-8">' + r.terverifikasi + ' Kehadiran Terverifikasi × ' + T.rupiah(tarif) + ' / Sesi</div>' +
          '<div class="bar mt-12" style="height:8px;display:flex"><i style="width:' + pctOk + '%;background:var(--ok);border-radius:6px 0 0 6px"></i><i style="width:' + pctT + '%;background:var(--warn);border-radius:0"></i></div></div>' +
          '<div class="row xs muted mt-12">' + ic('info', 14) + 'Honor final mengikuti laporan resmi yang dicetak admin.</div></div>' +
          '<div class="sec-title"><h3>Breakdown Kehadiran</h3><span class="mono small muted">Total: ' + r.hariJadwal + ' Hari Jadwal</span></div>' +
          '<div class="grid2">' +
          tile('Tepat Waktu', r.H, T.rupiah(r.H * tarif), 'var(--ok-tx)', 'var(--ok)') + tile('Terlambat', r.T, T.rupiah(r.T * tarif), 'var(--warn-tx)', 'var(--warn)') +
          tile('Izin / Sakit', r.I + r.S, 'Rp 0 (Non-honor)', 'var(--tx-3)', 'var(--tx-4)') + tile('Alpa', r.A, r.A ? 'Tidak dihitung' : 'Tertib 100%', r.A ? 'var(--err-tx)' : 'var(--ok-tx)', 'var(--err)') + '</div>' +
          (r.L ? '<div class="note note-p mt-12">' + ic('info', 18) + '<div>' + r.L + ' absen <b>di luar jadwal</b>' + (luarBelum ? ', ' + luarBelum + ' di antaranya menunggu verifikasi admin' : '') + '. Hanya yang terverifikasi yang dihitung honor.</div></div>' : '') +
          '<div class="note note-p mt-12">' + ic('shield', 18) + '<div><b>Ketentuan:</b> sesi terlambat tetap dihitung penuh honorariumnya. Izin, sakit, dan alpa tidak dihitung. Tanpa potongan.</div></div>' +
          '<div class="sec-title"><h3>Rincian Mingguan</h3><span class="small muted">' + T.bulanLabel(bulan) + '</span></div>' +
          '<div class="col gap-12">' + ((d.mingguan || []).length ? d.mingguan.map(function (w) {
            return '<div class="card card-pad row"><span class="itile" style="font:700 15px var(--f-head)">W' + w.ke + '</span><div class="grow" style="min-width:0"><b style="font-family:var(--f-head)">Minggu ' + ['I', 'II', 'III', 'IV', 'V', 'VI'][w.ke - 1] + ' <span class="muted small" style="font-weight:500">(' + T.tglIndo(w.dari, { pendek: true, tanpaTahun: true }) + ' – ' + T.tglIndo(w.sampai, { pendek: true, tanpaTahun: true }) + ')</span></b>' +
              '<div class="small muted row"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:' + (w.alpa ? 'var(--err)' : w.izin ? 'var(--warn)' : 'var(--ok)') + '"></span>' + w.terverifikasi + ' sesi hadir terverifikasi' + (w.izin ? ' · ' + w.izin + ' izin' : '') + (w.alpa ? ' · ' + w.alpa + ' alpa' : '') + '</div></div>' +
              '<div style="text-align:right"><b class="mono" style="color:var(--p)">' + T.rupiah(w.honor) + '</b></div></div>';
          }).join('') : '<div class="card card-pad muted small center">Belum ada data.</div>') + '</div>' +
          '<button class="btn btn-primary btn-block btn-lg mt-20" id="hCsv">' + ic('download', 19) + ' Unduh Rincian (CSV)</button>';
        $('#hPrev').onclick = function () { bulan = T.addMonths(bulan, -1); muat(); };
        $('#hNext').onclick = function () { if (bulan < nowYm) { bulan = T.addMonths(bulan, 1); muat(); } };
        $('#hCsv').onclick = function () {
          const rows = [['Tanggal', 'Hari', 'Status', 'TKB', 'Jam', 'Terverifikasi', 'Honor']];
          (d.riwayat || []).slice().reverse().forEach(function (x) { const a = x.absen; rows.push([x.tanggal, x.hari, (T.STATUS[x.kode] || {}).t, a ? a.tkb : '', a ? a.jam : '', a ? (a.verifikasi ? 'ya' : 'tidak') : '', a && a.verifikasi ? tarif : 0]); });
          rows.push([], ['Total', '', '', '', '', r.terverifikasi, r.honor]);
          T.downloadText(T.toCsv(rows), 'honor-' + bulan + '.csv');
        };
      }, { maxAge: bulan === nowYm ? 30000 : 600000 });
    };
    function tile(label, n, sub, col, dot) { return '<div class="card card-pad"><div class="row-b small"><span class="muted">' + label + '</span><span style="width:8px;height:8px;border-radius:50%;background:' + dot + '"></span></div><div class="mt-8"><b style="font:700 24px var(--f-head)">' + n + '</b> <span class="small muted">sesi</span></div><div class="mono small mt-4" style="color:' + col + '">' + sub + '</div></div>'; }
    muat();
  } });

  // ------------------------------------------------------------------------
  //  PROFIL
  // ------------------------------------------------------------------------
  App.reg('profil', { shell: 'guru', guru: true, nav: 'profil', title: 'Profil Pamong', back: 'beranda', render: function (el) {
    el.innerHTML = skel(3);
    bootLoad(function (d, m) {
      const me = (d && d.me) || T.Sesi.me || {};
      const r = d ? d.bulan.ringkasan : { hadir: 0, persen: 0 }, tkb = d ? d.tkb || [] : [];
      const binaan = d ? Array.from(new window.Set((d.jadwal || []).map(function (j) { return j.tkb; }))) : [];
      el.innerHTML = '<div class="card" style="overflow:hidden"><div style="height:6px;background:var(--p)"></div><div class="card-pad">' +
        '<div class="row" style="gap:14px;align-items:flex-start">' + T.avatar(me.nama, 'av-xl') + '<div class="grow" style="min-width:0"><h3 style="font-size:19px">' + esc(me.nama) + '</h3>' +
        '<div class="mono small muted mt-4">NIP: ' + esc(me.nip || '-') + '</div><div class="row small mt-4">' + ic('cap', 16) + (me.peran === 'admin' ? 'Administrator' + (me.ikut_absen ? ' & Guru Pamong' : '') : 'Guru Pamong ' + esc(me.mapel || '')) + '</div>' +
        '<div class="row small muted mt-4">' + ic('building', 16) + esc(T.Set.v.nama_sekolah_induk || '') + '</div></div></div>' +
        (binaan.length ? '<div class="row wrap mt-16" style="padding-top:14px;border-top:1px solid var(--line-2)"><span class="eyebrow">TKB Binaan:</span>' + binaan.map(function (t) { return '<span class="chip chip-ok chip-sm"><span class="dot"></span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="grid3 mt-16">' + [[r.hadir, 'Hadir Bulan Ini'], [binaan.length + ' TKB', 'Pangkalan Aktif'], [(r.persen === null || r.persen === undefined ? 100 : r.persen) + '%', 'Kehadiran']].map(function (x) { return '<div class="center" style="padding:12px 4px;border-radius:14px;border:1px solid var(--line)"><b style="font:700 18px var(--f-head);color:var(--p)">' + x[0] + '</b><div class="xs muted mt-4">' + x[1] + '</div></div>'; }).join('') + '</div></div></div>' +
        '<div class="card card-pad mt-12 row" style="background:var(--ok-bg);border-color:var(--ok-line)"><span class="itile itile-sm" style="background:#fff;color:var(--ok)">' + ic('mapPin', 18) + '</span><div class="grow"><b class="small" style="font-family:var(--f-head)">Status Presensi Mandiri</b><div class="mono xs" style="color:var(--ok-tx)">QR + GPS + Foto · Radius ' + esc(T.Set.v.radius_gps_meter) + ' m</div></div><span class="chip chip-ok chip-sm">Aktif</span></div>' +
        (App.isAdmin() ? '<a class="card card-pad mt-12 row" href="#/a/dashboard" style="color:inherit"><span class="itile itile-sm">' + ic('grid', 18) + '</span><div class="grow"><b style="font-family:var(--f-head)">Buka Panel Admin</b><div class="small muted">Dashboard, persetujuan, laporan & pengaturan</div></div>' + ic('chevronRight', 18) + '</a>' : '') +
        '<div class="sec-title"><h3>Data Kepegawaian</h3></div><div class="list">' +
        li('idCard', 'Data Pribadi', esc(me.nama) + ' · NIP ' + esc(me.nip || '-'), '') + li('book', 'Mata Pelajaran Diampu', esc(me.mapel || 'Belum diisi admin'), '') +
        li('mapPin', 'Lokasi TKB Penugasan', binaan.length ? esc(binaan.join(', ')) : 'Belum ada jadwal', '') + '</div>' +
        '<div class="sec-title"><h3>Akun &amp; Keamanan</h3><span class="chip chip-ok chip-sm"><span class="dot"></span>Aman</span></div><div class="list">' +
        li('smartphone', 'Nomor WhatsApp / Kontak', '<span class="mono">' + esc(me.hp || 'Belum diisi') + '</span>', 'pHp') +
        li('mail', 'Akun Google', me.email ? '<span class="mono">' + esc(me.email) + '</span> · ' + (me.google === 'disetujui' ? 'Tertaut' : 'Menunggu') : 'Belum ditautkan (masuk dengan Google untuk menautkan)', '') +
        li('key', 'Ubah Kata Sandi', 'Gunakan minimal 8 karakter, huruf & angka', 'pSandi') + li('logOut', 'Keluar dari Semua Perangkat', 'Akhiri sesi di HP/laptop lain', 'pSemua') + '</div>' +
        '<div class="sec-title"><h3>Preferensi &amp; Informasi</h3></div><div class="list">' +
        li('headset', 'Bantuan & Panduan Pamong', 'Cara absen, kendala GPS, kontak admin', 'pBantu') + li('info', 'Tentang Aplikasi', esc(T.Set.v.nama_aplikasi) + ' • Versi ' + T.VER, 'pTentang') + '</div>' +
        '<button class="btn btn-danger-soft btn-block btn-lg mt-20" id="pKeluar">' + ic('logOut', 19) + ' Keluar dari Akun</button>' +
        '<p class="xs muted center mt-12">' + esc(T.Set.v.nama_aplikasi) + ' — ' + esc(T.Set.v.subjudul || '') + '</p>';
      const bind = function (id, fn) { const b = $('#' + id); if (b) b.onclick = fn; };
      bind('pHp', function () {
        const mm = T.modal({ title: 'Nomor WhatsApp', body: '<div class="field"><label class="label" for="hpIn">Nomor HP / WhatsApp</label><input class="input mono" id="hpIn" inputmode="tel" value="' + esc(me.hp || '') + '" placeholder="08xxxxxxxxxx"><div class="help">Dipakai admin untuk menghubungi Anda.</div></div>',
          actions: [{ label: 'Batal' }, { label: 'Simpan', cls: 'btn-primary', onClick: async function (close, root) { const r = await T.api('profil.simpan', { hp: $('#hpIn', root).value }); if (!r.success) { T.toast(r.message, 'err'); return false; } T.Sesi.setMe(r.data.me); T.toast(r.message, 'ok'); T.markStale(['guru.boot']); App.render(); } }] });
        return mm;
      });
      bind('pSandi', function () { const mm = T.modal({ title: 'Ubah Kata Sandi', body: App.formSandi(false) }); App.pasangFormSandi(function () { mm.close(); }); });
      bind('pSemua', async function () { if (!await T.confirm({ title: 'Keluar dari semua perangkat?', sub: 'Semua sesi (termasuk perangkat ini) akan berakhir.', ok: 'Keluar Semua', danger: true })) return; const r = await T.api('auth.keluarSemua'); if (r.success) App.logout('Semua sesi diakhiri.'); else T.toast(r.message, 'err'); });
      bind('pBantu', bantuan);
      bind('pTentang', function () { T.modal({ title: T.Set.v.nama_aplikasi, body: '<p class="small">Aplikasi presensi guru pamong berbasis QR + GPS + foto. Data tersimpan di Google Sheets milik sekolah.</p><div class="kv mt-16"><div><small>Versi Aplikasi</small><b>' + T.VER + '</b></div><div><small>Sekolah Induk</small><b>' + esc(T.Set.v.nama_sekolah_induk) + '</b></div></div>', actions: [{ label: 'Tutup' }] }); });
      $('#pKeluar').onclick = async function () { if (await T.confirm({ title: 'Keluar dari akun?', ok: 'Keluar' })) App.logout('Anda telah keluar.'); };
    });
    function li(icon, t, s, id) { return '<' + (id ? 'button id="' + id + '"' : 'div') + ' class="li"><span class="itile itile-sm">' + ic(icon, 18) + '</span><div class="grow" style="min-width:0"><div class="t">' + t + '</div><div class="s ellipsis">' + s + '</div></div>' + (id ? '<span class="chev">' + ic('chevronRight', 18) + '</span>' : '') + '</' + (id ? 'button' : 'div') + '>'; }
  } });

  // ------------------------------------------------------------------------
  //  v1.1 — UNDUH PDF (jadwal TKB) & JURNAL MENGAJAR
  // ------------------------------------------------------------------------
  async function unduhPdf(action, data, btn) {
    T.toast('Menyusun PDF… mohon tunggu beberapa detik.', 'info');
    const r = await T.withBtn(btn, function () { return T.api(action, data); });
    if (!r.success) { T.toast(r.message, 'err', 6000); return null; }
    T.downloadDataUrl(r.data.dataUrl, r.data.nama); T.toast('PDF diunduh: ' + r.data.nama, 'ok', 5000);
    return r;
  }
  App.unduhPdf = unduhPdf;
  /** Pilih TKB (bila lebih dari satu) lalu unduh PDF jadwal pelajaran TKB. */
  App.unduhJadwalTkb = function (tkbList, btn) {
    if (tkbList.length === 1) return unduhPdf('jadwal.pdf', { id_tkb: tkbList[0].id }, btn);
    T.modal({ title: 'Unduh Jadwal Pelajaran TKB', body: '<div class="field"><label class="label" for="pdTkb">Pilih TKB</label><select class="select" id="pdTkb">' + tkbList.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.nama) + '</option>'; }).join('') + '</select></div>',
      actions: [{ label: 'Batal' }, { label: ic('download', 17) + ' Unduh PDF', cls: 'btn-primary', onClick: async function (close, root, b) { await unduhPdf('jadwal.pdf', { id_tkb: $('#pdTkb', root).value }, b); } }] });
  };

  App.reg('jurnal', { shell: 'guru', guru: true, nav: '', title: 'Jurnal Mengajar', sub: 'Laporan bukti kinerja & dokumentasi', back: 'beranda', render: function (el) {
    const ym = T.nowWib().tgl.slice(0, 7);
    const f = T.LS.get('jurf', null) || { dari: ym, sampai: ym, id_tkb: '' };
    let D = null;
    el.innerHTML = '<div class="card card-pad"><div class="row" style="gap:12px;align-items:flex-start"><span class="itile">' + ic('book', 22) + '</span><div><h3 style="font-size:16.5px">Laporan Bukti Kinerja &amp; Dokumentasi</h3><p class="small muted mt-4">Disusun otomatis dari absensi di TKB Anda: mata pelajaran, guru kunjung yang hadir, dan foto. Satu baris untuk setiap akhir pekan (Sabtu–Minggu).</p></div></div>' +
      '<div class="field mt-16"><label class="label" for="jrTkb">TKB</label><select class="select" id="jrTkb"><option value="">Memuat…</option></select></div>' +
      '<div class="grid2 mt-12"><div class="field"><label class="label" for="jrDari">Dari bulan</label><input class="input input-sm" type="month" id="jrDari" value="' + f.dari + '"></div><div class="field"><label class="label" for="jrSampai">Sampai bulan</label><input class="input input-sm" type="month" id="jrSampai" value="' + f.sampai + '"></div></div>' +
      '<button class="btn btn-tonal btn-block mt-12" id="jrGo">' + ic('refresh', 18) + ' Tampilkan</button></div><div id="jrBody" class="mt-16"></div>';
    const muat = async function (btn) {
      if (!el.isConnected) return;
      f.dari = $('#jrDari').value || ym; f.sampai = $('#jrSampai').value || f.dari; f.id_tkb = $('#jrTkb').value || f.id_tkb; T.LS.set('jurf', f);
      $('#jrBody').innerHTML = '<div class="skel" style="height:200px"></div>';
      const r = await T.withBtn(btn, function () { return T.api('jurnal.data', { id_tkb: f.id_tkb, dari: f.dari, sampai: f.sampai }); });
      if (!el.isConnected) return;
      if (!r.success) { $('#jrBody').innerHTML = '<div class="card card-pad"><div class="empty"><div class="itile">' + ic('book', 24) + '</div><b>Jurnal belum tersedia</b>' + esc(r.message) + '</div></div>'; return; }
      D = r.data; f.id_tkb = D.tkb.id;
      $('#jrTkb').innerHTML = D.tkbList.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === D.tkb.id ? ' selected' : '') + '>' + esc(t.nama) + '</option>'; }).join('');
      gambar();
    };
    const gambar = function () {
      if (!el.isConnected) return;
      const box = $('#jrBody');
      box.innerHTML = '<div class="row-b" style="margin-bottom:10px"><span class="eyebrow">' + esc(D.tkb.nama) + ' · ' + T.bulanLabel(D.dari) + (D.sampai !== D.dari ? ' – ' + T.bulanLabel(D.sampai) : '') + '</span><span class="chip chip-p chip-sm">' + D.minggu.length + ' pekan</span></div>' +
        (D.minggu.length ? '<div class="col gap-12">' + D.minggu.map(function (x, i) {
          return '<div class="card card-pad jr-card"><div class="row-b"><div><span class="mono xs muted">No. ' + (i + 1) + '</span><h4>Minggu ' + esc(x.ke) + '</h4><div class="small" style="color:var(--p);font-weight:600">' + esc(x.label) + '</div></div>' +
            (x.ada_foto ? '<span class="chip chip-ok chip-sm">' + ic('camera', 13) + ' Foto ada</span>' : '<span class="chip chip-slate chip-sm">Tanpa foto</span>') + '</div>' +
            (x.mapel.length ? '<div class="small muted mt-12">Kegiatan pembelajaran tatap muka mata pelajaran:</div><ol class="jr-list">' + x.mapel.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>' : '') +
            (x.guru.length ? '<div class="small muted mt-8">Guru kunjung yang hadir:</div><ol class="jr-list">' + x.guru.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>' : '') +
            '<div class="field mt-12"><label class="label" for="jc' + i + '" style="font-size:12.5px">Catatan / kehadiran murid <span class="muted" style="font-weight:400">(opsional)</span></label><textarea class="textarea" id="jc' + i + '" maxlength="600" placeholder="Contoh: Semua murid kelas X, XI, XII hadir">' + esc(x.catatan) + '</textarea></div>' +
            '<div class="row mt-8" style="justify-content:flex-end"><button class="btn btn-tonal btn-xs" data-simpan="' + i + '">' + ic('check', 14) + ' Simpan catatan</button></div></div>';
        }).join('') + '</div>' : '<div class="card card-pad"><div class="empty"><div class="itile">' + ic('calendar', 24) + '</div><b>Belum ada kegiatan</b>Belum ada absensi di TKB ini pada akhir pekan dalam periode yang dipilih.</div></div>') +
        '<button class="btn btn-primary btn-block btn-lg mt-20" id="jrPdf">' + ic('download', 20) + ' Unduh Jurnal (PDF)</button><p class="xs muted center mt-8">PDF siap cetak, tersimpan juga di Google Drive sekolah.</p>';
      T.on(box, 'click', '[data-simpan]', async function (e, b) {
        const i = +b.getAttribute('data-simpan'), x = D.minggu[i], v = $('#jc' + i).value;
        const r = await T.withBtn(b, function () { return T.api('jurnal.simpan', { id_tkb: D.tkb.id, minggu: x.minggu, catatan: v }); });
        if (!r.success) return T.toast(r.message, 'err'); x.catatan = r.data.catatan; T.toast(r.message, 'ok');
      });
      $('#jrPdf').onclick = function () { unduhPdf('jurnal.pdf', { id_tkb: D.tkb.id, dari: D.dari, sampai: D.sampai }, this); };
    };
    $('#jrGo').onclick = function () { muat(this); };
    $('#jrTkb').onchange = function () { f.id_tkb = this.value; muat(); };
    muat();
  } });
})();
