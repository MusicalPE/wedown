/* 위 Down 미리보기(?demo) — 설치 없이 지어낸 학급으로 둘러보기
   · 학교 시트 대신 이 브라우저 탭 안에서만 Shell.gs 를 그대로 돌림 (가짜 시트·속성·캐시)
   · 기록은 이 탭(sessionStorage)에만 남고, 탭을 닫으면 사라짐. 진짜 학교 시트와는 아무 관계 없음
   · 학교 화면(index.html)과 판정기(checker/index.html)가 같이 씀 */
(function () {
  var KEY = 'wd_demo_v1';
  var ROOT = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/demo\.js(\?.*)?$/, '') : './'; })();

  /* ---- SHA-256 (껍데기의 비밀번호 hash_ 가 동기식이라 직접 계산) ---- */
  function sha256(str) {
    var b = new TextEncoder().encode(str), K = [], H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
    var p = function (n) { for (var f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; }, x = 0;
    for (var n = 2; K.length < 64; n++) if (p(n)) K.push((Math.pow(n, 1 / 3) % 1) * 4294967296 | 0);
    var l = b.length, m = new Uint8Array(((l + 9 + 63) >> 6) << 6); m.set(b); m[l] = 0x80;
    var dv = new DataView(m.buffer); dv.setUint32(m.length - 4, l * 8); dv.setUint32(m.length - 8, Math.floor(l / 536870912));
    var r = function (v, s) { return (v >>> s) | (v << (32 - s)); }, w = new Array(64);
    for (var o = 0; o < m.length; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (i = 16; i < 64; i++) { var s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H = [H[0] + a, H[1] + bb, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(function (v) { return v | 0; });
    }
    var out = []; H.forEach(function (v) { for (var k = 24; k >= 0; k -= 8) { var by = (v >>> k) & 255; out.push(by > 127 ? by - 256 : by); } }); return out;
  }

  /* ---- 가짜 구글 환경 ---- */
  var ST = null;   // { sheets:{이름:[행...]}, props:{}, cache:{키:{v,t}} }
  function load() {
    try { ST = JSON.parse(sessionStorage.getItem(KEY) || 'null', function (k, v) { return v && typeof v === 'object' && '$d' in v ? new Date(v.$d) : v; }); } catch (e) { ST = null; }
    return !!ST;
  }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(ST, function (k, v) { var o = this[k]; return o instanceof Date ? { $d: o.getTime() } : v; })); } catch (e) {}
  }
  function sheetObj(name) {
    var rows = ST.sheets[name];
    var sh = {
      getLastRow: function () { return rows.length; },
      getLastColumn: function () { return rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0); },
      appendRow: function (r) { rows.push(r.slice()); return sh; },
      setFrozenRows: function () { return sh; },
      deleteRow: function (i) { rows.splice(i - 1, 1); return sh; },
      getDataRange: function () { return sh.getRange(1, 1, Math.max(1, rows.length), sh.getLastColumn() || 1); },
      getRange: function (r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        return {
          getValues: function () { var o = []; for (var i = 0; i < nr; i++) { var row = rows[r - 1 + i] || [], x = []; for (var j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
          setValues: function (vals) { vals.forEach(function (v, i) { var ri = r - 1 + i; while (rows.length <= ri) rows.push([]); v.forEach(function (x, j) { rows[ri][c - 1 + j] = x; }); }); return this; },
          setValue: function (v) { return this.setValues([[v]]); },
          setNumberFormat: function () { return this; }
        };
      }
    };
    return sh;
  }
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var G = {
    SpreadsheetApp: { getActiveSpreadsheet: function () { return {
      getName: function () { return '햇살초 6학년 1반 (미리보기)'; },
      getSheetByName: function (n) { return ST.sheets[n] ? sheetObj(n) : null; },
      insertSheet: function (n) { ST.sheets[n] = []; return sheetObj(n); } }; } },
    PropertiesService: { getScriptProperties: function () { return {
      getProperty: function (k) { return k in ST.props ? ST.props[k] : null; },
      setProperty: function (k, v) { ST.props[k] = String(v); return this; },
      deleteProperty: function (k) { delete ST.props[k]; return this; },
      getProperties: function () { return Object.assign({}, ST.props); } }; } },
    CacheService: { getScriptCache: function () { var C = ST.cache, now = Date.now(); return {
      get: function (k) { var e = C[k]; return e && e.t > Date.now() ? e.v : null; },
      put: function (k, v, s) { C[k] = { v: String(v), t: Date.now() + (s || 600) * 1000 }; },
      getAll: function (ks) { var o = {}; ks.forEach(function (k) { var e = C[k]; if (e && e.t > now) o[k] = e.v; }); return o; },
      remove: function (k) { delete C[k]; }, removeAll: function (ks) { ks.forEach(function (k) { delete C[k]; }); } }; } },
    Utilities: {
      getUuid: function () { return (crypto.randomUUID ? crypto.randomUUID() : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2)); },
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: function (a, s) { return sha256(String(s)); },
      formatDate: function (d, tz, f) { var k = new Date(d.getTime() + 9 * 3600e3); return f === 'HH:mm' ? pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes()) : k.getUTCFullYear() + '-' + pad(k.getUTCMonth() + 1) + '-' + pad(k.getUTCDate()); }
    },
    Session: { getScriptTimeZone: function () { return 'Asia/Seoul'; } },
    ScriptApp: { getService: function () { return { getUrl: function () { return 'demo'; } }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: function (s) { return { s: s, setMimeType: function () { return this; } }; } },
    HtmlService: { createHtmlOutput: function (s) { return { s: s, setTitle: function () { return this; }, addMetaTag: function () { return this; } }; } }
  };

  /* ---- 껍데기(Shell.gs) 불러와 돌리기 ---- */
  var API = null, loading = null;
  function boot() {
    if (loading) return loading;
    loading = fetch(ROOT + 'Shell.gs', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('미리보기를 불러오지 못했어요.'); return r.text(); }).then(function (code) {
      var names = Object.keys(G);
      var allow = ((code.match(/RPC_ALLOW_ = \[([\s\S]*?)\]/) || [])[1] || '').match(/'(\w+)'/g).map(function (s) { return s.slice(1, -1); });
      var expose = allow.concat(['recordsSheet_']).map(function (n) { return JSON.stringify(n) + ':(typeof ' + n + '==="function"?' + n + ':undefined)'; }).join(',');
      var f = new Function(names.join(','), code + '\n;return {' + expose + '};');
      var fresh = !load();
      if (fresh) ST = { sheets: {}, props: {}, cache: {} };
      API = f.apply(null, names.map(function (n) { return G[n]; }));
      API.__allow = allow;
      if (fresh) seed();
      save();
    });
    return loading;
  }

  /* ---- 지어낸 학급 채우기 (햇살초 6학년 1반 16명, 지난 2주 기록) ---- */
  function seed() {
    var tok = API.verifyAdminPassword('1234').token;
    API.setSettings(tok, { className: '햇살초 6학년 1반 (미리보기)', reps: 15, sets: 3, rest: 10, dayLimit: 100, plankSec: 30, message: '무리하지 말고, 내 몸에 맞게. 그게 나다운 거예요.' });
    var names = '김하늘 이바다 박별 최온유 정다온 강해솔 조은결 윤가람 장나래 임도윤 한서진 오하람 서지우 신마루 권이안 황보라'.split(' ');
    API.addStudentsBulk(tok, names.map(function (n, i) { return { grade: 6, cls: 1, number: i + 1, name: n }; }));
    var st = API.getStudentsPublic();
    var EX = ['squat', 'jack', 'lunge', 'highknee', 'wallpush', 'kneepush', 'situp', 'legraise', 'plank', 'balance', 'climber', 'burpee', 'pushup'];
    var rnd = (function () { var s = 20261120; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
    var today = new Date(), made = [];
    for (var d = 13; d >= 0; d--) {
      st.forEach(function (s) {
        if (rnd() < 0.55) return;
        var ex = EX[Math.floor(rnd() * EX.length)], timed = ex === 'plank' || ex === 'balance';
        var per = timed ? 20 + Math.floor(rnd() * 3) * 5 : 8 + Math.floor(rnd() * 3) * 4, sets = 2 + Math.floor(rnd() * 2), arr = [];
        for (var k = 0; k < sets; k++) arr.push(Math.max(1, per - Math.floor(rnd() * 3)));
        try { API.saveRecord(s.id, ex, per, sets, arr); made.push(d); } catch (e) {}
      });
    }
    // 방금 넣은 기록의 날짜를 지난 2주로 나눠 줌
    var rows = ST.sheets.Records || [];
    for (var i = 1; i < rows.length; i++) {
      var back = made[i - 1] || 0, t = new Date(today.getTime() - back * 864e5);
      var k = new Date(t.getTime() + 9 * 3600e3);
      rows[i][1] = t; rows[i][3] = k.getUTCFullYear() + '-' + pad(k.getUTCMonth() + 1) + '-' + pad(k.getUTCDate());
      rows[i][4] = pad(9 + Math.floor(rnd() * 6)) + ':' + pad(Math.floor(rnd() * 60));
    }
  }

  window.WD_DEMO = {
    on: true,
    call: function (fn, args) {
      return boot().then(function () {
        if (API.__allow.indexOf(fn) < 0 || typeof API[fn] !== 'function') throw new Error('알 수 없는 요청: ' + fn);
        var out = API[fn].apply(null, args || []);
        save(); return out;
      });
    },
    reset: function () { try { sessionStorage.removeItem(KEY); } catch (e) {} loading = null; API = null; },
    // 화면 맨 위 안내 띠
    bar: function (compact) {
      if (document.getElementById('wdDemoBar')) return;
      var b = document.createElement('div'); b.id = 'wdDemoBar';
      if (compact) {   // 판정기처럼 화면이 꽉 찬 곳은 아래 구석에 작게
        b.setAttribute('style', 'position:fixed;left:8px;bottom:8px;z-index:60;background:#0E3A63;color:#fff;font:700 12px/1.4 Pretendard,"Malgun Gothic",sans-serif;padding:6px 10px;border-radius:999px;opacity:.92;pointer-events:none');
        b.textContent = '미리보기 · 지어낸 학급 (이 탭에만 기록)'; document.body.appendChild(b); return;
      }
      b.setAttribute('style', 'position:sticky;top:0;z-index:60;background:#0E3A63;color:#fff;font:600 13px/1.5 Pretendard,"Malgun Gothic",sans-serif;padding:8px 14px;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:center;text-align:center');
      b.innerHTML = '<span><b>미리보기</b> · 지어낸 학급(햇살초 6학년 1반)이에요. 이 탭을 닫으면 기록이 사라져요.</span><span>선생님 비밀번호 1234 · 학생 비밀번호 1234</span>' +
        '<button type="button" style="min-height:32px;border:1px solid rgba(255,255,255,.5);background:none;color:#fff;border-radius:8px;padding:0 10px;font:inherit;cursor:pointer">처음 상태로</button>';
      b.querySelector('button').onclick = function () { window.WD_DEMO.reset(); location.reload(); };
      document.body.insertBefore(b, document.body.firstChild);
    }
  };
})();
