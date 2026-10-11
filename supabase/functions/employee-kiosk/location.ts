const branches: Record<string, {lat:number;lng:number}>={
  'فرع الرخاوي':{lat:29.964248,lng:32.5560476},
  'فرع فودافون':{lat:29.9631855,lng:32.5572978},
  Quality:{lat:29.9631855,lng:32.5572978},
  Assessment:{lat:29.9631855,lng:32.5572978}
};
export function validateLocation(location:any,home:string,allowed:string[]=[]){
  const branch=String(location?.branch||home).trim(),center=branches[branch];
  if(branch!==home&&!allowed.includes(branch))throw Error('الفرع غير مسموح للموظف');
  if(!center)throw Error('موقع الفرع غير محدد؛ تواصل مع المدير');
  const lat=location?.lat,lng=location?.lng,accuracy=location?.accuracy;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isFinite(accuracy)||accuracy<0)throw Error('بيانات GPS غير صالحة؛ فعّل تحديد الموقع وحاول مرة أخرى');
  const rad=(x:number)=>x*Math.PI/180,a=Math.sin(rad(lat-center.lat)/2)**2+Math.cos(rad(center.lat))*Math.cos(rad(lat))*Math.sin(rad(lng-center.lng)/2)**2;
  const distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
  if(distance>200+Math.min(accuracy,30))throw Error('الموقع أبعد من نطاق الفرع؛ فعّل GPS بدقة عالية وحاول مرة أخرى');
  return {lat,lng,accuracy,distance:Math.round(distance),branch};
}
