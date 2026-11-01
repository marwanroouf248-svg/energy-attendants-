/* Read-only overview. Uses only the workspace data already scoped by the server. */
(function(){
'use strict';
let pointOverviewFilter={q:'',only:'all',archived:false};
function overviewPeople(){
 const branch=$('#branch')?.value;
 const active=(db.staff||[]).filter(s=>!s.needsActivation||!(db.staff||[]).some(x=>Number(x.legacyStaffId)===Number(s.id)));
 const rows=pointOverviewFilter.archived?[...active,...(db.archived||[])]:active;
 return [...new Map(rows.map(s=>[String(s.id),s])).values()].filter(s=>!branch||branch==='كل الفروع'||s.branch===branch);
}
function pointRollup(people,entries){
 const balances=new Map(people.map(s=>[String(s.id),{...s,green:0,red:0,voided:0,last:null}]));
 for(const p of entries||[]){const s=balances.get(String(p.employeeId));if(!s)continue;if(p.voidedAt){s.voided++;continue;}const amount=Number(p.amount);if(!Number.isFinite(amount)||amount<=0||!['green','red'].includes(p.color))continue;s[p.color]+=amount;if(p.at&&(!s.last||p.at>s.last))s.last=p.at;}
 return Array.from(balances.values());
}
function overviewHtml(){
 const rows=pointRollup(overviewPeople(),db.points);
 const totals=rows.reduce((a,s)=>({green:a.green+s.green,red:a.red+s.red,withPoints:a.withPoints+Number(s.green+s.red>0)}),{green:0,red:0,withPoints:0});
 const branches=[...new Set(rows.map(s=>s.branch||'بدون فرع'))].map(branch=>{const people=rows.filter(s=>(s.branch||'بدون فرع')===branch);return {branch,count:people.length,withPoints:people.filter(s=>s.green+s.red>0).length,green:people.reduce((a,s)=>a+s.green,0),red:people.reduce((a,s)=>a+s.red,0)}});
 const visible=rows.filter(s=>(!pointOverviewFilter.q||String(s.name).toLocaleLowerCase().includes(pointOverviewFilter.q.toLocaleLowerCase()))&&(pointOverviewFilter.only==='all'||pointOverviewFilter.only==='any'&&s.green+s.red>0||pointOverviewFilter.only==='red'&&s.red>0||pointOverviewFilter.only==='green'&&s.green>0)).sort((a,b)=>b.red-a.red||b.green-a.green||String(a.name).localeCompare(String(b.name),'ar'));
 return card('نظرة عامة على النقاط',`<div style="padding:0 22px 20px"><div class="score-pair"><div class="score-box positive"><span>إجمالي نقاط الالتزام</span><strong>${totals.green}</strong></div><div class="score-box negative"><span>إجمالي نقاط المخالفات</span><strong>${totals.red}</strong></div></div><p class="score-explain">${totals.withPoints} موظف عليهم نقاط من ${rows.length} موظف في النطاق المعروض. إجماليات تراكمية، تستبعد النقاط الملغاة، ولا تمثل خصمًا ماليًا أو صافي تسوية. فلتر الفرع أعلى الصفحة يطبق على كل الملخصات.</p></div>`)+card('إجمالي كل فرع',`<div class="table-wrap"><table><thead><tr><th>الفرع</th><th>الموظفون</th><th>عليهم نقاط</th><th>خضراء</th><th>حمراء</th></tr></thead><tbody>${branches.map(b=>`<tr><td>${esc(b.branch)}</td><td>${b.count}</td><td>${b.withPoints}</td><td style="color:#237744">${b.green}</td><td style="color:#bd4943">${b.red}</td></tr>`).join('')||'<tr><td colspan="5">لا يوجد موظفون في النطاق المعروض</td></tr>'}</tbody></table></div>`)+card('نقاط كل موظف',`<div class="toolbar" style="flex-wrap:wrap"><label>بحث بالاسم <input id="pointsOverviewQuery" type="search" value="${esc(pointOverviewFilter.q)}" placeholder="اسم الموظف"></label><label>عرض <select id="pointsOverviewOnly"><option value="all">كل الموظفين</option><option value="any" ${pointOverviewFilter.only==='any'?'selected':''}>عليهم نقاط فقط</option><option value="red" ${pointOverviewFilter.only==='red'?'selected':''}>عليهم نقاط حمراء</option><option value="green" ${pointOverviewFilter.only==='green'?'selected':''}>عليهم نقاط خضراء</option></select></label><label><input type="checkbox" id="pointsOverviewArchived" ${pointOverviewFilter.archived?'checked':''}> تضمين المؤرشفين</label></div><p style="padding:0 22px">${visible.length} موظف مطابق للبحث. البحث لا يغير إجماليات الفرع.</p><div class="table-wrap"><table><thead><tr><th>الموظف</th><th>الفرع</th><th>القسم</th><th>خضراء</th><th>حمراء</th><th>آخر نقطة</th><th>التفاصيل</th></tr></thead><tbody>${visible.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.branch||'—')}</td><td>${esc(s.department||s.job||'—')}</td><td style="color:#237744">${s.green}</td><td style="color:#bd4943">${s.red}</td><td>${s.last?stamp(s.last):'بدون نقاط'}</td><td><button data-point-details="${esc(s.id)}">عرض السجل</button></td></tr>`).join('')||'<tr><td colspan="7">لا يوجد موظفون مطابقون للفلتر</td></tr>'}</tbody></table></div>`);
}
const originalPointsView=pointsView;
pointsView=function(){return overviewHtml()+originalPointsView()};
const previousRender=render;
render=function(){previousRender();
 if(page==='requests'&&typeof nodeUser!=='undefined'&&nodeUser&&['admin','manager'].includes(nodeUser.role)){
  const intro=document.createElement('section');intro.className='card';
  intro.innerHTML='<div class="card-head"><h2>توجيه طلبات الأقسام</h2></div><div style="padding:0 22px 20px;line-height:1.9"><p>كباتن فودافون: محمد مصطفى. كباتن الرخاوي: إسراء إمام. السيلز في الفرعين: أروى (Arwa). الموارد البشرية في الرخاوي: هنا جابر.</p><p class="muted">الطلبات العادية تُراجع عند مدير القسم المحدد، والإدارة تحتفظ بالمراجعة. طلب تكملة الشيفت يمر بالمدير أولًا ثم مروان. المدير لا يعتمد طلبه بنفسه. تعيين المدير المباشر أدناه يخص الأقسام غير المحددة هنا فقط؛ لا يغيّر توجيه هذه الأقسام ولا يعطي أكسس حضور يدوي أو مرتبات.</p></div>';
  $('#app').prepend(intro);
  if(Number(nodeUser.id)===1&&nodeUser.role==='admin'){
   const a=(db.assessors||[]).find(a=>a.id==='asr-laila');
   if(a&&Number(a.staffId)!==-1000023){const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='ربط ليلي بملف الأسسمنت المؤكد';button.onclick=async()=>{button.disabled=true;try{await nativeAction('assessor_link_layla_confirmed',{});toast('تم ربط ليلي بالأسسمنت مع الاحتفاظ بتاريخ Move')}catch(e){button.disabled=false;toast(e.message)}};intro.append(button)}
  }

 }
 if(page!=='score'||!$('#pointsOverviewOnly'))return;
 $('#pointsOverviewOnly').onchange=e=>{pointOverviewFilter.only=e.target.value;render()};
 $('#pointsOverviewArchived').onchange=e=>{pointOverviewFilter.archived=e.target.checked;render()};
 $('#pointsOverviewQuery').oninput=e=>{pointOverviewFilter.q=e.target.value;const start=e.target.selectionStart;render();const input=$('#pointsOverviewQuery');input.focus();input.setSelectionRange(start,start)};
 document.querySelectorAll('[data-point-details]').forEach(b=>b.onclick=()=>{scoreEmployee=b.dataset.pointDetails;render();$('#scoreEmployee')?.scrollIntoView({block:'center',behavior:'smooth'})});
};
if(typeof module!=='undefined')module.exports={pointRollup};
})();
