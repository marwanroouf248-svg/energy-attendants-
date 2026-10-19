// Staff extras: equipment fault reports, shift handover notes, shift swap with manager approval,
// and point/hours statement objections. All writes go through the server (nativeAction).
(()=>{
const oldRender=render;
const h=x=>esc(String(x??''));
const loggedIn=()=>!!nodeUser;
const canReview=()=>nodeUser&&(nodeUser.role==='admin'||nodeUser.role==='manager');
const pages=['announcements','faults','shift-swap','objections','documents','chat','kiosk-admin'];
const todayCairo=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
let handoverDraft='';

// Attach the optional handover note to the employee's checkout punch.
const oldNative=nativeAction;
nativeAction=function(action,data={}){
 if(action==='punch_out'&&handoverDraft.trim())data={...data,handoverNote:handoverDraft.trim()};
 if(action==='punch_in'||action==='punch_out')handoverDraft='';
 return oldNative(action,data);
};

function dialog(title,fields,submit){
 openForm(title,fields,()=>{});
 const form=document.querySelector('#form');
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{await submit(new FormData(form));document.querySelector('#modal').close();toast('تم الحفظ بنجاح')}catch(err){toast(err.message)}finally{b.disabled=false}};
}

function nav(){
 const bar=document.querySelector('#nav');
 if(!bar||!loggedIn()||bar.dataset.extrasAdded)return;bar.dataset.extrasAdded='1';
 const add=(key,label)=>{const b=document.createElement('button');b.dataset.extras='1';b.textContent=label;b.onclick=()=>{page=key;render()};bar.append(b)};
 add('announcements','📢 الإعلانات');
 add('faults','⚒ بلاغات الأعطال');
 add('shift-swap','⇄ تبديل الشفتات');
 add('objections','✦ النقاط والاعتراضات');
 add('chat','💬 شات الفرع');
 if(canReview()){add('documents','📄 وثائق الفريق');add('kiosk-admin','🔑 كشك البصمة');}
}

function faultsPanel(){
 const items=(db.faultReports||[]).slice().sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||b.createdAt.localeCompare(a.createdAt));
 const rows=items.map(f=>'<tr><td><b>'+h(f.machine)+'</b><small>'+h(f.createdAt.slice(0,16).replace('T',' '))+'</small></td><td>'+h(f.employeeName)+'<small>'+h(f.branch)+'</small></td><td>'+(f.urgency==='عاجل'?'<span class="x-urgent">عاجل</span>':'عادي')+'</td><td>'+h(f.note)+'</td><td>'+(f.status==='open'?'<span class="x-open">مفتوح</span>':'<span class="x-done">اتحل ✓</span><small>'+h(f.resolutionNote||'')+' — '+h(f.resolvedBy||'')+'</small>')+'</td><td>'+(f.status==='open'&&canReview()?'<button type="button" data-resolve="'+h(f.id)+'">حل البلاغ</button>':'')+'</td></tr>').join('');
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / MAINTENANCE</div><h2>بلاغات أعطال الأجهزة ⚒</h2><p>أي عطل في جهاز؟ بلّغ هنا والمدير يتابع الحل مع الصيانة.</p><header class="x-controls"><h3>بلاغ جديد</h3></header><div class="x-form"><input id="x-machine" maxlength="120" placeholder="اسم الجهاز (مثال: جهاز الجري 3)"><select id="x-urgency"><option>عادي</option><option>عاجل</option></select><textarea id="x-note" maxlength="1000" placeholder="وصف العطل"></textarea><button class="primary" id="x-fault-new">إرسال البلاغ</button></div><div class="x-overflow"><table><thead><tr><th>الجهاز</th><th>المبلّغ</th><th>الأولوية</th><th>الوصف</th><th>الحالة</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">لا توجد بلاغات</td></tr>')+'</tbody></table></div></section>';
}

