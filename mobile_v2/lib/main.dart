import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final api = Supabase.instance.client;
Future<void> main() async {
 WidgetsFlutterBinding.ensureInitialized();
 const url = String.fromEnvironment('SUPABASE_URL');
 const key = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
 if(url.isEmpty || key.isEmpty) { runApp(const MaterialApp(home: Scaffold(body: Center(child: Text('Missing Supabase configuration'))))); return; }
 await Supabase.initialize(url:url, publishableKey:key);
 runApp(const EnergyApp());
}
class EnergyApp extends StatefulWidget {
 const EnergyApp({super.key});
 @override State<EnergyApp> createState()=>_EnergyAppState();
}
class _EnergyAppState extends State<EnergyApp> {
 @override void initState(){super.initState();api.auth.onAuthStateChange.listen((_){if(mounted)setState((){});});}
 @override Widget build(BuildContext context)=>MaterialApp(
 debugShowCheckedModeBanner:false,
 theme:ThemeData(useMaterial3:true,brightness:Brightness.dark,colorScheme:ColorScheme.fromSeed(seedColor:const Color(0xffe6bf67),brightness:Brightness.dark)),
 home:api.auth.currentUser==null?const Login():const Dashboard());
}
class Login extends StatefulWidget {const Login({super.key});@override State<Login> createState()=>_LoginState();}
class _LoginState extends State<Login> {
 final email=TextEditingController(),pass=TextEditingController();String error='';
 @override Widget build(BuildContext context)=>Scaffold(body:Center(child:ConstrainedBox(
 constraints:const BoxConstraints(maxWidth:420),child:ListView(shrinkWrap:true,padding:const EdgeInsets.all(24),children:[
 const Icon(Icons.bolt,size:72,color:Colors.amber),
 const Text('ENERGY PLUS STAFF',textAlign:TextAlign.center,style:TextStyle(fontSize:26)),
 TextField(controller:email,decoration:const InputDecoration(labelText:'Email')),
 TextField(controller:pass,obscureText:true,decoration:const InputDecoration(labelText:'Password')),
 FilledButton(onPressed:()async{try{await api.auth.signInWithPassword(email:email.text.trim(),password:pass.text);}catch(e){setState(()=>error=e.toString());}},child:const Text('دخول')),
 Text(error),const Text('نسخة تجريبية: تحتاج حساب Supabase Auth مرتبطًا بملف الموظف')
 ]))));
}
class Dashboard extends StatelessWidget {
 const Dashboard({super.key});
 @override Widget build(BuildContext context)=>FutureBuilder(
 future:api.from('profiles').select('id,full_name,role,department,active').eq('id',api.auth.currentUser!.id).maybeSingle(),
 builder:(context,s){
 if(s.hasError)return Scaffold(body:Center(child:Text('Error: '+s.error.toString())));
 if(!s.hasData)return const Scaffold(body:Center(child:CircularProgressIndicator()));
 final p=s.data;
 if(p==null||p['active']!=true)return const Scaffold(body:Center(child:Text('Unauthorized profile')));
 final manager=p['role']=='manager',dept=(p['department']??'').toString().toLowerCase();
 return Directionality(textDirection:TextDirection.rtl,child:Scaffold(
 appBar:AppBar(title:Text('أهلًا '+p['full_name'].toString()),actions:[IconButton(onPressed:()=>api.auth.signOut(),icon:const Icon(Icons.logout))]),
 body:ListView(padding:const EdgeInsets.all(16),children:[
 const Text('ENERGY PLUS',style:TextStyle(fontSize:30,color:Colors.amber)),
 Card(child:ListTile(title:const Text('المهام اليومية'),leading:const Icon(Icons.task_alt),onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>Tasks(profile:p,manager:manager))))),
 if(manager)Card(child:ListTile(title:const Text('إدارة الموظفين'),leading:const Icon(Icons.people),onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const StaffList())))),
 if(manager)Card(child:ListTile(title:const Text('إشعارات إنجاز المهام'),leading:const Icon(Icons.notifications_active),onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const ManagerNotifications())))),
 if(manager||dept.contains('sales')||dept.contains('سيلز'))Card(child:ListTile(title:const Text('السيلز'),subtitle:const Text('التارجت اليومي وسكريبتات المكالمات'),onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const SalesWorkspace())))),
 if(manager||dept.contains('coach')||dept.contains('trainer')||dept.contains('مدرب'))const Card(child:ListTile(title:Text('المدربين'),subtitle:Text('الجلسات وتأكيد العملاء والتقييمات — قيد الربط الآمن'))),
 Card(child:ListTile(title:const Text('سجل الحضور والانصراف'),subtitle:const Text('حالة الشفت وسجل آخر العمليات — عرض فقط'),onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>AttendanceHistory(profile:p,manager:manager))))),
 ])));
 });
}
class Tasks extends StatefulWidget {
 final Map<String,dynamic> profile;final bool manager;
 const Tasks({super.key,required this.profile,required this.manager});
 @override State<Tasks> createState()=>_TasksState();
}
class _TasksState extends State<Tasks> {
 late Future<List<Map<String,dynamic>>> rows;
 @override void initState(){super.initState();refresh();}
 void refresh(){rows=load();setState((){});}
 Future<List<Map<String,dynamic>>> load()async{
 var q=api.from('performance_tasks').select('id,employee_id,title,description,status,due_date,completed_at,created_at,profiles!performance_tasks_employee_id_fkey(full_name)');
 if(!widget.manager)q=q.eq('employee_id',widget.profile['id']);
 return List<Map<String,dynamic>>.from(await q.order('created_at',ascending:false).limit(250));
 }
 Future<void> complete(Map<String,dynamic> t)async{
 try{
 await api.from('performance_tasks').update({'status':'done','completed_at':DateTime.now().toUtc().toIso8601String()})
 .eq('id',t['id']).eq('employee_id',widget.profile['id']);
 refresh();
 }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}
 }
 Future<void> add()async{
 final staff=List<Map<String,dynamic>>.from(await api.from('profiles').select('id,full_name').eq('role','employee').eq('active',true).order('full_name'));
 if(staff.isEmpty||!mounted)return;
 String employee=staff.first['id'];final title=TextEditingController(),description=TextEditingController();
 final ok=await showDialog<bool>(context:context,builder:(c)=>StatefulBuilder(builder:(c,update)=>AlertDialog(
 title:const Text('مهمة جديدة'),content:Column(mainAxisSize:MainAxisSize.min,children:[
 DropdownButtonFormField<String>(initialValue:employee,items:staff.map((p)=>DropdownMenuItem<String>(value:p['id'],child:Text(p['full_name'].toString()))).toList(),onChanged:(v)=>update(()=>employee=v??employee)),
 TextField(controller:title,decoration:const InputDecoration(labelText:'عنوان المهمة')),
 TextField(controller:description,decoration:const InputDecoration(labelText:'التفاصيل'))]),
 actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('إلغاء')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('نشر'))])));
 if(ok==true&&title.text.trim().isNotEmpty){
 try{await api.from('performance_tasks').insert({'employee_id':employee,'title':title.text.trim(),'description':description.text.trim(),'created_by':widget.profile['id'],'source':'manager','frequency':'daily','due_date':DateTime.now().toIso8601String().substring(0,10)});refresh();}
 catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}
 }
 title.dispose();description.dispose();
 }
 @override Widget build(BuildContext context)=>Directionality(textDirection:TextDirection.rtl,child:Scaffold(
 appBar:AppBar(title:const Text('المهام اليومية'),actions:[IconButton(tooltip:'تحديث الإنجازات',onPressed:refresh,icon:const Icon(Icons.refresh))]),
 floatingActionButton:widget.manager?FloatingActionButton.extended(onPressed:add,label:const Text('مهمة جديدة'),icon:const Icon(Icons.add)):null,
 body:FutureBuilder(future:rows,builder:(context,s){
 if(s.hasError)return Center(child:Text('Error: '+s.error.toString()));
 if(!s.hasData)return const Center(child:CircularProgressIndicator());
 return RefreshIndicator(onRefresh:()async{refresh();await rows;},child:ListView(children:s.data!.map((t)=>Card(child:ListTile(
 title:Text(t['title'].toString()),subtitle:Text((widget.manager ? ((t['profiles']?['full_name']??'').toString()+' | ') : '')+(t['description']??'').toString()+' | '+t['status'].toString()+(t['completed_at']!=null?' | تم: '+t['completed_at'].toString():'')),
 trailing:!widget.manager&&t['status']!='done'?IconButton(icon:const Icon(Icons.check_circle_outline),onPressed:()=>complete(t)):null))).toList()));
 })));
}
class StaffList extends StatelessWidget {
 const StaffList({super.key});
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('الموظفون')),
 body:FutureBuilder(future:api.from('profiles').select('full_name,department,branch').eq('active',true).order('full_name'),builder:(context,s){
 if(s.hasError)return Center(child:Text(s.error.toString()));
 if(!s.hasData)return const Center(child:CircularProgressIndicator());
 return ListView(children:s.data!.map((p)=>ListTile(title:Text(p['full_name'].toString()),subtitle:Text((p['department']??'').toString()+' / '+(p['branch']??'').toString()))).toList());
 }));
}

