/* 위 Down 서비스 워커 — 바탕화면·홈 화면에 앱으로 설치할 수 있게 함
   · 같은 출처 파일(화면·아이콘): 인터넷 먼저, 안 되면 기억해 둔 것 (늘 최신 화면을 씀)
   · 학교 시트(구글) 요청과 관절 인식 모델은 손대지 않음 — 기록은 늘 학교 시트로 바로 감 */
var C = 'wedown-shell';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (r) {
    if (r.ok) { var copy = r.clone(); caches.open(C).then(function (c) { c.put(req, copy); }); }
    return r;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (m) { return m || Response.error(); });
  }));
});
