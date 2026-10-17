(()=>{
const prior=render;
const e=v=>esc(String(v??''));
function employeeHome(){
if(!nodeUser||nodeUser.role!=='employee')return;
const nav=document.querySelector('#nav');
if(nav&&!nav.querySelector('[data-employee-tools]')){
const b=document.createElement('button');b.dataset.employeeTools='1';b.textContent='◉ الحضور والبريكات وطلباتي';b.onclick=()=>{page='my-tools';render()};nav.append(b);
}
if(page!=='my-tools')return;
const id=Number(nodeUser.id),person=db.staff.find(s=>Number(s.id)===id);
if(!person)return;
const punch=(db.punches||[]).find(p=>Number(p.employeeId)===id&&!p.out);
const pause=(db.breaks||[]).find(p=>Number(p.employeeId)===id&&!p.end);
const mine=(db.points||[]).filter(p=>Number(p.employeeId)===id&&!p.voidedAt);
const green=mine.filter(p=>p.color==='green').reduce((s,p)=>s+Number(p.amount||0),0);
const red=mine.filter(p=>p.color==='red').reduce((s,p)=>s+Number(p.amount||0),0);
const ratio=Math.max(1,Number(db.rules?.greenToCancel||1));
const left=Math.max(0,red-Math.floor(green/ratio));
const requests=(db.requests||[]).filter(r=>Number(r.employeeId)===id);
const app=document.querySelector('#app');if(!app)return;
app.innerHTML='<section class="mytools" dir="rtl"><span class="mytools-label">ENERGY PLUS · MY DAY</span><h2>يومك في إيدك ✦</h2><p>كل أدوات يومك في مكان واحد — حساب '+e(person.name)+' / '+e(person.branch)+'</p><div class="mytools-grid"><article><span>الحضور والانصراف</span><strong>'+(punch?'حاضر الآن':'خارج الوردية')+'</strong><p>تسجيل الحضور الحقيقي مرتبط بموقع الفرع ودقة GPS.</p><div class="mytools-actions"><button id="myCheckIn" '+(punch?'disabled':'')+'>تسجيل حضور</button><button id="myCheckOut" '+(!punch||pause?'disabled':'')+'>تسجيل انصراف</button></div></article><article><span>البريكات</span><strong>'+(pause?'البريك شغال':'لا يوجد بريك مفتوح')+'</strong><p>البريك مدفوع ولا يخصم من ساعات العمل أو المرتب.</p><div class="mytools-actions"><button id="myBreakStart" '+(!punch||pause?'disabled':'')+'>بدء البريك</button><button id="myBreakEnd" '+(!pause?'disabled':'')+'>إنهاء البريك</button></div></article><article><span>النقاط الخضراء</span><strong class="mytools-green">'+green+'</strong><p>نقاط الالتزام المسجلة</p></article><article><span>النقاط الحمراء</span><strong class="mytools-red">'+red+'</strong><p>المتبقي بعد التعويض بالنقاط الخضراء: '+left+'</p></article></div><div class="mytools-requests"><header><h3>الأذونات والإجازات</h3><button id="myRequest">＋ تقديم طلب</button></header>'+(requests.map(r=>'<div class="mytools-request"><strong>'+e(r.type)+'</strong><span>'+e(r.status)+'</span><p>'+e(r.detail)+'</p></div>').join('')||'<p>لسه مفيش أذونات أو طلبات مسجلة.</p>')+'</div><p class="mytools-hint">النقاط لا تتحول لخصم مالي تلقائي. لا يمكن تسجيل حضور GPS قبل تحديد إحداثيات الفرع الحقيقية.</p></section>';
const byId=id=>document.getElementById(id);
byId('myCheckIn').onclick=()=>punch();
byId('myCheckOut').onclick=()=>punch();
byId('myBreakStart').onclick=()=>startBreak(id);
byId('myBreakEnd').onclick=()=>endBreak(id);
byId('myRequest').onclick=()=>requestForEmployee();
}
render=function(){const selected=page;if(selected==='my-tools')page='overview';prior();page=selected;employeeHome()};
const css=document.createElement('style');css.textContent='.mytools{padding:clamp(18px,3vw,32px);background:linear-gradient(150deg,#1a1a16,#090a09);border:1px solid #6b572d;border-radius:24px;color:#f8efde}.mytools-label{font-size:12px;letter-spacing:2px;color:#e7c680}.mytools h2{font-size:clamp(28px,4vw,44px);margin:10px 0;color:#e9ce91}.mytools p{color:#bbb2a1}.mytools-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px}.mytools-grid article,.mytools-requests{border:1px solid #5f5032;border-radius:18px;background:#22221c;padding:20px}.mytools-grid article>span{color:#d9bd7a}.mytools-grid strong{display:block;font-size:28px;margin:12px 0;color:#f0dbad}.mytools-grid .mytools-green{color:#78d59b}.mytools-grid .mytools-red{color:#ff918d}.mytools-actions{display:flex;flex-wrap:wrap;gap:10px}.mytools button{padding:10px 16px;border:1px solid #b99a5c;border-radius:30px;background:#d6b66c;color:#151411;cursor:pointer}.mytools button:disabled{opacity:.4;cursor:not-allowed}.mytools-requests{margin-top:18px}.mytools-requests header{display:flex;align-items:center;justify-content:space-between;gap:12px}.mytools-requests h3{color:#e9ce91}.mytools-request{border-top:1px solid #514831;padding:15px 0}.mytools-request span{float:left;color:#e9ce91}.mytools-hint{font-size:13px}@media(max-width:600px){.mytools-grid{grid-template-columns:1fr}.mytools-requests header{align-items:flex-start;flex-direction:column}}';document.head.append(css);
})();