// Runs in <head>: apply saved theme/lang before first paint (CSP-safe external script).
(function(){try{const t=localStorage.getItem('es-theme')||'light';document.documentElement.setAttribute('data-theme',t);const l=localStorage.getItem('es-lang')||'ar';if(l==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr'}}catch{}})();
