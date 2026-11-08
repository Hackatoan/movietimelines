(function(){var b=document.getElementById('lang-btn'),p=document.getElementById('lang-pop'),w=document.getElementById('lang-switch');if(!b||!p)return;var d=p.querySelector('a:not([aria-current])');if(d&&d.style&&d.style.color)b.style.color=d.style.color;
var items=Array.prototype.slice.call(p.querySelectorAll('[role="menuitem"]'));
function isOpen(){return p.style.display==='flex';}
function close(){p.style.display='none';b.setAttribute('aria-expanded','false');}
function open(focusItem){p.style.display='flex';b.setAttribute('aria-expanded','true');if(focusItem){var c=p.querySelector('[aria-current]')||items[0];if(c)c.focus();}}
// role="menu" promises arrow-key navigation: open + move into the menu from the button,
// arrow/Home/End between items, and close when focus is tabbed out of the switcher
// (relatedTarget null = mouse click on non-focusable area; leave that to the click handler).
b.addEventListener('click',function(e){e.stopPropagation();if(isOpen()){close();}else{open(e.detail===0);}});
b.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open(true);}});
p.addEventListener('keydown',function(e){var i=items.indexOf(document.activeElement),n=items.length,t=-1;if(i<0||!n)return;
if(e.key==='ArrowDown')t=(i+1)%n;else if(e.key==='ArrowUp')t=(i-1+n)%n;else if(e.key==='Home')t=0;else if(e.key==='End')t=n-1;
if(t>=0){e.preventDefault();items[t].focus();}});
if(w)w.addEventListener('focusout',function(e){var r=e.relatedTarget;if(isOpen()&&r&&!w.contains(r))close();});
p.addEventListener('click',function(e){e.stopPropagation();});document.addEventListener('click',close);document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen()){close();b.focus();}});})();
