/*************************************************************
 * 위 Down (우리 Down 맨몸 기록) — 학교 시트용 껍데기 (Shell.gs)
 * ------------------------------------------------------------
 * 이 파일 하나만 스프레드시트의 Apps Script 에 붙여넣고 웹앱으로 배포하면 됩니다.
 * 화면은 GitHub(musicalpe.github.io/wedown)에서 열리고, 이 파일은 뒤에서
 * 학생·기록·설정을 시트에 읽고 쓰는 일만 합니다. 화면이 새 판으로 바뀌어도
 * 이 파일은 그대로 두면 됩니다. (껍데기를 바꿔야 할 때는 화면이 알려줍니다)
 *
 * 배포 설정: 다음 사용자로 실행 = 나, 액세스 권한 = 모든 사용자
 *
 * 운동방(QR로 들어와 과제를 받는 방)은 시트에 쓰지 않고 구글 임시 저장소(캐시)에만 둡니다.
 * 세트 완료 신호 같은 방 자료는 길어야 6시간 뒤 저절로 사라지고, 학생이 운동을 다 마치면
 * 그 결과만 Records 시트에 한 줄로 남습니다.
 *
 * Copyright (c) 2026 음악적체육인. 사용 조건은 https://github.com/MusicalPE/wedown 의 LICENSE 를 봐 주세요.
 *************************************************************/

const SHELL_VERSION = 1;
const APP_URL = 'https://musicalpe.github.io/wedown/';

const SHEET_STUDENTS = 'Students';
const SHEET_RECORDS = 'Records';
const STUDENTS_HEADER_ = ['ID', 'Number', 'Name', 'SortOrder'];
const RECORDS_HEADER_ = ['RecordID', 'Timestamp', 'StudentID', 'Date', 'Time', 'Exercise', 'Target', 'Sets', 'Reps', 'Total', 'Source'];
const EXERCISES_ = { squat: '스쿼트', jack: '점핑잭', lunge: '런지', burpee: '버피' };
const REP_M = 0.4;                       // 한 번에 바다로 40cm
const TOKEN_TTL_SEC = 60 * 60;           // 관리자 토큰 1시간
const ROOM_TTL_SEC = 6 * 60 * 60;        // 운동방 자료는 6시간 뒤 저절로 사라짐 (구글 캐시 최대값)
const DEFAULT_ADMIN_PASSWORD = '1234';

