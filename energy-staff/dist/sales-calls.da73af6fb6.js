// سجل المكالمات: شيت واحد فيه كل توثيق التواصل مع العملاء (مكالمات + كومنتات)، مع فلاتر النتيجة والموظف والبحث
(()=>{
navs.push(['sales-calls','☎','سجل المكالمات']);
let callsOutcome='all',callsPerson='all',callsQuery='';
function callRows(){
 const rows=[];
 for(const l of (db.salesLeads||[]))for(const c of (l.comments||[]))rows.push({at:c.at,kind:c.kind==='note'?'note':'call',lead:l,comment:String(c.comment||''),outcome:c.outcome||'',nextAction:c.nextAction||'',nextFollowUp:c.nextFollowUp||''});
 return rows.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
}
function salesCallsView(){
 const all=callRows();
 const people=[...new Set(all.map(r=>r.lead.employeeName))];
 const rows=all.filter(r=>(callsOutcome==='all'||(callsOutcome==='note'?r.kind==='note':r.outcome===callsOutcome))&&(callsPerson==='all'||r.lead.employeeName===callsPerson)&&(!callsQuery||(r.lead.name+r.lead.phone+r.comment).includes(callsQuery)));
 const weekAgo=new Date(Date.now()-7*86400000).toISOString();
 const chip=(n,t)=>`<span><b>${n}</b>${t}</span>`;
 return `<div class="notice">سجل المكالمات: كل مكالمة أو كومنت على عميل بيتوثق هنا تلقائيًا من صفحة متابعة السيلز. فلتر بالنتيجة أو الموظف، أو ابحث بالاسم أو الرقم أو نص الكومنت.</div>${card('شيت المكالمات',`<div class="toolbar sales-filters"><select id="callsOutcome"><option value="all">كل النتائج</option>${callOutcomes.map(o=>`<option ${callsOutcome===o?'selected':''}>${o}</option>`).join('')}<option value="note" ${callsOutcome==='note'?'selected':''}>كومنتات بدون مكالمة</option></select><select id="callsPerson"><option value="all">كل الموظفين</option>${people.map(p=>`<option ${callsPerson===p?'selected':''}>${esc(p)}</option>`).join('')}</select><input id="callsSearch" placeholder="اسم العميل / رقمه / نص الكومنت" value="${esc(callsQuery)}"><button id="callsSearchGo">بحث</button></div><div class="pipeline-counts">${chip(all.filter(r=>r.at>=weekAgo).length,'توثيق آخر ٧ أيام')}${chip(all.filter(r=>r.outcome==='مهتم').length,'مهتم')}${chip(all.filter(r=>r.outcome==='اشترك').length,'اشترك')}${chip(all.filter(r=>r.outcome==='لم يرد').length,'لم يرد')}${chip(all.length,'إجمالي التوثيق')}</div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>العميل</th><th>الهاتف</th><th>الخطة</th><th>الانتهاء</th><th>السيلز</th><th>المرحلة</th><th>النتيجة</th><th>الكومنت</th><th>الخطوة الجاية</th><th>المتابعة الجاية</th><th></th></tr></thead><tbody>${rows.slice(0,200).map(r=>`<tr><td style="white-space:nowrap">${stamp(r.at)}</td><td><b>${esc(r.lead.name)}</b></td><td dir="ltr">${esc(r.lead.phone)}</td><td>${esc(r.lead.plan||'—')}</td><td style="white-space:nowrap">${esc(r.lead.expiryDate||'—')}</td><td>${esc(r.lead.employeeName)}</td><td>${esc(r.lead.stage)}</td><td>${r.kind==='note'?'<span class="badge gray">كومنت</span>':esc(r.outcome||'—')}</td><td style="white-space:pre-wrap;min-width:200px">${esc(r.comment)}</td><td>${esc(r.nextAction||'—')}</td><td style="white-space:nowrap">${r.nextFollowUp?stamp(r.nextFollowUp):'—'}</td><td><button data-call-follow="${r.lead.id}">تسجيل مكالمة</button></td></tr>`).join('')||'<tr><td colspan="12" class="empty">لا توجد مكالمات موثقة بعد — أول متابعة أو كومنت على عميل هيظهر هنا</td></tr>'}</tbody></table></div>${rows.length>200?`<p class="empty">بيظهر أحدث 200 سجل من إجمالي ${rows.length} — قلّل النتائج بالفلاتر</p>`:''}`)}`;
}
window.leadCommentForm=function(id){
 const l=(db.salesLeads||[]).find(l=>String(l.id)===String(id));if(!l)return;
 safeSubmit('كومنت على '+l.name,'<p>الكومنت بيتسجل في ملف العميل بدون تغيير مرحلته أو نتيجته — مناسب لأي ملاحظة خارج المكالمات.</p><label>الكومنت<textarea name="comment" required rows="4" maxlength="2000" placeholder="اكتب الملاحظة اللي الفريق محتاج يعرفها عن العميل"></textarea></label>',async f=>{
  const comment=String(f.get('comment')).trim();
  if(!nodeUser||nodeUser.role==='admin'){l.comments.push({id:crypto.randomUUID(),kind:'note',comment:comment.slice(0,2000),at:new Date().toISOString(),outcome:'',nextAction:'',nextFollowUp:'',review:salesCommentReview(comment,'','')});audit('كومنت على عميل سيلز '+l.name);save();render();return}
  return nativeAction('sales_comment',{id:l.id,comment});
 });
};
window.bookAssessmentForLead=function(id){
 const l=(db.salesLeads||[]).find(l=>String(l.id)===String(id));if(!l)return;
 if(!nodeUser)return toast('حجز الأسسمنت بيشتغل من الحساب المباشر بعد تسجيل الدخول');
 if(typeof window.assessmentBookingForm!=='function')return toast('حجز الأسسمنت غير متاح لهذا الحساب');
 const last=(l.comments||[]).at(-1);
 window.assessmentBookingForm({patientName:l.name,phone:l.phone,leadId:l.id,receptionNotes:last?('آخر متابعة ('+(last.outcome||'كومنت')+'): '+String(last.comment||'').slice(0,400)):'عميل من داتا السيلز — مصدره: '+l.source});
};
const callsPrevRender=render;
render=function(){callsPrevRender();if(page!=='sales-calls')return;const t=$('#title');if(t)t.textContent='سجل المكالمات';$('#app').innerHTML=salesCallsView();$('#callsOutcome').onchange=e=>{callsOutcome=e.target.value;render()};$('#callsPerson').onchange=e=>{callsPerson=e.target.value;render()};$('#callsSearchGo').onclick=()=>{callsQuery=$('#callsSearch').value.trim();render()};document.querySelectorAll('[data-call-follow]').forEach(b=>b.onclick=()=>leadUpdateForm(b.dataset.callFollow));};
})();
