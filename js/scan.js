/* ==========================================================================
   TeachTrack — scan.js
   Alur absen 3 langkah: (1) Pindai QR TKB → (2) Validasi GPS radius →
   (3) Foto bukti (selfie / kegiatan) → kirim → layar sukses.
   Kamera: BarcodeDetector bawaan (Android/Chrome) atau html5-qrcode (iPhone).
   Validasi akhir SELALU di server (radius, 1×/hari, izin, jam server).
   ========================================================================== */
(function () {
  'use strict';
  const T = TT, esc = T.esc, $ = T.$;

  App.reg('scan', { shell: 'guru', guru: true, noNav: true, nav: 'scan', title: 'Pindai Kode QR', sub: 'Langkah 1 dari 3: Presensi TKB', back: 'beranda',
    topAct: '<button class="icon-btn" id="scHelp" aria-label="Bantuan" style="color:var(--p)">' + ic('help', 22) + '</button>',
    render: function (el) {
      const S = { step: 1, kode: '', cek: null, pos: null, jenis: 'selfie', foto: '', stream: null, h5: null, loop: null, alive: true, facing: 'user', torch: false, watch: null };
      const me = T.Sesi.me || {};
      const setTop = function (t, sub) { const b = $('.m-top .ttl b'), s = $('.m-top .ttl span'); if (b) b.textContent = t; if (s) s.textContent = sub; };
      $('#scHelp').onclick = function () { App.bantuanGuru(); };
      $('#btnBack').onclick = function () {
        if (S.step === 3) return langkah2();
        if (S.step === 2) return langkah1();
        App.go('beranda');
      };

      function stepper(n) {
        const lb = ['Scan QR', 'Lokasi GPS', 'Ambil Foto'];
        return '<div class="stepper">' + lb.map(function (l, i) {
          const k = i + 1, cls = k < n ? 'done' : k === n ? 'on' : '';
          return '<div class="st ' + cls + '"><span class="n">' + (k < n ? ic('check', 18) : k) + '</span>' + l + '</div>';
        }).join('') + '</div>';
      }
      function stopKamera() {
        clearInterval(S.loop); S.loop = null;
        if (S.h5) { const h = S.h5; S.h5 = null; try { h.stop().then(function () { h.clear(); }).catch(function () { }); } catch (e) { } }
        if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; }
      }
      function stopGps() { if (S.watch !== null) { navigator.geolocation.clearWatch(S.watch); S.watch = null; } }

      // =============================== LANGKAH 1 =============================
      async function langkah1(pesanErr) {
        stopKamera(); stopGps(); S.step = 1; S.kode = ''; S.cek = null;
        setTop('Pindai Kode QR', 'Langkah 1 dari 3: Presensi TKB');
        el.innerHTML = stepper(1) +
          '<div class="cam mt-16" id="cam"><div class="grid-bg"></div><div id="qrv" style="position:absolute;inset:0"></div>' +
          '<div class="ov-top"><span class="glass"><span class="live-dot"></span><span id="camStat">Menyalakan kamera…</span></span><button class="glass" id="btnTorch">' + ic('flash', 16) + 'Senter</button></div>' +
          '<div class="frame"><i></i><i></i><i></i><i></i><div class="laser"></div></div>' +
          '<div class="hint" id="camHint">' + ic('scan', 26) + 'Arahkan kamera ke QR Code TKB</div>' +
          '<div class="ov-bot"><label class="glass" style="cursor:pointer">' + ic('image', 16) + 'Pilih dari Galeri<input type="file" accept="image/*" id="qrFile" class="sr"></label><span class="glass" style="color:#86EFAC">' + ic('shield', 15) + 'Geo-Secure QR</span></div></div>' +
          '<div id="scMsg" class="mt-12">' + (pesanErr ? '<div class="note note-err">' + ic('xCircle', 18) + '<div>' + esc(pesanErr) + '</div></div>' : '') + '</div>' +
          '<div class="card card-pad card-tint mt-12 row" style="align-items:flex-start;gap:12px"><span class="itile itile-sm" style="background:#fff">' + ic('sparkle', 18) + '</span><div><h4>Petunjuk Pindai</h4><p class="small muted mt-4">Pastikan QR fisik di Tempat Kegiatan Belajar (TKB) berada di dalam kotak pemindai dengan pencahayaan cukup.</p></div></div>' +
          '<button class="btn btn-outline-p btn-block btn-lg mt-16" id="btnManual">' + ic('keyboard', 20) + ' Input Kode TKB Manual</button>' +
          '<p class="xs muted center mt-8">Gunakan opsi manual bila QR rusak atau kamera bermasalah. Lokasi GPS & foto tetap wajib.</p>';
        $('#btnManual').onclick = inputManual;
        $('#qrFile').onchange = function () { if (this.files[0]) scanFile(this.files[0]); };
        $('#btnTorch').onclick = toggleTorch;
        // Cek awal: sudah absen / sedang izin? (paralel dengan menyalakan kamera)
        T.api('absen.cek', { kode: '' }).then(function (r) {
          if (!S.alive || S.step !== 1) return;
          if (r.code === 'SUDAH_ABSEN') { stopKamera(); sudahAbsen(r); }
          else if (r.code === 'SEDANG_IZIN') { stopKamera(); infoIzin(r.message); }
          else if (r.code === 'NET' || r.code === 'CONFIG') $('#scMsg').innerHTML = '<div class="note note-warn">' + ic('wifiOff', 18) + '<div>' + esc(r.message) + '</div></div>';
        });
        mulaiKamera();
      }
      async function mulaiKamera() {
        const stat = function (t) { const s = $('#camStat'); if (s) s.textContent = t; };
        try {
          if ('BarcodeDetector' in window) {
            const fmts = await window.BarcodeDetector.getSupportedFormats().catch(function () { return []; });
            if (fmts.indexOf('qr_code') >= 0) {
              const det = new window.BarcodeDetector({ formats: ['qr_code'] });
              S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
              if (!S.alive || S.step !== 1) return stopKamera();
              const v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = S.stream; $('#qrv').appendChild(v); await v.play();
              const st = S.stream.getVideoTracks()[0].getSettings ? S.stream.getVideoTracks()[0].getSettings() : {};
              stat('Kamera Aktif' + (st.height ? ' • ' + st.height + 'p' : ''));
              let busy = false;
              S.loop = setInterval(async function () {
                if (busy || v.readyState < 2) return; busy = true;
                try { const r = await det.detect(v); if (r && r[0] && r[0].rawValue) onKode(r[0].rawValue); } catch (e) { }
                busy = false;
              }, 220);
              return;
            }
          }
          stat('Memuat pemindai…');
          await T.loadScript(T.LIB.qrScan);
          if (!S.alive || S.step !== 1) return;
          const box = $('#qrv'); box.innerHTML = '<div id="h5qr" style="width:100%;height:100%"></div>';
          S.h5 = new window.Html5Qrcode('h5qr', { verbose: false });
          await S.h5.start({ facingMode: 'environment' }, { fps: 10, qrbox: function (w, h) { const m = Math.floor(Math.min(w, h) * .62); return { width: m, height: m }; }, aspectRatio: 1.2, disableFlip: false }, function (txt) { onKode(txt); }, function () { });
          const vid = $('#h5qr video'); if (vid) { vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'; vid.setAttribute('playsinline', ''); }
          $$h5();
          stat('Kamera Aktif');
        } catch (e) {
          const cam = $('#cam'); if (!cam) return;
          const ditolak = e && (e.name === 'NotAllowedError' || /permission|denied|izin/i.test(String(e.message || e)));
          const d = document.createElement('div'); d.className = 'camerr';
          d.innerHTML = ic('camera', 34) + '<div><b style="color:#fff;font-family:var(--f-head)">' + (ditolak ? 'Izin kamera ditolak' : 'Kamera tidak dapat dibuka') + '</b><br>' + (ditolak ? 'Izinkan akses kamera untuk situs ini di pengaturan browser, lalu coba lagi.' : 'Tutup aplikasi lain yang memakai kamera, atau gunakan galeri / kode manual.') + '</div>' +
            '<div class="row"><button class="btn btn-sm btn-primary" id="camRetry">' + ic('refresh', 16) + 'Coba Lagi</button><button class="btn btn-sm btn-outline" id="camManual">Kode Manual</button></div>';
          cam.appendChild(d); const h = $('#camHint'); if (h) h.remove();
          $('#camRetry').onclick = function () { langkah1(); }; $('#camManual').onclick = inputManual;
        }
      }
      function $$h5() { T.$$('#h5qr img, #h5qr__dashboard_section, #h5qr__header_message').forEach(function (x) { x.style.display = 'none'; }); T.$$('#h5qr__scan_region').forEach(function (x) { x.style.cssText = 'position:absolute;inset:0;'; }); }
      async function toggleTorch() {
        S.torch = !S.torch;
        try {
          if (S.stream) await S.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: S.torch }] });
          else if (S.h5) await S.h5.applyVideoConstraints({ advanced: [{ torch: S.torch }] });
          else throw 0;
          const b = $('#btnTorch'); if (b) b.innerHTML = ic('flash', 16) + (S.torch ? 'Senter Nyala' : 'Senter');
        } catch (e) { S.torch = false; T.toast('Senter tidak didukung di perangkat/browser ini.', 'info'); }
      }
      async function scanFile(file) {
        try {
          let val = '';
          if ('BarcodeDetector' in window) {
            const bmp = await createImageBitmap(file); const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bmp); val = r && r[0] ? r[0].rawValue : '';
          }
          if (!val) {
            await T.loadScript(T.LIB.qrScan);
            let tmp = $('#h5file'); if (!tmp) { tmp = document.createElement('div'); tmp.id = 'h5file'; tmp.style.display = 'none'; document.body.appendChild(tmp); }
            val = await new window.Html5Qrcode('h5file').scanFile(file, false);
          }
          if (val) onKode(val); else throw 0;
        } catch (e) { T.toast('QR tidak terbaca dari gambar. Coba foto yang lebih jelas.', 'warn'); }
      }
      function inputManual() {
        T.modal({ title: 'Input Kode TKB Manual', sub: 'Kode tercetak di bawah QR (diawali TT)', body:
          '<div class="field"><label class="label" for="kdIn">Kode TKB</label><input class="input mono" id="kdIn" autocomplete="off" autocapitalize="characters" placeholder="TTXXXXXXXXXX" style="text-transform:uppercase;letter-spacing:.08em"></div>' +
          '<div class="note note-warn mt-12">' + ic('alert', 18) + '<div>Lokasi GPS Anda tetap diverifikasi. Absen di luar radius TKB akan ditolak.</div></div>',
          actions: [{ label: 'Batal' }, { label: 'Lanjutkan', cls: 'btn-primary', onClick: function (close, root) { const v = $('#kdIn', root).value.trim(); if (v.length < 6) { T.toast('Kode belum lengkap.', 'warn'); return false; } setTimeout(function () { onKode(v); }, 50); } }] });
      }
      let memproses = false;
      async function onKode(raw) {
        if (memproses || S.step !== 1) return; memproses = true;
        try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { }
        stopKamera();
        const msg = $('#scMsg'); if (msg) msg.innerHTML = '<div class="note note-p">' + ic('refresh', 18) + '<div>Memverifikasi kode TKB…</div></div>';
        const r = await T.api('absen.cek', { kode: raw });
        memproses = false;
        if (!S.alive) return;
        if (r.code === 'SUDAH_ABSEN') return sudahAbsen(r);
        if (r.code === 'SEDANG_IZIN') return infoIzin(r.message);
        if (!r.success) return langkah1(r.message);
        S.kode = raw; S.cek = r.data; langkah2();
      }
      function sudahAbsen(r) {
        S.step = 4; setTop('Absensi Guru Pamong', 'Status presensi hari ini');
        const a = r.data || {};
        el.innerHTML = '<div class="card card-pad-lg center"><div class="big-check">' + ic('checkCircle', 42) + '</div><h2>Anda Sudah Absen Hari Ini</h2><p class="small muted mt-8">' + esc(r.message) + '</p><div class="mt-12">' + T.chipAbsen(a) + '</div></div>' +
          '<div class="note note-p mt-12">' + ic('shield', 18) + '<div>Sistem mencegah absen ganda di hari yang sama. Hubungi admin bila ada kekeliruan data.</div></div>' +
          '<a class="btn btn-primary btn-block btn-lg mt-16" href="#/beranda">' + ic('home', 19) + ' Kembali ke Beranda</a><a class="btn btn-tonal btn-block mt-12" href="#/riwayat' + (a.id ? '?id=' + esc(a.id) : '') + '">' + ic('history', 19) + ' Lihat Bukti Presensi</a>';
      }
      function infoIzin(m) {
        S.step = 4; setTop('Presensi Hari Ini', 'Izin / sakit disetujui');
        el.innerHTML = '<div class="card card-pad-lg center"><span class="itile" style="width:72px;height:72px;border-radius:24px;margin:0 auto">' + ic('calendarCheck', 34) + '</span><h2 class="mt-16">Hari Ini Anda Tercatat Izin</h2><p class="small muted mt-8">' + esc(m) + '</p></div><a class="btn btn-primary btn-block btn-lg mt-16" href="#/beranda">' + ic('home', 19) + ' Kembali ke Beranda</a>';
      }

      // =============================== LANGKAH 2 =============================
      function langkah2() {
        stopKamera(); S.step = 2; S.pos = null; setTop('Validasi Lokasi GPS', 'Langkah 2 dari 3');
        const t = S.cek.tkb, c = S.cek.cocok || {};
        el.innerHTML = stepper(2) +
          '<div class="card card-pad mt-16"><div class="row-b" style="align-items:flex-start"><div class="row" style="align-items:flex-start;gap:10px;min-width:0"><span class="itile itile-sm">' + ic('building', 18) + '</span><div style="min-width:0"><div class="xs muted">Tempat Kegiatan Belajar Terpilih</div><h4 class="ellipsis">' + esc(t.nama) + '</h4></div></div><span class="chip chip-ok chip-sm" style="flex:none"><span class="dot"></span>Terverifikasi QR</span></div>' +
          (t.alamat ? '<div class="row small muted mt-8">' + ic('mapPin', 15) + '<span>' + esc(t.alamat) + '</span></div>' : '') +
          '<div class="row-b mt-12" style="padding-top:12px;border-top:1px dashed var(--line)"><span class="chip chip-slate chip-mono chip-sm">ID TKB: ' + esc(t.id) + '</span><span class="mono small" style="color:var(--p)">Radius Batas: ' + t.radius + ' m</span></div></div>' +
          '<div class="radar mt-12"><div id="rdr">' + Charts.radar({ radius: t.radius, jarak: null }) + '</div><div class="rfoot"><span id="rCoord">Mencari sinyal GPS…</span><span class="row" style="color:var(--ok-tx)"><span class="live-dot"></span>Live GPS</span></div></div>' +
          '<div id="gpsRes" class="mt-12"></div>' +
          '<button class="btn btn-primary btn-block btn-lg mt-16" id="btnLanjut" disabled>Lanjut Ambil Foto ' + ic('arrowRight', 20) + '</button>' +
          '<button class="btn btn-tonal btn-block mt-12" id="btnGps">' + ic('refresh', 19) + ' Segarkan GPS</button>' +
          (c.status === 'di_luar_jadwal' ? '<div class="note note-warn mt-12">' + ic('alert', 18) + '<div>Anda tidak memiliki jadwal di TKB ini hari ini. Absen tetap dicatat sebagai <b>di luar jadwal</b> dan perlu diverifikasi admin.</div></div>' : '') +
          '<p class="xs muted center mt-12 row" style="justify-content:center">' + ic('shield', 14) + 'Jarak final dihitung ulang di server saat absen dikirim</p>';
        $('#btnGps').onclick = cariGps; $('#btnLanjut').onclick = langkah3;
        cariGps();
      }
      function gambarGps(p, final) {
        const t = S.cek.tkb, maks = S.cek.akurasiMaks || 100;
        const jarak = T.haversine(p.lat, p.lng, t.lat, t.lng), br = Charts.bearing(t.lat, t.lng, p.lat, p.lng);
        const dalam = jarak <= t.radius, akurasiOk = p.acc <= maks;
        $('#rdr').innerHTML = Charts.radar({ radius: t.radius, jarak: jarak, bearing: br, akurasi: p.acc });
        $('#rCoord').innerHTML = 'Lat: ' + p.lat.toFixed(6) + ', Long: ' + p.lng.toFixed(6);
        const sesi = S.cek.cocok && S.cek.cocok.jadwal ? S.cek.cocok.jadwal.mapel + (S.cek.cocok.jadwal.kelas ? ' Kelas ' + S.cek.cocok.jadwal.kelas : '') : 'hari ini';
        const kualitas = p.acc <= 10 ? 'Sangat Baik' : p.acc <= 25 ? 'Baik' : p.acc <= maks ? 'Cukup' : 'Rendah';
        let cls = dalam && akurasiOk ? 'ok' : !akurasiOk ? 'warn' : 'err';
        if (!final && !(dalam && akurasiOk)) cls = 'warn';
        $('#gpsRes').innerHTML = '<div class="result-card ' + cls + '"><div class="row-b" style="align-items:flex-start"><div><div class="eyebrow">Hasil Verifikasi Jarak</div><div class="row mt-8" style="align-items:baseline;gap:10px"><span class="bigdist" style="color:' + (dalam ? 'var(--tx)' : 'var(--err-tx)') + '">' + Math.round(jarak) + '</span><span class="b">meter</span></div><div class="small muted">dari titik pusat TKB</div></div>' +
          (dalam ? '<span class="chip chip-ok chip-lg">' + ic('checkCircle', 15) + 'Dalam Radius</span>' : '<span class="chip chip-err chip-lg">' + ic('xCircle', 15) + 'Di Luar Radius</span>') + '</div>' +
          '<div class="kv mt-12"><div><small>' + ic('locate', 12) + ' Akurasi Perangkat</small><b>± ' + p.acc + ' m (' + kualitas + ')</b></div><div><small>' + ic('satellite', 12) + ' Batas Akurasi</small><b>≤ ' + maks + ' m</b></div></div>' +
          (dalam && akurasiOk ? '<div class="note note-ok mt-12">' + ic('shield', 18) + '<div>Lokasi Anda <b>sah &amp; memenuhi syarat</b> untuk presensi sesi <b>' + esc(sesi) + '</b>.</div></div>'
            : !akurasiOk ? '<div class="note note-warn mt-12">' + ic('satellite', 18) + '<div><b>Akurasi GPS rendah (±' + p.acc + ' m).</b> ' + (final ? 'Keluar ke area terbuka, aktifkan mode lokasi akurasi tinggi, lalu tekan Segarkan GPS.' : 'Menunggu sinyal membaik…') + '</div></div>'
              : '<div class="note note-err mt-12">' + ic('alertCircle', 18) + '<div>Anda berada <b>±' + Math.round(jarak) + ' m</b> dari titik pusat ' + esc(t.nama) + '. Mendekatlah ke lokasi (radius ' + t.radius + ' m) untuk melanjutkan.</div></div>') + '</div>';
        $('#btnLanjut').disabled = !(dalam && akurasiOk);
      }
      async function cariGps() {
        const b = $('#btnGps'); if (b) b.classList.add('is-loading');
        $('#gpsRes').innerHTML = '<div class="result-card"><div class="row small muted">' + ic('satellite', 18) + 'Mendeteksi lokasi Anda… tetap di tempat sebentar.</div></div>';
        try {
          const p = await T.getPosisi({ target: 15, timeout: 15000, onUpdate: function (x) { if (S.step === 2 && S.alive) gambarGps(x, false); } });
          if (S.step !== 2 || !S.alive) return;
          S.pos = p; gambarGps(p, true);
        } catch (e) {
          if (S.step !== 2) return;
          $('#gpsRes').innerHTML = '<div class="result-card warn"><div class="row" style="align-items:flex-start;gap:12px"><span class="itile itile-sm t-amber">' + ic('satellite', 18) + '</span><div><b style="font-family:var(--f-head)">' + (e.code === 'DENIED' ? 'Izin Lokasi Ditolak' : 'GPS Tidak Aktif / Akurasi Rendah') + '</b><p class="small muted mt-4">' + esc(e.message) + '</p></div></div>' +
            '<details class="mt-12 small"><summary class="link">Panduan Pengaturan Lokasi</summary><ol style="padding-left:18px;line-height:1.7;margin:8px 0 0"><li>Buka <b>Pengaturan HP → Lokasi</b>, aktifkan, pilih <b>akurasi tinggi</b>.</li><li>Di browser, ketuk ikon gembok di bilah alamat → <b>Izin → Lokasi → Izinkan</b>.</li><li>Kembali ke halaman ini dan tekan <b>Segarkan GPS</b>.</li></ol></details></div>';
          $('#btnLanjut').disabled = true;
        } finally { if (b) b.classList.remove('is-loading'); }
      }

      // =============================== LANGKAH 3 =============================
      function langkah3() {
        if (!S.pos) return;
        S.step = 3; S.foto = ''; setTop('Verifikasi Foto Kehadiran', 'Langkah 3 dari 3 (Terakhir)');
        const c = S.cek.cocok || {}, j = c.jadwal;
        const perk = c.status === 'terlambat' ? '<span class="chip chip-warn chip-sm"><span class="dot"></span>Terlambat ±' + c.menit + 'm</span>' : c.status === 'di_luar_jadwal' ? '<span class="chip chip-violet chip-sm"><span class="dot"></span>Di Luar Jadwal</span>' : '<span class="chip chip-ok chip-sm"><span class="dot"></span>Tepat Waktu</span>';
        el.innerHTML = stepper(3) +
          '<div class="card card-pad mt-16 row" style="background:var(--p-50);border-color:var(--p-100)"><span class="itile itile-sm" style="background:#fff">' + ic('book', 18) + '</span><div class="grow" style="min-width:0"><b class="ellipsis" style="display:block;font-family:var(--f-head)">' + esc(j ? j.mapel + (j.kelas ? ' (Kelas ' + j.kelas + ')' : '') : 'Absen di luar jadwal') + '</b><span class="small muted">' + esc(S.cek.tkb.nama) + ' • Jam: <span class="mono" id="jamNow">' + T.nowWib().jam + '</span> WIB</span></div>' + perk + '</div>' +
          '<div class="seg mt-12" id="segJenis"><button data-j="selfie" class="' + (S.jenis === 'selfie' ? 'on' : '') + '">' + ic('user', 17) + 'Selfie di Lokasi</button><button data-j="kegiatan" class="' + (S.jenis === 'kegiatan' ? 'on' : '') + '">' + ic('users', 17) + 'Kegiatan Mengajar</button></div>' +
          '<p class="xs muted center mt-8">Pilih jenis bukti dokumentasi kehadiran yang sesuai.</p>' +
          '<div class="cam mt-12" id="cam2" style="aspect-ratio:3/3.9"></div>' +
          '<div class="note note-p mt-12">' + ic('shield', 18) + '<div>Cap waktu server (Asia/Jakarta) dan lokasi GPS akan disematkan permanen ke arsip kehadiran.</div></div>' +
          '<div id="fotoInfo"></div><div id="fotoAct" class="mt-16"></div>';
        T.on($('#segJenis'), 'click', '[data-j]', function (e, b) { S.jenis = b.getAttribute('data-j'); S.facing = S.jenis === 'selfie' ? 'user' : 'environment'; T.$$('#segJenis button').forEach(function (x) { x.classList.toggle('on', x === b); }); if (!S.foto) kameraFoto(); else gambarAksi(); });
        S.facing = S.jenis === 'selfie' ? 'user' : 'environment';
        kameraFoto();
      }
      function stampLines() {
        const n = T.nowWib();
        return [S.cek.tkb.nama, T.tglIndo(n.tgl, { hari: true, pendek: true }) + ' • ' + n.detik + ' WIB', 'GPS: ' + S.pos.lat.toFixed(6) + ', ' + S.pos.lng.toFixed(6) + ' | ±' + S.pos.acc + 'm', (me.nip ? 'NIP: ' + me.nip + ' — ' : '') + (me.nama || '')];
      }
      async function kameraFoto() {
        stopKamera();
        const cam = $('#cam2'); if (!cam) return;
        const L = stampLines();
        cam.innerHTML = '<video playsinline muted id="vid" style="' + (S.facing === 'user' ? 'transform:scaleX(-1)' : '') + '"></video><div class="thirds"></div>' +
          (S.jenis === 'selfie' ? '<div class="face"><span>Posisikan Wajah</span></div>' : '') +
          '<div class="ov-top"><span class="glass"><span class="live-dot"></span>LIVE PREVIEW</span><button class="glass" id="btnFlip" aria-label="Ganti kamera">' + ic('switchCam', 18) + '</button></div>' +
          '<div class="stamp"><div class="row-b"><b>' + ic('mapPin', 14) + ' ' + esc(L[0]) + '</b><span class="chip chip-ok chip-sm" style="background:rgba(16,185,129,.2);color:#86EFAC;border-color:rgba(16,185,129,.4)">DALAM RADIUS</span></div><div id="stTime">' + esc(L[1]) + '</div><div>' + esc(L[2]) + '</div><div class="ellipsis">' + esc(L[3]) + '</div></div>';
        gambarAksi();
        $('#btnFlip').onclick = function () { S.facing = S.facing === 'user' ? 'environment' : 'user'; kameraFoto(); };
        try {
          S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: S.facing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
          if (S.step !== 3 || !S.alive) return stopKamera();
          const v = $('#vid'); v.srcObject = S.stream; await v.play();
          clearInterval(S.loop); S.loop = setInterval(function () { const t = $('#stTime'); if (t) t.textContent = stampLines()[1]; const jn = $('#jamNow'); if (jn) jn.textContent = T.nowWib().jam; }, 1000);
        } catch (e) {
          cam.innerHTML = '<div class="camerr">' + ic('camera', 34) + '<div><b style="color:#fff;font-family:var(--f-head)">Kamera langsung tidak tersedia</b><br>Gunakan kamera bawaan HP untuk mengambil foto.</div>' +
            '<label class="btn btn-primary btn-sm">' + ic('camera', 16) + 'Buka Kamera HP<input type="file" accept="image/*" capture="' + (S.jenis === 'selfie' ? 'user' : 'environment') + '" id="fotoFile" class="sr"></label></div>';
          $('#fotoFile').onchange = async function () { if (!this.files[0]) return; const img = await T.loadImg(await T.fileToDataUrl(this.files[0])); prosesFoto(img, false); };
          gambarAksi(true);
        }
      }
      function gambarAksi(tanpaLive) {
        const box = $('#fotoAct'); if (!box) return;
        if (S.foto) {
          $('#fotoInfo').innerHTML = '<div class="card card-pad mt-12 row-b" style="padding:12px 14px"><span class="row mono small">' + ic('checkCircle', 17) + ' Ukuran berkas: ' + Math.round(T.dataUrlBytes(S.foto) / 1024) + ' KB (JPEG)</span><span class="chip chip-p chip-sm">Siap kirim</span></div>';
          box.innerHTML = '<button class="btn btn-primary btn-block btn-lg" id="btnKirim">' + ic('send', 20) + ' Kirim Absensi Sekarang</button><button class="btn btn-outline btn-block mt-12" id="btnUlang">' + ic('rotate', 19) + ' Ambil Ulang Foto</button>';
          $('#btnKirim').onclick = kirim; $('#btnUlang').onclick = function () { S.foto = ''; $('#fotoInfo').innerHTML = ''; kameraFoto(); };
        } else {
          box.innerHTML = tanpaLive ? '' : '<button class="btn btn-primary btn-block btn-lg" id="btnJepret">' + ic('camera', 21) + ' Ambil Foto</button>';
          const j = $('#btnJepret'); if (j) j.onclick = function () { const v = $('#vid'); if (!v || v.readyState < 2) return T.toast('Kamera belum siap.', 'warn'); prosesFoto(v, S.facing === 'user'); };
        }
      }
      /** Gambar ke kanvas + cap (TKB, waktu, GPS, NIP) lalu kompres JPEG. */
      async function prosesFoto(src, mirror) {
        const w0 = src.videoWidth || src.naturalWidth, h0 = src.videoHeight || src.naturalHeight;
        const sc = Math.min(1, 1280 / Math.max(w0, h0)), W = Math.round(w0 * sc), H = Math.round(h0 * sc);
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
        x.drawImage(src, 0, 0, W, H); x.setTransform(1, 0, 0, 1, 0, 0);
        const L = stampLines(), fs = Math.max(13, Math.round(W / 42)), lh = fs * 1.45, pad = Math.round(fs * .9), bh = lh * 4 + pad * 2;
        const g = x.createLinearGradient(0, H - bh - 30, 0, H); g.addColorStop(0, 'rgba(2,6,23,0)'); g.addColorStop(.35, 'rgba(2,6,23,.65)'); g.addColorStop(1, 'rgba(2,6,23,.88)');
        x.fillStyle = g; x.fillRect(0, H - bh - 30, W, bh + 30);
        x.fillStyle = '#1A73E8'; x.fillRect(pad - 2, H - bh + pad - 4, 4, lh * 4);
        x.fillStyle = '#fff'; x.textBaseline = 'top';
        L.forEach(function (t, i) { x.font = (i === 0 ? '700 ' + Math.round(fs * 1.15) + 'px ' : '500 ' + fs + 'px ') + (i === 0 ? 'Plus Jakarta Sans, sans-serif' : 'JetBrains Mono, monospace'); x.fillText(t, pad + 10, H - bh + pad + i * lh); });
        S.foto = c.toDataURL('image/jpeg', .72);
        if (T.dataUrlBytes(S.foto) > 450000) S.foto = c.toDataURL('image/jpeg', .55);
        stopKamera();
        const cam = $('#cam2'); cam.innerHTML = '<img class="preview" src="' + S.foto + '" alt="Pratinjau foto bukti"><div class="ov-top"><span class="glass" style="color:#86EFAC">' + ic('checkCircle', 15) + 'FOTO DIAMBIL</span></div>';
        gambarAksi();
      }
      async function kirim() {
        const b = $('#btnKirim');
        const ua = navigator.userAgent, dev = (ua.match(/\(([^)]+)\)/) || [])[1] || ua;
        const r = await T.withBtn(b, function () { return T.api('absen.kirim', { kode: S.kode, lat: S.pos.lat, lng: S.pos.lng, acc: S.pos.acc, foto: S.foto, jenis_foto: S.jenis, perangkat: dev.slice(0, 100) }); });
        if (!r.success) {
          if (r.code === 'SUDAH_ABSEN') return sudahAbsen(r);
          if (r.code === 'LUAR_RADIUS' || r.code === 'AKURASI') { T.toast(r.message, 'err', 6000); return langkah2(); }
          if (r.code === 'QR_INVALID') { T.toast(r.message, 'err'); return langkah1(r.message); }
          return T.toast(r.message, 'err', 6000);
        }
        T.Cache.drop('guru.'); App._fotoTerakhir = { id: r.data.absen.id, url: S.foto };
        sukses(r.data);
      }

      // =============================== LANGKAH 4 =============================
      function sukses(d) {
        S.step = 4; setTop('Absensi Guru Pamong', 'Bukti Status Presensi');
        const a = d.absen, c = d.cocok || {}, j = c.jadwal, k = T.ABS_ST[a.status];
        el.innerHTML = '<div class="card card-pad-lg center" style="position:relative;overflow:hidden"><div class="big-check">' + ic('checkCircle', 42) + '</div><h2>Absen Berhasil Dicatat!</h2><p class="small muted mt-8">Presensi kedatangan Anda telah terverifikasi dan tersimpan di server.</p>' +
          '<div class="mt-12">' + (k === 'H' ? '<span class="chip chip-ok chip-lg"><span class="dot"></span>TEPAT WAKTU (SESUAI JADWAL)</span>' : k === 'T' ? '<span class="chip chip-warn chip-lg"><span class="dot"></span>TERLAMBAT ' + a.menit + ' MENIT</span>' : '<span class="chip chip-violet chip-lg"><span class="dot"></span>DI LUAR JADWAL — MENUNGGU VERIFIKASI</span>') + '</div></div>' +
          '<div class="card card-pad card-tint mt-12 row" style="align-items:flex-start;gap:12px">' + ic('shield', 22) + '<div><h4>Absensi Hari Ini Telah Terkunci</h4><p class="small muted mt-4">Anda sudah absen pukul <b class="mono">' + esc(a.jam) + ' WIB</b> di ' + esc(a.tkb) + '. Sistem mencegah absen ganda di hari yang sama.</p></div></div>' +
          '<div class="card card-pad mt-12"><div class="row-b"><h4 class="row">' + ic('fileCheck', 19) + 'Rincian Validasi Presensi</h4><span class="chip chip-slate chip-mono chip-sm">' + esc(a.id) + '</span></div><hr class="divider">' +
          '<div class="row-b"><div><div class="xs muted">Tanggal Presensi</div><b style="font-family:var(--f-head)">' + T.tglIndo(a.tanggal, { hari: true }) + '</b></div><div style="text-align:right"><div class="xs muted">Waktu Scan Server</div><b class="mono" style="color:var(--p)">' + esc(a.jam) + ' WIB</b></div></div>' +
          (j ? '<div class="card mt-12" style="padding:12px;box-shadow:none;background:var(--bg)"><div class="row-b"><span class="eyebrow">Mata Pelajaran &amp; Kelas</span>' + (c.batas ? '<span class="chip chip-slate chip-mono chip-sm">Batas ' + esc(c.batas) + ' WIB</span>' : '') + '</div><b class="mt-4" style="display:block;font:700 16px var(--f-head)">' + esc(j.mapel) + (j.kelas ? ' Kelas ' + esc(j.kelas) : '') + '</b><div class="small muted">Jadwal Sesi: ' + esc(j.mulai) + ' – ' + esc(j.selesai) + ' WIB</div></div>' : '') +
          '<div class="mt-12"><div class="xs muted">Lokasi Penugasan Guru</div><b class="row" style="font-family:var(--f-head)">' + ic('mapPin', 16) + esc(a.tkb) + '</b></div>' +
          '<div class="row-b mt-12" style="padding:10px 12px;border-radius:12px;border:1px solid var(--line)"><span class="mono xs">Koordinat GPS:<br>' + Number(a.lat).toFixed(6) + ', ' + Number(a.lng).toFixed(6) + '</span><span class="chip chip-ok chip-mono chip-sm">± ' + Math.round(a.jarak) + ' m (akurat ' + a.akurasi + 'm)</span></div>' +
          '<div class="xs muted mt-12 row">' + ic('camera', 14) + 'Bukti ' + (a.jenis_foto === 'kegiatan' ? 'Kegiatan Mengajar' : 'Selfie di Lokasi') + ' Terverifikasi:</div>' +
          '<div class="photo-box mt-8"><img src="' + S.foto + '" alt="Foto bukti"><div class="tag"><span></span><span class="chip chip-sm" style="background:rgba(2,6,23,.6);color:#fff;border-color:transparent">VERIFIED</span></div></div></div>' +
          '<a class="btn btn-primary btn-block btn-lg mt-16" href="#/beranda">' + ic('home', 19) + ' Kembali ke Beranda</a>' +
          '<div class="grid2 mt-12"><a class="btn btn-tonal" href="#/riwayat">' + ic('history', 18) + ' Lihat Riwayat</a><button class="btn btn-tonal" id="btnShare">' + ic('send', 18) + ' Bagikan Bukti</button></div>';
        $('#btnShare').onclick = function () {
          const txt = 'Bukti presensi ' + (me.nama || '') + ' — ' + T.tglIndo(a.tanggal, { hari: true }) + ' pukul ' + a.jam + ' WIB di ' + a.tkb + ' (' + (T.STATUS[k] || {}).t + '). ID: ' + a.id;
          if (navigator.share) navigator.share({ title: 'Bukti Presensi', text: txt }).catch(function () { }); else T.copyText(txt);
        };
      }

      langkah1();
      return function () { S.alive = false; stopKamera(); stopGps(); };
    } });
})();
