// 1단계 코드 검사 — 화면을 띄우지 않고 파일만 읽어서 봄
//   node tests/check.js
// 보는 것: ① 문법 오류(따옴표·괄호 짝 포함) ② 단추가 가리키는 함수·칸이 실제로 있는지 ③ 판 번호가 파일끼리 맞는지
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const errs = [], warns = [], oks = [];
const err = m => errs.push(m), warn = m => warns.push(m), ok = m => oks.push(m);

const PAGES = ['index.html', 'checker/index.html', 'games/index.html'];
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

// ① 문법
function syntax(code, name, isModule) {
  try {
    if (isModule && vm.SourceTextModule) new vm.SourceTextModule(code, { identifier: name });
    else if (isModule) new Function(code.replace(/^\s*import\s[^;]+;?/gm, '').replace(/^\s*export\s+/gm, ''));
    else new vm.Script(code, { filename: name });
    return true;
  } catch (e) { err(name + ' 문법 오류: ' + e.message); return false; }
}
const scripts = {};
for (const f of PAGES) {
  const html = read(f); const parts = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { const attrs = m[1] || ''; if (/\bsrc=/.test(attrs)) continue; parts.push({ code: m[2], module: /type=["']module/.test(attrs), line: lineOf(html, m.index) }); }
  let good = true; parts.forEach((p, i) => { good = syntax(p.code, f + ' (' + p.line + '번째 줄 스크립트)', p.module) && good; });
  scripts[f] = { html, js: parts.map(p => p.code).join('\n') };
  if (good) ok(f + ' 문법');
  // HTML 따옴표 짝: 태그 안 속성 따옴표가 홀수면 의심
  const tags = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').match(/<[a-zA-Z][^<>]*>/g) || [];
  const odd = tags.filter(t => ((t.match(/"/g) || []).length % 2) === 1);
  if (odd.length) err(f + ' 태그 따옴표 짝 안 맞음: ' + odd.slice(0, 2).join(' | ')); else ok(f + ' 태그 따옴표 짝');
}
for (const f of ['Shell.gs', 'sw.js', 'help.js', 'demo.js']) if (syntax(read(f), f)) ok(f + ' 문법');
try { JSON.parse(read('manifest.webmanifest')); ok('manifest.webmanifest 형식'); } catch (e) { err('manifest.webmanifest 형식 오류: ' + e.message); }

// ② 단추 → 함수·칸
const RESERVED = new Set('if for while switch return function new typeof alert confirm prompt event this'.split(' '));
for (const f of PAGES) {
  const { html, js } = scripts[f];
  const all = html;  // 화면 글자 + 스크립트 안의 HTML 조각까지
  const defined = new Set();
  [/function\s+([A-Za-z_$][\w$]*)/g, /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, /window\.([A-Za-z_$][\w$]*)\s*=/g, /(?:const|let|var)\s+\{([^}]+)\}\s*=/g, /,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g]
    .forEach(re => { let m; while ((m = re.exec(js))) m[1].split(',').forEach(n => defined.add(n.trim().split(/[:\s=]/)[0])); });
  // 속성 onclick="이름(...)"
  let miss = [];
  let m; const reAttr = /\son(?:click|change|input|submit|keydown)\s*=\s*\\?["']\s*([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reAttr.exec(all))) if (!defined.has(m[1]) && !RESERVED.has(m[1])) miss.push(m[1]);
  // $('칸').onclick = 이름;  /  addEventListener('click', 이름)
  const reBind = /\.on(?:click|change|input|keydown|submit)\s*=\s*([A-Za-z_$][\w$]*)\s*[;,\n)]/g;
  while ((m = reBind.exec(js))) if (!defined.has(m[1]) && !RESERVED.has(m[1]) && !/^(null|undefined|close|save|redraw|ui|prev|go|goNow)$/.test(m[1])) miss.push(m[1]);
  const reEv = /addEventListener\(\s*['"]\w+['"]\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
  while ((m = reEv.exec(js))) if (!defined.has(m[1]) && !RESERVED.has(m[1])) miss.push(m[1]);
  miss = [...new Set(miss)];
  if (miss.length) err(f + ' 단추가 가리키는 함수가 없음: ' + miss.join(', ')); else ok(f + ' 단추 → 함수 연결');
  // $('칸') 으로 단추를 다는데 그 칸 id 가 어디에도 없으면 오류
  const ids = new Set(); const reId = /\bid\s*=\s*\\?["']([\w-]+)/g; while ((m = reId.exec(all))) ids.add(m[1]);
  const reId2 = /\.id\s*=\s*['"]([\w-]+)['"]/g; while ((m = reId2.exec(all))) ids.add(m[1]);
  const lost = new Set(); const reUse = /\$\(\s*['"]([\w-]+)['"]\s*\)\s*\.on\w+\s*=/g;
  while ((m = reUse.exec(js))) if (!ids.has(m[1])) lost.add(m[1]);
  const reUse2 = /getElementById\(\s*['"]([\w-]+)['"]\s*\)\s*\.on\w+\s*=/g;
  while ((m = reUse2.exec(js))) if (!ids.has(m[1])) lost.add(m[1]);
  if (lost.size) err(f + ' 단추를 다는 칸(id)이 화면에 없음: ' + [...lost].join(', ')); else ok(f + ' 단추 칸(id) 있음');
  // 같은 id 가 화면 글자에 두 번 이상 (스크립트 밖 정적 HTML 만)
  const stat = html.replace(/<script[\s\S]*?<\/script>/gi, ''); const cnt = {}; const reS = /\sid="([\w-]+)"/g;
  while ((m = reS.exec(stat))) cnt[m[1]] = (cnt[m[1]] || 0) + 1;
  const dup = Object.keys(cnt).filter(k => cnt[k] > 1);
  if (dup.length) err(f + ' 같은 id 가 두 번 이상: ' + dup.join(', ')); else ok(f + ' id 겹침 없음');
}

// 사용 안내: 모든 화면이 help.js 를 불러오고 단추를 두는지
for (const f of PAGES) {
  const h = read(f);
  if (!/<script src="(\.\.\/)?help\.js"><\/script>/.test(h)) err(f + ' 사용 안내(help.js)를 불러오지 않음');
  else if (!/data-wdhelp|WD_HELP\.btn\(/.test(h)) err(f + ' 사용 안내 단추가 없음');
  else ok(f + ' 사용 안내 단추');
}
{ const hj = read('help.js'); const n = (hj.match(/^\s{4}\['/gm) || []).length;
  if (n < 6 || n > 9) err('사용 안내 항목 수가 6~9개가 아님: ' + n); else ok('사용 안내 항목 ' + n + '개');
  // 다른 화면의 class 이름과 겹치지 않게 wdhelp- 로 시작
  const cls = (hj.match(/\.([a-z][\w-]*)\{/g) || []).map(s => s.slice(1, -1)).filter(c => !/^wdhelp-/.test(c));
  if (cls.length) err('사용 안내 class 이름이 wdhelp- 로 시작하지 않음: ' + [...new Set(cls)].join(', ')); else ok('사용 안내 class 이름 겹침 없음'); }

// ③ 판 번호
const idx = read('index.html'), ck = read('checker/index.html'), gs = read('Shell.gs'), rd = read('README.md');
const school = (idx.match(/const VER = '([\d.]+)'/) || [])[1];
const need = +(idx.match(/NEED_SHELL = (\d+)/) || [])[1];
const shellV = +(gs.match(/SHELL_VERSION = (\d+)/) || [])[1];
const ckVer = (ck.match(/const VER='([\d.]+)'/) || [])[1];
const ckTitle = (ck.match(/<title>[^<]*v([\d.]+)<\/title>/) || [])[1];
const verList = s => (s.match(/^- v(\d+\.\d+\.\d+)/gm) || []).map(x => x.slice(3));
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const readmeTop = verList(rd).sort(cmp).pop();
const ckReadme = ((rd.match(/^- 판정기 v(\d+\.\d+\.\d+)/gm) || []).map(x => x.match(/v([\d.]+)/)[1]).sort(cmp).pop());
if (!school) err('학교 화면 VER 를 못 찾음');
else if (readmeTop && school !== readmeTop) err('판 번호 다름: 학교 화면 ' + school + ' / README 마지막 기록 v' + readmeTop);
else ok('학교 화면 판 번호 ' + school + ' = README');
if (ckVer !== ckTitle) err('판정기 판 번호 다름: VER ' + ckVer + ' / 제목 v' + ckTitle); else ok('판정기 VER = 제목 (' + ckVer + ')');
if (ckReadme && ckVer !== ckReadme) err('판 번호 다름: 판정기 ' + ckVer + ' / README 판정기 마지막 기록 v' + ckReadme); else ok('판정기 판 번호 = README');
if (need !== shellV) err('껍데기 판 다름: 화면이 바라는 판 ' + need + ' / Shell.gs ' + shellV); else ok('껍데기 판 ' + shellV + ' = 화면이 바라는 판');
const shellInRd = (rd.match(/껍데기 (\d+)판/g) || []).map(x => +x.match(/\d+/)[0]).sort((a, b) => a - b).pop();
if (shellInRd && shellInRd !== shellV) err('껍데기 판 다름: README ' + shellInRd + '판 / Shell.gs ' + shellV + '판'); else ok('껍데기 판 = README');
// RPC: 화면이 부르는 서버 기능이 Shell.gs 허용 목록에 다 있는지
const allow = new Set(((gs.match(/RPC_ALLOW_ = \[([\s\S]*?)\]/) || [])[1] || '').match(/'(\w+)'/g).map(s => s.slice(1, -1)));
const called = new Set(); let mm; const reR = /\b(?:rpc|srpc)\(\s*'(\w+)'/g;
for (const f of PAGES) while ((mm = reR.exec(read(f)))) called.add(mm[1]);
const noFn = [...called].filter(n => !allow.has(n) || !new RegExp('function ' + n + '\\s*\\(').test(gs));
if (noFn.length) err('화면이 부르는데 껍데기에 없는 기능: ' + noFn.join(', ')); else ok('화면이 부르는 서버 기능 ' + called.size + '개 모두 껍데기에 있음');

console.log('코드 검사 — 통과 ' + oks.length + ' / 문제 ' + errs.length + (warns.length ? ' / 참고 ' + warns.length : ''));
errs.forEach(e => console.log('  ✗ ' + e)); warns.forEach(w => console.log('  · ' + w));
if (process.argv.includes('-v')) oks.forEach(o => console.log('  ✓ ' + o));
process.exit(errs.length ? 1 : 0);