class ManagerNotifications extends StatefulWidget {
 const ManagerNotifications({super.key});
 @override State<ManagerNotifications> createState()=>_ManagerNotificationsState();
}
class _ManagerNotificationsState extends State<ManagerNotifications> {
 late Future<List<Map<String,dynamic>>> events;
 @override void initState(){super.initState();reload();}
 void reload(){events=fetch();setState((){});}
 Future<List<Map<String,dynamic>>> fetch()async{
  final uid=api.auth.currentUser!.id;
  return List<Map<String,dynamic>>.from(await api.from('notifications')
    .select('id,title,message,type,created_at,is_read')
    .eq('user_id',uid).eq('type','task_completed')
    .order('created_at',ascending:false).limit(100));
 }
 @override Widget build(BuildContext context)=>Directionality(textDirection:TextDirection.rtl,child:Scaffold(
  appBar:AppBar(title:const Text('إنجازات الموظفين'),actions:[IconButton(onPressed:reload,icon:const Icon(Icons.refresh))]),
  body:FutureBuilder(future:events,builder:(context,s){
   if(s.hasError)return Center(child:Text('تعذر تحميل الإشعارات: '+s.error.toString()));
   if(!s.hasData)return const Center(child:CircularProgressIndicator());
   return RefreshIndicator(onRefresh:()async{reload();await events;},child:ListView(
    children:s.data!.isEmpty?[const ListTile(title:Text('لا توجد إشعارات إنجاز حتى الآن'))]:
      s.data!.map((n)=>Card(child:ListTile(
       leading:const Icon(Icons.check_circle,color:Colors.green),
       title:Text(n['title'].toString()),
       subtitle:Text(n['message'].toString()+'\n'+n['created_at'].toString())
      ))).toList()));
  })
 ));
}

