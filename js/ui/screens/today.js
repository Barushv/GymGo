import { getProgramWeek, e1rmEpley } from '../../core/utils.js';

const todayISO=()=>new Date().toISOString().slice(0,10);

function bestSetFromLog(log){
if(!log?.sets?.length) return null;
let best=null;
for(const s of log.sets){
const e=e1rmEpley(s.weight,s.reps);
if(!best||e>best.e){best={...s,e};}
}
return best?{weight:Number(best.weight)||0,reps:Number(best.reps)||0}:null;
}

function buildGoal({repRange,bestSet}){
const [minR,maxR]=repRange;
if(!bestSet) return `Apunta a ${minR}–${maxR} reps (RIR 1–2)`;
const {weight,reps}=bestSet;
if(reps<maxR) return `${weight} × ${Math.min(maxR,reps+1)} (o más)`;
const nextW=Math.round((weight*1.025)*2)/2; // 2.5% aprox, redondeo 0.5kg
return `${nextW} × ${Math.max(minR,maxR-2)}–${maxR}`;
}

export async function renderToday(container,ctx){
const { setSubtitle, toast, modal, db, store }=ctx;
const routine=store.getRoutine();
const settings=store.getSettings();
const today=todayISO();
const weeksTotal=routine?.program?.weeks||8;
const week=getProgramWeek(settings.programStartDate,new Date(),weeksTotal);
setSubtitle(`Semana ${week} • ${today}`);

// Determina día según weekday (Lun=1..Dom=7)
const jsDay=new Date().getDay();
const weekDay=jsDay===0?7:jsDay;
const planned=routine?.schedule?.find(s=>s.weekDay===weekDay)||routine?.schedule?.[0];
const day=routine?.days?.find(d=>d.id===planned?.dayId)||routine?.days?.[0];

if(!day){container.innerHTML='<div class="card"><div class="card__title">Sin rutina</div><div class="meta">Edita /data/routine.json</div></div>';return;}

const cards=await Promise.all(day.exercises.map(async ex=>{
const logToday=await db.getLog(today,ex.id);
const setsDone=logToday?.sets?.filter(s=>(Number(s.reps)||0)>0&&(Number(s.weight)||0)>0).length||0;

const all=await db.listLogsByExercise(ex.id);
const last=all.filter(l=>l.date!==today).sort((a,b)=>a.date<b.date?1:-1)[0]||null;
const bestSet=bestSetFromLog(last);

const tech=ex.techniqueId?store.findTechniqueById(ex.techniqueId):null;
const goal=buildGoal({repRange:ex.repRange,bestSet});

const restText=Array.isArray(ex.restSec)?(ex.restSec[0]===ex.restSec[1]?`${ex.restSec[0]}s`:`${ex.restSec[0]}–${ex.restSec[1]}s`):`${ex.restSec}s`;
const repsText=`${ex.sets}×${ex.repRange[0]}–${ex.repRange[1]}`;

return `<section class="card" data-ex="${ex.id}">
  <div class="card__title">
    <span>${ex.name}</span>
    <span class="pills">
      ${tech?`<span class="pill pill--accent2" data-tech="${tech.id}" title="Técnica">${tech.label}</span>`:`<span class="pill pill--muted">—</span>`}
      <span class="pill pill--muted" data-info="${ex.id}" title="Info">ⓘ</span>
    </span>
  </div>
  <div class="meta">${repsText} • Tempo <b>${ex.tempo}</b> • Desc <b>${restText}</b></div>
  <div class="meta" style="margin-top:8px;">Semana pasada: <b>${bestSet?`${bestSet.weight}×${bestSet.reps}`:'—'}</b></div>
  <div class="meta" style="margin-top:4px;color:var(--accent);font-weight:800;">Meta hoy: ${goal}</div>
  <div class="hr"></div>
  <div class="row">
    <div class="pill">Sets: ${setsDone}/${ex.sets}</div>
    <button class="btn btn--good" data-log="${ex.id}">+ Registrar set</button>
  </div>
</section>`;
}));

container.innerHTML=`<div class="card">
  <div class="card__title">Hoy • ${day.title}</div>
  <div class="meta">Modo Runner: registra rápido. Técnica en badges y comparativo en Progreso 📈</div>
</div>${cards.join('')}`;

container.querySelectorAll('[data-tech]').forEach(el=>{
el.addEventListener('click',()=>{
const tech=store.findTechniqueById(el.dataset.tech); if(!tech) return;
modal.show({title:`${tech.emoji||'📚'} ${tech.label}`,content:`
  <div class="meta"><b>${tech.summary}</b></div>
  <div class="hr"></div>
  <div class="modal__text">${tech.howto.map(x=>`• ${x}`).join('<br/>')}</div>
  <div class="hr"></div>
  <div class="meta"><b>Ejemplo:</b> ${tech.example}</div>`});
});
});

container.querySelectorAll('[data-info]').forEach(el=>{
el.addEventListener('click',()=>{
modal.show({title:'Cómo progresar 📈',content:`
<div class="meta"><b>Doble progresión (simple):</b></div>
<div class="modal__text">
• Mantén el mismo peso y sube reps semana a semana dentro del rango.<br/>
• Cuando llegues al tope del rango, sube el peso (2.5–5%) y vuelve al rango bajo.<br/>
• Mantén RIR 1–2 para consistencia.
</div>`});
});
});

container.querySelectorAll('[data-log]').forEach(btn=>{
btn.addEventListener('click',async ()=>{
const exId=btn.dataset.log;
const ex=day.exercises.find(e=>e.id===exId); if(!ex) return;
const log=await db.getLog(today,exId);
const sets=(log?.sets?.length?log.sets:Array.from({length:ex.sets},(_,i)=>({setNo:i+1,weight:0,reps:0,rir:null})));

modal.show({title:ex.name,content:`
  <div class="meta">${ex.sets}×${ex.repRange[0]}–${ex.repRange[1]} • Tempo <b>${ex.tempo}</b></div>
  <div class="meta" style="margin-top:6px;">Tip: registra <b>kg</b> y <b>reps</b>. En Progreso puedes comparar por <b>e1RM</b> o <b>Volumen</b> 📈.</div>
  <div class="hr"></div>
  <table class="table">
    <thead><tr><th>Set</th><th>Kg</th><th>Reps</th><th>RIR</th></tr></thead>
    <tbody>
      ${sets.map(s=>`<tr>
        <td>${s.setNo}</td>
        <td><input class="input input--sm" inputmode="decimal" data-w="${s.setNo}" value="${s.weight||''}" placeholder="0" /></td>
        <td><input class="input input--sm" inputmode="numeric" data-r="${s.setNo}" value="${s.reps||''}" placeholder="0" /></td>
        <td><input class="input input--sm" inputmode="numeric" data-ir="${s.setNo}" value="${s.rir??''}" placeholder="-" /></td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="hr"></div>
  <button id="saveLogBtn" class="btn btn--good" style="width:100%;">Guardar ✅</button>
`,onMount:()=>{
document.querySelector('#saveLogBtn').addEventListener('click',async ()=>{
const nextSets=sets.map(s=>{
const w=document.querySelector(`[data-w="${s.setNo}"]`)?.value||'0';
const r=document.querySelector(`[data-r="${s.setNo}"]`)?.value||'0';
const ir=document.querySelector(`[data-ir="${s.setNo}"]`)?.value||'';
return {setNo:s.setNo,weight:Number(String(w).replace(',','.'))||0,reps:Number(r)||0,rir:ir===''?null:(Number(ir)||null)};
});
await db.saveLog({date:today,week,dayId:day.id,exerciseId:exId,sets:nextSets});
modal.hide();
toast.show({title:'Guardado ✅',message:'Set(s) registrados. Revisa Progreso 📈',actions:[{label:'OK',variant:'ghost',onClick:()=>toast.hide()}]});
await renderToday(container,ctx);
});
}});
});
});
}
