const CACHE='gym-staff-disable-v3';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key))))
    .then(()=>self.registration.unregister())
    .then(()=>self.clients.matchAll({type:'window'}))
    .then(clients=>Promise.all(clients.map(client=>client.navigate(client.url))))
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(fetch(event.request));
});
