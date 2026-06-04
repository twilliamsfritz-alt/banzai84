const CACHE='banzai-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/', '/static/style.css', '/static/app.js'])))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET') return; e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
