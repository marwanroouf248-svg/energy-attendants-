// Regression checks for the two confirmed UI bugs:
// 1) Top branch filter must re-render the current page (staff tasks) instead of the legacy permissions preview.
// 2) Assessment booking must rebuild the doctor list when the branch changes.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');const nodes={};function el(s){return nodes[s]??={value:s==='#branch'?'كل الفروع':'',options:[],style:{},dataset:{},open:false,hidden:false,outerHTML:'',disabled:false,innerHTML:'',insertAdjacentHTML(_,x){this.innerHTML+=x},addEventListener(){},showModal(){},close(){},cloneNode(){return this},replaceWith(){},querySelector:el,querySelectorAll(){return []},setAttribute(){},closest(){return el('closest-stub')},append(c){(this.children??=[]).push(c)},prepend(){}}}const ctx={document:{querySelector:el,querySelectorAll:()=>[],createElement:()=>el('created-'+Math.random()),body:{classList:{add(){},remove(){}},prepend(){}},head:{append(){}}},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,URL,Blob,FormData,setTimeout(){},setInterval(){},navigator:{},window:{addEventListener(){}},crypto,confirm:()=>true,fetch:()=>Promise.reject(Error('offline'))};vm.createContext(ctx);for(const f of ['app.js','upgrades.js','operations.js','payroll.js','team.js','entry.js','hostinger.js','identity.js','assessment.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),ctx);const run=s=>vm.runInContext(s,ctx);let count=0;function ok(label,cond){assert(cond,label);count++}

// Bug 1: branch change on the staff tasks page
run("enterWorkspace({kind:'admin'})");ok('admin workspace entered',run("role==='الإدارة'"));
run("page='daily-team';render()");
ok('tasks page rendered',String(nodes['#app'].innerHTML).includes('توزيع ومراجعة مهام الموظفين'));
nodes['#branch'].value='كل الفروع';
run("$('#branch').onchange({target:$('#branch')})");
const after=String(nodes['#app'].innerHTML);
ok('branch change keeps the staff tasks page',after.includes('توزيع ومراجعة مهام الموظفين'));
ok('branch change does not fall back to the legacy permissions preview',!after.includes('صلاحيات مدير الفرع'));

// Bug 2: assessment booking doctor list follows the selected branch
run("db.branches=[{name:'فرع فودافون',lat:null,lng:null},{name:'فرع الرخاوي',lat:null,lng:null}]");
run("db.staff.push({id:101,name:'دكتور فودافون',position:'أسسمنت — دكتور علاج طبيعي',branch:'فرع فودافون',department:'الأسسمنت والعلاج الطبيعي'},{id:102,name:'دكتور الرخاوي',position:'أسسمنت — دكتور علاج طبيعي',branch:'فرع الرخاوي',department:'الأسسمنت والعلاج الطبيعي'})");
run("nodeUser={role:'admin',id:1,full_name:'Owner',position:'كابتن',branch:'فرع فودافون'};previewSession={kind:'admin',employeeId:1};page='assessment';render()");
const addBtn=(nodes['#assess-new'].children||[])[0];assert(addBtn,'booking button rendered');addBtn.onclick();
const branchSel=nodes['#fields [name=branch]'],docSel=nodes['#fields [name=doctorId]'];
branchSel.value='فرع فودافون';branchSel.onchange();
ok('Vodafone doctor listed for Vodafone',String(docSel.innerHTML).includes('دكتور فودافون')&&!String(docSel.innerHTML).includes('دكتور الرخاوي'));
branchSel.value='فرع الرخاوي';branchSel.onchange();
const rakhawy=String(docSel.innerHTML);
ok('Rakhawy doctor listed after switching branch',rakhawy.includes('دكتور الرخاوي'));
ok('Vodafone doctor removed after switching branch',!rakhawy.includes('دكتور فودافون'));
branchSel.value='فرع بلا دكتور';branchSel.onchange();
ok('branch without doctors shows an explicit empty state',String(docSel.innerHTML).includes('لا يوجد دكتور معتمد'));
console.log('PASS:',count,'branch filter and assessment doctor-list regression checks');
