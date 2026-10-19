// Derive display labels from saved events; never write attendance or payroll.
(()=>{
 const originalTable=table,originalStats=stats,previous=render;
 const display=s=>({...s,...EnergyAttendance.staffStatus(s,db.shiftAssignments||[],db.punches||[])});
 table=function(rows,pay=false){return originalTable(nodeUser&&!pay?rows.map(display):rows,pay)};
 stats=function(){
  if(!nodeUser)return originalStats();
  const people=list().map(display),pending=db.requests.filter(r=>r.status==='معلق').length;
  return '<div class="stats">'+[['إجمالي الموظفين',people.length],['الحاضرون الآن',people.filter(s=>['حاضر','متأخر'].includes(s.status)).length],['حضور متأخر الآن',people.filter(s=>s.status==='متأخر').length],['طلبات تنتظر موافقتك',pending]].map(([label,n])=>'<div class="stat"><div class="stat-top">'+label+'</div><strong>'+n+'</strong><small>من سجلات السيرفر المحملة</small></div>').join('')+'</div>';
 };
 render=function(){
  if(nodeUser&&page==='tasks')page='daily-team';
  previous();if(!nodeUser||!previewSession)return;
  const footer=document.querySelector('main footer span:last-child');if(footer)footer.textContent='بيانات الفريق محفوظة على السيرفر';
  const live=document.querySelector('.live-dot');if(live)live.textContent='متصل بسيرفر الفريق';
  const oldTasks=document.querySelector('#nav [data-page="tasks"]');if(oldTasks)oldTasks.hidden=true;
  document.querySelectorAll('#app .card-head h2').forEach(el=>{if(el.textContent==='سجل اليوم التجريبي')el.textContent='حالة حضور اليوم';});
  const brand=document.querySelector('.report-brand > div:last-child');if(brand)brand.firstChild.textContent='تقرير من سجلات السيرفر';
  const disclaimer=document.querySelector('.report-disclaimer');if(disclaimer)disclaimer.textContent='الأوقات بتوقيت القاهرة • الساعات من سجلات السيرفر. البريك مدفوع. التقرير لا يُعد اعتمادًا لصرف المرتبات.';
  // The original overview chart is seeded artwork, not an attendance metric.
  const bars=document.querySelector('#app .bars');if(bars)bars.closest('.card').remove();
  if(!(db.logs||[]).length)document.querySelectorAll('#app .activity').forEach(el=>el.remove());
 };
})();
