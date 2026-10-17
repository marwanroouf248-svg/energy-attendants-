import test from 'node:test';import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.PUBLIC_ORIGIN='http://localhost:3000';process.env.INITIAL_ADMIN_EMAIL='owner@example.test';process.env.ADMIN_SETUP_TOKEN='test-setup-token-'.repeat(3);
const {server,injectTestStore}=await import('../server/index.mjs');
const users=[],sessions=new Map(),limits=new Map(),states=new Map([['workspace',{payload:JSON.stringify({branches:[{name:'A',lat:null,lng:null}]}),revision:0}],['bootstrap',{payload:'{}',revision:0}]]);
const fake={async q(sql,p=[]){
 if(sql.startsWith('SELECT payload,revision FROM es_state'))return [states.get('workspace')];
 if(sql.includes("FROM es_users WHERE status='approved'"))return users.filter(u=>u.status==='approved').map(u=>({...u}));
 if(sql.startsWith('SELECT * FROM es_sessions')){const s=sessions.get(p[0]);return s?[s]:[]}
 if(sql.startsWith('INSERT INTO es_sessions')){sessions.set(p[0],{token_hash:p[0],user_id:p[1],csrf:p[2]});return {affectedRows:1}}
 if(sql.startsWith('DELETE FROM es_sessions WHERE token_hash')){sessions.delete(p[0]);return {affectedRows:1}}
 if(sql.startsWith('INSERT INTO es_limits')){limits.set(p[0],(limits.get(p[0])||0)+1);return {affectedRows:1}}
 if(sql.startsWith('SELECT attempts FROM es_limits'))return [{attempts:limits.get(p[0])}];
 if(sql.startsWith('SELECT * FROM es_users WHERE email'))return users.filter(u=>u.email===p[0]);
 if(sql.startsWith('SELECT * FROM es_users WHERE id'))return users.filter(u=>u.id===Number(p[0]));
 if(sql.startsWith('SELECT id FROM es_users WHERE role'))return users.filter(u=>u.role==='admin').map(u=>({id:u.id}));
 if(sql.startsWith('SELECT id FROM es_users WHERE email'))return users.filter(u=>u.email===p[0]).map(u=>({id:u.id}));
 if(sql.startsWith('SELECT state_key FROM es_state'))return [{state_key:'bootstrap'}];
 if(sql.startsWith('INSERT INTO es_users')){if(users.some(u=>u.email===p[0]))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});const admin=sql.includes("'admin','approved'");const u={id:users.length+1,email:p[0],full_name:p[1],phone:admin?'':p[2],password_hash:admin?p[2]:p[3],requested_position:admin?'كابتن':p[4],requested_branch:admin?p[3]:p[5],role:admin?'admin':'employee',status:admin?'approved':'pending',position:admin?'كابتن':null,branch:admin?p[4]:null};users.push(u);return {insertId:u.id}}
 if(sql.startsWith('UPDATE es_users SET password_hash=')){const u=users.find(u=>u.id===Number(p[1])&&u.password_hash===p[2]);if(!u)return {affectedRows:0};u.password_hash=p[0];return {affectedRows:1}}
 if(sql.startsWith('INSERT INTO es_audit'))return {insertId:1};
 if(sql.startsWith('SELECT id,email,full_name'))return users.map(u=>({...u}));
 if(sql.startsWith('UPDATE es_users SET status=')){const u=users.find(u=>u.id===Number(p[5])&&u.role!=='admin');if(!u)return {affectedRows:0};Object.assign(u,{status:p[0],position:p[1],branch:p[2],role:p[3],review_reason:p[4]});return {affectedRows:1}}
 if(sql.startsWith('DELETE FROM es_sessions WHERE user_id')){for(const [k,s]of sessions)if(s.user_id===p[0])sessions.delete(k);return {affectedRows:1}}
 throw Error('Unexpected test SQL: '+sql);
 },async transaction(fn){return fn(this)}};
