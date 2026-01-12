import { getProgramWeek, e1rmEpley } from '../../core/utils.js';

/**
 * Estado en memoria para navegar entre fechas/días sin URL.
 * - date: fecha de registro (YYYY-MM-DD)
 * - dayId: día de rutina seleccionado (id en routine.json)
 */
const state = { date: null, dayId: null };

const todayISO = () => new Date().toISOString().slice(0, 10);

function dateToWeekday(dateStr) {
  // JS: 0=Dom..6=Sáb -> 1..7 (Lun=1)
  const jsDay = new Date(dateStr + 'T00:00:00').getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function pickDayIdFromSchedule(routine, dateStr) {
  const wd = dateToWeekday(dateStr);
  const planned = routine?.schedule?.find(s => s.weekDay === wd) || routine?.schedule?.[0];
  return planned?.dayId || routine?.days?.[0]?.id || null;
}

/**
 * Detecta bloques tipo GIANT / superset cuando el nombre incluye dos movimientos.
 * Ej: "Giant set brazos (curl + tríceps) 💥"
 * Retorna [{id,name,label}] o null si no aplica.
 */
function splitMovementsFromName(ex) {
  const raw = (ex?.name || '').trim();
  const m = raw.match(/\(([^)]+)\)/); // contenido dentro de ()
  const inside = (m?.[1] || '').trim();

  // acepta "A + B" o "A / B" (y variantes con espacios)
  const parts = inside.split(/\s*[\+\/]\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  // Si el nombre completo no parece un bloque compuesto, no forzamos.
  // (pero en tu rutina este patrón se usa para giant/mini-series)
  return [
    { id: `${ex.id}__A`, name: parts[0], label: 'A' },
    { id: `${ex.id}__B`, name: parts[1], label: 'B' },
  ];
}

function bestSetFromLog(log) {
  if (!log?.sets?.length) return null;
  let best = null;
  for (const s of log.sets) {
    const e = e1rmEpley(s.weight, s.reps);
    if (!best || e > best.e) best = { ...s, e };
  }
  return best ? { weight: Number(best.weight) || 0, reps: Number(best.reps) || 0 } : null;
}

/**
 * Doble progresión (heurística simple):
 * - Si no llegas al tope del rango: sugiere +1 rep al mismo peso.
 * - Si ya tocaste el tope: sugiere subir ~2.5% y volver a rango bajo.
 */
function buildGoal({ repRange, bestSet }) {
  const [minR, maxR] = repRange;
  if (!bestSet) return `Apunta a ${minR}–${maxR} reps (RIR 1–2)`;

  const { weight, reps } = bestSet;
  if (reps < maxR) return `${weight} × ${Math.min(maxR, reps + 1)} (o más)`;

  const nextW = Math.round((weight * 1.025) * 2) / 2; // redondeo a 0.5 kg
  return `${nextW} × ${Math.max(minR, maxR - 2)}–${maxR}`;
}

function nextDayIdInSchedule(routine, currentDayId) {
  const sched = (routine?.schedule || []).slice().sort((a, b) => a.weekDay - b.weekDay);
  if (!sched.length) return routine?.days?.[0]?.id || null;

  const idx = sched.findIndex(s => s.dayId === currentDayId);
  const next = sched[(idx >= 0 ? idx + 1 : 0) % sched.length];
  return next?.dayId || sched[0]?.dayId || null;
}

function restTextOf(ex) {
  return Array.isArray(ex.restSec)
    ? (ex.restSec[0] === ex.restSec[1] ? `${ex.restSec[0]}s` : `${ex.restSec[0]}–${ex.restSec[1]}s`)
    : `${ex.restSec}s`;
}

async function computeSetsDone(db, date, exerciseId, setsTotal) {
  const log = await db.getLog(date, exerciseId);
  const done = log?.sets?.filter(s => (Number(s.reps) || 0) > 0 && (Number(s.weight) || 0) > 0).length || 0;
  return { log, done, total: setsTotal };
}

export async function renderToday(container, ctx) {
  const { setSubtitle, toast, modal, db, store } = ctx;
  const routine = store.getRoutine();
  const settings = store.getSettings();

  // init state
  if (!state.date) state.date = todayISO();
  if (!state.dayId) state.dayId = pickDayIdFromSchedule(routine, state.date);

  const weeksTotal = routine?.program?.weeks || 8;
  const week = getProgramWeek(settings.programStartDate, new Date(state.date + 'T00:00:00'), weeksTotal);

  const day = routine?.days?.find(d => d.id === state.dayId) || routine?.days?.[0];
  setSubtitle(`Semana ${week} • ${state.date}`);

  if (!day) {
    container.innerHTML = '<div class="card"><div class="card__title">Sin rutina</div><div class="meta">Edita data/routine.json</div></div>';
    return;
  }

  // selector options
  const dayOptions = (routine?.days || [])
    .map(d => `<option value="${d.id}" ${d.id === day.id ? 'selected' : ''}>${d.title}</option>`)
    .join('');

  // cards
  const cards = await Promise.all(day.exercises.map(async ex => {
    const tech = ex.techniqueId ? store.findTechniqueById(ex.techniqueId) : null;
    const repsText = `${ex.sets}×${ex.repRange[0]}–${ex.repRange[1]}`;
    const restText = restTextOf(ex);

    // Si es giant/superset -> dos movimientos (A/B)
    const movements = splitMovementsFromName(ex);

    if (movements) {
      // setsDone por movimiento
      const a = await computeSetsDone(db, state.date, movements[0].id, ex.sets);
      const b = await computeSetsDone(db, state.date, movements[1].id, ex.sets);

      // "Semana pasada" por movimiento (mejor set)
      const allA = await db.listLogsByExercise(movements[0].id);
      const lastA = allA.filter(l => l.date !== state.date).sort((x, y) => x.date < y.date ? 1 : -1)[0] || null;
      const bestA = bestSetFromLog(lastA);

      const allB = await db.listLogsByExercise(movements[1].id);
      const lastB = allB.filter(l => l.date !== state.date).sort((x, y) => x.date < y.date ? 1 : -1)[0] || null;
      const bestB = bestSetFromLog(lastB);

      const goalA = buildGoal({ repRange: ex.repRange, bestSet: bestA });
      const goalB = buildGoal({ repRange: ex.repRange, bestSet: bestB });

      return `
        <section class="card" data-ex="${ex.id}" data-giant="1">
          <div class="card__title">
            <span>${ex.name}</span>
            <span class="pills">
              ${tech ? `<span class="pill pill--accent2" data-tech="${tech.id}" title="Técnica">${tech.label}</span>` : `<span class="pill pill--muted">—</span>`}
              <span class="pill pill--muted" data-info="${ex.id}" title="Info">ⓘ</span>
            </span>
          </div>

          <div class="meta">${repsText} • Tempo <b>${ex.tempo}</b> • Desc <b>${restText}</b></div>

          <div class="hr"></div>

          <div class="meta"><b>${movements[0].label}:</b> ${movements[0].name} • Semana pasada: <b>${bestA ? `${bestA.weight}×${bestA.reps}` : '—'}</b></div>
          <div class="meta" style="margin-top:4px;color:var(--accent);font-weight:800;">Meta: ${goalA}</div>
          <div class="row" style="margin-top:8px;">
            <div class="pill">Sets: ${a.done}/${a.total}</div>
            <button class="btn btn--good" data-giantlog="${ex.id}" data-part="A">Registrar ${movements[0].name}</button>
          </div>

          <div class="hr"></div>

          <div class="meta"><b>${movements[1].label}:</b> ${movements[1].name} • Semana pasada: <b>${bestB ? `${bestB.weight}×${bestB.reps}` : '—'}</b></div>
          <div class="meta" style="margin-top:4px;color:var(--accent);font-weight:800;">Meta: ${goalB}</div>
          <div class="row" style="margin-top:8px;">
            <div class="pill">Sets: ${b.done}/${b.total}</div>
            <button class="btn btn--good" data-giantlog="${ex.id}" data-part="B">Registrar ${movements[1].name}</button>
          </div>

          <div class="hr"></div>
          <button class="btn" style="width:100%;" data-giantlog="${ex.id}" data-part="BOTH">Registrar ambos (giant set) 💥</button>
        </section>
      `;
    }

    // Normal exercise
    const logForDate = await db.getLog(state.date, ex.id);
    const setsDone = logForDate?.sets?.filter(s => (Number(s.reps) || 0) > 0 && (Number(s.weight) || 0) > 0).length || 0;

    const all = await db.listLogsByExercise(ex.id);
    const last = all.filter(l => l.date !== state.date).sort((a, b) => a.date < b.date ? 1 : -1)[0] || null;
    const bestSet = bestSetFromLog(last);
    const goal = buildGoal({ repRange: ex.repRange, bestSet });

    return `
      <section class="card" data-ex="${ex.id}">
        <div class="card__title">
          <span>${ex.name}</span>
          <span class="pills">
            ${tech ? `<span class="pill pill--accent2" data-tech="${tech.id}" title="Técnica">${tech.label}</span>` : `<span class="pill pill--muted">—</span>`}
            <span class="pill pill--muted" data-info="${ex.id}" title="Info">ⓘ</span>
          </span>
        </div>

        <div class="meta">${repsText} • Tempo <b>${ex.tempo}</b> • Desc <b>${restText}</b></div>
        <div class="meta" style="margin-top:8px;">Semana pasada: <b>${bestSet ? `${bestSet.weight}×${bestSet.reps}` : '—'}</b></div>
        <div class="meta" style="margin-top:4px;color:var(--accent);font-weight:800;">Meta: ${goal}</div>

        <div class="hr"></div>
        <div class="row">
          <div class="pill">Sets: ${setsDone}/${ex.sets}</div>
          <button class="btn btn--good" data-log="${ex.id}">+ Registrar set</button>
        </div>
      </section>
    `;
  }));

  container.innerHTML = `
    <div class="card">
      <div class="card__title">Registro 🗓️</div>
      <div class="meta">Registra cualquier fecha y cualquier día (si recorriste entrenos o quieres backfill).</div>
      <div class="hr"></div>

      <div class="row">
        <div style="flex:1;min-width:170px;">
          <label class="meta">Fecha</label>
          <input id="logDate" type="date" class="input" value="${state.date}" />
        </div>
        <div style="flex:2;min-width:240px;">
          <label class="meta">Día de rutina</label>
          <select id="daySel" class="input">${dayOptions}</select>
        </div>
      </div>

      <div class="row" style="margin-top:10px;">
        <button id="btnGoToday" class="btn btn--ghost">Ir a hoy</button>
        <button id="btnNextWorkout" class="btn">Siguiente entrenamiento ➜</button>
      </div>
    </div>

    <div class="card">
      <div class="card__title">Entreno seleccionado • ${day.title}</div>
      <div class="meta">Fecha: <b>${state.date}</b> • Semana <b>${week}</b></div>
    </div>

    ${cards.join('')}
  `;

  // date/day handlers
  const dateInput = container.querySelector('#logDate');
  const daySel = container.querySelector('#daySel');

  dateInput.addEventListener('change', async () => {
    const v = (dateInput.value || '').trim();
    if (!v) return;
    state.date = v;
    state.dayId = pickDayIdFromSchedule(routine, state.date);
    await renderToday(container, ctx);
  });

  daySel.addEventListener('change', async () => {
    state.dayId = daySel.value;
    await renderToday(container, ctx);
  });

  container.querySelector('#btnGoToday').addEventListener('click', async () => {
    state.date = todayISO();
    state.dayId = pickDayIdFromSchedule(routine, state.date);
    await renderToday(container, ctx);
  });

  container.querySelector('#btnNextWorkout').addEventListener('click', async () => {
    state.dayId = nextDayIdInSchedule(routine, state.dayId);
    await renderToday(container, ctx);
  });

  // technique modal
  container.querySelectorAll('[data-tech]').forEach(el => {
    el.addEventListener('click', () => {
      const tech = store.findTechniqueById(el.dataset.tech);
      if (!tech) return;
      modal.show({
        title: `${tech.emoji || '📚'} ${tech.label}`,
        content: `
          <div class="meta"><b>${tech.summary}</b></div>
          <div class="hr"></div>
          <div class="modal__text">${tech.howto.map(x => `• ${x}`).join('<br/>')}</div>
          <div class="hr"></div>
          <div class="meta"><b>Ejemplo:</b> ${tech.example}</div>
        `
      });
    });
  });

  // info modal
  container.querySelectorAll('[data-info]').forEach(el => {
    el.addEventListener('click', () => {
      modal.show({
        title: 'Cómo progresar 📈',
        content: `
          <div class="meta"><b>Doble progresión (simple):</b></div>
          <div class="modal__text">
            • Mantén el mismo peso y sube reps dentro del rango.<br/>
            • Cuando llegues al tope, sube 2.5–5% y regresa a reps bajas.<br/>
            • Mantén RIR 1–2 para consistencia.
          </div>
        `
      });
    });
  });

  // Normal log handler
  container.querySelectorAll('[data-log]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const exId = btn.dataset.log;
      const ex = day.exercises.find(e => e.id === exId);
      if (!ex) return;

      const log = await db.getLog(state.date, exId);
      const sets = (log?.sets?.length
        ? log.sets
        : Array.from({ length: ex.sets }, (_, i) => ({ setNo: i + 1, weight: 0, reps: 0, rir: null }))
      );

      modal.show({
        title: ex.name,
        content: `
          <div class="meta">${ex.sets}×${ex.repRange[0]}–${ex.repRange[1]} • Tempo <b>${ex.tempo}</b></div>
          <div class="meta" style="margin-top:6px;">Fecha: <b>${state.date}</b> • Semana <b>${week}</b></div>
          <div class="hr"></div>

          <table class="table">
            <thead><tr><th>Set</th><th>Kg</th><th>Reps</th><th>RIR</th></tr></thead>
            <tbody>
              ${sets.map(s => `
                <tr>
                  <td>${s.setNo}</td>
                  <td><input class="input input--sm" inputmode="decimal" data-w="${s.setNo}" value="${s.weight || ''}" placeholder="0" /></td>
                  <td><input class="input input--sm" inputmode="numeric" data-r="${s.setNo}" value="${s.reps || ''}" placeholder="0" /></td>
                  <td><input class="input input--sm" inputmode="numeric" data-ir="${s.setNo}" value="${s.rir ?? ''}" placeholder="-" /></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="hr"></div>
          <button id="saveLogBtn" class="btn btn--good" style="width:100%;">Guardar ✅</button>
        `,
        onMount: () => {
          document.querySelector('#saveLogBtn').addEventListener('click', async () => {
            const nextSets = sets.map(s => {
              const w = document.querySelector(`[data-w="${s.setNo}"]`)?.value || '0';
              const r = document.querySelector(`[data-r="${s.setNo}"]`)?.value || '0';
              const ir = document.querySelector(`[data-ir="${s.setNo}"]`)?.value || '';
              return {
                setNo: s.setNo,
                weight: Number(String(w).replace(',', '.')) || 0,
                reps: Number(r) || 0,
                rir: ir === '' ? null : (Number(ir) || null),
              };
            });

            await db.saveLog({ date: state.date, week, dayId: day.id, exerciseId: exId, sets: nextSets });

            modal.hide();
            toast.show({
              title: 'Guardado ✅',
              message: `Registro guardado para ${state.date}.`,
              actions: [{ label: 'OK', variant: 'ghost', onClick: () => toast.hide() }]
            });

            await renderToday(container, ctx);
          });
        }
      });
    });
  });

  // GIANT/superset handlers
  container.querySelectorAll('[data-giantlog]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const exId = btn.dataset.giantlog;
      const part = btn.dataset.part; // A, B, BOTH
      const ex = day.exercises.find(e => e.id === exId);
      if (!ex) return;

      const moves = splitMovementsFromName(ex);
      if (!moves) return;

      const idA = moves[0].id, nameA = moves[0].name;
      const idB = moves[1].id, nameB = moves[1].name;

      // logs por movimiento (mismo #sets)
      const logA = await db.getLog(state.date, idA);
      const logB = await db.getLog(state.date, idB);

      const baseSets = Array.from({ length: ex.sets }, (_, i) => ({ setNo: i + 1 }));
      const setsA = (logA?.sets?.length ? logA.sets : baseSets.map(s => ({ ...s, weight: 0, reps: 0, rir: null })));
      const setsB = (logB?.sets?.length ? logB.sets : baseSets.map(s => ({ ...s, weight: 0, reps: 0, rir: null })));

      const restText = restTextOf(ex);

      // Modal de registro:
      // - Si part=A o part=B: muestra una sola tabla.
      // - Si part=BOTH: muestra ambos dentro del mismo modal (por set).
      if (part === 'A' || part === 'B') {
        const which = part === 'A' ? { id: idA, name: nameA, sets: setsA } : { id: idB, name: nameB, sets: setsB };

        modal.show({
          title: `${ex.name} • ${which.name}`,
          content: `
            <div class="meta">${ex.sets}×${ex.repRange[0]}–${ex.repRange[1]} • Tempo <b>${ex.tempo}</b> • Desc <b>${restText}</b></div>
            <div class="meta" style="margin-top:6px;">Fecha: <b>${state.date}</b> • Semana <b>${week}</b></div>
            <div class="hr"></div>

            <table class="table">
              <thead><tr><th>Set</th><th>Kg</th><th>Reps</th><th>RIR</th></tr></thead>
              <tbody>
                ${which.sets.map(s => `
                  <tr>
                    <td>${s.setNo}</td>
                    <td><input class="input input--sm" inputmode="decimal" data-w="${s.setNo}" value="${s.weight || ''}" placeholder="0" /></td>
                    <td><input class="input input--sm" inputmode="numeric" data-r="${s.setNo}" value="${s.reps || ''}" placeholder="0" /></td>
                    <td><input class="input input--sm" inputmode="numeric" data-ir="${s.setNo}" value="${s.rir ?? ''}" placeholder="-" /></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="hr"></div>
            <button id="saveGiantOne" class="btn btn--good" style="width:100%;">Guardar ${which.name} ✅</button>
          `,
          onMount: () => {
            document.querySelector('#saveGiantOne').addEventListener('click', async () => {
              const nextSets = which.sets.map(s => {
                const w = document.querySelector(`[data-w="${s.setNo}"]`)?.value || '0';
                const r = document.querySelector(`[data-r="${s.setNo}"]`)?.value || '0';
                const ir = document.querySelector(`[data-ir="${s.setNo}"]`)?.value || '';
                return {
                  setNo: s.setNo,
                  weight: Number(String(w).replace(',', '.')) || 0,
                  reps: Number(r) || 0,
                  rir: ir === '' ? null : (Number(ir) || null),
                };
              });

              await db.saveLog({ date: state.date, week, dayId: day.id, exerciseId: which.id, sets: nextSets });

              modal.hide();
              toast.show({
                title: 'Guardado ✅',
                message: `${which.name} guardado para ${state.date}.`,
                actions: [{ label: 'OK', variant: 'ghost', onClick: () => toast.hide() }]
              });

              await renderToday(container, ctx);
            });
          }
        });

        return;
      }

      // BOTH: un solo modal para capturar A y B por set (independiente)
      modal.show({
        title: `${ex.name} 💥 (A+B)`,
        content: `
          <div class="meta">${ex.sets}×${ex.repRange[0]}–${ex.repRange[1]} • Tempo <b>${ex.tempo}</b> • Desc <b>${restText}</b></div>
          <div class="meta" style="margin-top:6px;">Fecha: <b>${state.date}</b> • Semana <b>${week}</b></div>
          <div class="hr"></div>

          <div class="meta"><b>A:</b> ${nameA}</div>
          <div class="meta" style="margin-top:6px;"><b>B:</b> ${nameB}</div>

          <div class="hr"></div>

          ${baseSets.map(s => `
            <div class="card" style="margin:10px 0;background:rgba(26,32,50,.55);border:1px solid rgba(235,239,247,.10)">
              <div class="row"><div class="pill">Set ${s.setNo}</div><div class="pill pill--muted">A → B</div></div>
              <div class="hr"></div>

              <div class="meta"><b>A: ${nameA}</b></div>
              <div class="row" style="margin-top:6px;">
                <input class="input" style="flex:1;min-width:120px;" inputmode="decimal" data-aw="${s.setNo}" value="${setsA[s.setNo-1]?.weight || ''}" placeholder="Kg" />
                <input class="input" style="flex:1;min-width:120px;" inputmode="numeric" data-ar="${s.setNo}" value="${setsA[s.setNo-1]?.reps || ''}" placeholder="Reps" />
                <input class="input" style="flex:1;min-width:120px;" inputmode="numeric" data-air="${s.setNo}" value="${setsA[s.setNo-1]?.rir ?? ''}" placeholder="RIR" />
              </div>

              <div class="hr"></div>

              <div class="meta"><b>B: ${nameB}</b></div>
              <div class="row" style="margin-top:6px;">
                <input class="input" style="flex:1;min-width:120px;" inputmode="decimal" data-bw="${s.setNo}" value="${setsB[s.setNo-1]?.weight || ''}" placeholder="Kg" />
                <input class="input" style="flex:1;min-width:120px;" inputmode="numeric" data-br="${s.setNo}" value="${setsB[s.setNo-1]?.reps || ''}" placeholder="Reps" />
                <input class="input" style="flex:1;min-width:120px;" inputmode="numeric" data-bir="${s.setNo}" value="${setsB[s.setNo-1]?.rir ?? ''}" placeholder="RIR" />
              </div>
            </div>
          `).join('')}

          <div class="hr"></div>
          <button id="saveGiantBoth" class="btn btn--good" style="width:100%;">Guardar giant set ✅</button>
        `,
        onMount: () => {
          document.querySelector('#saveGiantBoth').addEventListener('click', async () => {
            const nextA = baseSets.map(s => {
              const w = document.querySelector(`[data-aw="${s.setNo}"]`)?.value || '0';
              const r = document.querySelector(`[data-ar="${s.setNo}"]`)?.value || '0';
              const ir = document.querySelector(`[data-air="${s.setNo}"]`)?.value || '';
              return {
                setNo: s.setNo,
                weight: Number(String(w).replace(',', '.')) || 0,
                reps: Number(r) || 0,
                rir: ir === '' ? null : (Number(ir) || null),
              };
            });

            const nextB = baseSets.map(s => {
              const w = document.querySelector(`[data-bw="${s.setNo}"]`)?.value || '0';
              const r = document.querySelector(`[data-br="${s.setNo}"]`)?.value || '0';
              const ir = document.querySelector(`[data-bir="${s.setNo}"]`)?.value || '';
              return {
                setNo: s.setNo,
                weight: Number(String(w).replace(',', '.')) || 0,
                reps: Number(r) || 0,
                rir: ir === '' ? null : (Number(ir) || null),
              };
            });

            await Promise.all([
              db.saveLog({ date: state.date, week, dayId: day.id, exerciseId: idA, sets: nextA }),
              db.saveLog({ date: state.date, week, dayId: day.id, exerciseId: idB, sets: nextB }),
            ]);

            modal.hide();
            toast.show({
              title: 'Guardado ✅',
              message: `Giant set guardado (A+B) para ${state.date}.`,
              actions: [{ label: 'OK', variant: 'ghost', onClick: () => toast.hide() }]
            });

            await renderToday(container, ctx);
          });
        }
      });
    });
  });
}