/************ 설치 확인 화면 ************/
function doGet(e) {
  const self = ScriptApp.getService().getUrl();
  const app = APP_URL + '?s=' + encodeURIComponent(self);
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Pretendard,"Malgun Gothic",sans-serif;background:#DDF0F5;margin:0;padding:24px;color:#0E2A44}' +
    '.c{max-width:560px;margin:30px auto;background:#fff;border-radius:20px;box-shadow:0 8px 28px rgba(14,58,99,.12);overflow:hidden}' +
    '.h{background:#0E3A63;color:#fff;padding:22px 24px}.h h1{margin:0 0 4px;font-size:22px}.h p{margin:0;opacity:.85}' +
    '.b{padding:22px 24px;line-height:1.6}a.btn{display:block;text-align:center;background:#139AAE;color:#fff;text-decoration:none;font-weight:800;padding:14px;border-radius:12px;font-size:17px;margin:14px 0}' +
    'code{display:block;background:#EEF4F7;padding:10px;border-radius:8px;word-break:break-all;font-size:12px}small{color:#5B7488}</style></head><body>' +
    '<div class="c"><div class="h"><h1>위 Down · 우리 Down 맨몸 기록</h1><p>껍데기 설치 완료 · 껍데기 판 ' + SHELL_VERSION + '</p></div><div class="b">' +
    '<p>이 주소는 <b>설치 확인용</b>이에요. 프로그램은 아래 버튼으로 엽니다. 열린 주소를 <b>즐겨찾기</b>해 두세요.</p>' +
    '<a class="btn" href="' + app + '" target="_top">프로그램 열기 →</a>' +
    '<small>프로그램 주소</small><code>' + app + '</code>' +
    '</div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('위 Down — 설치 확인')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/************ 화면(GitHub)에서 오는 요청 ************/
// POST 본문 {"fn":"함수이름","args":[...]} → {"ok":true,"result":...}
const RPC_ALLOW_ = [
  'ping', 'getPublic', 'getDashboard', 'getStudentsPublic', 'getStudentToday', 'saveRecord',
  'verifyAdminPassword', 'changeAdminPassword', 'getSettingsAdmin', 'setSettings',
  'addStudentsBulk', 'renameStudent', 'deleteStudent', 'getRecordsAdmin', 'deleteRecord',
  'roomOpen', 'roomClose', 'roomSendTask', 'roomStatus', 'roomInfo', 'roomJoin', 'roomPoll', 'roomProgress'
];
function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(body.fn || '');
    if (RPC_ALLOW_.indexOf(fn) === -1) throw new Error('알 수 없는 요청: ' + fn);
    const g = (typeof globalThis !== 'undefined') ? globalThis : this;
    const f = g[fn];
    if (typeof f !== 'function') throw new Error('이 껍데기에 없는 기능입니다: ' + fn + ' (껍데기를 새 판으로 바꿔 주세요)');
    const args = Array.isArray(body.args) ? body.args : [];
    out = { ok: true, result: f.apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/************ 기본 도구 ************/
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz_() { return Session.getScriptTimeZone() || 'Asia/Seoul'; }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function nowTime_() { return Utilities.formatDate(new Date(), tz_(), 'HH:mm'); }
function dateStr_(v) { return (v instanceof Date) ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : String(v || '').trim(); }
function shiftDate_(s, d) { const t = new Date(s + 'T12:00:00'); t.setDate(t.getDate() + d); return Utilities.formatDate(t, tz_(), 'yyyy-MM-dd'); }
function hash_(pw) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('');
}
function props_() { return PropertiesService.getScriptProperties(); }
function cache_() { return CacheService.getScriptCache(); }

function sheet_(name, header) {
  let sh = ss_().getSheetByName(name);
  if (!sh) { sh = ss_().insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
function studentsSheet_() { return sheet_(SHEET_STUDENTS, STUDENTS_HEADER_); }
function recordsSheet_() { return sheet_(SHEET_RECORDS, RECORDS_HEADER_); }

function settings_() {
  let s = {};
  try { s = JSON.parse(props_().getProperty('SETTINGS') || '{}'); } catch (e) {}
  return {
    className: s.className || ss_().getName(),
    reps: Number(s.reps) || 15,
    sets: Number(s.sets) || 3,
    rest: Number(s.rest) || 10,
    dayLimit: Number(s.dayLimit) || 100,
    message: s.message || ''
  };
}

/************ 관리자 ************/
function adminHash_() { return props_().getProperty('ADMIN_HASH') || hash_(DEFAULT_ADMIN_PASSWORD); }
function verifyAdminPassword(pw) {
  if (hash_(pw) !== adminHash_()) return { ok: false, message: '비밀번호가 맞지 않아요.' };
  const token = Utilities.getUuid();
  cache_().put('ADMIN_' + token, '1', TOKEN_TTL_SEC);
  return { ok: true, token: token, isDefault: !props_().getProperty('ADMIN_HASH') };
}
function admin_(token) {
  if (!token || !cache_().get('ADMIN_' + token)) throw new Error('관리자 로그인이 필요해요 (1시간이 지나면 다시 로그인).');
  cache_().put('ADMIN_' + token, '1', TOKEN_TTL_SEC);
}
function changeAdminPassword(token, pw) {
  admin_(token);
  if (!pw || String(pw).length < 4) throw new Error('비밀번호는 4글자 이상으로 정해 주세요.');
  props_().setProperty('ADMIN_HASH', hash_(pw));
  return { ok: true };
}
function getSettingsAdmin(token) { admin_(token); return settings_(); }
function setSettings(token, obj) {
  admin_(token);
  const cur = settings_(), o = obj || {};
  const n = {
    className: String(o.className != null ? o.className : cur.className).slice(0, 40),
    reps: Math.max(1, Math.min(100, Number(o.reps) || cur.reps)),
    sets: Math.max(1, Math.min(10, Number(o.sets) || cur.sets)),
    rest: Math.max(5, Math.min(300, Number(o.rest) || cur.rest)),
    dayLimit: Math.max(10, Math.min(1000, Number(o.dayLimit) || cur.dayLimit)),
    message: String(o.message != null ? o.message : cur.message).slice(0, 120)
  };
  props_().setProperty('SETTINGS', JSON.stringify(n));
  return n;
}

/************ 학생 ************/
function studentRows_() {
  const v = studentsSheet_().getDataRange().getValues();
  const list = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    list.push({ id: String(v[i][0]), number: v[i][1], name: String(v[i][2]), order: Number(v[i][3]) || i });
  }
  list.sort(function (a, b) { return a.order - b.order; });
  return list;
}
function getStudentsPublic() { return studentRows_().map(function (s) { return { id: s.id, number: s.number, name: s.name }; }); }

// lines: "1 김하늘" 또는 "김하늘" 한 줄에 한 명 (엑셀에서 번호·이름 두 칸을 붙여넣어도 됨)
function addStudentsBulk(token, text) {
  admin_(token);
  const sh = studentsSheet_();
  const cur = studentRows_();
  let order = cur.reduce(function (m, s) { return Math.max(m, s.order); }, 0);
  const rows = [];
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const t = line.trim(); if (!t) return;
    const m = t.match(/^(\d+)[\s\t.,)]+(.+)$/);
    const number = m ? Number(m[1]) : '';
    const name = (m ? m[2] : t).replace(/\t/g, ' ').trim().slice(0, 20);
    if (!name) return;
    rows.push([Utilities.getUuid(), number, name, ++order]);
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { added: rows.length };
}
function renameStudent(token, id, name, number) {
  admin_(token);
  const sh = studentsSheet_(), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sh.getRange(i + 1, 2, 1, 2).setValues([[number === '' || number == null ? v[i][1] : Number(number), String(name || v[i][2]).slice(0, 20)]]);
      return { ok: true };
    }
  }
  throw new Error('학생을 찾지 못했어요.');
}
function deleteStudent(token, id) {
  admin_(token);
  const sh = studentsSheet_(), v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === String(id)) sh.deleteRow(i + 1);
  return { ok: true };   // 기록은 남겨 둠 (실수로 지웠을 때를 위해) — 화면에는 등록된 학생 기록만 보임
}

