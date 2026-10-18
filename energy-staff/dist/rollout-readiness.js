(()=>{
 const previous=render;
 render=function(){const selectedPage=page;if(selectedPage==='rollout-readiness')page='overview';previous();page=selectedPage;if(!nodeUser||nodeUser.role!=='admin')return;
  const branch=document.querySelector('#branch');if(branch){const selected=branch.value;const choices=['كل الفروع',...new Set((db.branches||[]).map(b=>b.name))];branch.innerHTML=choices.map(b=>'<option>'+esc(b)+'</option>').join('');branch.value=choices.includes(selected)?selected:'كل الفروع';}
  const nav=document.querySelector('#nav');if(nav&&!nav.querySelector('[data-readiness]')){const b=document.createElement('button');b.dataset.readiness='1';b.textContent='✓ تجهيز حسابات الموظفين';b.onclick=()=>{page='rollout-readiness';render()};nav.append(b);}
  if(page!=='rollout-readiness')return;
  const people=(db.staff||[]).filter(s=>s.legacyProfileId),unlinked=people.filter(s=>s.needsActivation),incomplete=people.filter(s=>s.needsReview);
  document.querySelector('#app').innerHTML='<section class="shiftplanner"><h2>تجهيز حسابات الموظفين</h2><p>ملف الموظف المستورد لا ينشئ كلمة مرور أو يمنح دخولًا تلقائيًا. يسجل الموظف حسابه، ثم تختار الإدارة ملفه القديم أثناء الموافقة لربط مهامه وسجلاته.</p><p>ملفات مستوردة: '+people.length+' · تحتاج تفعيل: '+unlinked.length+' · بيانات تحتاج مراجعة: '+incomplete.length+'</p><div class="table-wrap"><table><thead><tr><th>الموظف / الكود</th><th>القسم</th><th>الفرع</th><th>التجهيز</th></tr></thead><tbody>'+people.map(s=>'<tr><td>'+esc(s.name)+'<br>'+esc(s.employeeCode||'بدون كود')+'</td><td>'+esc(s.department)+'</td><td>'+esc(s.branch)+'</td><td>'+(s.needsActivation?'ينتظر تسجيل وربط الحساب':'مرتبط بحساب')+(s.needsReview?' · يلزم مراجعة الفرع / القسم':'')+'</td></tr>').join('')+'</tbody></table></div><button id="readinessApprovals">مراجعة وربط طلبات التسجيل</button></section>';
  document.querySelector('#readinessApprovals').onclick=()=>{page='join-approvals';render()};
 };
})();
