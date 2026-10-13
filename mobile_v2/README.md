# Energy Plus Staff V2 — isolated Flutter prototype

This is a **development prototype**, not a production-ready app. It lives on the separate `energy-plus-mobile-v2` branch and does **not** replace the live Vercel website.

## Included
- Flutter entry point with dark Energy Plus branding and Arabic UI.
- Supabase Auth email/password login (requires a real Auth account whose UID matches `profiles.id`).
- Active-profile validation; manager vs employee role dashboards.
- Manager: browse employees, assign daily tasks in the existing `performance_tasks` table.
- Employee: view their tasks, mark a task completed.
- Sales and trainer module navigation, clearly marked pending.
- No service-role keys or credentials committed.

## Existing database assets
- `profiles`, `attendance`, `attendance_requests`, `employee_device_bindings`
- `performance_tasks`, `hr_tasks`, `hr_task_templates`
- Sales: `leads`, `lead_activities`, `lead_followups`, `sales_daily_targets`, `sales_monthly_targets`, `sales_commission_rules`
- Coaches: `coach_client_sessions`, `coach_client_otp_challenges`, `coach_client_ratings`

## Run locally
1. Install Flutter SDK.
2. From `mobile_v2/` run `flutter create --platforms=android,ios .` to generate native project files (requires platform toolchains).
3. Run `flutter pub get`.
4. Run `flutter run --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co --dart-define=SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY`.

## Critical requirements before production
1. **Authentication migration:** the existing employee kiosk uses custom employee selection, not Supabase Auth. Provision verified, individual Supabase Auth accounts and map them to `profiles.id`. Do not rely on client-supplied employee IDs or insecure kiosk routes.
2. **Authorization:** existing `performance_tasks` RLS permits manager ALL and employee UPDATE on their rows. Harden employee UPDATE with a dedicated server RPC or column privileges, so users cannot tamper with task title, points, employee assignment or creator. Check manager permissions and branch scopes server-side. Do not use a UI role check as security.
3. **Task completion alerts:** add secure database-triggered notification and an audit trail for employee completion; no push notification is implemented in this prototype.
4. **Sales/coach privacy:** audit RLS, PII, sales commission calculations, session verification and manager access before exposing any client records. Current sales and coach screens are **placeholders**.
5. **Attendance:** design authenticated, idempotent check-in/out transactions and approval ordering, geofencing and device re-enrollment with manager authorization. No attendance action is connected yet. Never silently auto-approve check-outs without linked shifts.
6. **Device trust:** random localStorage UUID is not hardware fingerprint. Use secure device-bound keys / platform attestation where appropriate, plus a controlled recovery flow; Face ID is local authentication, not an employee identity by itself.
7. **Location:** background tracking requires appropriate platform permissions, user disclosure, consent, policy and testing; iOS and Android may limit background delivery.
8. **Quality gates:** no CI build, emulator test, device test, APK/IPA signing, app-store submission or production rollout has occurred.
9. **Data migration:** read-only mapping first; preserve attendance history, payroll, employee permissions and audit records.

## Rollout
Build on this branch; test with separate staging credentials/project and synthetic data first. After security and end-to-end tests, pilot with a small group before expanding. Keep the existing employee and manager websites live until V2 is verified.
