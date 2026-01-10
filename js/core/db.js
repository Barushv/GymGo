const DB_NAME='progressrunner-db',DB_VERSION=1;
export const db=(()=>{let _db=null;
function open(){return new Promise((res,rej)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);
req.onupgradeneeded=()=>{const d=req.result;
if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'id'});
if(!d.objectStoreNames.contains('logs')){const s=d.createObjectStore('logs',{keyPath:'key'});
s.createIndex('byExercise','exerciseId',{unique:false});
s.createIndex('byWeek','week',{unique:false});
s.createIndex('byDate','date',{unique:false});
}};
req.onsuccess=()=>{_db=req.result;res(_db)};
req.onerror=()=>rej(req.error);
})}
function tx(name,mode='readonly'){return _db.transaction(name,mode).objectStore(name)}
async function init(){if(_db) return; await open(); const s=await getSettings(); if(!s?.id) await tx('settings','readwrite').put({id:'singleton',programStartDate:null});}
async function getSettings(){return new Promise((res,rej)=>{const req=tx('settings').get('singleton'); req.onsuccess=()=>res(req.result||{id:'singleton',programStartDate:null}); req.onerror=()=>rej(req.error);})}
async function setSettings(patch){const cur=await getSettings(); const next={...cur,...(patch||{})}; return new Promise((res,rej)=>{const req=tx('settings','readwrite').put(next); req.onsuccess=()=>res(next); req.onerror=()=>rej(req.error);})}
async function saveLog(entry){const key=`${entry.date}|${entry.exerciseId}`; const payload={...entry,key}; return new Promise((res,rej)=>{const req=tx('logs','readwrite').put(payload); req.onsuccess=()=>res(payload); req.onerror=()=>rej(req.error);})}
async function getLog(date,exerciseId){const key=`${date}|${exerciseId}`; return new Promise((res,rej)=>{const req=tx('logs').get(key); req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);})}
async function listLogsByExercise(exerciseId){return new Promise((res,rej)=>{const idx=tx('logs').index('byExercise'); const req=idx.getAll(exerciseId); req.onsuccess=()=>res(req.result||[]); req.onerror=()=>rej(req.error);})}
return{init,getSettings,setSettings,saveLog,getLog,listLogsByExercise};
})();
