import { qs } from '../core/dom.js';
export const modal=(()=>{const root=()=>qs('#modalRoot');
function hide(){root().setAttribute('aria-hidden','true'); root().innerHTML='';}
function show({title,content,onMount}){
root().setAttribute('aria-hidden','false');
root().innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
<div class="modal__top"><div class="modal__title">${title}</div><button class="btn btn--ghost" id="modalClose">Cerrar</button></div>
<div class="hr"></div><div class="modal__body">${content}</div></div>`;
qs('#modalClose').addEventListener('click',hide);
root().addEventListener('click',(e)=>{if(e.target===root()) hide();},{once:true});
onMount?.();
}
return{show,hide};
})();
