# Energy Plus Staff — verification and competitor review, 18 October 2026

Scope: energy-staff-hostinger only, based on a5af07b. MARO PRO and main untouched. No production attendance or payroll records were written for testing.

## Implemented
- Cairo-aware planned shift matching across midnight and DST; each punch assigned to one schedule only.
- In-app alerts for lateness, missing attendance after the scheduled start/end, early checkout and forgotten checkout. These are review flags, not approved absence, deductions or automatic points. Alerts use the loaded server workspace; refresh to obtain newer movements. No push/email/SMS delivery added.
- Employee access to their own dated shift schedule, with editing restricted to management.
- Shift report filters by date, branch and employee; filtered CSV exports.
- Recurring shift creation up to 31 days: daily, same weekday, or Saturday–Thursday. Server checks role/department/branch; duplicate-day conflicts reject the entire batch.
- Configurable lateness grace (0–120 minutes) on schedules.
- Clear errors for duplicate shifts and invalid dates; additional assessment error messages.
- Hourly payroll type choices for HR, quality and assessment alongside existing coach/sales/housekeeping. No rates or production payroll changed; coach private share remains 50%. Breaks remain fully paid.

## Evidence
- npm test: 27 passed, 0 failed. Includes synthetic attendance, break sequence, green/red points and task approval for all six staff positions; overnight and DST handling; scope restrictions; recurring batch rollback; early/missing checkout.
- npm run build: passed.
- Existing checks: GPS (6 boundary cases and 12 admin views), operations (45), payroll (42 plus 3 added role formulas), team (34), entry (19), Hostinger bridge: passed.
- Tests use in-memory fixtures/fake storage and browser-logic VM checks, not production DB writes. They do not prove browser-to-production persistence.
- Work browser: site and registration/login UI rendered; /api/health returned ready:true, storage:postgres, publicOriginConfigured:true.
- Production admin sign-in: failed with the site's message “البريد أو كلمة المرور غير صحيحين”. No credential values were accessed or stored.
- Consequently live employee/manager/admin operations, refresh persistence and effective production GPS locations remain unverified. Public registration options exposed only “الفرع الرئيسي” during this inspection.
- Source includes legacy coordinates for exact names “فرع فودافون” and “فرع الرخاوي” and a strict 80m boundary including GPS accuracy; actual saved branch mapping cannot be confirmed without authenticated access. No location guessed or overwritten.

## Competitor findings (official product documentation)
| Product | Relevant capabilities | Applied in this release | Still outside this release |
|---|---|---|---|
| Homebase | Schedule-based lateness/early checkout/no-show alerts, employee schedules, time-off and shift swaps | Attendance flags, own schedule, report filtering | Structured availability, leave-calendar sync, approved shift swaps |
| Jibble | Planned vs actual schedules, timesheet approvals, payroll periods, overtime reporting | Shift comparison and broader hourly role support | Multi-stage timesheet sign-off; configured overtime multipliers |
| Connecteam | GPS/geofencing, breaks, timesheet approval, payroll reminders, exports | Existing strict geofence retained; paid breaks retained; reporting and alert improvements | Scheduled outbound reports, payroll reminders, team messaging |

Sources checked on 18 October 2026:
- https://www.joinhomebase.com/time-clock/attendance-management
- https://www.jibble.io/features
- https://help.connecteam.com/en/articles/3310664-starting-guide-to-the-time-clock

No automatic clock-out or unpaid-break policy was copied because it would alter this gym's recorded hours/pay rules. Further commercial features above remain backlog, not implemented functionality.
