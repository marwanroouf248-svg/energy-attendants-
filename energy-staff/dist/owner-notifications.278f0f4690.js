// «إشعارات الإدارة» — مركز إشعارات للمالك فقط (نفس شرط صفحة المبيعات والتقارير).
// قراءة فقط: يجمع الأحداث من بيانات مساحة العمل التي يرسلها السيرفر أصلًا،
// ومن تقرير المبيعات الخاص بالمالك. لا يكتب أي شيء في بيانات التطبيق أو السيرفر؛
// علامات القراءة تُحفظ في متصفح المالك فقط (localStorage).
(()=>{
'use strict';
const SEEN_KEY='energyOwnerNotifSeenV1';
const SALES_CACHE_MS=5*60*1000;
const EVENT_WINDOW_MS=14*24*60*60*1000;
const MAX_EVENTS=40;
const PENDING=new Set(['معلق','pending']);
const isOwner=()=>typeof nodeUser!=='undefined'&&nodeUser&&nodeUser.role==='admin'&&Number(nodeUser.id)===1;
let salesCache={at:0,received_at:null,month:'',totals:null};
let panelEl=null,badgeEl=null,wrapped=false,panelOpen=false,openUnread=new Set();

function seenSet(){try{return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)||'[]'))}catch(e){return new Set()}}
function saveSeen(s){try{localStorage.setItem(SEEN_KEY,JSON.stringify([...s].slice(-300)))}catch(e){}}
function tsOf(){for(const c of arguments){if(!c)continue;const t=Date.parse(c);if(!isNaN(t))return t}return 0}
function staffName(id){const s=((typeof db!=='undefined'&&db&&db.staff)||[]).find(x=>String(x.id)===String(id));return s?String(s.name||''):''}
function rel(ts){if(!ts)return'';const m=Math.floor((Date.now()-ts)/60000);if(m<1)return'دلوقتي';if(m<60)return m===1?'من دقيقة':m===2?'من دقيقتين':'من '+m+' دقيقة';const h=Math.floor(m/60);if(h<24)return h===1?'من ساعة':h===2?'من ساعتين':'من '+h+' ساعات';const d=Math.floor(h/24);if(d===1)return'أمبارح';if(d===2)return'من يومين';if(d<11)return'من '+d+' أيام';return new Date(ts).toLocaleDateString('ar-EG',{day:'numeric',month:'long'})}