class SalesWorkspace extends StatelessWidget {
 const SalesWorkspace({super.key});
 @override Widget build(BuildContext context)=>Directionality(textDirection:TextDirection.rtl,child:Scaffold(
  appBar:AppBar(title:const Text('قسم السيلز')),
  body:ListView(padding:const EdgeInsets.all(16),children:[
   const Text('التارجت اليومي',style:TextStyle(fontSize:22,fontWeight:FontWeight.bold)),
   FutureBuilder(future:api.from('sales_daily_targets')
     .select('target_date,total_calls_target,expired_target,old_target,social_target,invitation_target,tour_target,followup_target')
     .eq('sales_user_id',api.auth.currentUser!.id)
     .order('target_date',ascending:false).limit(1),
    builder:(context,s){
     if(s.hasError)return ListTile(title:const Text('تعذر تحميل التارجت'),subtitle:Text(s.error.toString()));
     if(!s.hasData)return const LinearProgressIndicator();
     if(s.data!.isEmpty)return const ListTile(title:Text('لم يتم تحديد تارجت لهذا الحساب'));
     final t=s.data!.first;
     return Card(child:Column(children:[
      ListTile(title:Text('التاريخ: '+t['target_date'].toString()),subtitle:Text('إجمالي المكالمات: '+t['total_calls_target'].toString())),
      ListTile(title:Text('متابعة: '+t['followup_target'].toString()),subtitle:Text('زيارات: '+t['tour_target'].toString()+' | دعوات: '+t['invitation_target'].toString())),
     ]));
    }),
   const SizedBox(height:20),
   const Text('سكريبتات المكالمات',style:TextStyle(fontSize:22,fontWeight:FontWeight.bold)),
   FutureBuilder(future:api.from('sales_scripts').select('title,script,source').eq('active',true).order('title'),
    builder:(context,s){
     if(s.hasError)return ListTile(title:const Text('تعذر تحميل السكريبتات'),subtitle:Text(s.error.toString()));
     if(!s.hasData)return const LinearProgressIndicator();
     return Column(children:s.data!.map((row)=>Card(child:ExpansionTile(
      title:Text(row['title'].toString()),
      subtitle:Text(row['source'].toString()),
      children:[Padding(padding:const EdgeInsets.all(16),child:SelectableText(row['script'].toString()))],
     ))).toList());
    }),
   const ListTile(title:Text('العملاء والعمولات'),subtitle:Text('قيد مراجعة صلاحيات البيانات قبل عرضها داخل التطبيق')),
  ]),
 ));
}

