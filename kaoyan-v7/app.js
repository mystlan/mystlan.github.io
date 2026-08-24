const APP_KEY='kaoyan_v7_state';
const state=JSON.parse(localStorage.getItem(APP_KEY)||'{"taskStatus":{},"customTasks":[],"daily":{},"chapter":{},"shift":"late","generatedTasks":[],"generatedDate":"","planMeta":{}}');
state.taskStatus=state.taskStatus||{};state.customTasks=state.customTasks||[];state.daily=state.daily||{};state.chapter=state.chapter||{};state.shift=state.shift||'late';state.generatedTasks=state.generatedTasks||[];state.generatedDate=state.generatedDate||'';state.planMeta=state.planMeta||{};
const save=()=>localStorage.setItem(APP_KEY,JSON.stringify(state));
let todayConfig=null, progressConfig=null, planConfig=null, activeMap='math', loadedMaps={};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

async function getJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path);return r.json();}
async function boot(){
  [todayConfig,progressConfig,planConfig]=await Promise.all([getJson('./data/today.json'),getJson('./data/progress.json'),getJson('./data/plans.json')]);
  renderCountdown();
  if(!state.generatedTasks.length||state.generatedDate!==todayKey())generatePlan(false);
  renderPlanner();renderSubjects();renderToday();renderHistory();renderReview();bind();
}
function bind(){
  $$('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view,b)));
  $$('.map-tab').forEach(b=>b.addEventListener('click',()=>{activeMap=b.dataset.map;$$('.map-tab').forEach(x=>x.classList.toggle('active',x===b));loadMap(activeMap)}));
  $('#expandAll').addEventListener('click',()=>$$('#mapMain details').forEach(d=>d.open=true));
  $('#collapseAll').addEventListener('click',()=>$$('#mapMain details').forEach(d=>d.open=false));
  $('#addTask').addEventListener('click',addTask); $('#saveDay').addEventListener('click',saveDay);
  $('#shiftSelect').value=state.shift;
  $('#shiftSelect').addEventListener('change',()=>{state.shift=$('#shiftSelect').value;save();generatePlan(true)});
  $('#generatePlan').addEventListener('click',()=>generatePlan(true));
}
function daysLeft(){const [y,m,d]=planConfig.targetDate.split('-').map(Number),target=Date.UTC(y,m-1,d),now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());return Math.max(0,Math.ceil((target-today)/86400000))}
function stageByDays(days){if(days>90)return ['基础重建','先把数学/408主干跑起来'];if(days>60)return ['第一轮完成','覆盖主干章节并开始复习闭环'];if(days>35)return ['强化刷题','正确率与薄弱点优先'];if(days>14)return ['真题训练','专题与套卷并行'];return ['冲刺回炉','只保留高频错点和真题回看']}
function renderCountdown(){
  const days=daysLeft();$('#countdownDays').textContent=days;$('#targetDateLabel').textContent=`目标日 ${planConfig.targetDate}`;
  const stage=stageByDays(days),box=$('.stage-box');if(box){const strong=box.querySelector('strong'),small=box.querySelector('small');if(strong)strong.textContent=stage[0];if(small)small.textContent=stage[1]}
}
function switchView(v,b){$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.add('hidden'));$('#view-'+v).classList.remove('hidden');if(v==='map'&&!loadedMaps[activeMap])loadMap(activeMap)}
function renderSubjects(){const el=$('#subjectCards');el.innerHTML=progressConfig.subjects.map(s=>`<div class="metric"><span>${s.name}</span><b>${s.percent}%</b><small>${s.note}</small></div>`).join('')}
function plannerTasks(){return state.generatedTasks.length?state.generatedTasks:todayConfig.tasks}
function allTasks(){const d=todayKey();return [...plannerTasks(),...state.customTasks.filter(t=>!t.date||t.date===d)]}

