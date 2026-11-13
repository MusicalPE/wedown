// 판정 계산 시험 — 판정기(checker/index.html)의 JUDGE 부분만 꺼내서, 만든 관절 움직임을 넣어 봄
//   node tests/judge.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'checker', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('/*JUDGE-START*/'), html.indexOf('/*JUDGE-END*/'));
const ctx = { console, Math }; vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.J={SquatJudge,HighKneeJudge,PlankJudge,BalanceJudge};', ctx);
const J = ctx.J;
const base = () => Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .95 }));
function run(judge, frames) { let t = 0, s; for (const f of frames) { s = judge.push(t, f); t += 1 / 30; } return s; }
const hold = (f, sec) => Array.from({ length: Math.round(sec * 30) }, () => f());
const move = (f, sec) => Array.from({ length: Math.round(sec * 30) }, (_, i) => f(i / (sec * 30)));
const results = []; const expect = (name, got, want) => results.push({ name, ok: got === want, got, want });

// 스쿼트(정면): 엉덩이가 무릎 높이 쪽으로 q 만큼 내려감
function sq(q) { const l = base(); l[0].y = .2; l[11].y = l[12].y = .3; l[11].x = .44; l[12].x = .56; l[23].x = .46; l[24].x = .54; l[23].y = l[24].y = .5 + .2 * q;
  l[25].x = .46; l[26].x = .54; l[25].y = l[26].y = .7; l[27].x = .46; l[28].x = .54; l[27].y = l[28].y = .9; return l; }
function squats(q, n) { const f = hold(() => sq(0), .8); for (let i = 0; i < n; i++) { f.push(...move(p => sq(q * Math.sin(Math.PI * p)), 1.2)); f.push(...hold(() => sq(0), .3)); } return f; }
expect('스쿼트 깊게 5회', run(new J.SquatJudge('normal'), squats(1, 5)).count, 5);
expect('스쿼트 조금만(20%) 5회 → 0', run(new J.SquatJudge('normal'), squats(.2, 5)).count, 0);

// 무릎 높이 들기: 왼쪽·오른쪽 한 번씩 = 1회
function hk(qL, qR) { const l = base(); l[11].y = l[12].y = .3; [23, 24].forEach(i => l[i].y = .5); l[25].y = .7 - .18 * qL; l[26].y = .7 - .18 * qR; l[27].y = l[28].y = .9; return l; }
{ const f = hold(() => hk(0, 0), .6); for (let i = 0; i < 4; i++) { f.push(...move(p => hk(Math.sin(Math.PI * p), 0), .35)); f.push(...move(p => hk(0, Math.sin(Math.PI * p)), .35)); }
  expect('무릎 높이 들기 좌우 4쌍 → 4회', run(new J.HighKneeJudge('normal'), f).count, 4); }
{ const f = hold(() => hk(0, 0), .6); for (let i = 0; i < 4; i++) f.push(...move(p => hk(Math.sin(Math.PI * p), 0), .35));
  expect('무릎 높이 들기 왼쪽만 4번 → 0', run(new J.HighKneeJudge('normal'), f).count, 0); }

// 플랭크(옆에서): 팔을 세운 경사 한 줄이면 초가 올라가고, 바닥에 엎드리면 0
function pl(lie) { const l = base(); const set = (i, x, y) => { l[i] = { x, y, visibility: .95 }; };
  [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [7, 8]].forEach(([a, b]) => { l[a].visibility = .95; l[b].visibility = .2; });
  if (!lie) { set(11, .3, .5); set(13, .3, .62); set(15, .3, .75); set(23, .55, .61); set(25, .675, .665); set(27, .8, .72); set(7, .22, .465); set(0, .2, .46); }
  else { set(11, .3, .74); set(13, .38, .75); set(15, .45, .75); set(23, .55, .745); set(25, .675, .75); set(27, .8, .75); set(7, .22, .735); set(0, .2, .73); }
  return l; }
expect('플랭크 곧게 6초 → 5초 이상', run(new J.PlankJudge('normal'), hold(() => pl(false), 6)).count >= 5, true);
expect('플랭크 자리에 엎드림 6초 → 0초', run(new J.PlankJudge('normal'), hold(() => pl(true), 6)).count, 0);

const bad = results.filter(r => !r.ok);
console.log('판정 시험 — 통과 ' + (results.length - bad.length) + ' / 문제 ' + bad.length);
results.forEach(r => console.log('  ' + (r.ok ? '✓' : '✗') + ' ' + r.name + (r.ok ? '' : '  (나온 값 ' + r.got + ', 바라는 값 ' + r.want + ')')));
process.exit(bad.length ? 1 : 0);
