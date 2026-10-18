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
 return {instant,bounds,rows};
})();