/************ 기록 ************/
function recordRows_() {
  const v = recordsSheet_().getDataRange().getValues();
  const list = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    list.push({ id: String(v[i][0]), sid: String(v[i][2]), date: dateStr_(v[i][3]), time: String(v[i][4] || ''),
      ex: String(v[i][5]), target: Number(v[i][6]) || 0, sets: Number(v[i][7]) || 0, reps: String(v[i][8] || ''),
      total: Number(v[i][9]) || 0, source: String(v[i][10] || '') });
  }
  return list;
}
function studentExists_(sid) { return studentRows_().some(function (s) { return s.id === String(sid); }); }

// 판정기가 운동을 마치면 보냄. reps: 세트별 횟수 배열 [15,15,15]
function saveRecord(sid, ex, target, sets, reps) {
  if (!studentExists_(sid)) throw new Error('학생 정보를 찾지 못했어요.');
  if (!EXERCISES_[ex]) throw new Error('알 수 없는 운동이에요.');
  const arr = (Array.isArray(reps) ? reps : []).map(function (n) { return Math.max(0, Math.min(100, Math.round(Number(n) || 0))); }).slice(0, 10);
  const total = arr.reduce(function (a, b) { return a + b; }, 0);
  if (!total) throw new Error('기록할 횟수가 없어요.');
  recordsSheet_().appendRow([Utilities.getUuid(), new Date(), String(sid), today_(), nowTime_(), ex,
    Math.round(Number(target) || 0), Math.round(Number(sets) || arr.length), arr.join(','), total, 'camera']);
  return { ok: true, today: getStudentToday(sid, ex).total };
}
function getStudentToday(sid, ex) {
  const t = today_();
  const total = recordRows_().filter(function (r) { return r.sid === String(sid) && r.date === t && (!ex || r.ex === ex); })
    .reduce(function (a, r) { return a + r.total; }, 0);
  return { total: total, limit: settings_().dayLimit };
}
function getRecordsAdmin(token, limit) {
  admin_(token);
  const names = {}; studentRows_().forEach(function (s) { names[s.id] = s.name; });
  return recordRows_().slice(-Math.max(1, Math.min(500, Number(limit) || 200))).reverse()
    .map(function (r) { r.name = names[r.sid] || '(지운 학생)'; r.exName = EXERCISES_[r.ex] || r.ex; return r; });
}
function deleteRecord(token, id) {
  admin_(token);
  const sh = recordsSheet_(), v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === String(id)) { sh.deleteRow(i + 1); return { ok: true }; }
  throw new Error('기록을 찾지 못했어요.');
}

