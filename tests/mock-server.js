// 시험용 서버: 가짜 구글 환경(시트·속성·캐시)에서 Shell.gs 를 돌리고, 화면 파일을 같은 주소로 내놓음
//   node tests/mock-server.js [포트]   →  http://localhost:포트/wedown/?s=http://localhost:포트/exec
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const PORT = +process.argv[2] || 8765;

function makeSheet(name) {
  const rows = [];
  const sh = {
    rows, name,
    getLastRow() { return rows.length; },
    getLastColumn() { return rows.reduce((m, r) => Math.max(m, r.length), 0); },
    appendRow(r) { rows.push(r.slice()); return sh; },
    setFrozenRows() { return sh; },
    deleteRow(i) { rows.splice(i - 1, 1); return sh; },
    getDataRange() { const nc = sh.getLastColumn() || 1; return sh.getRange(1, 1, Math.max(1, rows.length), nc); },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = rows[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
        setValues(vals) { vals.forEach((v, i) => { const ri = r - 1 + i; while (rows.length <= ri) rows.push([]); v.forEach((x, j) => { rows[ri][c - 1 + j] = x; }); }); return this; },
        setValue(v) { return this.setValues([[v]]); },
        setNumberFormat() { return this; }
      };
    }
  };
  return sh;
}
const sheets = {};
const props = new Map(), cache = new Map();
const pad = n => String(n).padStart(2, '0');
const ctx = {
  console, JSON, Math, Date, String, Number, Array, Object, Error, RegExp, encodeURIComponent, parseInt, parseFloat, isNaN,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getName: () => '햇살초 위다운', getId: () => 'test-sheet', getUrl: () => 'about:blank', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet(n)) }) },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => props.has(k) ? props.get(k) : null, setProperty(k, v) { props.set(k, String(v)); return this; },
    deleteProperty(k) { props.delete(k); return this; }, getProperties: () => Object.fromEntries(props) }) },
  CacheService: { getScriptCache: () => ({
    get: k => { const e = cache.get(k); return e && e.t > Date.now() ? e.v : null; },
    put: (k, v, s) => { cache.set(k, { v: String(v), t: Date.now() + (s || 600) * 1000 }); },
    getAll: ks => { const o = {}; ks.forEach(k => { const e = cache.get(k); if (e && e.t > Date.now()) o[k] = e.v; }); return o; },
    remove: k => cache.delete(k), removeAll: ks => ks.forEach(k => cache.delete(k)) }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(String(s), 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    formatDate: (d, tz, f) => { const k = new Date(d.getTime() + 9 * 3600e3); return f === 'HH:mm' ? pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes()) : k.getUTCFullYear() + '-' + pad(k.getUTCMonth() + 1) + '-' + pad(k.getUTCDate()); }
  },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  ScriptApp: { getService: () => ({ getUrl: () => 'http://localhost:' + PORT + '/exec' }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  HtmlService: { createHtmlOutput: s => ({ s, setTitle() { return this; }, addMetaTag() { return this; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Shell.gs'), 'utf8') + '\n;globalThis.doPost=doPost;globalThis.doGet=doGet;', ctx, { filename: 'Shell.gs' });
// 옛 판 시트에서 올라오는 경우 시험: SEED_V1=1
if (process.env.SEED_V1) { const s = sheets.Students = makeSheet('Students'); s.rows.push(['ID', 'Number', 'Name', 'SortOrder'], ['old1', 1, '옛하늘', 1]); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (u.pathname === '/exec') {
    if (req.method === 'GET') { res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, cors)); return res.end(ctx.doGet({}).s); }
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const out = ctx.doPost({ postData: { contents: body } });
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)); res.end(out.s);
    }); return;
  }
  if (!u.pathname.startsWith('/wedown')) { res.writeHead(404); return res.end(); }
  let p = path.join(ROOT, decodeURIComponent(u.pathname.replace(/^\/wedown/, '')));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('시험 서버 http://localhost:' + PORT + '/wedown/?s=http://localhost:' + PORT + '/exec'));
