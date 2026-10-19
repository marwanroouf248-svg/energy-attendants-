(()=>{
const oldRender=render;
const job='أسسمنت — دكتور علاج طبيعي';
const h=x=>esc(String(x??''));
const canAccess=()=>nodeUser&&(nodeUser.role==='admin'||nodeUser.position==='سيلز'||nodeUser.position===job);
const canBook=()=>nodeUser&&(nodeUser.role==='admin'||nodeUser.position==='سيلز');
const canMedical=()=>nodeUser&&(nodeUser.role==='admin'||nodeUser.position===job);
const doctors=()=>nodeUser.role==='admin'?db.staff.filter(x=>x.position===job):(db.assessmentDoctors||[]);
function panel(){
if(!canAccess())return;
const nav=document.querySelector('#nav');
if(nav&&!nav.querySelector('[data-assessment]')){
const b=document.createElement('button');b.dataset.assessment='1';b.textContent='✦ مواعيد الأسسمنت';b.onclick=()=>{page='assessment';render()};nav.append(b);
}
if(page!=='assessment')return;
const app=document.querySelector('#app');if(!app)return;
const items=(db.assessmentBookings||[]).slice().sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time));
const count=s=>items.filter(x=>x.bookingStatus===s).length;
const tr=items.map(a=>'<tr><td><b>'+h(a.day)+'</b><small>'+h(a.time)+'</small></td><td>'+h(a.branch)+'<small>'+h(a.doctorName)+'</small></td><td>'+h(a.patientName)+'<small dir="ltr">'+h(a.phone)+'</small></td><td>'+h(({booked:'محجوز',attended:'حضر',completed:'تم الكشف',no_show:'لم يحضر',cancelled:'ملغي'})[a.bookingStatus])+'</td><td><button type="button" data-detail="'+h(a.id)+'">التفاصيل ←</button></td></tr>').join('');
app.innerHTML='<section class="assess-ui" dir="rtl"><div class="assess-kicker">ENERGY PLUS / ASSESSMENT</div><h2>مواعيد الأسسمنت ✦</h2><p>إدارة المواعيد لكل فرع على حدة، وبصلاحيات مختلفة للسيلز والدكتور.</p><div class="assess-metrics"><div><small>إجمالي الحجوزات</small><b>'+items.length+'</b></div><div><small>محجوز</small><b>'+count('booked')+'</b></div><div><small>حضر</small><b>'+count('attended')+'</b></div><div><small>تم الكشف</small><b>'+count('completed')+'</b></div></div><header class="assess-controls"><h3>جدول المواعيد</h3><div id="assess-new"></div></header><div class="assess-overflow"><table><thead><tr><th>التاريخ والوقت</th><th>الفرع والدكتور</th><th>العميل</th><th>الحالة</th><th>المتابعة</th></tr></thead><tbody>'+(tr||'<tr><td colspan="5">لا توجد حجوزات حتى الآن</td></tr>')+'</tbody></table></div><p>ملحوظة: السيلز لا يمكنه الوصول إلى ملاحظات الدكتور أو بيانات الإصابات.</p></section>';
if(canBook()){const b=document.createElement('button');b.className='primary';b.textContent='＋ إضافة حجز';b.onclick=makeBooking;document.querySelector('#assess-new').append(b)}
app.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(items.find(x=>String(x.id)===b.dataset.detail)));
}
function dialog(title,fields,submit){
openForm(title,fields,()=>{});
const form=document.querySelector('#form');
form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{await submit(new FormData(form));document.querySelector('#modal').close();toast('تم الحفظ بنجاح')}catch(e){toast(e.message)}finally{b.disabled=false}};
}
function makeBooking(){
const branches=nodeUser.role==='admin'?db.branches.map(x=>x.name):[nodeUser.branch];
const ds=doctors().filter(x=>branches.includes(x.branch));
if(!ds.length)return toast('لا يوجد دكتور أسسمنت معتمد في الفرع. راجع حسابات الموظفين.');
const opts=branches.map(x=>'<option value="'+h(x)+'">'+h(x)+'</option>').join('');
const doctorOpts=ds.map(x=>'<option value="'+h(x.id)+'" data-branch="'+h(x.branch)+'">'+h(x.name)+' — '+h(x.branch)+'</option>').join('');
dialog('حجز موعد أسسمنت','<label>الفرع<select required name="branch">'+opts+'</select></label><label>الدكتور<select required name="doctorId">'+doctorOpts+'</select></label><label>اسم العميل<input required maxlength="120" name="patientName"></label><label>رقم الهاتف<input required type="tel" name="phone"></label><label>التاريخ<input required type="date" name="day"></label><label>الوقت<input required type="time" step="1800" name="time"></label><label>ملاحظات الريسبشن<textarea name="receptionNotes" maxlength="1000"></textarea></label>',f=>nativeAction('assessment_create',Object.fromEntries(f)));
const branch=document.querySelector('#fields [name=branch]'),doc=document.querySelector('#fields [name=doctorId]');
const sync=()=>{const match=ds.filter(x=>x.branch===branch.value);doc.innerHTML=match.length?match.map(x=>'<option value="'+h(x.id)+'">'+h(x.name)+' — '+h(x.branch)+'</option>').join(''):'<option value="" selected disabled>لا يوجد دكتور معتمد في هذا الفرع</option>'};branch.onchange=sync;sync();
}
function detail(a){
if(!a)return;const medical=canMedical();const sales=canBook();const statuses=medical?['booked','attended','completed','no_show','cancelled']:['booked','cancelled'];
const names={booked:'محجوز',attended:'حضر',completed:'تم الكشف',no_show:'لم يحضر',cancelled:'ملغي'};
const status='<label>الحالة<select name="status">'+statuses.map(s=>'<option value="'+s+'" '+(s===a.bookingStatus?'selected':'')+'>'+names[s]+'</option>').join('')+'</select></label>';
const doctorFields=medical?'<label>ملاحظات الدكتور السرية<textarea name="doctorNotes" maxlength="4000">'+h(a.doctorNotes||'')+'</textarea></label><label>هل توجد إصابة؟<select name="injuryStatus"><option value="unknown">لم يحدد</option><option value="yes">نعم</option><option value="no">لا</option></select></label><label><input type="checkbox" name="planDelivered" '+(a.planDelivered?'checked':'')+'> استلم نظام التمرين</label>':'';
dialog('متابعة الأسسمنت','<p>'+h(a.patientName)+' — '+h(a.branch)+' — '+h(a.day)+' / '+h(a.time)+'</p><p>رقم الهاتف: '+h(a.phone)+'</p><p>ملاحظات الريسبشن: '+h(a.receptionNotes||'—')+'</p>'+(medical||sales?status:'<p>'+h(names[a.bookingStatus])+'</p>')+doctorFields,f=>nativeAction('assessment_update',{id:a.id,status:f.get('status'),...(medical?{doctorNotes:f.get('doctorNotes'),injuryStatus:f.get('injuryStatus'),planDelivered:f.has('planDelivered')}: {})}));
if(medical)document.querySelector('#fields [name=injuryStatus]').value=a.injuryStatus||'unknown';
if(!medical&&!sales)document.querySelector('#form [type=submit]').hidden=true;
}
render=function(){const desired=page;if(desired==='assessment')page='overview';oldRender();page=desired;panel()};
const st=document.createElement('style');st.textContent='.assess-ui{direction:rtl;background:linear-gradient(140deg,#181915,#080907);color:#f5efe2;border:1px solid #65552e;border-radius:24px;padding:clamp(16px,3vw,30px);min-height:60vh}.assess-kicker{font-size:11px;color:#dcc17e;letter-spacing:2px}.assess-ui h2{font-size:clamp(27px,4vw,45px);margin:12px 0;color:#efd194}.assess-ui p{color:#beb7a8}.assess-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0}.assess-metrics div{border:1px solid #544a32;border-radius:16px;padding:18px;background:#22231d}.assess-metrics small{display:block;color:#c6bea8}.assess-metrics b{display:block;font-size:32px;color:#f0d393}.assess-controls{display:flex;justify-content:space-between;align-items:center}.assess-overflow{overflow:auto}.assess-ui table{width:100%;min-width:680px;border-collapse:collapse}.assess-ui th,.assess-ui td{padding:15px;border-bottom:1px solid #474336;text-align:right}.assess-ui td small{display:block;color:#bbb09c}.assess-ui td button{border:1px solid #75643c;background:#27261e;color:#f0dbad;border-radius:99px;padding:9px;cursor:pointer}@media(max-width:650px){.assess-metrics{grid-template-columns:repeat(2,1fr)}}';document.head.append(st);
})();