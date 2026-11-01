// «المبيعات والتقارير» — owner-only page. Server enforces owner access; this script only hides the menu entry for others.
(()=>{
const NAV=['sales-report','◈','المبيعات والتقارير'];
let snap=null,receivedAt=null,loaded=false,loading=false,loadError='',flt={branch:'all',employee:'all',week:'month',metric:'both'},msg='',months=[],curMonth='',links={boys:'',girls:''},linksLoaded=false,linksLoading=false,linksMsg='';
const sum=a=>a.reduce((x,y)=>x+y,0);
const fmt=n=>n==null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const isOwner=()=>typeof nodeUser!=='undefined'&&nodeUser&&nodeUser.role==='admin'&&Number(nodeUser.id)===1;
function ensureNav(){const i=navs.findIndex(n=>n[0]===NAV[0]);if(isOwner()&&i<0)navs.push(NAV);if(!isOwner()&&i>=0)navs.splice(i,1)}
async function load(month){if(loading)return;loading=true;try{const r=await nodeApi('sales-report'+(month?('?month='+encodeURIComponent(month)):''));snap=r.snapshot||null;receivedAt=r.received_at||null;months=r.months||(r.snapshot&&r.snapshot.month?[r.snapshot.month]:[]);curMonth=r.month||(r.snapshot&&r.snapshot.month)||month||'';loadError=''}catch(e){loadError=e.message||'تعذر تحميل التقرير'}loaded=true;loading=false;if(page===NAV[0])render()}
async function loadLinks(){if(linksLoading)return;linksLoading=true;try{const r=await nodeApi('sales-report/links');links={boys:(r.links&&r.links.boys)||'',girls:(r.links&&r.links.girls)||''};linksMsg=''}catch(e){linksMsg=''}linksLoaded=true;linksLoading=false;if(page===NAV[0])render()}
function pick(a){return flt.week==='month'?sum(a):a[Number(flt.week)-1]}
function rows(){const out=[];const bs=Object.entries(snap.branches).filter(([k])=>flt.branch==='all'||k===flt.branch);
 if(flt.employee==='all'){for(const[k,b]of bs)out.push({label:b.label,gross:pick(b.gross),net:pick(b.gym_net)})}
 else{for(const[k,b]of bs)for(const[e,v]of Object.entries(b.employees||{}))if(e===flt.employee)out.push({label:b.label+' · '+e,gross:v.gross?pick(v.gross):null,net:pick(v.gym_net)})}
 return out}
function importBox(){return `<details class="sr-import"><summary>استيراد لقطة جديدة</summary><p class="sr-hint">اختر ملف JSON أو الصق محتواه، ثم اعتمده. الملف يحتوي على إجماليات فقط، بدون أسماء عملاء أو أرقام.</p><div class="sr-import-row"><input type="file" id="srFile" accept="application/json,.json"><textarea id="srJson" rows="5" dir="ltr" placeholder="الصق JSON هنا"></textarea><button class="primary" id="srImport" type="button">اعتماد اللقطة</button></div><div id="srMsg" class="sr-msg" role="status">${esc(msg)}</div></details>`}
function linksBox(){return `<details class="sr-import" open><summary>لينكات شيتات المبيعات (سحب تلقائي)</summary><p class="sr-hint">حط لينك شيت جوجل لكل فرع. التطبيق يسحب منهم تلقائيًا كل شوية، ويقفل كل شهر لوحده من تواريخ الإيصالات. أول كل شهر: حط لينك الشيت الجديد هنا ومش محتاج تبعت حاجة.</p><div class="sr-import-row"><label>فرع الولاد - فودافون<input type="url" id="srLinkBoys" dir="ltr" placeholder="https://docs.google.com/spreadsheets/..." value="${esc(links.boys||'')}"></label><label>فرع البنات - الرخاوي<input type="url" id="srLinkGirls" dir="ltr" placeholder="https://docs.google.com/spreadsheets/..." value="${esc(links.girls||'')}"></label><button class="primary" id="srLinksSave" type="button">حفظ اللينكات</button></div><div id="srLinksMsg" class="sr-msg" role="status">${esc(linksMsg)}</div></details>`}
function body(){
 if(!loaded)return '<div class="notice">جاري تحميل التقرير…</div>';
 if(loadError)return `<div class="notice">${esc(loadError)}</div>`;
 if(!snap)return `${linksBox()}<div class="notice">لا توجد بيانات معتمدة بعد. التقرير يظهر هنا بعد أول سحب تلقائي ناجح من اللينكات فوق، أو بعد أول استيراد يدوي.</div>${importBox()}`;
 const bs=Object.entries(snap.branches),emps=[...new Set(bs.flatMap(([,b])=>Object.keys(b.employees||{})))].sort();
 const opt=(v,t,cur)=>`<option value="${esc(v)}" ${String(cur)===String(v)?'selected':''}>${esc(t)}</option>`;
 const r=rows(),showGross=flt.metric!=='gym_net',showNet=flt.metric!=='gross';
 const tot={gross:showGross&&r.length&&r.every(x=>x.gross!=null)?r.reduce((a,x)=>a+x.gross,0):null,net:r.reduce((a,x)=>a+x.net,0)};
 const when=new Date(snap.generated_at).toLocaleString('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'});
 const monthSel=months.length?`<label>الشهر<select id="srMonth">${months.map(m=>opt(m,m,curMonth||snap.month)).join('')}</select></label>`:'';
 return `${linksBox()}<div class="notice">آخر تحقق من البيانات: <b>${esc(when)}</b> (توقيت القاهرة). التقرير ليس لحظيًا؛ يتحدث بعد كل مراجعة ناجحة للمصدر، والمصدر الأساسي هو شيت المبيعات.</div>
 <div class="sr-chips"><span><b>${fmt(snap.totals.gross)}</b>إجمالي التحصيل</span><span><b>${fmt(snap.totals.gym_net)}</b>صافي الجيم</span><span><b>${fmt(snap.totals.excluded)}</b>مستبعد من الصافي</span></div>
 ${card('تفاصيل الشهر '+esc(snap.month),`<div class="toolbar sr-filters">${monthSel}<label>الفرع<select id="srBranch"><option value="all">كل الفروع</option>${bs.map(([k,b])=>opt(k,b.label,flt.branch)).join('')}</select></label><label>الموظف<select id="srEmp"><option value="all">كل الموظفين</option>${emps.map(e=>opt(e,e,flt.employee)).join('')}</select></label><label>الفترة<select id="srWeek">${opt('month','الشهر كله',flt.week)}${snap.weeks.map((w,i)=>opt(i+1,w,flt.week)).join('')}</select></label><label>المقياس<select id="srMetric">${opt('both','التحصيل وصافي الجيم',flt.metric)}${opt('gross','التحصيل فقط',flt.metric)}${opt('gym_net','صافي الجيم فقط',flt.metric)}</select></label></div>
 <div class="table-wrap"><table class="sr-table"><thead><tr><th>${flt.employee==='all'?'الفرع':'الموظف والفرع'}</th>${showGross?'<th class="num">التحصيل</th>':''}${showNet?'<th class="num">صافي الجيم</th>':''}</tr></thead><tbody>${r.map(x=>`<tr><td>${esc(x.label)}</td>${showGross?`<td class="num">${fmt(x.gross)}</td>`:''}${showNet?`<td class="num">${fmt(x.net)}</td>`:''}</tr>`).join('')}</tbody><tfoot><tr><th>الإجمالي</th>${showGross?`<th class="num">${fmt(tot.gross)}</th>`:''}${showNet?`<th class="num">${fmt(tot.net)}</th>`:''}</tr></tfoot></table></div>${flt.employee!=='all'&&r.some(x=>x.gross==null)?'<p class="sr-hint">تحصيل هذا الموظف غير متاح في اللقطة الحالية. المعروض صافي الجيم فقط.</p>':''}`)}
 ${importBox()}`}
function bind(){
 const g=id=>document.getElementById(id);
 [['srBranch','branch'],['srEmp','employee'],['srWeek','week'],['srMetric','metric']].forEach(([id,k])=>{const el=g(id);if(el)el.onchange=e=>{flt[k]=e.target.value;render()}});
 const sm=g('srMonth');if(sm)sm.onchange=e=>{loaded=false;load(e.target.value)};
 const lsave=g('srLinksSave');if(lsave)lsave.onclick=async()=>{links={boys:g('srLinkBoys').value.trim(),girls:g('srLinkGirls').value.trim()};lsave.disabled=true;try{await nodeApi('sales-report/links',{method:'POST',body:{boys:links.boys||null,girls:links.girls||null}});linksMsg='اتحفظت اللينكات. السحب التلقائي هيقراها في الجولة الجاية.'}catch(e){linksMsg=e.message||'تعذر حفظ اللينكات'}render();};
 const f=g('srFile');if(f)f.onchange=async e=>{const file=e.target.files[0];if(file)g('srJson').value=await file.text()};
 const b=g('srImport');if(b)b.onclick=async()=>{let data;try{data=JSON.parse(g('srJson').value)}catch{msg='المحتوى ليس JSON صحيح.';render();return}
  b.disabled=true;try{await nodeApi('sales-report/import',{method:'POST',body:data});msg='تم الاستيراد بنجاح.';loaded=false;await load()}catch(e){msg=e.message||'تعذر الاستيراد';render();const d=document.querySelector('.sr-import');if(d)d.open=true}}}
const prev=render;
function navBtn(){const nav=document.getElementById('nav');if(!nav||!isOwner())return;let b=nav.querySelector('[data-page="sales-report"]');if(!b){b=document.createElement('button');b.dataset.page=NAV[0];b.innerHTML='<i>'+NAV[1]+'</i>'+NAV[2];const pay=nav.querySelector('[data-page="payroll"]');pay?pay.after(b):nav.append(b)}b.className=page===NAV[0]?'active':'';b.onclick=()=>{page=NAV[0];render()}}
render=function(){ensureNav();prev();navBtn();document.body.classList.toggle('sr-page',page===NAV[0]&&isOwner());if(page!==NAV[0])return;if(!isOwner()){page='overview';return render()}
 const t=$('#title');if(t)t.textContent=NAV[2];const st=$('#subtitle');if(st)st.textContent='أرقام التحصيل وصافي الجيم لكل فرع وموظف. للمالك فقط.';$('#app').innerHTML=body();bind();
 if(!loaded&&!loading)load();if(!linksLoaded&&!linksLoading)loadLinks()};
})();