function parseRatio(v){if(!v)return null;const m=String(v).match(/(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)/);if(!m)return null;const a=Number(m[1]),b=Number(m[2]);if(b<=0)return null;return clamp(a/b,0,1)}
function recentRecords(limit=7){return Object.entries(state.daily).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,limit)}
function weightedCompletion(tasks=[]){if(!tasks.length)return null;const score=tasks.reduce((s,t)=>s+({done:1,partial:.6,stuck:.35,delay:.1,todo:0}[t.status]??0),0);return score/tasks.length}
function latestStuck(subject){const rows=recentRecords(7);for(const [,d] of rows){const hit=(d.tasks||[]).find(t=>t.subject===subject&&t.status==='stuck');if(hit)return hit.title}return ''}
function avgAccuracy(field){const vals=recentRecords(7).map(([,d])=>parseRatio(d[field])).filter(v=>v!==null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}
function subjectMinutes(){const total={数学:0,'408':0,英语:0,政治:0};recentRecords(7).forEach(([,d])=>(d.tasks||[]).forEach(t=>{if(total[t.subject]===undefined)return;const factor=({done:1,partial:.7,stuck:.45,delay:.15,todo:0}[t.status]??0);total[t.subject]+=(Number(t.minutes)||0)*factor}));return total}
function analyzeLearning(){
  const rows=recentRecords(7),last=rows[0]?.[1]||null,allRecentTasks=rows.flatMap(([,d])=>d.tasks||[]),completion=weightedCompletion(allRecentTasks),mathAcc=avgAccuracy('mathQa'),csAcc=avgAccuracy('csQa'),mins=subjectMinutes();
  const totalCore=mins.数学+mins['408']||1,mathShare=mins.数学/totalCore,csShare=mins['408']/totalCore;
  let priority='数学',reason='当前基础阶段默认数学优先';
  const mathStuck=latestStuck('数学'),csStuck=latestStuck('408');
  if(csStuck&&!mathStuck){priority='408';reason='最近408出现卡点'}
  if(mathStuck&&!csStuck){priority='数学';reason='最近数学出现卡点'}
  if(mathAcc!==null&&mathAcc<.6){priority='数学';reason=`数学近7天正确率约 ${Math.round(mathAcc*100)}%`}
  if(csAcc!==null&&csAcc<.6&&!(mathAcc!==null&&mathAcc<.5)){priority='408';reason=`408近7天正确率约 ${Math.round(csAcc*100)}%`}
  if(!mathStuck&&!csStuck&&mathAcc!==null&&csAcc!==null&&mathAcc>=.6&&csAcc>=.6){if(mathShare<.52){priority='数学';reason='最近数学投入偏少'}else if(csShare<.38){priority='408';reason='最近408投入偏少'}}
  let intensity=1,intensityReason='维持标准强度';
  if(last&&['很差','疲惫'].includes(last.dayEnergy)){intensity=.82;intensityReason=`昨日状态${last.dayEnergy}，主动降载`}
  else if(completion!==null&&completion<.5){intensity=.82;intensityReason=`近7天任务兑现率约 ${Math.round(completion*100)}%，先降载保执行`}
  else if(completion!==null&&completion<.68){intensity=.9;intensityReason=`近7天任务兑现率约 ${Math.round(completion*100)}%，小幅降载`}
  else if(last?.dayEnergy==='很好'&&completion!==null&&completion>.85){intensity=1.05;intensityReason='状态与兑现率都较好，小幅加量'}
  const reasons=[];
  if(!rows.length)reasons.push('暂无历史数据：先按班次基础模板启动');
  else{reasons.push(`近7天兑现率 ${completion===null?'—':Math.round(completion*100)+'%'}`);reasons.push(`数学正确率 ${mathAcc===null?'—':Math.round(mathAcc*100)+'%'}`);reasons.push(`408正确率 ${csAcc===null?'—':Math.round(csAcc*100)+'%'}`);reasons.push(`优先补强：${priority}（${reason}）`);reasons.push(intensityReason)}
  return {rows,last,completion,mathAcc,csAcc,priority,reason,intensity,intensityReason,mathStuck,csStuck,reasons};
}
function adaptSlots(profile,analysis){
  let slots=profile.slots.map(s=>({...s}));
  const firstMath=slots.findIndex(s=>s.subject==='数学'),firstCs=slots.findIndex(s=>s.subject==='408');
  if(firstMath>=0){
    if(analysis.mathStuck)slots[firstMath].title=`回炉：${analysis.mathStuck}`;
    else if(analysis.mathAcc!==null&&analysis.mathAcc<.65)slots[firstMath].title='数学低正确率回炉 + 6–8道基础题';
    else if(analysis.priority==='数学')slots[firstMath].title='当前数学主线推进（今日优先）';
  }
  if(firstCs>=0){
    if(analysis.csStuck)slots[firstCs].title=`回炉：${analysis.csStuck}`;
    else if(analysis.csAcc!==null&&analysis.csAcc<.65)slots[firstCs].title='408低正确率回炉 + 对应基础练习';
    else if(analysis.priority==='408')slots[firstCs].title='当前408主线推进（今日优先）';
  }
  slots=slots.map(s=>({...s,minutes:Math.max(s.subject==='复盘'?10:15,Math.round(s.minutes*analysis.intensity/5)*5)}));
  if(analysis.intensity<.9&&state.shift==='rest'){
    let dropped=false;slots=slots.filter(s=>{if(!dropped&&s.subject==='数学'&&/薄弱点|回炉/.test(s.title)){dropped=true;return false}return true});
  }
  const days=daysLeft();
  if(days<=90&&!slots.some(s=>s.subject==='政治')){
    if(state.shift==='rest')slots.splice(Math.max(0,slots.length-1),0,{time:'晚间 20–30min',subject:'政治',title:'政治主线轻量启动 / 选择题',minutes:30});
    else if(days<=60&&state.shift!=='lowEnergy')slots.splice(Math.max(0,slots.length-1),0,{time:'碎片 20min',subject:'政治',title:'政治选择题 / 高频点',minutes:20});
  }
  const review=slots.find(s=>s.subject==='复盘');if(review)review.title='记录正确率、卡点与完成状态，供明日自动调度';
  return slots;
}
function renderPlanner(){
  const p=planConfig.profiles[state.shift]||planConfig.profiles.late,meta=state.planMeta||{},analysis=meta.analysis||analyzeLearning(),tasks=plannerTasks();
  $('#shiftSelect').value=state.shift;
  const total=tasks.reduce((s,t)=>s+(Number(t.minutes)||0),0);$('#planTarget').textContent=`今日建议 ${(total/60).toFixed(1)}h`;
  const reasons=analysis.reasons||[];
  $('#planAdvice').innerHTML=`<div><b>${p.label} · 智能调度</b><span>${p.note}</span><div class="decision-reasons">${reasons.map(r=>`<i>${r}</i>`).join('')}</div></div>`;
  $('#planTimeline').innerHTML=tasks.map(s=>`<div class="timeline-row"><div class="timeline-time">${s.time||'弹性'}</div><div class="timeline-dot"></div><div class="timeline-content"><b>${s.subject}｜${s.title}</b><span>建议 ${s.minutes} 分钟${s.adaptive?' · 已按历史表现调整':''}</span></div></div>`).join('');
}
function generatePlan(resetStatuses=true){
  const p=planConfig.profiles[state.shift]||planConfig.profiles.late,analysis=analyzeLearning(),slots=adaptSlots(p,analysis),date=todayKey().replaceAll('-','');
  if(resetStatuses)state.generatedTasks.forEach(t=>delete state.taskStatus[t.id]);
  state.generatedTasks=slots.map((s,i)=>({id:`${date}-${state.shift}-${i+1}`,subject:s.subject,title:s.title,minutes:s.minutes,time:s.time,generated:true,adaptive:true}));
  state.generatedDate=todayKey();state.planMeta={createdAt:new Date().toISOString(),analysis:{...analysis,rows:undefined,last:analysis.last?{dayEnergy:analysis.last.dayEnergy}:null}};
  save();renderPlanner();renderToday();
}
function renderToday(){
  const tasks=allTasks(), box=$('#todayTasks'); box.innerHTML='';
  tasks.forEach(t=>{const st=state.taskStatus[t.id]||'todo';const card=document.createElement('div');card.className=`task-card ${st}`;card.innerHTML=`<div class="task-top"><div><div class="task-meta">${t.subject} · ${t.minutes}min${t.time?` · ${t.time}`:''}</div><div class="task-title">${t.title}</div></div><span class="badge">${({todo:'待执行',done:'已完成',partial:'部分完成',stuck:'卡住',delay:'延期'})[st]}</span></div><div class="task-actions"><button data-s="done">完成</button><button data-s="partial">部分完成</button><button data-s="stuck">卡住</button><button data-s="delay">延期</button><button data-edit>修改</button><button data-del>删除</button></div>`;card.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{state.taskStatus[t.id]=b.dataset.s;save();renderToday()}));card.querySelector('[data-edit]').addEventListener('click',()=>editTask(t));card.querySelector('[data-del]').addEventListener('click',()=>deleteTask(t));box.appendChild(card)});
  const done=tasks.filter(t=>(state.taskStatus[t.id]||'todo')==='done').length, rate=tasks.length?Math.round(done/tasks.length*100):0;
  $('#todaySummary').textContent=`${done} / ${tasks.length} 完成`;$('#todayRate').textContent=`${rate}%`;$('#todayBar').style.width=rate+'%';
  $('#todayMini').innerHTML=tasks.map(t=>`<div class="mini">${({todo:'⬜',done:'✅',partial:'🔵',stuck:'🟠',delay:'⏸️'})[state.taskStatus[t.id]||'todo']} ${t.subject}｜${t.title}</div>`).join('')
}
function addTask(){const title=$('#newTaskTitle').value.trim();if(!title)return;state.customTasks.push({id:'custom-'+Date.now(),date:todayKey(),subject:$('#newTaskSubject').value,title,minutes:Math.max(5,Number($('#newTaskMinutes').value)||30)});$('#newTaskTitle').value='';$('#newTaskMinutes').value='';save();renderToday()}
function editTask(t){const n=prompt('修改任务名称',t.title);if(n===null)return;const m=prompt('修改预计分钟',t.minutes);const target=state.customTasks.find(x=>x.id===t.id)||state.generatedTasks.find(x=>x.id===t.id);if(target){target.title=n.trim()||target.title;target.minutes=Math.max(5,Number(m)||target.minutes)}else{state.customTasks.push({...t,id:'override-'+t.id,date:todayKey(),title:n.trim()||t.title,minutes:Math.max(5,Number(m)||t.minutes)});state.taskStatus['override-'+t.id]=state.taskStatus[t.id]||'todo';state.taskStatus[t.id]='delay'}save();renderPlanner();renderToday()}
function deleteTask(t){state.customTasks=state.customTasks.filter(x=>x.id!==t.id);state.generatedTasks=state.generatedTasks.filter(x=>x.id!==t.id);state.taskStatus[t.id]='delay';save();renderPlanner();renderToday()}
function saveDay(){const k=todayKey();state.daily[k]={shift:state.shift,actualHours:$('#actualHours').value,mathQa:$('#mathQa').value,csQa:$('#csQa').value,wordMinutes:$('#wordMinutes').value,dayBlock:$('#dayBlock').value.trim(),dayEnergy:$('#dayEnergy').value,tasks:allTasks().map(t=>({...t,status:state.taskStatus[t.id]||'todo'}))};save();renderHistory();renderReview();alert('今日反馈已保存；下一次生成计划会自动参考这些数据。')}
function renderHistory(){const rows=Object.entries(state.daily).sort((a,b)=>b[0].localeCompare(a[0]));const total=rows.reduce((s,[,d])=>s+(Number(d.actualHours)||0),0),done=rows.reduce((s,[,d])=>s+d.tasks.filter(t=>t.status==='done').length,0),stuck=rows.reduce((s,[,d])=>s+d.tasks.filter(t=>t.status==='stuck').length,0);$('#historyStats').innerHTML=`<div class="metric"><span>累计学习</span><b>${total.toFixed(1)}h</b></div><div class="metric"><span>记录天数</span><b>${rows.length}</b></div><div class="metric"><span>完成任务</span><b>${done}</b></div><div class="metric"><span>卡住任务</span><b>${stuck}</b></div>`;$('#historyDays').innerHTML=rows.length?rows.map(([date,d])=>`<div class="history-item"><div class="section-head"><div><b>${date}</b><div class="muted">${d.dayEnergy||'未记录状态'}${d.shift?` · ${planConfig.profiles[d.shift]?.label||d.shift}`:''}</div></div><span class="badge">${Number(d.actualHours||0).toFixed(1)}h</span></div><div class="muted">数学 ${d.mathQa||'—'} ｜ 408 ${d.csQa||'—'} ｜ 墨墨 ${d.wordMinutes||0}min</div><div style="margin-top:8px"><b>卡点：</b>${d.dayBlock||'无'}</div><div style="margin-top:10px">${d.tasks.map(t=>`<div class="mini">${({todo:'⬜',done:'✅',partial:'🔵',stuck:'🟠',delay:'⏸️'})[t.status]} ${t.time?`${t.time} · `:''}${t.subject}｜${t.title}</div>`).join('')}</div></div>`).join(''):'<div class="empty">还没有学习记录。</div>'}
function renderReview(){const rows=Object.values(state.daily);const stuck=[];rows.forEach(d=>d.tasks.filter(t=>t.status==='stuck').forEach(t=>stuck.push(t)));$('#dueList').innerHTML=stuck.length?stuck.slice(-10).reverse().map(t=>`<div class="history-item">🟠 ${t.subject}｜${t.title}</div>`).join(''):'<div class="empty">暂无待复习。</div>';$('#riskList').innerHTML=stuck.length?stuck.slice(-6).reverse().map(t=>`<div class="history-item">高危：${t.title}</div>`).join(''):'<div class="empty">暂无高危知识点。</div>'}
async function loadMap(key){const main=$('#mapMain');main.innerHTML='<article class="panel"><div class="muted">正在加载学习地图…</div></article>';try{if(!loadedMaps[key])loadedMaps[key]=await getJson(`./data/maps/${key}.json`);renderMap(loadedMaps[key])}catch(e){main.innerHTML='<article class="panel"><b>学习地图加载失败</b><div class="muted">请刷新后重试。</div></article>'}}
function renderMap(data){const main=$('#mapMain');main.innerHTML='';data.groups.forEach((g,gi)=>{const sec=document.createElement('details');sec.className='map-group';sec.open=gi===0;sec.innerHTML=`<summary class="group-summary"><span>${g.name}</span><span class="muted">${g.chapters.length}章</span></summary><div class="chapter-list"></div>`;const list=sec.querySelector('.chapter-list');g.chapters.forEach(ch=>{const rec=state.chapter[ch.id]||{status:ch.status||'unlearned',progress:ch.progress||0};const d=document.createElement('details');d.className=`chapter ${rec.status}`;d.innerHTML=`<summary class="chapter-summary"><div class="chapter-name">${ch.name}</div><div class="chapter-meta">${statusLabel(rec.status)} · ${rec.progress}% · ${ch.topics.length}个知识点</div></summary><div class="topics">${ch.topics.map(t=>`<span class="topic">${t}</span>`).join('')}</div>`;d.addEventListener('toggle',()=>{if(d.open)$('#mapDetail').innerHTML=`<h3>${ch.name}</h3><p class="muted">${ch.topics.length} 个知识点</p><div class="topics">${ch.topics.map(t=>`<span class="topic">${t}</span>`).join('')}</div>`});list.appendChild(d)});main.appendChild(sec)})}
function statusLabel(s){return ({unlearned:'未学',learning:'学习中',review:'已学未稳',due:'待复习',mastered:'已掌握'})[s]||'未学'}
boot().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend','<div style="padding:20px;color:#b42318">初始化失败，请刷新页面。</div>')});