/************ 메인 화면 ************/
function ping() { return { shell: SHELL_VERSION, appUrl: APP_URL, title: ss_().getName() }; }
function getPublic() {
  const s = settings_();
  return { shell: SHELL_VERSION, className: s.className, reps: s.reps, sets: s.sets, rest: s.rest, dayLimit: s.dayLimit, message: s.message };
}
function getDashboard() {
  const students = studentRows_(), recs = recordRows_(), t = today_();
  // 이번 주(월요일부터)
  const d = new Date(t + 'T12:00:00'), dow = (d.getDay() + 6) % 7, monday = shiftDate_(t, -dow);
  const by = {};
  students.forEach(function (s) { by[s.id] = { id: s.id, name: s.name, number: s.number, total: 0, today: 0, week: 0, days: {} }; });
  const todayList = [];
  let todayCount = 0;
  recs.forEach(function (r) {
    const s = by[r.sid]; if (!s) return;
    s.total += r.total; s.days[r.date] = true;
    if (r.date >= monday) s.week += r.total;
    if (r.date === t) { s.today += r.total; todayCount++; todayList.push({ time: r.time, name: s.name, ex: EXERCISES_[r.ex] || r.ex, reps: r.reps, total: r.total }); }
  });
  const list = students.map(function (s) {
    const b = by[s.id];
    let streak = 0, day = b.days[t] ? t : shiftDate_(t, -1);
    while (b.days[day]) { streak++; day = shiftDate_(day, -1); }
    return { id: b.id, name: b.name, number: b.number, total: b.total, today: b.today, week: b.week, streak: streak };
  });
  const top = function (k) { const a = list.filter(function (x) { return x[k] > 0; }).sort(function (x, y) { return y[k] - x[k]; })[0]; return a ? { name: a.name, value: a[k] } : null; };
  const classTotal = list.reduce(function (a, s) { return a + s.total; }, 0);
  const classToday = list.reduce(function (a, s) { return a + s.today; }, 0);
  return {
    date: t, settings: getPublic(), students: list, classTotal: classTotal, classToday: classToday, todayCount: todayCount,
    leaders: { week: top('week'), today: top('today'), streak: top('streak') },
    todayList: todayList.reverse().slice(0, 12), repM: REP_M
  };
}

