export function registerServiceWorker({onUpdateAvailable}={}){
if(!('serviceWorker' in navigator)) return;
window.addEventListener('load',async ()=>{
try{
const reg=await navigator.serviceWorker.register('/service-worker.js');
if(reg.waiting) onUpdateAvailable?.();
reg.addEventListener('updatefound',()=>{
const installing=reg.installing; if(!installing) return;
installing.addEventListener('statechange',()=>{
if(installing.state==='installed' && navigator.serviceWorker.controller) onUpdateAvailable?.();
});
});
}catch(e){console.warn('SW error:',e);}
});
}
