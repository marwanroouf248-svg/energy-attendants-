// Shared, read-only schedule calculations. No attendance, points or payroll mutations.
var EnergyAttendance = (() => {
 const local = t => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).map(p=>[p.type,p.value]));
 function instant(day,time){
  const target=Date.parse(day+'T'+time+':00Z');let guess=target;
  if(!Number.isFinite(target))throw Error('INVALID_DATE');
  for(let i=0;i<4;i++){const p=local(guess),delta=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);if(!delta)return guess;guess+=delta;}
  throw Error('INVALID_CAIRO_TIME');
 }
 function bounds(s){const d=new Date(s.day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return {start:instant(s.day,s.start),end:instant(s.end<=s.start?d.toISOString().slice(0,10):s.day,s.end)}}
 function rows(shifts,punches,now=Date.now()){
  const scheduled=shifts.map(s=>{try{return {s,...bounds(s)}}catch{return {s,invalid:true}}});
  const assigned=new Map();
  for(const p of punches){const at=Date.parse(p.in);if(!Number.isFinite(at))continue;
   const candidates=scheduled.filter(r=>!r.invalid&&Number(r.s.employeeId)===Number(p.employeeId)&&r.s.branch===p.branch&&at>=r.start-4*36e5&&at<r.end).sort((a,b)=>Math.abs(a.start-at)-Math.abs(b.start-at));
   const r=candidates[0];if(r&&(!assigned.has(r)||at<Date.parse(assigned.get(r).in)))assigned.set(r,p);
  }
  return scheduled.map(r=>{const p=assigned.get(r);if(r.invalid)return {...r,status:'invalid',late:0,punch:null};const grace=Math.max(0,Number(r.s.graceMinutes)||0)*60000,late=p?Math.max(0,Math.ceil((Date.parse(p.in)-r.start-grace)/60000)):0;
   const earlyMinutes=p?.out?Math.max(0,Math.ceil((r.end-Date.parse(p.out))/60000)):0;
   return {...r,punch:p||null,late,earlyMinutes,openOverdue:!!p&&!p.out&&now>=r.end,status:p?(late?'late':'on_time'):now<r.start+grace?'upcoming':now>=r.end?'missing':'overdue'};
  });
 }
 function staffStatus(person,shifts,punches,now=Date.now()){
  const p=local(now),day=`${p.year}-${p.month}-${p.day}`,id=Number(person.id);
  if(person.needsActivation)return {status:'بانتظار تفعيل الحساب',time:'—'};
  const own=punches.filter(x=>Number(x.employeeId)===id&&Number.isFinite(Date.parse(x.in)));
  const open=own.find(x=>!x.out&&Date.parse(x.in)<=now);
  const today=own.filter(x=>{const t=local(x.in);return `${t.year}-${t.month}-${t.day}`===day});
  const scheduled=rows(shifts,own,now).filter(r=>Number(r.s.employeeId)===id&&(r.s.day===day||(!r.invalid&&r.start<=now&&r.end>now)));
  const punch=open||today.sort((a,b)=>Date.parse(b.in)-Date.parse(a.in))[0];
  if(punch){const t=local(punch.in),matched=scheduled.find(r=>r.punch===punch);return {status:open?(matched?.late?'متأخر':'حاضر'):'انصرف',time:`${t.hour}:${t.minute}`};}
  if(!scheduled.length)return {status:'لا يوجد شفت محدد',time:'—'};
  const current=scheduled.find(r=>!r.invalid&&r.start<=now&&r.end>now);
  const state=current?.status||scheduled[0].status;
  return {status:({upcoming:'لم يبدأ الشفت',overdue:'لم يسجل حضور حتى الآن',missing:'انتهى الشفت دون حضور',invalid:'راجع موعد الشفت'})[state]||'راجع سجل الحضور',time:'—'};
 }
 return {instant,bounds,rows,staffStatus};
})();
