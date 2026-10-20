// Energy Staff — language (AR/EN) + theme (light/dark) engine. Loaded first; persists per device via localStorage.
(function(){
const html=document.documentElement;
const lang=localStorage.getItem('es-lang')||'ar';
const theme=localStorage.getItem('es-theme')||'light';
html.setAttribute('data-theme',theme);
if(lang==='en'){html.lang='en';html.dir='ltr'}else{html.lang='ar';html.dir='rtl'}
const DICT=(typeof window.I18N_EN==='object'&&window.I18N_EN)||{};
const keys=Object.keys(DICT).sort((a,b)=>b.length-a.length);
const AR='\u0621-\u064A\u0671-\u06D3\u0640';
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const RES=keys.map(k=>{try{return [new RegExp('(?<!['+AR+'])'+escRe(k)+'(?!['+AR+'])','g'),DICT[k]]}catch{return null}}).filter(Boolean);
const hasAr=s=>/[\u0621-\u064A]/.test(s);
function tr(t){let out=t;for(const [re,en] of RES){if(out.indexOf(re.source.replace(/^\(\?<!.*?\)|\(\?!.*?\)$/,''))!==-1||re.test(out))out=out.replace(re,en)}return out}
function trAttrs(el){for(const a of ['placeholder','title','aria-label','value']){const v=el.getAttribute&&el.getAttribute(a);if(v&&hasAr(v)){if(a==='value'&&el.tagName!=='INPUT'&&el.tagName!=='BUTTON')continue;el.setAttribute(a,tr(v))}}}
function walk(root){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue&&hasAr(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  for(const n of nodes)n.nodeValue=tr(n.nodeValue);
  if(root.querySelectorAll)root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(trAttrs);
  if(root.getAttribute)trAttrs(root);
}
function translateAll(root){if(lang!=='en')return;if(document.title&&hasAr(document.title))document.title=tr(document.title);walk(root||document.body)}
function mountSwitcher(){
  const wrap=document.createElement('span');wrap.className='ux-switch';
  const tBtn=document.createElement('button');tBtn.type='button';tBtn.id='uxTheme';
  const lBtn=document.createElement('button');lBtn.type='button';lBtn.id='uxLang';
  function paint(){
    tBtn.textContent=(localStorage.getItem('es-theme')||'light')==='dark'?'\u2600':'\u263E';
    tBtn.title=lang==='en'?'Toggle dark / light':'\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064A\u0644\u064A / \u0627\u0644\u0646\u0647\u0627\u0631\u064A';
    lBtn.textContent=lang==='en'?'\u0639':'EN';
    lBtn.title=lang==='en'?'\u0627\u0644\u062A\u0628\u062F\u064A\u0644 \u0625\u0644\u0649 \u0627\u0644\u0639\u0631\u0628\u064A\u0629':'Switch to English';
  }
  tBtn.onclick=()=>{const cur=(localStorage.getItem('es-theme')||'light')==='dark'?'light':'dark';localStorage.setItem('es-theme',cur);html.setAttribute('data-theme',cur);paint()};
  lBtn.onclick=()=>{localStorage.setItem('es-lang',lang==='en'?'ar':'en');location.reload()};
  wrap.append(tBtn,lBtn);paint();
  function place(){
    const inEntry=document.body.classList.contains('entry-mode');
    const host=document.querySelector('.header-actions');
    if(inEntry||!host){wrap.classList.add('ux-floating');if(wrap.parentElement!==document.body)document.body.append(wrap)}
    else{wrap.classList.remove('ux-floating');if(wrap.parentElement!==host)host.prepend(wrap)}
  }
  place();
  new MutationObserver(place).observe(document.body,{attributes:true,attributeFilter:['class']});
}
document.addEventListener('DOMContentLoaded',()=>{
  translateAll(document.body);
  if(lang==='en'){
    let busy=false;
    new MutationObserver(muts=>{
      if(busy)return;busy=true;
      try{
        for(const m of muts){
          if(m.type==='characterData'){const n=m.target;if(n.nodeValue&&hasAr(n.nodeValue))n.nodeValue=tr(n.nodeValue)}
          else m.addedNodes.forEach(n=>{
            if(n.nodeType===3){if(n.nodeValue&&hasAr(n.nodeValue))n.nodeValue=tr(n.nodeValue)}
            else if(n.nodeType===1)walk(n);
          });
        }
        if(document.title&&hasAr(document.title))document.title=tr(document.title);
      }finally{busy=false}
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  mountSwitcher();
});
})();
