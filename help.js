/* 위 Down 사용 안내 — 휘슬·리더스와 같은 방식: 어느 화면에서나 "? 사용 안내"
   학교 화면(index.html)·판정기(checker/)·바다 놀이터(games/)가 같이 씀.
   WD_HELP.btn()  단추 HTML  /  [data-wdhelp] 를 누르면 창이 열림 */
(function () {
  var SCRIPT = document.currentScript;
  var ROOT = SCRIPT && SCRIPT.src ? SCRIPT.src.replace(/help\.js(\?.*)?$/, '') : './';
  var DEMO = /[?&]demo(=|&|$)/.test(location.search) || /[?&]s=demo(&|$)/.test(location.search);

  var HELP = [
    ['학생에게 알려 주기 (선생님)', [
      '메인 화면 위쪽 "학생 QR"을 누르면 큰 QR이 떠요. 학생이 휴대폰·태블릿 카메라로 찍으면 우리 반 화면이 열려요.',
      '"관리자" → "기본 설정"에서 "주소 복사"로 주소를 알림장이나 학급 채팅방에 올려도 돼요.']],
    ['운동 계획 정하기 (선생님)', [
      '"관리자" → "운동 계획"에서 "한 세트 횟수"·"세트 수"·"세트 사이 쉬기"를 고르고 "저장"을 눌러요.',
      '플랭크·외발 서기는 "버티기 목표 시간"으로 정해요. 자세가 맞는 동안만 초가 올라가요.',
      '"하루 안내 기준"은 같은 종목을 하루에 이만큼 넘게 하려 할 때 쉬어 가라는 안내를 띄우는 기준이에요.']],
    ['나 Down으로 운동하기 (학생)', [
      '메인 화면 "나 Down"에서 종목을 고르고, 학년·반·내 이름을 골라요.',
      '비밀번호를 넣고 "카메라로 시작하기"를 누르면 판정기가 열려요. 선생님이 정한 횟수·세트가 미리 들어 있어요.']],
    ['판정기에서 세기 (학생)', [
      '기기를 세워 두고 2~3m 떨어져 몸 전체가 보이게 서요. 방향은 상관없어요.',
      '"시작"을 누르면 5초를 센 뒤 세트 → 쉬기 → 다음 세트로 이어져요. 제대로 한 동작만 세요.',
      '다 끝나면 학교 기록에 저절로 담겨요. 영상은 이 기기 안에서만 처리하고 어디에도 보내지 않아요.']],
    ['하루 안내 (학생)', [
      '같은 종목을 많이 하면 "잠깐만요" 창이 떠요. 몸 상태를 한 번 살피라는 안내예요.',
      '"괜찮아요, 할게요"를 누르면 그대로 할 수 있어요. 막지 않아요.']],
    ['운동방 열기 (선생님)', [
      '"운동방 열기"를 누르면 방 번호와 QR이 나와요. 학생들이 각자 기기로 들어와요.',
      '종목과 횟수·세트를 고르고 "모두에게 보내기"를 누르면 학생 기기에 과제가 떠요.',
      '선생님 화면에는 숫자 대신 "1세트 완료", "끝!" 같은 신호만 보여요. 빠르기를 겨루지 않아요.']],
    ['운동방 들어가기 (학생)', [
      'QR을 찍거나 방 번호 네 자리를 넣고, 내 이름과 비밀번호를 골라 들어가요.',
      '과제가 오면 "카메라로 시작하기"를 눌러요. 다 하면 선생님 화면에 "끝!"이 떠요.']],
    ['바다 깊이 보기', [
      '한 번 할 때마다 우리 반이 40cm씩 바다로 내려가요. 플랭크·외발 서기는 2초가 한 번이에요.',
      '메인 화면에서 우리 반 수심, 친구마다 다이빙 줄, 이번 주 부위별 운동을 볼 수 있어요.']],
    ['비밀번호를 잊었을 때 · 새 학년', [
      '학생 비밀번호는 처음에 1234예요. 잊으면 "관리자" → "학생 관리"에서 "비번 초기화"(한 명) 또는 "비밀번호 일괄 초기화 (모두 1234)"를 눌러요.',
      '선생님 비밀번호는 "관리자" → "비밀번호"에서 바꿔요.',
      '새 학년에는 "학생 관리"에서 학생을 지우고 "학생 등록"으로 새로 넣어요. 지난 기록은 학교 시트 Records 탭에 남아요.']]
  ];

  var css =
    '.wdhelp-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;border:0;background:none;box-shadow:none;padding:0 8px;margin:0;font:inherit;font-size:14px;font-weight:700;color:var(--ink,#0E2A44);cursor:pointer;border-radius:8px;text-decoration:none;white-space:nowrap;flex:none;width:auto;transform:none}' +
    '.wdhelp-btn:hover{text-decoration:underline;background:none}.wdhelp-btn:active{transform:none}.wdhelp-btn:focus-visible{outline:3px solid var(--sea,#139AAE);outline-offset:1px}' +
    '.wdhelp-qm{width:20px;height:20px;border-radius:50%;background:#111;color:#fff;font-size:13px;font-weight:900;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:none}' +
    '.wdhelp-shade{position:fixed;inset:0;z-index:200;background:rgba(7,26,46,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.wdhelp-sheet{background:var(--card,#fff);color:var(--ink,#0E2A44);font-family:var(--ui,inherit);border-radius:20px;max-width:620px;width:100%;max-height:calc(100dvh - 32px);overflow:auto;padding:20px 22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 18px 50px rgba(7,26,46,.3);text-align:left;-webkit-user-select:text;user-select:text}' +
    '.wdhelp-head{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
    '.wdhelp-head h2{margin:0;font-size:20px;font-weight:800;color:var(--ink,#0E2A44)}' +
    '.wdhelp-x{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--line,#D3E6EE);background:var(--card,#fff);color:var(--ink2,#3C5A70);font:inherit;font-size:14px;font-weight:700;cursor:pointer;width:auto;box-shadow:none}' +
    '.wdhelp-sheet section{border-top:1px solid var(--line,#D3E6EE);padding-top:10px}' +
    '.wdhelp-sheet h3{font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;margin:0 0 6px;color:var(--ink,#0E2A44)}' +
    '.wdhelp-num{width:24px;height:24px;border-radius:6px;background:var(--ink,#0E2A44);color:#fff;font-size:14px;display:inline-flex;align-items:center;justify-content:center;flex:none}' +
    '.wdhelp-sheet ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px}' +
    '.wdhelp-sheet li{font-size:14px;line-height:1.55;color:var(--ink2,#3C5A70)}' +
    '.wdhelp-foot{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line,#D3E6EE);padding-top:12px}' +
    '.wdhelp-demo{display:flex;align-items:center;justify-content:center;min-height:46px;border-radius:12px;border:1px solid var(--line,#D3E6EE);color:var(--navy,#0E3A63);font-weight:700;text-decoration:none;font-size:15px}' +
    '.wdhelp-demo:hover{text-decoration:underline}' +
    '.wdhelp-ok{min-height:48px;border-radius:12px;border:0;background:var(--navy,#0E3A63);color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer;width:100%;box-shadow:none}';
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function close() { var o = document.getElementById('wdHelp'); if (o) o.remove(); if (last && last.focus) try { last.focus(); } catch (e) {} }
  var last = null;
  function open() {
    close(); last = document.activeElement;
    var o = document.createElement('div'); o.id = 'wdHelp'; o.className = 'wdhelp-shade';
    o.innerHTML = '<div class="wdhelp-sheet" role="dialog" aria-modal="true" aria-label="사용 안내">' +
      '<div class="wdhelp-head"><h2>위 Down 간략 사용법</h2><button class="wdhelp-x" type="button" data-wdhelp-close>닫기</button></div>' +
      HELP.map(function (h, i) { return '<section><h3><span class="wdhelp-num">' + (i + 1) + '</span>' + esc(h[0]) + '</h3><ul>' + h[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>'; }).join('') +
      '<div class="wdhelp-foot">' + (DEMO ? '' : '<a class="wdhelp-demo" href="' + ROOT + '?demo" target="_blank" rel="noopener">지어낸 학급으로 미리 눌러 보기</a>') +
      '<button class="wdhelp-ok" type="button" data-wdhelp-close>확인</button></div></div>';
    o.addEventListener('click', function (ev) { if (ev.target === o || ev.target.closest('[data-wdhelp-close]')) close(); });
    document.body.appendChild(o);
    o.querySelector('.wdhelp-x').focus();
  }
  document.addEventListener('click', function (ev) { var b = ev.target.closest && ev.target.closest('[data-wdhelp]'); if (b) { ev.preventDefault(); open(); } });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && document.getElementById('wdHelp')) { ev.stopPropagation(); close(); } }, true);

  window.WD_HELP = {
    items: HELP.length, open: open, close: close,
    btn: function (cls) { return '<button class="wdhelp-btn' + (cls ? ' ' + cls : '') + '" type="button" data-wdhelp><span class="wdhelp-qm" aria-hidden="true">?</span>사용 안내</button>'; }
  };
})();
