var CACHE = "sos-heli-inventaire-v1.2";
self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"]);
  }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(function(r){
    if(r) return r;
    return fetch(e.request).then(function(resp){
      if(resp.ok && new URL(e.request.url).origin === self.location.origin){
        var cp = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, cp); });
      }
      return resp;
    }).catch(function(){ return caches.match("./index.html"); });
  }));
});
