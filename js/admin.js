/* ==========================================================================
   TeachTrack — admin.js
   Dashboard, Data Absensi, Persetujuan, Data Guru, TKB, Jadwal, Agenda.
   ========================================================================== */
(function () {
  'use strict';
  const T = TT, esc = T.esc, $ = T.$;
  const MASTER_AGE = 60000;

  function head(title, sub, acts, extra) {
    return '<div class="a-head"><div><h1>' + esc(title) + (extra || '') + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
  }
  App.adminHead = head;
  function errBox(r) { return '<div class="panel"><div class="empty"><div class="itile">' + ic('wifiOff', 26) + '</div><b>Data belum bisa dimuat</b>' + esc((r && r.message) || '') + '<div class="mt-16"><button class="btn btn-tonal btn-sm" onclick="App.render()">' + ic('refresh', 16) + ' Coba lagi</button></div></div></div>'; }
  App.adminErr = errBox;
  function skel() { return '<div class="kpis k5">' + '<div class="skel" style="height:120px"></div>'.repeat(5) + '</div><div class="skel mt-16" style="height:320px"></div>'; }
  function master(onData, force) { return T.load('admin.master', {}, onData, { maxAge: MASTER_AGE, force: force }); }
  App.master = master;
  function afterWrite() { T.markStale(['admin.', 'persetujuan.', 'absensi.', 'laporan.']); }
  App.afterWrite = afterWrite;
  function badgeLoad() { T.load('persetujuan.list', {}, function (d) { if (d) App.setBadge(d.izin.length + d.akun.length); }, { maxAge: 60000 }); }
  App.badgeLoad = badgeLoad;
  function opsiGuru(list, sel, kosong) { return (kosong ? '<option value="">' + kosong + '</option>' : '') + list.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === sel ? ' selected' : '') + '>' + esc(g.nama) + (g.nip ? ' — ' + esc(g.nip) : '') + '</option>'; }).join(''); }
  function opsiTkb(list, sel, kosong) { return (kosong ? '<option value="">' + kosong + '</option>' : '') + list.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.nama) + (t.status !== 'aktif' ? ' (nonaktif)' : '') + '</option>'; }).join(''); }
  App.opsiGuru = opsiGuru; App.opsiTkb = opsiTkb;
  function guruAbsen(m) { return (m.guru || []).filter(function (g) { return g.ikut_absen && g.status !== 'menunggu' && g.status !== 'ditolak'; }); }
  App.guruAbsen = guruAbsen;

  // ------------------------------------------------------------------------
  //  DASHBOARD
  // ------------------------------------------------------------------------
  App.reg('a/dashboard', { shell: 'admin', admin: true, title: 'Dashboard Overview', render: function (el) {
    el.innerHTML = skel();
    T.warmUp('admin');
    T.load('admin.dashboard', {}, function (d, m) {
      if (!d) { el.innerHTML = errBox(m.error); return; }
      App.setBadge(d.persetujuan.total);
      const st = d.statistik, pct = st.dijadwalkan ? Math.round(st.sudah / st.dijadwalkan * 1000) / 10 : 0;
      const tol = (d.set || T.Set.v).toleransi_terlambat_menit;
      el.innerHTML = head('Dashboard', 'Pemantauan rekapitulasi kehadiran dan validasi harian guru pamong di ' + d.tkbAktif + ' TKB binaan.',
        '<a class="btn btn-tonal" href="#/a/laporan">' + ic('download', 19) + ' Ekspor Rekap</a><a class="btn btn-primary" href="#/a/absensi?status=perlu_tinjau">' + ic('checkCircle', 19) + ' Verifikasi Absen</a>',
        '<span class="datechip only-d" style="display:inline-flex">' + T.tglIndo(d.tanggal, { hari: true }) + '</span>') +
        '<div class="kpis k5">' +
        kpi('Sudah Absen', '<span>' + st.sudah + '</span><small>/' + st.dijadwalkan + ' Guru</small>', 'userCheck', 't-green', '<div class="bar"><i style="width:' + Math.min(100, pct) + '%"></i></div><div class="f" style="color:var(--ok-tx)">' + ic('trend', 13) + ' ' + pct + '% kehadiran hari ini</div>') +
        kpi('Tepat Waktu', st.tepat, 'checkCircle', 't-blue', '<div class="f">Absen ≤ jam mulai + ' + esc(tol) + ' menit' + (st.sudah ? ' · ' + Math.round(st.tepat / st.sudah * 100) + '% dari yang hadir' : '') + '</div>') +
        kpi('Terlambat', '<span style="color:var(--warn)">' + st.terlambat + '</span>', 'clock', 't-amber', '<div class="f">Lewat toleransi ' + esc(tol) + ' menit' + (st.luar ? ' · ' + st.luar + ' di luar jadwal' : '') + '</div>') +
        kpi('Izin/Sakit', st.izinSakit, 'fileCheck', 't-slate', '<div class="f">' + st.izin + ' Izin · ' + st.sakit + ' Sakit (disetujui)</div>') +
        kpi('Belum Absen', '<span style="color:' + (st.belum ? 'var(--err)' : 'inherit') + '">' + st.belum + '</span>', 'hourglass', 't-red', '<div class="f">Dari ' + st.dijadwalkan + ' guru berjadwal hari ini</div>') + '</div>' +
        '<div class="gcols c21 mt-16"><div class="panel"><div class="panel-hd"><div><h3>Kehadiran 30 Hari Terakhir</h3><div class="sub">Frekuensi kehadiran guru pamong per tanggal</div></div><span class="chip chip-p chip-sm">Sinkron: ' + esc(String(d.jam).slice(0, 5)) + ' WIB</span></div>' +
        '<div class="panel-bd"><div class="legend" style="margin-bottom:10px"><span><i style="background:var(--p)"></i>Hadir</span><span><i style="background:#F59E0B"></i>Guru Berjadwal</span><span><i style="background:#EF4444"></i>Izin / Sakit</span></div><div class="chart" id="chTren"></div></div></div>' +
        '<div class="panel"><div class="panel-hd"><div><h3>Komposisi Status</h3><div class="sub">Bulan berjalan · ' + T.bulanLabel(d.tanggal.slice(0, 7)) + '</div></div></div><div class="panel-bd" id="chKomp"></div></div></div>' +
        '<div class="gcols c3 mt-16">' +
        '<div class="panel"><div class="panel-hd"><h3><span class="dot" style="width:9px;height:9px;border-radius:50%;background:var(--warn)"></span>Terlambat Hari Ini</h3><span class="chip chip-warn chip-sm">' + d.terlambat.length + ' Orang</span></div>' +
        (d.terlambat.length ? d.terlambat.slice(0, 6).map(function (x) { return '<div class="prow">' + T.avatar(x.nama, 'av-sm') + '<div class="grow" style="min-width:0"><div class="t ellipsis">' + esc(x.nama) + '</div><div class="s ellipsis">' + ic('mapPin', 13) + ' ' + esc(x.tkb) + '</div><div class="mono xs mt-4 muted">Check-in ' + T.jam5(x.jam) + ' WIB</div></div><span class="chip chip-warn chip-mono">+' + x.menit + ' mnt</span></div>'; }).join('') : '<div class="empty small" style="padding:24px"><b>Tidak ada yang terlambat</b>Semua guru yang hadir tepat waktu.</div>') +
        '<div class="panel-ft"><a class="link" href="#/a/absensi?status=terlambat">Lihat riwayat keterlambatan ' + ic('arrowRight', 15) + '</a></div></div>' +
        '<div class="panel"><div class="panel-hd"><h3><span class="dot" style="width:9px;height:9px;border-radius:50%;background:var(--tx-3)"></span>Belum Absen Hari Ini</h3><span class="chip chip-slate chip-sm">' + d.belum.length + ' Guru</span></div>' +
        (d.belum.length ? d.belum.slice(0, 6).map(function (x) {
          const wa = T.waLink(x.hp, 'Assalamualaikum ' + x.nama + ', pengingat presensi: sesi ' + x.mapel + ' pukul ' + x.mulai + ' WIB di ' + x.tkb + '. Mohon segera scan QR absen di aplikasi ' + T.Set.v.nama_aplikasi + '. Terima kasih.');
          return '<div class="prow">' + T.avatar(x.nama, 'av-sm') + '<div class="grow" style="min-width:0"><div class="t ellipsis">' + esc(x.nama) + '</div><div class="s ellipsis">' + ic('building', 13) + ' ' + esc(x.tkb) + ' · ' + esc(x.mapel) + '</div><div class="mono xs mt-4" style="color:' + (x.lewat ? 'var(--err-tx)' : 'var(--tx-3)') + '">' + (x.lewat ? 'Sesi lewat · ' : 'Sesi ') + esc(x.mulai) + ' WIB</div></div>' +
            (wa ? '<a class="btn btn-tonal btn-xs" target="_blank" rel="noopener" href="' + wa + '">' + ic('send', 14) + 'Ingatkan</a>' : '<button class="btn btn-xs btn-outline" disabled title="Nomor HP belum diisi">' + ic('send', 14) + '</button>') + '</div>';
        }).join('') : '<div class="empty small" style="padding:24px"><b>Semua sudah absen</b>Tidak ada guru berjadwal yang belum absen.</div>') +
        '<div class="panel-ft muted small">Tombol Ingatkan membuka WhatsApp dengan pesan siap kirim</div></div>' +
        '<div class="panel"><div class="panel-hd"><h3><span class="dot" style="width:9px;height:9px;border-radius:50%;background:var(--p)"></span>Menunggu Persetujuan</h3><span class="chip chip-p chip-sm">' + d.persetujuan.total + ' Antrean</span></div>' +
        (d.persetujuan.total ? d.persetujuan.izin.slice(0, 3).map(function (z) {
          return '<div class="prow" style="flex-wrap:wrap"><div class="grow" style="min-width:0"><div class="row-b"><div class="t ellipsis">' + esc(z.nama) + '</div><span class="chip chip-sm ' + (z.jenis === 'sakit' ? 'chip-warn' : 'chip-p') + '">' + esc(T.JENIS_IZIN[z.jenis] || z.jenis) + '</span></div><div class="s mt-4" style="display:block">' + esc(z.alasan).slice(0, 90) + ' (' + T.tglIndo(z.mulai, { pendek: true, tanpaTahun: true }) + (z.selesai !== z.mulai ? '–' + T.tglIndo(z.selesai, { pendek: true, tanpaTahun: true }) : '') + ')</div>' +
            '<div class="row mt-8" style="justify-content:flex-end"><button class="btn btn-outline btn-xs" data-tolak="' + esc(z.id) + '">Tolak</button><button class="btn btn-primary btn-xs" data-setuju="' + esc(z.id) + '">Setujui</button></div></div></div>';
        }).join('') + d.persetujuan.akun.slice(0, 2).map(function (a) {
          return '<div class="prow"><div class="grow" style="min-width:0"><div class="row-b"><div class="t ellipsis">' + esc(a.nama) + '</div><span class="chip chip-ok chip-sm">Registrasi Akun</span></div><div class="s mt-4 mono">' + esc(a.email) + '</div><div class="row mt-8" style="justify-content:flex-end"><a class="btn btn-primary btn-xs" href="#/a/persetujuan?tab=akun">Verifikasi</a></div></div></div>';
        }).join('') : '<div class="empty small" style="padding:24px"><b>Tidak ada antrean</b>Pengajuan izin & akun baru tampil di sini.</div>') +
        '<div class="panel-ft"><a class="link" href="#/a/persetujuan">Buka pusat persetujuan ' + ic('arrowRight', 15) + '</a></div></div></div>';
      Charts.line($('#chTren'), { labels: d.tren.map(function (x) { return T.tglIndo(x.tanggal, { pendek: true, tanpaTahun: true }); }), tipLabels: d.tren.map(function (x) { return T.tglIndo(x.tanggal, { hari: true }); }),
        series: [{ name: 'Hadir', color: 'var(--p)', values: d.tren.map(function (x) { return x.hadir; }), area: true }, { name: 'Guru berjadwal', color: '#F59E0B', values: d.tren.map(function (x) { return x.dijadwalkan; }), dash: true }, { name: 'Izin/Sakit', color: '#EF4444', values: d.tren.map(function (x) { return x.izin; }), dash: true }], aria: 'Grafik kehadiran 30 hari' });
      const k = d.komposisi, hadirTot = k.tepat + k.terlambat + k.luar, basis = hadirTot + k.izin + k.sakit + k.alpa;
      Charts.donut($('#chKomp'), { center: basis ? (Math.round(hadirTot / basis * 1000) / 10) + '%' : '–', sub: 'KEHADIRAN', sub2: 'Bulan berjalan', aria: 'Komposisi status bulan ini',
        items: [{ label: 'Hadir Tepat Waktu', value: k.tepat, color: Charts.C.p }, { label: 'Terlambat (>' + tol + 'm)', value: k.terlambat, color: Charts.C.warn }, { label: 'Di Luar Jadwal', value: k.luar, color: Charts.C.violet }, { label: 'Izin / Sakit', value: k.izin + k.sakit, color: '#64748B' }, { label: 'Alpa / Tanpa Bukti', value: k.alpa, color: Charts.C.err }] });
      T.on(el, 'click', '[data-setuju]', async function (e, b) { const r = await T.withBtn(b, function () { return T.api('izin.proses', { id: b.getAttribute('data-setuju'), keputusan: 'disetujui' }); }); if (!r.success) return T.toast(r.message, 'err'); T.toast(r.message, 'ok'); afterWrite(); App.render(); });
      T.on(el, 'click', '[data-tolak]', async function (e, b) { const c = await T.prompt({ title: 'Tolak pengajuan', label: 'Catatan untuk guru', min: 3, ok: 'Tolak', danger: true }); if (c === null) return; const r = await T.api('izin.proses', { id: b.getAttribute('data-tolak'), keputusan: 'ditolak', catatan: c }); if (!r.success) return T.toast(r.message, 'err'); T.toast(r.message, 'ok'); afterWrite(); App.render(); });
    }, { maxAge: 20000 });
    master(function () { });
  } });
  function kpi(label, v, icon, tone, foot) { return '<div class="kpi"><div class="hd"><span>' + label + '</span><span class="itile itile-xs ' + tone + '">' + ic(icon, 16) + '</span></div><div class="v">' + v + '</div>' + foot + '</div>'; }
  App.kpi = kpi;

  // ------------------------------------------------------------------------
  //  DATA ABSENSI
  // ------------------------------------------------------------------------
  App.reg('a/absensi', { shell: 'admin', admin: true, title: 'Data Absensi', render: function (el, p) {
    badgeLoad();
    const now = T.nowWib().tgl;
    const f = { dari: p.dari || now.slice(0, 7) + '-01', sampai: p.sampai || now, id_tkb: p.tkb || '', status: p.status || '', id_pengguna: p.guru || '', q: '' };
    let M = null, rows = [], hal = 0; const PER = 25;
    el.innerHTML = head('Data Absensi', 'Tinjau foto & lokasi, verifikasi absen di luar jadwal, dan koreksi manual dengan alasan.',
      '<button class="btn btn-primary" id="btnTambah">' + ic('plus', 19) + ' Tambah Manual</button>') +
      '<div class="card card-pad"><div class="toolbar" style="margin:0"><div class="ifield">' + ic('search', 18) + '<input class="input" id="fQ" placeholder="Cari nama guru / NIP…"></div>' +
      '<input class="input" type="date" id="fDari" value="' + f.dari + '" style="width:auto" aria-label="Dari tanggal"><input class="input" type="date" id="fSampai" value="' + f.sampai + '" style="width:auto" aria-label="Sampai tanggal">' +
      '<select class="select" id="fTkb" aria-label="TKB"><option value="">Semua TKB</option></select>' +
      '<select class="select" id="fSt" aria-label="Status"><option value="">Semua Status</option><option value="tepat_waktu">Tepat Waktu</option><option value="terlambat">Terlambat</option><option value="di_luar_jadwal">Di Luar Jadwal</option><option value="perlu_tinjau">Perlu Ditinjau</option></select></div></div>' +
      '<div id="absBody" class="mt-16"><div class="skel" style="height:300px"></div></div>';
    $('#fSt').value = f.status;
    master(function (m) { if (!m) return; M = m; $('#fTkb').innerHTML = opsiTkb(m.tkb, f.id_tkb, 'Semua TKB'); });
    const muat = function () { if (!el.isConnected) return;
      $('#absBody').innerHTML = '<div class="skel" style="height:300px"></div>';
      T.load('absensi.list', { dari: f.dari, sampai: f.sampai, id_tkb: f.id_tkb, status: f.status, id_pengguna: f.id_pengguna }, function (d, m) {
        if (!d) { $('#absBody').innerHTML = errBox(m.error); return; }
        rows = d.rows; hal = 0; gambar();
      }, { maxAge: 15000 });
    };
    const gambar = function () { if (!el.isConnected) return;
      const q = f.q.toLowerCase();
      const list = rows.filter(function (r) { return !q || (r.nama + ' ' + r.nip + ' ' + r.tkb).toLowerCase().indexOf(q) >= 0; });
      const page = list.slice(hal * PER, hal * PER + PER), maxHal = Math.max(0, Math.ceil(list.length / PER) - 1);
      const perlu = rows.filter(function (r) { return !r.verifikasi || r.ditandai; }).length;
      $('#absBody').innerHTML =
        (perlu && f.status !== 'perlu_tinjau' ? '<div class="note note-warn" style="margin-bottom:14px">' + ic('alert', 18) + '<div><b>' + perlu + ' absen perlu ditinjau</b> (di luar jadwal / ditandai) — belum dihitung honor. <button class="link" id="lnkTinjau">Tampilkan</button></div></div>' : '') +
        (list.length ? '<div class="tbl-wrap only-d"><table class="tbl"><thead><tr><th>Tanggal</th><th>Nama Guru</th><th>TKB</th><th>Jam</th><th class="n">Jarak</th><th>Foto</th><th>Status</th><th>Tanda</th><th></th></tr></thead><tbody>' +
          page.map(function (r) {
            return '<tr class="click" data-id="' + esc(r.id) + '"><td class="mono">' + T.tglIndo(r.tanggal, { pendek: true }) + '<div class="xs muted">' + T.hariOf(r.tanggal) + '</div></td><td><div class="who">' + T.avatar(r.nama, 'av-sm') + '<div><b>' + esc(r.nama) + '</b><span class="mono">' + esc(r.nip) + '</span></div></div></td>' +
              '<td>' + esc(r.tkb) + '</td><td class="mono">' + T.jam5(r.jam) + '</td><td class="n">' + (r.jarak !== null ? Math.round(r.jarak) + ' m' : '–') + '</td><td>' + (r.ada_foto ? '<span class="itile itile-xs t-blue">' + ic('image', 15) + '</span>' : '<span class="muted xs">manual</span>') + '</td>' +
              '<td>' + T.chipAbsen(r) + '</td><td>' + tanda(r) + '</td><td><button class="btn btn-ghost btn-xs">Detail ' + ic('chevronRight', 14) + '</button></td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="cards-m only-m">' + page.map(function (r) {
            return '<div class="mcard" data-id="' + esc(r.id) + '">' + T.avatar(r.nama, 'av-sm') + '<div class="grow" style="min-width:0"><div class="row-b"><b class="ellipsis" style="font-family:var(--f-head)">' + esc(r.nama) + '</b>' + T.chipAbsen(r) + '</div>' +
              '<div class="small muted mt-4">' + T.tglIndo(r.tanggal, { pendek: true }) + ' · <span class="mono">' + T.jam5(r.jam) + '</span> · ' + esc(r.tkb) + '</div><div class="row mt-8 wrap">' + tanda(r) + (r.jarak !== null ? '<span class="chip chip-slate chip-mono chip-sm">' + Math.round(r.jarak) + ' m</span>' : '') + '</div></div></div>';
          }).join('') + '</div>' +
          '<div class="pager"><span>Menampilkan ' + (hal * PER + 1) + '–' + Math.min(list.length, hal * PER + PER) + ' dari ' + list.length + ' data</span><div class="row"><button class="btn btn-outline btn-sm" id="pgPrev" ' + (hal ? '' : 'disabled') + '>' + ic('chevronLeft', 16) + '</button><span class="mono small">' + (hal + 1) + '/' + (maxHal + 1) + '</span><button class="btn btn-outline btn-sm" id="pgNext" ' + (hal < maxHal ? '' : 'disabled') + '>' + ic('chevronRight', 16) + '</button></div></div>'
          : '<div class="panel"><div class="empty"><div class="itile">' + ic('userCheck', 26) + '</div><b>Tidak ada data absensi</b>Ubah rentang tanggal atau filter.</div></div>');
      const pv = $('#pgPrev'), nx = $('#pgNext'); if (pv) pv.onclick = function () { hal--; gambar(); }; if (nx) nx.onclick = function () { hal++; gambar(); };
      const lt = $('#lnkTinjau'); if (lt) lt.onclick = function () { f.status = 'perlu_tinjau'; $('#fSt').value = f.status; muat(); };
    };
    function tanda(r) { let s = ''; if (!r.verifikasi) s += '<span class="chip chip-warn chip-sm">Perlu verifikasi</span> '; if (r.ditandai) s += '<span class="chip chip-err chip-sm">Mencurigakan</span> '; if (r.diubah_admin) s += '<span class="chip chip-slate chip-sm">Diubah admin</span>'; return s || '<span class="muted xs">–</span>'; }
    T.on($('#absBody'), 'click', '[data-id]', function (e, t) { const r = rows.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0]; if (r) detail(r); });
    $('#fQ').oninput = T.debounce(function () { f.q = this.value; hal = 0; gambar(); }, 200);
    ['fDari', 'fSampai', 'fTkb', 'fSt'].forEach(function (id) { $('#' + id).onchange = function () { f.dari = $('#fDari').value; f.sampai = $('#fSampai').value; f.id_tkb = $('#fTkb').value; f.status = $('#fSt').value; muat(); }; });
    $('#btnTambah').onclick = function () { formAbsen(null); };
    muat();

    function detail(r) {
      const mm = T.modal({ title: r.nama, sub: T.tglIndo(r.tanggal, { hari: true }) + ' · <span class="mono">' + esc(r.id) + '</span>', wide: true, body:
        '<div class="gcols c2" style="gap:16px"><div><div class="photo-box" id="aPh"><div class="ph-load">' + ic('image', 18) + (r.ada_foto ? 'Memuat foto…' : 'Tanpa foto (input manual)') + '</div></div>' +
        (r.lat !== null ? '<div class="radar mt-12">' + Charts.radar({ radius: radiusTkb(r.id_tkb), jarak: r.jarak, akurasi: r.akurasi, label: 'Posisi guru' }) + '<div class="rfoot"><span>' + Number(r.lat).toFixed(6) + ', ' + Number(r.lng).toFixed(6) + '</span><a href="https://www.google.com/maps?q=' + r.lat + ',' + r.lng + '" target="_blank" rel="noopener">Google Maps ↗</a></div></div>' : '') + '</div>' +
        '<div><div class="row wrap">' + T.chipAbsen(r) + tanda(r) + '</div><div class="kv mt-12">' +
        [['TKB', esc(r.tkb)], ['Jam Server', esc(r.jam) + ' WIB'], ['Jarak', r.jarak !== null ? Math.round(r.jarak) + ' m' : '–'], ['Akurasi GPS', r.akurasi !== null ? '±' + r.akurasi + ' m' : '–'], ['Jenis Foto', r.jenis_foto || '–'], ['Terlambat', r.menit ? r.menit + ' menit' : '–']].map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
        (r.perangkat ? '<div class="xs muted mt-8 mono ellipsis">Perangkat: ' + esc(r.perangkat) + '</div>' : '') +
        (r.catatan ? '<div class="note mt-12">' + ic('message', 16) + '<div class="small">' + esc(r.catatan) + '</div></div>' : '') +
        '<div class="col mt-16">' + (r.verifikasi ? '<button class="btn btn-outline" data-act="unver">' + ic('x', 18) + ' Batalkan Verifikasi</button>' : '<button class="btn btn-ok" data-act="ver">' + ic('checkCircle', 18) + ' Verifikasi (hitung honor)</button>') +
        (r.ditandai ? '' : '<button class="btn btn-danger-soft" data-act="tandai">' + ic('alert', 18) + ' Tandai Mencurigakan</button>') +
        '<button class="btn btn-tonal" data-act="koreksi">' + ic('edit', 18) + ' Koreksi Data</button><button class="btn btn-ghost" data-act="hapus" style="color:var(--err-tx)">' + ic('trash', 18) + ' Hapus Absen</button></div></div></div>' });
      if (r.ada_foto) App.fotoAbsen(r.id).then(function (u) { const b = $('#aPh', mm.root); if (!b) return; b.innerHTML = u ? '<img src="' + u + '" alt="Foto bukti">' : '<div class="ph-load">Foto tidak dapat dimuat.</div>'; });
      T.on(mm.root, 'click', '[data-act]', async function (e, b) {
        const act = b.getAttribute('data-act'); let res;
        if (act === 'ver' || act === 'unver') res = await T.withBtn(b, function () { return T.api('absensi.verifikasi', { id: r.id, verifikasi: act === 'ver' }); });
        else if (act === 'tandai') { const c = await T.prompt({ title: 'Tandai absen mencurigakan', label: 'Catatan', placeholder: 'Mis. foto tidak di lokasi TKB', ok: 'Tandai', danger: true }); if (c === null) return; res = await T.api('absensi.verifikasi', { id: r.id, ditandai: true, catatan: c }); }
        else if (act === 'koreksi') { mm.close(); return formAbsen(r); }
        else if (act === 'hapus') { const c = await T.prompt({ title: 'Hapus data absen?', sub: esc(r.nama) + ' · ' + T.tglIndo(r.tanggal), label: 'Alasan penghapusan', ok: 'Hapus', danger: true }); if (c === null) return; res = await T.api('absensi.hapus', { id: r.id, alasan: c }); }
        if (!res) return;
        if (!res.success) return T.toast(res.message, 'err');
        T.toast(res.message, 'ok'); mm.close(); afterWrite(); muat();
      });
    }
    function radiusTkb(id) { const t = M && M.tkb.filter(function (x) { return x.id === id; })[0]; return t ? t.radius : Number(T.Set.v.radius_gps_meter) || 50; }
    function formAbsen(r) {
      if (!M) return T.toast('Data master belum termuat.', 'warn');
      const gl = guruAbsen(M);
      T.modal({ title: r ? 'Koreksi Data Absen' : 'Tambah Absen Manual', sub: r ? esc(r.nama) + ' · ' + T.tglIndo(r.tanggal) : 'Untuk guru yang hadir tetapi gagal absen (HP rusak, GPS bermasalah)', body:
        '<div class="field"><label class="label" for="kG">Guru <span class="req">*</span></label><select class="select" id="kG">' + opsiGuru(gl, r ? r.id_pengguna : '', '— Pilih guru —') + '</select></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="kT">Tanggal</label><input class="input" type="date" id="kT" max="' + now + '" value="' + (r ? r.tanggal : now) + '"></div><div class="field"><label class="label" for="kJ">Jam</label><input class="input mono" type="time" id="kJ" value="' + (r ? T.jam5(r.jam) : T.nowWib().jam) + '"></div></div>' +
        '<div class="field mt-16"><label class="label" for="kK">TKB</label><select class="select" id="kK">' + opsiTkb(M.tkb, r ? r.id_tkb : '', '— Pilih TKB —') + '</select></div>' +
        '<div class="field"><label class="label" for="kS">Status</label><select class="select" id="kS"><option value="tepat_waktu">Tepat Waktu</option><option value="terlambat">Terlambat</option><option value="di_luar_jadwal">Di Luar Jadwal</option></select><div class="help">Absen hasil koreksi otomatis terverifikasi (dihitung honor).</div></div>' +
        '<div class="field"><label class="label" for="kM">Menit terlambat (bila terlambat)</label><input class="input mono" type="number" min="0" id="kM" value="' + (r ? r.menit || 0 : 0) + '"></div>' +
        '<div class="field"><label class="label" for="kA">Alasan koreksi <span class="req">*</span></label><textarea class="textarea" id="kA" placeholder="Wajib diisi — tercatat di log audit"></textarea></div>',
        actions: [{ label: 'Batal' }, { label: 'Simpan', cls: 'btn-primary', onClick: async function (close, root) {
          const d = { id: r ? r.id : '', id_pengguna: $('#kG', root).value, tanggal: $('#kT', root).value, jam: $('#kJ', root).value, id_tkb: $('#kK', root).value, status: $('#kS', root).value, menit: Number($('#kM', root).value || 0), alasan: $('#kA', root).value };
          const res = await T.api('absensi.simpan', d);
          if (!res.success) { T.toast(res.message, 'err'); return false; }
          T.toast(res.message, 'ok'); afterWrite(); muat();
        } }] });
      if (r) $('#kS').value = r.status;
    }
  } });

  // ------------------------------------------------------------------------
  //  PERSETUJUAN
  // ------------------------------------------------------------------------
  App.reg('a/persetujuan', { shell: 'admin', admin: true, title: 'Persetujuan', render: function (el, p) {
    let tab = p.tab === 'akun' ? 'akun' : p.tab === 'riwayat' ? 'riwayat' : 'izin', D = null, M = null, pilih = null;
    el.innerHTML = head('Pusat Persetujuan', 'Proses pengajuan izin/sakit dan permintaan akun Google baru.') + '<div id="psBody"><div class="skel" style="height:320px"></div></div>';
    master(function (m) { if (m) M = m; });
    const muat = function (force) { if (!el.isConnected) return;
      T.load('persetujuan.list', {}, function (d, m) { if (!d) { $('#psBody').innerHTML = errBox(m.error); return; } D = d; App.setBadge(d.izin.length + d.akun.length); gambar(); }, { maxAge: 10000, force: force });
    };
    const gambar = function () { if (!el.isConnected) return;
      const box = $('#psBody');
      box.innerHTML = '<div class="tabs"><button data-t="izin" class="' + (tab === 'izin' ? 'on' : '') + '">' + ic('fileText', 17) + 'Izin / Sakit <span class="badge ' + (D.izin.length ? 'badge-err' : '') + '">' + D.izin.length + '</span></button><button data-t="akun" class="' + (tab === 'akun' ? 'on' : '') + '">' + ic('google', 17) + 'Akun Google Baru <span class="badge ' + (D.akun.length ? 'badge-err' : '') + '">' + D.akun.length + '</span></button><button data-t="riwayat" class="' + (tab === 'riwayat' ? 'on' : '') + '">' + ic('history', 17) + 'Riwayat</button></div><div id="psIn" class="mt-16"></div>';
      T.on(box.firstChild, 'click', '[data-t]', function (e, b) { tab = b.getAttribute('data-t'); pilih = null; gambar(); });
      const inn = $('#psIn');
      if (tab === 'izin') {
        if (!D.izin.length) { inn.innerHTML = '<div class="panel"><div class="empty"><div class="itile">' + ic('checkCircle', 26) + '</div><b>Tidak ada pengajuan menunggu</b>Semua pengajuan sudah diproses.</div></div>'; return; }
        if (!pilih || !D.izin.some(function (z) { return z.id === pilih; })) pilih = D.izin[0].id;
        const z = D.izin.filter(function (x) { return x.id === pilih; })[0];
        const n = Math.round((T.parseTgl(z.selesai) - T.parseTgl(z.mulai)) / 864e5) + 1;
        inn.innerHTML = '<div class="gcols c12"><div class="list">' + D.izin.map(function (x) {
          return '<button class="li" data-pilih="' + esc(x.id) + '" style="' + (x.id === pilih ? 'background:var(--p-50)' : '') + '">' + T.avatar(x.nama, 'av-sm') + '<div class="grow" style="min-width:0"><div class="t ellipsis">' + esc(x.nama) + '</div><div class="s">' + esc(T.JENIS_IZIN[x.jenis]) + ' · ' + T.tglIndo(x.mulai, { pendek: true, tanpaTahun: true }) + (x.selesai !== x.mulai ? '–' + T.tglIndo(x.selesai, { pendek: true, tanpaTahun: true }) : '') + '</div></div>' + T.chipIzin(x.status) + '</button>';
        }).join('') + '</div>' +
          '<div class="panel"><div class="panel-hd"><div class="row">' + T.avatar(z.nama, 'av-lg') + '<div><h3>' + esc(z.nama) + '</h3><div class="sub mono">NIP ' + esc(z.nip || '-') + '</div></div></div><span class="chip chip-lg ' + (z.jenis === 'sakit' ? 'chip-warn' : 'chip-p') + '">' + esc(T.JENIS_IZIN[z.jenis]) + '</span></div>' +
          '<div class="panel-bd"><div class="kv"><div><small>Tanggal Mulai</small><b>' + T.tglIndo(z.mulai, { hari: true }) + '</b></div><div><small>Tanggal Selesai</small><b>' + T.tglIndo(z.selesai, { hari: true }) + '</b></div><div><small>Durasi</small><b>' + n + ' hari</b></div><div><small>Diajukan</small><b>' + esc(String(z.diajukan).replace('T', ' ').slice(0, 16)) + '</b></div></div>' +
          '<h4 class="mt-16">Alasan</h4><p class="mt-4" style="white-space:pre-wrap;line-height:1.6">' + esc(z.alasan) + '</p>' +
          '<h4 class="mt-16">Lampiran</h4><div class="mt-8" id="lampBox">' + (z.ada_lampiran ? '<button class="btn btn-tonal btn-sm" id="btnLamp">' + ic('fileText', 16) + ' Lihat lampiran</button>' : '<span class="muted small">Tidak ada lampiran</span>') + '</div>' +
          '<div class="grid2 mt-20"><button class="btn btn-outline btn-lg" id="btnTolak">' + ic('x', 19) + ' Tolak</button><button class="btn btn-primary btn-lg" id="btnSetuju">' + ic('check', 19) + ' Setujui</button></div></div></div></div>';
        T.on(inn, 'click', '[data-pilih]', function (e, b) { pilih = b.getAttribute('data-pilih'); gambar(); });
        const bl = $('#btnLamp'); if (bl) bl.onclick = async function () { const r = await T.withBtn(bl, function () { return T.api('izin.lampiran', { id: z.id }); }); if (!r.success) return T.toast(r.message, 'err'); if (/^data:application\/pdf/.test(r.data.dataUrl)) T.downloadDataUrl(r.data.dataUrl, 'lampiran-' + z.id + '.pdf'); else $('#lampBox').innerHTML = '<img src="' + r.data.dataUrl + '" alt="Lampiran" style="max-width:100%;border-radius:12px;border:1px solid var(--line)">'; };
        $('#btnSetuju').onclick = function () { proses(z.id, 'disetujui', '', this); };
        $('#btnTolak').onclick = async function () { const c = await T.prompt({ title: 'Tolak pengajuan', sub: esc(z.nama), label: 'Catatan untuk guru', min: 3, ok: 'Tolak Pengajuan', danger: true }); if (c !== null) proses(z.id, 'ditolak', c, this); };
      } else if (tab === 'akun') {
        if (!D.akun.length) { inn.innerHTML = '<div class="panel"><div class="empty"><div class="itile">' + ic('users', 26) + '</div><b>Tidak ada permintaan akun</b>Akun Google baru yang masuk akan menunggu di sini.</div></div>'; return; }
        inn.innerHTML = '<div class="col gap-12">' + D.akun.map(function (a) {
          return '<div class="panel"><div class="panel-hd"><div class="row">' + T.avatar(a.nama) + '<div><h3>' + esc(a.nama) + '</h3><div class="sub mono">' + esc(a.email) + '</div></div></div><span class="chip ' + (a.baru ? 'chip-ok' : 'chip-p') + '">' + (a.baru ? 'Registrasi Baru' : 'Tertaut ke data guru') + '</span></div>' +
            '<div class="panel-bd"><div class="small muted">Masuk pertama: ' + esc(String(a.dibuat || '').replace('T', ' ').slice(0, 16)) + '</div><div class="row mt-12" style="justify-content:flex-end"><button class="btn btn-outline btn-sm" data-ak-tolak="' + esc(a.id) + '">Tolak</button><button class="btn btn-primary btn-sm" data-ak-ok="' + esc(a.id) + '">' + ic('checkCircle', 16) + ' Setujui…</button></div></div></div>';
        }).join('') + '</div>';
        T.on(inn, 'click', '[data-ak-tolak]', async function (e, b) { if (!await T.confirm({ title: 'Tolak akun ini?', ok: 'Tolak', danger: true })) return; prosesAkun({ id: b.getAttribute('data-ak-tolak'), keputusan: 'tolak' }, b); });
        T.on(inn, 'click', '[data-ak-ok]', function (e, b) { const a = D.akun.filter(function (x) { return x.id === b.getAttribute('data-ak-ok'); })[0]; dialogAkun(a); });
      } else {
        inn.innerHTML = D.riwayat.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guru</th><th>Jenis</th><th>Tanggal</th><th>Status</th><th>Diproses</th><th>Catatan</th><th></th></tr></thead><tbody>' + D.riwayat.map(function (z) {
          return '<tr><td><b>' + esc(z.nama) + '</b></td><td>' + esc(T.JENIS_IZIN[z.jenis]) + '</td><td class="mono">' + esc(z.mulai) + (z.selesai !== z.mulai ? ' → ' + esc(z.selesai) : '') + '</td><td>' + T.chipIzin(z.status) + '</td><td class="small">' + esc(z.diproses_oleh) + '<div class="xs muted">' + esc(String(z.diproses_pada).replace('T', ' ').slice(0, 16)) + '</div></td><td class="small">' + esc(z.catatan) + '</td>' +
            '<td>' + (z.status === 'disetujui' ? '<button class="btn btn-ghost btn-xs" data-batal="' + esc(z.id) + '">Batalkan izin</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="panel"><div class="empty"><b>Belum ada riwayat</b></div></div>';
        T.on(inn, 'click', '[data-batal]', async function (e, b) { const c = await T.prompt({ title: 'Batalkan izin yang sudah disetujui?', sub: 'Gunakan bila guru ternyata hadir. Hari tersebut kembali dinilai normal.', label: 'Catatan', min: 3, ok: 'Batalkan Izin', danger: true }); if (c !== null) proses(b.getAttribute('data-batal'), 'dibatalkan', c, b); });
      }
    };
    async function proses(id, kep, cat, btn) {
      const r = await T.withBtn(btn, function () { return T.api('izin.proses', { id: id, keputusan: kep, catatan: cat }); });
      if (!r.success) return T.toast(r.message, 'err');
      T.toast(r.message, 'ok', 5000); afterWrite(); muat(true);
    }
    async function prosesAkun(d, btn) {
      const r = await T.withBtn(btn, function () { return T.api('akun.proses', d); });
      if (!r.success) { T.toast(r.message, 'err'); return false; }
      T.toast(r.message, 'ok'); afterWrite(); muat(true); return true;
    }
    function dialogAkun(a) {
      const kandidat = M ? M.guru.filter(function (g) { return g.id !== a.id && g.status === 'aktif' && (!g.email || g.google !== 'disetujui'); }) : [];
      T.modal({ title: 'Setujui Akun Google', sub: '<span class="mono">' + esc(a.email) + '</span>', body:
        '<div class="field"><label class="label">Cara menyetujui</label><label class="check"><input type="radio" name="cara" value="taut" ' + (a.baru && kandidat.length ? 'checked' : '') + ' ' + (kandidat.length ? '' : 'disabled') + '> Tautkan ke data guru yang sudah ada</label>' +
        '<select class="select mt-8" id="akTaut" ' + (kandidat.length ? '' : 'disabled') + '>' + opsiGuru(kandidat, '', '— Pilih guru —') + '</select>' +
        '<label class="check mt-12"><input type="radio" name="cara" value="baru" ' + (a.baru && kandidat.length ? '' : 'checked') + '> ' + (a.baru ? 'Jadikan akun baru' : 'Setujui untuk data guru ini') + '</label></div>' +
        '<div class="field"><label class="label">Peran</label><div class="seg" id="akPeran"><button type="button" class="on" data-p="guru">Guru</button><button type="button" data-p="admin">Admin</button></div><div class="help">Peran hanya berlaku untuk akun baru. Akun yang ditautkan mengikuti peran guru tujuan.</div></div>' +
        '<div class="note note-p mt-12">' + ic('info', 18) + '<div>Disarankan <b>menautkan</b> ke data guru yang sudah ada agar NIP, jadwal, dan riwayat absen menyatu.</div></div>',
        actions: [{ label: 'Batal' }, { label: 'Setujui Akun', cls: 'btn-primary', onClick: async function (close, root) {
          const cara = (root.querySelector('input[name=cara]:checked') || {}).value, peran = $('#akPeran .on', root).getAttribute('data-p');
          const d = { id: a.id, keputusan: 'setujui', peran: peran };
          if (cara === 'taut') { d.tautkan_ke = $('#akTaut', root).value; if (!d.tautkan_ke) { T.toast('Pilih guru tujuan.', 'warn'); return false; } }
          return (await prosesAkun(d)) ? undefined : false;
        } }] });
      T.on($('#akPeran'), 'click', '[data-p]', function (e, b) { T.$$('#akPeran button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    }
    muat();
  } });

  // ------------------------------------------------------------------------
  //  DATA GURU
  // ------------------------------------------------------------------------
  function tampilKredensial(list, judul) {
    const teks = list.map(function (a) { return a.nama + '\nUsername: ' + a.username + '\nSandi awal: ' + a.sandi; }).join('\n\n');
    T.modal({ title: judul || 'Kredensial Akun', sub: 'Hanya tampil sekali. Bagikan ke guru secara pribadi.', wide: list.length > 3, body:
      '<div class="note note-warn">' + ic('alert', 18) + '<div>Guru wajib membuat sandi baru saat masuk pertama kali. Sandi ini tidak bisa dilihat lagi setelah jendela ditutup.</div></div>' +
      '<div class="col mt-12" style="max-height:50vh;overflow:auto">' + list.map(function (a) {
        const wa = '';
        return '<div class="cred"><b style="font-family:var(--f-head)">' + esc(a.nama) + '</b><br>Username: ' + esc(a.username) + '<br>Sandi awal: <b>' + esc(a.sandi) + '</b>' + wa + '</div>';
      }).join('') + '</div>',
      actions: [{ label: ic('copy', 17) + ' Salin Semua', cls: 'btn-outline', onClick: function () { T.copyText(teks + '\n\nLink: ' + location.origin + location.pathname); return false; } },
        { label: ic('download', 17) + ' Unduh CSV', cls: 'btn-outline', onClick: function () { T.downloadText(T.toCsv([['Nama', 'Username', 'Sandi Awal']].concat(list.map(function (a) { return [a.nama, a.username, a.sandi]; }))), 'akun-guru.csv'); return false; } },
        { label: 'Selesai', cls: 'btn-primary' }] });
  }
  App.tampilKredensial = tampilKredensial;

  App.reg('a/guru', { shell: 'admin', admin: true, title: 'Data Guru', render: function (el) {
    badgeLoad();
    let M = null, q = '', fPeran = '', fStatus = '';
    el.innerHTML = head('Data Guru', 'Kelola guru pamong, akun login, dan hak admin.', '<button class="btn btn-tonal" id="btnImpor">' + ic('upload', 19) + ' Impor CSV</button><button class="btn btn-primary" id="btnAdd">' + ic('plus', 19) + ' Tambah Guru</button>') +
      '<div class="toolbar"><div class="ifield">' + ic('search', 18) + '<input class="input" id="gQ" placeholder="Cari nama, NIP, mapel…"></div><select class="select" id="gPeran"><option value="">Semua Peran</option><option value="guru">Guru</option><option value="admin">Admin</option></select><select class="select" id="gSt"><option value="">Semua Status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="menunggu">Menunggu</option></select></div><div id="gBody"><div class="skel" style="height:300px"></div></div>';
    const gambar = function () { if (!el.isConnected) return;
      const list = M.guru.filter(function (g) {
        if (fPeran && g.peran !== fPeran) return false; if (fStatus && g.status !== fStatus) return false;
        return !q || (g.nama + ' ' + g.nip + ' ' + g.mapel + ' ' + g.email).toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (a.peran === 'admin' ? 0 : 1) - (b.peran === 'admin' ? 0 : 1) || a.nama.localeCompare(b.nama); });
      $('#gBody').innerHTML = '<div class="small muted" style="margin-bottom:10px">' + list.length + ' dari ' + M.guru.length + ' pengguna</div>' +
        '<div class="tbl-wrap only-d"><table class="tbl"><thead><tr><th>Nama</th><th>NIP / Username</th><th>Mapel</th><th>No. HP</th><th>TKB Binaan</th><th>Peran</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (g) {
          return '<tr><td><div class="who">' + T.avatar(g.nama, 'av-sm') + '<div><b>' + esc(g.nama) + '</b><span>' + (g.email ? esc(g.email) + (g.google === 'disetujui' ? ' ✓' : g.google === 'menunggu' ? ' (menunggu)' : '') : 'Tanpa akun Google') + '</span></div></div></td>' +
            '<td class="mono">' + esc(g.nip || '–') + '</td><td>' + esc(g.mapel || '–') + '</td><td class="mono">' + esc(g.hp || '–') + '</td><td>' + (g.tkb_binaan.length ? g.tkb_binaan.map(function (t) { return '<span class="chip chip-teal chip-sm">' + esc(t) + '</span>'; }).join(' ') : '<span class="muted xs">' + g.jumlah_jadwal + ' jadwal</span>') + '</td>' +
            '<td>' + (g.peran === 'admin' ? '<span class="chip chip-violet chip-sm">Admin' + (g.ikut_absen ? ' + Guru' : '') + '</span>' : '<span class="chip chip-p chip-sm">Guru</span>') + '</td><td>' + stChip(g.status) + (g.wajib_ganti ? '<div class="xs muted mt-4">Belum ganti sandi</div>' : '') + '</td>' +
            '<td><div class="row" style="gap:2px"><button class="icon-btn" data-edit="' + esc(g.id) + '" title="Ubah" aria-label="Ubah">' + ic('edit', 18) + '</button><button class="icon-btn" data-reset="' + esc(g.id) + '" title="Reset sandi" aria-label="Reset sandi">' + ic('key', 18) + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="cards-m only-m">' + list.map(function (g) {
          return '<div class="mcard" data-edit="' + esc(g.id) + '">' + T.avatar(g.nama) + '<div class="grow" style="min-width:0"><div class="row-b"><b class="ellipsis" style="font-family:var(--f-head)">' + esc(g.nama) + '</b>' + stChip(g.status) + '</div><div class="small muted mono">' + esc(g.nip || '–') + '</div><div class="row wrap mt-8">' + (g.peran === 'admin' ? '<span class="chip chip-violet chip-sm">Admin</span>' : '<span class="chip chip-p chip-sm">Guru</span>') + (g.mapel ? '<span class="chip chip-slate chip-sm">' + esc(g.mapel) + '</span>' : '') + '</div></div></div>';
        }).join('') + '</div>';
    };
    function stChip(s) { return '<span class="chip chip-sm ' + (s === 'aktif' ? 'chip-ok' : s === 'menunggu' ? 'chip-warn' : 'chip-slate') + '"><span class="dot"></span>' + esc(s) + '</span>'; }
    master(function (m, info) { if (!m) { $('#gBody').innerHTML = errBox(info.error); return; } M = m; gambar(); });
    $('#gQ').oninput = T.debounce(function () { q = this.value.toLowerCase(); gambar(); }, 150);
    $('#gPeran').onchange = function () { fPeran = this.value; gambar(); }; $('#gSt').onchange = function () { fStatus = this.value; gambar(); };
    T.on(el, 'click', '[data-edit]', function (e, b) { form(M.guru.filter(function (g) { return g.id === b.getAttribute('data-edit'); })[0]); });
    T.on(el, 'click', '[data-reset]', async function (e, b) {
      const g = M.guru.filter(function (x) { return x.id === b.getAttribute('data-reset'); })[0];
      if (!await T.confirm({ title: 'Reset kata sandi ' + g.nama + '?', sub: 'Sistem membuat sandi sementara baru. Semua sesi guru ini berakhir dan ia wajib membuat sandi baru saat masuk.', ok: 'Reset Sandi', danger: true })) return;
      const r = await T.api('guru.resetSandi', { id: g.id }); if (!r.success) return T.toast(r.message, 'err');
      tampilKredensial([{ nama: r.data.nama, username: r.data.username, sandi: r.data.sandi }], 'Sandi Baru');
    });
    $('#btnAdd').onclick = function () { form(null); };
    $('#btnImpor').onclick = imporCsv;
    function form(g) {
      g = g || {};
      T.modal({ title: g.id ? 'Ubah Data Guru' : 'Tambah Guru', wide: true, body:
        '<div class="grid2"><div class="field"><label class="label" for="fN">Nama lengkap <span class="req">*</span></label><input class="input" id="fN" value="' + esc(g.nama || '') + '" placeholder="Siti Aminah, S.Pd."></div>' +
        '<div class="field"><label class="label" for="fNip">NIP / NUPTK / username <span class="req">*</span></label><input class="input mono" id="fNip" value="' + esc(g.nip || '') + '" placeholder="198510292012012001"><div class="help">Dipakai untuk login.</div></div></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="fMp">Mata pelajaran</label><input class="input" id="fMp" value="' + esc(g.mapel || '') + '"></div><div class="field"><label class="label" for="fHp">No. HP / WhatsApp</label><input class="input mono" id="fHp" inputmode="tel" value="' + esc(g.hp || '') + '" placeholder="08xxxxxxxxxx"></div></div>' +
        '<div class="field mt-16"><label class="label" for="fEm">Email Google (opsional)</label><input class="input mono" id="fEm" type="email" value="' + esc(g.email || '') + '" placeholder="nama@gmail.com"><div class="help">Bila diisi, guru bisa langsung "Masuk dengan Google" tanpa menunggu persetujuan.</div></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label">Peran</label><div class="seg" id="fPeran"><button type="button" data-p="guru" class="' + (g.peran !== 'admin' ? 'on' : '') + '">Guru</button><button type="button" data-p="admin" class="' + (g.peran === 'admin' ? 'on' : '') + '">Admin</button></div></div>' +
        '<div class="field"><label class="label">Status akun</label><div class="seg" id="fSt"><button type="button" data-s="aktif" class="' + (g.status !== 'nonaktif' ? 'on' : '') + '">Aktif</button><button type="button" data-s="nonaktif" class="' + (g.status === 'nonaktif' ? 'on' : '') + '">Nonaktif</button></div></div></div>' +
        '<label class="row-b mt-16 card card-pad" id="fIkutBox" style="box-shadow:none;' + (g.peran === 'admin' ? '' : 'display:none') + '"><div><b class="small" style="font-family:var(--f-head)">Admin juga mengajar</b><div class="xs muted">Ikut absen & dihitung honorarium</div></div><span class="toggle"><input type="checkbox" id="fIkut" ' + (g.ikut_absen ? 'checked' : '') + '><span></span></span></label>' +
        (g.id ? '' : '<div class="field mt-16"><label class="label" for="fSandi">Kata sandi awal (opsional)</label><input class="input mono" id="fSandi" placeholder="Kosongkan agar dibuat otomatis"><div class="help">Guru wajib menggantinya saat login pertama.</div></div>'),
        actions: [{ label: 'Batal' }, { label: g.id ? 'Simpan Perubahan' : 'Tambah Guru', cls: 'btn-primary', onClick: async function (close, root) {
          const d = { id: g.id || '', nama: $('#fN', root).value, nip: $('#fNip', root).value, mapel: $('#fMp', root).value, hp: $('#fHp', root).value, email: $('#fEm', root).value,
            peran: $('#fPeran .on', root).getAttribute('data-p'), status: $('#fSt .on', root).getAttribute('data-s'), ikut_absen: $('#fIkut', root).checked, sandi: g.id ? '' : $('#fSandi', root).value };
          const r = await T.api('guru.simpan', d);
          if (!r.success) { T.toast(r.message, 'err'); return false; }
          T.toast(r.message, 'ok'); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true);
          if (r.data.sandiAwal) setTimeout(function () { tampilKredensial([{ nama: r.data.guru.nama, username: r.data.guru.nip, sandi: r.data.sandiAwal }], 'Akun Guru Dibuat'); }, 250);
        } }] });
      T.on($('#fPeran'), 'click', '[data-p]', function (e, b) { T.$$('#fPeran button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#fIkutBox').style.display = b.getAttribute('data-p') === 'admin' ? '' : 'none'; });
      T.on($('#fSt'), 'click', '[data-s]', function (e, b) { T.$$('#fSt button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    }
    function imporCsv() {
      let rows = [];
      const mm = T.modal({ title: 'Impor Guru dari CSV / Excel', wide: true, body:
        '<ol class="small" style="padding-left:18px;line-height:1.7;margin:0"><li>Unduh template, isi di Excel/Google Sheets: <span class="mono">nama, nip, mapel, hp, email</span>.</li><li>Simpan sebagai <b>CSV</b>, lalu pilih berkasnya di bawah (atau tempel isinya).</li><li>NIP yang sudah ada akan <b>diperbarui</b>, NIP baru <b>ditambahkan</b> dengan sandi awal otomatis.</li></ol>' +
        '<button class="btn btn-tonal btn-sm mt-12" id="tplCsv">' + ic('download', 16) + ' Unduh Template CSV</button>' +
        '<div class="field mt-16"><label class="label" for="csvF">Berkas CSV</label><input class="input" type="file" id="csvF" accept=".csv,text/csv" style="padding-top:11px"></div>' +
        '<div class="field"><label class="label" for="csvT">atau tempel isi CSV</label><textarea class="textarea mono" id="csvT" style="font-size:12.5px" placeholder="nama,nip,mapel,hp,email&#10;Siti Aminah S.Pd.,198510292012012001,Matematika,081234567890,"></textarea></div><div id="csvPrev"></div>',
        actions: [{ label: 'Batal' }, { label: 'Impor Sekarang', cls: 'btn-primary', onClick: async function () {
          if (!rows.length) { T.toast('Belum ada baris valid untuk diimpor.', 'warn'); return false; }
          const r = await T.api('guru.imporCsv', { rows: rows });
          if (!r.success) { T.toast(r.message, 'err'); return false; }
          T.toast(r.message, 'ok', 5000); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true);
          if (r.data.warnings.length) T.toast(r.data.warnings.slice(0, 3).join(' · '), 'warn', 7000);
          if (r.data.akunBaru.length) setTimeout(function () { tampilKredensial(r.data.akunBaru, 'Akun Guru Baru (' + r.data.akunBaru.length + ')'); }, 250);
        } }] });
      $('#tplCsv', mm.root).onclick = function () { T.downloadText('nama,nip,mapel,hp,email\nSiti Aminah S.Pd.,198510292012012001,Matematika,081234567890,siti@gmail.com\n', 'template-guru.csv'); };
      const parse = function (txt) {
        const data = T.parseCsv(txt); if (!data.length) { rows = []; $('#csvPrev', mm.root).innerHTML = ''; return; }
        const h = data[0].map(function (x) { return x.trim().toLowerCase(); });
        const idx = function (names) { for (let i = 0; i < names.length; i++) { const k = h.indexOf(names[i]); if (k >= 0) return k; } return -1; };
        const iN = idx(['nama', 'nama lengkap', 'nama_lengkap']), iP = idx(['nip', 'nuptk', 'nip/nuptk', 'nip_nuptk', 'username']), iM = idx(['mapel', 'mata pelajaran', 'mata_pelajaran']), iH = idx(['hp', 'no hp', 'no_hp', 'wa', 'whatsapp']), iE = idx(['email', 'email google', 'email_google']);
        const body = iN >= 0 ? data.slice(1) : data;
        const col = function (r, i, def) { return i >= 0 ? (r[i] || '').trim() : (def !== undefined ? (r[def] || '').trim() : ''); };
        rows = body.map(function (r) { return { nama: col(r, iN, 0), nip: col(r, iP, 1), mapel: col(r, iM, 2), hp: col(r, iH, 3), email: col(r, iE, 4) }; }).filter(function (r) { return r.nama || r.nip; });
        $('#csvPrev', mm.root).innerHTML = '<div class="row-b mt-12"><b class="small">Pratinjau (' + rows.length + ' baris)</b>' + (iN < 0 ? '<span class="chip chip-warn chip-sm">Tanpa baris judul — urutan kolom dipakai</span>' : '') + '</div><div class="tbl-wrap mt-8" style="max-height:220px;overflow:auto"><table class="tbl"><thead><tr><th>Nama</th><th>NIP</th><th>Mapel</th><th>HP</th><th>Email</th></tr></thead><tbody>' +
          rows.slice(0, 50).map(function (r) { return '<tr><td>' + esc(r.nama) + '</td><td class="mono">' + esc(r.nip) + '</td><td>' + esc(r.mapel) + '</td><td class="mono">' + esc(r.hp) + '</td><td class="mono">' + esc(r.email) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      };
      $('#csvF', mm.root).onchange = function () { const f = this.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = function () { $('#csvT', mm.root).value = rd.result; parse(rd.result); }; rd.readAsText(f); };
      $('#csvT', mm.root).oninput = T.debounce(function () { parse(this.value); }, 250);
    }
  } });

  // ------------------------------------------------------------------------
  //  TKB
  // ------------------------------------------------------------------------
  App.reg('a/tkb', { shell: 'admin', admin: true, title: 'Data TKB', render: function (el) {
    badgeLoad();
    let M = null;
    el.innerHTML = head('Tempat Kegiatan Belajar (TKB)', 'Atur titik GPS & radius tiap TKB, lalu cetak QR untuk ditempel di lokasi.', '<button class="btn btn-primary" id="btnAdd">' + ic('plus', 19) + ' Tambah TKB</button>') + '<div id="tBody"><div class="skel" style="height:260px"></div></div>';
    const gambar = function () { if (!el.isConnected) return;
      const list = M.tkb.slice().sort(function (a, b) { return (a.status === 'aktif' ? 0 : 1) - (b.status === 'aktif' ? 0 : 1) || a.nama.localeCompare(b.nama); });
      const jadN = {}; M.jadwal.forEach(function (j) { if (j.aktif) jadN[j.id_tkb] = (jadN[j.id_tkb] || 0) + 1; });
      $('#tBody').innerHTML = list.length ? '<div class="tkb-grid">' + list.map(function (t) {
        const adaLok = t.lat !== null && t.lng !== null;
        return '<div class="card" style="overflow:hidden;' + (t.status !== 'aktif' ? 'opacity:.7' : '') + '"><div class="tkb-map">' + Charts.miniMap(t.id) + '<span class="chip ' + (t.status === 'aktif' ? 'chip-ok' : 'chip-slate') + ' chip-sm"><span class="dot"></span>' + esc(t.status) + '</span></div>' +
          '<div class="card-pad"><div class="row-b"><h4 class="ellipsis">' + esc(t.nama) + '</h4><span class="chip chip-slate chip-mono chip-sm">' + esc(t.id) + '</span></div>' +
          '<div class="small muted mt-4 row">' + ic('mapPin', 14) + '<span class="ellipsis">' + esc(t.alamat || 'Alamat belum diisi') + '</span></div>' +
          '<div class="small muted mt-4 row">' + ic('user', 14) + esc(t.pj || 'PJ belum diisi') + '</div>' +
          '<div class="row wrap mt-12"><span class="chip chip-p chip-mono chip-sm">Radius ' + t.radius + ' m</span><span class="chip chip-slate chip-sm">' + (jadN[t.id] || 0) + ' jadwal</span>' + (adaLok ? '' : '<span class="chip chip-err chip-sm">' + ic('alert', 12) + 'Titik GPS belum diatur</span>') + '</div>' +
          '<div class="row mt-16"><button class="btn btn-primary btn-sm grow" data-qr="' + esc(t.id) + '" ' + (adaLok ? '' : 'disabled') + '>' + ic('printer', 16) + ' Cetak QR</button><button class="btn btn-outline btn-sm" data-edit="' + esc(t.id) + '">' + ic('edit', 16) + ' Ubah</button><button class="btn btn-ghost btn-icon btn-sm" data-more="' + esc(t.id) + '" aria-label="Lainnya">' + ic('moreV', 18) + '</button></div></div></div>';
      }).join('') + '</div>' : '<div class="panel"><div class="empty"><div class="itile">' + ic('building', 26) + '</div><b>Belum ada TKB</b>Tambahkan TKB pertama Anda, lalu atur titik GPS-nya.</div></div>';
    };
    master(function (m, info) { if (!m) { $('#tBody').innerHTML = errBox(info.error); return; } M = m; gambar(); });
    const tkbOf = function (id) { return M.tkb.filter(function (t) { return t.id === id; })[0]; };
    T.on(el, 'click', '[data-edit]', function (e, b) { form(tkbOf(b.getAttribute('data-edit'))); });
    T.on(el, 'click', '[data-qr]', function (e, b) { cetakQr([tkbOf(b.getAttribute('data-qr'))]); });
    T.on(el, 'click', '[data-more]', function (e, b) {
      const t = tkbOf(b.getAttribute('data-more'));
      const mm = T.modal({ title: t.nama, body: '<div class="list">' +
        '<button class="li" data-a="qr"><span class="itile itile-sm">' + ic('refresh', 18) + '</span><div class="grow"><div class="t">Buat Ulang QR</div><div class="s">QR lama langsung tidak berlaku (bila tersebar / difoto orang)</div></div></button>' +
        '<button class="li" data-a="kode"><span class="itile itile-sm">' + ic('keyboard', 18) + '</span><div class="grow"><div class="t">Lihat Kode Manual</div><div class="s mono">' + esc(t.token) + '</div></div></button>' +
        '<button class="li" data-a="hapus"><span class="itile itile-sm t-red">' + ic('trash', 18) + '</span><div class="grow"><div class="t">' + (t.status === 'aktif' ? 'Nonaktifkan / Hapus' : 'Hapus') + '</div><div class="s">TKB dengan riwayat absensi hanya dinonaktifkan</div></div></button></div>' });
      T.on(mm.root, 'click', '[data-a]', async function (e2, x) {
        const a = x.getAttribute('data-a');
        if (a === 'kode') { T.copyText(t.token); return; }
        if (a === 'qr') {
          if (!await T.confirm({ title: 'Buat ulang QR ' + t.nama + '?', sub: 'QR yang sudah tertempel tidak akan berlaku lagi. Cetak dan tempel QR baru.', ok: 'Buat QR Baru', danger: true })) return;
          const r = await T.api('tkb.buatUlangQr', { id: t.id }); if (!r.success) return T.toast(r.message, 'err');
          mm.close(); T.toast(r.message, 'ok', 5000); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true); cetakQr([r.data.tkb]);
        }
        if (a === 'hapus') {
          if (!await T.confirm({ title: 'Hapus TKB ' + t.nama + '?', sub: 'Bila sudah punya riwayat absensi/jadwal, TKB hanya dinonaktifkan agar rekap lama tetap utuh.', ok: 'Lanjutkan', danger: true })) return;
          const r = await T.api('tkb.hapus', { id: t.id }); if (!r.success) return T.toast(r.message, 'err');
          mm.close(); T.toast(r.message, 'ok', 5000); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true);
        }
      });
    });
    $('#btnAdd').onclick = function () { form(null); };

    function form(t) {
      t = t || { radius: Number(T.Set.v.radius_gps_meter) || 50, status: 'aktif' };
      let map = null, marker = null, circle = null;
      const mm = T.modal({ title: t.id ? 'Ubah TKB' : 'Tambah TKB', wide: 'x', body:
        '<div class="gcols c2" style="gap:20px"><div>' +
        '<div class="field"><label class="label" for="tN">Nama TKB <span class="req">*</span></label><input class="input" id="tN" value="' + esc(t.nama || '') + '" placeholder="TKB Cibeureum"></div>' +
        '<div class="field"><label class="label" for="tA">Alamat</label><input class="input" id="tA" value="' + esc(t.alamat || '') + '"></div>' +
        '<div class="field"><label class="label" for="tP">Penanggung jawab</label><input class="input" id="tP" value="' + esc(t.pj || '') + '"></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="tLat">Latitude</label><input class="input mono" id="tLat" inputmode="decimal" value="' + (t.lat !== null && t.lat !== undefined ? t.lat : '') + '" placeholder="-7.327400"></div><div class="field"><label class="label" for="tLng">Longitude</label><input class="input mono" id="tLng" inputmode="decimal" value="' + (t.lng !== null && t.lng !== undefined ? t.lng : '') + '" placeholder="108.220700"></div></div>' +
        '<button class="btn btn-tonal btn-block mt-12" id="tGps" type="button">' + ic('locate', 19) + ' Ambil Lokasi Saya Sekarang</button><div class="help mt-8" id="tGpsInfo">Berdiri di titik tengah TKB lalu tekan tombol di atas, atau klik/geser pin di peta.</div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="tR">Radius (meter)</label><input class="input mono" type="number" min="10" max="1000" id="tR" value="' + t.radius + '"></div>' +
        '<div class="field"><label class="label">Status</label><div class="seg" id="tSt"><button type="button" data-s="aktif" class="' + (t.status !== 'nonaktif' ? 'on' : '') + '">Aktif</button><button type="button" data-s="nonaktif" class="' + (t.status === 'nonaktif' ? 'on' : '') + '">Nonaktif</button></div></div></div></div>' +
        '<div><div id="tMap" style="height:380px;border-radius:16px;border:1px solid var(--line);overflow:hidden;background:#EEF4FB;display:flex;align-items:center;justify-content:center" class="muted small">Memuat peta…</div>' +
        '<div class="row-b mt-8 small"><span class="muted">Peta © OpenStreetMap</span><a id="tGmaps" target="_blank" rel="noopener" class="link">Cek di Google Maps ↗</a></div></div></div>',
        actions: [{ label: 'Batal' }, { label: 'Simpan TKB', cls: 'btn-primary', onClick: async function (close, root) {
          const d = { id: t.id || '', nama: $('#tN', root).value, alamat: $('#tA', root).value, pj: $('#tP', root).value, lat: $('#tLat', root).value.trim(), lng: $('#tLng', root).value.trim(), radius: $('#tR', root).value, status: $('#tSt .on', root).getAttribute('data-s') };
          const r = await T.api('tkb.simpan', d);
          if (!r.success) { T.toast(r.message, 'err'); return false; }
          T.toast(r.message, 'ok', 5000); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true);
        } }] });
      T.on($('#tSt'), 'click', '[data-s]', function (e, b) { T.$$('#tSt button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
      const sync = function (pan) {
        const lat = parseFloat($('#tLat').value), lng = parseFloat($('#tLng').value), r = Number($('#tR').value) || 50;
        $('#tGmaps').href = isFinite(lat) && isFinite(lng) ? 'https://www.google.com/maps?q=' + lat + ',' + lng : 'https://www.google.com/maps';
        if (!map || !isFinite(lat) || !isFinite(lng)) return;
        const ll = [lat, lng];
        if (!marker) { marker = L.marker(ll, { draggable: true }).addTo(map); marker.on('dragend', function () { const p = marker.getLatLng(); $('#tLat').value = p.lat.toFixed(6); $('#tLng').value = p.lng.toFixed(6); sync(false); }); circle = L.circle(ll, { radius: r, color: '#10B981', fillOpacity: .15 }).addTo(map); }
        marker.setLatLng(ll); circle.setLatLng(ll); circle.setRadius(r);
        if (pan) map.setView(ll, 18);
      };
      ['tLat', 'tLng', 'tR'].forEach(function (id) { $('#' + id).addEventListener('change', function () { sync(true); }); });
      $('#tGps').onclick = async function () {
        const b = this, info = $('#tGpsInfo');
        try {
          const p = await T.withBtn(b, function () { return T.getPosisi({ target: 8, timeout: 20000, onUpdate: function (x) { info.innerHTML = 'Akurasi saat ini: <b class="mono">±' + x.acc + ' m</b> — tunggu hingga ≤ 10 m…'; } }); });
          $('#tLat').value = p.lat.toFixed(6); $('#tLng').value = p.lng.toFixed(6); sync(true);
          info.innerHTML = 'Titik diambil dengan akurasi <b class="mono">±' + p.acc + ' m</b>.' + (p.acc > 20 ? ' <span style="color:var(--warn-tx)">Akurasi kurang baik — sebaiknya ulangi di area terbuka.</span>' : '');
        } catch (e) { T.toast(e.message || 'Lokasi tidak didapat.', 'err'); }
      };
      sync(false);
      (async function () {
        try {
          T.loadCss(T.LIB.leafletCss); await T.loadScript(T.LIB.leafletJs);
          const box = $('#tMap'); if (!box) return; box.innerHTML = '';
          const lat = parseFloat($('#tLat').value), lng = parseFloat($('#tLng').value), ada = isFinite(lat) && isFinite(lng);
          map = L.map(box).setView(ada ? [lat, lng] : [-6.9, 107.6], ada ? 18 : 8);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
          map.on('click', function (e) { $('#tLat').value = e.latlng.lat.toFixed(6); $('#tLng').value = e.latlng.lng.toFixed(6); sync(false); });
          sync(false); setTimeout(function () { map.invalidateSize(); }, 200);
        } catch (e) { const box = $('#tMap'); if (box) box.innerHTML = '<div class="center" style="padding:20px">' + ic('wifiOff', 22) + '<div class="mt-8">Peta tidak dapat dimuat. Isi koordinat manual atau pakai tombol "Ambil Lokasi Saya".</div></div>'; }
      })();
      return mm;
    }
  } });

  /** Cetak QR TKB (A4, satu halaman per TKB) */
  async function cetakQr(list) {
    const s = T.Set.v;
    let area = $('#printArea'); if (!area) { area = document.createElement('div'); area.id = 'printArea'; area.className = 'print-area'; document.body.appendChild(area); }
    let html = '';
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i]; const svg = await T.qrSvg('TEACHTRACK:' + t.token);
        html += '<div class="qr-sheet"><div class="hdr"><div class="lg">' + (s.logo_thumb ? '<img src="' + esc(s.logo_thumb) + '" alt="">' : ic('cap', 40)) + '</div><div style="text-align:left"><div style="font:700 16pt var(--f-head)">' + esc(s.nama_aplikasi) + '</div><div style="font-size:11pt;color:#475569">' + esc(s.subjudul) + ' · ' + esc(s.nama_sekolah_induk) + '</div></div></div>' +
          '<h1>' + esc(t.nama) + '</h1><div style="font-size:12pt;color:#475569;margin-top:3mm">' + esc(t.alamat || '') + '</div>' +
          '<div class="qrbox">' + svg + '</div><div class="cta">Pindai untuk absen kehadiran</div>' +
          '<div class="steps">Buka aplikasi ' + esc(s.nama_aplikasi) + ' → tekan tombol <b>Scan QR</b> → arahkan kamera ke kode ini.<br>Pastikan GPS aktif. Radius presensi: ' + t.radius + ' meter.</div>' +
          '<div class="code">KODE MANUAL: ' + esc(t.token) + '</div><div class="foot">' + esc(t.id) + ' · Dicetak ' + T.tglIndo(T.nowWib().tgl) + ' · Jangan dibagikan secara daring</div></div>';
      }
    } catch (e) { return T.toast('Pembuat QR tidak dapat dimuat. Periksa koneksi internet.', 'err'); }
    area.innerHTML = html;
    T.modal({ title: 'Pratinjau Cetak QR', sub: list.length + ' halaman A4 · tempel di lokasi TKB', wide: true, body: '<div style="transform:scale(.42);transform-origin:top left;width:210mm;height:' + (list.length * 125) + 'mm;pointer-events:none">' + html + '</div>',
      actions: [{ label: 'Tutup' }, { label: ic('printer', 18) + ' Cetak / Simpan PDF', cls: 'btn-primary', onClick: function () { window.print(); return false; } }] });
  }
  App.cetakQr = cetakQr;

  // ------------------------------------------------------------------------
  //  JADWAL MENGAJAR
  // ------------------------------------------------------------------------
  App.reg('a/jadwal', { shell: 'admin', admin: true, title: 'Jadwal Mengajar', render: function (el, p) {
    badgeLoad();
    let M = null, mode = p.mode === 'tkb' ? 'tkb' : 'guru', pilih = p.id || '', hariM = T.nowWib().hari, mkF = '';
    const HARI7 = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    el.innerHTML = head('Jadwal Mengajar', 'Jadwal per guru / per TKB. Dipakai untuk menentukan tepat waktu, terlambat, dan alpa.', '<button class="btn btn-tonal" id="btnCetakJdw">' + ic('printer', 19) + ' Cetak Jadwal TKB</button><button class="btn btn-primary" id="btnAdd">' + ic('plus', 19) + ' Tambah Jadwal</button>') + '<div id="jBody"><div class="skel" style="height:300px"></div></div>';
    const gambar = function () { if (!el.isConnected) return;
      const sumber = mode === 'guru' ? guruAbsen(M) : M.tkb;
      if (pilih && !sumber.some(function (x) { return x.id === pilih; })) pilih = '';
      const list = M.jadwal.filter(function (j) { return (!pilih || (mode === 'guru' ? j.id_pengguna === pilih : j.id_tkb === pilih)) && (!mkF || !j.minggu_ke || j.minggu_ke.split(',').indexOf(mkF) >= 0); });
      const lajur = {};   // jadwal yang jamnya beririsan (mis. bergilir minggu ke) ditampilkan berdampingan
      HARI7.forEach(function (h) {
        const ds = list.filter(function (j) { return j.hari === h; }).sort(function (a, b) { return T.menit(a.mulai) - T.menit(b.mulai); }), akhir = [];
        ds.forEach(function (j) { let l = 0; while (akhir[l] !== undefined && akhir[l] > T.menit(j.mulai)) l++; akhir[l] = T.menit(j.selesai); lajur[j.id] = l; });
        ds.forEach(function (j) { lajur[j.id + '#n'] = Math.max(1, akhir.length); });
      });
      const nama = {}; M.guru.forEach(function (g) { nama[g.id] = g.nama; });
      const warna = {}; let wi = 0; list.forEach(function (j) { const k = mode === 'guru' ? j.id_tkb : j.id_pengguna; if (warna[k] === undefined) warna[k] = wi++ % 6; });
      const jamMin = Math.min.apply(null, [7].concat(list.map(function (j) { return Math.floor(T.menit(j.mulai) / 60); })));
      const jamMax = Math.max.apply(null, [16].concat(list.map(function (j) { return Math.ceil(T.menit(j.selesai) / 60); })));
      const ROW = 48;
      $('#jBody').innerHTML = '<div class="toolbar"><div class="seg" style="width:auto"><button data-m="guru" class="' + (mode === 'guru' ? 'on' : '') + '">' + ic('users', 16) + 'Per Guru</button><button data-m="tkb" class="' + (mode === 'tkb' ? 'on' : '') + '">' + ic('building', 16) + 'Per TKB</button></div>' +
        '<select class="select" id="jSel" style="min-width:260px">' + (mode === 'guru' ? opsiGuru(sumber, pilih, 'Semua guru') : opsiTkb(sumber, pilih, 'Semua TKB')) + '</select>' +
        '<select class="select" id="jMk" aria-label="Minggu ke"><option value="">Semua minggu ke</option>' + ['I', 'II', 'III', 'IV', 'V'].map(function (x) { return '<option value="' + x + '"' + (mkF === x ? ' selected' : '') + '>Minggu ke-' + x + '</option>'; }).join('') + '</select><span class="muted small">' + list.length + ' jadwal</span></div>' +
        (list.length ? '<div class="tbl-wrap only-d" style="max-height:72vh;overflow:auto"><div class="wk"><div class="hcell" style="left:0;z-index:3"></div>' + HARI7.map(function (h) { return '<div class="hcell ' + (h === T.nowWib().hari ? 'today' : '') + '">' + h + '</div>'; }).join('') +
          '<div class="tcol">' + Array.from({ length: jamMax - jamMin }, function (_, i) { return '<div>' + T.pad(jamMin + i) + ':00</div>'; }).join('') + '</div>' +
          HARI7.map(function (h) {
            return '<div class="dcol" style="height:' + (jamMax - jamMin) * ROW + 'px">' + list.filter(function (j) { return j.hari === h; }).map(function (j) {
              const top = (T.menit(j.mulai) / 60 - jamMin) * ROW, hgt = Math.max(30, (T.menit(j.selesai) - T.menit(j.mulai)) / 60 * ROW - 3);
              const k = mode === 'guru' ? j.id_tkb : j.id_pengguna;
              const nl = lajur[j.id + '#n'] || 1, li = lajur[j.id] || 0;
              return '<div class="blk blk-' + warna[k] + (j.aktif ? '' : ' blk-off') + '" data-j="' + esc(j.id) + '" style="top:' + top + 'px;height:' + hgt + 'px;left:calc(' + (li * 100 / nl) + '% + 3px);right:auto;width:calc(' + (100 / nl) + '% - 6px)" title="' + esc(j.mapel) + (j.minggu_ke ? ' · minggu ke-' + esc(j.minggu_ke) : '') + '"><b class="ellipsis">' + (j.minggu_ke ? '[' + esc(j.minggu_ke) + '] ' : '') + esc(j.mapel) + (j.kelas ? ' · ' + esc(j.kelas) : '') + '</b><div class="ellipsis">' + esc(mode === 'guru' ? j.tkb : (nama[j.id_pengguna] || j.id_pengguna)) + '</div><div class="mono">' + j.mulai + '–' + j.selesai + '</div></div>';
            }).join('') + '</div>';
          }).join('') + '</div></div>' +
          '<div class="only-m"><div class="days">' + HARI7.map(function (h) { const n = list.filter(function (j) { return j.hari === h; }).length; return '<button class="day ' + (h === hariM ? 'on' : '') + '" data-h="' + h + '"><small>' + h.slice(0, 3) + '</small><b>' + n + '</b><i>sesi</i></button>'; }).join('') + '</div>' +
          '<div class="col gap-12 mt-12">' + (list.filter(function (j) { return j.hari === hariM; }).sort(function (a, b) { return T.menit(a.mulai) - T.menit(b.mulai); }).map(function (j) {
            return '<div class="mcard" data-j="' + esc(j.id) + '"><div class="grow"><div class="row-b"><span class="mono small" style="color:var(--p)">' + j.mulai + ' – ' + j.selesai + '</span>' + (j.minggu_ke ? '<span class="chip chip-teal chip-sm">Minggu ke-' + esc(j.minggu_ke) + '</span>' : '') + (j.aktif ? '' : '<span class="chip chip-slate chip-sm">nonaktif</span>') + '</div><b style="font-family:var(--f-head)">' + esc(j.mapel) + (j.kelas ? ' · ' + esc(j.kelas) : '') + '</b><div class="small muted">' + esc(nama[j.id_pengguna] || '') + ' · ' + esc(j.tkb) + '</div></div></div>';
          }).join('') || '<div class="card card-pad muted small center">Tidak ada jadwal di hari ' + hariM + '.</div>') + '</div></div>'
          : '<div class="panel"><div class="empty"><div class="itile">' + ic('calendar', 26) + '</div><b>Belum ada jadwal</b>Tambahkan jadwal mengajar agar status tepat waktu/terlambat/alpa terhitung otomatis.</div></div>');
      T.on($('#jBody'), 'click', '[data-m]', function (e, b) { mode = b.getAttribute('data-m'); pilih = ''; gambar(); });
      $('#jSel').onchange = function () { pilih = this.value; gambar(); };
      $('#jMk').onchange = function () { mkF = this.value; gambar(); };
      T.on($('#jBody'), 'click', '[data-h]', function (e, b) { hariM = b.getAttribute('data-h'); gambar(); });
    };
    master(function (m, info) { if (!m) { $('#jBody').innerHTML = errBox(info.error); return; } M = m; gambar(); });
    T.on(el, 'click', '[data-j]', function (e, b) { form(M.jadwal.filter(function (j) { return j.id === b.getAttribute('data-j'); })[0]); });
    $('#btnAdd').onclick = function () { form(mode === 'guru' ? { id_pengguna: pilih } : { id_tkb: pilih }); };
    $('#btnCetakJdw').onclick = function () {
      if (!M) return;
      const now = T.nowWib().tgl, y = +now.slice(0, 4), tp = +now.slice(5, 7) >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
      T.modal({ title: 'Cetak Jadwal Pelajaran per TKB', sub: 'Format: Minggu Ke · Jam Ke · Kelas X/XI/XII · Kode Guru', body:
        '<div class="field"><label class="label" for="cjT">TKB</label><select class="select" id="cjT">' + opsiTkb(M.tkb.filter(function (t) { return t.status === 'aktif'; }), mode === 'tkb' ? pilih : '', '') + '</select></div>' +
        '<div class="field"><label class="label" for="cjP">Tahun pelajaran</label><input class="input mono" id="cjP" value="' + tp + '" placeholder="2026-2027"></div>' +
        '<div class="note note-p mt-12">' + ic('info', 18) + '<div>Isi kolom <b>Kelas</b> jadwal dengan X / XI / XII (boleh beberapa, dipisah koma) dan pilih <b>Minggu ke</b> agar tabel tersusun seperti template SMATER. Kop & tanda tangan diatur di Pengaturan → Kop & Penandatangan.</div></div>',
        actions: [{ label: 'Batal' }, { label: ic('download', 17) + ' Unduh PDF', cls: 'btn-primary', onClick: async function (close, root, b) { await App.unduhPdf('jadwal.pdf', { id_tkb: $('#cjT', root).value, tahun_pelajaran: $('#cjP', root).value.trim() }, b); } }] });
    };
    function form(j) {
      j = j || {};
      if (!M) return;
      const mkSel = String(j.minggu_ke || '').split(',').filter(Boolean);
      T.modal({ title: j.id ? 'Ubah Jadwal' : 'Tambah Jadwal', body:
        '<div class="field"><label class="label" for="jG">Guru <span class="req">*</span></label><select class="select" id="jG">' + opsiGuru(guruAbsen(M), j.id_pengguna, '— Pilih guru —') + '</select></div>' +
        '<div class="field"><label class="label" for="jT">TKB <span class="req">*</span></label><select class="select" id="jT">' + opsiTkb(M.tkb.filter(function (t) { return t.status === 'aktif' || t.id === j.id_tkb; }), j.id_tkb, '— Pilih TKB —') + '</select></div>' +
        '<div class="field"><label class="label" for="jH">Hari</label><select class="select" id="jH">' + HARI7.map(function (h) { return '<option' + (h === (j.hari || 'Senin') ? ' selected' : '') + '>' + h + '</option>'; }).join('') + '</select></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="jM">Jam mulai</label><input class="input mono" type="time" id="jM" value="' + (j.mulai || '08:00') + '"></div><div class="field"><label class="label" for="jS">Jam selesai</label><input class="input mono" type="time" id="jS" value="' + (j.selesai || '10:00') + '"></div></div>' +
        '<div class="field mt-16"><label class="label" for="jMp">Mata pelajaran <span class="req">*</span></label><input class="input" id="jMp" value="' + esc(j.mapel || (M.guru.filter(function (g) { return g.id === j.id_pengguna; })[0] || {}).mapel || '') + '"></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="jK">Kelas</label><input class="input" id="jK" value="' + esc(j.kelas || '') + '" placeholder="X-A"></div><div class="field"><label class="label" for="jR">Ruang</label><input class="input" id="jR" value="' + esc(j.ruang || '') + '" placeholder="Ruang 02"></div></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="jB1">Berlaku mulai</label><input class="input" type="date" id="jB1" value="' + esc(j.berlaku_mulai || '') + '"></div><div class="field"><label class="label" for="jB2">Berlaku sampai</label><input class="input" type="date" id="jB2" value="' + esc(j.berlaku_sampai || '') + '"></div></div><div class="help mt-8">Kosongkan bila berlaku terus. Isi untuk jadwal per semester.</div>' +
        '<div class="field mt-16"><label class="label">Minggu ke (jadwal bergilir)</label><div class="mk-chips" id="jMkSel">' + ['I', 'II', 'III', 'IV', 'V'].map(function (x) { return '<label><input type="checkbox" value="' + x + '"' + (mkSel.indexOf(x) >= 0 ? ' checked' : '') + '> ' + x + '</label>'; }).join('') + '</div><div class="help">Kosongkan bila berlaku <b>setiap minggu</b>. Contoh SMATER: guru mengajar hanya hari Minggu ke-I dan ke-III setiap bulan.</div></div>' +
        '<label class="check mt-12"><input type="checkbox" id="jAk" ' + (j.aktif === false ? '' : 'checked') + '> Jadwal aktif</label>',
        actions: (j.id ? [{ label: ic('trash', 17) + ' Hapus', cls: 'btn-danger-soft', onClick: async function () { if (!await T.confirm({ title: 'Hapus jadwal ini?', ok: 'Hapus', danger: true })) return false; const r = await T.api('jadwal.hapus', { id: j.id }); if (!r.success) { T.toast(r.message, 'err'); return false; } T.toast(r.message, 'ok'); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true); } }] : []).concat([{ label: 'Batal' }, { label: 'Simpan', cls: 'btn-primary', onClick: async function (close, root) {
          const d = { id: j.id || '', id_pengguna: $('#jG', root).value, id_tkb: $('#jT', root).value, hari: $('#jH', root).value, mulai: $('#jM', root).value, selesai: $('#jS', root).value, mapel: $('#jMp', root).value, kelas: $('#jK', root).value, ruang: $('#jR', root).value, berlaku_mulai: $('#jB1', root).value, berlaku_sampai: $('#jB2', root).value, aktif: $('#jAk', root).checked, minggu_ke: T.$$('#jMkSel input:checked', root).map(function (x) { return x.value; }) };
          const r = await T.api('jadwal.simpan', d);
          if (!r.success) { T.toast(r.message, 'err'); return false; }
          T.toast(r.message, 'ok'); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true);
        } }]) });
    }
  } });

  // ------------------------------------------------------------------------
  //  AGENDA
  // ------------------------------------------------------------------------
  App.reg('a/agenda', { shell: 'admin', admin: true, title: 'Agenda', render: function (el) {
    badgeLoad();
    let M = null, bulan = T.nowWib().tgl.slice(0, 7);
    el.innerHTML = head('Agenda Kegiatan', 'Rapat, kegiatan, dan tenggat yang tampil di dashboard guru.', '<button class="btn btn-primary" id="btnAdd">' + ic('plus', 19) + ' Tambah Agenda</button>') + '<div id="agBody"><div class="skel" style="height:300px"></div></div>';
    const gambar = function () { if (!el.isConnected) return;
      const now = T.nowWib().tgl, list = M.agenda.slice().sort(function (a, b) { return a.mulai < b.mulai ? -1 : 1; });
      const awal = T.parseTgl(bulan + '-01'), mulaiCol = (awal.getUTCDay() + 6) % 7, nHari = T.parseTgl(T.akhirBulan(bulan)).getUTCDate();
      let cal = '<div class="row-b"><button class="icon-btn" id="cPrev" aria-label="Bulan sebelumnya">' + ic('chevronLeft', 20) + '</button><b style="font:700 16px var(--f-head)">' + T.bulanLabel(bulan) + '</b><button class="icon-btn" id="cNext" aria-label="Bulan berikutnya">' + ic('chevronRight', 20) + '</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px;text-align:center" class="xs muted">' + ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(function (h) { return '<div style="padding:6px 0;font-weight:600">' + h + '</div>'; }).join('');
      for (let i = 0; i < mulaiCol; i++) cal += '<div></div>';
      for (let dd = 1; dd <= nHari; dd++) {
        const t = bulan + '-' + T.pad(dd), ada = list.filter(function (g) { return g.mulai <= t && g.selesai >= t; });
        cal += '<div style="aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;' + (t === now ? 'background:var(--p);color:#fff;font-weight:700' : ada.length ? 'background:var(--p-50);color:var(--p-600);font-weight:600' : 'color:var(--tx-2)') + '" title="' + esc(ada.map(function (g) { return g.judul; }).join(', ')) + '"><span class="mono" style="font-size:13px">' + dd + '</span>' + (ada.length ? '<span style="width:5px;height:5px;border-radius:50%;background:' + (t === now ? '#fff' : 'var(--p)') + '"></span>' : '') + '</div>';
      }
      cal += '</div>';
      const mendatang = list.filter(function (g) { return g.selesai >= now; }), lalu = list.filter(function (g) { return g.selesai < now; }).reverse();
      const row = function (g) { return '<button class="li" data-ag="' + esc(g.id) + '"><span class="dblock ' + (g.selesai < now ? 'past' : '') + '"><b>' + T.pad(T.parseTgl(g.mulai).getUTCDate()) + '</b><span>' + T.BLN3[T.parseTgl(g.mulai).getUTCMonth()] + '</span></span><div class="grow" style="min-width:0"><div class="t ellipsis">' + esc(g.judul) + '</div><div class="s">' + esc(g.kategori) + (g.jam_mulai ? ' · ' + esc(g.jam_mulai) : '') + ' · ' + (g.sasaran === 'semua' ? 'Semua guru' : g.sasaran.split(',').length + ' guru') + (g.lokasi ? ' · ' + esc(g.lokasi) : '') + '</div></div><span class="chev">' + ic('chevronRight', 18) + '</span></button>'; };
      $('#agBody').innerHTML = '<div class="gcols c21" style="grid-template-columns:none"><div class="gcols c12" style="gap:16px"><div class="panel"><div class="panel-bd" style="padding-top:18px">' + cal + '</div></div>' +
        '<div><div class="sec-title" style="margin-top:0"><h3>Mendatang &amp; Berlangsung</h3><span class="chip chip-p chip-sm">' + mendatang.length + '</span></div>' + (mendatang.length ? '<div class="list">' + mendatang.map(row).join('') + '</div>' : '<div class="card card-pad muted small center">Belum ada agenda mendatang.</div>') +
        (lalu.length ? '<div class="sec-title"><h3>Selesai</h3><span class="chip chip-slate chip-sm">' + lalu.length + '</span></div><div class="list">' + lalu.slice(0, 20).map(row).join('') + '</div>' : '') + '</div></div></div>';
      $('#cPrev').onclick = function () { bulan = T.addMonths(bulan, -1); gambar(); }; $('#cNext').onclick = function () { bulan = T.addMonths(bulan, 1); gambar(); };
    };
    master(function (m, info) { if (!m) { $('#agBody').innerHTML = errBox(info.error); return; } M = m; gambar(); });
    T.on(el, 'click', '[data-ag]', function (e, b) { form(M.agenda.filter(function (g) { return g.id === b.getAttribute('data-ag'); })[0]); });
    $('#btnAdd').onclick = function () { form(null); };
    function form(g) {
      g = g || { kategori: 'Umum', sasaran: 'semua' };
      const pilihSas = g.sasaran && g.sasaran !== 'semua' ? g.sasaran.split(',') : [];
      const KAT = ['Umum', 'Wajib Hadir', 'Rapat', 'Pengembangan Diri', 'Ujian / Evaluasi', 'Batas Akhir', 'Libur'];
      T.modal({ title: g.id ? 'Ubah Agenda' : 'Tambah Agenda', wide: true, body:
        '<div class="field"><label class="label" for="aJ">Judul <span class="req">*</span></label><input class="input" id="aJ" value="' + esc(g.judul || '') + '" placeholder="Rapat Koordinasi Bulanan Pamong"></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="aK">Kategori</label><select class="select" id="aK">' + KAT.map(function (k) { return '<option' + (k === g.kategori ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div><div class="field"><label class="label" for="aT">TKB (opsional)</label><select class="select" id="aT">' + opsiTkb(M.tkb, g.id_tkb, '— Tidak terkait TKB —') + '</select></div></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="aM">Tanggal mulai</label><input class="input" type="date" id="aM" value="' + (g.mulai || T.nowWib().tgl) + '"></div><div class="field"><label class="label" for="aS">Tanggal selesai</label><input class="input" type="date" id="aS" value="' + (g.selesai || g.mulai || T.nowWib().tgl) + '"></div></div>' +
        '<div class="grid2 mt-16"><div class="field"><label class="label" for="aJ1">Jam mulai</label><input class="input mono" type="time" id="aJ1" value="' + esc(g.jam_mulai || '') + '"></div><div class="field"><label class="label" for="aJ2">Jam selesai</label><input class="input mono" type="time" id="aJ2" value="' + esc(g.jam_selesai || '') + '"></div></div>' +
        '<div class="field mt-16"><label class="label" for="aL">Lokasi</label><input class="input" id="aL" value="' + esc(g.lokasi || '') + '" placeholder="SMA PGRI Induk — Ruang Rapat Lt. 2 / Google Meet"></div>' +
        '<div class="field"><label class="label" for="aD">Deskripsi</label><textarea class="textarea" id="aD">' + esc(g.deskripsi || '') + '</textarea></div>' +
        '<div class="field"><label class="label">Sasaran</label><div class="seg" id="aSas"><button type="button" data-s="semua" class="' + (pilihSas.length ? '' : 'on') + '">Semua Guru</button><button type="button" data-s="pilih" class="' + (pilihSas.length ? 'on' : '') + '">Pilih Guru</button></div>' +
        '<div id="aSasList" class="card card-pad mt-8" style="max-height:200px;overflow:auto;box-shadow:none;' + (pilihSas.length ? '' : 'display:none') + '">' + guruAbsen(M).map(function (x) { return '<label class="check" style="display:flex"><input type="checkbox" value="' + esc(x.id) + '" ' + (pilihSas.indexOf(x.id) >= 0 ? 'checked' : '') + '> ' + esc(x.nama) + '</label>'; }).join('') + '</div></div>',
        actions: (g.id ? [{ label: ic('trash', 17) + ' Hapus', cls: 'btn-danger-soft', onClick: async function () { if (!await T.confirm({ title: 'Hapus agenda ini?', ok: 'Hapus', danger: true })) return false; const r = await T.api('agenda.hapus', { id: g.id }); if (!r.success) { T.toast(r.message, 'err'); return false; } T.toast(r.message, 'ok'); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true); } }] : []).concat([{ label: 'Batal' }, { label: 'Simpan Agenda', cls: 'btn-primary', onClick: async function (close, root) {
          const semua = $('#aSas .on', root).getAttribute('data-s') === 'semua';
          const d = { id: g.id || '', judul: $('#aJ', root).value, kategori: $('#aK', root).value, id_tkb: $('#aT', root).value, mulai: $('#aM', root).value, selesai: $('#aS', root).value, jam_mulai: $('#aJ1', root).value, jam_selesai: $('#aJ2', root).value, lokasi: $('#aL', root).value, deskripsi: $('#aD', root).value,
            sasaran: semua ? [] : T.$$('#aSasList input:checked', root).map(function (x) { return x.value; }) };
          if (!semua && !d.sasaran.length) { T.toast('Pilih minimal satu guru.', 'warn'); return false; }
          const r = await T.api('agenda.simpan', d);
          if (!r.success) { T.toast(r.message, 'err'); return false; }
          T.toast(r.message, 'ok'); afterWrite(); master(function (m) { if (m) { M = m; gambar(); } }, true);
        } }]) });
      T.on($('#aSas'), 'click', '[data-s]', function (e, b) { T.$$('#aSas button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#aSasList').style.display = b.getAttribute('data-s') === 'pilih' ? '' : 'none'; });
    }
  } });
})();
