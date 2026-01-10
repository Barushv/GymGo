export async function renderTechniques(container,ctx){
const { setSubtitle, store, modal }=ctx;
setSubtitle('Biblioteca de técnicas 📚');
const techs=store.getTechniques();
container.innerHTML=`<div class="card"><div class="card__title">Técnicas</div>
<div class="meta">Toca una técnica para ver cómo aplicarla.</div><div class="hr"></div>
${techs.map(t=>`<button class="btn" style="width:100%;text-align:left;margin:8px 0;" data-tech="${t.id}">
${t.emoji||'📌'} <b>${t.label}</b><div class="meta">${t.summary}</div></button>`).join('')}
</div>`;
container.querySelectorAll('[data-tech]').forEach(btn=>{
btn.addEventListener('click',()=>{
const t=techs.find(x=>x.id===btn.dataset.tech); if(!t) return;
modal.show({title:`${t.emoji||'📚'} ${t.label}`,content:`
<div class="meta"><b>${t.summary}</b></div><div class="hr"></div>
<div class="modal__text">${t.howto.map(x=>`• ${x}`).join('<br/>')}</div><div class="hr"></div>
<div class="meta"><b>Ejemplo:</b> ${t.example}</div>`});
});
});
}