function swapPanel(){
 const mine=(db.shiftAssignments||[]).filter(s=>Number(s.employeeId)===Number(nodeUser.id)&&s.day>=todayCairo()).sort((a,b)=>a.day.localeCompare(b.day));
 const peers=db.shiftSwapPeers||[];
 const requests=(db.shiftSwapRequests||[]).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const names={pending:'في انتظار موافقة المدير',approved:'اتنفذ ✓',rejected:'مرفوض'};
 const rows=requests.map(r=>'<tr><td><b>'+h(r.day)+'</b><small>'+h(r.start)+' — '+h(r.end)+'</small></td><td>'+h(r.requesterName)+' → '+h(r.targetName)+'</td><td>'+h(names[r.status])+(r.reviewNote?'<small>'+h(r.reviewNote)+'</small>':'')+'</td><td>'+(r.status==='pending'&&canReview()?'<button type="button" data-swap-ok="'+h(r.id)+'">موافقة</button> <button type="button" data-swap-no="'+h(r.id)+'">رفض</button>':'')+'</td></tr>').join('');
 const form=nodeUser.role==='employee'?'<div class="x-form"><select id="x-shift">'+mine.map(s=>'<option value="'+h(s.id)+'">'+h(s.day)+' — '+h(s.start)+' إلى '+h(s.end)+'</option>').join('')+'</select><select id="x-peer">'+peers.map(p=>'<option value="'+h(p.id)+'">'+h(p.name)+'</option>').join('')+'</select><button class="primary" id="x-swap-new" '+(mine.length&&peers.length?'':'disabled')+'>طلب تبديل</button></div><p class="x-hint">'+(mine.length?(peers.length?'اختر الشفت والزميل، والطلب يروح للمدير للموافقة.':'لا يوجد زملاء متاحين للتبديل في قسمك حاليًا.'):'لا توجد شفتات قادمة مسجلة لك.')+'</p>':'<p class="x-hint">راجع طلبات التبديل ووافق أو ارفض. الموافقة تنقل الشفت للزميل فورًا.</p>';
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / SHIFT SWAP</div><h2>تبديل الشفتات ⇄</h2><p>التبديل لا يتم إلا بعد موافقة المدير، والشفت ينتقل باسم الزميل تلقائيًا.</p>'+form+'<div class="x-overflow"><table><thead><tr><th>الشفت</th><th>التبديل</th><th>الحالة</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">لا توجد طلبات</td></tr>')+'</tbody></table></div></section>';
}

function objectionsPanel(){
 const mine=(db.points||[]).filter(p=>Number(p.employeeId)===Number(nodeUser.id));
 const objections=(db.pointObjections||[]).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const names={pending:'معلق',accepted:'مقبول — النقطة اتلغت',rejected:'مرفوض'};
 let body='';
 if(nodeUser.role==='employee'){
  const rows=mine.slice().sort((a,b)=>b.at.localeCompare(a.at)).map(p=>{const pending=objections.some(o=>o.pointId===String(p.id)&&o.status==='pending');return '<tr><td>'+(p.color==='red'?'<span class="x-urgent">حمراء</span>':'<span class="x-done">خضراء</span>')+'</td><td>'+h(p.amount)+'</td><td>'+h(p.reason)+'<small>'+h(String(p.at).slice(0,10))+'</small></td><td>'+(p.voidedAt?'<span class="x-done">ملغاة ✓</span>':pending?'<span class="x-open">اعتراض معلق</span>':'<button type="button" data-object="'+h(p.id)+'">اعتراض</button>')+'</td></tr>'}).join('');
  body='<h3>نقاطي</h3><div class="x-overflow"><table><thead><tr><th>النوع</th><th>العدد</th><th>السبب والتاريخ</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">لا توجد نقاط مسجلة</td></tr>')+'</tbody></table></div>';
 }
 if(canReview()){
  const rows=objections.map(o=>'<tr><td>'+h(o.employeeName)+'<small>'+h(o.branch)+'</small></td><td>'+(o.pointSummary?h((o.pointSummary.color==='red'?'حمراء':'خضراء')+' × '+o.pointSummary.amount+' — '+o.pointSummary.reason):'—')+'</td><td>'+h(o.reason)+'</td><td>'+h(names[o.status])+(o.reviewNote?'<small>'+h(o.reviewNote)+'</small>':'')+'</td><td>'+(o.status==='pending'?'<button type="button" data-obj-ok="'+h(o.id)+'">قبول وإلغاء النقطة</button> <button type="button" data-obj-no="'+h(o.id)+'">رفض</button>':'')+'</td></tr>').join('');
  body+='<h3>اعتراضات النقاط</h3><div class="x-overflow"><table><thead><tr><th>الموظف</th><th>النقطة</th><th>سبب الاعتراض</th><th>الحالة</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">لا توجد اعتراضات</td></tr>')+'</tbody></table></div>';
 }
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / POINTS</div><h2>النقاط والاعتراضات ✦</h2><p>عندك اعتراض على نقطة؟ اكتب السبب والمدير يراجعه. قبول الاعتراض يلغي النقطة نهائيًا.</p>'+body+'</section>';
}

