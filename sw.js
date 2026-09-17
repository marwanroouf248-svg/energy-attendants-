const CACHE='gym-staff-disable-v4';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.pathname==='/'||url.pathname.endsWith('/index.html')){
    event.respondWith(fetch(event.request).then(async r=>{
      const type=r.headers.get('content-type')||'';
      if(!type.includes('text/html')) return r;
      const text=await r.text();
      const updated=text
        .replaceAll('>سيلز</button>','>sales</button>')
        .replaceAll('>كوتش</button>','>coach</button>')
        .replaceAll('>هاوس كيبنج</button>','>House Keeping</button>');
      return new Response(updated,{status:r.status,statusText:r.statusText,headers:r.headers});
    }));
  }
});
