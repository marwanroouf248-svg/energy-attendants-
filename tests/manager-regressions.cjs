const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('manager-portal-7f3k9m.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(script);
assert(!script.includes("token=localStorage.getItem('energy_manager_token')"));
function section(start,end){return script.slice(script.indexOf(start),script.indexOf(end,script.indexOf(start)));}
(async()=>{
 let calls=0;
 const c={managerAccess:{role:'manager',branches:['فرع فودافون'],permissions:{allowed_departments:['Sales']}},console};
 vm.createContext(c);
 vm.runInContext(section('function employeeWithinManagerScope','function updateLiveBranchFilter'),c);
 assert(c.employeeWithinManagerScope({branch:' فرع فودافون ',department:'Sales'}));
 assert(!c.employeeWithinManagerScope({branch:'فرع الرخاوي',department:'Sales'}));
 assert(!c.employeeWithinManagerScope({branch:'فرع فودافون',department:'Coaches'}));
 c.managerAccess.role='admin';assert(c.employeeWithinManagerScope({branch:'x',department:'x'}));
 c.performManagerSessionRefresh=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return true;};
 vm.runInContext(section('let managerRefreshPromise=null;','async function performManagerSessionRefresh'),c);
 await Promise.all([c.refreshManagerSession(),c.refreshManagerSession(),c.refreshManagerSession()]);
 assert.equal(calls,1);
 await c.refreshManagerSession();assert.equal(calls,2);
 const el={value:'فرع الرخاوي',innerHTML:''};
 c.$=()=>el;c.esc2=x=>x;c.dashboardEmployees=[{branch:'فرع فودافون'},{branch:'فرع الرخاوي'}];c.managerAccess.role='manager';
 vm.runInContext(section('function updateLiveBranchFilter','function renderLiveBoard'),c);
 c.updateLiveBranchFilter();assert(!el.innerHTML.includes('فرع الرخاوي'));assert.equal(el.value,'');
 console.log('PASS: script syntax, no startup session restore, branch/department scope, refresh coalescing, stale branch selection');
})().catch(e=>{console.error(e);process.exitCode=1;});
