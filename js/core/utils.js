export function getProgramWeek(startDate,date=new Date(),weeksTotal=8){
if(!startDate) return 1;
const start=new Date(startDate+'T00:00:00');
const ms=date.getTime()-start.getTime();
const w=Math.floor(ms/(7*24*60*60*1000))+1;
return Math.max(1,Math.min(weeksTotal,w));
}
export function e1rmEpley(weight,reps){
const w=Number(weight)||0,r=Number(reps)||0;
if(w<=0||r<=0) return 0;
return w*(1+(r/30));
}
export function calcVolume(sets){
return (sets||[]).reduce((a,s)=>a+((Number(s.weight)||0)*(Number(s.reps)||0)),0);
}
export function fmt(n,dec=1){
const v=Number(n)||0;
return v.toLocaleString('es-MX',{maximumFractionDigits:dec,minimumFractionDigits:dec});
}
