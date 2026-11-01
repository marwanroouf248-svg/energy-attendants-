(()=>{
 const prior=render;
 const labels={late:'حضور متأخر',overdue:'لم يسجل حضور حتى الآن',missing:'انتهت الوردية دون سجل حضور',invalid:'موعد شفت غير صالح'};
 function alerts(){return EnergyAttendance.rows(db.shiftAssignments||[],db.punches||[]).flatMap(r=>[...(labels[r.status]?[{...r,message:labels[r.status]+(r.status==='late'?' · '+r.late+' دقيقة':'')}]:[]),...(r.earlyMinutes?[{...r,message:'انصراف مبكر · '+r.earlyMinutes+' دقيقة'}]:[]),...(r.openOverdue?[{...r,message:'الوردية انتهت والانصراف غير مسجل'}]:[])]);}
 function show(){const rows=alerts();const dialog=document.createElement('dialog');dialog.innerHTML='<h2>تنبيهات الحضور</h2>'+  '<p>من بيانات السيرفر المحملة. حدّث البيانات للحصول على آخر الحركات. لا ينتج عنها خصم أو نقاط تلقائية.</p>'+ (rows.map(r=>'<p><strong>'+esc(r.s.employeeName)+'</strong> · '+esc(r.s.branch)+' · '+esc(r.s.day)+' '+esc(r.s.start)+'<br>'+esc(r.message)+'</p>').join('')||'<p>لا توجد تنبيهات حضور مسجلة.</p>');const close=document.createElement('button');close.textContent='إغلاق';close.onclick=()=>dialog.close();dialog.append(close);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();}
 render=function(){prior();if(!nodeUser||!previewSession)return;const bell=document.querySelector('#bell');if(bell){const n=alerts().length;bell.textContent='التنبيهات ('+n+')';bell.onclick=show;}
  if(page==='command-center'){const panel=document.querySelector('.energy-command');if(panel){const n=alerts().length;panel.insertAdjacentHTML('afterbegin','<p role="status">تنبيهات الحضور: '+n+' — من الشفتات المؤرخة المحفوظة، بدون خصم مالي تلقائي.</p>');}}
 };
 setInterval(()=>{if(!nodeUser||!previewSession)return;const bell=document.querySelector('#bell');if(bell)bell.textContent='التنبيهات ('+alerts().length+')'},60000);
})();