/************ 운동방 (구글 캐시에만 — 6시간 뒤 저절로 사라짐) ************/
function roomCode_() { return cache_().get('ROOM_CODE') || ''; }
function roomCheck_(code) { const c = roomCode_(); if (!c || String(code) !== c) throw new Error('열려 있는 운동방이 아니에요. 방 번호를 확인해 주세요.'); return c; }
function roomOpen(token) {
  admin_(token);
  let c = roomCode_();
  if (!c) { c = String(1000 + Math.floor(Math.random() * 9000)); cache_().put('ROOM_CODE', c, ROOM_TTL_SEC); }
  return { code: c, ttlHours: ROOM_TTL_SEC / 3600 };
}
function roomClose(token) {
  admin_(token);
  const c = roomCode_();
  if (c) {
    const keys = ['ROOM_CODE', 'R_' + c + '_task'].concat(studentRows_().map(function (s) { return 'R_' + c + '_m_' + s.id; }));
    cache_().removeAll(keys);
  }
  return { ok: true };
}
function roomSendTask(token, task) {
  admin_(token);
  const c = roomCode_(); if (!c) throw new Error('먼저 운동방을 열어 주세요.');
  const o = task || {};
  if (!EXERCISES_[o.ex]) throw new Error('알 수 없는 운동이에요.');
  const t = { id: Utilities.getUuid().slice(0, 8), ex: o.ex, reps: Math.max(1, Math.min(100, Number(o.reps) || 10)),
    sets: Math.max(1, Math.min(10, Number(o.sets) || 3)), rest: Math.max(5, Math.min(300, Number(o.rest) || 10)), at: Date.now() };
  cache_().put('R_' + c + '_task', JSON.stringify(t), ROOM_TTL_SEC);
  cache_().put('ROOM_CODE', c, ROOM_TTL_SEC);
  return t;
}
function roomStatus(token) {
  admin_(token);
  const c = roomCode_(); if (!c) return { open: false };
  const st = studentRows_();
  const got = cache_().getAll(['R_' + c + '_task'].concat(st.map(function (s) { return 'R_' + c + '_m_' + s.id; })));
  let task = null; try { task = JSON.parse(got['R_' + c + '_task'] || 'null'); } catch (e) {}
  const members = st.map(function (s) {
    let m = null; try { m = JSON.parse(got['R_' + c + '_m_' + s.id] || 'null'); } catch (e) {}
    const cur = m && task && m.task === task.id;
    return { id: s.id, name: s.name, number: s.number, joined: !!m, setsDone: cur ? m.setsDone : 0, finished: cur ? !!m.finished : false, at: m ? m.at : 0 };
  });
  return { open: true, code: c, task: task, members: members, now: Date.now() };
}
function roomInfo(code) {
  roomCheck_(code);
  return { className: settings_().className, students: getStudentsPublic() };
}
function roomJoin(code, sid) {
  const c = roomCheck_(code);
  if (!studentExists_(sid)) throw new Error('학생 정보를 찾지 못했어요.');
  const k = 'R_' + c + '_m_' + sid;
  let m = null; try { m = JSON.parse(cache_().get(k) || 'null'); } catch (e) {}
  cache_().put(k, JSON.stringify(m || { task: '', setsDone: 0, finished: false, at: Date.now() }), ROOM_TTL_SEC);
  return roomPoll(code, sid);
}
// 학생 기기가 3~5초마다 물어봄: 과제, 내 상태, 함께 들어온 친구들의 세트 완료 신호(번호 순 — 빠르기 비교가 아니라 '함께'를 보여 주려는 것)
function roomPoll(code, sid) {
  const c = roomCheck_(code);
  const st = studentRows_();
  const got = cache_().getAll(['R_' + c + '_task'].concat(st.map(function (s) { return 'R_' + c + '_m_' + s.id; })));
  let task = null; try { task = JSON.parse(got['R_' + c + '_task'] || 'null'); } catch (e) {}
  let me = null;
  const peers = [];
  st.forEach(function (s) {
    let m = null; try { m = JSON.parse(got['R_' + c + '_m_' + s.id] || 'null'); } catch (e) {}
    if (s.id === String(sid)) { me = m; return; }
    if (!m) return;
    const cur = task && m.task === task.id;
    peers.push({ name: s.name, setsDone: cur ? m.setsDone : 0, finished: cur ? !!m.finished : false });
  });
  return { task: task, me: me, peers: peers };
}
function roomProgress(code, sid, taskId, setsDone, finished) {
  const c = roomCheck_(code);
  cache_().put('R_' + c + '_m_' + sid, JSON.stringify({ task: String(taskId || ''), setsDone: Math.max(0, Math.min(10, Number(setsDone) || 0)), finished: !!finished, at: Date.now() }), ROOM_TTL_SEC);
  return { ok: true };
}