await injectTestStore(fake);
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
async function request(path,{method='GET',body,session,origin='http://localhost:3000'}={}){const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();const cookie=res.headers.get('set-cookie')?.split(';')[0];return {status:res.status,data,cookie}}
test('HTTP password registration, approval, CSRF and logout flow',async()=>{try{
 const visitor=await request('/api/session');assert.equal(visitor.status,200);assert.equal(visitor.data.user,null);const v={cookie:visitor.cookie,csrf:visitor.data.csrf};
 const rejected=await request('/api/register',{method:'POST',session:{...v,csrf:'wrong'},body:{}});assert.equal(rejected.status,400);assert.equal(rejected.data.error,'CSRF');
 const choices=await request('/api/registration-options');assert.equal(choices.status,200);assert(choices.data.positions.includes('كواليتي'));assert(choices.data.positions.includes('HR'));assert.deepEqual(choices.data.branches,['A']);assert(!JSON.stringify(choices.data).includes('password'));
 const payload={name:'Test Employee',email:'employee@example.test',phone:'01011111111',position:'كابتن',branch:'A',password:'Valid-Employee-2026'};
 const signup=await request('/api/register',{method:'POST',session:v,body:payload});assert.equal(signup.status,201);assert.equal(users[0].status,'pending');assert(!JSON.stringify(users).includes(payload.password));
 for(const position of ['كواليتي','HR']){const added=await request('/api/register',{method:'POST',session:v,body:{...payload,email:position==='HR'?'hr@example.test':'quality@example.test',position,role:'admin'}});assert.equal(added.status,201);assert.equal(users.at(-1).role,'employee');assert.equal(users.at(-1).status,'pending')}
 const badBranch=await request('/api/register',{method:'POST',session:v,body:{...payload,email:'bad@example.test',branch:'Unknown'}});assert.equal(badBranch.status,400);
 const wrong=await request('/api/login',{method:'POST',session:v,body:{email:payload.email,password:'Wrong-Password-2026'}});assert.equal(wrong.status,401);
 const pending=await request('/api/login',{method:'POST',session:v,body:{email:payload.email,password:payload.password}});assert.equal(pending.status,403);assert.equal(pending.data.error,'PENDING');
 const setup=await request('/api/bootstrap',{method:'POST',session:v,body:{name:'Owner',email:'owner@example.test',branch:'A',setupToken:process.env.ADMIN_SETUP_TOKEN,password:'Valid-Owner-2026'}});assert.equal(setup.status,201);
 const owner=await request('/api/login',{method:'POST',session:v,body:{email:'owner@example.test',password:'Valid-Owner-2026'}});assert.equal(owner.status,200);assert(!JSON.stringify(owner.data).includes('password_hash'));const o={cookie:owner.cookie,csrf:owner.data.csrf};assert.notEqual(o.cookie,v.cookie);assert.notEqual(o.csrf,v.csrf);
 const approve=await request('/api/members/1/review',{method:'POST',session:o,body:{status:'approved',position:'كابتن',role:'employee',branch:'A',reason:'Test approval'}});assert.equal(approve.status,200);
 const fresh=await request('/api/session'),anonymous={cookie:fresh.cookie,csrf:fresh.data.csrf};const employee=await request('/api/login',{method:'POST',session:anonymous,body:{email:payload.email,password:payload.password}});assert.equal(employee.status,200);const e={cookie:employee.cookie,csrf:employee.data.csrf};
 const crossOrigin=await request('/api/logout',{method:'POST',session:e,origin:'https://other.test'});assert.equal(crossOrigin.status,400);assert.equal(crossOrigin.data.error,'ORIGIN');
 const forbidden=await request('/api/members',{session:e});assert.equal(forbidden.status,403);const escalated=await request('/api/members/1/review',{method:'POST',session:e,body:{status:'approved',role:'admin'}});assert.equal(escalated.status,403);
 const invalidChange=await request('/api/password',{method:'POST',session:e,body:{currentPassword:'Incorrect-2026',password:'New-Employee-2026'}});assert.equal(invalidChange.status,401);
 const weakChange=await request('/api/password',{method:'POST',session:e,body:{currentPassword:payload.password,password:'short'}});assert.equal(weakChange.status,400);
 const changed=await request('/api/password',{method:'POST',session:e,body:{currentPassword:payload.password,password:'New-Employee-2026'}});assert.equal(changed.status,200);assert.notEqual(changed.cookie,e.cookie);assert.notEqual(changed.data.csrf,e.csrf);
 const revoked=await request('/api/session',{session:e});assert.equal(revoked.data.user,null);
 const again=await request('/api/session'),a={cookie:again.cookie,csrf:again.data.csrf};
 const oldLogin=await request('/api/login',{method:'POST',session:a,body:{email:payload.email,password:payload.password}});assert.equal(oldLogin.status,401);
 const newLogin=await request('/api/login',{method:'POST',session:a,body:{email:payload.email,password:'New-Employee-2026'}});assert.equal(newLogin.status,200);
 const current={cookie:changed.cookie,csrf:changed.data.csrf};const logout=await request('/api/logout',{method:'POST',session:current});assert.equal(logout.status,200);const after=await request('/api/members',{session:current});assert.equal(after.status,401);
 assert.equal((await request('/.env')).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}});
