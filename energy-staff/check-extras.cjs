// Regression checks for the staff-extras UI: fault reports, shift swap, point objections, handover note.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const nodes={};function el(s){return nodes[s]??={value:'',options:[],style:{},dataset:{},open:false,hidden:false,outerHTML:'',disabled:false,innerHTML:'',insertAdjacentHTML(_,x){this.innerHTML+=x},addEventListener(){},showModal(){},close(){},cloneNode(){return this},replaceWith(){},querySelector:el,querySelectorAll(){return []},setAttribute(){},closest(){return el('closest-stub')},remove(){},firstChild:{textContent:''},lastChild:{textContent:''},append(c){(this.children??=[]).push(c)},prepend(){}}}
const ctx={document:{querySelector:el,querySelectorAll:()=>[],createElement:()=>el('created-'+Math.random()),body:{classList:{add(){},remove(){}},prepend(){}},head:{append(){}}},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,URL,Blob,FormData,setTimeout(){},setInterval(){},navigator:{},window:{addEventListener(){}},crypto,confirm:()=>true,fetch:()=>Promise.reject(Error('offline'))};
vm.createContext(ctx);
for(const f of ['app.js','upgrades.js','operations.js','payroll.js','team.js','policy.js','sales-dashboard.js','entry.js','hostinger.js','identity.js','assessment.js','employee-tools.js','command-center.js','attendance-status.js','shift-planner.js','attendance-alerts.js','rollout-readiness.js','live-readiness.js','staff-extras.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);let count=0;function ok(label,cond){assert(cond,label);count++}

// Logged-in employee: three new nav entries appear
run("nodeUser={role:'employee',id:7,full_name:'كابتن تجريبي',position:'كابتن',branch:'فرع فودافون'};previewSession={kind:'employee',employeeId:7};db.staff.push({id:7,name:'كابتن تجريبي',position:'كابتن',department:'التدريب',branch:'فرع فودافون'})");
run("page='overview';render()");
const navButtons=(nodes['#nav'].children||[]).filter(b=>b.dataset&&b.dataset.extras).map(b=>b.textContent);
ok('faults nav button appears',navButtons.some(t=>t.includes('بلاغات الأعطال')));
ok('shift swap nav button appears',navButtons.some(t=>t.includes('تبديل الشفتات')));
ok('objections nav button appears',navButtons.some(t=>t.includes('النقاط والاعتراضات')));

// Faults page renders report form and scoped list
run("db.faultReports=[{id:'f1',employeeId:7,employeeName:'كابتن تجريبي',department:'التدريب',branch:'فرع فودافون',machine:'جهاز الجري 3',note:'الحزام بيهتز',urgency:'عاجل',status:'open',createdAt:'2026-10-19T10:00:00.000Z'},{id:'f2',employeeId:8,employeeName:'زميل',department:'التدريب',branch:'فرع فودافون',machine:'جهاز آخر',note:'x',urgency:'عادي',status:'resolved',createdAt:'2026-10-19T11:00:00.000Z'}]");
run("page='faults';render()");
const faultsHtml=String(nodes['#app'].innerHTML);
ok('faults page renders form',faultsHtml.includes('بلاغ جديد')&&faultsHtml.includes('x-machine'));
ok('employee sees own fault',faultsHtml.includes('جهاز الجري 3'));
ok('employee view is scoped (list content from db.faultReports)',faultsHtml.includes('الحزام بيهتز'));

// Shift swap page renders employee request form
run("db.shiftAssignments=[{id:'s1',employeeId:7,employeeName:'كابتن تجريبي',branch:'فرع فودافون',day:'2026-10-21',start:'09:00',end:'17:00'},{id:'s0',employeeId:7,employeeName:'كابتن تجريبي',branch:'فرع فودافون',day:'2026-10-18',start:'09:00',end:'17:00'}];db.shiftSwapPeers=[{id:8,name:'زميل كابتن'}];db.shiftSwapRequests=[]");
run("page='shift-swap';render()");
const swapHtml=String(nodes['#app'].innerHTML);
ok('swap page renders request form',swapHtml.includes('طلب تبديل'));
ok('future shift listed',swapHtml.includes('2026-10-21'));
ok('past shift not offered for swap',!swapHtml.includes('2026-10-18'));
ok('colleagues listed',swapHtml.includes('زميل كابتن'));

// Manager sees review buttons on pending swap requests
run("nodeUser={role:'manager',id:2,full_name:'مدير',position:'كابتن',branch:'فرع فودافون'};db.shiftSwapRequests=[{id:'r1',shiftId:'s1',requesterId:7,requesterName:'كابتن تجريبي',targetId:8,targetName:'زميل كابتن',branch:'فرع فودافون',department:'التدريب',day:'2026-10-21',start:'09:00',end:'17:00',status:'pending',createdAt:'2026-10-19T12:00:00.000Z'}]");
run("page='shift-swap';render()");
const mgrSwap=String(nodes['#app'].innerHTML);
ok('manager sees pending swap with approve/reject',mgrSwap.includes('data-swap-ok')&&mgrSwap.includes('data-swap-no'));

// Objections page: employee sees own points with object button
run("nodeUser={role:'employee',id:7,full_name:'كابتن تجريبي',position:'كابتن',branch:'فرع فودافون'};db.points=[{id:'p1',employeeId:7,color:'red',amount:1,reason:'تأخير',at:'2026-10-19T08:00:00.000Z'}];db.pointObjections=[]");
run("page='objections';render()");
const objHtml=String(nodes['#app'].innerHTML);
ok('objections page lists own points',objHtml.includes('تأخير')&&objHtml.includes('data-object'));

// Handover: textarea on overview for open punch, note rides the punch_out call
run("db.punches=[{id:99,employeeId:7,branch:'فرع فودافون',in:'2026-10-19T06:00:00.000Z',out:null}];db.breaks=[];db.lastHandover=null");
run("page='overview';render()");
ok('handover textarea appears for open punch',String(nodes['#app'].innerHTML).includes('x-handover'));
run("document.querySelector('#x-handover').value='الطابونة محتاجة تزويد';document.querySelector('#x-handover').oninput({target:{value:'الطابونة محتاجة تزويد'}})");
run("globalThis.__captured=null;nodeApi=async(p,o)=>{globalThis.__captured={p,o};return {db,revision:1}}");
// Announcements: nav, panel with ack, manager create form
run("page='announcements';render()");
const annHtml=String(nodes['#app'].innerHTML);
ok('announcements page renders',annHtml.includes('الإعلانات'));
run("db.announcements=[{id:'a1',title:'اجتماع',body:'بكرة ١٠ الصبح',scope:{kind:'all'},createdById:5,createdBy:'الإدارة',createdAt:'2026-10-19T10:00:00.000Z'}];db.announcementAcks=[];page='overview';render()");
ok('unacked announcement banner on overview',String(nodes['#app'].innerHTML).includes('إعلان جديد'));
run("page='announcements';render()");
ok('announcement listed with ack button',String(nodes['#app'].innerHTML).includes('data-ack'));
run("nodeUser={role:'manager',id:2,full_name:'مدير',position:'كابتن',branch:'فرع فودافون'};page='announcements';render()");
ok('manager sees announcement create form',String(nodes['#app'].innerHTML).includes('x-ann-new'));

// Availability block on the shift-swap page (employee form, manager list)
run("nodeUser={role:'employee',id:7,full_name:'كابتن تجريبي',position:'كابتن',branch:'فرع فودافون'};db.availabilities=[{id:'v1',employeeId:7,employeeName:'كابتن تجريبي',branch:'فرع فودافون',department:'التدريب',weekdays:[0,2],note:'الصبح بس',updatedAt:'2026-10-19T10:00:00.000Z'}];page='shift-swap';render()");
const availHtml=String(nodes['#app'].innerHTML);
ok('availability form renders on swap page',availHtml.includes('إتاحتي الأسبوعية')&&availHtml.includes('x-avail-save'));
run("nodeUser={role:'manager',id:2,full_name:'مدير',position:'كابتن',branch:'فرع فودافون'};render()");
ok('manager sees team availability list',String(nodes['#app'].innerHTML).includes('إتاحة الفريق')&&String(nodes['#app'].innerHTML).includes('الصبح بس'));

// Documents panel for manager/admin
run("db.documents=[{id:'d1',employeeId:7,employeeName:'كابتن تجريبي',branch:'فرع فودافون',department:'التدريب',type:'شهادة إسعافات أولية',expiry:'2026-11-15',note:'',createdAt:'2026-10-19T10:00:00.000Z',createdBy:'الإدارة'}];page='documents';render()");
const docHtml=String(nodes['#app'].innerHTML);
ok('documents panel renders with expiry state',docHtml.includes('وثائق وشهادات الفريق')&&docHtml.includes('شهادة إسعافات أولية')&&docHtml.includes('تنتهي خلال'));
run("nodeUser={role:'employee',id:7,full_name:'كابتن تجريبي',position:'كابتن',branch:'فرع فودافون'};page='documents';render()");
ok('employee cannot open documents panel',!String(nodes['#app'].innerHTML).includes('x-doc-new'));

// Chat page
run("nodeUser={role:'employee',id:7,full_name:'كابتن تجريبي',position:'كابتن',branch:'فرع فودافون'};db.chatMessages=[{id:'m1',employeeId:2,name:'مدير',branch:'فرع فودافون',department:'التدريب',room:'branch',body:'الاجتماع ١١',at:'2026-10-19T09:00:00.000Z',manager:true},{id:'m2',employeeId:9,name:'غريب',branch:'فرع الرخاوي',department:'السيلز',room:'branch',body:'لازم لا يظهر',at:'2026-10-19T09:00:00.000Z',manager:false},{id:'m3',employeeId:2,name:'مدير',branch:null,department:'التدريب',room:'all',body:'إعلان عام للكل',at:'2026-10-19T09:30:00.000Z',manager:true}]");
run("page='chat';render()");
const chatHtml=String(nodes['#app'].innerHTML);
ok('chat page renders with branch messages only',chatHtml.includes('الاجتماع ١١')&&!chatHtml.includes('لازم لا يظهر'));
ok('chat has branch and all-staff tabs',chatHtml.includes('x-room-branch')&&chatHtml.includes('x-room-all'));
ok('chat send box present',chatHtml.includes('x-chat-send'));
run("document.querySelector('#x-room-all').onclick()");
ok('all-staff room shows shared message',String(nodes['#app'].innerHTML).includes('إعلان عام للكل')&&!String(nodes['#app'].innerHTML).includes('الاجتماع ١١'));

// Open shifts: manager create form + review buttons; employee claim button
run("nodeUser={role:'manager',id:2,full_name:'مدير',position:'كابتن',branch:'فرع فودافون'};db.openShifts=[{id:'o1',branch:'فرع فودافون',department:'التدريب',day:'2026-10-22',start:'18:00',end:'23:00',graceMinutes:10,status:'open',claims:[{id:'c1',employeeId:7,name:'كابتن تجريبي',at:'2026-10-19T10:00:00.000Z',status:'pending'}],createdBy:2,createdByName:'مدير',createdAt:'2026-10-19T09:00:00.000Z'}];page='shift-swap';render()");
const osHtml=String(nodes['#app'].innerHTML);
ok('open shifts block renders',osHtml.includes('الشفتات المفتوحة'));
ok('manager sees open shift create form',osHtml.includes('x-os-new'));
ok('manager sees claim review buttons',osHtml.includes('data-os-ok')&&osHtml.includes('data-os-no'));
run("nodeUser={role:'employee',id:8,full_name:'زميل',position:'كابتن',branch:'فرع فودافون'};render()");
ok('employee sees claim button on open shift',String(nodes['#app'].innerHTML).includes('data-os-claim'));

// Kiosk admin page for manager
run("nodeUser={role:'admin',id:5,full_name:'المالك',position:'كابتن',branch:'فرع فودافون'};db.rules.kioskEnabled=false;page='kiosk-admin';render()");
const kioskHtml=String(nodes['#app'].innerHTML);
ok('kiosk admin page renders with PIN controls for admin',kioskHtml.includes('كشك البصمة')&&kioskHtml.includes('data-pin-set'));
ok('kiosk is off by default with an enable toggle',kioskHtml.includes('مقفول')&&kioskHtml.includes('x-kiosk-toggle'));
run("nodeUser={role:'manager',id:2,full_name:'مدير',position:'كابتن',branch:'فرع فودافون'};page='kiosk-admin';render()");
ok('manager cannot open kiosk admin page',!String(nodes['#app'].innerHTML).includes('x-kiosk-toggle'));
ok('kiosk page path documented',kioskHtml.includes('/kiosk.html'));

// Kiosk public page files
const kioskPage=fs.readFileSync('dist/kiosk.html','utf8');
ok('kiosk.html references external script only (CSP)',kioskPage.includes('<script src="kiosk.js"></script>')&&!kioskPage.includes('<script>'));
const kioskJs=fs.readFileSync('dist/kiosk.js','utf8');
ok('kiosk.js posts to the kiosk endpoint',kioskJs.includes('/api/kiosk/punch'));

(async()=>{
 await vm.runInContext("nativeAction('punch_out',{coords:{latitude:29.96,longitude:32.55,accuracy:5}})",ctx);
 const captured=run("globalThis.__captured");
 ok('handover note attached to punch_out',captured.o.body.action==='punch_out'&&captured.o.body.data.handoverNote==='الطابونة محتاجة تزويد');
 console.log('PASS:',count,'staff-extras UI regression checks');
})().catch(e=>{console.error(e);process.exit(1)});
