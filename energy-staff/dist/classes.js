let classPageMonth='';
navs.push(['classes','✦','الحصص والكلاسات']);
const CLASS_DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const CLASS_INCIDENTS=['تأخر الكابتن','محدش حضر','اتلغت بدون إبلاغ'];
function classesView(month){
 month=month||classMonth();classPageMonth=month;
 const rows=(db.classes||[]).slice().sort((a,b)=>a.weekday-b.weekday||String(a.start).localeCompare(String(b.start)));
 const logs=(db.classLogs||[]).slice().reverse().slice(0,30);
 return card('جدول الحصص الأسبوعي',`<div class="table-wrap"><table><tr><th>اليوم</th><th>الحصة</th><th>الكابتن</th><th>النوع</th><th>الوقت</th><th>الفرع</th><th>السعة</th><th>السعر</th><th>إجراءات</th></tr>${rows.map(c=>`<tr><td>${CLASS_DAYS[c.weekday]||'—'}</td><td>${esc(c.name)}</td><td>${esc(c.captainName)}</td><td>${badge(c.instructorType)}</td><td dir="ltr">${esc(c.start)} — ${esc(c.end)}</td><td>${esc(c.branch)}</td><td>${c.capacity||'—'}</td><td>30 ج</td><td><button data-class-log="${c.id}">تسجيل حصة</button><button class="reject" data-class-remove="${c.id}">حذف</button></td></tr>`).join('')}</table></div>${rows.length?'':'<p class="empty">لا توجد حصص مجدولة بعد. أضف أول حصة من الزرار فوق.</p>'}`,'<button id="classNew">＋ إضافة حصة</button>')
 +card('سجل الحصص والوقائع',logs.map(l=>`<div class="request"><div class="details"><strong>${esc(l.className)} <span style="color:#a2aaa4;font-weight:400">/ ${esc(l.captainName)} — ${esc(l.day)}</span></strong><p>${esc(l.status)}${l.status==='تمت'?' • الحضور: '+l.attendees:''}${l.note?' • '+esc(l.note):''}</p>${(l.incidents||[]).map(i=>`<p><span class="badge gray">${esc(i.type)}${i.minutes?' '+i.minutes+' د':''}</span> ${esc(i.note||'')}</p>`).join('')}<p style="color:#a2aaa4;font-size:12px">سجلها: ${esc(l.recordedBy)}</p></div></div>`).join('')||'<p class="empty">لا توجد حصص مسجلة بعد</p>')
 +card('مستحقات الكلاسات (معاينة)',`<div class="toolbar"><label>الشهر <input id="classMonth" type="month" value="${month}"></label></div><div class="table-wrap"><table><tr><th>الكابتن</th><th>الفرع</th><th>عدد الكلاسات</th><th>الإجمالي</th></tr>${classEarnings(month).map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.branch||'—')}</td><td>${r.count}</td><td>${r.total} ج</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:#a2aaa4">لا توجد مستحقات مسجلة هذا الشهر</td></tr>'}</table></div><p class="empty" style="margin:12px 0 0">معاينة تراكمية فقط — غير مدخولة في المرتبات ولا أثر مالي رسمي ليها قبل اعتماد الإدارة. السعر بيتحسب من سعر الحصة في الجدول وقت التسجيل.</p>`);
}
function classMonth(){return new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}).slice(0,7)}
function classEarnings(month){const rows={};(db.classLogs||[]).filter(l=>l.source==='self'&&l.day&&String(l.day).startsWith(month)).forEach(l=>{const k=String(l.captainStaffId||l.captainName);rows[k]=rows[k]||{name:l.captainName,branch:l.branch,count:0,total:0};rows[k].count++;rows[k].total+=Number(l.credited)||0});return Object.values(rows).sort((a,b)=>b.total-a.total)}
function classRegisterSelf(mine){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
 const wd=new Date(today+'T12:00:00Z').getUTCDay();
 const todays=mine.filter(c=>Number(c.weekday)===wd&&!(db.classLogs||[]).some(l=>String(l.classId)===String(c.id)&&l.day===today&&l.source==='self'));
 if(!todays.length)return toast(mine.some(c=>Number(c.weekday)===wd)?'كل كلاسات النهارده اتسجّلت ✓':'مفيش كلاس مجدول ليك النهارده');
 safeSubmit('تسجيل كلاس',todays.map(c=>`<label class="task"><input type="radio" name="cls" value="${c.id}" required>${esc(c.name)} — ${esc(c.start)} إلى ${esc(c.end)} — 30 ج</label>`).join('')+'<p class="empty">التسجيل بيحسب ليك سعر الكلاس كمستحق (معاينة) بنفس السعر المحدد في الجدول.</p>',async f=>{
  const c=todays.find(x=>String(x.id)===String(f.get('cls')));if(!c)return;
  if(typeof nodeUser!=='undefined'&&nodeUser)return nativeAction('class_register',{classId:c.id}).then(()=>toast('اتسجّلت ✓ — 30 ج اتحسبوا ليك')).catch(e=>toast(e.message==='OUTSIDE_CLASS_WINDOW'?'تسجيل الكلاس متاح في وقته بس (من قبل البداية بنص ساعة لحد ساعة بعد النهاية)':e.message==='ALREADY_EXISTS'?'الكلاس ده اتسجّل النهارده بالفعل':e.message==='INVALID_DATE'?'الكلاس ده مش مجدول النهارده':e.message));
  toast('تسجيل الكلاس يحتاج دخول بحسابك')});
}