function collectEvents(){
  if(!isOwner()||typeof db==='undefined'||!db)return[];
  const out=[],since=Date.now()-EVENT_WINDOW_MS;
  const push=(key,icon,title,sub,ts,pageId)=>{if(!ts||ts<since)return;out.push({key,icon,title,sub,ts,pageId})};
  for(const r of (db.joinRequests||[])){
    if(!PENDING.has(String(r.status)))continue;
    push('join:'+r.id,'＋','طلب انضمام جديد: '+(r.name||''),[r.position,r.branch].filter(Boolean).join(' • '),tsOf(r.requestedAt,r.createdAt,r.ts),'join-approvals');
  }
  for(const r of (db.requests||[])){
    if(!PENDING.has(String(r.status)))continue;
    push('req:'+r.id,'▤','طلب '+(r.type||'جديد')+' من '+(r.name||staffName(r.employeeId)||'موظف'),'بانتظار المراجعة',tsOf(r.requestedAt,r.createdAt,r.ts),'requests');
  }
  for(const r of (db.overtimeRequests||[])){
    if(!PENDING.has(String(r.status)))continue;
    push('ovt:'+r.id,'◷','طلب تكملة شيفت من '+(r.name||staffName(r.employeeId)||'موظف'),'بانتظار المراجعة',tsOf(r.requestedAt,r.createdAt,r.ts),'requests');
  }
  for(const r of (db.shiftSwapRequests||[])){
    if(!PENDING.has(String(r.status)))continue;
    push('swap:'+r.id,'⇄','طلب تبديل وردية من '+(r.name||staffName(r.employeeId)||'موظف'),'بانتظار المراجعة',tsOf(r.requestedAt,r.createdAt,r.ts),'shift-swap');
  }
  for(const r of (db.managerRequests||[])){
    if(!PENDING.has(String(r.status)))continue;
    push('mgr:'+r.id,'⚿','طلب ربط حساب مدير: '+(r.name||''),'بانتظار موافقتك',tsOf(r.requestedAt,r.createdAt,r.ts),'accounts');
  }
  for(const r of (db.pointObjections||[])){
    if(!PENDING.has(String(r.status)))continue;
    push('obj:'+r.id,'◉','اعتراض على نقطة من '+(r.name||staffName(r.employeeId)||'موظف'),'بانتظار المراجعة',tsOf(r.requestedAt,r.createdAt,r.ts),'objections');
  }
  for(const f of (db.faultReports||[])){
    if(String(f.status)!=='open')continue;
    push('fault:'+f.id,'⚒','بلاغ عطل — '+(f.branch||''),String(f.title||f.equipment||f.asset||''),tsOf(f.createdAt,f.reportedAt,f.ts),'faults');
  }
  for(const p of (db.points||[])){
    const red=/red|حمرا/i.test(String(p.kind||p.color||p.type||''));
    push('point:'+p.id,red?'▲':'◉','نقطة '+(red?'حمراء':'خضراء')+' لـ '+(p.name||staffName(p.employeeId)||'موظف'),String(p.reason||''),tsOf(p.createdAt,p.at,p.ts),'score');
  }
  for(const p of (db.punches||[]).filter(p=>p.autoClosed||p.closeSource==='auto'||p.source==='auto-cap').slice(-10)){
    if(false)continue;
    push('auto:'+p.id,'◷','وردية '+(p.name||staffName(p.employeeId)||'موظف')+' اتقفلت تلقائيًا','وصلت للحد الأقصى للشيفت — راجع سجل الحضور',tsOf(p.autoClosedAt,p.out,p.in),'records');
  }
  const recentClosed=(db.payrollRuns||[]).filter(r=>String(r.status)==='closed')
    .sort((a,b)=>tsOf(b.closedAt,b.createdAt,b.ts)-tsOf(a.closedAt,a.createdAt,a.ts)).slice(0,10);
  for(const r of recentClosed){
    const net=r.calculation&&typeof r.calculation.total==='number'?Math.round(r.calculation.total/100):null;
    const month=r.period&&r.period.to?String(r.period.to).slice(0,7):'';
    push('pay:'+r.id,'▣','اتقفل مرتب '+(r.employeeName||staffName(r.employeeId)||'موظف'),[r.branch,net!=null?('صافي '+net.toLocaleString('en-US')+' ج.م'):'',month].filter(Boolean).join(' • '),tsOf(r.closedAt,r.createdAt,r.ts),'payroll');
  }
  if(salesCache.received_at){
    const t=salesCache.totals;
    push('sales:'+salesCache.received_at,'◈','تقرير المبيعات اتحدّث'+(salesCache.month?(' — '+salesCache.month):''),t?('إجمالي '+Number(t.gross).toLocaleString('en-US')+' • صافي '+Number(t.net).toLocaleString('en-US')):'',tsOf(salesCache.received_at),'sales-report');
  }
  return out.sort((a,b)=>b.ts-a.ts).slice(0,MAX_EVENTS);
}

async function refreshSales(force){
  if(!isOwner()||typeof nodeApi!=='function')return;
  if(!force&&Date.now()-salesCache.at<SALES_CACHE_MS)return;
  salesCache.at=Date.now();
  try{
    const r=await nodeApi('sales-report');
    salesCache.received_at=r.received_at||null;
    salesCache.month=r.month||(r.snapshot&&r.snapshot.month)||'';
    const t=r.snapshot&&r.snapshot.totals;
    salesCache.totals=t?{gross:t.gross,net:t.gym_net}:null;
  }catch(e){}
}

