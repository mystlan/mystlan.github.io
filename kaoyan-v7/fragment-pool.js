(()=>{
  const KEY='kaoyan_v7_fragment_pool';
  const DEFAULTS=[
    {id:'frag-vocab',subject:'词汇',title:'墨墨复习 + 少量新词',minutes:30,enabled:true,priority:1},
    {id:'frag-politics',subject:'政治',title:'政治音频 / 高频点听记',minutes:20,enabled:true,priority:2},
    {id:'frag-formula',subject:'数学',title:'公式默写 / 基础公式回想',minutes:15,enabled:true,priority:3},
    {id:'frag-review',subject:'复盘',title:'错题卡片回看',minutes:15,enabled:true,priority:4}
  ];
  let pool=[];
  try{pool=JSON.parse(localStorage.getItem(KEY)||'null')||DEFAULTS.map(x=>({...x}))}catch(e){pool=DEFAULTS.map(x=>({...x}))}
  const save=()=>localStorage.setItem(KEY,JSON.stringify(pool));
  const $=s=>document.querySelector(s);
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

  function ensureVocabOption(){
    const select=$('#newTaskSubject');
    if(select&&![...select.options].some(o=>o.value==='词汇')){const o=document.createElement('option');o.value='词汇';o.textContent='词汇';select.appendChild(o)}
  }
  function render(){
    const box=$('#fragmentPool'),badge=$('#fragmentEnabledCount');if(!box)return;
    const enabled=pool.filter(x=>x.enabled);if(badge)badge.textContent=`${enabled.length} 项启用`;
    box.innerHTML=pool.length?pool.map(t=>`<div class="task-card ${t.enabled?'partial':'delay'}"><div class="task-top"><div><div class="task-meta">${t.subject} · ${t.minutes}min</div><div class="task-title">${t.title}</div></div><span class="badge">${t.enabled?'启用':'暂停'}</span></div><div class="task-actions"><button data-toggle="${t.id}">${t.enabled?'暂停':'启用'}</button><button data-today="${t.id}">加入今日</button><button data-del="${t.id}">删除</button></div></div>`).join(''):'<div class="empty">碎片池为空。</div>';
    box.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{const t=pool.find(x=>x.id===b.dataset.toggle);if(t)t.enabled=!t.enabled;save();render()}));
    box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{pool=pool.filter(x=>x.id!==b.dataset.del);save();render()}));
    box.querySelectorAll('[data-today]').forEach(b=>b.addEventListener('click',()=>{const t=pool.find(x=>x.id===b.dataset.today);if(t)addToToday(t,true)}));
  }
  function addToToday(task,manual=false){
    ensureVocabOption();
    const existing=[...document.querySelectorAll('#todayTasks .task-title')].some(x=>x.textContent.trim()===task.title);
    if(existing)return false;
    const subject=$('#newTaskSubject'),title=$('#newTaskTitle'),minutes=$('#newTaskMinutes'),btn=$('#addTask');
    if(!subject||!title||!minutes||!btn)return false;
    subject.value=task.subject;title.value=task.title;minutes.value=task.minutes;btn.click();
    if(manual){const tab=[...document.querySelectorAll('.tab')].find(x=>x.dataset.view==='today');tab?.click()}
    return true;
  }
  function pickForShift(shift){
    const enabled=pool.filter(x=>x.enabled).sort((a,b)=>(a.priority||99)-(b.priority||99));
    if(shift==='lowEnergy')return enabled.filter(x=>x.subject==='词汇').slice(0,1);
    if(['late','early','weekendEarly'].includes(shift))return enabled.slice(0,2);
    if(shift==='rest')return enabled.filter(x=>['词汇','政治'].includes(x.subject)).slice(0,2);
    return enabled.slice(0,1);
  }
  function autoFill(){
    const shift=$('#shiftSelect')?.value||'late',selected=pickForShift(shift),added=[];
    selected.forEach(t=>{if(addToToday(t,false))added.push(t)});
    const note=$('#fragmentAutoNote');
    if(note){note.style.display='flex';note.innerHTML=`<div><b>碎片池自动调度</b><span>${selected.length?`本班次优先安排：${selected.map(x=>`${x.subject} ${x.minutes}min`).join('、')}。${added.length?' 已加入今日任务。':' 今日任务中已存在，不重复添加。'}`:'当前没有启用的碎片任务。'}</span></div>`}
  }
  function bind(){
    ensureVocabOption();
    $('#addFragment')?.addEventListener('click',()=>{const title=$('#fragmentTitle')?.value.trim();if(!title)return;pool.push({id:'frag-'+Date.now(),subject:$('#fragmentSubject')?.value||'复盘',title,minutes:Math.max(5,Number($('#fragmentMinutes')?.value)||20),enabled:true,priority:pool.length+1});$('#fragmentTitle').value='';save();render()});
    $('#generatePlan')?.addEventListener('click',()=>setTimeout(autoFill,80));
    $('#shiftSelect')?.addEventListener('change',()=>setTimeout(autoFill,100));
    render();setTimeout(autoFill,450);
  }
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();

(()=>{
  function loadCloudSync(){
    if(window.kaoyanCloud)return;
    const cloud=document.createElement('script');
    cloud.src='./cloud-sync.js?v=20260824-2355';
    cloud.defer=true;
    document.head.appendChild(cloud);
  }
  if(window.supabase?.createClient){loadCloudSync();return;}
  const sdk=document.createElement('script');
  sdk.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  sdk.onload=loadCloudSync;
  sdk.onerror=()=>console.warn('Supabase SDK failed to load; cloud sync remains off.');
  document.head.appendChild(sdk);
})();
