# 2단계 전체 시험 — 코드 검사 + 판정 시험 + 시험 서버를 띄워 화면을 실제로 밟아 봄
#   python3 tests/full.py
# 필요: node, python3 playwright(크로미움). 진짜 학교 시트는 건드리지 않고 가짜 시트로 돌림.
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
PORT = 8799; S = f'http://localhost:{PORT}/exec'; B = f'http://localhost:{PORT}/wedown/?s=' + S
OK, BAD = [], []
def chk(name, cond, info=''): (OK if cond else BAD).append(name + ('' if cond else '  ← ' + str(info)[:160]))
def rpc(fn, a=[]):
    r = json.loads(urllib.request.urlopen(urllib.request.Request(S, data=json.dumps({'fn': fn, 'args': a}).encode(), method='POST')).read())
    if not r.get('ok'): raise Exception(fn + ': ' + str(r.get('error')))
    return r['result']
# 판정기 세트를 빨리 감기: 카메라·모델 없이 횟수를 1씩 올리고 화면 그리기를 돌림
FAST = """()=>{ cover.classList.add('hide'); window.__f=setInterval(()=>{ if(running){ const tt=(performance.now()-t0)/1000;
  if(S.mode==='set'){ judge.count+=1; if(judge.held!==undefined){ judge.held+=1; judge.good=true; judge.pose='ok'; } } judge.lastT=tt; paint(judge.state(),tt); }
  if(S.mode==='count'||S.mode==='rest') S.until=Math.min(S.until,performance.now()+200); },40); }"""
async def end_wait(pg):
    for _ in range(120):
        await pg.wait_for_timeout(250)
        if await pg.evaluate("()=>endModal.classList.contains('on') && !/보내는 중/.test(endSaved.textContent)"): return True
    return False

