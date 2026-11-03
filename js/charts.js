/* ==========================================================================
   TeachTrack — charts.js
   Grafik SVG ringan tanpa pustaka luar (cepat di HP & sinyal lemah):
   line/area, donut, batang vertikal (grup), batang horizontal,
   dan "radar" geofence (posisi guru vs radius TKB).
   ========================================================================== */
(function () {
  'use strict';
  const esc = TT.esc;
  const C = { p: 'var(--p)', ok: '#10B981', warn: '#F59E0B', err: '#EF4444', violet: '#7C3AED', slate: '#94A3B8', teal: '#0D9488', sky: '#0EA5E9' };

  function niceMax(v) { if (v <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function attachTip(el, items) {
    const tip = document.createElement('div'); tip.className = 'tip hidden'; el.appendChild(tip);
    el.querySelectorAll('[data-i]').forEach(function (n) {
      const show = function () {
        const it = items[+n.getAttribute('data-i')]; if (!it) return;
        tip.innerHTML = it.html; tip.classList.remove('hidden');
        const box = el.getBoundingClientRect(), r = n.getBoundingClientRect();
        let x = r.left + r.width / 2 - box.left; x = Math.max(70, Math.min(box.width - 70, x));
        tip.style.left = x + 'px'; tip.style.top = (r.top - box.top) + 'px';
      };
      n.addEventListener('mouseenter', show); n.addEventListener('focus', show); n.addEventListener('click', show);
      n.addEventListener('mouseleave', function () { tip.classList.add('hidden'); }); n.addEventListener('blur', function () { tip.classList.add('hidden'); });
    });
  }

  /**
   * line(el, { labels[], series:[{name, color, values[], area, dash}], height, yLabel })
   */
  function line(el, o) {
    const W = 640, H = o.height || 240, L = 34, R = 10, T = 14, B = 28;
    const n = o.labels.length; if (!n) { el.innerHTML = '<div class="empty small">Belum ada data.</div>'; return; }
    const max = niceMax(Math.max.apply(null, o.series.reduce(function (a, s) { return a.concat(s.values); }, [1])));
    const x = function (i) { return L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); };
    const y = function (v) { return T + (H - T - B) * (1 - v / max); };
    let g = '';
    for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#EEF2F7"/><text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="#94A3B8" font-family="var(--f-mono)">' + Math.round(v) + '</text>'; }
    const step = Math.max(1, Math.ceil(n / 7));
    o.labels.forEach(function (lb, i) { if (i % step === 0 || i === n - 1) g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="' + (i === n - 1 ? 'var(--p)' : '#94A3B8') + '" font-weight="' + (i === n - 1 ? 700 : 400) + '">' + esc(lb) + '</text>'; });
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    o.series.forEach(function (s, si) {
      const pts = s.values.map(function (v, i) { return [x(i), y(v)]; });
      let d = '';
      pts.forEach(function (p, i) {
        if (!i) { d += 'M' + p[0] + ',' + p[1]; return; }
        const p0 = pts[i - 1], cx = (p0[0] + p[0]) / 2;
        d += ' C' + cx + ',' + p0[1] + ' ' + cx + ',' + p[1] + ' ' + p[0] + ',' + p[1];
      });
      if (s.area) g += '<defs><linearGradient id="' + gid + si + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".22"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient></defs><path d="' + d + ' L' + x(n - 1) + ',' + y(0) + ' L' + x(0) + ',' + y(0) + 'Z" fill="url(#' + gid + si + ')"/>';
      g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.dash ? 2 : 2.6) + '" ' + (s.dash ? 'stroke-dasharray="6 5"' : '') + ' stroke-linecap="round"/>';
      if (!s.dash) pts.forEach(function (p, i) { if (i % step === 0 || i === n - 1) g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === n - 1 ? 5 : 3.5) + '" fill="#fff" stroke="' + s.color + '" stroke-width="2.2"/>'; });
    });
    // area hover per indeks
    const items = [];
    o.labels.forEach(function (lb, i) {
      const w = (W - L - R) / Math.max(1, n - 1);
      g += '<rect data-i="' + i + '" tabindex="-1" x="' + (x(i) - w / 2) + '" y="' + T + '" width="' + w + '" height="' + (H - T - B) + '" fill="transparent" style="cursor:pointer"/>';
      items.push({ html: '<b>' + esc(o.tipLabels ? o.tipLabels[i] : lb) + '</b><br>' + o.series.map(function (s) { return '<span style="color:' + (s.color.indexOf('var') === 0 ? '#93C5FD' : s.color) + '">●</span> ' + esc(s.name) + ': ' + s.values[i]; }).join('<br>') });
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Grafik garis') + '">' + g + '</svg>';
    attachTip(el, items);
  }

  /** donut(el, { items:[{label, value, color}], center, sub }) */
  function donut(el, o) {
    const tot = o.items.reduce(function (a, b) { return a + b.value; }, 0);
    const S = 200, r = 78, w = 26, cx = S / 2, cy = S / 2, circ = 2 * Math.PI * r;
    let off = 0, arcs = '';
    if (!tot) arcs = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EEF2F7" stroke-width="' + w + '"/>';
    o.items.forEach(function (it, i) {
      if (!it.value) return;
      const len = circ * it.value / tot, gap = o.items.filter(function (x) { return x.value; }).length > 1 ? 2.5 : 0;
      arcs += '<circle data-i="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + it.color + '" stroke-width="' + w + '" stroke-dasharray="' + Math.max(0, len - gap) + ' ' + (circ - Math.max(0, len - gap)) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" style="cursor:pointer"/>';
      off += len;
    });
    const center = '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="30" font-weight="700" font-family="var(--f-head)" fill="#0F172A">' + esc(o.center !== undefined ? o.center : tot) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="' + (o.subColor || '#10B981') + '" letter-spacing="1">' + esc(o.sub || '') + '</text>' +
      (o.sub2 ? '<text x="' + cx + '" y="' + (cy + 37) + '" text-anchor="middle" font-size="11" fill="#64748B">' + esc(o.sub2) + '</text>' : '');
    el.innerHTML = '<div class="donut-wrap"><div class="chart" style="max-width:220px"><svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + esc(o.aria || 'Komposisi') + '">' + arcs + center + '</svg></div>' +
      '<div class="dleg">' + o.items.map(function (it) { return '<div><i style="background:' + it.color + '"></i><span>' + esc(it.label) + '</span><b>' + (tot ? Math.round(it.value / tot * 100) : 0) + '%</b><span class="m">(' + it.value + ')</span></div>'; }).join('') + '</div></div>';
    attachTip(el.querySelector('.chart'), o.items.map(function (it) { return { html: '<b>' + esc(it.label) + '</b><br>' + it.value + ' (' + (tot ? Math.round(it.value / tot * 100) : 0) + '%)' }; }));
  }

  /** bars(el, { labels[], series:[{name,color,values[]}], height, stacked }) — batang vertikal */
  function bars(el, o) {
    const W = 640, H = o.height || 230, L = 34, R = 8, T = 12, B = 30, n = o.labels.length;
    if (!n) { el.innerHTML = '<div class="empty small">Belum ada data pada periode ini.</div>'; return; }
    const tots = o.labels.map(function (_, i) { return o.stacked ? o.series.reduce(function (a, s) { return a + (s.values[i] || 0); }, 0) : Math.max.apply(null, o.series.map(function (s) { return s.values[i] || 0; })); });
    const max = niceMax(Math.max.apply(null, tots.concat([1])));
    const y = function (v) { return T + (H - T - B) * (1 - v / max); };
    const band = (W - L - R) / n, bw = Math.min(46, band * .62), sub = o.stacked ? bw : bw / o.series.length;
    let g = '';
    for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#EEF2F7"/><text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="#94A3B8" font-family="var(--f-mono)">' + Math.round(v) + '</text>'; }
    const items = [];
    o.labels.forEach(function (lb, i) {
      const x0 = L + band * i + (band - bw) / 2; let acc = 0;
      o.series.forEach(function (s, si) {
        const v = s.values[i] || 0; if (!v && o.stacked) return;
        const top = o.stacked ? y(acc + v) : y(v), bot = o.stacked ? y(acc) : y(0);
        const xx = o.stacked ? x0 : x0 + sub * si;
        g += '<rect x="' + xx + '" y="' + top + '" width="' + Math.max(2, sub - (o.stacked ? 0 : 3)) + '" height="' + Math.max(0, bot - top) + '" rx="' + (o.stacked ? 2 : 5) + '" fill="' + s.color + '"/>';
        acc += v;
      });
      g += '<text x="' + (L + band * i + band / 2) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11" fill="#64748B">' + esc(String(lb).length > 12 ? String(lb).slice(0, 11) + '…' : lb) + '</text>';
      g += '<rect data-i="' + i + '" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '" fill="transparent" style="cursor:pointer"/>';
      items.push({ html: '<b>' + esc(o.tipLabels ? o.tipLabels[i] : lb) + '</b><br>' + o.series.map(function (s) { return '<span style="color:' + (String(s.color).indexOf('var') === 0 ? '#93C5FD' : s.color) + '">●</span> ' + esc(s.name) + ': ' + (s.values[i] || 0); }).join('<br>') });
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Grafik batang') + '">' + g + '</svg>';
    attachTip(el, items);
  }

  /** hbars(el, { items:[{label, value, sub}], color, unit }) — batang horizontal (HTML, mudah dibaca di HP) */
  function hbars(el, o) {
    if (!o.items.length) { el.innerHTML = '<div class="empty small"><b>Tidak ada data</b>' + esc(o.kosong || '') + '</div>'; return; }
    const max = Math.max.apply(null, o.items.map(function (x) { return x.value; }).concat([1]));
    el.innerHTML = '<div class="col" style="gap:12px">' + o.items.map(function (x) {
      return '<div><div class="row-b small"><span class="ellipsis b" style="color:var(--tx)">' + esc(x.label) + '</span><span class="mono muted">' + esc(x.sub || (x.value + (o.unit || ''))) + '</span></div>' +
        '<div class="bar mt-4" style="height:8px"><i style="width:' + Math.max(3, x.value / max * 100) + '%;background:' + (o.color || 'var(--p)') + '"></i></div></div>';
    }).join('') + '</div>';
  }

  /**
   * radar(el, { radius, jarak (m), bearing (derajat), akurasi, label }) — peta geofence skematis.
   * Tidak butuh ubin peta/internet tambahan: aman untuk TKB bersinyal lemah.
   */
  function radar(o) {
    const W = 360, H = 220, cx = W / 2, cy = H / 2 + 4;
    const scale = (H / 2 - 22) / Math.max(o.radius * 1.6, (o.jarak || 0) * 1.12, 20);
    const rr = o.radius * scale;
    const inside = o.jarak !== null && o.jarak !== undefined && o.jarak <= o.radius;
    const col = o.jarak === null || o.jarak === undefined ? '#94A3B8' : inside ? '#10B981' : '#EF4444';
    const b = (o.bearing === undefined ? 135 : o.bearing) * Math.PI / 180;
    const d = Math.min((o.jarak || 0) * scale, W / 2 - 24);
    const ux = cx + Math.sin(b) * d, uy = cy - Math.cos(b) * d;
    const accR = Math.min((o.akurasi || 0) * scale, 90);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Posisi Anda terhadap radius TKB">';
    s += '<defs><pattern id="rg" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#E2E8F0" stroke-width="1"/></pattern></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="#F4F7FB"/><rect width="' + W + '" height="' + H + '" fill="url(#rg)"/>';
    s += '<path d="M0 ' + (cy + 40) + ' Q ' + (W * .4) + ' ' + (cy + 20) + ' ' + W + ' ' + (cy + 52) + '" stroke="#fff" stroke-width="14" fill="none"/><path d="M' + (cx - 70) + ' 0 L ' + (cx - 40) + ' ' + H + '" stroke="#fff" stroke-width="10" fill="none"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + (inside || o.jarak === undefined || o.jarak === null ? 'rgba(16,185,129,.16)' : 'rgba(239,68,68,.08)') + '" stroke="' + (inside || o.jarak === undefined || o.jarak === null ? '#10B981' : '#EF4444') + '" stroke-width="2"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="' + (inside ? '#10B981' : '#94A3B8') + '" stroke-width="1" stroke-dasharray="3 4" opacity=".6"><animate attributeName="r" from="' + (rr * .2) + '" to="' + rr + '" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" from=".8" to="0" dur="2.4s" repeatCount="indefinite"/></circle>';
    if (o.jarak !== null && o.jarak !== undefined) {
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ux + '" y2="' + uy + '" stroke="var(--p)" stroke-width="2" stroke-dasharray="4 4"/>';
      if (accR > 4) s += '<circle cx="' + ux + '" cy="' + uy + '" r="' + accR + '" fill="rgba(26,115,232,.10)" stroke="rgba(26,115,232,.35)"/>';
    }
    // pin TKB
    s += '<g transform="translate(' + cx + ',' + (cy - 2) + ')"><path d="M0 0c-9-11-14-17-14-24a14 14 0 0 1 28 0c0 7-5 13-14 24z" fill="#DC2626" stroke="#fff" stroke-width="2"/><circle cy="-24" r="5" fill="#fff"/></g>';
    const adaU = o.jarak !== null && o.jarak !== undefined, uAtas = adaU && uy < cy;
    const tkbLy = adaU && !uAtas ? cy - 50 : cy + 18;          // label TKB di sisi berlawanan dari posisi guru
    s += '<g transform="translate(' + cx + ',' + tkbLy + ')"><rect x="-42" y="-10" width="84" height="20" rx="6" fill="#0F172A"/><text text-anchor="middle" y="4" font-size="10.5" font-weight="600" fill="#fff">Titik Pusat TKB</text></g>';
    if (o.jarak !== null && o.jarak !== undefined) {
      s += '<circle cx="' + ux + '" cy="' + uy + '" r="11" fill="#fff" stroke="var(--p)" stroke-width="3"/><circle cx="' + ux + '" cy="' + uy + '" r="5" fill="var(--p)"/>';
      const lbl = (o.label || 'Posisi Anda') + ' (' + Math.round(o.jarak) + ' m)';
      const lw = lbl.length * 6.4 + 18, lx = Math.max(lw / 2 + 4, Math.min(W - lw / 2 - 4, ux)), ly = uAtas ? Math.max(14, uy - 26) : Math.min(H - 34, uy + 26);
      s += '<g transform="translate(' + lx + ',' + ly + ')"><rect x="' + (-lw / 2) + '" y="-11" width="' + lw + '" height="22" rx="11" fill="var(--p)"/><text text-anchor="middle" y="4" font-size="11" font-weight="600" fill="#fff" font-family="var(--f-mono)">' + esc(lbl) + '</text></g>';
    }
    s += '<g transform="translate(12,' + (H - 14) + ')"><rect x="0" y="-12" width="118" height="22" rx="11" fill="#fff" stroke="#E2E8F0"/><circle cx="14" cy="-1" r="5" fill="rgba(16,185,129,.3)" stroke="#10B981"/><text x="26" y="3" font-size="10.5" fill="#334155">Radius presensi ' + o.radius + 'm</text></g>';
    return s + '</svg>';
  }
  function bearing(lat1, lng1, lat2, lng2) { const r = Math.PI / 180; const y = Math.sin((lng2 - lng1) * r) * Math.cos(lat2 * r); const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r); return (Math.atan2(y, x) / r + 360) % 360; }

  /** Ubin peta mini untuk kartu TKB (dekoratif, deterministik dari nama). */
  function miniMap(seed) {
    const h = Math.abs(TT.hash(String(seed))); const a = 20 + h % 60, b = 30 + (h >> 3) % 50;
    return '<svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="mm' + (h % 999) + '" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#DCE6F2"/></pattern></defs>' +
      '<rect width="300" height="120" fill="#EEF4FB"/><rect width="300" height="120" fill="url(#mm' + (h % 999) + ')"/>' +
      '<path d="M0 ' + (60 + a / 4) + ' Q 150 ' + (b) + ' 300 ' + (70 + a / 5) + '" stroke="#fff" stroke-width="12" fill="none"/><path d="M' + (100 + a) + ' 0 L ' + (130 + b) + ' 120" stroke="#fff" stroke-width="8" fill="none"/>' +
      '<rect x="' + (20 + b) + '" y="14" width="46" height="30" rx="4" fill="#D9F2E6"/><rect x="' + (200 - a / 2) + '" y="76" width="60" height="30" rx="4" fill="#E2E8F0"/>' +
      '<circle cx="150" cy="60" r="34" fill="rgba(16,185,129,.15)" stroke="#10B981" stroke-width="1.5"/>' +
      '<g transform="translate(150,62)"><path d="M0 0c-8-10-12-15-12-21a12 12 0 0 1 24 0c0 6-4 11-12 21z" fill="var(--p)" stroke="#fff" stroke-width="2"/><circle cy="-21" r="4.5" fill="#fff"/></g></svg>';
  }

  window.Charts = { line: line, donut: donut, bars: bars, hbars: hbars, radar: radar, bearing: bearing, miniMap: miniMap, C: C };
})();
