/* ==========================================================================
   TeachTrack — core.js
   API (fetch → GAS REST), cache SWR, penggabung batch, tema dinamis,
   utilitas format, modal/toast, kompres gambar, pemuat pustaka malas.
   ========================================================================== */
(function () {
  'use strict';
  const VER = '1.1.0';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('tt_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tt_' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('tt_' + k); } catch (e) { } },
    clearData() { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('tt_c_') === 0) localStorage.removeItem(k); }); } catch (e) { } }
  };

  // ------------------------------------------------------------------------
  //  KONFIGURASI
  // ------------------------------------------------------------------------
  const CFG = window.APP_CONFIG || {};
  const GAS_URL = String(CFG.GAS_URL || '');
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(GAS_URL) && !/GANTI|XXXX/i.test(GAS_URL) || !!CFG.DEV_URL;
  const ENDPOINT = CFG.DEV_URL || GAS_URL;

  // ------------------------------------------------------------------------
  //  SESI
  // ------------------------------------------------------------------------
  const Sesi = {
    token: LS.get('tok', ''), me: LS.get('me', null),
    simpan(token, me) { this.token = token || ''; this.me = me || null; LS.set('tok', this.token); LS.set('me', this.me); },
    setMe(me) { this.me = me; LS.set('me', me); },
    hapus() { this.token = ''; this.me = null; LS.del('tok'); LS.del('me'); LS.del('pend'); LS.clearData(); }
  };

  // ------------------------------------------------------------------------
  //  API — POST text/plain (tanpa preflight CORS), token di body
  // ------------------------------------------------------------------------
  const READ = /^(app\.config|auth\.me|auth\.status|guru\.boot|guru\.riwayat|absen\.cek|admin\.|absensi\.list|persetujuan\.list|laporan\.rekap|pengaturan\.ambil|sistem\.status|log\.list|izin\.lampiran|foto\.ambil|impor\.pindai)/;
  const Perf = { log: [], table() { console.table(this.log.slice(-30)); }, summary() { const m = {}; this.log.forEach(function (x) { (m[x.aksi] = m[x.aksi] || []).push(x.total); }); const o = {}; Object.keys(m).forEach(function (k) { o[k] = { n: m[k].length, rata: Math.round(m[k].reduce(function (a, b) { return a + b; }, 0) / m[k].length) }; }); console.table(o); } };
  window.Perf = Perf;
  let writeEpoch = 0; const inflight = {};
  let onAuthLost = function () { };

  async function rawCall(action, data, tokenOverride) {
    if (!configured) return { success: false, code: 'CONFIG', message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js dengan URL /exec dari Apps Script.' };
    const t0 = performance.now();
    let res;
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: tokenOverride !== undefined ? tokenOverride : Sesi.token, data: data || {} })
      });
      const txt = await r.text();
      try { res = JSON.parse(txt); }
      catch (e) { res = { success: false, code: 'BAD', message: 'Server mengirim balasan tidak dikenal. Pastikan Web App di-deploy dengan akses "Anyone".' }; }
    } catch (e) {
      res = { success: false, code: 'NET', message: navigator.onLine === false ? 'Tidak ada koneksi internet. Periksa sinyal lalu coba lagi.' : 'Tidak dapat terhubung ke server. Coba lagi sebentar.' };
    }
    Perf.log.push({ aksi: action, total: Math.round(performance.now() - t0), server: res.ms || 0, ok: !!res.success });
    if (Perf.log.length > 200) Perf.log.shift();
    if (res && res.code === 'AUTH' && tokenOverride === undefined && Sesi.token) onAuthLost(res.message);
    return res;
  }
  /** Panggilan biasa. Aksi baca identik yang sedang berjalan akan menumpang (dedupe). */
  function api(action, data, opt) {
    opt = opt || {};
    if (!READ.test(action)) { writeEpoch++; return rawCall(action, data, opt.token); }
    const k = writeEpoch + '|' + action + '|' + Sesi.token.slice(-12) + '|' + JSON.stringify(data || {});
    if (inflight[k]) return inflight[k];
    const p = rawCall(action, data, opt.token);
    inflight[k] = p;
    p.finally(function () { delete inflight[k]; });
    return p;
  }
  /** Penggabung batch: aksi baca yang dipanggil di tik yang sama → 1 eksekusi server. */
  const Batcher = {
    q: null,
    add(action, data) {
      const self = this;
      return new Promise(function (res) {
        if (!self.q) { self.q = []; setTimeout(function () { self.flush(); }, 0); }
        self.q.push({ action: action, data: data || {}, res: res });
      });
    },
    async flush() {
      const q = this.q; this.q = null;
      const uniq = []; const map = {};
      q.forEach(function (x) { const k = x.action + JSON.stringify(x.data); if (!map[k]) { map[k] = []; uniq.push(x); } map[k].push(x.res); });
      if (uniq.length === 1) { const r = await api(uniq[0].action, uniq[0].data); map[uniq[0].action + JSON.stringify(uniq[0].data)].forEach(function (f) { f(r); }); return; }
      for (let i = 0; i < uniq.length; i += 10) {
        const part = uniq.slice(i, i + 10);
        const r = await rawCall('batch', { calls: part.map(function (x) { return { action: x.action, data: x.data }; }) });
        part.forEach(function (x, j) {
          const out = r.success ? r.data.results[j] : r;
          map[x.action + JSON.stringify(x.data)].forEach(function (f) { f(out); });
        });
      }
    }
  };
  function apiQ(action, data) { return READ.test(action) ? Batcher.add(action, data) : api(action, data); }

  // ------------------------------------------------------------------------
  //  CACHE SWR (localStorage) — tampil instan, segarkan di latar
  // ------------------------------------------------------------------------
  const Cache = {
    key(action, data) { return 'c_' + action + '_' + (data ? JSON.stringify(data) : ''); },
    peek(action, data) { const c = LS.get(this.key(action, data), null); return c ? c : null; },
    put(action, data, val) { LS.set(this.key(action, data), { at: Date.now(), d: val, h: hash(JSON.stringify(val)) }); },
    drop(prefix) { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('tt_c_' + (prefix || '')) === 0) localStorage.removeItem(k); }); } catch (e) { } },
    stale: {}
  };
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  /**
   * load(action, data, onData, { maxAge }) — panggil onData(data, {fromCache}) dari cache dulu
   * (bila ada), lalu dari server bila cache lebih tua dari maxAge atau ditandai basi.
   * Mengembalikan promise hasil server (atau cache bila masih segar).
   */
  let routeGen = 0;
  async function load(action, data, onData, opt) {
    opt = opt || {};
    const gen = routeGen;
    const c = Cache.peek(action, data);
    const k = Cache.key(action, data);
    if (c) onData(c.d, { fromCache: true });
    const segar = c && !Cache.stale[k] && (Date.now() - c.at) < (opt.maxAge === undefined ? 30000 : opt.maxAge);
    if (segar && !opt.force) return { success: true, data: c.d, cached: true };
    const r = await apiQ(action, opt.force ? Object.assign({}, data, { _fresh: true }) : data);
    if (r.success) {
      delete Cache.stale[k];
      const h = hash(JSON.stringify(r.data));
      Cache.put(action, data, r.data);
      if (gen !== routeGen) return r;          // halaman sudah berganti — jangan gambar ke DOM lama
      if (!c || c.h !== h) onData(r.data, { fromCache: false });
    } else if (gen !== routeGen) return r;
    else if (!c && opt.onError) opt.onError(r);
    else if (!c) onData(null, { error: r });
    return r;
  }
  function markStale(prefixes) { (prefixes || []).forEach(function (p) { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('tt_c_' + p) === 0) Cache.stale[k.slice(3)] = 1; }); } catch (e) { } }); }

  // ------------------------------------------------------------------------
  //  WARMUP — GET ?w= (mode no-cors), maks 1×/4 menit per lingkup
  // ------------------------------------------------------------------------
  function warmUp(scope) {
    if (!configured || CFG.DEV_URL) return;
    const k = 'warm_' + scope;
    try { const t = Number(sessionStorage.getItem(k) || 0); if (Date.now() - t < 240000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) { }
    fetch(ENDPOINT + '?w=' + scope, { mode: 'no-cors' }).catch(function () { });
  }

  // ------------------------------------------------------------------------
  //  TEMA — turunkan palet dari 1 warna utama + jaga kontras teks putih
  // ------------------------------------------------------------------------
  function hexToRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); const n = parseInt(h, 16); return isNaN(n) ? [26, 115, 232] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(r) { return '#' + r.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); }
  function lum(r) { const c = r.map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function contrast(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
  function palette(hex) {
    let base = hexToRgb(hex); let guard = 0;
    while (contrast(base, [255, 255, 255]) < 4.2 && guard++ < 20) base = mix(base, [0, 0, 0], .08);   // teks putih tetap terbaca
    return { p: rgbToHex(base), p600: rgbToHex(mix(base, [0, 0, 0], .18)), p700: rgbToHex(mix(base, [0, 0, 0], .32)),
      p50: rgbToHex(mix(base, [255, 255, 255], .9)), p100: rgbToHex(mix(base, [255, 255, 255], .8)), rgb: base.map(Math.round).join(', ') };
  }
  function applyTheme(hex) {
    const pl = palette(hex || '#1A73E8'), s = document.documentElement.style;
    s.setProperty('--p', pl.p); s.setProperty('--p-600', pl.p600); s.setProperty('--p-700', pl.p700);
    s.setProperty('--p-50', pl.p50); s.setProperty('--p-100', pl.p100); s.setProperty('--p-rgb', pl.rgb);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', pl.p);
    return pl;
  }
  const Setelan = {
    v: LS.get('set', null) || { nama_aplikasi: 'TeachTrack', subjudul: 'Absensi Guru Pamong SMA Terbuka', nama_sekolah_induk: 'SMA PGRI', wilayah: 'SMA Terbuka', warna_utama: '#1A73E8', logo_thumb: '', tarif_per_kehadiran: '50000', radius_gps_meter: '50', toleransi_terlambat_menit: '15', akurasi_maks_meter: '100', kontak_admin_wa: '' },
    terapkan(s) {
      if (s) { this.v = Object.assign({}, this.v, s); LS.set('set', this.v); }
      applyTheme(this.v.warna_utama);
      document.title = this.v.nama_aplikasi + ' — ' + (this.v.subjudul || 'Absensi Guru Pamong');
      const fav = document.getElementById('favicon');
      if (fav) fav.href = this.v.logo_thumb || fav.getAttribute('data-default');
    }
  };

  // ------------------------------------------------------------------------
  //  FORMAT & UTILITAS
  // ------------------------------------------------------------------------
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return ('0' + n).slice(-2); }
  /** Tanggal hari ini menurut WIB (Asia/Jakarta), bukan zona perangkat. */
  function nowWib() { const d = new Date(Date.now() + 7 * 3600e3); return { tgl: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), jam: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()), detik: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()), h: d.getUTCHours(), hari: HARI[d.getUTCDay()] }; }
  function parseTgl(t) { const p = String(t || '').split('-'); return p.length === 3 ? new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])) : null; }
  function tglIndo(t, opt) { const d = parseTgl(t); if (!d) return t || '-'; opt = opt || {}; const s = d.getUTCDate() + ' ' + (opt.pendek ? BLN3 : BULAN)[d.getUTCMonth()] + (opt.tanpaTahun ? '' : ' ' + d.getUTCFullYear()); return opt.hari ? HARI[d.getUTCDay()] + ', ' + s : s; }
  function hariOf(t) { const d = parseTgl(t); return d ? HARI[d.getUTCDay()] : ''; }
  function addDays(t, n) { const d = parseTgl(t); d.setUTCDate(d.getUTCDate() + n); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  /** "Minggu ke" dalam bulan (1–5) & kecocokan jadwal bergilir (kosong = setiap minggu). */
  function mingguKe(t) { return Math.ceil(Number(String(t).slice(8, 10)) / 7); }
  const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V'];
  function cocokMinggu(j, t) { const mk = String(j.minggu_ke || '').split(',').filter(Boolean); return !mk.length || mk.indexOf(ROMAWI[mingguKe(t)]) >= 0; }
  function bulanLabel(ym) { const p = String(ym).split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; }
  function addMonths(ym, n) { const p = ym.split('-'); const d = new Date(Date.UTC(+p[0], +p[1] - 1 + n, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); }
  function akhirBulan(ym) { return addDays(addMonths(ym, 1) + '-01', -1); }
  function rupiah(n) { return 'Rp ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function angka(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function menit(j) { const m = String(j || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; }
  function jam5(j) { return String(j || '').slice(0, 5); }
  function inisial(nama) { const w = String(nama || '?').replace(/[,.].*$/, '').replace(/^(drs?|dr|ir|hj?|prof)\.?\s+/i, '').trim().split(/\s+/); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
  const AV_COL = ['#1A73E8', '#0D9488', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#4F46E5', '#0284C7', '#B45309', '#475569'];
  function avColor(s) { return AV_COL[Math.abs(hash(String(s || ''))) % AV_COL.length]; }
  function avatar(nama, cls) { return '<span class="av ' + (cls || '') + '" style="background:' + avColor(nama) + '" aria-hidden="true">' + esc(inisial(nama)) + '</span>'; }
  function salam() { const h = nowWib().h; return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }
  function waLink(hp, pesan) { let n = String(hp || '').replace(/\D/g, ''); if (!n) return ''; if (n[0] === '0') n = '62' + n.slice(1); return 'https://wa.me/' + n + (pesan ? '?text=' + encodeURIComponent(pesan) : ''); }
  function debounce(fn, ms) { let t; return function () { const a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function on(root, ev, sel, fn) { root.addEventListener(ev, function (e) { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); }); }

  // Label & chip status
  const STATUS = {
    H: { t: 'Tepat Waktu', c: 'chip-ok' }, T: { t: 'Terlambat', c: 'chip-warn' }, L: { t: 'Di Luar Jadwal', c: 'chip-violet' },
    I: { t: 'Izin', c: 'chip-p' }, S: { t: 'Sakit', c: 'chip-slate' }, A: { t: 'Alpa', c: 'chip-err' }, B: { t: 'Belum Absen', c: 'chip-err' }, '-': { t: 'Libur', c: 'chip-slate' }
  };
  const ABS_ST = { tepat_waktu: 'H', terlambat: 'T', di_luar_jadwal: 'L' };
  function chipStatus(kode, extra) { const s = STATUS[kode] || STATUS['-']; return '<span class="chip ' + s.c + '"><span class="dot"></span>' + s.t + (extra ? ' ' + esc(extra) : '') + '</span>'; }
  function chipAbsen(a) { if (!a) return ''; const k = ABS_ST[a.status] || 'H'; return chipStatus(k, k === 'T' && a.menit ? '+' + a.menit + 'm' : ''); }
  const JENIS_IZIN = { izin: 'Izin Kepentingan', sakit: 'Sakit', dinas: 'Tugas Dinas Luar', lainnya: 'Lainnya' };
  const IZIN_ST = { menunggu: 'chip-warn', disetujui: 'chip-ok', ditolak: 'chip-err', dibatalkan: 'chip-slate' };
  function chipIzin(st) { return '<span class="chip chip-sm ' + (IZIN_ST[st] || 'chip-slate') + '">' + esc(String(st || '').toUpperCase()) + '</span>'; }

  // ------------------------------------------------------------------------
  //  TOAST & MODAL
  // ------------------------------------------------------------------------
  function toast(msg, type, ms) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); type = type || 'ok';
    const icon = { ok: 'checkCircle', err: 'alertCircle', warn: 'alert', info: 'info' }[type] || 'info';
    t.className = 'toast ' + type; t.innerHTML = ic(icon, 18) + '<div>' + esc(msg) + '</div>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || (type === 'err' ? 5200 : 3200));
  }
  /**
   * modal({ title, sub, body, wide, actions:[{label, cls, onClick(close, root) → false utk tetap terbuka}], dismiss })
   * Mengembalikan { root, close, body }.
   */
  function modal(o) {
    const root = document.createElement('div'); root.className = 'mod-root';
    root.innerHTML = '<div class="mod ' + (o.wide ? (o.wide === 'x' ? 'xwide' : 'wide') : '') + '" role="dialog" aria-modal="true">' +
      '<div class="mod-hd"><div class="grow"><h3>' + esc(o.title || '') + '</h3>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + '</div>' +
      (o.dismiss === false ? '' : '<button class="icon-btn" data-x aria-label="Tutup" style="margin:-8px -10px 0 0">' + ic('x', 20) + '</button>') + '</div>' +
      '<div class="mod-bd"></div>' + (o.actions && o.actions.length ? '<div class="mod-ft"></div>' : '') + '</div>';
    const bd = $('.mod-bd', root);
    if (typeof o.body === 'string') bd.innerHTML = o.body; else if (o.body) bd.appendChild(o.body);
    let closed = false;
    function close(v) { if (closed) return; closed = true; root.style.opacity = '0'; root.style.transition = 'opacity .15s'; setTimeout(function () { root.remove(); }, 150); document.removeEventListener('keydown', esc_); if (o.onClose) o.onClose(v); }
    function esc_(e) { if (e.key === 'Escape' && o.dismiss !== false) close(); }
    document.addEventListener('keydown', esc_);
    if (o.dismiss !== false) { root.addEventListener('click', function (e) { if (e.target === root) close(); }); }
    const x = $('[data-x]', root); if (x) x.onclick = function () { close(); };
    const ft = $('.mod-ft', root);
    (o.actions || []).forEach(function (a) {
      const b = document.createElement('button'); b.className = 'btn ' + (a.cls || 'btn-outline'); b.innerHTML = a.label; b.type = 'button';
      b.onclick = async function () {
        if (!a.onClick) return close();
        b.classList.add('is-loading');
        try { const r = await a.onClick(close, root, b); if (r !== false) close(r); }
        finally { b.classList.remove('is-loading'); }
      };
      ft.appendChild(b);
    });
    document.body.appendChild(root);
    setTimeout(function () { const f = $('input:not([type=hidden]):not([readonly]), textarea, select', bd); if (f && window.innerWidth > 640 && o.autofocus !== false) f.focus(); }, 60);
    return { root: root, close: close, body: bd };
  }
  function confirmDlg(o) {
    return new Promise(function (res) {
      modal({ title: o.title, sub: o.sub, body: o.body || '', onClose: function (v) { res(v === true); },
        actions: [{ label: o.batal || 'Batal', cls: 'btn-outline', onClick: function () { return undefined; } },
          { label: o.ok || 'Ya, lanjutkan', cls: o.danger ? 'btn-danger' : 'btn-primary', onClick: function () { return true; } }] });
    });
  }
  /** Minta teks alasan (wajib). */
  function promptDlg(o) {
    return new Promise(function (res) {
      const id = 'p' + Date.now();
      modal({ title: o.title, sub: o.sub, onClose: function (v) { res(typeof v === 'string' ? v : null); },
        body: '<div class="field"><label class="label" for="' + id + '">' + esc(o.label || 'Alasan') + (o.wajib === false ? '' : ' <span class="req">*</span>') + '</label><textarea class="textarea" id="' + id + '" maxlength="300" placeholder="' + esc(o.placeholder || '') + '">' + esc(o.nilai || '') + '</textarea>' + (o.help ? '<div class="help">' + esc(o.help) + '</div>' : '') + '</div>',
        actions: [{ label: 'Batal', cls: 'btn-outline' }, { label: o.ok || 'Simpan', cls: o.danger ? 'btn-danger' : 'btn-primary', onClick: function (close, root) {
          const v = $('#' + id, root).value.trim();
          if (o.wajib !== false && v.length < (o.min || 5)) { toast('Isi ' + (o.label || 'alasan').toLowerCase() + ' minimal ' + (o.min || 5) + ' karakter.', 'warn'); return false; }
          return v;
        } }] });
    });
  }
  async function withBtn(btn, fn) { if (btn) btn.classList.add('is-loading'); try { return await fn(); } finally { if (btn) btn.classList.remove('is-loading'); } }

  // ------------------------------------------------------------------------
  //  BERKAS & GAMBAR
  // ------------------------------------------------------------------------
  function fileToDataUrl(file) { return new Promise(function (res, rej) { const r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); }); }
  function loadImg(src) { return new Promise(function (res, rej) { const i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  /** Kompres gambar → dataURL JPEG (maks dimensi, kualitas). */
  async function compressImage(src, maxDim, q, mime) {
    const img = typeof src === 'string' ? await loadImg(src) : src;
    const w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height;
    const s = Math.min(1, (maxDim || 1280) / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(mime || 'image/jpeg', q || .72);
  }
  function dataUrlBytes(d) { const b = String(d).split(',')[1] || ''; return Math.round(b.length * 3 / 4); }
  function downloadDataUrl(dataUrl, nama) { const a = document.createElement('a'); a.href = dataUrl; a.download = nama; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 100); }
  function downloadText(text, nama, mime) { const b = new Blob(['﻿' + text], { type: mime || 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(b); downloadDataUrl(u, nama); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); }
  function toCsv(rows) { return rows.map(function (r) { return r.map(function (v) { v = v === null || v === undefined ? '' : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n'); }
  /** Parser CSV sederhana (koma/titik koma, tanda kutip). */
  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.join('').trim() !== ''; });
  }
  async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Disalin ke papan klip.', 'ok'); } catch (e) { toast('Gagal menyalin. Salin manual.', 'warn'); } }

  // ------------------------------------------------------------------------
  //  PEMUAT PUSTAKA MALAS (hanya saat dibutuhkan)
  // ------------------------------------------------------------------------
  const _loaded = {};
  function loadScript(url) {
    if (_loaded[url]) return _loaded[url];
    _loaded[url] = new Promise(function (res, rej) { const s = document.createElement('script'); s.src = url; s.async = true; s.onload = res; s.onerror = function () { delete _loaded[url]; rej(new Error('Gagal memuat ' + url)); }; document.head.appendChild(s); });
    return _loaded[url];
  }
  function loadCss(url) { if (_loaded[url]) return _loaded[url]; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l); _loaded[url] = Promise.resolve(); return _loaded[url]; }
  const LIB = {
    qrScan: 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    qrGen: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    leafletJs: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    leafletCss: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    gis: 'https://accounts.google.com/gsi/client'
  };
  /** SVG QR untuk teks tertentu (qrcode-generator). */
  async function qrSvg(text) {
    await loadScript(LIB.qrGen);
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag(8, 0);
  }

  // ------------------------------------------------------------------------
  //  GEO
  // ------------------------------------------------------------------------
  function haversine(a, b, c, d) { const R = 6371000, r = Math.PI / 180; const x = (c - a) * r, y = (d - b) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
  /** Ambil posisi terbaik dalam beberapa detik (memantau sampai akurasi cukup). */
  function getPosisi(opt) {
    opt = opt || {};
    return new Promise(function (res, rej) {
      if (!('geolocation' in navigator)) return rej({ code: 'NOGEO', message: 'Perangkat tidak mendukung GPS.' });
      let best = null, done = false, wid = null;
      const selesai = function (err) {
        if (done) return; done = true; if (wid !== null) navigator.geolocation.clearWatch(wid); clearTimeout(tm);
        if (best) res(best); else rej(err || { code: 'TIMEOUT', message: 'Lokasi belum didapat. Pastikan GPS aktif dan coba di area terbuka.' });
      };
      const tm = setTimeout(function () { selesai(); }, opt.timeout || 12000);
      wid = navigator.geolocation.watchPosition(function (p) {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        if (!best || c.acc < best.acc) best = c;
        if (opt.onUpdate) opt.onUpdate(best);
        if (best.acc <= (opt.target || 20)) selesai();
      }, function (e) {
        const m = e.code === 1 ? { code: 'DENIED', message: 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser.' } : { code: 'UNAVAIL', message: 'GPS tidak aktif atau sinyal lemah. Aktifkan lokasi (mode akurasi tinggi) lalu coba lagi.' };
        if (!best) selesai(m);
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: opt.timeout || 12000 });
    });
  }

  // ------------------------------------------------------------------------
  //  EKSPOR
  // ------------------------------------------------------------------------
  window.TT = {
    VER: VER, LS: LS, CFG: CFG, configured: configured, Sesi: Sesi, api: api, apiQ: apiQ, load: load, Cache: Cache, markStale: markStale,
    warmUp: warmUp, newGen: function () { return ++routeGen; }, setAuthLost: function (f) { onAuthLost = f; }, Set: Setelan, palette: palette, applyTheme: applyTheme, contrast: contrast, hexToRgb: hexToRgb,
    HARI: HARI, BULAN: BULAN, BLN3: BLN3, esc: esc, pad: pad, nowWib: nowWib, parseTgl: parseTgl, tglIndo: tglIndo, hariOf: hariOf, addDays: addDays,
    bulanLabel: bulanLabel, mingguKe: mingguKe, cocokMinggu: cocokMinggu, ROMAWI: ROMAWI, addMonths: addMonths, akhirBulan: akhirBulan, rupiah: rupiah, angka: angka, menit: menit, jam5: jam5, inisial: inisial, avColor: avColor, avatar: avatar,
    salam: salam, waLink: waLink, debounce: debounce, $: $, $$: $$, on: on, STATUS: STATUS, ABS_ST: ABS_ST, chipStatus: chipStatus, chipAbsen: chipAbsen,
    JENIS_IZIN: JENIS_IZIN, chipIzin: chipIzin, toast: toast, modal: modal, confirm: confirmDlg, prompt: promptDlg, withBtn: withBtn,
    fileToDataUrl: fileToDataUrl, loadImg: loadImg, compressImage: compressImage, dataUrlBytes: dataUrlBytes, downloadDataUrl: downloadDataUrl, downloadText: downloadText,
    toCsv: toCsv, parseCsv: parseCsv, copyText: copyText, loadScript: loadScript, loadCss: loadCss, LIB: LIB, qrSvg: qrSvg, haversine: haversine, getPosisi: getPosisi, hash: hash
  };
})();
