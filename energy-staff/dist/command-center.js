(()=>{
const old=render;
const clean=v=>esc(String(v??''));
function command(){
 if(!nodeUser||nodeUser.role!=='admin')return;
 const nav=document.querySelector('#nav');
 if(nav&&!nav.querySelector('[data-command]')){const b=document.createElement('button');b.dataset.command='yes';b.textContent='✦ مركز تشغيل الفرعين';b.onclick=()=>{page='command-center';render()};nav.prepend(b)}
 if(page!=='command-center')return;
 const app=document.querySelector('#app');if(!app)return;
 const now=Date.now(),branches=db.branches||[],staff=db.staff||[],punches=db.punches||[],tasks=db.dailyAssignments||[],breaks=db.breaks||[],requests=db.requests||[],shiftRows=db.shifts||[];
 const active=id=>punches.find(p=>Number(p.employeeId)===Number(id)&&!p.out);
 const branchStats=branches.map(b=>{const people=staff.filter(s=>s.branch===b.name),ids=new Set(people.map(s=>Number(s.id)));return {name:b.name,total:people.length,present:people.filter(s=>active(s.id)).length,pending:tasks.filter(t=>ids.has(Number(t.employeeId))&&t.status==='submitted').length,requests:requests.filter(r=>ids.has(Number(r.employeeId))&&r.status==='معلق').length}});
 const awaiting=tasks.filter(t=>t.status==='submitted').length;
 const present=staff.filter(s=>active(s.id)).length;
 const reqCount=requests.filter(r=>r.status==='معلق').length;
 const openBreaks=breaks.filter(b=>!b.end).length;
 const cards=[['الحاضرين الآن',present],['مهام تنتظر اعتماد',awaiting],['طلبات معلقة',reqCount],['بريكات مفتوحة',openBreaks]];
 const lines=branchStats.map(b=>'<tr><td>'+clean(b.name)+'</td><td>'+b.total+'</td><td>'+b.present+'</td><td>'+b.pending+'</td><td>'+b.requests+'</td></tr>').join('');
 const shifts=shiftRows.slice(0,12).map(s=>'<tr><td>'+clean(s.branch)+'</td><td>'+clean(s.name)+'</td><td>'+clean(s.time||s.start||'—')+'</td></tr>').join('');
 app.innerHTML='<section class="energy-command" dir="rtl"><p class="energy-overline">ENERGY CLUB · OPERATIONS</p><h2>مركز تشغيل الفرعين</h2><p>ملخص مباشر من بيانات السيرفر المحفوظة، دون احتساب ساعات حضور وهمية.</p><div class="energy-metrics">'+cards.map(c=>'<article><span>'+c[0]+'</span><strong>'+c[1]+'</strong></article>').join('')+'</div><div class="energy-panel"><h3>حالة كل فرع</h3><div class="energy-scroll"><table><thead><tr><th>الفرع</th><th>الموظفون</th><th>الحاضرون</th><th>مهام للمراجعة</th><th>طلبات معلقة</th></tr></thead><tbody>'+(lines||'<tr><td colspan="5">لم تتم إضافة الفروع بعد</td></tr>')+'</tbody></table></div></div><div class="energy-panel"><h3>الورديات المسجلة</h3><div class="energy-scroll"><table><thead><tr><th>الفرع</th><th>الوردية</th><th>التوقيت</th></tr></thead><tbody>'+(shifts||'<tr><td colspan="3">لا توجد ورديات مسجلة</td></tr>')+'</tbody></table></div></div><div class="energy-panel"><h3>التأخير والتقارير</h3><p>التأخير لا يُحسب بدقة إلا بعد ربط كل موظف بشفت مؤرخ ومحدد البداية؛ لن نعرض تأخيرات تقديرية كأنها مؤكدة.</p><div class="energy-links"><button type="button" data-go="daily-team">مراجعة المهام</button><button type="button" data-go="reports">تقارير الحضور</button><button type="button" data-go="payroll">المرتبات</button><button type="button" data-go="join-approvals">موافقات الحسابات</button></div></div></section>';
 app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{page=b.dataset.go;render()});
}
render=function(){const chosen=page;if(chosen==='command-center')page='overview';old();page=chosen;command()};
const st=document.createElement('style');st.textContent='.energy-command{direction:rtl;background:linear-gradient(140deg,#181812,#0b0c09);color:#f3efdf;border:1px solid #786437;border-radius:22px;padding:clamp(16px,3vw,30px)}.energy-overline{color:#ddc07b;letter-spacing:2px;font-size:11px}.energy-command h2{font-size:clamp(26px,4vw,42px);color:#e8cf8c;margin:12px 0}.energy-command p{color:#c6c0b1}.energy-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:25px 0}.energy-metrics article,.energy-panel{border:1px solid #51482c;background:#22231b;border-radius:16px;padding:18px}.energy-metrics span{font-size:13px;color:#c9c0aa}.energy-metrics strong{display:block;font-size:34px;color:#f0d797;margin-top:8px}.energy-panel{margin-top:16px}.energy-panel h3{color:#e8cf8c}.energy-scroll{overflow:auto}.energy-command table{min-width:550px;width:100%;border-collapse:collapse}.energy-command td,.energy-command th{padding:12px;text-align:right;border-bottom:1px solid #403c2d}.energy-links{display:flex;flex-wrap:wrap;gap:10px}.energy-links button{background:#d6b66c;color:#1c1c16;border:0;border-radius:99px;padding:10px 15px;cursor:pointer}@media(max-width:750px){.energy-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(st);
})();