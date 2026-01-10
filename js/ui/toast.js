import { qs } from '../core/dom.js';
export const toast=(()=>{const root=()=>qs('#toastRoot');
function hide(){root().innerHTML='';}
function show({title,message,actions=[]}){
const el=document.createElement('div'); el.className='toast';
el.innerHTML=`<div><div class="toast__msg">${title}</div><div class="toast__sub">${message||''}</div></div><div class="toast__actions"></div>`;
const ael=el.querySelector('.toast__actions');
actions.forEach(a=>{const b=document.createElement('button');
b.className='btn '+(a.variant==='good'?'btn--good':(a.variant==='ghost'?'btn--ghost':''));
b.textContent=a.label; b.addEventListener('click',()=>a.onClick?.()); ael.appendChild(b);});
root().innerHTML=''; root().appendChild(el);
}
return{show,hide};
})();
