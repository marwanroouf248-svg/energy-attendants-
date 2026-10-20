// Compact navigation on phones, preserving all existing page buttons and handlers.
(function(){
function setup(){
 const aside=document.querySelector('body>aside'),nav=document.querySelector('#nav');if(!aside||!nav)return;
 const button=document.createElement('button');button.id='mobileMenuToggle';button.type='button';button.textContent='☰';button.setAttribute('aria-label','القائمة');button.setAttribute('aria-expanded','false');
 const panel=document.createElement('div');panel.id='mobileMenuPanel';aside.append(button,panel);
 function setOpen(open){aside.classList.toggle('mobile-menu-open',open);button.setAttribute('aria-expanded',String(open))}
 button.onclick=()=>setOpen(!aside.classList.contains('mobile-menu-open'));
 panel.addEventListener('click',e=>{if(e.target.closest('button'))setOpen(false)});
 document.addEventListener('click',e=>{if(!aside.contains(e.target))setOpen(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
 function place(){const mobile=matchMedia('(max-width:760px)').matches,actions=document.querySelector('.header-actions');if(mobile){if(nav.parentElement!==panel)panel.append(nav);if(actions&&actions.parentElement!==panel)panel.append(actions)}else{if(nav.parentElement!==aside)aside.insertBefore(nav,aside.querySelector('.aside-bottom'));const header=document.querySelector('main>header');if(actions&&header&&actions.parentElement!==header)header.append(actions);setOpen(false)}}
 place();addEventListener('resize',place);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
