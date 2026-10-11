import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}

function keyFromEnv(name: string, fallback: string) {
  try {
    const raw = Deno.env.get(name);
    if (raw) return JSON.parse(raw).default || fallback;
  } catch {}
  return fallback;
}

const URL = Deno.env.get("SUPABASE_URL")!;
const publishable = keyFromEnv("SUPABASE_PUBLISHABLE_KEYS", Deno.env.get("SUPABASE_ANON_KEY") || "");
const secret = keyFromEnv("SUPABASE_SECRET_KEYS", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const admin = createClient(URL, secret);
const authClient = createClient(URL, publishable);

function cairoDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}

function dateStart(v:string) { return new Date(v + "T00:00:00+03:00").toISOString(); }
function dateEnd(v:string) { return new Date(v + "T23:59:59.999+03:00").toISOString(); }

const PERMISSION_KEYS=["view_live","view_reports","view_employee_details","view_requests","approve_requests","reject_requests","view_employee_contact","view_employee_attendance_history","view_employee_break_history","view_employee_directory","view_break_report","view_attendance_rates","report_filter_dates","report_filter_branch","report_filter_department","report_filter_employees","report_export_csv","report_export_pdf","rate_export_csv","rate_export_pdf","manage_attendance","manual_check_in","manual_check_out","manual_break_start","manual_break_end","manual_day_edit","manual_edit_notes","add_employee","edit_employee_profile","deactivate_employee","manage_employee_permissions","delete_attendance","view_telegram"];
async function getAccess(userId:string, role:string){
  if(String(role||"").toLowerCase()==="admin") return {permissions:Object.fromEntries(PERMISSION_KEYS.map(k=>[k,true]).concat([["allowed_departments",["*"]]])),branches:["*"]};
  const {data}=await admin.from("manager_permissions").select("permissions,branches").eq("user_id",userId).maybeSingle();
  const p=data?.permissions||{},permissions:any={};
  for(const k of PERMISSION_KEYS) permissions[k]=typeof p[k]==="boolean"?p[k]:false;
  if(typeof p.approve_requests!=="boolean") permissions.approve_requests=p.view_requests===true&&p.manage_attendance===true;
  if(typeof p.reject_requests!=="boolean") permissions.reject_requests=p.view_requests===true&&p.manage_attendance===true;
  permissions.allowed_departments=Array.isArray(p.allowed_departments)?p.allowed_departments.map((x:any)=>String(x)): [];
  return {permissions,branches:Array.isArray(data?.branches)?data.branches.map((x:any)=>String(x)):[]};
}
function branchAllowed(access:any, branch:any){return access?.branches?.includes("*")||access?.branches?.includes(String(branch||""))}
function departmentAllowed(access:any, department:any){const allowed=access?.permissions?.allowed_departments;return Array.isArray(allowed)&&(allowed.includes("*")||allowed.includes(String(department||"")))}
function employeeAllowed(access:any, p:any){return branchAllowed(access,p?.branch)&&departmentAllowed(access,p?.department)}
function filterEmployees(rows:any[], access:any){return (rows||[]).filter((p:any)=>String(p.role||"").toLowerCase()==="employee"&&employeeAllowed(access,p))}
async function authorize(req: Request) {
  const h = req.headers.get("authorization") || "";
  const token = h.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("غير مصرح");
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) throw new Error("غير مصرح");
  const { data: p, error: pe } = await admin.from("profiles").select("id,full_name,email,role,active").eq("id", user.id).maybeSingle();
  const { data: up } = await admin.from("user_profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  const profileRole=String(p?.role || "").toLowerCase();
  const legacyRole=String(up?.role || "").toLowerCase();
  const isAdmin=(p?.active===true && profileRole==="admin") || (up?.is_active===true && legacyRole==="admin");
  const effectiveRole=isAdmin ? "admin" : profileRole;
  if (!p || !p.active || !["manager","admin"].includes(effectiveRole)) throw new Error("غير مصرح");
  const access=await getAccess(p.id,effectiveRole);
  if(effectiveRole==="manager" && access.branches.length===0) throw new Error("لا توجد فروع مصرح بها");
  return {...p,role:effectiveRole,access};
}
async function profiles() {
  const { data, error } = await admin.from("profiles").select("id,full_name,email,role,active,branch,department,employee_code,phone,hourly_rate,default_shift_id,created_at,updated_at").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
function sanitizeEmployee(p:any,actor:any){
  if(!p)return p;
  const out={...p};
  if(actor.role!=="admin"&&actor.access.permissions.view_employee_contact!==true){delete out.email;delete out.phone;}
  if(actor.role!=="admin")delete out.hourly_rate;
  return out;
}

async function summary(actor:any) {
  const today = cairoDate();
  const [ps, ats, reqs, brs] = await Promise.all([
    profiles(),
    admin.from("attendance").select("*").order("check_in", { ascending: false }).limit(3000),
    admin.from("attendance_requests").select("*").order("requested_at", { ascending: false }).limit(500),
    admin.from("break_sessions").select("*").order("started_at", { ascending: false }).limit(500)
  ]);
  if (ats.error) throw ats.error;
  if (reqs.error) throw reqs.error;
  if (brs.error) throw brs.error;
  const map = new Map(ps.map(p => [p.id, sanitizeEmployee(p,actor)]));
  const decorate = (r:any) => ({ ...r, profiles: map.get(r.employee_id) || null });
  const canSeeDirectory=actor.role==="admin"||actor.access.permissions.view_live||actor.access.permissions.view_reports||actor.access.permissions.view_employee_details||actor.access.permissions.view_requests||actor.access.permissions.view_employee_directory||actor.access.permissions.manage_attendance||actor.access.permissions.manage_employee_permissions;
  const employees = canSeeDirectory?filterEmployees(ps, actor.access).filter((p:any)=>p.active===true).map((p:any)=>sanitizeEmployee(p,actor)):[];
  const allowedIds = new Set(employees.map((p:any)=>p.id));
  const attendance = actor.access.permissions.view_live ? (ats.data || []).filter((r:any)=>allowedIds.has(r.employee_id)).map(decorate) : [];
  const requests = actor.access.permissions.view_requests ? (reqs.data || []).filter((r:any)=>allowedIds.has(r.employee_id)).map(decorate) : [];
  const breaks = actor.access.permissions.view_live ? (brs.data || []).filter((r:any)=>allowedIds.has(r.employee_id)).map(decorate) : [];
  const todayStart = new Date(today + "T00:00:00+03:00");
  const todayEnd = new Date(today + "T23:59:59.999+03:00");
  const todayRows = attendance.filter(r => {
    const d = new Date(r.check_in);
    return d >= todayStart && d <= todayEnd;
  });
  const open = attendance.filter(r => !r.check_out);
  return {
    ok: true,
    employees,
    access: {...actor.access,role:actor.role},
    attendance: todayRows,
    all_attendance: attendance,
    open,
    requests: requests.slice(0, 300),
    breaks: breaks.filter(b => {
      const d = new Date(b.started_at);
      return d >= todayStart && d <= todayEnd;
    })
  };
}

async function report(body:any, actor:any) {
  const purpose=String(body.purpose||"report");
  const required=purpose==="employee_detail"?"view_employee_details":purpose==="break_report"?"view_break_report":purpose==="attendance_rates"?"view_attendance_rates":"view_reports";
  if(!(actor.role==="admin"||actor.access.permissions[required]===true)) throw new Error("ليس لديك صلاحية عرض هذا التقرير");
  const from = body.from || cairoDate();
  const to = body.to || from;
  let q = admin.from("attendance").select("*").gte("check_in", dateStart(from)).lte("check_in", dateEnd(to)).order("check_in", { ascending: false }).limit(5000);
  if (body.employee_id) {
    const {data:ep}=await admin.from("profiles").select("id,branch,department,role").eq("id",body.employee_id).maybeSingle();
    if(!ep || ep.role!=="employee" || !employeeAllowed(actor.access,ep)) throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");
    q = q.eq("employee_id", body.employee_id);
  }
  const [ar, br, ps] = await Promise.all([
    q,
    admin.from("break_sessions").select("*").gte("started_at", dateStart(from)).lte("started_at", dateEnd(to)).order("started_at", { ascending: false }).limit(5000),
    profiles()
  ]);
  if (ar.error) throw ar.error;
  if (br.error) throw br.error;
  const map = new Map(ps.map(p => [p.id, sanitizeEmployee(p,actor)]));
  const decorate = (r:any) => ({ ...r, profiles: map.get(r.employee_id) || null });
  const allowedIds=new Set(filterEmployees(ps,actor.access).map((p:any)=>p.id));
  const visibleRows=purpose==="employee_detail"&&actor.role!=="admin"&&actor.access.permissions.view_employee_attendance_history!==true?[]:(ar.data||[]).filter((r:any)=>allowedIds.has(r.employee_id)).map(decorate);
  const visibleBreaks=(purpose==="employee_detail"&&actor.role!=="admin"&&actor.access.permissions.view_employee_break_history!==true)||(purpose==="attendance_rates")?[]:(br.data||[]).filter((r:any)=>allowedIds.has(r.employee_id)).map(decorate);
  return { ok:true, rows:visibleRows, breaks:visibleBreaks, access:actor.access };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const actor=await authorize(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === "manager_summary") return out(await summary(actor));
    if (body.action === "manager_report") return out(await report(body,actor));

    if (body.action === "manager_requests") {
      if (!actor.access.permissions.view_requests) throw new Error("ليس لديك صلاحية عرض الطلبات");
      let q=admin.from("attendance_requests").select("id,employee_id,request_type,status,requested_at,decided_at,rejection_reason,device_name,location_distance,profiles!attendance_requests_employee_id_fkey(full_name,branch,department)").order("requested_at",{ascending:false}).limit(1000);
      if(body.from) q=q.gte("requested_at",dateStart(body.from));
      if(body.to) q=q.lte("requested_at",dateEnd(body.to));
      if(body.employee_id){
        const {data:ep,error:ee}=await admin.from("profiles").select("branch,department,role").eq("id",body.employee_id).maybeSingle();
        if(ee) throw ee; if(!ep || ep.role!=="employee" || !employeeAllowed(actor.access,ep)) throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");
        q=q.eq("employee_id",body.employee_id);
      }
      if(body.status) q=q.eq("status",body.status);
      const {data,error}=await q; if(error) throw error;
      return out({ok:true,requests:(data||[]).filter((x:any)=>employeeAllowed(actor.access,x.profiles))});
    }

    if (body.action === "manager_create_employee") {
      if (!(actor.role==="admin"||actor.access.permissions.add_employee===true)) throw new Error("ليس لديك صلاحية إضافة موظفين");
      const full_name=String(body.full_name||"").trim().slice(0,150);
      const branch=String(body.branch||"").trim().slice(0,100);
      const department=String(body.department||"").trim().slice(0,100);
      if(!full_name||!branch||!department) throw new Error("اسم الموظف والفرع والقسم مطلوبين");
      if(!branchAllowed(actor.access,branch)) throw new Error("الفرع خارج نطاق الفروع المسموح بها");
      if(!departmentAllowed(actor.access,department)) throw new Error("القسم خارج نطاق الأقسام المسموح بها");

      const {data:existing}=await admin.from("profiles").select("id").eq("full_name",full_name).eq("role","employee").eq("active",true).eq("branch",branch).eq("department",department).limit(1).maybeSingle();
      if(existing) throw new Error("يوجد موظف بنفس الاسم في نفس الفرع والقسم");

      const {data:codes}=await admin.from("profiles").select("employee_code").eq("role","employee").like("employee_code","EP-%");
      const used=new Set((codes||[]).map((x:any)=>String(x.employee_code||"").toUpperCase()));
      let n=1; while(used.has("EP-"+String(n).padStart(4,"0"))) n++;
      const employee_code="EP-"+String(n).padStart(4,"0");

      const internalEmail="employee."+crypto.randomUUID()+"@energyplus.local";
      const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
      let password="EP@"; for(let i=0;i<12;i++) password+=chars[Math.floor(Math.random()*chars.length)];

      const {data:created,error:ce}=await admin.auth.admin.createUser({email:internalEmail,password,email_confirm:true,user_metadata:{full_name,employee_code}});
      if(ce||!created.user) throw new Error(ce?.message||"تعذر إنشاء الموظف");

      const {error:pe}=await admin.from("profiles").upsert({
        id:created.user.id,full_name,email:internalEmail,role:"employee",active:true,
        employee_code,branch,department
      },{onConflict:"id"});
      if(pe){
        await admin.auth.admin.deleteUser(created.user.id);
        throw new Error("تعذر حفظ بيانات الموظف: "+pe.message);
      }
      return out({ok:true,employee:{id:created.user.id,full_name,branch,department,employee_code}});
    }


    if (body.action === "manager_employee_permissions") {
      if(!(actor.role==="admin"||actor.access.permissions.manage_employee_permissions===true)) throw new Error("ليس لديك صلاحية إدارة صلاحيات الموظفين");
      const {data:ps,error:pe}=await admin.from("profiles").select("id,full_name,branch,department,active,employee_code").eq("role","employee").order("full_name",{ascending:true});
      if(pe) throw pe;
      const scopedEmployees=(ps||[]).filter((p:any)=>employeeAllowed(actor.access,p));
      const ids=scopedEmployees.map((p:any)=>p.id);
      const {data:rows,error:re}=ids.length?await admin.from("employee_attendance_permissions").select("employee_id,can_check_in,can_check_out,allowed_branches,updated_at").in("employee_id",ids):{data:[],error:null};
      if(re) throw re;
      const map=new Map((rows||[]).map((x:any)=>[x.employee_id,x]));
      const employees=scopedEmployees.map((p:any)=>{
        const saved=map.get(p.id),home=String(p.branch||"").trim();
        const allowed=Array.isArray(saved?.allowed_branches)?saved.allowed_branches.map((x:any)=>String(x)):(home?[home]:[]);
        if(home&&!allowed.includes(home)) allowed.unshift(home);
        return {...p,attendance_permissions:{can_check_in:saved?.can_check_in!==false,can_check_out:saved?.can_check_out!==false,allowed_branches:allowed,updated_at:saved?.updated_at||null}};
      });
      const branches=Array.from(new Set(["فرع فودافون","فرع الرخاوي",...scopedEmployees.map((p:any)=>String(p.branch||"").trim()).filter(Boolean)])).filter((b:any)=>branchAllowed(actor.access,b));
      return out({ok:true,employees,branches});
    }
    if (body.action === "manager_save_employee_permissions") {
      if(!(actor.role==="admin"||actor.access.permissions.manage_employee_permissions===true)) throw new Error("ليس لديك صلاحية إدارة صلاحيات الموظفين");
      const id=String(body.employee_id||"").trim();
      const {data:e,error:ee}=await admin.from("profiles").select("id,full_name,branch,department,active").eq("id",id).eq("role","employee").maybeSingle();
      if(ee) throw ee;
      if(!e||!e.active) throw new Error("الموظف غير موجود أو غير نشط");
      if(!employeeAllowed(actor.access,e)) throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");
      const home=String(e.branch||"").trim();
      const supplied=Array.isArray(body.allowed_branches)?body.allowed_branches.map((x:any)=>String(x).trim()).filter(Boolean):[];
      if(supplied.some((b:string)=>!branchAllowed(actor.access,b))) throw new Error("الفرع خارج نطاق الفروع المسموح بها");
      const allowed=Array.from(new Set([...(home?[home]:[]),...supplied])).filter((x:string)=>["فرع فودافون","فرع الرخاوي",home].includes(x));
      if(!allowed.length) throw new Error("لازم تختار فرع واحد على الأقل");
      const payload={employee_id:id,can_check_in:body.can_check_in===true,can_check_out:body.can_check_out===true,allowed_branches:allowed,updated_by:actor.id,updated_at:new Date().toISOString()};
      const {error}=await admin.from("employee_attendance_permissions").upsert(payload,{onConflict:"employee_id"});
      if(error) throw error;
      return out({ok:true,employee_id:id,can_check_in:payload.can_check_in,can_check_out:payload.can_check_out,allowed_branches:allowed});
    }
    if (body.action === "manager_delete_employee") {
      if(actor.role!=="admin") throw new Error("حذف الموظفين متاح للمدير العام فقط");
      const id=String(body.employee_id||"").trim();
      if(!id) throw new Error("حدد الموظف المراد حذفه");
      const {data:e,error:ee}=await admin.from("profiles").select("id,full_name,role,active").eq("id",id).eq("role","employee").maybeSingle();
      if(ee) throw ee;
      if(!e) throw new Error("الموظف غير موجود");
      const {data:open,error:oe}=await admin.from("attendance").select("id").eq("employee_id",id).is("check_out",null).limit(1).maybeSingle();
      if(oe) throw oe;
      if(open) throw new Error("لا يمكن حذف موظف لديه حضور مفتوح. سجّل انصرافه أولاً.");
      const {error:de}=await admin.from("profiles").update({active:false,updated_at:new Date().toISOString()}).eq("id",id);
      if(de) throw de;
      try { await admin.auth.admin.updateUserById(id,{ban_duration:"876000h"}); } catch(err) { console.error("employee auth disable warning",err); }
      return out({ok:true,employee_id:id,full_name:e.full_name,message:"تم إيقاف الموظف مع الاحتفاظ بسجلات حضوره السابقة"});
    }

    if (body.action === "manager_break_action") {
      const id=String(body.employee_id||"").trim(), type=String(body.action_type||"");
      const perm=type==="break_start"?"manual_break_start":type==="break_end"?"manual_break_end":"";
      if(!id||!perm) throw new Error("بيانات إجراء البريك غير صحيحة");
      if(!(actor.role==="admin"||(actor.access.permissions.manage_attendance===true&&actor.access.permissions[perm]===true))) throw new Error("ليس لديك صلاحية تنفيذ إجراء البريك المحدد");
      const {data:e,error:ee}=await admin.from("profiles").select("id,full_name,branch,department,active").eq("id",id).eq("role","employee").eq("active",true).maybeSingle();
      if(ee) throw ee; if(!e||!employeeAllowed(actor.access,e)) throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");
      if(type==="break_start"){
        const {data:open,error:oe}=await admin.from("break_sessions").select("id").eq("employee_id",id).is("ended_at",null).limit(1).maybeSingle();
        if(oe) throw oe; if(open) throw new Error("يوجد بريك مفتوح بالفعل");
        const minutes=Number(body.allowed_minutes);if(![15,30].includes(minutes))throw new Error("مدة البريك يجب أن تكون 15 أو 30 دقيقة");
        const location=body.location||{};
        const {data:br,error:be}=await admin.from("break_sessions").insert({employee_id:id,branch:e.branch,department:e.department,allowed_minutes:minutes,motivation_message:String(body.motivation_message||"").slice(0,500),location_lat:location.lat??null,location_lng:location.lng??null,location_accuracy:location.accuracy??null,location_distance:location.distance??null}).select("id,employee_id,started_at,ended_at,allowed_minutes").single();
        if(be) throw be;return out({ok:true,break:br});
      }
      const {data:br,error:be}=await admin.from("break_sessions").select("id,started_at,allowed_minutes,exceeded_at").eq("employee_id",id).is("ended_at",null).order("started_at",{ascending:false}).limit(1).maybeSingle();
      if(be) throw be;if(!br)throw new Error("لا يوجد بريك مفتوح");
      const now=new Date(),limit=br.allowed_minutes?new Date(new Date(br.started_at).getTime()+br.allowed_minutes*60000):null,late=limit&&now>limit?Math.floor((now.getTime()-limit.getTime())/60000):0;
      const {data:updated,error:ue}=await admin.from("break_sessions").update({ended_at:now.toISOString(),exceeded_at:late>0?now.toISOString():br.exceeded_at}).eq("id",br.id).is("ended_at",null).select("id,employee_id,started_at,ended_at,allowed_minutes,exceeded_at").single();
      if(ue) throw ue;return out({ok:true,break:updated,late_minutes:late});
    }

    if (body.action === "manager_action") {
      const id=String(body.employee_id||"").trim(), type=String(body.action_type||"");
      const actionPermission=type==="check_in"?"manual_check_in":type==="check_out"?"manual_check_out":"";
      if(!(actor.role==="admin"||(actor.access.permissions.manage_attendance===true&&actionPermission&&actor.access.permissions[actionPermission]===true))) throw new Error("ليس لديك صلاحية تنفيذ إجراء الحضور المحدد");
      if(!id || !["check_in","check_out"].includes(type)) throw new Error("بيانات الإجراء غير صحيحة");
      const {data:e,error:ee}=await admin.from("profiles").select("id,full_name,branch,department").eq("id",id).eq("role","employee").eq("active",true).maybeSingle();
      if(ee) throw ee; if(!e) throw new Error("الموظف غير موجود"); if(!employeeAllowed(actor.access,e)) throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");
      if(type==="check_in"){
        const {data:o,error:oe}=await admin.from("attendance").select("id,check_in").eq("employee_id",id).is("check_out",null).order("check_in",{ascending:false}).limit(1).maybeSingle();
        if(oe) throw oe; if(o) throw new Error("الموظف مسجل حضور بالفعل");
        const {data:a,error:ae}=await admin.from("attendance").insert({employee_id:id,check_in:new Date().toISOString(),device_id:"manager-portal",device_name:"Manager Portal"}).select("id").single();
        if(ae) throw ae; return out({ok:true,status:"approved",attendance_id:a.id});
      }
      const {data:o,error:oe}=await admin.from("attendance").select("id").eq("employee_id",id).is("check_out",null).order("check_in",{ascending:false}).limit(1).maybeSingle();
      if(oe) throw oe; if(!o) throw new Error("لا يوجد حضور مفتوح");
      const {data:a,error:ae}=await admin.from("attendance").update({check_out:new Date().toISOString()}).eq("id",o.id).select("id").single();
      if(ae) throw ae; return out({ok:true,status:"approved",attendance_id:a.id});
    }

    if (body.action === "manager_manual_attendance") {
      if (!(actor.role==="admin"||(actor.access.permissions.manage_attendance===true&&actor.access.permissions.manual_day_edit===true))) throw new Error("ليس لديك صلاحية إضافة أو تعديل يوم حضور");
      const id=String(body.employee_id||"").trim(), workDate=String(body.work_date||"").trim(), checkIn=String(body.check_in||"").trim(), checkOut=String(body.check_out||"").trim(), reason=String(body.reason||"").trim().slice(0,500);
      if(!id||!workDate||!checkIn||!checkOut) throw new Error("اختر الموظف والتاريخ ووقت الدخول ووقت الانصراف");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate)||!/^\d{2}:\d{2}$/.test(checkIn)||!/^\d{2}:\d{2}$/.test(checkOut)) throw new Error("التاريخ أو الوقت غير صحيح");
      const cin=new Date(workDate+"T"+checkIn+":00+03:00").toISOString(), cout=new Date(workDate+"T"+checkOut+":00+03:00").toISOString();
      if(new Date(cout)<=new Date(cin)) throw new Error("وقت الانصراف لازم يكون بعد وقت الحضور");
      const {data:e,error:ee}=await admin.from("profiles").select("id,full_name,branch,department").eq("id",id).eq("role","employee").eq("active",true).maybeSingle();
      if(ee) throw ee; if(!e) throw new Error("الموظف غير موجود"); if(!employeeAllowed(actor.access,e)) throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");
      const {data:dayRows,error:de}=await admin.from("attendance").select("id,check_in,check_out,notes").eq("employee_id",id).gte("check_in",dateStart(workDate)).lte("check_in",dateEnd(workDate)).order("check_in",{ascending:true});
      if(de) throw de; if((dayRows||[]).length>1) throw new Error("يوجد أكثر من سجل حضور لهذا الموظف في نفس اليوم. راجع التقرير أولاً قبل التعديل.");
      const note="إضافة/تصحيح يدوي من المدير"+(reason?" — السبب: "+reason:"");
      let a:any;
      if(dayRows?.[0]?.id){
        // The attendance table intentionally blocks changing check_in on an existing row.
        // Manager corrections therefore replace the old row rather than updating check_in.
        const oldId=dayRows[0].id;
        const {error:rq}=await admin.from("attendance_requests").update({attendance_id:null}).eq("attendance_id",oldId);
        if(rq) throw rq;
        const {error:del}=await admin.from("attendance").delete().eq("id",oldId);
        if(del) throw del;
        const {data:x,error:xe}=await admin.from("attendance").insert({employee_id:id,check_in:cin,check_out:cout,notes:note,device_id:"manager-portal",device_name:"Manager Portal"}).select("id,employee_id,check_in,check_out,notes").single();
        if(xe) throw xe; a=x;
      }else{
        const {data:x,error:xe}=await admin.from("attendance").insert({employee_id:id,check_in:cin,check_out:cout,notes:note,device_id:"manager-portal",device_name:"Manager Portal"}).select("id,employee_id,check_in,check_out,notes").single();
        if(xe) throw xe; a=x;
      }
      return out({ok:true,attendance_id:a.id,mode:dayRows?.[0]?.id?"updated":"created",employee:e,check_in:a.check_in,check_out:a.check_out});
    }

    if (body.action === "manager_delete_attendance") {
      if (!(actor.role==="admin"||(actor.access.permissions.view_reports===true&&actor.access.permissions.delete_attendance===true))) throw new Error("ليس لديك صلاحية حذف سجلات الحضور");
      const id=String(body.attendance_id||"").trim(); if(!id) throw new Error("سجل الحضور غير محدد");
      const {data:r,error:re}=await admin.from("attendance").select("id,employee_id,check_in,check_out").eq("id",id).maybeSingle();
      if(re) throw re; if(!r) throw new Error("سجل الحضور غير موجود");
      const {data:ep,error:ee}=await admin.from("profiles").select("branch,department,role").eq("id",r.employee_id).maybeSingle();
      if(ee) throw ee; if(!ep || !employeeAllowed(actor.access,ep)) throw new Error("السجل خارج نطاق الفروع أو الأقسام المسموح بها");
      const {data:deleted,error:de}=await admin.from("attendance").delete().eq("id",id).select("id").maybeSingle();
      if(de) throw de; if(!deleted) throw new Error("تعذر حذف سجل الحضور");
      await admin.from("attendance_requests").update({attendance_id:null}).eq("attendance_id",id);
      return out({ok:true,deleted_attendance_id:id,employee_id:r.employee_id});
    }

    if (body.action === "manager_decide") {
      const id=String(body.request_id||"").trim(), decision=String(body.decision||"");
      if(!id || !["approve","reject"].includes(decision)) throw new Error("بيانات القرار غير صحيحة");
      const decisionPermission=decision==="approve"?"approve_requests":"reject_requests";
      if(!(actor.role==="admin"||(actor.access.permissions.view_requests===true&&(actor.access.permissions[decisionPermission]===true||(typeof actor.access.permissions[decisionPermission]!=="boolean"&&actor.access.permissions.manage_attendance===true))))) throw new Error(decision==="approve"?"ليس لديك صلاحية قبول الطلبات":"ليس لديك صلاحية رفض الطلبات");
      const {data:r,error:re}=await admin.from("attendance_requests").select("*").eq("id",id).maybeSingle();
      if(re) throw re; if(!r) throw new Error("الطلب غير موجود");
      const {data:ep,error:ee}=await admin.from("profiles").select("branch,department,role").eq("id",r.employee_id).maybeSingle();
      if(ee) throw ee; if(!ep || !employeeAllowed(actor.access,ep)) throw new Error("الطلب خارج نطاق الفروع أو الأقسام المسموح بها");
      if(r.status!=="pending") throw new Error("تم التعامل مع الطلب بالفعل");
      if(decision==="reject"){
        const {error}=await admin.from("attendance_requests").update({status:"rejected",decided_at:new Date().toISOString(),decided_by:actor.id,rejection_reason:String(body.reason||"رفض من الإدارة").slice(0,500)}).eq("id",id).eq("status","pending");
        if(error) throw error; return out({ok:true,status:"rejected"});
      }
      let attendanceId=r.attendance_id||null;
      if(r.request_type==="check_in"||r.request_type==="in"){
        const {data:open,error:oe}=await admin.from("attendance").select("id").eq("employee_id",r.employee_id).is("check_out",null).order("check_in",{ascending:false}).limit(1).maybeSingle();
        if(oe) throw oe; if(open) throw new Error("الموظف لديه حضور مفتوح بالفعل");
        const {data:a,error:ae}=await admin.from("attendance").insert({employee_id:r.employee_id,check_in:r.requested_at,device_id:r.device_id||null,device_name:r.device_name||null,device_ip:r.device_ip||null,user_agent:r.user_agent||null,location_lat:r.location_lat||null,location_lng:r.location_lng||null,location_accuracy:r.location_accuracy||null,location_distance:r.location_distance||null}).select("id").single();
        if(ae) throw ae; attendanceId=a.id;
      }else{
        const {data:open,error:oe}=await admin.from("attendance").select("id,check_in").eq("employee_id",r.employee_id).lte("check_in",r.requested_at).or("check_out.is.null,check_out.gte."+r.requested_at).order("check_in",{ascending:false}).limit(1).maybeSingle();
        if(oe) throw oe; if(!open) throw new Error("لم يعد هناك حضور صالح مرتبط بوقت الطلب");
        attendanceId=open.id;
        if(r.request_type==="out"||r.request_type==="check_out"){
          const {error:ae}=await admin.from("attendance").update({check_out:r.requested_at}).eq("id",open.id).is("check_out",null);
          if(ae) throw ae;
        }else if(r.request_type==="break_start"){
          const {data:br}=await admin.from("attendance_breaks").select("id").eq("attendance_id",open.id).is("ended_at",null).limit(1).maybeSingle();
          if(br) throw new Error("يوجد بريك مفتوح بالفعل");
          const {error:be}=await admin.from("attendance_breaks").insert({attendance_id:open.id,employee_id:r.employee_id,started_at:r.requested_at});
          if(be) throw be;
        }else if(r.request_type==="break_end"){
          const {data:br}=await admin.from("attendance_breaks").select("id").eq("attendance_id",open.id).is("ended_at",null).order("started_at",{ascending:false}).limit(1).maybeSingle();
          if(!br) throw new Error("لا يوجد بريك مفتوح يمكن إنهاؤه");
          const {error:be}=await admin.from("attendance_breaks").update({ended_at:r.requested_at}).eq("id",br.id).is("ended_at",null);
          if(be) throw be;
        }
      }
      const {error:ae}=await admin.from("attendance_requests").update({status:"approved",decided_at:new Date().toISOString(),decided_by:actor.id,attendance_id:attendanceId}).eq("id",id).eq("status","pending");
      if(ae) throw ae; return out({ok:true,status:"approved",attendance_id:attendanceId});
    }

    if (body.action === "manager_telegram_logs") {
      if(!(actor.role==="admin"||actor.access.permissions.view_telegram===true)) throw new Error("ليس لديك صلاحية عرض نشاط Telegram");
      const from = body.from || cairoDate(), to = body.to || from;
      let q = admin.from("telegram_logs").select("*").gte("created_at", dateStart(from)).lte("created_at", dateEnd(to)).order("created_at", { ascending:false }).limit(1000);
      if (body.employee_id) q = q.eq("employee_id", body.employee_id);
      if (body.event_type) q = q.eq("event_type", body.event_type);
      const { data, error } = await q;
      if (error) throw error;
      if(body.employee_id){const {data:ep}=await admin.from("profiles").select("id,role,branch,department").eq("id",body.employee_id).maybeSingle();if(!ep||!employeeAllowed(actor.access,ep))throw new Error("الموظف خارج نطاق الفروع أو الأقسام المسموح بها");}
      const ps=await profiles(); const allowedIds=new Set(filterEmployees(ps,actor.access).map((p:any)=>p.id));
      return out({ok:true, logs:(data||[]).filter((x:any)=>!x.employee_id||allowedIds.has(x.employee_id))});
    }
    if (body.action === "manager_telegram_status") {
      if(!(actor.role==="admin"||actor.access.permissions.view_telegram===true)) throw new Error("ليس لديك صلاحية عرض نشاط Telegram");
      return out({ok:true, configured:!!(Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("TELEGRAM_TOKEN"))});
    }
    return out({ok:false,error:"إجراء غير مدعوم"},400);
  } catch (e) {
    return out({ok:false,error:e?.message || "حدث خطأ"}, String(e?.message||"").includes("غير مصرح") ? 401 : 500);
  }
});
