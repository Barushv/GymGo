export async function renderWeek(container,ctx){
const { setSubtitle, store }=ctx;
setSubtitle('Plan semanal 📆');
const routine=store.getRoutine();
const days=routine?.days||[];
const schedule=routine?.schedule||[];
const wd=n=>['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][n-1]||`D${n}`;
container.innerHTML=`<div class="card"><div class="card__title">Semana</div>
<div class="meta">Vista rápida del plan. El registro se hace en Hoy 🏋️</div><div class="hr"></div>
${schedule.map(s=>{const day=days.find(d=>d.id===s.dayId); if(!day) return '';
return `<div class="card" style="margin:10px 0;"><div class="card__title">${wd(s.weekDay)} • ${day.title}</div>
<div class="meta">${day.exercises.map(e=>`• ${e.name} (${e.sets}×${e.repRange[0]}–${e.repRange[1]})`).join('<br/>')}</div></div>`;}).join('')}
</div>`;
}
