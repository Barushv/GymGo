export const store=(()=>{const s={routine:null,techniques:[],settings:{programStartDate:null}};return{
getRoutine:()=>s.routine,setRoutine:r=>{s.routine=r},
getTechniques:()=>s.techniques,setTechniques:t=>{s.techniques=t||[]},
getSettings:()=>s.settings,setSettings:x=>{s.settings={...s.settings,...(x||{})}},
findTechniqueById:id=>s.techniques.find(t=>t.id===id)||null
}})();
