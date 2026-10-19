(async()=>{
const branch=document.querySelector('#kbranch'),pin=document.querySelector('#kpin'),msg=document.querySelector('#kmsg'),inB=document.querySelector('#kin'),outB=document.querySelector('#kout');
try{const r=await fetch('/api/registration-options',{credentials:'same-origin'});const d=await r.json();branch.innerHTML=(d.branches||[]).map(b=>'<option>'+b+'</option>').join('')}catch{msg.textContent='تعذر تحميل الفروع. حدّث الصفحة.';return}
async function punch(direction){
 msg.textContent='';
 if(!/^\d{4,8}$/.test(pin.value)){msg.textContent='الرقم السري من ٤ لـ ٨ أرقام';return}
 inB.disabled=outB.disabled=true;
 try{
  const r=await fetch('/api/kiosk/punch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:branch.value,pin:pin.value,direction})});
  const d=await r.json();
  if(!r.ok)throw Error(d.message||'حصل خطأ');
  msg.textContent=(direction==='in'?'أهلاً بيك يا ':'مع السلامة يا ')+d.name+' ✓';
  pin.value='';
 }catch(e){msg.textContent=e.message}
 finally{inB.disabled=outB.disabled=false}
}
inB.onclick=()=>punch('in');outB.onclick=()=>punch('out');
pin.onkeydown=e=>{if(e.key==='Enter')punch('in')};
})();