async def flows():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(permissions=['camera']); errs = []
        async def page(w=1280, h=900):
            pg = await ctx.new_page(); await pg.set_viewport_size({'width': w, 'height': h})
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        # ── 관리자
        t = await page(); await t.goto(B + '&page=admin'); await t.fill('#pw', '1234'); await t.click('#login'); await t.wait_for_selector('#anav'); chk('관리자 로그인', True)
        await t.click('#anav button[data-tab="plan"]'); await t.select_option('#sReps', '5'); await t.select_option('#sSets', '2'); await t.select_option('#sRest', '10'); await t.click('#savePlan')
        await t.select_option('#sPlank', '10'); await t.click('#savePlank'); await t.select_option('#sLimit', '50'); await t.click('#saveLimit')
        await t.click('#anav button[data-tab="basic"]'); await t.fill('#sClass', '햇살초 6-1'); await t.click('#saveClass'); await t.fill('#sMsg', '시험 한마디'); await t.click('#saveMsg'); await t.wait_for_timeout(800)
        pub = rpc('getPublic'); chk('관리자 설정 저장', pub['reps'] == 5 and pub['sets'] == 2 and pub['plankSec'] == 10 and pub['dayLimit'] == 50 and pub['className'] == '햇살초 6-1' and pub['message'] == '시험 한마디', pub)
        await t.click('#anav button[data-tab="register"]'); await t.fill('#bulk', '학년\t반\t번호\t이름\t비밀번호\n6\t1\t1\t가람\n6\t1\t2\t나래\t5555\n5\t2\t1\t다솜'); await t.wait_for_timeout(200)
        await t.click('#bulkAdd'); await t.wait_for_timeout(1500)
        st = {s['name']: s for s in rpc('getStudentsPublic')}; chk('학생 등록(엑셀 붙여넣기)', all(n in st for n in ['가람', '나래', '다솜']), list(st))
        chk('학생 비밀번호 기본 1234·직접 정한 값', rpc('checkStudentPw', [st['가람']['id'], '1234'])['ok'] and rpc('checkStudentPw', [st['나래']['id'], '5555'])['ok'])
        await t.click('#anav button[data-tab="students"]'); tr = t.locator('tr', has=t.locator('input[value="다솜"]')); await tr.locator('input[data-k="number"]').fill('7'); await tr.locator('[data-save]').click(); await t.wait_for_timeout(1200)
        chk('학생 고치기', [s for s in rpc('getStudentsPublic') if s['name'] == '다솜'][0]['number'] == 7)
        await t.click('#anav button[data-tab="students"]'); await t.click(f'[data-pwr="{st["나래"]["id"]}"]'); await t.wait_for_timeout(800)
        chk('비밀번호 초기화(한 명)', rpc('checkStudentPw', [st['나래']['id'], '1234'])['ok'])
        # ── 메인 → 판정기 → 학교 기록
        pg = await page(390, 844); await pg.goto(B); await pg.wait_for_selector('#names'); await pg.evaluate("localStorage.clear()"); await pg.goto(B); await pg.wait_for_selector('#names')
        await pg.click('[data-mex="squat"]'); await pg.select_option('#pickG', '6'); await pg.wait_for_selector('#pickS'); await pg.select_option('#pickS', st['가람']['id']); await pg.wait_for_selector('#stuPw')
        await pg.fill('#stuPw', '0000'); await pg.click('#goCam'); await pg.wait_for_timeout(700); chk('틀린 비밀번호는 막기', 'checker' not in pg.url)
        await pg.fill('#stuPw', '1234'); await pg.click('#goCam'); await pg.wait_for_url('**/checker/**'); chk('메인 → 판정기 이동', True)
        info = await pg.evaluate("()=>({ex, reps:S.reps, sets:S.sets, name:LINK.name})"); chk('판정기에 선생님 계획 고정', info == {'ex': 'squat', 'reps': 5, 'sets': 2, 'name': '가람'}, info)
        await pg.evaluate(FAST); await pg.evaluate("()=>startSession()"); chk('세트 진행·끝', await end_wait(pg))
        saved = await pg.inner_text('#endSaved'); chk('학교 기록 저장 알림', '담았' in saved or '저장' in saved, saved)
        chk('학교 시트에 오늘 10회', rpc('getStudentToday', [st['가람']['id'], 'squat'])['total'] == 10)
        # ── 하루 안내(기준 50)
        for _ in range(4): rpc('saveRecord', [st['가람']['id'], 'squat', 5, 2, [5, 5]])
        p2 = await page(390, 844); await p2.goto(B); await p2.wait_for_selector('#pickS'); await p2.select_option('#pickS', st['가람']['id']); await p2.fill('#stuPw', '1234'); await p2.click('#goCam'); await p2.wait_for_url('**/checker/**')
        await p2.evaluate("()=>cover.classList.add('hide')"); await p2.evaluate("()=>startSession()"); await p2.wait_for_timeout(800)
        chk('하루 안내 기준 넘으면 안내', await p2.evaluate("()=>warnModal.classList.contains('on')"))
        # ── 플랭크(초)
        p3 = await page(390, 844); await p3.goto(B); await p3.wait_for_selector('#pickS'); await p3.click('[data-mex="plank"]'); await p3.select_option('#pickS', st['가람']['id']); await p3.fill('#stuPw', '1234'); await p3.click('#goCam'); await p3.wait_for_url('**/checker/**')
        pi = await p3.evaluate("()=>({ex, reps:S.reps})"); chk('플랭크 목표 시간 = 선생님 설정', pi == {'ex': 'plank', 'reps': 10}, pi)
        await p3.evaluate(FAST); await p3.evaluate("()=>startSession()"); chk('플랭크 세트 끝', await end_wait(p3))
        chk('플랭크 초로 저장', rpc('getStudentToday', [st['가람']['id'], 'plank'])['total'] == 20)
        # ── 운동방
        await t.goto(B + '&page=room'); await t.wait_for_selector('[data-tex="lunge"]'); await t.click('[data-tex="lunge"]'); await t.click('#sendTask'); await t.wait_for_timeout(800)
        code = await t.evaluate("()=>document.querySelector('.code').textContent.replace(/\\s/g,'')")
        jp = await page(390, 844); await jp.goto(B + '&page=join&code=' + code); await jp.wait_for_selector('#pickG'); await jp.select_option('#pickG', '5'); await jp.wait_for_selector('#pickS'); await jp.select_option('#pickS', st['다솜']['id'])
        await jp.fill('#joinPw', '1234'); await jp.click('#pwGo'); await jp.wait_for_selector('#startTask', timeout=8000); chk('운동방 입장(비밀번호)', True)
        await jp.click('#startTask'); await jp.wait_for_url('**/checker/**'); ri = await jp.evaluate("()=>({ex,room:LINK.room})"); chk('운동방 과제로 판정기 열기', ri['ex'] == 'lunge' and bool(ri['room']), ri)
        await jp.evaluate(FAST); await jp.evaluate("()=>startSession()"); chk('운동방 세트 끝', await end_wait(jp))
        await t.wait_for_timeout(3800); chk('선생님 화면에 끝 신호', '끝' in await t.inner_text('body'))
        # ── 혼자 쓰는 판정기
        c = await page(1366, 768); await c.goto(f'http://localhost:{PORT}/wedown/checker/'); await c.wait_for_timeout(300)
        exs = await c.evaluate("()=>EXS"); bad = []
        for x in exs:
            try:
                if not await c.evaluate("(x)=>{ setEx(x); return ex===x && !!judge && typeof judge.push==='function'; }", x): bad.append(x)
            except Exception: bad.append(x)
        chk('판정기 종목 모두 바꾸기 (' + str(len(exs)) + '종목)', not bad, bad)
        await c.evaluate("()=>setEx('squat')"); await c.evaluate(FAST); await c.evaluate("()=>startSession()"); chk('혼자 쓰기 세트 끝', await end_wait(c))
        chk('기록장에 저장', await c.evaluate("()=>Object.keys(localStorage).some(k=>/log/i.test(k)&&localStorage.getItem(k).length>2)"))
        # ── 메인·놀이터·화면 폭
        mp = await page(1366, 768); await mp.goto(B); await mp.wait_for_selector('#ropeArea'); await mp.click('#mainQrBtn'); chk('학생 QR 띄우기', await mp.query_selector('#qrOv') is not None)
        chk('메인에 오늘 기록 보임', '가람' in await mp.inner_text('body'))
        gp = await page(); r = await gp.goto(f'http://localhost:{PORT}/wedown/games/'); await gp.wait_for_timeout(500); chk('바다 놀이터 열림', r.status == 200)
        wide = []
        for (w, h) in [(390, 844), (820, 1180), (1366, 768)]:
            for u in [B, B + '&page=join', f'http://localhost:{PORT}/wedown/checker/']:
                q = await page(w, h); await q.goto(u); await q.wait_for_timeout(700)
                if await q.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1"): wide.append(f'{w}px {u.split("/wedown/")[1][:30]}')
                await q.close()
        chk('화면이 옆으로 밀리지 않음(휴대폰·태블릿·노트북)', not wide, wide)
        await b.close()
        real = [e for e in errs if not any(k in e for k in ['QRCode', 'vision', 'Failed to fetch', 'mediapipe', 'tasks-vision', 'NetworkError'])]
        chk('화면 오류(자바스크립트) 없음', not real, real[:3])

def main():
    print('── 1) 코드 검사'); r1 = subprocess.run(['node', os.path.join(HERE, 'check.js')]); chk('코드 검사', r1.returncode == 0)
    print('── 2) 판정 시험'); r2 = subprocess.run(['node', os.path.join(HERE, 'judge.test.js')]); chk('판정 시험', r2.returncode == 0)
    print('── 3) 화면 시험 (가짜 시트로)')
    srv = subprocess.Popen(['node', os.path.join(HERE, 'mock-server.js'), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(40):
            try: urllib.request.urlopen(f'http://localhost:{PORT}/wedown/'); break
            except Exception: time.sleep(.2)
        asyncio.run(flows())
    except Exception as e: chk('화면 시험 진행', False, e)
    finally: srv.terminate()
    print('\n전체 시험 — 통과 ' + str(len(OK)) + ' / 문제 ' + str(len(BAD)))
    for x in BAD: print('  ✗ ' + x)
    if '-v' in sys.argv:
        for x in OK: print('  ✓ ' + x)
    sys.exit(1 if BAD else 0)
main()
