import { e1rmEpley, calcVolume, fmt, getProgramWeek } from '../../core/utils.js';
import { qs } from '../../core/dom.js';

/**
 * Devuelve el "mejor set" del periodo según e1RM (Epley).
 * Esto nos permite comparar semana a semana con una métrica consistente.
 */
function bestSet(sets){
  let best=null;
  for(const s of (sets||[])){
    const e=e1rmEpley(s.weight,s.reps);
    if(!best || e>best.e) best={...s,e};
  }
  return best;
}

/**
 * Sparkline SVG simple (sin librerías) para ver tendencia rápida en móvil.
 */
function sparkline(values, {height=44, padding=6}={}){
  const vals = (values||[]).map(v=>Number(v)||0);
  const nonZero = vals.filter(v=>v>0);
  if(nonZero.length < 2) return '';
  const min = Math.min(...nonZero);
  const max = Math.max(...nonZero);
  const span = Math.max(1e-6, max-min);

  const w = 240; // viewBox width (responsive por CSS)
  const h = height;
  const step = (w - padding*2) / (vals.length-1);

  const pts = vals.map((v,i)=>{
    const x = padding + step*i;
    const y = (v<=0) ? (h-padding) : (padding + (h-padding*2)*(1-((v-min)/span)));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `
  <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true" style="display:block;">
    <polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pts}" opacity=".9"></polyline>
  </svg>`;
}

export async function renderProgress(container,ctx){
  const { setSubtitle, db, store }=ctx;
  setSubtitle('Comparativo 📈');

  const routine=store.getRoutine();
  const settings=store.getSettings();
  const weeksTotal=routine?.program?.weeks||8;
  const currentWeek=getProgramWeek(settings.programStartDate,new Date(),weeksTotal);

  // Lista única de ejercicios (pueden repetirse en distintos días)
  const exList=(routine?.days||[]).flatMap(d=>d.exercises||[]);
  const unique=Array.from(new Map(exList.map(e=>[e.id,e])).values());

  container.innerHTML=`<div class="card"><div class="card__title">Progreso</div>
    <div class="meta">Elige un ejercicio y compara semanas (1–${weeksTotal}).</div>
    <div class="hr"></div>

    <label class="meta">Métrica</label>
    <select id="metricSel" class="input">
      <option value="e1rm">e1RM (fuerza estimada)</option>
      <option value="vol">Volumen semanal (kg)</option>
    </select>

    <div class="hr"></div>
    <label class="meta">Ejercicio</label>
    <select id="exSel" class="input">${unique.map(e=>`<option value="${e.id}">${e.name}</option>`).join('')}</select>

    <div id="progressOut" style="margin-top:12px;"></div>
  </div>`;

  const exSel=qs('#exSel');
  const metricSel=qs('#metricSel');
  const out=qs('#progressOut');

  async function renderFor(exId){
    const metric = metricSel.value;

    const logs=await db.listLogsByExercise(exId);
    const byWeek=new Map();
    for(const l of logs){
      if(!byWeek.has(l.week)) byWeek.set(l.week,[]);
      byWeek.get(l.week).push(l);
    }

    const rows=[];
    for(let w=1; w<=weeksTotal; w++){
      const entries=byWeek.get(w)||[];
      const allSets=entries.flatMap(e=>e.sets||[]);
      const b=bestSet(allSets);
      rows.push({
        week:w,
        best:b?`${b.weight}×${b.reps}`:'—',
        e1rm:b?b.e:0,
        vol:calcVolume(allSets),
      });
    }

    // Δ semana a semana según métrica seleccionada
    const rowsDelta=rows.map((r,i)=>{
      const val = metric==='vol' ? r.vol : r.e1rm;
      if(i===0) return {...r,val,delta:''};
      const prevVal = metric==='vol' ? rows[i-1].vol : rows[i-1].e1rm;
      if(prevVal<=0 || val<=0) return {...r,val,delta:''};
      const d=((val-prevVal)/prevVal)*100;
      const sign=d>=0?'▲':'▼';
      return {...r,val,delta:`${sign} ${fmt(Math.abs(d),1)}%`};
    });

    const last=rowsDelta[currentWeek-1]||rowsDelta[0];
    const prev=rowsDelta[Math.max(0,currentWeek-2)]||null;

    const label = metric==='vol' ? 'Volumen semanal' : 'e1RM';
    const unit  = metric==='vol' ? 'kg' : 'kg';
    const dec   = metric==='vol' ? 0 : 1;
    const trendVals = rowsDelta.map(r=>r.val||0);

    out.innerHTML=`<div class="card" style="margin:0;">
      <div class="row">
        <div>
          <div class="meta">Esta semana • ${label}</div>
          <div style="font-weight:900;font-size:22px;">${last?.val?fmt(last.val,dec)+' '+unit:'—'}</div>
        </div>
        <div>
          <div class="meta">Semana pasada</div>
          <div style="font-weight:900;font-size:22px;">${prev?.val?fmt(prev.val,dec)+' '+unit:'—'}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="meta"><b>Mejor set (semana actual):</b> ${last?.best||'—'}</div>
      <div class="meta" style="margin-top:4px;"><b>Δ (vs semana pasada):</b> ${last?.delta||'—'}</div>

      <div class="hr"></div>

      <div class="meta"><b>Tendencia</b></div>
      <div style="color:var(--accent); margin-top:6px;">
        ${sparkline(trendVals)}
      </div>

      <div class="hr"></div>

      <table class="table">
        <thead><tr><th>Semana</th><th>Mejor set</th><th>${label}</th><th>Δ</th></tr></thead>
        <tbody>
          ${rowsDelta.map(r=>`
            <tr>
              <td>${r.week}</td>
              <td>${r.best}</td>
              <td>${r.val?fmt(r.val,dec):'—'}</td>
              <td class="${r.delta.startsWith('▲')?'':'muted'}">${r.delta||''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  exSel.addEventListener('change',()=>renderFor(exSel.value));
  metricSel.addEventListener('change',()=>renderFor(exSel.value));

  await renderFor(unique[0]?.id || exSel.value);
}
