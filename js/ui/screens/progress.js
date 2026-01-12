import { e1rmEpley, calcVolume, fmt, getProgramWeek } from '../../core/utils.js';
import { qs } from '../../core/dom.js';

function bestSet(sets) {
  let best = null;
  for (const s of (sets || [])) {
    const e = e1rmEpley(s.weight, s.reps);
    if (!best || e > best.e) best = { ...s, e };
  }
  return best;
}

function splitMovementsFromName(ex) {
  const raw = (ex?.name || '').trim();
  const m = raw.match(/\(([^)]+)\)/);
  const inside = (m?.[1] || '').trim();
  const parts = inside.split(/\s*[\+\/]\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  // display base name sin el paréntesis para que se lea pro
  const base = raw.replace(/\s*\([^)]*\)\s*/, ' ').replace(/\s+/g, ' ').trim();
  return [
    { id: `${ex.id}__A`, name: `${base} → ${parts[0]}` },
    { id: `${ex.id}__B`, name: `${base} → ${parts[1]}` },
  ];
}

export async function renderProgress(container, ctx) {
  const { setSubtitle, db, store } = ctx;
  setSubtitle('Mini Cut 8 semanas');

  const routine = store.getRoutine();
  const settings = store.getSettings();
  const weeksTotal = routine?.program?.weeks || 8;
  const currentWeek = getProgramWeek(settings.programStartDate, new Date(), weeksTotal);

  // Construye lista de ejercicios para selector.
  // Si detecta "A + B", crea dos entradas virtuales: exId__A y exId__B
  const exList = (routine?.days || []).flatMap(d => d.exercises || []);
  const virtual = [];
  for (const ex of exList) {
    const split = splitMovementsFromName(ex);
    if (split) virtual.push(...split);
    else virtual.push({ id: ex.id, name: ex.name });
  }
  const unique = Array.from(new Map(virtual.map(e => [e.id, e])).values());

  container.innerHTML = `
    <div class="card">
      <div class="card__title">Progreso</div>
      <div class="meta">Elige un ejercicio y compara semanas (1–${weeksTotal}).</div>
      <div class="hr"></div>

      <div class="row">
        <div class="pills">
          <span class="pill pill--accent">Métrica: e1RM / Volumen</span>
          <span class="pill pill--muted">Semana actual: ${currentWeek}</span>
        </div>
      </div>

      <div class="hr"></div>

      <label class="meta">Métrica</label>
      <select id="metricSel" class="input">
        <option value="e1rm">e1RM (kg estimados)</option>
        <option value="vol">Volumen semanal (kg)</option>
      </select>

      <div style="height:10px"></div>

      <label class="meta">Ejercicio</label>
      <select id="exSel" class="input">${unique.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select>

      <div id="progressOut" style="margin-top:12px;"></div>
    </div>
  `;

  const exSel = qs('#exSel');
  const metricSel = qs('#metricSel');
  const out = qs('#progressOut');

  function spark(values) {
    // Sparkline ultra simple (texto) para no meter libs.
    const v = values.map(x => Number(x) || 0);
    const max = Math.max(...v, 0);
    if (max <= 0) return '—';
    const bars = '▁▂▃▄▅▆▇█';
    return v.map(x => bars[Math.min(bars.length - 1, Math.floor((x / max) * (bars.length - 1))) ]).join('');
  }

  async function renderFor(exId, metric) {
    const logs = await db.listLogsByExercise(exId);
    const byWeek = new Map();
    for (const l of logs) {
      if (!byWeek.has(l.week)) byWeek.set(l.week, []);
      byWeek.get(l.week).push(l);
    }

    const rows = [];
    for (let w = 1; w <= weeksTotal; w++) {
      const entries = byWeek.get(w) || [];
      const allSets = entries.flatMap(e => e.sets || []);
      const b = bestSet(allSets);
      const e1 = b ? b.e : 0;
      const vol = calcVolume(allSets);

      rows.push({
        week: w,
        best: b ? `${b.weight}×${b.reps}` : '—',
        e1rm: e1,
        vol
      });
    }

    const series = rows.map(r => metric === 'vol' ? r.vol : r.e1rm);
    const rowsDelta = rows.map((r, i) => {
      const cur = metric === 'vol' ? r.vol : r.e1rm;
      const prev = i > 0 ? (metric === 'vol' ? rows[i - 1].vol : rows[i - 1].e1rm) : 0;
      if (!prev || !cur) return { ...r, delta: '' };
      const d = ((cur - prev) / prev) * 100;
      const sign = d >= 0 ? '▲' : '▼';
      return { ...r, delta: `${sign} ${fmt(Math.abs(d), 1)}%` };
    });

    const curRow = rowsDelta[currentWeek - 1] || rowsDelta[0];
    const prevRow = rowsDelta[Math.max(0, currentWeek - 2)] || null;

    const metricLabel = metric === 'vol' ? 'Volumen' : 'e1RM';
    const curVal = metric === 'vol' ? curRow?.vol : curRow?.e1rm;
    const prevVal = prevRow ? (metric === 'vol' ? prevRow.vol : prevRow.e1rm) : 0;

    out.innerHTML = `
      <div class="card" style="margin:0;">
        <div class="row">
          <div>
            <div class="meta">Esta semana • ${metricLabel}</div>
            <div style="font-weight:900;font-size:22px;">${curVal ? fmt(curVal, metric === 'vol' ? 0 : 1) + ' kg' : '—'}</div>
          </div>
          <div>
            <div class="meta">Semana pasada • ${metricLabel}</div>
            <div style="font-weight:900;font-size:22px;">${prevVal ? fmt(prevVal, metric === 'vol' ? 0 : 1) + ' kg' : '—'}</div>
          </div>
        </div>

        <div class="hr"></div>
        <div class="meta"><b>Tendencia:</b> ${spark(series)}</div>
        <div class="hr"></div>

        <table class="table">
          <thead><tr><th>Semana</th><th>Mejor set</th><th>${metricLabel}</th><th>Δ</th></tr></thead>
          <tbody>
            ${rowsDelta.map(r => {
              const v = metric === 'vol' ? r.vol : r.e1rm;
              return `<tr>
                <td>${r.week}</td>
                <td>${r.best}</td>
                <td>${v ? fmt(v, metric === 'vol' ? 0 : 1) : '—'}</td>
                <td class="${r.delta.startsWith('▲') ? '' : 'muted'}">${r.delta || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const rerender = () => renderFor(exSel.value, metricSel.value);

  exSel.addEventListener('change', rerender);
  metricSel.addEventListener('change', rerender);

  await rerender();
}