const dayNames=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function availabilityBlock(){
 const mine=(db.availabilities||[]).find(v=>Number(v.employeeId)===Number(nodeUser.id));
 const myDays=new Set(mine?mine.weekdays:[]);
 const chips=dayNames.map((n,i)=>'<label class="x-chip"><input type="checkbox" name="x-day" value="'+i+'" '+(myDays.has(i)?'checked':'')+'> '+n+'</label>').join('');
 const empPart=nodeUser.role==='employee'?'<h3>إتاحتي الأسبوعية</h3><p class="x-hint">حدد الأيام اللي تقدر تشتغلها عشان المدير يراعيها في الشفتات.</p><div class="x-chips">'+chips+'</div><input id="x-avail-note" maxlength="300" placeholder="ملاحظة (مثال: متاح الصبح بس)" value="'+h(mine?mine.note:'')+'"><button class="primary" id="x-avail-save">حفظ الإتاحة</button>':'';
 const avails=db.availabilities||[];
 const list=canReview()&&avails.length?'<h3>إتاحة الفريق</h3><div class="x-overflow"><table><thead><tr><th>الموظف</th><th>الأيام المتاحة</th><th>ملاحظة</th></tr></thead><tbody>'+avails.map(v=>'<tr><td>'+h(v.employeeName)+'</td><td>'+h(v.weekdays.map(d=>dayNames[d]).join('، ')||'—')+'</td><td>'+h(v.note||'—')+'</td></tr>').join('')+'</tbody></table></div>':'';
 return '<section class="x-avail">'+empPart+list+'</section>';
}
function announcementsPanel(){
 const acked=new Set((db.announcementAcks||[]).filter(k=>Number(k.employeeId)===Number(nodeUser.id)).map(k=>String(k.announcementId)));
 const items=(db.announcements||[]).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const scopeName=a=>a.scope.kind==='all'?'كل الفروع':a.scope.kind==='branch'?('فرع '+a.scope.branch):(a.scope.department+' — '+a.scope.branch);
 const targetedToMe=a=>a.scope.kind==='all'||(a.scope.kind==='branch'&&a.scope.branch===nodeUser.branch)||a.scope.kind==='department';
 const rows=items.map(a=>{const mine=Number(a.createdById)===Number(nodeUser.id),acks=canReview()&&mine?(db.announcementAcks||[]).filter(k=>String(k.announcementId)===String(a.id)).length:null;return '<tr><td><b>'+h(a.title)+'</b><small>'+h(a.createdAt.slice(0,16).replace('T',' '))+' — '+h(a.createdBy)+'</small></td><td>'+h(a.body)+'</td><td>'+h(scopeName(a))+'</td><td>'+(targetedToMe(a)&&!acked.has(String(a.id))?'<button type="button" data-ack="'+h(a.id)+'">تم الاطلاع</button>':targetedToMe(a)?'<span class="x-done">اطّلعت ✓</span>':'')+(acks!==null?'<small>اطّلع: '+acks+'</small>':'')+'</td></tr>'}).join('');
 let form='';
 if(canReview()){
  const branches=nodeUser.role==='admin'?db.branches.map(b=>b.name):[nodeUser.branch];
  const deps=nodeUser.role==='admin'?Object.values(positions):[positions[nodeUser.position]].filter(Boolean);
  form='<div class="x-form"><input id="x-ann-title" maxlength="120" placeholder="عنوان الإعلان"><textarea id="x-ann-body" maxlength="2000" placeholder="نص الإعلان"></textarea><select id="x-ann-kind">'+(nodeUser.role==='admin'?'<option value="all">كل الفروع</option>':'')+'<option value="branch">فرع</option><option value="department">قسم في فرع</option></select><select id="x-ann-branch">'+branches.map(b=>'<option>'+h(b)+'</option>').join('')+'</select><select id="x-ann-dep">'+deps.map(d=>'<option>'+h(d)+'</option>').join('')+'</select><button class="primary" id="x-ann-new">نشر الإعلان</button></div>';
 }
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / ANNOUNCEMENTS</div><h2>الإعلانات 📢</h2><p>إعلانات الإدارة لكل فرع أو قسم، والاطلاع عليها مسجّل.</p>'+form+'<div class="x-overflow"><table><thead><tr><th>الإعلان</th><th>التفاصيل</th><th>الموجَّه إلى</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">لا توجد إعلانات</td></tr>')+'</tbody></table></div></section>';
}
function documentsPanel(){
 const people=db.staff.filter(s=>!s.legacyProfileId);
 const today=todayCairo();
 const soon=new Date(Date.now()+30*86400000).toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
 const rows=(db.documents||[]).slice().sort((a,b)=>a.expiry.localeCompare(b.expiry)).map(d=>{const state=d.expiry<today?'<span class="x-urgent">منتهية!</span>':d.expiry<=soon?'<span class="x-open">تنتهي خلال ٣٠ يوم</span>':'<span class="x-done">سارية</span>';return '<tr><td>'+h(d.employeeName)+'<small>'+h(d.branch)+'</small></td><td>'+h(d.type)+'</td><td><b>'+h(d.expiry)+'</b></td><td>'+state+'</td><td>'+h(d.note||'—')+'</td><td><button type="button" data-doc-del="'+h(d.id)+'">حذف</button></td></tr>'}).join('');
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / DOCUMENTS</div><h2>وثائق وشهادات الفريق 📄</h2><p>تابع تواريخ انتهاء الشهادات والوثائق (إسعافات أولية، عقود، بطاقات) قبل ما تنتهي.</p><div class="x-form"><select id="x-doc-emp">'+people.map(p=>'<option value="'+h(p.id)+'">'+h(p.name)+' — '+h(p.branch)+'</option>').join('')+'</select><input id="x-doc-type" maxlength="60" placeholder="نوع الوثيقة (مثال: شهادة إسعافات أولية)"><input id="x-doc-expiry" type="date"><input id="x-doc-note" maxlength="300" placeholder="ملاحظة (اختياري)"><button class="primary" id="x-doc-new">إضافة وثيقة</button></div><div class="x-overflow"><table><thead><tr><th>الموظف</th><th>الوثيقة</th><th>تاريخ الانتهاء</th><th>الحالة</th><th>ملاحظة</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">لا توجد وثائق مسجلة</td></tr>')+'</tbody></table></div></section>';
}
function chatPanel(){
 const msgs=(db.chatMessages||[]).filter(m=>nodeUser.role==='admin'||m.branch===nodeUser.branch);
 const rows=msgs.map(m=>'<div class="x-msg'+(m.manager?' x-msg-mgr':'')+'"><b>'+h(m.name)+(m.manager?' <small>(إدارة)</small>':'')+'</b> '+h(m.body)+'<small>'+h(String(m.at).slice(5,16).replace('T',' '))+'</small></div>').join('');
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / TEAM CHAT</div><h2>شات الفرع 💬</h2><p>محادثة فريق فرعك — الرسايل نص بس وبتتجدد مع تحديث الصفحة.</p><div class="x-chat">'+ (rows||'<p class="x-hint">لا توجد رسايل بعد. ابدأ الكلام!</p>')+'</div><div class="x-form x-chat-form"><input id="x-chat-body" maxlength="500" placeholder="اكتب رسالتك..."><button class="primary" id="x-chat-send">إرسال</button></div></section>';
}
function openShiftsBlock(){
 const items=(db.openShifts||[]).slice().sort((a,b)=>a.day.localeCompare(b.day));
 const names={pending:'طلبك معلق',approved:'اتقبلت ✓',rejected:'اترفض'};
 const rows=items.map(o=>{
  const myClaim=o.claims.find(c=>Number(c.employeeId)===Number(nodeUser.id));
  const claims=canReview()&&o.claims.length?'<small>الطلبات: '+o.claims.map(c=>h(c.name)+' ('+(c.status==='pending'?'معلق':c.status==='approved'?'مقبول':'مرفوض')+')'+(c.status==='pending'?' <button type="button" data-os-ok="'+h(o.id)+':'+h(c.id)+'">قبول</button> <button type="button" data-os-no="'+h(o.id)+':'+h(c.id)+'">رفض</button>':'')).join('، ')+'</small>':'';
  const action=!canReview()&&o.status==='open'?myClaim?h(names[myClaim.status]):'<button type="button" data-os-claim="'+h(o.id)+'">احجز الشفت</button>':'';
  return '<tr><td><b>'+h(o.day)+'</b><small>'+h(o.start)+' — '+h(o.end)+'</small></td><td>'+h(o.department)+'</td><td>'+(o.status==='open'?'مفتوح':'اتملى ✓')+'</td><td>'+action+claims+'</td></tr>'}).join('');
 const form=canReview()?'<h3>انشر شفت مفتوح</h3><div class="x-form"><input id="x-os-day" type="date"><input id="x-os-start" type="time"><input id="x-os-end" type="time">'+(nodeUser.role==='admin'?'<select id="x-os-dep">'+Object.values(positions).map(d=>'<option>'+h(d)+'</option>').join('')+'</select><select id="x-os-branch">'+db.branches.map(b=>'<option>'+h(b.name)+'</option>').join('')+'</select>':'')+'<button class="primary" id="x-os-new">نشر الشفت</button></div>':'';
 return '<section class="x-avail"><h3>الشفتات المفتوحة</h3><p class="x-hint">المدير ينشر شفت محتاج حد، والموظف يحجزه، والحجز ميتمش غير بموافقة المدير.</p>'+form+'<div class="x-overflow"><table><thead><tr><th>اليوم والوقت</th><th>القسم</th><th>الحالة</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">لا توجد شفتات مفتوحة</td></tr>')+'</tbody></table></div></section>';
}
function kioskPanel(){
 const people=db.staff.filter(s=>!s.legacyProfileId||s.needsActivation!==undefined);
 const rows=people.map(p=>'<tr><td>'+h(p.name)+'<small>'+h(p.branch)+'</small></td><td>'+(p.pinSetAt?'<span class="x-done">له رقم سري ✓</span>':'<span class="x-open">بدون</span>')+'</td><td><button type="button" data-pin-set="'+h(p.id)+'">'+(p.pinSetAt?'تغيير الرقم':'تعيين رقم')+'</button> '+(p.pinSetAt?'<button type="button" data-pin-clear="'+h(p.id)+'">مسح</button>':'')+'</td></tr>').join('');
 return '<section class="x-ui" dir="rtl"><div class="x-kicker">ENERGY PLUS / KIOSK</div><h2>كشك البصمة 🔑</h2><p>عيّن رقم سري لكل موظف، وهو يبصم حضور وانصراف من تابلت الفرع على صفحة الكشك. الرقم بيتخزن مشفر ومحدش يقدر يشوفه.</p><p class="x-hint">صفحة الكشك (تفتح على تابلت الفرع من غير تسجيل دخول): <b dir="ltr">/kiosk.html</b></p><div class="x-overflow"><table><thead><tr><th>الموظف</th><th>الحالة</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function bindPanels(){
 const newFault=document.querySelector('#x-fault-new');
 if(newFault)newFault.onclick=()=>{const machine=document.querySelector('#x-machine').value,urgency=document.querySelector('#x-urgency').value,note=document.querySelector('#x-note').value;if(!machine.trim()||!note.trim())return toast('اكتب اسم الجهاز ووصف العطل');nativeAction('fault_create',{machine,note,urgency}).catch(e=>toast(e.message))};
 document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>dialog('حل بلاغ العطل','<label>إجراء الحل<textarea required name="note" maxlength="500" placeholder="مثال: اتصلت بالصيانة والجهاز اتصلح"></textarea></label>',f=>nativeAction('fault_resolve',{id:b.dataset.resolve,note:f.get('note')})));
 const newSwap=document.querySelector('#x-swap-new');
 if(newSwap)newSwap.onclick=()=>{const shiftId=document.querySelector('#x-shift').value,targetEmployeeId=Number(document.querySelector('#x-peer').value);if(!shiftId||!targetEmployeeId)return toast('اختر الشفت والزميل');nativeAction('shift_swap_request',{shiftId,targetEmployeeId}).catch(e=>toast(e.message))};
 document.querySelectorAll('[data-swap-ok]').forEach(b=>b.onclick=()=>{if(confirm('الموافقة تنقل الشفت للزميل فورًا. متأكد؟'))nativeAction('shift_swap_review',{id:b.dataset.swapOk,approved:true}).catch(e=>toast(e.message))});
 document.querySelectorAll('[data-swap-no]').forEach(b=>b.onclick=()=>dialog('رفض طلب التبديل','<label>سبب الرفض<textarea required name="note" maxlength="500"></textarea></label>',f=>nativeAction('shift_swap_review',{id:b.dataset.swapNo,approved:false,note:f.get('note')})));
 document.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>dialog('اعتراض على نقطة','<label>سبب الاعتراض<textarea required name="reason" maxlength="500" placeholder="اشرح للمدير ليه النقطة غير مستحقة"></textarea></label>',f=>nativeAction('point_object',{pointId:b.dataset.object,reason:f.get('reason')})));
 document.querySelectorAll('[data-obj-ok]').forEach(b=>b.onclick=()=>dialog('قبول الاعتراض وإلغاء النقطة','<label>ملاحظة القرار<textarea required name="note" maxlength="500"></textarea></label>',f=>nativeAction('point_objection_review',{id:b.dataset.objOk,approved:true,note:f.get('note')})));
 document.querySelectorAll('[data-obj-no]').forEach(b=>b.onclick=()=>dialog('رفض الاعتراض','<label>سبب الرفض<textarea required name="note" maxlength="500"></textarea></label>',f=>nativeAction('point_objection_review',{id:b.dataset.objNo,approved:false,note:f.get('note')})));
 const newAnn=document.querySelector('#x-ann-new');
 if(newAnn)newAnn.onclick=()=>{const kind=document.querySelector('#x-ann-kind').value,data={kind,title:document.querySelector('#x-ann-title').value,body:document.querySelector('#x-ann-body').value};if(kind==='branch')data.branch=document.querySelector('#x-ann-branch').value;if(kind==='department'){data.branch=document.querySelector('#x-ann-branch').value;data.department=document.querySelector('#x-ann-dep').value}if(!data.title.trim()||!data.body.trim())return toast('اكتب عنوان الإعلان ونصه');nativeAction('announcement_create',data).catch(e=>toast(e.message))};
 document.querySelectorAll('[data-ack]').forEach(b=>{if(!b.onclick)b.onclick=()=>nativeAction('announcement_ack',{id:b.dataset.ack}).catch(e=>toast(e.message))});
 const saveAvail=document.querySelector('#x-avail-save');
 if(saveAvail)saveAvail.onclick=()=>{const days=[...document.querySelectorAll('input[name=x-day]:checked')].map(c=>Number(c.value));nativeAction('availability_set',{weekdays:days,note:document.querySelector('#x-avail-note').value}).catch(e=>toast(e.message))};
 const newDoc=document.querySelector('#x-doc-new');
 if(newDoc)newDoc.onclick=()=>{const employeeId=Number(document.querySelector('#x-doc-emp').value),type=document.querySelector('#x-doc-type').value,expiry=document.querySelector('#x-doc-expiry').value,note=document.querySelector('#x-doc-note').value;if(!employeeId||!type.trim()||!expiry)return toast('اختر الموظف ونوع الوثيقة وتاريخ الانتهاء');nativeAction('doc_add',{employeeId,type,expiry,note}).catch(e=>toast(e.message))};
 document.querySelectorAll('[data-doc-del]').forEach(b=>b.onclick=()=>{if(confirm('حذف الوثيقة؟'))nativeAction('doc_remove',{id:b.dataset.docDel}).catch(e=>toast(e.message))});
 const chatSend=document.querySelector('#x-chat-send');
 if(chatSend){const send=()=>{const inp=document.querySelector('#x-chat-body');if(!inp.value.trim())return;nativeAction('chat_send',{body:inp.value}).catch(e=>toast(e.message))};chatSend.onclick=send;document.querySelector('#x-chat-body').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();send()}}}
 const osNew=document.querySelector('#x-os-new');
 if(osNew)osNew.onclick=()=>{const data={day:document.querySelector('#x-os-day').value,start:document.querySelector('#x-os-start').value,end:document.querySelector('#x-os-end').value};if(nodeUser.role==='admin'){data.department=document.querySelector('#x-os-dep').value;data.branch=document.querySelector('#x-os-branch').value}if(!data.day||!data.start||!data.end)return toast('حدد اليوم والوقت');nativeAction('open_shift_create',data).catch(e=>toast(e.message))};
 document.querySelectorAll('[data-os-claim]').forEach(b=>b.onclick=()=>nativeAction('open_shift_claim',{id:b.dataset.osClaim}).catch(e=>toast(e.message)));
 document.querySelectorAll('[data-os-ok]').forEach(b=>b.onclick=()=>{const [id,claimId]=b.dataset.osOk.split(':');nativeAction('open_shift_review',{id,claimId,approved:true}).catch(e=>toast(e.message))});
 document.querySelectorAll('[data-os-no]').forEach(b=>b.onclick=()=>{const [id,claimId]=b.dataset.osNo.split(':');dialog('رفض طلب الشفت','<label>سبب الرفض<textarea name="note" maxlength="500"></textarea></label>',f=>nativeAction('open_shift_review',{id,claimId,approved:false,note:f.get('note')}))});
 document.querySelectorAll('[data-pin-set]').forEach(b=>b.onclick=()=>dialog('تعيين رقم سري للكشك','<label>الرقم السري (من ٤ لـ ٨ أرقام)<input required name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8"></label><p class="x-hint">قوله للموظف بشكل شخصي. الرقم بيتخزن مشفر.</p>',f=>nativeAction('kiosk_pin_set',{employeeId:Number(b.dataset.pinSet),pin:f.get('pin')})));
 document.querySelectorAll('[data-pin-clear]').forEach(b=>b.onclick=()=>{if(confirm('مسح الرقم السري للموظف ده؟'))nativeAction('kiosk_pin_clear',{employeeId:Number(b.dataset.pinClear)}).catch(e=>toast(e.message))});
}

