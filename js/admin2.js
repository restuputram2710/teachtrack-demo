/* ==========================================================================
   TeachTrack — admin2.js
   Laporan & Honorarium (rentang bebas, filter hari/guru/TKB, grafik, PDF)
   dan Pengaturan Sistem (identitas, aturan, penandatangan, login Google,
   impor data dari app lama, status sistem & log audit).
   ========================================================================== */
(function () {
  'use strict';
  const T = TT, esc = T.esc, $ = T.$;
  const head = function () { return App.adminHead.apply(null, arguments); };

  // ------------------------------------------------------------------------
  //  LAPORAN
  // ------------------------------------------------------------------------
  function preset(k) {
    const now = T.nowWib().tgl, ym = now.slice(0, 7), y = now.slice(0, 4);
    switch (k) {
      case 'bulan': return [ym + '-01', now];
      case 'lalu': { const p = T.addMonths(ym, -1); return [p + '-01', T.akhirBulan(p)]; }
      case '3bulan': { const p = T.addMonths(ym, -2); return [p + '-01', now]; }
      case 'tw1': return [y + '-01-01', y + '-03-31']; case 'tw2': return [y + '-04-01', y + '-06-30'];
      case 'tw3': return [y + '-07-01', y + '-09-30']; case 'tw4': return [y + '-10-01', y + '-12-31'];
    }
    return null;
  }
  App.reg('a/laporan', { shell: 'admin', admin: true, title: 'Laporan & Honor', render: function (el) {
    App.badgeLoad();
    const f = T.LS.get('lapf', null) || { preset: 'bulan', dari: '', sampai: '', hari: [], id_pengguna: '', id_tkb: '' };
    if (f.preset !== 'kustom') { const p = preset(f.preset); f.dari = p[0]; f.sampai = p[1]; }
    let R = null, tab = 'rekap', sortK = 'nama', sortD = 1, q = '';
    const HARI7 = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    el.innerHTML = head('Laporan Absensi & Honorarium', 'Rentang tanggal bebas (per bulan, triwulan, atau kustom) dengan filter hari, guru, dan TKB.') +
      '<div class="panel"><div class="panel-bd" style="padding-top:18px">' +
      '<div class="pills" id="lpPreset">' + [['bulan', 'Bulan Ini'], ['lalu', 'Bulan Lalu'], ['3bulan', '3 Bulan Terakhir'], ['tw1', 'Triwulan I'], ['tw2', 'Triwulan II'], ['tw3', 'Triwulan III'], ['tw4', 'Triwulan IV'], ['kustom', 'Kustom']].map(function (p) { return '<button class="pill ' + (f.preset === p[0] ? 'on' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar mt-16" style="margin-bottom:0"><label class="small muted">Dari</label><input class="input" type="date" id="lpDari" value="' + f.dari + '" style="width:auto"><label class="small muted">s.d.</label><input class="input" type="date" id="lpSampai" value="' + f.sampai + '" style="width:auto">' +
      '<select class="select" id="lpGuru"><option value="">Semua Guru</option></select><select class="select" id="lpTkb"><option value="">Semua TKB</option></select></div>' +
      '<div class="row wrap mt-12"><span class="small muted" style="margin-right:4px">Filter hari:</span><div class="pills" id="lpHari" style="flex-wrap:wrap">' + HARI7.map(function (h) { return '<button class="pill ' + (f.hari.indexOf(h) >= 0 ? 'on' : '') + '" data-h="' + h + '" style="height:32px">' + h.slice(0, 3) + '</button>'; }).join('') + '</div><span class="xs muted">' + (f.hari.length ? '' : '(semua hari)') + '</span>' +
      '<span class="grow"></span><button class="btn btn-primary" id="lpGo">' + ic('filter', 18) + ' Tampilkan</button></div></div></div><div id="lpBody" class="mt-16"></div>';
    App.master(function (m) { if (!m) return; $('#lpGuru').innerHTML = App.opsiGuru(App.guruAbsen(m), f.id_pengguna, 'Semua Guru'); $('#lpTkb').innerHTML = App.opsiTkb(m.tkb, f.id_tkb, 'Semua TKB'); });
    T.on($('#lpPreset'), 'click', '[data-p]', function (e, b) {
      f.preset = b.getAttribute('data-p'); T.$$('#lpPreset .pill').forEach(function (x) { x.classList.toggle('on', x === b); });
      const p = preset(f.preset); if (p) { $('#lpDari').value = p[0]; $('#lpSampai').value = p[1]; }
    });
    ['lpDari', 'lpSampai'].forEach(function (id) { $('#' + id).onchange = function () { f.preset = 'kustom'; T.$$('#lpPreset .pill').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-p') === 'kustom'); }); }; });
    T.on($('#lpHari'), 'click', '[data-h]', function (e, b) { b.classList.toggle('on'); });
    $('#lpGo').onclick = function () { muat(this); };

    function params() {
      f.dari = $('#lpDari').value; f.sampai = $('#lpSampai').value; f.id_pengguna = $('#lpGuru').value; f.id_tkb = $('#lpTkb').value;
      f.hari = T.$$('#lpHari .pill.on').map(function (x) { return x.getAttribute('data-h'); });
      T.LS.set('lapf', f);
      return { dari: f.dari, sampai: f.sampai, hari: f.hari.length === 7 ? [] : f.hari, id_pengguna: f.id_pengguna, id_tkb: f.id_tkb };
    }
    async function muat(btn) { if (!el.isConnected) return;
      const d = params();
      if (!d.dari || !d.sampai || d.sampai < d.dari) return T.toast('Rentang tanggal tidak valid.', 'warn');
      $('#lpBody').innerHTML = '<div class="kpis k5">' + '<div class="skel" style="height:110px"></div>'.repeat(5) + '</div><div class="skel mt-16" style="height:280px"></div>';
      const r = await T.withBtn(btn, function () { return T.load('laporan.rekap', d, function () { }, { maxAge: 20000 }); });
      if (!r.success) { $('#lpBody').innerHTML = App.adminErr(r); return; }
      R = r.data; gambar();
    }
    function gambar() { if (!el.isConnected) return;
      const t = R.total;
      const per = T.tglIndo(R.dari) + ' – ' + T.tglIndo(R.sampai) + (R.hari.length ? ' · ' + R.hari.join(', ') : '') + (R.filter.tkb ? ' · ' + R.filter.tkb : '') + (R.filter.guru ? ' · ' + R.filter.guru : '');
      $('#lpBody').innerHTML = '<div class="row-b wrap" style="margin-bottom:12px"><div class="small"><span class="muted">Periode:</span> <b>' + esc(per) + '</b>' + (R.efektifSampai < R.sampai ? ' <span class="chip chip-slate chip-sm">dihitung s.d. ' + T.tglIndo(R.efektifSampai, { pendek: true }) + '</span>' : '') + '</div><span class="small muted">Tarif: <b class="mono">' + T.rupiah(R.tarif) + '</b> / kehadiran</span></div>' +
        '<div class="kpis k5">' + App.kpi('Total Kehadiran', t.hadir, 'userCheck', 't-green', '<div class="f">' + t.tepat + ' tepat · ' + t.terlambat + ' terlambat · ' + t.luar + ' luar jadwal</div>') +
        App.kpi('Terlambat', '<span style="color:var(--warn)">' + t.terlambat + '</span>', 'clock', 't-amber', '<div class="f">Tetap dihitung honor</div>') +
        App.kpi('Izin / Sakit', t.izin + t.sakit, 'fileCheck', 't-slate', '<div class="f">' + t.izin + ' izin · ' + t.sakit + ' sakit</div>') +
        App.kpi('Alpa', '<span style="color:' + (t.alpa ? 'var(--err)' : 'inherit') + '">' + t.alpa + '</span>', 'xCircle', 't-red', '<div class="f">Hari berjadwal tanpa absen/izin</div>') +
        App.kpi('Total Honorarium', '<span style="font-size:22px">' + T.rupiah(t.honor) + '</span>', 'wallet', 't-teal', '<div class="f">' + t.terverifikasi + ' kehadiran terverifikasi · ' + t.guru + ' guru</div>') + '</div>' +
        '<div class="gcols c2 mt-16"><div class="panel"><div class="panel-hd"><h3>Kehadiran per Bulan</h3></div><div class="panel-bd"><div class="legend" style="margin-bottom:8px"><span><i style="background:var(--p)"></i>Hadir</span><span><i style="background:#F59E0B"></i>Terlambat</span><span><i style="background:#94A3B8"></i>Izin/Sakit</span><span><i style="background:#EF4444"></i>Alpa</span></div><div class="chart" id="cBln"></div></div></div>' +
        '<div class="panel"><div class="panel-hd"><h3>Perbandingan per TKB</h3></div><div class="panel-bd"><div class="legend" style="margin-bottom:8px"><span><i style="background:#0D9488"></i>Hadir</span><span><i style="background:#F59E0B"></i>Terlambat</span></div><div class="chart" id="cTkb"></div></div></div>' +
        '<div class="panel"><div class="panel-hd"><h3>Komposisi Status</h3></div><div class="panel-bd" id="cKomp"></div></div>' +
        '<div class="panel"><div class="panel-hd"><h3>Guru Terlambat Terbanyak</h3></div><div class="panel-bd" id="cTop"></div></div></div>' +
        '<div class="panel mt-16"><div class="panel-hd" style="align-items:center"><div class="tabs" style="border:0" id="lpTabs"><button data-t="rekap" class="' + (tab === 'rekap' ? 'on' : '') + '">Rekap per Guru</button><button data-t="honor" class="' + (tab === 'honor' ? 'on' : '') + '">Honorarium</button><button data-t="rinci" class="' + (tab === 'rinci' ? 'on' : '') + '">Rincian Harian</button></div>' +
        '<div class="ifield" style="min-width:220px">' + ic('search', 18) + '<input class="input input-sm" id="lpQ" placeholder="Cari nama…" value="' + esc(q) + '"></div></div><div id="lpTbl" style="padding:0 18px 18px"></div></div>' +
        '<div class="card card-pad mt-16 row wrap lp-bar"><label class="check small"><input type="checkbox" id="lpRinci"> Sertakan lampiran rincian harian</label><span class="grow"></span>' +
        '<button class="btn btn-outline" id="lpCsv">' + ic('download', 18) + ' CSV</button><button class="btn btn-outline" id="lpJurnal">' + ic('book', 18) + ' Jurnal Guru (PDF)</button><button class="btn btn-tonal" id="lpPdfR">' + ic('fileText', 18) + ' Cetak Rekap (PDF)</button><button class="btn btn-primary" id="lpPdfH">' + ic('wallet', 18) + ' Cetak Honorarium (PDF)</button></div>';
      const pb = R.perBulan;
      Charts.bars($('#cBln'), { labels: pb.map(function (x) { return T.BLN3[+x.bulan.slice(5) - 1] + ' ' + x.bulan.slice(2, 4); }), tipLabels: pb.map(function (x) { return T.bulanLabel(x.bulan); }), stacked: true,
        series: [{ name: 'Hadir tepat/luar', color: 'var(--p)', values: pb.map(function (x) { return x.hadir - x.terlambat; }) }, { name: 'Terlambat', color: '#F59E0B', values: pb.map(function (x) { return x.terlambat; }) }, { name: 'Izin/Sakit', color: '#94A3B8', values: pb.map(function (x) { return x.izin + x.sakit; }) }, { name: 'Alpa', color: '#EF4444', values: pb.map(function (x) { return x.alpa; }) }] });
      Charts.bars($('#cTkb'), { labels: R.perTkb.map(function (x) { return x.tkb.replace(/^TKB\s+/i, ''); }), tipLabels: R.perTkb.map(function (x) { return x.tkb; }), series: [{ name: 'Hadir', color: '#0D9488', values: R.perTkb.map(function (x) { return x.hadir; }) }, { name: 'Terlambat', color: '#F59E0B', values: R.perTkb.map(function (x) { return x.terlambat; }) }] });
      const k = R.komposisi;
      Charts.donut($('#cKomp'), { center: t.hadir, sub: 'KEHADIRAN', sub2: 'dari ' + (t.hadir + t.izin + t.sakit + t.alpa) + ' hari tercatat', items: [{ label: 'Tepat Waktu', value: k.tepat, color: Charts.C.p }, { label: 'Terlambat', value: k.terlambat, color: Charts.C.warn }, { label: 'Di Luar Jadwal', value: k.luar, color: Charts.C.violet }, { label: 'Izin', value: k.izin, color: '#64748B' }, { label: 'Sakit', value: k.sakit, color: '#CBD5E1' }, { label: 'Alpa', value: k.alpa, color: Charts.C.err }] });
      Charts.hbars($('#cTop'), { items: R.topTerlambat.map(function (x) { return { label: x.nama, value: x.kali, sub: x.kali + '× · ' + x.menit + ' mnt' }; }), color: '#F59E0B', kosong: ' — tidak ada keterlambatan pada periode ini.' });
      T.on($('#lpTabs'), 'click', '[data-t]', function (e, b) { tab = b.getAttribute('data-t'); T.$$('#lpTabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); tabel(); });
      $('#lpQ').oninput = T.debounce(function () { q = this.value.toLowerCase(); tabel(); }, 150);
      $('#lpPdfR').onclick = function () { pdf('rekap', this); }; $('#lpPdfH').onclick = function () { pdf('honor', this); };
      $('#lpCsv').onclick = csv;
      $('#lpJurnal').onclick = jurnalGuru;
      tabel();
    }
    function tabel() { if (!el.isConnected) return;
      const box = $('#lpTbl'); const cari = function (n) { return !q || String(n).toLowerCase().indexOf(q) >= 0; };
      if (tab === 'rinci') {
        const rows = R.rincian.filter(function (x) { return cari(x.nama); }).slice(0, 1500);
        box.innerHTML = rows.length ? '<div class="tbl-wrap" style="max-height:520px;overflow:auto;box-shadow:none"><table class="tbl"><thead><tr><th>Tanggal</th><th>Hari</th><th>Guru</th><th>Status</th><th>TKB</th><th>Jam</th><th>Keterangan</th></tr></thead><tbody>' +
          rows.map(function (x) { return '<tr><td class="mono">' + esc(x.tanggal) + '</td><td>' + esc(x.hari) + '</td><td>' + esc(x.nama) + '</td><td>' + T.chipStatus(x.kode) + '</td><td>' + esc(x.tkb) + '</td><td class="mono">' + esc(x.jam) + '</td><td class="small">' + esc(x.ket) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (R.rincian.length > 1500 ? '<div class="xs muted mt-8">Menampilkan 1.500 baris pertama. Unduh CSV untuk data lengkap.</div>' : '')
          : '<div class="empty small"><b>Tidak ada rincian</b></div>';
        return;
      }
      const cols = tab === 'rekap'
        ? [['nama', 'Nama Guru'], ['nip', 'NIP'], ['hariJadwal', 'Hari Jadwal', 'c'], ['hadir', 'Hadir', 'c'], ['tepat', 'Tepat', 'c'], ['terlambat', 'Terlambat', 'c'], ['luar', 'Luar Jdwl', 'c'], ['izin', 'Izin', 'c'], ['sakit', 'Sakit', 'c'], ['alpa', 'Alpa', 'c'], ['persen', '% Hadir', 'c']]
        : [['nama', 'Nama Guru'], ['nip', 'NIP/NUPTK'], ['hadir', 'Hadir', 'c'], ['terverifikasi', 'Kehadiran Terverifikasi', 'c'], ['tarif', 'Tarif', 'n'], ['honor', 'Jumlah Diterima', 'n']];
      const rows = R.rows.filter(function (x) { return cari(x.nama + ' ' + x.nip); }).map(function (x) { return Object.assign({ tarif: R.tarif }, x); })
        .sort(function (a, b) { const va = a[sortK], vb = b[sortK]; return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sortD; });
      const tot = rows.reduce(function (a, x) { cols.forEach(function (c) { if (typeof x[c[0]] === 'number' && c[0] !== 'persen' && c[0] !== 'tarif') a[c[0]] = (a[c[0]] || 0) + x[c[0]]; }); return a; }, {});
      const fmt = function (k, v) { if (k === 'honor' || k === 'tarif') return T.rupiah(v); if (k === 'persen') return v === null ? '–' : v + '%'; if (k === 'nip') return '<span class="mono">' + esc(v) + '</span>'; if (k === 'nama') return '<b>' + esc(v) + '</b>'; if (k === 'alpa' && v) return '<span style="color:var(--err-tx);font-weight:700">' + v + '</span>'; if (k === 'terlambat' && v) return '<span style="color:var(--warn-tx);font-weight:700">' + v + '</span>'; return esc(v); };
      box.innerHTML = rows.length ? '<div class="tbl-wrap" style="box-shadow:none;max-height:560px;overflow:auto"><table class="tbl"><thead><tr><th>No</th>' + cols.map(function (c) { return '<th class="sort ' + (c[2] || '') + '" data-k="' + c[0] + '">' + c[1] + (sortK === c[0] ? (sortD > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (x, i) { return '<tr><td class="mono muted">' + (i + 1) + '</td>' + cols.map(function (c) { return '<td class="' + (c[2] || '') + '">' + fmt(c[0], x[c[0]]) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody><tfoot><tr><td></td>' + cols.map(function (c, i) { return '<td class="' + (c[2] || '') + '">' + (i === 0 ? 'JUMLAH' : tot[c[0]] !== undefined ? fmt(c[0], tot[c[0]]) : '') + '</td>'; }).join('') + '</tr></tfoot></table></div>' +
        (tab === 'honor' ? '<div class="note note-p mt-12">' + ic('info', 18) + '<div><b>Terbilang:</b> <i>' + esc(R.terbilangTotal) + '</i>. Honor = kehadiran terverifikasi × tarif. Absen di luar jadwal dihitung setelah diverifikasi di Data Absensi.</div></div>' : '')
        : '<div class="empty small"><b>Tidak ada data</b></div>';
      T.on(box, 'click', '[data-k]', function (e, b) { const k = b.getAttribute('data-k'); if (sortK === k) sortD = -sortD; else { sortK = k; sortD = typeof R.rows[0][k] === 'number' ? -1 : 1; } tabel(); });
    }
    async function pdf(jenis, btn) {
      const d = Object.assign(params(), { jenis: jenis, rincian: $('#lpRinci').checked });
      T.toast('Menyusun PDF… mohon tunggu beberapa detik.', 'info');
      const r = await T.withBtn(btn, function () { return T.api('laporan.pdf', d); });
      if (!r.success) return T.toast(r.message, 'err');
      T.downloadDataUrl(r.data.dataUrl, r.data.nama);
      T.toast(r.message, 'ok', 5000);
      if (r.data.url) T.modal({ title: 'PDF siap', body: '<p class="small">Berkas <b class="mono">' + esc(r.data.nama) + '</b> sudah diunduh dan tersimpan di Google Drive (folder Laporan PDF).</p>' + (r.data.info && r.data.info.total !== undefined ? '<div class="kv mt-12"><div><small>Jumlah guru</small><b>' + r.data.info.jumlah + '</b></div><div><small>Total honor</small><b>' + T.rupiah(r.data.info.total) + '</b></div></div>' : ''), actions: [{ label: 'Tutup' }, { label: ic('link', 17) + ' Buka di Drive', cls: 'btn-primary', onClick: function () { window.open(r.data.url, '_blank', 'noopener'); } }] });
    }
    function jurnalGuru() {
      App.master(function (m) {
        if (!m || $('.mod-root')) return;
        const b1 = (f.dari || T.nowWib().tgl).slice(0, 7), b2 = (f.sampai || T.nowWib().tgl).slice(0, 7);
        T.modal({ title: 'Cetak Jurnal Mengajar Guru', sub: 'Laporan Bukti Kinerja & Dokumentasi Guru Pamong (per akhir pekan Sabtu–Minggu)', body:
          '<div class="field"><label class="label" for="jgG">Guru pamong</label><select class="select" id="jgG">' + App.opsiGuru(App.guruAbsen(m), f.id_pengguna, '— Pilih guru —') + '</select></div>' +
          '<div class="field"><label class="label" for="jgT">TKB</label><select class="select" id="jgT">' + App.opsiTkb(m.tkb, f.id_tkb, '— TKB utama guru (otomatis) —') + '</select></div>' +
          '<div class="grid2 mt-16"><div class="field"><label class="label" for="jgD">Dari bulan</label><input class="input" type="month" id="jgD" value="' + b1 + '"></div><div class="field"><label class="label" for="jgS">Sampai bulan</label><input class="input" type="month" id="jgS" value="' + b2 + '"></div></div>',
          actions: [{ label: 'Batal' }, { label: ic('download', 17) + ' Unduh PDF', cls: 'btn-primary', onClick: async function (close, root, btn) {
            const g = $('#jgG', root).value; if (!g) { T.toast('Pilih guru.', 'warn'); return false; }
            await App.unduhPdf('jurnal.pdf', { id_pengguna: g, id_tkb: $('#jgT', root).value, dari: $('#jgD', root).value, sampai: $('#jgS', root).value }, btn); return false;
          } }] });
      });
    }
    function csv() {
      const rows = [['No', 'Nama', 'NIP', 'Hari Jadwal', 'Hadir', 'Tepat Waktu', 'Terlambat', 'Di Luar Jadwal', 'Izin', 'Sakit', 'Alpa', '% Hadir', 'Kehadiran Terverifikasi', 'Tarif', 'Honor']];
      R.rows.forEach(function (x, i) { rows.push([i + 1, x.nama, x.nip, x.hariJadwal, x.hadir, x.tepat, x.terlambat, x.luar, x.izin, x.sakit, x.alpa, x.persen, x.terverifikasi, R.tarif, x.honor]); });
      rows.push([], ['Rincian harian'], ['Tanggal', 'Hari', 'Nama', 'Status', 'TKB', 'Jam', 'Keterangan']);
      R.rincian.forEach(function (x) { rows.push([x.tanggal, x.hari, x.nama, (T.STATUS[x.kode] || {}).t, x.tkb, x.jam, x.ket]); });
      T.downloadText(T.toCsv(rows), 'rekap_' + R.dari + '_sd_' + R.sampai + '.csv');
    }
    muat();
  } });

  // ------------------------------------------------------------------------
  //  PENGATURAN
  // ------------------------------------------------------------------------
  const PRESET_WARNA = ['#1A73E8', '#0D9488', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0F172A', '#B45309'];
  App.reg('a/pengaturan', { shell: 'admin', admin: true, title: 'Pengaturan Sistem', render: function (el, p) {
    App.badgeLoad();
    let tab = p.tab || 'identitas', D = null;
    const TABS = [['identitas', 'palette', 'Identitas Aplikasi'], ['aturan', 'ruler', 'Aturan Absen & Honor'], ['ttd', 'fileText', 'Kop & Penandatangan'], ['google', 'google', 'Login Google'], ['impor', 'database', 'Impor Data'], ['sistem', 'activity', 'Sistem & Log']];
    el.innerHTML = head('Pengaturan Sistem', 'Identitas aplikasi, aturan absensi, honorarium, dan keamanan.') +
      '<div class="set-grid"><div class="vtabs" id="sTabs">' + TABS.map(function (t) { return '<button class="pill ' + (tab === t[0] ? 'on' : '') + '" data-t="' + t[0] + '">' + ic(t[1], 17) + t[2] + '</button>'; }).join('') + '</div><div id="sBody" class="mt-16"><div class="skel" style="height:300px"></div></div></div>';
    T.on($('#sTabs'), 'click', '[data-t]', function (e, b) { tab = b.getAttribute('data-t'); T.$$('#sTabs .pill').forEach(function (x) { x.classList.toggle('on', x === b); }); history.replaceState(null, '', '#/a/pengaturan?tab=' + tab); gambar(); });
    T.load('pengaturan.ambil', {}, function (d, m) { if (!d) { $('#sBody').innerHTML = App.adminErr(m.error); return; } D = d; gambar(); }, { maxAge: 5000 });

    async function simpan(patch, btn) {
      const r = await T.withBtn(btn, function () { return T.api('pengaturan.simpan', { patch: patch }); });
      if (!r.success) { T.toast(r.message, 'err'); return false; }
      D.set = r.data.set; T.Set.terapkan(r.data.set); T.Cache.drop('pengaturan.'); App.afterWrite(); T.markStale(['app.config', 'guru.boot']);
      T.toast(r.message, 'ok'); return true;
    }
    function gambar() { if (!el.isConnected) return;
      if (!D) return;
      const s = D.set, box = $('#sBody'); box.classList.remove('mt-16');
      if (tab === 'identitas') {
        box.innerHTML = '<div class="gcols c21" style="align-items:start"><div class="panel"><div class="panel-hd"><div><h3>Identitas Aplikasi</h3><div class="sub">Tampil di header, halaman masuk, judul tab, dan kop PDF.</div></div></div><div class="panel-bd">' +
          '<div class="field"><label class="label">Logo</label><div class="logo-drop"><div class="logo-prev" id="lgPrev">' + (s.logo_thumb ? '<img src="' + esc(s.logo_thumb) + '" alt="Logo">' : ic('cap', 40)) + '</div><div class="col" style="gap:8px"><label class="btn btn-tonal btn-sm" style="cursor:pointer">' + ic('upload', 16) + ' Unggah Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" id="lgFile" class="sr"></label>' +
          (s.logo_thumb ? '<button class="btn btn-ghost btn-sm" id="lgHapus" style="color:var(--err-tx)">' + ic('trash', 16) + ' Hapus logo</button>' : '') + '<div class="help">Disarankan persegi, min. 256×256 px. Otomatis dibuat thumbnail.</div></div></div></div>' +
          '<div class="field"><label class="label" for="iNama">Nama aplikasi</label><input class="input" id="iNama" maxlength="40" value="' + esc(s.nama_aplikasi) + '"></div>' +
          '<div class="field"><label class="label" for="iSub">Subjudul</label><input class="input" id="iSub" maxlength="80" value="' + esc(s.subjudul) + '"></div>' +
          '<div class="grid2 mt-16"><div class="field"><label class="label" for="iInduk">Nama sekolah induk</label><input class="input" id="iInduk" value="' + esc(s.nama_sekolah_induk) + '"></div><div class="field"><label class="label" for="iWil">Wilayah / unit</label><input class="input" id="iWil" value="' + esc(s.wilayah) + '"></div></div>' +
          '<div class="field mt-16"><label class="label">Warna utama</label><div class="row wrap gap-12"><input type="color" id="iWarna" value="' + esc(s.warna_utama) + '" style="width:52px;height:44px;border:1px solid var(--line);border-radius:12px;padding:4px;background:#fff;cursor:pointer" aria-label="Pilih warna">' +
          '<input class="input mono" id="iWarnaHex" value="' + esc(s.warna_utama) + '" style="width:130px" maxlength="7"><div class="swatches">' + PRESET_WARNA.map(function (c) { return '<button class="sw ' + (c.toLowerCase() === String(s.warna_utama).toLowerCase() ? 'on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>' +
          '<div class="help" id="iKontras"></div></div>' +
          '<div class="row mt-20"><button class="btn btn-outline" id="iReset">' + ic('rotate', 17) + ' Kembalikan ke Default</button><span class="grow"></span><button class="btn btn-primary" id="iSimpan">' + ic('check', 18) + ' Simpan Pengaturan</button></div></div></div>' +
          '<div class="panel"><div class="panel-hd"><h3>Pratinjau</h3></div><div class="panel-bd"><div class="phone" id="phPrev"><div class="ptop"><span class="logo-tile" id="phLogo">' + (s.logo_thumb ? '<img src="' + esc(s.logo_thumb) + '" alt="">' : ic('cap', 15)) + '</span><span id="phNama">' + esc(s.nama_aplikasi) + '</span></div>' +
          '<div class="pbody"><div class="pbanner"><span class="chip chip-err chip-sm">BELUM ABSEN</span><div style="font:700 12px var(--f-head);margin-top:8px">Sesi 1: Matematika X-A</div><div class="xs muted">08:00 WIB · TKB Contoh</div><div class="pbtn">Scan Absen Sekarang</div></div><div class="pgrid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="pnav"><i></i></div></div></div></div></div>';
        let logo = null;
        const prevWarna = function (hex) {
          const pl = T.palette(hex), ph = $('#phPrev'); ph.style.setProperty('--prev', pl.p); ph.style.setProperty('--prev-50', pl.p50);
          const k = T.contrast(T.hexToRgb(hex), [255, 255, 255]);
          $('#iKontras').innerHTML = k < 4.2 ? '<span style="color:var(--warn-tx)">Warna ini terlalu terang untuk teks putih — sistem otomatis menggelapkannya menjadi <b class="mono">' + pl.p + '</b> agar tetap terbaca.</span>' : 'Kontras teks putih: <b class="mono">' + k.toFixed(1) + ':1</b> (baik).';
        };
        const setWarna = function (hex) { $('#iWarna').value = hex; $('#iWarnaHex').value = hex; T.$$('.sw').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-c').toLowerCase() === hex.toLowerCase()); }); prevWarna(hex); };
        prevWarna(s.warna_utama);
        $('#iWarna').oninput = function () { setWarna(this.value); };
        $('#iWarnaHex').oninput = function () { if (/^#[0-9a-fA-F]{6}$/.test(this.value)) { $('#iWarna').value = this.value; prevWarna(this.value); } };
        T.on(box, 'click', '[data-c]', function (e, b) { setWarna(b.getAttribute('data-c')); });
        $('#iNama').oninput = function () { $('#phNama').textContent = this.value; };
        $('#lgFile').onchange = async function () {
          const file = this.files[0]; if (!file) return;
          if (file.size > 4e6) return T.toast('Ukuran logo maksimal 4 MB.', 'warn');
          try {
            const src = await T.fileToDataUrl(file), img = await T.loadImg(src);
            const thumb = kotak(img, 160, 'image/png');
            const asli = file.type === 'image/svg+xml' ? kotak(img, 512, 'image/png') : await T.compressImage(img, 1024, .9, 'image/png');
            logo = { thumb: thumb.length > 45000 ? kotak(img, 128, 'image/webp', .9) : thumb, asli: asli };
            if (logo.thumb.length > 45000) logo.thumb = kotak(img, 112, 'image/jpeg', .85);
            $('#lgPrev').innerHTML = '<img src="' + logo.thumb + '" alt="Pratinjau logo">'; $('#phLogo').innerHTML = '<img src="' + logo.thumb + '" alt="">';
            T.toast('Logo siap. Tekan Simpan Pengaturan.', 'info');
          } catch (e) { T.toast('Gambar tidak dapat dibaca.', 'err'); }
        };
        const lh = $('#lgHapus'); if (lh) lh.onclick = async function () { if (!await T.confirm({ title: 'Hapus logo?', ok: 'Hapus', danger: true })) return; const r = await T.api('pengaturan.logo', { hapus: true }); if (!r.success) return T.toast(r.message, 'err'); D.set = r.data.set; T.Set.terapkan(r.data.set); T.toast(r.message, 'ok'); App.render(); };
        $('#iReset').onclick = function () { setWarna('#1A73E8'); };
        $('#iSimpan').onclick = async function () {
          const b = this, hex = $('#iWarnaHex').value.trim();
          if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return T.toast('Warna harus berformat #RRGGBB.', 'warn');
          if (logo) { const r = await T.withBtn(b, function () { return T.api('pengaturan.logo', logo); }); if (!r.success) return T.toast(r.message, 'err'); }
          if (await simpan({ nama_aplikasi: $('#iNama').value, subjudul: $('#iSub').value, nama_sekolah_induk: $('#iInduk').value, wilayah: $('#iWil').value, warna_utama: hex }, b)) App.render();
        };
      } else if (tab === 'aturan') {
        box.innerHTML = '<div class="panel"><div class="panel-hd"><div><h3>Aturan Absensi & Honorarium</h3><div class="sub">Berlaku untuk absen berikutnya. Perubahan tarif tercatat di log audit.</div></div></div><div class="panel-bd">' +
          '<div class="grid2"><div class="field"><label class="label" for="rTarif">Tarif per kehadiran (Rp)</label><input class="input mono" type="number" min="0" step="1000" id="rTarif" value="' + esc(s.tarif_per_kehadiran) + '"><div class="help">Satu tarif untuk semua guru. Saat ini: ' + T.rupiah(s.tarif_per_kehadiran) + '</div></div>' +
          '<div class="field"><label class="label" for="rTol">Toleransi terlambat (menit)</label><input class="input mono" type="number" min="0" max="180" id="rTol" value="' + esc(s.toleransi_terlambat_menit) + '"><div class="help">Lewat jam mulai + toleransi = terlambat.</div></div></div>' +
          '<div class="grid2 mt-16"><div class="field"><label class="label" for="rRad">Radius GPS bawaan (meter)</label><input class="input mono" type="number" min="10" max="1000" id="rRad" value="' + esc(s.radius_gps_meter) + '"><div class="help">Untuk TKB baru. Radius tiap TKB bisa diatur di menu TKB.</div></div>' +
          '<div class="field"><label class="label" for="rAcc">Akurasi GPS maksimal (meter)</label><input class="input mono" type="number" min="10" max="1000" id="rAcc" value="' + esc(s.akurasi_maks_meter) + '"><div class="help">Absen ditolak bila akurasi lebih buruk dari ini.</div></div></div>' +
          '<div class="field mt-16"><label class="label" for="rWa">Nomor WhatsApp admin (bantuan)</label><input class="input mono" id="rWa" inputmode="tel" value="' + esc(s.kontak_admin_wa) + '" placeholder="08xxxxxxxxxx"><div class="help">Tampil di tombol Bantuan untuk guru.</div></div>' +
          '<div class="row mt-20" style="justify-content:flex-end"><button class="btn btn-primary" id="rSimpan">' + ic('check', 18) + ' Simpan</button></div></div></div>';
        $('#rSimpan').onclick = function () { simpan({ tarif_per_kehadiran: $('#rTarif').value, toleransi_terlambat_menit: $('#rTol').value, radius_gps_meter: $('#rRad').value, akurasi_maks_meter: $('#rAcc').value, kontak_admin_wa: $('#rWa').value }, this); };
      } else if (tab === 'ttd') {
        const blok = function (n, def) { return '<div class="card card-pad" style="box-shadow:none"><h4>Penandatangan ' + n + ' <span class="muted small" style="font-weight:400">(' + def + ')</span></h4><div class="field mt-12"><label class="label" for="t' + n + 'j">Jabatan</label><input class="input" id="t' + n + 'j" value="' + esc(s['penandatangan_' + n + '_jabatan']) + '"></div><div class="field"><label class="label" for="t' + n + 'n">Nama</label><input class="input" id="t' + n + 'n" value="' + esc(s['penandatangan_' + n + '_nama']) + '"></div><div class="field"><label class="label" for="t' + n + 'p">NIP</label><input class="input mono" id="t' + n + 'p" value="' + esc(s['penandatangan_' + n + '_nip']) + '"></div></div>'; };
        const fld = function (id, k, label, ph) { return '<div class="field"><label class="label" for="' + id + '">' + label + '</label><input class="input" id="' + id + '" value="' + esc(s[k]) + '" placeholder="' + esc(ph || '') + '"></div>'; };
        box.innerHTML = '<div class="panel"><div class="panel-hd"><div><h3>Kop Surat</h3><div class="sub">Dipakai di PDF honorarium, jadwal pelajaran TKB, dan jurnal.</div></div></div><div class="panel-bd">' +
          '<div class="field"><label class="label">Logo kop (logo sekolah/yayasan)</label><div class="logo-drop"><div class="logo-prev" id="kpPrev">' + (s.logo_kop ? '<img src="' + esc(s.logo_kop) + '" alt="Logo kop">' : (s.logo_thumb ? '<img src="' + esc(s.logo_thumb) + '" alt="">' : ic('building', 34))) + '</div><div class="col" style="gap:8px"><label class="btn btn-tonal btn-sm" style="cursor:pointer">' + ic('upload', 16) + ' Unggah Logo Kop<input type="file" accept="image/png,image/jpeg,image/webp" id="kpFile" class="sr"></label>' +
          (s.logo_kop ? '<button class="btn btn-ghost btn-sm" id="kpHapus" style="color:var(--err-tx)">' + ic('trash', 16) + ' Hapus (pakai logo aplikasi)</button>' : '<div class="help">Belum diisi — memakai logo aplikasi.</div>') + '</div></div></div>' +
          fld('k1', 'kop_baris_1', 'Baris kop 1', 'YAYASAN PEMBINA LEMBAGA PENDIDIKAN DASAR DAN MENENGAH') + fld('k2', 'kop_baris_2', 'Baris kop 2', 'PERSATUAN GURU REPUBLIK INDONESIA ( YPLP DIKDASMEN PGRI )') + fld('k3', 'kop_baris_3', 'Baris kop 3', 'PROVINSI JAWA BARAT') +
          '<div class="grid2 mt-16">' + fld('kAk', 'akreditasi', 'Akreditasi', 'A') + fld('kEm', 'email_sekolah', 'Email sekolah', 'smapgrispa@gmail.com') + '</div>' +
          '<div class="mt-16">' + fld('kAl', 'alamat_sekolah', 'Alamat sekolah', 'Jl. … Kab. Tasikmalaya 46411 Tlp. …') + '</div>' +
          '<div class="help mt-8">Nama sekolah induk diambil dari Identitas Aplikasi: <b>' + esc(s.nama_sekolah_induk) + '</b></div></div></div>' +
          '<div class="panel mt-16"><div class="panel-hd"><div><h3>Penandatangan</h3><div class="sub">Honorarium: Pengelola (kiri), Bendahara (kanan), Kepala Sekolah (tengah, "Disetujui Oleh"). Jadwal: Kepala Sekolah & Pengelola. Jurnal: Pengelola & guru pamong.</div></div></div><div class="panel-bd"><div class="field"><label class="label" for="tKota">Kota (untuk tanggal tanda tangan)</label><input class="input" id="tKota" value="' + esc(s.kota_ttd) + '"></div>' +
          '<div class="gcols c3 mt-16">' + blok(1, 'Kepala Sekolah') + blok(2, 'Bendahara') + blok(3, 'Pengelola SMA Terbuka') + '</div><div class="row mt-20" style="justify-content:flex-end"><button class="btn btn-primary" id="tSimpan">' + ic('check', 18) + ' Simpan</button></div></div></div>';
        $('#tSimpan').onclick = function () {
          const pt = { kota_ttd: $('#tKota').value, kop_baris_1: $('#k1').value, kop_baris_2: $('#k2').value, kop_baris_3: $('#k3').value, akreditasi: $('#kAk').value, email_sekolah: $('#kEm').value, alamat_sekolah: $('#kAl').value };
          [1, 2, 3].forEach(function (n) { pt['penandatangan_' + n + '_jabatan'] = $('#t' + n + 'j').value; pt['penandatangan_' + n + '_nama'] = $('#t' + n + 'n').value; pt['penandatangan_' + n + '_nip'] = $('#t' + n + 'p').value; });
          simpan(pt, this);
        };
        $('#kpFile').onchange = async function () {
          const file = this.files[0]; if (!file) return;
          try {
            const img = await T.loadImg(await T.fileToDataUrl(file));
            let th = kotak(img, 200, 'image/png'); if (th.length > 45000) th = kotak(img, 150, 'image/png'); if (th.length > 45000) th = kotak(img, 140, 'image/jpeg', .88);
            const r = await T.api('pengaturan.logo', { jenis: 'kop', thumb: th });
            if (!r.success) return T.toast(r.message, 'err'); D.set = r.data.set; T.toast(r.message, 'ok'); gambar();
          } catch (e) { T.toast('Gambar tidak dapat dibaca.', 'err'); }
        };
        const kh = $('#kpHapus'); if (kh) kh.onclick = async function () { const r = await T.api('pengaturan.logo', { jenis: 'kop', hapus: true }); if (!r.success) return T.toast(r.message, 'err'); D.set = r.data.set; gambar(); };
      } else if (tab === 'google') {
        const g = D.rahasia;
        box.innerHTML = '<div class="panel"><div class="panel-hd"><div><h3 class="row">' + ic('google', 20) + ' Login dengan Google</h3><div class="sub">Opsional. Guru dapat masuk memakai akun Google; akun baru wajib disetujui admin.</div></div><span class="chip ' + (g.googleAktif ? 'chip-ok' : 'chip-slate') + '"><span class="dot"></span>' + (g.googleAktif ? 'Aktif' : 'Belum aktif') + '</span></div><div class="panel-bd">' +
          '<ol class="small" style="padding-left:18px;line-height:1.8;margin:0"><li>Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console → Credentials</a>, buat <b>OAuth client ID</b> jenis <b>Web application</b>.</li>' +
          '<li>Pada <b>Authorized JavaScript origins</b>, tambahkan alamat aplikasi ini: <span class="mono chip chip-slate">' + esc(location.origin) + '</span> <button class="link" id="cpOrigin">salin</button></li><li>Salin <b>Client ID</b> (berakhiran <span class="mono">.apps.googleusercontent.com</span>) dan tempel di bawah.</li></ol>' +
          '<div class="field mt-16"><label class="label" for="gCid">Google Client ID</label><input class="input mono" id="gCid" value="' + esc(g.googleClientId || '') + '" placeholder="1234567890-xxxx.apps.googleusercontent.com" autocomplete="off"><div class="help">Disimpan di Script Properties (bukan di Sheets/kode). Client ID bukan rahasia, tetapi tetap dikelola dari server.</div></div>' +
          '<div class="row mt-20">' + (g.googleAktif ? '<button class="btn btn-danger-soft" id="gOff">' + ic('x', 17) + ' Nonaktifkan</button>' : '') + '<span class="grow"></span><button class="btn btn-primary" id="gSimpan">' + ic('check', 18) + ' Simpan</button></div></div></div>' +
          '<div class="note note-p mt-16">' + ic('shield', 18) + '<div><b>Akses darurat</b> tersedia di alamat <span class="mono">#/darurat</span> (tidak ditautkan dari menu mana pun). Kredensialnya hanya tampil di log saat setup pertama, dan bisa dibuat ulang dengan fungsi <span class="mono">resetAksesDarurat()</span> di editor Apps Script.</div></div>';
        $('#cpOrigin').onclick = function () { T.copyText(location.origin); };
        $('#gSimpan').onclick = async function () { const r = await T.withBtn(this, function () { return T.api('rahasia.simpan', { kunci: 'GOOGLE_CLIENT_ID', nilai: $('#gCid').value }); }); if (!r.success) return T.toast(r.message, 'err'); D.rahasia.googleClientId = r.data.nilai; D.rahasia.googleAktif = r.data.ada; App.cfg.googleClientId = r.data.nilai; T.toast('Login Google diaktifkan.', 'ok'); gambar(); };
        const go = $('#gOff'); if (go) go.onclick = async function () { if (!await T.confirm({ title: 'Nonaktifkan login Google?', sub: 'Guru tetap bisa masuk dengan NIP & sandi.', ok: 'Nonaktifkan', danger: true })) return; const r = await T.api('rahasia.simpan', { kunci: 'GOOGLE_CLIENT_ID', nilai: '__HAPUS__' }); if (!r.success) return T.toast(r.message, 'err'); D.rahasia.googleClientId = ''; D.rahasia.googleAktif = false; App.cfg.googleClientId = ''; gambar(); };
      } else if (tab === 'impor') {
        const SH = [['Pengguna', 'Guru & admin'], ['TKB', 'TKB + token QR'], ['Jadwal', 'Jadwal mengajar'], ['Agenda', 'Agenda'], ['Izin', 'Izin/sakit'], ['Absensi', 'Riwayat absensi']];
        box.innerHTML = '<div class="panel"><div class="panel-hd"><div><h3>Impor Data dari Aplikasi Lama</h3><div class="sub">Untuk upgrade / pindah ke spreadsheet baru. Spreadsheet lama hanya <b>dibaca</b>, tidak diubah.</div></div></div><div class="panel-bd">' +
          '<div class="field"><label class="label" for="mSrc">URL atau ID spreadsheet lama</label><input class="input mono" id="mSrc" placeholder="https://docs.google.com/spreadsheets/d/…/edit"><div class="help">Harus milik (atau dibagikan ke) akun Google pemilik aplikasi ini, agar foto & lampiran di Drive tetap terbaca.</div></div>' +
          '<div class="field"><label class="label">Data yang diimpor</label><div class="grid3">' + SH.map(function (x) { return '<label class="check card" style="padding:10px 12px;box-shadow:none"><input type="checkbox" value="' + x[0] + '" checked> <span><b class="small">' + x[0] + '</b><br><span class="xs muted">' + x[1] + '</span></span></label>'; }).join('') + '</div></div>' +
          '<label class="check mt-12"><input type="checkbox" id="mTimpa"> Timpa data yang sudah ada (default: data di aplikasi baru dipertahankan)</label>' +
          '<div class="note note-p mt-12">' + ic('info', 18) + '<div>Aman diulang: data dicocokkan dengan NIP, ID TKB, ID jadwal/izin, dan pasangan guru+tanggal untuk absensi — tidak ada baris ganda. Jalankan sekali lagi tepat sebelum pindah (delta). Kata sandi tidak ikut pindah; sistem membuat sandi awal baru.</div></div>' +
          '<div class="row mt-20"><span class="grow"></span><button class="btn btn-tonal" id="mPindai">' + ic('search', 18) + ' Pindai (Dry-run)</button><button class="btn btn-primary" id="mJalan">' + ic('database', 18) + ' Jalankan Impor</button></div><div id="mHasil" class="mt-16"></div></div></div>' +
          '<div class="card card-pad mt-16 row"><span class="itile itile-sm">' + ic('users', 18) + '</span><div class="grow"><b style="font-family:var(--f-head)">Impor daftar guru dari CSV/Excel?</b><div class="small muted">Gunakan tombol Impor CSV di menu Data Guru.</div></div><a class="btn btn-outline btn-sm" href="#/a/guru">Buka Data Guru</a></div>';
        const jalan = async function (dry, b) {
          const src = $('#mSrc').value.trim(); if (!src) return T.toast('Tempel URL/ID spreadsheet lama.', 'warn');
          const sheets = T.$$('#sBody .grid3 input:checked').map(function (x) { return x.value; });
          if (!dry && !await T.confirm({ title: 'Jalankan impor sekarang?', sub: 'Data akan ditulis ke spreadsheet aplikasi ini. Disarankan Pindai dulu.', ok: 'Jalankan' })) return;
          const r = await T.withBtn(b, function () { return T.api(dry ? 'impor.pindai' : 'impor.jalankan', { sumber: src, sheets: sheets, timpa: $('#mTimpa').checked }); });
          if (!r.success) { $('#mHasil').innerHTML = '<div class="note note-err">' + ic('xCircle', 18) + '<div>' + esc(r.message) + '</div></div>'; return; }
          const d = r.data;
          $('#mHasil').innerHTML = '<div class="note ' + (dry ? 'note-p' : 'note-ok') + '">' + ic(dry ? 'search' : 'checkCircle', 18) + '<div><b>' + esc(r.message) + '</b> Sumber: ' + esc(d.sumber.nama) + '</div></div>' +
            '<div class="tbl-wrap mt-12" style="box-shadow:none"><table class="tbl"><thead><tr><th>Data</th><th class="c">Di app lama</th><th class="c">Ditambah</th><th class="c">Diperbarui</th><th class="c">Dilewati</th></tr></thead><tbody>' +
            Object.keys(d.report).map(function (k) { const x = d.report[k]; return '<tr><td><b>' + esc(k) + '</b>' + (x.catatan ? ' <span class="xs muted">(' + esc(x.catatan) + ')</span>' : '') + '</td><td class="c mono">' + x.sumber + '</td><td class="c mono" style="color:var(--ok-tx)">' + x.ditambah + '</td><td class="c mono">' + x.diperbarui + '</td><td class="c mono muted">' + x.dilewati + '</td></tr>'; }).join('') + '</tbody></table></div>' +
            (d.warnings.length ? '<div class="note note-warn mt-12">' + ic('alert', 18) + '<div><b>Peringatan:</b><ul style="margin:6px 0 0;padding-left:18px">' + d.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div></div>' : '');
          if (!dry) { App.afterWrite(); T.Cache.drop(); if (d.akunBaru && d.akunBaru.length) App.tampilKredensial(d.akunBaru, 'Sandi Awal Akun Hasil Impor (' + d.akunBaru.length + ')'); }
        };
        $('#mPindai').onclick = function () { jalan(true, this); }; $('#mJalan').onclick = function () { jalan(false, this); };
      } else if (tab === 'sistem') {
        box.innerHTML = '<div class="gcols c2" style="align-items:start"><div class="panel"><div class="panel-hd"><h3>Status Sistem</h3><button class="btn btn-ghost btn-sm" id="sRef">' + ic('refresh', 16) + ' Segarkan</button></div><div class="panel-bd" id="sStat"><div class="skel" style="height:160px"></div></div></div>' +
          '<div class="panel"><div class="panel-hd"><h3>Tautan Data</h3></div><div class="panel-bd col">' +
          (D.spreadsheetUrl ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="' + esc(D.spreadsheetUrl) + '">' + ic('database', 18) + ' Buka Spreadsheet Database</a>' : '') +
          (D.driveUrl ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="' + esc(D.driveUrl) + '">' + ic('layers', 18) + ' Buka Folder Drive (foto, PDF)</a>' : '') +
          '<div class="note note-warn">' + ic('alert', 18) + '<div>Jangan bagikan spreadsheet/folder ini ke banyak orang. Edit langsung di Sheets akan tampil di aplikasi paling lama ±6 jam (cache) — gunakan menu aplikasi agar perubahan langsung terlihat.</div></div>' +
          '<button class="btn btn-ghost" id="sCache">' + ic('trash', 17) + ' Bersihkan cache di perangkat ini</button></div></div></div>' +
          '<div class="panel mt-16"><div class="panel-hd"><h3>Log Audit</h3><span class="small muted">200 aktivitas terakhir</span></div><div id="sLog" style="padding:0 18px 18px"><div class="skel" style="height:200px"></div></div></div>';
        const stat = async function () {
          const r = await T.api('sistem.status');
          if (!r.success) { $('#sStat').innerHTML = '<div class="muted small">' + esc(r.message) + '</div>'; return; }
          const x = r.data;
          $('#sStat').innerHTML = '<div class="kv">' + [['Versi server', x.versi], ['Waktu server', String(x.waktu).replace('T', ' ')], ['keepWarm', x.keepWarm ? 'aktif' : 'mati'], ['Trigger', x.triggers.join(', ') || '-'], ['Script Properties', x.scriptProperties.jumlah + ' kunci · ' + x.scriptProperties.ukuranKB + ' KB / 500 KB'], ['Warm terakhir', x.warmTerakhir ? String(x.warmTerakhir.at).slice(11, 19) + ' (' + x.warmTerakhir.scope + ')' : '-']].map(function (k) { return '<div><small>' + k[0] + '</small><b>' + esc(k[1]) + '</b></div>'; }).join('') + '</div>' +
            '<div class="row wrap mt-12">' + Object.keys(x.cache).map(function (k) { return '<span class="chip chip-sm ' + (x.cache[k] ? 'chip-ok' : 'chip-slate') + '">' + k + ': ' + (x.cache[k] ? 'HANGAT' : 'dingin') + '</span>'; }).join('') + '</div>' +
            '<div class="small muted mt-12">Baris data: ' + Object.keys(x.baris).map(function (k) { return k + ' ' + x.baris[k]; }).join(' · ') + '</div>';
        };
        stat(); $('#sRef').onclick = stat;
        $('#sCache').onclick = function () { T.Cache.drop(); T.toast('Cache perangkat dibersihkan.', 'ok'); };
        T.api('log.list', { limit: 200 }).then(function (r) {
          if (!r.success) { $('#sLog').innerHTML = '<div class="muted small">' + esc(r.message) + '</div>'; return; }
          $('#sLog').innerHTML = r.data.rows.length ? '<div class="tbl-wrap" style="box-shadow:none;max-height:460px;overflow:auto"><table class="tbl"><thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>' + r.data.rows.map(function (l) { return '<tr><td class="mono xs">' + esc(String(l.waktu).replace('T', ' ')) + '</td><td class="small">' + esc(l.pelaku) + '</td><td><span class="chip chip-slate chip-sm chip-mono">' + esc(l.aksi) + '</span></td><td class="small mono">' + esc(l.entitas) + '</td><td class="small">' + esc(l.detail) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="muted small">Belum ada log.</div>';
        });
      }
    }
    /** Potong tengah jadi persegi + ubah ukuran → dataURL */
    function kotak(img, size, mime, q) {
      const w = img.naturalWidth || img.width || size, h = img.naturalHeight || img.height || size, m = Math.min(w, h);
      const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d');
      if (mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); }
      x.imageSmoothingQuality = 'high'; x.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, size, size);
      return c.toDataURL(mime, q || .92);
    }
  } });
})();
