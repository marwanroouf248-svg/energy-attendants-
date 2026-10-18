-- Additive, idempotent data import; no auth secrets or financial/attendance writes.
-- Existing source tables remain unchanged. Run as an authorized database administrator.
BEGIN;
INSERT INTO energy_staff_v3.es_state(state_key,payload,revision)
 SELECT 'backup_roster_20261018',payload,revision FROM energy_staff_v3.es_state WHERE state_key='workspace'
 ON CONFLICT(state_key) DO NOTHING;
DO $$
DECLARE w jsonb; p record; t record; person jsonb; item jsonb; mapped bigint; pos text; dept text; branch_name text; today date := (now() AT TIME ZONE 'Africa/Cairo')::date; target_key text; source_status text;
BEGIN
 SELECT payload::jsonb INTO w FROM energy_staff_v3.es_state WHERE state_key='workspace' FOR UPDATE;
 IF w IS NULL THEN RAISE EXCEPTION 'Workspace missing'; END IF;
 CREATE TEMP TABLE staff_import_map(legacy_id uuid PRIMARY KEY,new_id bigint NOT NULL) ON COMMIT DROP;
 FOR p IN SELECT *,row_number() OVER(ORDER BY id) AS rn FROM public.profiles ORDER BY id LOOP
  SELECT (s->>'id')::bigint INTO mapped FROM jsonb_array_elements(coalesce(w->'staff','[]')) s
   WHERE s->>'legacyProfileId'=p.id::text OR lower(s->>'email')=lower(p.email) LIMIT 1;
  IF mapped IS NULL THEN
   SELECT (s->>'id')::bigint INTO mapped FROM jsonb_array_elements(coalesce(w->'archived','[]')) s WHERE s->>'legacyProfileId'=p.id::text LIMIT 1;
  END IF;
  IF mapped IS NULL THEN
   SELECT id INTO mapped FROM energy_staff_v3.es_users WHERE email=lower(p.email);
  END IF;
  IF mapped IS NULL THEN mapped := -1000000-p.rn; END IF;
  INSERT INTO staff_import_map VALUES(p.id,mapped);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(w->'staff','[]')) s WHERE (s->>'id')::bigint=mapped) THEN
   w := jsonb_set(w,'{staff}',(SELECT jsonb_agg(CASE WHEN (s->>'id')::bigint=mapped THEN s||jsonb_build_object('legacyProfileId',p.id,'legacyEmail',p.email) ELSE s END) FROM jsonb_array_elements(w->'staff')s));
   CONTINUE;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(w->'archived','[]')) s WHERE s->>'legacyProfileId'=p.id::text) THEN CONTINUE; END IF;
  pos := CASE p.department WHEN 'Coach' THEN 'كابتن' WHEN 'Sales' THEN 'سيلز' WHEN 'House keeping' THEN 'هاوس كيبنج' WHEN 'HR' THEN 'HR' WHEN 'Quality' THEN 'كواليتي' WHEN 'Assessment' THEN 'أسسمنت — دكتور علاج طبيعي' WHEN 'Outdoor' THEN 'Outdoor' WHEN 'Move' THEN 'Move' ELSE 'غير محدد' END;
  dept := CASE pos WHEN 'كابتن' THEN 'التدريب' WHEN 'سيلز' THEN 'السيلز' WHEN 'هاوس كيبنج' THEN 'الهاوس كيبنج' WHEN 'HR' THEN 'الموارد البشرية' WHEN 'كواليتي' THEN 'الجودة' WHEN 'أسسمنت — دكتور علاج طبيعي' THEN 'الأسسمنت والعلاج الطبيعي' ELSE pos END;
  branch_name := CASE WHEN p.branch IN ('فرع فودافون','فرع الرخاوي') THEN p.branch ELSE 'يلزم تحديد الفرع' END;
  person := jsonb_build_object('id',mapped,'name',coalesce(nullif(p.full_name,''),'ملف قديم يحتاج اسم'),'email',lower(p.email),'phone',coalesce(p.phone,''),'job',pos,'position',pos,'department',dept,'branch',branch_name,'salary',0,'time','—','status','غائب','approvalStatus','imported','legacyProfileId',p.id,'legacyEmail',p.email,'legacyRole',p.role,'legacyBranch',p.branch,'legacyDepartment',p.department,'employeeCode',p.employee_code,'needsActivation',true,'needsReview',branch_name='يلزم تحديد الفرع' OR pos='غير محدد','legacyActive',p.active,'importedAt',now());
  target_key := CASE WHEN p.active THEN 'staff' ELSE 'archived' END;
  w := jsonb_set(w,ARRAY[target_key],coalesce(w->target_key,'[]')||jsonb_build_array(person));
 END LOOP;
 FOR t IN SELECT src.*,m.new_id,pro.full_name,pro.active FROM public.performance_tasks src JOIN staff_import_map m ON m.legacy_id=src.employee_id JOIN public.profiles pro ON pro.id=src.employee_id LOOP
  SELECT s INTO person FROM jsonb_array_elements(coalesce(w->'staff','[]')||coalesce(w->'archived','[]'))s WHERE (s->>'id')::bigint=t.new_id LIMIT 1;
  item := jsonb_build_object('id','legacy-task:'||t.id,'employeeId',t.new_id,'employeeName',t.full_name,'department',person->>'department','branch',person->>'branch','day',t.due_date::text,'title',t.title,'notes',coalesce(t.description,''),'status',CASE WHEN t.status='todo' THEN 'assigned' ELSE 'legacy_review' END,'legacyStatus',t.status,'legacyTaskId',t.id,'legacyFrequency',t.frequency,'legacyDueDate',t.due_date,'legacyPoints',t.points,'assignedBy','مستورد من النظام السابق','createdAt',t.created_at,'legacyCompletedAt',t.completed_at,'legacyEvidence',t.evidence_note);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(w->'dailyAssignments','[]'))x WHERE x->>'id'=item->>'id') THEN
   w:=jsonb_set(w,'{dailyAssignments}',coalesce(w->'dailyAssignments','[]')||jsonb_build_array(item));
  END IF;
  IF t.active AND t.status='todo' AND t.due_date<=today AND (t.frequency='daily' OR (t.frequency='weekly' AND extract(dow from t.due_date)=extract(dow from today)) OR (t.frequency='monthly' AND extract(day from t.due_date)=extract(day from today))) THEN
   item:=item||jsonb_build_object('id','legacy-repeat:'||t.id||':'||today,'day',today::text,'createdAt',now(),'legacyTemplate',false);
   IF t.due_date<>today AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(w->'dailyAssignments')x WHERE x->>'id'=item->>'id') THEN w:=jsonb_set(w,'{dailyAssignments}',w->'dailyAssignments'||jsonb_build_array(item)); END IF;
  END IF;
 END LOOP;
 FOR t IN SELECT src.*,m.new_id,pro.full_name FROM public.hr_tasks src JOIN staff_import_map m ON m.legacy_id=src.assigned_to JOIN public.profiles pro ON pro.id=src.assigned_to LOOP
  SELECT s INTO person FROM jsonb_array_elements(coalesce(w->'staff','[]')||coalesce(w->'archived','[]'))s WHERE (s->>'id')::bigint=t.new_id LIMIT 1;
  item:=jsonb_build_object('id','legacy-hr-task:'||t.id,'employeeId',t.new_id,'employeeName',t.full_name,'department',person->>'department','branch',person->>'branch','day',t.due_date::text,'title',t.title,'notes',coalesce(t.description,''),'status',CASE WHEN t.status='done' THEN 'legacy_completed' WHEN t.status IN ('todo','pending') THEN 'assigned' ELSE 'legacy_review' END,'legacyStatus',t.status,'legacyHrTaskId',t.id,'assignedBy','مستورد من مهام HR','createdAt',t.created_at,'legacyCompletedAt',t.completed_at);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(w->'dailyAssignments')x WHERE x->>'id'=item->>'id') THEN w:=jsonb_set(w,'{dailyAssignments}',w->'dailyAssignments'||jsonb_build_array(item)); END IF;
 END LOOP;
 FOR branch_name IN SELECT unnest(ARRAY['فرع فودافون','فرع الرخاوي']) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(w->'branches','[]'))b WHERE b->>'name'=branch_name) THEN
   item:=CASE WHEN branch_name='فرع فودافون' THEN jsonb_build_object('name',branch_name,'lat',29.9631855,'lng',32.5572978) ELSE jsonb_build_object('name',branch_name,'lat',29.964248,'lng',32.5560476) END;
   w:=jsonb_set(w,'{branches}',coalesce(w->'branches','[]')||jsonb_build_array(item));
  END IF;
 END LOOP;
 UPDATE energy_staff_v3.es_state SET payload=w::text,revision=revision+1 WHERE state_key='workspace';
 INSERT INTO energy_staff_v3.es_audit(action,reason) VALUES('legacy_roster_import','Additive roster and task import; source attendance/payroll/auth unchanged; recovery snapshot backup_roster_20261018');
END $$;
COMMIT;
SELECT jsonb_build_object('staff',jsonb_array_length(payload::jsonb->'staff'),'archived',jsonb_array_length(payload::jsonb->'archived'),'tasks',jsonb_array_length(payload::jsonb->'dailyAssignments'),'today_tasks',(select count(*) from jsonb_array_elements(payload::jsonb->'dailyAssignments')t where t->>'day'=(now() at time zone 'Africa/Cairo')::date::text),'revision',revision) as imported FROM energy_staff_v3.es_state WHERE state_key='workspace';
