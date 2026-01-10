import { registerServiceWorker } from './sw/register-sw.js';
import { db } from './core/db.js';
import { store } from './core/store.js';
import { qs, qsa } from './core/dom.js';
import { toast } from './ui/toast.js';
import { modal } from './ui/modal.js';

import { renderToday } from './ui/screens/today.js';
import { renderWeek } from './ui/screens/week.js';
import { renderProgress } from './ui/screens/progress.js';
import { renderTechniques } from './ui/screens/techniques.js';

const APP_VERSION = '0.2.0';
const BUILD_DATE = '2026-01-09';

const view = qs('#view');
const subtitle = qs('#appSubtitle');

function setSubtitle(text) { subtitle.textContent = text; }

const screens = { today: renderToday, week: renderWeek, progress: renderProgress, tech: renderTechniques };

function setActiveTab(tabId) {
  qsa('.tab').forEach(btn => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle('tab--active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

async function navigate(tabId) {
  setActiveTab(tabId);
  const render = screens[tabId] || screens.today;
  await render(view, { setSubtitle, toast, modal, db, store });
}

async function loadStaticData() {
  // Datos estáticos de rutina/técnicas (actualizables sin build).
  const [routine, techniques] = await Promise.all([
    fetch(`data/routine.json?v=${APP_VERSION}`).then(r => r.json()),
    fetch(`data/techniques.json?v=${APP_VERSION}`).then(r => r.json()),
  ]);
  store.setRoutine(routine);
  store.setTechniques(techniques);
}

async function init() {
  await db.init();
  await loadStaticData();

  // Inicializa settings si no existe
  const s = await db.getSettings();
  if (!s.programStartDate) await db.setSettings({ programStartDate: new Date().toISOString().slice(0,10) });
  store.setSettings(await db.getSettings());

  await navigate('today');
}

qsa('.tab').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.tab)));

qs('#btnSettings').addEventListener('click', async () => {
  const s = await db.getSettings();
  modal.show({
    title: 'Ajustes ⚙️',
    content: `
      <div class="meta">Versión: <b>${APP_VERSION}</b> • Build: <b>${BUILD_DATE}</b></div>
      <div class="hr"></div>
      <label class="meta">Inicio del programa (YYYY-MM-DD)</label>
      <input id="startDateInput" class="input" value="${s.programStartDate || ''}" placeholder="2026-01-09" />
      <div class="meta" style="margin-top:10px;">Se usa para calcular semana 1–8 y el comparativo 📈.</div>
      <div class="hr"></div>
      <button id="btnSaveSettings" class="btn btn--good" style="width:100%;">Guardar</button>
    `,
    onMount: () => {
      const input = document.querySelector('#startDateInput');
      document.querySelector('#btnSaveSettings').addEventListener('click', async () => {
        const v = (input.value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          toast.show({ title:'Formato inválido', message:'Usa YYYY-MM-DD (ej. 2026-01-09).', actions:[{label:'OK',variant:'ghost',onClick:()=>toast.hide()}] });
          return;
        }
        await db.setSettings({ programStartDate: v });
        store.setSettings(await db.getSettings());
        modal.hide();
        toast.show({ title:'Guardado ✅', message:'Listo. El comparativo usará esa fecha.', actions:[{label:'OK',variant:'ghost',onClick:()=>toast.hide()}] });
      });
    }
  });
});

registerServiceWorker({
  onUpdateAvailable: () => toast.show({
    title:'Actualización disponible',
    message:'Hay una nueva versión lista. Recarga para aplicarla.',
    actions:[
      {label:'Recargar',variant:'good',onClick:()=>window.location.reload()},
      {label:'Luego',variant:'ghost',onClick:()=>toast.hide()}
    ]
  })
});

init().catch(err => {
  console.error(err);
  toast.show({
    title:'Error al iniciar',
    message:'Revisa consola. Tip: corre con Live Server o localhost.',
    actions:[{label:'OK',variant:'ghost',onClick:()=>toast.hide()}]
  });
});