function announcementBanner(){
 if(!loggedIn()||page!=='overview')return;
 const app=document.querySelector('#app');if(!app)return;
 const acked=new Set((db.announcementAcks||[]).filter(k=>Number(k.employeeId)===Number(nodeUser.id)).map(k=>String(k.announcementId)));
 const pending=(db.announcements||[]).filter(a=>!acked.has(String(a.id))&&(a.scope.kind==='all'||(a.scope.kind==='branch'&&a.scope.branch===nodeUser.branch)||(a.scope.kind==='department'&&a.scope.branch===nodeUser.branch)));
 if(!pending.length)return;
 const latest=pending.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
 app.insertAdjacentHTML('afterbegin','<div class="x-handover x-ann-banner"><b>📢 إعلان جديد: '+h(latest.title)+'</b> '+h(latest.body.length>140?latest.body.slice(0,140)+'…':latest.body)+(pending.length>1?'<small>+'+(pending.length-1)+' إعلان آخر</small>':'')+'<div><button type="button" data-ack="'+h(latest.id)+'">تم الاطلاع</button></div></div>');
 const b=app.querySelector('[data-ack]');
 if(b)b.onclick=()=>nativeAction('announcement_ack',{id:b.dataset.ack}).catch(e=>toast(e.message));
}
function handoverCard(){
 if(!loggedIn()||nodeUser.role!=='employee'||page!=='overview')return;
 const app=document.querySelector('#app');if(!app)return;
 const open=activePunch(Number(nodeUser.id));
 const last=db.lastHandover;
 if(!open&&!last)return;
 let html='';
 if(open&&last&&last.by!==nodeUser.full_name)html+='<div class="x-handover"><b>تسليم الوردية السابقة من '+h(last.by)+':</b> '+h(last.note)+'<small>'+h(last.at.slice(0,16).replace('T',' '))+'</small></div>';
 if(open)html+='<div class="x-handover"><label>ملاحظة تسليم الوردية (اختياري)<textarea id="x-handover" maxlength="1000" placeholder="اكتب أي ملاحظة لزميلك في الوردية الجاية — هتتسجل تلقائيًا مع الانصراف">'+h(handoverDraft)+'</textarea></label></div>';
 app.insertAdjacentHTML('afterbegin',html);
 const field=document.querySelector('#x-handover');
 if(field)field.oninput=e=>{handoverDraft=e.target.value};
}

