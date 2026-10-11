const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
function js(path){return stripTypeScriptTypes(fs.readFileSync(path,'utf8').replace(/^import .*;\n/gm,''),{mode:'transform'});}
for(const name of ['manager-dashboard-api','attendance-approval','employee-kiosk']){
 new vm.Script(js('supabase/functions/'+name+'/index.ts'));
}
const location={};vm.createContext(location);
vm.runInContext(js('supabase/functions/attendance-approval/location.ts').replace('export function','function'),location);
const home='فرع فودافون',center={lat:29.9631855,lng:32.5572978,accuracy:30};
assert.equal(location.validateLocation(center,home).distance,0);
const point=d=>({...center,lat:center.lat+d/6371000*180/Math.PI});
assert(location.validateLocation(point(229),home));
assert.throws(()=>location.validateLocation(point(231),home));
assert.throws(()=>location.validateLocation({...point(220),accuracy:5},home));
assert.throws(()=>location.validateLocation({...center,lat:NaN},home));
assert.throws(()=>location.validateLocation({...center,branch:'فرع الرخاوي'},home));
assert(location.validateLocation({lat:29.964248,lng:32.5560476,accuracy:5,branch:'فرع الرخاوي'},home,['فرع الرخاوي']));
let handler,seenJoin=false,actorRole='manager';
const employee={id:'employee-1',role:'employee',active:true,branch:home,department:'Sales',full_name:'Test'};
const permissions={view_requests:true,manage_employee_permissions:true,allowed_departments:['Sales']};
function from(table){
 const q={fields:'',select(fields){this.fields=fields;if(table==='attendance_requests'&&fields.includes('profiles')){assert(fields.includes('profiles!attendance_requests_employee_id_fkey('));seenJoin=true;}return this;},
 eq(){return this;},order(){return this;},limit(){return this;},gte(){return this;},lte(){return this;},lt(){return this;},in(){return this;},
 async maybeSingle(){return {data:table==='profiles'?{id:'manager-1',role:actorRole,active:true}:table==='manager_permissions'?{permissions,branches:[home]}:null,error:null};},
 then(resolve,reject){return Promise.resolve({data:table==='profiles'?[employee,{...employee,id:'hidden',branch:'فرع الرخاوي'}]:table==='attendance_requests'?[{id:'request-1',employee_id:employee.id,profiles:employee}]:[],error:null}).then(resolve,reject);}};
 return q;
}
const client={from,auth:{getUser:async()=>({data:{user:{id:'manager-1'}},error:null})}};
const ctx={createClient:()=>client,Deno:{env:{get:()=>''},serve:f=>handler=f},Response,Map,Set,Date,Intl,console};
vm.createContext(ctx);vm.runInContext(js('supabase/functions/manager-dashboard-api/index.ts'),ctx);
async function request(action){const r=await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({action})}));assert.equal(r.status,200);return r.json();}
(async()=>{
 const requests=await request('manager_requests');assert(seenJoin);assert.equal(requests.requests.length,1);
 const summary=await request('manager_summary');assert.equal(summary.access.role,'manager');assert.equal(summary.employees.length,1);
 const p=await request('manager_employee_permissions');assert.equal(p.employees.length,1);assert.deepEqual(p.branches,[home]);
 console.log('PASS: server syntax, explicit request join, explicit manager role, delegated permission scope, GPS boundaries/invalid coordinates/branch access');
})().catch(e=>{console.error(e);process.exitCode=1;});
