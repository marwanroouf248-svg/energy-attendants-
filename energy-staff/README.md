# Energy Plus Staff — Vercel / GitHub

## النشر على Vercel

- المشروع المستقل: `energy-staff-maro`، ومجلد الجذر `energy-staff`، وفرع التطبيق `energy-staff-hostinger`.
- ملف `vercel.json` ينشر الواجهة ويمرر `/api/*` إلى نفس سيرفر الصلاحيات والحسابات، بدون سيرفر يستمع على منفذ داخل Vercel.
- النسخة المنشورة تستخدم Postgres على Supabase عبر `DATABASE_URL` سري في إعدادات Vercel للإنتاج والمعاينة، مع شهادة الجهة المصدرة والتحقق من اسم المضيف. يحتفظ MySQL بالدعم كخيار للاستضافة الأخرى عند غياب `DATABASE_URL`.
- جميع جداول النسخة المنشورة داخل مخطط `energy_staff_v3` الخاص، ولا تستخدم حسابات Supabase Auth القديمة. حساب قاعدة البيانات `energy_staff_runtime_v3` له صلاحيات الجداول الخاصة فقط، ولا يستخدم التطبيق مفتاح service_role.
- `PUBLIC_ORIGIN` يساوي رابط التطبيق النهائي. لا تحفظ بيانات حقيقية في وضع المعاينة ولا تضع كلمات المرور أو روابط الاتصال في GitHub.
- دون إعداد قاعدة البيانات تظل الواجهة معاينة، و`/api/health` يرجع `ready: false`.

نسخة إدارة موظفي Energy Plus بهوية اللوجو الأصلي الأسود والدهبي. الواجهة عربية RTL، وNode.js يخدم الواجهة وAPI من نفس الدومين.

## التشغيل

- Node.js 22 أو 24.
- تثبيت الاعتمادات: `npm ci` باستخدام package-lock.json.
- الاختبارات: `npm test`.
- البناء: `npm run build`.
- التشغيل: `npm start`.
- عند غياب قاعدة البيانات، الواجهة تعمل كمعاينة وتظل API معطلة برسالة واضحة؛ لا يتم تسجيل كلمات مرور محليًا.

## Hostinger migration (existing production database)

- Runtime: Node.js 22.x; root `energy-staff/` when using Git, or zip this folder's contents at the archive root.
- Install `npm ci`; build `npm run build`; entry `server/index.mjs`; output `dist`; run `npm start`. Use Hostinger's injected PORT.
- Keep the existing Supabase PostgreSQL database and schema `energy_staff_v3`. Set the same DATABASE_URL securely in Hostinger. Never create a new MySQL database, run a bootstrap, reset passwords, or import demo staff for this migration.
- Set NODE_ENV=production and PUBLIC_ORIGIN=https://stuff.energyclubegypt.com. Add a temporary test origin only if a real test URL is provided. Existing accounts need no INITIAL_ADMIN_EMAIL or ADMIN_SETUP_TOKEN setup.
- Before DNS: verify health ready=true/storage=postgres, login and read-only key flows on the Hostinger runtime. Never use real attendance/payroll writes to test.
- After verification, change only the stuff.energyclubegypt.com DNS record. Keep Vercel and its environment unchanged for rollback.
- Git auto-deployment should track only energy-staff-hostinger, root energy-staff/. Confirm it is enabled and a test deployment succeeds before claiming it works. An uploaded zip alone is manual deployment.

### Backups and rollback

Git stores source code, not employee data or secrets. Hostinger website backups do not by themselves back up the external Supabase database. Verify Supabase's actual backup retention and restore path before promising recovery. A database backup/export must be kept privately and a restore tested separately. Do not restore over production to test it. Store deployment secrets in the vault, not Git. Keep Vercel available as a runtime rollback while both runtimes use the same database; switching hosting back does not undo database changes.

## البيانات والصلاحيات

- كلمات المرور تُشتق باستخدام scrypt بملح مستقل لكل حساب، ولا تدخل بيانات الواجهة أو السجلات.
- الجلسة في Cookie: HttpOnly / Secure / SameSite، مع CSRF، وتغيير معرف الجلسة عند الدخول، وتحديد محاولات الدخول.
- كل API تتحقق من الحساب المعتمد ودوره من قاعدة البيانات في كل طلب.
- الإدارة تراجع التسجيل والأدوار وتضبط الفروع. مدير القسم يوزع ويراجع مهام فريق قسمه وفرعه. الموظف لا يرفع نسخة كاملة من بيانات الجيم.
- تغييرات الإدارة تستخدم رقم إصدار لمنع الكتابة فوق تعديل من جهاز آخر. عند التعارض، يعرض التطبيق رسالة لتحديث البيانات.
- حد GPS ثابت ٨٠ متر، ودقة الموقع بالكامل يجب أن تقع داخله. GPS المتصفح ليس وسيلة لكشف التزييف الجغرافي بشكل مضمون.
- البريك مدفوع بالكامل، ونقاط المخالفات منفصلة عن الأجر. مراجعة AI غير مفعلة.
- نجحت اختبارات Postgres الحقيقي مع حساب الإدارة: الدخول، قراءة بيانات الفريق، الحفظ وإعادة القراءة، رفض الإصدار القديم، صلاحيات قائمة الحسابات، والخروج. MySQL على Hostinger لم يُنشر.

## تجهيز Postgres جديد

نفّذ `server/postgres.sql` مرة واحدة في قاعدة جديدة لإنشاء المخطط والصلاحيات. يُنشأ دور الاتصال بدون تسجيل دخول في الملف؛ فعّل LOGIN واختر كلمة مرور عشوائية طويلة بشكل منفصل من قناة إدارية آمنة، ثم أضف رابط الاتصال كسر في Vercel. لا تُضف كلمة المرور إلى ملف SQL. تُنشأ الإدارة عبر آلية التهيئة الحالية أو بإضافة سجل يضم تجزئة scrypt من الإدارة الآمنة؛ لا يوجد حساب أو كلمة مرور افتراضية ضمن المصدر.

## الهوية البصرية

اللوجو مستخرج كما هو من مشروع نظام الحضور السابق. صورة الجيم توضيحية من Unsplash: https://images.unsplash.com/photo-1534438327276-14e5300c3a48 .