render=function(){
 const desired=page;
 if(pages.includes(desired))page='overview';
 oldRender();
 page=desired;
 nav();
 const app=document.querySelector('#app');
 if(app&&loggedIn()){
  if(desired==='faults')app.innerHTML=faultsPanel();
  else if(desired==='shift-swap')app.innerHTML=swapPanel()+openShiftsBlock()+availabilityBlock();
  else if(desired==='objections')app.innerHTML=objectionsPanel();
  else if(desired==='announcements')app.innerHTML=announcementsPanel();
  else if(desired==='documents'&&canReview())app.innerHTML=documentsPanel();
  else if(desired==='chat')app.innerHTML=chatPanel();
  else if(desired==='kiosk-admin'&&canReview())app.innerHTML=kioskPanel();
  bindPanels();
  handoverCard();
  announcementBanner();
 }
};

const st=document.createElement('style');
st.textContent='.x-ui{direction:rtl;background:linear-gradient(140deg,#181915,#080907);color:#f5efe2;border:1px solid #65552e;border-radius:24px;padding:clamp(16px,3vw,30px);min-height:60vh}.x-kicker{font-size:11px;color:#dcc17e;letter-spacing:2px}.x-ui h2{font-size:clamp(24px,4vw,40px);margin:12px 0;color:#efd194}.x-ui p{color:#beb7a8}.x-hint{color:#c6bea8;font-size:13px}.x-form{display:grid;gap:10px;margin:16px 0 24px}.x-form input,.x-form select,.x-form textarea,.x-handover textarea{background:#22231d;border:1px solid #544a32;color:#f5efe2;border-radius:12px;padding:12px;font-family:inherit}.x-overflow{overflow:auto;margin-bottom:18px}.x-ui table{width:100%;min-width:640px;border-collapse:collapse}.x-ui th,.x-ui td{padding:13px;border-bottom:1px solid #474336;text-align:right;vertical-align:top}.x-ui td small{display:block;color:#bbb09c}.x-ui td button{border:1px solid #75643c;background:#27261e;color:#f0dbad;border-radius:99px;padding:8px 12px;cursor:pointer;margin:2px}.x-urgent{color:#ff9d7a;font-weight:bold}.x-open{color:#f0d393;font-weight:bold}.x-done{color:#9fdc9f;font-weight:bold}.x-handover{background:#22231d;border:1px solid #65552e;border-radius:16px;padding:14px;margin-bottom:16px;color:#f5efe2}.x-handover small{display:block;color:#bbb09c;margin-top:6px}.x-handover label{display:block}.x-handover textarea{width:100%;margin-top:8px}';
st.textContent+='.x-chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.x-chip{background:#22231d;border:1px solid #544a32;color:#f5efe2;border-radius:99px;padding:8px 14px;cursor:pointer}.x-avail input#x-avail-note{background:#22231d;border:1px solid #544a32;color:#f5efe2;border-radius:12px;padding:12px;font-family:inherit;width:100%;margin-bottom:10px}.x-ann-banner button{border:1px solid #75643c;background:#27261e;color:#f0dbad;border-radius:99px;padding:8px 14px;cursor:pointer;margin-top:8px}.x-avail{margin-top:8px}';st.textContent+='.x-chat{display:grid;gap:8px;margin:16px 0;max-height:50vh;overflow:auto}.x-msg{background:#22231d;border:1px solid #544a32;border-radius:14px;padding:10px 14px;color:#f5efe2}.x-msg small{display:block;color:#bbb09c;font-size:11px;margin-top:4px}.x-msg-mgr{border-color:#dcc17e}.x-chat-form{grid-template-columns:1fr auto;display:grid}';document.head.append(st);
})();