function classForm(){
 const branches=(db.branches||[]).map(b=>b.name);
 const myBranch=typeof nodeUser!=='undefined'&&nodeUser&&nodeUser.role==='manager'?nodeUser.branch:null;
 safeSubmit('إضافة حصة',field('اسم الحصة','name')+options('نوع الكابتن','instructorType',['داخلي','خارجي'])+`<label>الكابتن الداخلي (اختياري)<select name="captainStaffId"><option value="">— اختار من الفريق —</option>${db.staff.filter(s=>!myBranch||s.branch===myBranch).map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.branch)}</option>`).join('')}</select></label>`+field('اسم الكابتن (للخارجي أو بدون حساب)','captainName','text','')+(myBranch?'':options('الفرع','branch',branches))+options('اليوم','weekday',CLASS_DAYS)+field('البداية','start','time')+field('النهاية','end','time')+'<label>السعة (اختياري)<input name="capacity" type="number" min="0" max="500"></label>'+'<p class="empty">سعر الكلاس ثابت: 30 ج بيتحسب للكابتن عند تسجيله من زرار «تسجيل كلاس» في وقته.</p>',async f=>{
  const data={name:f.get('name'),instructorType:f.get('instructorType'),captainStaffId:f.get('captainStaffId')||null,captainName:f.get('captainName')||'',branch:myBranch||f.get('branch'),weekday:CLASS_DAYS.indexOf(f.get('weekday')),start:f.get('start'),end:f.get('end'),capacity:f.get('capacity')||0,rate:30};
  if(typeof nodeUser!=='undefined'&&nodeUser&&nodeUser.role!=='admin')return nativeAction('class_create',data);
  const id=String(Date.now());(db.classes=db.classes||[]).push({id,...data,captainName:data.captainStaffId?(db.staff.find(s=>String(s.id)===String(data.captainStaffId))||{}).name||data.captainName:data.captainName,capacity:Number(data.capacity)||0,rate:30,active:true,createdAt:new Date().toISOString(),createdBy:'الإدارة'});audit('إضافة حصة: '+data.name)});
}
function classLogForm(classId){
 const c=(db.classes||[]).find(c=>String(c.id)===String(classId));if(!c)return;
 safeSubmit('تسجيل حصة: '+c.name,field('اليوم','day','date',new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}))+options('الحالة','status',['تمت','اتلغت'])+'<label>عدد الحاضرين<input name="attendees" type="number" min="0" max="1000" value="0"></label>'+CLASS_INCIDENTS.map(t=>`<label class="task"><input type="checkbox" name="inc" value="${t}">${t}</label>`).join('')+'<label>دقائق التأخير (لو الكابتن اتأخر)<input name="minutes" type="number" min="0" max="600" value="0"></label>'+field('ملاحظة (اختياري)','note','text','').replace(' required',''),async f=>{
  const incidents=f.getAll('inc').map(t=>({type:t,minutes:t==='تأخر الكابتن'?Number(f.get('minutes'))||0:0,note:''}));
  const data={classId:c.id,day:f.get('day'),status:f.get('status'),attendees:Number(f.get('attendees'))||0,incidents,note:f.get('note')||''};
  if(typeof nodeUser!=='undefined'&&nodeUser&&nodeUser.role!=='admin')return nativeAction('class_log',data);
  (db.classLogs=db.classLogs||[]).push({id:String(Date.now()),classId:c.id,className:c.name,captainName:c.captainName,instructorType:c.instructorType,branch:c.branch,day:data.day,status:data.status,attendees:data.attendees,incidents,note:data.note,recordedBy:'الإدارة',at:new Date().toISOString()});audit('تسجيل حصة: '+c.name+' — '+data.status)});
}
function classRemove(id){
 const c=(db.classes||[]).find(c=>String(c.id)===String(id));if(!c)return;
 safeSubmit('حذف حصة '+c.name,'<p>هتتحذف الحصة من الجدول. سجل الحصص السابق يفضل محفوظ.</p>',async()=>{
  if(typeof nodeUser!=='undefined'&&nodeUser&&nodeUser.role!=='admin')return nativeAction('class_remove',{id});
  db.classes=db.classes.filter(x=>String(x.id)!==String(id));audit('حذف حصة: '+c.name)});
}
{const priorClasses=render;render=function(){priorClasses();if(page==='classes'){const isAdmin=role==='الإدارة',isManager=role==='مدير قسم';if(!isAdmin&&!isManager){$('#app').innerHTML='<p class="empty">صفحة خاصة بالإدارة ومديري الأقسام</p>';return}$('#app').innerHTML=classesView(classPageMonth);$('#add').hidden=false;$('#add').textContent='＋ إضافة حصة';$('#add').onclick=classForm;$('#classNew').onclick=classForm;document.querySelectorAll('[data-class-log]').forEach(b=>b.onclick=()=>classLogForm(b.dataset.classLog));document.querySelectorAll('[data-class-remove]').forEach(b=>b.onclick=()=>classRemove(b.dataset.classRemove));const cm=$('#classMonth');if(cm)cm.onchange=()=>{classPageMonth=cm.value;render()}}}}