function escT(s){return typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

function ensureStyles(){
  if(document.getElementById('ownerNotifStyles'))return;
  const st=document.createElement('style');st.id='ownerNotifStyles';
  st.textContent='#ownerBell{position:relative}'
  +'.onp-badge{position:absolute;top:-6px;left:-6px;min-width:17px;height:17px;border-radius:9px;background:#b3261e;color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 4px;pointer-events:none}'
  +'#ownerNotifPanel{position:absolute;top:calc(100% + 14px);left:0;width:340px;max-width:88vw;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 38px rgba(10,20,15,.22);z-index:70;overflow:hidden;text-align:right}'
  +'[data-theme="dark"] #ownerNotifPanel{background:#171712}'
  +'.onp-head{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-bottom:1px solid var(--line)}'
  +'.onp-head strong{font-size:13px}'
  +'.onp-head button{font-size:10px;color:var(--green);background:transparent;padding:3px}'
  +'.onp-list{max-height:380px;overflow:auto}'
  +'.onp-item{display:flex;gap:11px;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer;align-items:flex-start}'
  +'.onp-item:last-child{border-bottom:0}'
  +'.onp-item:hover{filter:brightness(.97)}'
  +'.onp-item.unread{background:rgba(23,105,78,.06)}'
  +'[data-theme="dark"] .onp-item.unread{background:rgba(217,183,95,.08)}'
  +'.onp-ico{width:30px;height:30px;border-radius:9px;background:#f1f5ee;color:var(--green);display:grid;place-items:center;font-size:14px;flex:none}'
  +'[data-theme="dark"] .onp-ico{background:#232115}'
  +'.onp-item p{margin:0;font-size:11px;color:var(--ink);line-height:1.7;font-weight:600}'
  +'.onp-item small{color:var(--muted);font-size:9px;display:block;line-height:1.7}'
  +'.onp-time{margin-right:auto;color:var(--muted);font-size:9px;white-space:nowrap;padding-top:3px}'
  +'.onp-empty{padding:28px;text-align:center;color:var(--muted);font-size:11px}';
  document.head.appendChild(st);
}

function ensureOwnerBell(){
  let b=document.getElementById('ownerBell');
  if(b)return b;
  const ref=document.querySelector('#bell');
  if(!ref||!ref.parentElement)return null;
  b=document.createElement('button');
  b.id='ownerBell';b.type='button';b.setAttribute('aria-label','إشعارات العمل');b.textContent='♧';
  ref.parentElement.insertBefore(b,ref);
  return b;
}

function updateBell(){
  if(!isOwner()){
    const ob=document.getElementById('ownerBell');if(ob)ob.remove();
    badgeEl=null;closePanel();return;
  }
  ensureStyles();
  const bell=ensureOwnerBell();if(!bell)return;
  bell.onclick=e=>{e.stopPropagation();togglePanel()};
  const unread=collectEvents().filter(e=>!seenSet().has(e.key)).length;
  if(unread>0){
    if(!badgeEl){badgeEl=document.createElement('span');badgeEl.className='onp-badge';bell.appendChild(badgeEl)}
    badgeEl.textContent=unread>99?'99+':String(unread);
  }else if(badgeEl){badgeEl.remove();badgeEl=null}
}

function renderPanelList(){
  if(!panelEl)return;
  const list=panelEl.querySelector('.onp-list');if(!list)return;
  const events=collectEvents();
  if(!events.length){list.innerHTML='<div class="onp-empty">مفيش إشعارات. كله تحت السيطرة ✓</div>';return}
  list.innerHTML=events.map((e,i)=>'<div class="onp-item'+(openUnread.has(e.key)?' unread':'')+'" data-i="'+i+'">'
    +'<span class="onp-ico">'+e.icon+'</span>'
    +'<div><p>'+escT(e.title)+'</p>'+(e.sub?'<small>'+escT(e.sub)+'</small>':'')+'</div>'
    +'<span class="onp-time">'+rel(e.ts)+'</span></div>').join('');
  list.querySelectorAll('.onp-item').forEach(el=>{el.onclick=()=>{
    const ev=events[Number(el.dataset.i)];
    if(ev&&ev.pageId&&typeof navs!=='undefined'&&navs.some(n=>n[0]===ev.pageId)){page=ev.pageId;render()}
    closePanel();
  }});
}

function openPanel(){
  const bell=ensureOwnerBell();if(!bell||!isOwner())return;
  ensureStyles();closePanel();
  const host=bell.parentElement;host.style.position='relative';
  panelEl=document.createElement('div');panelEl.id='ownerNotifPanel';
  panelEl.innerHTML='<div class="onp-head"><strong>الإشعارات</strong><button type="button" class="onp-readall">تمييز الكل كمقروء</button></div><div class="onp-list"></div>';
  host.appendChild(panelEl);panelOpen=true;
  const events=collectEvents(),s=seenSet();
  openUnread=new Set(events.filter(e=>!s.has(e.key)).map(e=>e.key));
  renderPanelList();
  events.forEach(e=>s.add(e.key));saveSeen(s);updateBell();
  refreshSales(false).then(()=>{if(panelOpen)renderPanelList()});
  panelEl.querySelector('.onp-readall').onclick=()=>{const s2=seenSet();collectEvents().forEach(e=>s2.add(e.key));saveSeen(s2);openUnread=new Set();renderPanelList();updateBell()};
}
function closePanel(){if(panelEl){panelEl.remove();panelEl=null}panelOpen=false}
function togglePanel(){panelOpen?closePanel():openPanel()}

function tryWrap(){
  if(wrapped||typeof render!=='function')return;
  const prev=render;
  render=function(){const r=prev.apply(this,arguments);try{updateBell();if(panelOpen)renderPanelList()}catch(e){}return r};
  wrapped=true;
}
if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{
    if(!panelOpen||!panelEl)return;
    const bell=document.getElementById('ownerBell');
    if(panelEl.contains(e.target)||(bell&&bell.contains(e.target)))return;
    closePanel();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel()});
  tryWrap();
  if(!wrapped){const t=setInterval(()=>{tryWrap();if(wrapped)clearInterval(t)},500)}
  setInterval(()=>{
    if(document.hidden||!isOwner())return;
    refreshSales(false).then(()=>{updateBell();if(panelOpen)renderPanelList()});
  },60000);
  updateBell();
}
globalThis.__ownerNotif={collect:collectEvents,update:updateBell,open:openPanel,refreshSales};
})();
