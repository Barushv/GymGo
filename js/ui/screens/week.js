export async function renderWeek(container,ctx){
const { setSubtitle, store }=ctx;
setSubtitle('Plan semanal 📆');
const routine=store.getRoutine();
const days=routine?.days||[];
const schedule=routine?.schedule||[];
const wd=n=>['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][n-1]||`D${n}`;

function parseComboNames(name){
  const raw = String(name||'').trim();
  if(!raw) return [''];
  let parts = raw.includes(' + ') ? raw.split(' + ') : (raw.includes(' / ') ? raw.split(' / ') : [raw]);
  parts = parts.map(p=>p.trim()).filter(Boolean);
  if(parts.length<=1) return [raw];
  return parts.slice(0,3);
}
function expandExercise(ex){
  const names = ex?.comboNames?.length ? ex.comboNames : parseComboNames(ex?.name);
  if(ex?.combo===true || names.length>1){
    return names.map((nm,i)=>({ ...ex, id:`${ex.id}__${i+1}`, name:nm, _comboCount:names.length, _comboIndex:i+1, _comboParentName: ex.name }));
  }
  return [{...ex, _comboCount:1}];
}
container.innerHTML=`<div class="card"><div class="card__title">Semana</div>
<div class="meta">Vista rápida del plan. El registro se hace en Hoy 🏋️</div><div class="hr"></div>
${schedule.map(s=>{const day=days.find(d=>d.id===s.dayId); if(!day) return '';
return `<div class="card" style="margin:10px 0;"><div class="card__title">${wd(s.weekDay)} • ${day.title}</div>
<div class="meta">${day.exercises.flatMap(e=>{const subs=expandExercise(e); if(subs.length===1){const x=subs[0]; return [`• ${x.name} (${x.sets}×${x.repRange[0]}–${x.repRange[1]})`];}
return [`• ${e.name} (superset)`, ...subs.map(s=>`&nbsp;&nbsp;↳ ${s.name} (${s.sets}×${s.repRange[0]}–${s.repRange[1]})`)];}).join('<br/>')}</div></div>`;}).join('')}
</div>`;
}
