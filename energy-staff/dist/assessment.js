// مواعيد الأسسمنت: حجز بالدكاترة المعتمدين لكل فرع، مواعيد أسبوعية، حالات (محجوز/مؤجل/حضر/لم يحضر/تم الكشف/ملغي)، مكالمة تأكيد، ومنع الحجز المزدوج لنفس الدكتور
(()=>{
const oldRender=render;
const job='أسسمنت — دكتور علاج طبيعي';
const h=x=>esc(String(x??''));
const isDoctor=()=>nodeUser&&nodeUser.position===job;
const canAccess=()=>nodeUser&&(nodeUser.role==='admin'||nodeUser.position==='سيلز'||isDoctor());
const canBook=()=>nodeUser&&(nodeUser.role==='admin'||nodeUser.position==='سيلز');
const canMedical=()=>nodeUser&&(nodeUser.role==='admin'||isDoctor());
const norm=s=>String(s||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ');
const statusNames={booked:'محجوز',postponed:'مؤجل',attended:'حضر',completed:'تم الكشف',no_show:'لم يحضر',cancelled:'ملغي'};
const errMap={SLOT_BOOKED:'هذا المعاد محجوز بالفعل لهذا الدكتور — اختر وقتًا آخر',SLOT_UNAVAILABLE:'هذا الوقت خارج مواعيد الدكتور المتاحة',INVALID_DOCTOR:'الدكتور غير معتمد لهذا الفرع',INVALID_DATE:'التاريخ أو الوقت غير صالح',INVALID_STATE:'حالة الموعد لا تسمح بهذا الإجراء',HAS_ACTIVE_BOOKINGS:'لا يمكن حذف دكتور عليه حجوزات قادمة — أوقفه بدلًا من الحذف',FORBIDDEN:'غير مسموح',NOT_FOUND:'الموعد غير موجود'};
const errMsg=e=>errMap[e&&e.message]||e.message||'حصل خطأ غير متوقع';
// مصدر الدكاترة: قائمة دكاترة الأسسمنت (تديرها الإدارة) + أي دكتور مسجل كموظف وغير ممثل في القائمة
const assessorList=()=>{
const list=(db.assessors||[]).filter(a=>a.active!==false).map(a=>({key:'asr:'+a.id,assessorId:String(a.id),staffId:a.staffId??null,name:a.name,branch:a.branch,availability:a.availability||{}}));
const staffDocs=(nodeUser.role==='admin'?db.staff.filter(x=>x.position===job):(db.assessmentDoctors||[])).map(s=>({key:'staff:'+s.id,doctorId:Number(s.id),name:s.name,branch:s.branch,availability:null}));
for(const sd of staffDocs)if(!list.some(a=>(a.staffId!=null&&Number(a.staffId)===sd.doctorId)||(a.branch===sd.branch&&norm(a.name)===norm(sd.name))))list.push(sd);
return list;
};
const avConfigured=d=>!!(d&&d.availability&&Object.values(d.availability).some(v=>Array.isArray(v)&&v.length));
const slotsForDay=(d,day)=>{if(!avConfigured(d))return null;return (d.availability[String(new Date(day+'T12:00:00Z').getUTCDay())]||[]);};
const takenSlots=(d,day,ignoreId)=>(db.assessmentBookings||[]).filter(a=>String(a.id)!==String(ignoreId||'')&&a.branch===d.branch&&a.day===day&&!['cancelled','postponed'].includes(a.bookingStatus)&&((d.assessorId&&String(a.assessorId||'')===String(d.assessorId))||(d.staffId!=null&&Number(a.doctorId)===Number(d.staffId))||(d.doctorId!=null&&Number(a.doctorId)===Number(d.doctorId)))).map(a=>a.time);
function slotField(doc,day,ignoreId){
const taken=takenSlots(doc,day,ignoreId);
if(avConfigured(doc)){
const slots=slotsForDay(doc,day);
if(!slots.length)return '<p class="assess-hint">الدكتور لا يعمل في هذا اليوم — اختر يومًا آخر.</p><input type="hidden" name="time" value="">';
const opts=slots.map(t=>taken.includes(t)?'<option value="'+h(t)+'" disabled>'+h(t)+' (محجوز)</option>':'<option value="'+h(t)+'">'+h(t)+'</option>').join('');
return '<label>الوقت (من مواعيد الدكتور)<select required name="time">'+opts+'</select></label>';
}
return '<label>الوقت<input required type="time" step="1800" name="time"></label><p class="assess-hint">مواعيد الدكتور الأسبوعية غير محددة بعد — الإدارة تقدر تضيفها من «إدارة الدكاترة».</p>';
}
function dialog(title,fields,submit){
openForm(title,fields,()=>{});
const form=document.querySelector('#form');
form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{await submit(new FormData(form));document.querySelector('#modal').close();toast('تم الحفظ بنجاح')}catch(e){toast(errMsg(e))}finally{b.disabled=false}};
}
function makeBooking(prefill){
prefill=prefill||{};
const branches=nodeUser.role==='admin'?db.branches.map(x=>x.name):[nodeUser.branch];
const ds=assessorList().filter(x=>branches.includes(x.branch));
if(!ds.length)return toast('لا يوجد دكتور أسسمنت معتمد في الفرع. راجع إدارة الدكاترة.');
const opts=branches.map(x=>'<option value="'+h(x)+'">'+h(x)+'</option>').join('');
dialog('حجز موعد أسسمنت','<label>الفرع<select required name="branch">'+opts+'</select></label><label>الدكتور<select required name="doctor"></select></label><label>التاريخ<input required type="date" name="day"></label><div id="slotBox"><p class="assess-hint">اختر الدكتور والتاريخ أولًا</p><input type="hidden" name="time" value=""></div><label>اسم العميل<input required maxlength="120" name="patientName" value="'+h(prefill.patientName||'')+'"></label><label>رقم الهاتف<input required type="tel" name="phone" value="'+h(prefill.phone||'')+'"></label><label>ملاحظات الريسبشن<textarea name="receptionNotes" maxlength="1000">'+h(prefill.receptionNotes||'')+'</textarea></label>'+(prefill.leadId?'<p class="assess-hint">الحجز مرتبط بعميل سيلز — حالة الموعد هتظهر في ملف العميل تلقائيًا.</p>':''),f=>{const doc=assessorList().find(x=>x.key===f.get('doctor'));const data={branch:f.get('branch'),day:f.get('day'),time:f.get('time'),patientName:f.get('patientName'),phone:f.get('phone'),receptionNotes:f.get('receptionNotes')};if(doc.assessorId)data.assessorId=doc.assessorId;else data.doctorId=doc.doctorId;if(prefill.leadId)data.leadId=prefill.leadId;return nativeAction('assessment_create',data)});
const branch=document.querySelector('#fields [name=branch]'),docSel=document.querySelector('#fields [name=doctor]'),dayIn=document.querySelector('#fields [name=day]'),slotBox=document.querySelector('#slotBox');
const syncDocs=()=>{const match=assessorList().filter(x=>x.branch===branch.value);docSel.innerHTML=match.length?match.map(x=>'<option value="'+h(x.key)+'">'+h(x.name)+'</option>').join(''):'<option value="" selected disabled>لا يوجد دكتور معتمد في هذا الفرع</option>'};
const syncSlots=()=>{const doc=assessorList().find(x=>x.key===docSel.value);slotBox.innerHTML=doc&&dayIn.value?slotField(doc,dayIn.value):'<p class="assess-hint">اختر الدكتور والتاريخ أولًا</p><input type="hidden" name="time" value="">'};
branch.onchange=()=>{syncDocs();syncSlots()};docSel.onchange=syncSlots;dayIn.onchange=syncSlots;
syncDocs();syncSlots();
}
window.assessmentBookingForm=makeBooking;
function postponeDialog(a){
const doc=assessorList().find(x=>(a.assessorId&&x.assessorId===String(a.assessorId))||(x.staffId!=null&&Number(a.doctorId)===Number(x.staffId))||(x.doctorId!=null&&Number(a.doctorId)===Number(x.doctorId)));
dialog('تأجيل موعد '+a.patientName,'<p>الموعد الحالي: <b>'+h(a.day)+' — '+h(a.time)+'</b> ('+h(a.doctorName)+')</p><label>التاريخ الجديد<input required type="date" name="day"></label><div id="slotBox2"><p class="assess-hint">اختر التاريخ الجديد أولًا</p><input type="hidden" name="time" value=""></div><p class="assess-hint">التأجيل يقفل الموعد القديم ويحرره، ويحجز الموعد الجديد — ومكالمة التأكيد تتعمل من جديد للمعاد الجديد.</p>',f=>nativeAction('assessment_postpone',{id:a.id,day:f.get('day'),time:f.get('time')}));
const dayIn=document.querySelector('#fields [name=day]'),slotBox=document.querySelector('#slotBox2');
const sync=()=>{slotBox.innerHTML=doc&&dayIn.value?slotField(doc,dayIn.value,a.id):(dayIn.value?slotField({branch:a.branch,availability:null},dayIn.value,a.id):'<p class="assess-hint">اختر التاريخ الجديد أولًا</p><input type="hidden" name="time" value="">')};
dayIn.onchange=sync;sync();
}
async function toggleConfirm(a,done){
try{await nativeAction('assessment_confirm',{id:a.id,done});toast(done?'تم تسجيل مكالمة التأكيد ✓':'تم إلغاء التأكيد')}catch(e){toast(errMsg(e))}
}
const linkedLead=a=>(a&&a.leadId)?(db.salesLeads||[]).find(l=>String(l.id)===String(a.leadId)):null;
function detail(a){
if(!a)return;const medical=canMedical(),booking=canBook();
const editable=a.bookingStatus!=='postponed';
const statuses=medical?['booked','attended','completed','no_show','cancelled']:['booked','attended','no_show','cancelled'];
const status=editable&& (medical||booking)?'<label>الحالة<select name="status">'+statuses.map(s=>'<option value="'+s+'" '+(s===a.bookingStatus?'selected':'')+'>'+statusNames[s]+'</option>').join('')+'</select></label>':'<p>الحالة: <b>'+h(statusNames[a.bookingStatus]||a.bookingStatus)+'</b></p>';
const doctorFields=medical?'<label>ملاحظات الدكتور السرية<textarea name="doctorNotes" maxlength="4000">'+h(a.doctorNotes||'')+'</textarea></label><label>هل توجد إصابة؟<select name="injuryStatus"><option value="unknown">لم يحدد</option><option value="yes">نعم</option><option value="no">لا</option></select></label><label><input type="checkbox" name="planDelivered" '+(a.planDelivered?'checked':'')+'> استلم نظام التمرين</label>':'';
let extra='';
if(a.bookingStatus==='postponed'&&a.postponedTo)extra+='<p class="assess-hint">اتأجل إلى: <b>'+h(a.postponedTo.day)+' — '+h(a.postponedTo.time)+'</b></p>';
if(a.rescheduledFrom)extra+='<p class="assess-hint">هذا الموعد ناتج عن تأجيل موعد سابق.</p>';
if(a.bookingStatus==='booked'&&booking){
extra+='<div class="assess-actions"><button type="button" class="'+(a.confirmCall&&a.confirmCall.done?'':'primary')+'" id="confirmCallBtn">'+(a.confirmCall&&a.confirmCall.done?'↩ إلغاء مكالمة التأكيد ('+h(a.confirmCall.byName||'')+')':'✓ تمت مكالمة التأكيد مع العميل')+'</button><button type="button" id="postponeBtn">↷ تأجيل الموعد</button></div>';
}else if(a.bookingStatus==='booked'&&a.confirmCall&&a.confirmCall.done){extra+='<p class="assess-hint">✓ تم تأكيد الموعد تليفونيًا بواسطة '+h(a.confirmCall.byName||'')+'</p>'}
dialog('متابعة الأسسمنت','<p>'+h(a.patientName)+' — '+h(a.branch)+' — '+h(a.day)+' / '+h(a.time)+'</p><p>الدكتور: '+h(a.doctorName)+'</p><p>رقم الهاتف: '+h(a.phone)+'</p><p>ملاحظات الريسبشن: '+h(a.receptionNotes||'—')+'</p>'+(linkedLead(a)?'<p>عميل سيلز مرتبط: <b>'+h(linkedLead(a).name)+'</b> — مسؤول المتابعة: '+h(linkedLead(a).employeeName)+'</p>':'')+extra+status+doctorFields,f=>nativeAction('assessment_update',{id:a.id,status:f.get('status')||a.bookingStatus,...(medical?{doctorNotes:f.get('doctorNotes'),injuryStatus:f.get('injuryStatus'),planDelivered:f.has('planDelivered')}:{})}));
if(medical)document.querySelector('#fields [name=injuryStatus]').value=a.injuryStatus||'unknown';
const cb=document.querySelector('#confirmCallBtn');if(cb)cb.onclick=()=>{document.querySelector('#modal').close();toggleConfirm(a,!(a.confirmCall&&a.confirmCall.done))};
const pb=document.querySelector('#postponeBtn');if(pb)pb.onclick=()=>postponeDialog(a);
if(!editable&&!medical)document.querySelector('#form [type=submit]').hidden=true;
}
function weekdaySummary(av){
const names=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
return [6,0,1,2,3,4,5].map(d=>{const s=(av||{})[String(d)]||[];return s.length?names[d]+' ('+s.length+' معاد)':null}).filter(Boolean).join(' • ')||'المواعيد غير محددة بعد';
}
function manageAssessors(branch){
const list=(db.assessors||[]).filter(a=>!branch||a.branch===branch);
const rows=list.map(a=>'<tr><td><b>'+h(a.name)+'</b></td><td>'+h(a.branch)+'</td><td>'+weekdaySummary(a.availability)+'</td><td>'+(a.active===false?'موقوف':'نشط')+'</td><td><button type="button" data-edit="'+h(a.id)+'">تعديل</button> <button type="button" data-del="'+h(a.id)+'">حذف</button></td></tr>').join('');
openForm('إدارة دكاترة الأسسمنت','<p>الدكاترة المعتمدون لكل فرع ومواعيدهم الأسبوعية. المواعيد تُكتب بصيغة ٢٤ ساعة مفصولة بفواصل، مثال: 17:00, 17:30, 18:00</p><div class="assess-overflow"><table><thead><tr><th>الدكتور</th><th>الفرع</th><th>المواعيد الأسبوعية</th><th>الحالة</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">لا يوجد دكاترة بعد</td></tr>')+'</tbody></table></div><button type="button" class="primary" id="addAssessorBtn">＋ إضافة دكتور</button>',()=>{});
document.querySelector('#fields').classList.add('assessor-management');document.querySelector('#form').onsubmit=e=>e.preventDefault();
const sb=document.querySelector('#form [type=submit]');if(sb)sb.hidden=true;
document.querySelector('#addAssessorBtn').onclick=()=>assessorForm(null);
document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>assessorForm(list.find(x=>String(x.id)===b.dataset.edit)));
document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const t=list.find(x=>String(x.id)===b.dataset.del);if(!confirm('حذف '+t.name+' نهائيًا؟ (لو عليه حجوزات قادمة لن يُحذف)'))return;try{await nativeAction('assessor_remove',{id:t.id});toast('تم الحذف')}catch(e){toast(errMsg(e))}});
}
function assessorForm(a){
const dayDefs=[['6','السبت'],['0','الأحد'],['1','الإثنين'],['2','الثلاثاء'],['3','الأربعاء'],['4','الخميس'],['5','الجمعة']];
const dayInputs=dayDefs.map(([d,n])=>'<label>'+n+'<input name="wd'+d+'" dir="ltr" placeholder="17:00, 17:30" value="'+h((((a||{}).availability||{})[d]||[]).join(', '))+'"></label>').join('');
dialog(a?'تعديل دكتور':'إضافة دكتور أسسمنت','<label>الاسم<input required maxlength="120" name="name" value="'+h((a||{}).name||'')+'"></label><label>الفرع<select name="branch">'+db.branches.map(x=>'<option value="'+h(x.name)+'" '+(((a||{}).branch===x.name)?'selected':'')+'>'+h(x.name)+'</option>').join('')+'</select></label><label>الحالة<select name="active"><option value="yes" '+((a||{}).active===false?'':'selected')+'>نشط</option><option value="no" '+((a||{}).active===false?'selected':'')+'>موقوف</option></select></label><h3 style="margin:10px 0 4px">المواعيد الأسبوعية</h3>'+dayInputs,f=>{const av={};for(const [d] of dayDefs){const raw=String(f.get('wd'+d)||'');const slots=raw.split(/[,،\s]+/).map(x=>x.trim()).filter(Boolean);if(slots.some(t=>!/^([01]\d|2[0-3]):(00|30)$/.test(t)))throw new Error('صيغة وقت غير صحيحة — استخدم HH:MM بنص ساعة أو ساعة إلا نص، مثال 17:00 أو 17:30');if(slots.length)av[d]=slots}return nativeAction('assessor_save',{...(a?{id:a.id}:{}),name:f.get('name'),branch:f.get('branch'),active:f.get('active')==='yes',availability:av})});
}
function panel(){
if(!canAccess())return;
const nav=document.querySelector('#nav');
if(nav&&!nav.querySelector('[data-assessment]')){
const b=document.createElement('button');b.dataset.assessment='1';b.textContent='✦ مواعيد الأسسمنت';b.onclick=()=>{page='assessment';render()};nav.append(b);
}
if(page!=='assessment')return;
const title=document.querySelector('#title');if(title)title.textContent='مواعيد الأسسمنت';const crumb=document.querySelector('#crumb');if(crumb)crumb.textContent='مواعيد الأسسمنت';
const app=document.querySelector('#app');if(!app)return;
const items=(db.assessmentBookings||[]).slice().sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time));
const count=s=>items.filter(x=>x.bookingStatus===s).length;
const confirmState=a=>a.bookingStatus!=='booked'?'':(a.confirmCall&&a.confirmCall.done?'<small class="assess-ok">✓ تم التأكيد</small>':'<small class="assess-warn">⚠ بانتظار مكالمة التأكيد</small>');
const tr=items.map(a=>'<tr><td><b>'+h(a.day)+'</b><small>'+h(a.time)+'</small></td><td>'+h(a.branch)+'<small>'+h(a.doctorName)+'</small></td><td>'+h(a.patientName)+'<small dir="ltr">'+h(a.phone)+'</small></td><td>'+h(statusNames[a.bookingStatus]||a.bookingStatus)+(a.bookingStatus==='postponed'&&a.postponedTo?'<small>← '+h(a.postponedTo.day)+' '+h(a.postponedTo.time)+'</small>':'')+confirmState(a)+'</td><td><button type="button" data-detail="'+h(a.id)+'">التفاصيل ←</button></td></tr>').join('');
app.innerHTML='<section class="assess-ui" dir="rtl"><div class="assess-kicker">ENERGY CLUB / ASSESSMENT</div><h2>مواعيد الأسسمنت ✦</h2><p>إدارة المواعيد لكل فرع على حدة: الحجز من مواعيد الدكتور المتاحة فقط، والمعاد المحجوز يتقفل تلقائيًا لغيره.</p><div class="assess-metrics"><div><small>إجمالي الحجوزات</small><b>'+items.length+'</b></div><div><small>محجوز</small><b>'+count('booked')+'</b></div><div><small>حضر / تم الكشف</small><b>'+(count('attended')+count('completed'))+'</b></div><div><small>مؤجل / لم يحضر</small><b>'+(count('postponed')+count('no_show'))+'</b></div></div><header class="assess-controls"><h3>جدول المواعيد</h3><div id="assess-new"></div></header><div class="assess-overflow"><table><thead><tr><th>التاريخ والوقت</th><th>الفرع والدكتور</th><th>العميل</th><th>الحالة</th><th>المتابعة</th></tr></thead><tbody>'+(tr||'<tr><td colspan="5">لا توجد حجوزات حتى الآن</td></tr>')+'</tbody></table></div><p>ملحوظة: السيلز لا يمكنه الوصول إلى ملاحظات الدكتور أو بيانات الإصابات.</p></section>';
const box=document.querySelector('#assess-new');
if(canBook()){const b=document.createElement('button');b.className='primary';b.textContent='＋ إضافة حجز';b.onclick=makeBooking;box.append(b)}
if(nodeUser.role==='admin'){const m=document.createElement('button');m.textContent='⚙ إدارة الدكاترة';m.onclick=()=>manageAssessors();box.append(m);const rakhawy=db.branches.find(b=>/الرخاوي/.test(b.name));if(rakhawy){const r=document.createElement('button');r.textContent='⚙ تغيير مواعيد الرخاوي';r.onclick=()=>manageAssessors(rakhawy.name);box.append(r)}}
app.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(items.find(x=>String(x.id)===b.dataset.detail)));
}
render=function(){const desired=page;if(desired==='assessment')page='overview';oldRender();page=desired;panel()};
const st=document.createElement('style');st.textContent='#modal:has(.assessor-management){width:min(96vw,1000px)!important;max-width:1000px!important}.assessor-management table{min-width:760px}.assessor-management th,.assessor-management td{padding:12px;text-align:start}.assessor-management button{min-height:40px}.assessor-management .assess-overflow{max-width:100%;overflow:auto}.assess-ui{direction:rtl;background:linear-gradient(140deg,#181915,#080907);color:#f5efe2;border:1px solid #65552e;border-radius:24px;padding:clamp(16px,3vw,30px);min-height:60vh}.assess-kicker{font-size:11px;color:#dcc17e;letter-spacing:2px}.assess-ui h2{font-size:clamp(27px,4vw,45px);margin:12px 0;color:#efd194}.assess-ui p{color:#beb7a8}.assess-hint{color:#c9bfa5;font-size:13px}.assess-ok{color:#8fd19e;display:block}.assess-warn{color:#f0c060;display:block}.assess-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.assess-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0}.assess-metrics div{border:1px solid #544a32;border-radius:16px;padding:18px;background:#22231d}.assess-metrics small{display:block;color:#c6bea8}.assess-metrics b{display:block;font-size:32px;color:#f0d393}.assess-controls{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.assess-controls button{margin-inline-start:8px}.assess-overflow{overflow:auto}.assess-ui table{width:100%;min-width:680px;border-collapse:collapse}.assess-ui th,.assess-ui td{padding:15px;border-bottom:1px solid #474336;text-align:right}.assess-ui td small{display:block;color:#bbb09c}.assess-ui td button{border:1px solid #75643c;background:#27261e;color:#f0dbad;border-radius:99px;padding:9px;cursor:pointer}@media(max-width:650px){.assess-metrics{grid-template-columns:repeat(2,1fr)}}';document.head.append(st);
})();