class AttendanceHistory extends StatefulWidget {
 final Map<String,dynamic> profile;
 final bool manager;
 const AttendanceHistory({super.key,required this.profile,required this.manager});
 @override State<AttendanceHistory> createState()=>_AttendanceHistoryState();
}
class _AttendanceHistoryState extends State<AttendanceHistory> {
 late Future<List<Map<String,dynamic>>> history;
 @override void initState(){super.initState();refresh();}
 void refresh(){history=fetch();setState((){});}
 Future<List<Map<String,dynamic>>> fetch()async{
  var q=api.from('attendance').select('id,employee_id,check_in,check_out,branch,profiles!attendance_employee_id_fkey(full_name)');
  if(!widget.manager)q=q.eq('employee_id',widget.profile['id']);
  return List<Map<String,dynamic>>.from(await q.order('check_in',ascending:false).limit(100));
 }
 String time(dynamic v) {
  if(v==null)return 'لم يسجل';
  final parsed=DateTime.tryParse(v.toString());
  if(parsed==null)return v.toString();
  final local=parsed.toLocal();
  return local.toString().substring(0,16);
 }
 @override Widget build(BuildContext context)=>Directionality(textDirection:TextDirection.rtl,child:Scaffold(
  appBar:AppBar(title:const Text('سجل الحضور'),actions:[IconButton(onPressed:refresh,icon:const Icon(Icons.refresh))]),
  body:FutureBuilder(future:history,builder:(context,s){
   if(s.hasError)return Center(child:Text('تعذر تحميل الحضور: '+s.error.toString()));
   if(!s.hasData)return const Center(child:CircularProgressIndicator());
   if(s.data!.isEmpty)return const Center(child:Text('لا توجد سجلات حضور'));
   final open=s.data!.where((e)=>e['check_out']==null).length;
   return RefreshIndicator(onRefresh:()async{refresh();await history;},child:ListView(
    padding:const EdgeInsets.all(12),children:[
     Card(child:ListTile(title:Text(widget.manager?'الموظفون في الشفت (آخر 100 سجل)':'حالة الشفت'),
      subtitle:Text(widget.manager?'سجلات مفتوحة في النتائج: '+open.toString():
       (open>0?'داخل الشفت':'لا يوجد شفت مفتوح')))),
     ...s.data!.map((row)=>Card(child:ListTile(
      leading:Icon(row['check_out']==null?Icons.login:Icons.history,color:row['check_out']==null?Colors.green:Colors.amber),
      title:Text(widget.manager?(row['profiles']?['full_name']??'موظف').toString():(row['branch']??'الحضور').toString()),
      subtitle:Text('دخول: '+time(row['check_in'])+'\nانصراف: '+time(row['check_out'])+
        '\nالفرع: '+(row['branch']??'غير محدد').toString()),
     ))),
    ]));
  })
 ));
}
