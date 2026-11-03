/* ==========================================================================
   TeachTrack — MODE DEMO (berdiri sendiri, tidak terhubung ke Google Sheets)
   site by Restu Putra Mulyana

   File ini menjalankan backend asli (demo/backend.txt) langsung di browser:
   - Sheets, Drive, Properties, dan Cache ditiru di memori lalu disimpan di
     localStorage browser ini.
   - Panggilan ke "demo-api" dicegat dan diteruskan ke backend tersebut.
   - Kamera dan GPS ditiru agar alur absen bisa dicoba dari komputer.
   Frontend (tampilan & logika) tidak diubah. Berkas ini dimuat paling awal.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'tt_demo_store_v1';
  var GPS_KEY = 'tt_demo_gps';
  var DEMO_SANDI = 'Demo12345';
  var realFetch = window.fetch.bind(window);
  var enc = new TextEncoder(), dec = new TextDecoder();

  // ------------------------------------------------------------------------
  //  1) Pembantu byte & base64 (byte = array bertanda, seperti Apps Script)
  // ------------------------------------------------------------------------
  function toSigned(u8) { return Array.from(u8, function (b) { return b > 127 ? b - 256 : b; }); }
  function fromSigned(arr) { return Uint8Array.from(arr, function (b) { return b < 0 ? b + 256 : b; }); }
  function bytesOf(x) {
    if (x instanceof Uint8Array) return x;
    if (Array.isArray(x)) return fromSigned(x);
    return enc.encode(String(x));
  }
  function b64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function rid(n) {
    var a = new Uint8Array(n); crypto.getRandomValues(a);
    return Array.from(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var h = rid(16); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32);
  }

  // ------------------------------------------------------------------------
  //  2) SHA-256 & HMAC sinkron (Apps Script memanggilnya tanpa await)
  // ------------------------------------------------------------------------
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256(u8) {
    var l = u8.length, total = ((l + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(total); m.set(u8); m[l] = 0x80;
    var dv = new DataView(m.buffer), bits = l * 8;
    dv.setUint32(total - 4, bits >>> 0); dv.setUint32(total - 8, Math.floor(bits / 4294967296));
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Uint32Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        var s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = new Uint8Array(32), od = new DataView(out.buffer);
    for (i = 0; i < 8; i++) od.setUint32(i * 4, H[i] >>> 0);
    return out;
  }
  function hmacSha256(keyU8, msgU8) {
    var k = keyU8.length > 64 ? sha256(keyU8) : keyU8;
    var kp = new Uint8Array(64); kp.set(k);
    var ip = new Uint8Array(64 + msgU8.length), op = new Uint8Array(96);
    for (var i = 0; i < 64; i++) { ip[i] = kp[i] ^ 0x36; op[i] = kp[i] ^ 0x5c; }
    ip.set(msgU8, 64);
    op.set(sha256(ip), 64);
    return sha256(op);
  }

  // ------------------------------------------------------------------------
  //  3) Layanan Apps Script yang ditiru (Sheets, Drive, Properties, dst.)
  // ------------------------------------------------------------------------
  function newStore() {
    return { props: {}, cache: {}, sheets: {}, drive: { files: {}, folders: {} }, triggers: [], logs: [], lockHeld: false };
  }
  function makeBlob(bytes, mime, name) {
    var u8 = bytesOf(bytes);
    var b = {
      _u8: u8, _mime: mime || 'application/octet-stream', _name: name || '',
      getBytes: function () { return toSigned(b._u8); },
      getDataAsString: function () { return dec.decode(b._u8); },
      getContentType: function () { return b._mime; },
      setName: function (n) { b._name = n; return b; },
      getName: function () { return b._name; },
      // Tanpa mesin PDF: hasilnya HTML laporan yang diberi penanda PDF. Dibuka sebagai halaman cetak.
      getAs: function (m) {
        var pre = enc.encode('%PDF-1.4\n'), o = new Uint8Array(pre.length + b._u8.length);
        o.set(pre); o.set(b._u8, pre.length);
        return makeBlob(o, m, b._name);
      }
    };
    return b;
  }
  function formatDate(d, tz, pat) {
    var off = tz === 'Asia/Jakarta' ? 7 : 0;
    var t = new Date(d.getTime() + off * 3600e3);
    var Y = t.getUTCFullYear(), M = t.getUTCMonth() + 1, D = t.getUTCDate(), h = t.getUTCHours(), m = t.getUTCMinutes(), s = t.getUTCSeconds();
    var dow = t.getUTCDay() === 0 ? 7 : t.getUTCDay();
    function p2(n) { return ('0' + n).slice(-2); }
    var out = '', i = 0;
    while (i < pat.length) {
      if (pat[i] === "'") { var j = pat.indexOf("'", i + 1); out += pat.slice(i + 1, j); i = j + 1; continue; }
      var tok = pat.slice(i).match(/^(yyyy|yy|MM|dd|HH|H|mm|ss|u)/);
      if (tok) {
        var k = tok[1], map = { yyyy: Y, yy: p2(Y % 100), MM: p2(M), dd: p2(D), HH: p2(h), H: h, mm: p2(m), ss: p2(s), u: dow };
        out += map[k]; i += k.length;
      } else { out += pat[i]; i++; }
    }
    return out;
  }

  function buatLayanan(store) {
    var Utilities = {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      formatDate: formatDate,
      getUuid: uuid,
      computeDigest: function (alg, s) { return toSigned(sha256(bytesOf(s))); },
      computeHmacSha256Signature: function (v, k) { return toSigned(hmacSha256(bytesOf(k), bytesOf(v))); },
      base64Encode: function (x) { return b64(bytesOf(x)); },
      base64EncodeWebSafe: function (x) { return b64(bytesOf(x)).replace(/\+/g, '-').replace(/\//g, '_'); },
      base64Decode: function (s) { return toSigned(unb64(s)); },
      base64DecodeWebSafe: function (s) { return toSigned(unb64(s.replace(/-/g, '+').replace(/_/g, '/'))); },
      newBlob: function (d, m, n) { return makeBlob(d, m, n); },
      sleep: function () { }
    };
    var props = {
      getProperties: function () { return Object.assign({}, store.props); },
      getProperty: function (k) { return k in store.props ? store.props[k] : null; },
      setProperty: function (k, v) { store.props[k] = String(v); return props; },
      setProperties: function (o) { Object.keys(o).forEach(function (k) { store.props[k] = String(o[k]); }); return props; },
      deleteProperty: function (k) { delete store.props[k]; return props; }
    };
    var cache = {
      get: function (k) { var e = store.cache[k]; if (!e || e.exp < Date.now()) return null; return e.v; },
      getAll: function (ks) { var o = {}; ks.forEach(function (k) { var v = cache.get(k); if (v != null) o[k] = v; }); return o; },
      put: function (k, v, ttl) { store.cache[k] = { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }; },
      putAll: function (o, ttl) { Object.keys(o).forEach(function (k) { cache.put(k, o[k], ttl); }); },
      remove: function (k) { delete store.cache[k]; },
      removeAll: function (ks) { ks.forEach(function (k) { delete store.cache[k]; }); }
    };
    var lock = {
      tryLock: function () { if (store.lockHeld) return false; store.lockHeld = true; return true; },
      waitLock: function () { store.lockHeld = true; },
      releaseLock: function () { store.lockHeld = false; }
    };
    function convert(v, fmt) {
      if (fmt === '@') return typeof v === 'number' ? String(v) : v;
      if (typeof v === 'string') {
        var t = v.trim();
        if (/^-?\d+(\.\d+)?$/.test(t) && t !== '' && !/^0\d/.test(t)) return Number(t);
        if (/^0\d+$/.test(t)) return Number(t);
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { var p = v.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2]) - 7 * 3600e3); }
      }
      return v;
    }
    function makeSheet(ss, name) {
      var S = store.sheets[ss.id][name] = store.sheets[ss.id][name] || { data: [], fmt: {} };
      var sheet = {
        getName: function () { return name; },
        getLastRow: function () { return S.data.length; },
        getLastColumn: function () { return S.data.reduce(function (m, r) { return Math.max(m, r.length); }, 0); },
        getMaxRows: function () { return Math.max(1000, S.data.length); },
        setFrozenRows: function () { return sheet; }, autoResizeColumns: function () { return sheet; },
        clear: function () { S.data = []; return sheet; },
        getDataRange: function () { return sheet.getRange(1, 1, Math.max(S.data.length, 1), Math.max(sheet.getLastColumn(), 1)); },
        appendRow: function (row) { S.data.push(row.map(function (v, i) { return convert(v, S.fmt[i + 1]); })); return sheet; },
        deleteRow: function (r) { S.data.splice(r - 1, 1); },
        deleteRows: function (r, n) { S.data.splice(r - 1, n); },
        insertRowsAfter: function () { return sheet; },
        getRange: function (r, c, nr, nc) {
          nr = nr || 1; nc = nc || 1;
          var rng = {
            getValues: function () {
              var out = [];
              for (var i = 0; i < nr; i++) {
                var row = [];
                for (var j = 0; j < nc; j++) { var v = (S.data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); }
                out.push(row);
              }
              return out;
            },
            setValues: function (vals) {
              if (vals.length !== nr || vals.some(function (v) { return v.length !== nc; })) throw new Error('Ukuran setValues tidak cocok');
              for (var i = 0; i < nr; i++) {
                if (!S.data[r - 1 + i]) S.data[r - 1 + i] = [];
                for (var j = 0; j < nc; j++) S.data[r - 1 + i][c - 1 + j] = convert(vals[i][j], S.fmt[c + j]);
              }
              for (i = 0; i < S.data.length; i++) if (!S.data[i]) S.data[i] = [];
              return rng;
            },
            setNumberFormat: function (f) { for (var j = 0; j < nc; j++) S.fmt[c + j] = f; return rng; },
            setFontWeight: function () { return rng; }, setBackground: function () { return rng; }, setFontColor: function () { return rng; }
          };
          return rng;
        }
      };
      return sheet;
    }
    function makeSS(id) {
      var ss = {
        id: id, getId: function () { return id; }, getUrl: function () { return '#demo-spreadsheet'; },
        getName: function () { return store.sheets[id].__meta.name; },
        getSheetByName: function (n) { return store.sheets[id][n] ? makeSheet(ss, n) : null; },
        insertSheet: function (n) { return makeSheet(ss, n); },
        getActiveSheet: function () { return makeSheet(ss, 'Sheet1'); },
        getSheets: function () { return Object.keys(store.sheets[id]).filter(function (k) { return k !== '__meta'; }).map(function (n) { return makeSheet(ss, n); }); },
        deleteSheet: function (s) { delete store.sheets[id][s.getName()]; },
        setSpreadsheetTimeZone: function () { }
      };
      return ss;
    }
    var SpreadsheetApp = {
      openById: function (id) { if (!store.sheets[id]) throw new Error('Spreadsheet tidak ditemukan'); return makeSS(id); },
      create: function (name) {
        var id = 'SS' + rid(12);
        store.sheets[id] = { __meta: { name: name } };
        makeSheet(makeSS(id), 'Sheet1');
        store.drive.files[id] = { id: id, name: name, blob: null, parent: null, trashed: false };
        return makeSS(id);
      }
    };
    function folderObj(id) {
      return {
        getId: function () { return id; }, getUrl: function () { return '#demo-folder'; },
        getName: function () { return store.drive.folders[id].name; },
        createFolder: function (n) { var nid = 'FD' + rid(8); store.drive.folders[nid] = { name: n, parent: id }; return folderObj(nid); },
        getFoldersByName: function (n) { return iterador(Object.keys(store.drive.folders).filter(function (k) { return store.drive.folders[k].parent === id && store.drive.folders[k].name === n; }), folderObj); },
        createFile: function (b) {
          var fid = 'FL' + rid(8);
          store.drive.files[fid] = { id: fid, name: b.getName(), blob: b, parent: id, trashed: false };
          return fileObj(fid);
        }
      };
    }
    function iterador(lista, bungkus) { var i = 0; return { hasNext: function () { return i < lista.length; }, next: function () { return bungkus(lista[i++]); } }; }
    function fileObj(id) {
      var f = store.drive.files[id]; if (!f) throw new Error('File tidak ditemukan');
      return {
        getId: function () { return id; }, getUrl: function () { return '#demo-file'; },
        getBlob: function () { return f.blob; },
        setTrashed: function (t) { f.trashed = t; },
        moveTo: function (fo) { f.parent = fo.getId(); },
        getName: function () { return f.name; }
      };
    }
    var DriveApp = {
      getFolderById: function (id) { if (!store.drive.folders[id]) throw new Error('Folder tidak ditemukan'); return folderObj(id); },
      getFileById: function (id) { return fileObj(id); },
      createFolder: function (n) { var id = 'FD' + rid(8); store.drive.folders[id] = { name: n, parent: 'root' }; return folderObj(id); },
      getFoldersByName: function (n) { return iterador(Object.keys(store.drive.folders).filter(function (k) { return store.drive.folders[k].parent === 'root' && store.drive.folders[k].name === n; }), folderObj); }
    };
    var HtmlService = {
      createHtmlOutput: function (h) { return { getBlob: function () { return makeBlob(h, 'text/html', 'x.html'); }, getContent: function () { return h; } }; }
    };
    var ContentService = {
      MimeType: { JSON: 'json' },
      createTextOutput: function (s) { return { setMimeType: function () { return this; }, getContent: function () { return s; } }; }
    };
    var ScriptApp = {
      getProjectTriggers: function () { return store.triggers.map(function (t) { return { getHandlerFunction: function () { return t; }, _n: t }; }); },
      deleteTrigger: function (t) { var i = store.triggers.indexOf(t._n); if (i >= 0) store.triggers.splice(i, 1); },
      newTrigger: function (fn) { var b = { timeBased: function () { return b; }, everyMinutes: function () { return b; }, create: function () { store.triggers.push(fn); } }; return b; }
    };
    // Tanpa internet: Login Google tidak tersedia di demo (token tidak bisa diverifikasi)
    var UrlFetchApp = { fetch: function () { return { getResponseCode: function () { return 404; }, getContentText: function () { return '{}'; } }; } };
    var Logger = { log: function (s) { store.logs.push(String(s)); if (store.logs.length > 200) store.logs.shift(); } };
    var console_ = { log: function () { }, error: function (s) { Logger.log('ERR ' + s); } };
    return {
      PropertiesService: { getScriptProperties: function () { return props; } },
      CacheService: { getScriptCache: function () { return cache; } },
      LockService: { getScriptLock: function () { return lock; } },
      Utilities: Utilities, SpreadsheetApp: SpreadsheetApp, DriveApp: DriveApp, HtmlService: HtmlService,
      ContentService: ContentService, ScriptApp: ScriptApp, UrlFetchApp: UrlFetchApp, Logger: Logger, console: console_
    };
  }

  // ------------------------------------------------------------------------
  //  4) Mesin: menjalankan backend asli dengan layanan di atas
  // ------------------------------------------------------------------------
  var Mesin = {
    src: '',
    store: newStore(),
    ctx: function () {
      var layanan = buatLayanan(this.store);
      var names = Object.keys(layanan);
      var fn = new Function(names.join(','), this.src + '\n;return { doPost: doPost, doGet: doGet, setupAppEnvironment: setupAppEnvironment, buatDataDemo: buatDataDemo, hapusDataDemo: hapusDataDemo, resetSandiDemo: resetSandiDemo };');
      return fn.apply(null, names.map(function (n) { return layanan[n]; }));
    },
    run: function (nama) { var r = this.ctx()[nama](); this.simpan(); return r; },
    post: function (isi) {
      var out;
      try { out = this.ctx().doPost({ postData: { contents: isi } }).getContent(); }
      catch (e) { out = JSON.stringify({ success: false, message: 'Demo: ' + e.message }); }
      this.simpan();
      return out;
    },
    get: function (params) {
      var out;
      try { out = this.ctx().doGet({ parameter: params || {} }).getContent(); }
      catch (e) { out = JSON.stringify({ success: false, message: 'Demo: ' + e.message }); }
      return out;
    },
    tabel: function (nama) {
      var id = this.store.props.SPREADSHEET_ID, S = id && this.store.sheets[id] && this.store.sheets[id][nama];
      if (!S || !S.data.length) return [];
      var h = S.data[0].map(String);
      return S.data.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
    },
    simpan: function () {
      try {
        var store = this.store;
        var files = {};
        Object.keys(store.drive.files).forEach(function (id) {
          var f = store.drive.files[id], bl = null;
          if (f.blob) {
            if (!f.blob._b64) f.blob._b64 = b64(f.blob._u8);
            bl = { m: f.blob._mime, n: f.blob._name, d: f.blob._b64 };
          }
          files[id] = { id: f.id, name: f.name, parent: f.parent, trashed: !!f.trashed, blob: bl };
        });
        var teks = JSON.stringify({ v: 1, props: store.props, sheets: store.sheets, folders: store.drive.folders, files: files, triggers: store.triggers.length }, function (k, v) {
          var asli = this[k];
          return asli instanceof Date ? { __d: asli.getTime() } : v;
        });
        localStorage.setItem(STORE_KEY, teks);
      } catch (e) { console.warn('Demo: gagal menyimpan (penyimpanan browser penuh?)', e); }
    },
    muat: function () {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (!raw) return false;
        var o = JSON.parse(raw, function (k, v) {
          return v && typeof v === 'object' && Object.keys(v).length === 1 && '__d' in v ? new Date(v.__d) : v;
        });
        var store = newStore();
        store.props = o.props || {}; store.sheets = o.sheets || {}; store.drive.folders = o.folders || {};
        Object.keys(o.files || {}).forEach(function (id) {
          var f = o.files[id];
          store.drive.files[id] = { id: f.id, name: f.name, parent: f.parent, trashed: f.trashed, blob: f.blob ? makeBlob(unb64(f.blob.d), f.blob.m, f.blob.n) : null };
        });
        this.store = store;
        return true;
      } catch (e) { return false; }
    }
  };

  // Siapkan data demo (dipakai pertama kali & saat reset)
  function siapkanData() {
    Mesin.store = newStore();
    Mesin.run('setupAppEnvironment');
    Mesin.run('buatDataDemo');
    // Nama penandatangan contoh (agar kop & tanda tangan laporan terisi di demo)
    var isi = { penandatangan_1_nama: 'Nama Kepala Sekolah (Demo)', penandatangan_2_nama: 'Nama Bendahara (Demo)', penandatangan_3_nama: 'Nama Pengelola (Demo)', kota_ttd: 'Tasikmalaya' };
    var id = Mesin.store.props.SPREADSHEET_ID, S = id && Mesin.store.sheets[id] && Mesin.store.sheets[id]['Pengaturan'];
    if (S) S.data.forEach(function (r) { if (Object.prototype.hasOwnProperty.call(isi, r[0])) r[1] = isi[r[0]]; });
    Mesin.store.cache = {};
    Mesin.simpan();
  }

  var siap = fetch('demo/backend.txt', { cache: 'no-cache' }).then(function (r) { return r.text(); }).then(function (src) {
    Mesin.src = src;
    if (!Mesin.muat()) siapkanData();
    return true;
  }).catch(function (e) {
    console.error('Mode demo gagal dimuat:', e);
    return false;
  });

  // ------------------------------------------------------------------------
  //  5) Cegat panggilan ke "demo-api" (pengganti URL Apps Script)
  // ------------------------------------------------------------------------
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var u;
    try { u = new URL(url, location.href); } catch (e) { return realFetch(input, init); }
    if (!/\/demo-api\/?$/.test(u.pathname)) return realFetch(input, init);
    return siap.then(function () {
      return new Promise(function (res) { setTimeout(res, 120); });   // jeda kecil seperti jaringan sungguhan
    }).then(function () {
      var isi = (init && init.method === 'POST') ? Mesin.post(String(init.body || '')) : Mesin.get(Object.fromEntries(u.searchParams));
      return new Response(isi, { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  };

  // ------------------------------------------------------------------------
  //  6) GPS palsu: posisi mengikuti pilihan di panel demo
  // ------------------------------------------------------------------------
  function posisiDemo() {
    var tkbs = Mesin.tabel('TKB');
    var pilih = localStorage.getItem(GPS_KEY) || (tkbs[0] && tkbs[0].id_tkb) || '';
    var t = tkbs.filter(function (x) { return x.id_tkb === pilih; })[0];
    var lat, lng;
    if (t) { lat = Number(t.latitude); lng = Number(t.longitude); }
    else { var pusat = Mesin.tabel('TKB')[0] || { latitude: -7.3497, longitude: 108.111 }; lat = Number(pusat.latitude) + 0.05; lng = Number(pusat.longitude) + 0.05; }
    return { coords: { latitude: lat, longitude: lng, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
  }
  var geoDemo = {
    getCurrentPosition: function (ok) { setTimeout(function () { ok(posisiDemo()); }, 300); },
    watchPosition: function (ok) { var id = Math.floor(Math.random() * 1e6); setTimeout(function () { ok(posisiDemo()); }, 300); return id; },
    clearWatch: function () { }
  };
  try { Object.defineProperty(navigator, 'geolocation', { value: geoDemo, configurable: true }); } catch (e) { }

  // ------------------------------------------------------------------------
  //  7) Kamera palsu: gambar ilustrasi bergerak dari canvas
  // ------------------------------------------------------------------------
  if (!navigator.mediaDevices) { try { Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true }); } catch (e) { } }
  navigator.mediaDevices.getUserMedia = function () {
    var cv = document.createElement('canvas'); cv.width = 640; cv.height = 480;
    var g = cv.getContext('2d'), t = 0;
    function gambar() {
      g.fillStyle = '#1f2937'; g.fillRect(0, 0, 640, 480);
      g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.fillText('KAMERA DEMO', 40, 64);
      g.font = '18px sans-serif'; g.fillText('Tidak ada kamera asli — foto ilustrasi untuk uji coba', 40, 100);
      g.fillStyle = '#34d399'; g.beginPath(); g.arc(320 + 160 * Math.cos(t / 15), 300 + 80 * Math.sin(t / 15), 26, 0, 7); g.fill();
      t++;
    }
    gambar();
    var id = setInterval(gambar, 200);
    var aliran = cv.captureStream(5);
    aliran.getTracks().forEach(function (tr) { var henti = tr.stop.bind(tr); tr.stop = function () { clearInterval(id); henti(); }; });
    return Promise.resolve(aliran);
  };

  // ------------------------------------------------------------------------
  //  8) PDF demo: dibuka sebagai halaman cetak (pilih "Simpan sebagai PDF")
  // ------------------------------------------------------------------------
  function bukaCetak(html) {
    var w = window.open('', '_blank');
    if (!w) { alert('Izinkan pop-up untuk situs ini, lalu coba lagi.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) { } }, 500);
  }
  function pasangPdf() {
    var TT = window.TT;
    if (!TT || TT.__demoPdf) return;
    var asli = TT.downloadDataUrl;
    TT.downloadDataUrl = function (dataUrl, nama) {
      if (/^data:application\/pdf;base64,/.test(dataUrl)) {
        var bytes = unb64(dataUrl.split(',')[1] || '');
        var html = dec.decode(bytes).replace(/^%PDF-1\.4\n/, '');
        TT.modal({
          title: 'Laporan siap dicetak',
          body: '<p class="small">Mode demo tidak membuat berkas PDF sungguhan. Buka laporan, lalu pilih <b>Simpan sebagai PDF</b> di dialog cetak.</p>',
          actions: [{ label: 'Tutup' }, { label: 'Buka & Cetak', cls: 'btn-primary', onClick: function () { bukaCetak(html); } }]
        });
        return;
      }
      return asli.apply(this, arguments);
    };
    TT.__demoPdf = true;
  }

  // ------------------------------------------------------------------------
  //  9) Panel demo (tombol mengambang di pojok kanan bawah)
  // ------------------------------------------------------------------------
  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pasangPanel() {
    var css = document.createElement('style');
    css.textContent =
      '#ttDemoBtn{position:fixed;left:12px;bottom:78px;z-index:90;background:#0f172a;color:#fff;border:0;border-radius:999px;padding:7px 12px;font:600 12px/1 Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.3);cursor:pointer}' +
      '@media (min-width:900px){#ttDemoBtn{left:auto;right:16px;bottom:16px}}' +
      '@media (min-width:900px){#ttDemoPanel{left:auto;right:16px;bottom:58px}}' +
      '#ttDemoPanel{position:fixed;left:12px;bottom:118px;z-index:90;width:min(340px,calc(100vw - 24px));max-height:72vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 18px 48px rgba(15,23,42,.3);padding:16px;font:14px/1.45 Inter,system-ui,sans-serif;display:none}' +
      '#ttDemoPanel.open{display:block}#ttDemoPanel h3{margin:0 0 4px;font:700 16px Inter,system-ui,sans-serif}' +
      '#ttDemoPanel .sub{font-size:12px;color:#475569;margin:0 0 12px}#ttDemoPanel table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:12px}' +
      '#ttDemoPanel td{padding:5px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top}#ttDemoPanel code{font:600 12px ui-monospace,Menlo,monospace;background:#f1f5f9;padding:2px 5px;border-radius:6px}' +
      '#ttDemoPanel label{display:block;font-size:12px;font-weight:600;margin:10px 0 4px}#ttDemoPanel select{width:100%;padding:8px;border-radius:10px;border:1px solid #cbd5e1;font:inherit}' +
      '#ttDemoPanel .row{display:flex;gap:8px;margin-top:12px}#ttDemoPanel button.b{flex:1;padding:9px 10px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font:600 13px Inter,system-ui,sans-serif;cursor:pointer}' +
      '#ttDemoPanel button.b.danger{border-color:#fecaca;color:#b91c1c}' +
      '#gFake{display:none!important}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'ttDemoBtn'; btn.type = 'button'; btn.textContent = 'Akun & data demo';
    var panel = document.createElement('div'); panel.id = 'ttDemoPanel';
    document.body.appendChild(panel); document.body.appendChild(btn);

    function isi() {
      var tkbs = Mesin.tabel('TKB');
      var sel = localStorage.getItem(GPS_KEY) || (tkbs[0] && tkbs[0].id_tkb) || '';
      var opsi = tkbs.map(function (t) {
        return '<option value="' + escHtml(t.id_tkb) + '"' + (t.id_tkb === sel ? ' selected' : '') + '>Di ' + escHtml(t.nama_tkb) + '</option>';
      }).join('') + '<option value="__jauh"' + (sel === '__jauh' ? ' selected' : '') + '>Jauh dari semua TKB</option>';
      var kode = tkbs.map(function (t) {
        return '<tr><td>' + escHtml(t.nama_tkb) + '</td><td><code>' + escHtml(t.token_qr) + '</code></td></tr>';
      }).join('');
      panel.innerHTML =
        '<h3>Mode demo</h3>' +
        '<p class="sub">Data dan akun ini hanya tersimpan di browser ini. Tidak terhubung ke Google Sheets maupun aplikasi asli.</p>' +
        '<table>' +
        '<tr><td><b>Admin</b></td><td><code>demo.admin</code> · <code>' + DEMO_SANDI + '</code></td></tr>' +
        '<tr><td><b>Guru</b></td><td><code>demo.guru</code> · <code>' + DEMO_SANDI + '</code><br><span style="color:#475569">Rina Kurniasih, Matematika</span></td></tr>' +
        '<tr><td><b>Guru lain</b></td><td><code>demo.guru2</code> s.d. <code>demo.guru10</code> · <code>' + DEMO_SANDI + '</code></td></tr>' +
        '</table>' +
        '<label for="ttDemoGps">Posisi GPS saya (untuk uji absen)</label>' +
        '<select id="ttDemoGps">' + opsi + '</select>' +
        '<label>Kode QR TKB (ketik manual di menu Scan)</label>' +
        '<table>' + kode + '</table>' +
        '<div class="row"><button class="b" type="button" id="ttDemoKeluar">Keluar akun</button>' +
        '<button class="b danger" type="button" id="ttDemoReset">Reset semua data</button></div>';
      document.getElementById('ttDemoGps').onchange = function (e) { localStorage.setItem(GPS_KEY, e.target.value); };
      document.getElementById('ttDemoKeluar').onclick = function () {
        if (window.App && App.logout) App.logout('Anda telah keluar dari mode demo.');
        panel.classList.remove('open');
      };
      document.getElementById('ttDemoReset').onclick = function () {
        if (!confirm('Hapus semua data demo dan membuatnya ulang? Sesi login di browser ini juga dihapus.')) return;
        try { localStorage.clear(); sessionStorage.clear(); } catch (e) { }
        location.reload();
      };
    }
    btn.onclick = function () {
      if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
      siap.then(function () { isi(); panel.classList.add('open'); });
    };
  }

  function mulai() {
    pasangPanel();
    siap.then(function (ok) {
      if (!ok) return;
      pasangPdf();
      var n = 0, t = setInterval(function () { pasangPdf(); if (window.TT && window.TT.__demoPdf || ++n > 100) clearInterval(t); }, 100);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();

  // Untuk uji otomatis & pemecahan masalah
  window.DemoTT = { mesin: Mesin, reset: function () { siapkanData(); return true; }, siap: siap };
})();
