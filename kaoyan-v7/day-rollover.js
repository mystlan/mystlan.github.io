(()=>{
  if(typeof state==='undefined'||typeof save!=='function'||typeof todayKey!=='function')return;
  const current=todayKey();
  const prevDate=state.generatedDate;
  if(!prevDate||prevDate===current)return;

  const generated=(state.generatedTasks||[]).filter(t=>t&&t.id);
  const custom=(state.customTasks||[]).filter(t=>!t.date||t.date===prevDate);
  const tasks=[...generated,...custom].map(t=>({...t,status:state.taskStatus?.[t.id]||'todo'}));

  if(!state.daily)state.daily={};
  if(!state.daily[prevDate]&&tasks.length){
    state.daily[prevDate]={
      shift:state.shift||'late',
      actualHours:'',mathQa:'',csQa:'',wordMinutes:'',dayBlock:'',dayEnergy:'',
      tasks,
      autoArchived:true,
      archivedAt:new Date().toISOString()
    };
  }

  // Carry unresolved custom tasks forward as candidates, but do not duplicate generated tasks.
  const carryStatuses=new Set(['delay','partial','stuck','todo']);
  const existingToday=new Set((state.customTasks||[]).filter(t=>t.date===current).map(t=>`${t.subject}|${t.title}`));
  for(const t of tasks){
    if(!carryStatuses.has(t.status)||t.generated||t.autoReview)continue;
    const key=`${t.subject}|${t.title}`;
    if(existingToday.has(key))continue;
    state.customTasks.push({...t,id:`carry-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:current,carriedFrom:prevDate});
    existingToday.add(key);
  }

  save();
})();