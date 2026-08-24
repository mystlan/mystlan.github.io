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
  const savePool=()=>localStorage.setItem(KEY,JSON.stringify(pool));
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
    box.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{const t=pool.find(x=>x.id===b.dataset.toggle);if(t)t.enabled=!t.enabled;savePool();render()}));
    box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{pool=pool.filter(x=>x.id!==b.dataset.del);savePool();render()}));
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
    $('#addFragment')?.addEventListener('click',()=>{const title=$('#fragmentTitle')?.value.trim();if(!title)return;pool.push({id:'frag-'+Date.now(),subject:$('#fragmentSubject')?.value||'复盘',title,minutes:Math.max(5,Number($('#fragmentMinutes')?.value)||20),enabled:true,priority:pool.length+1});$('#fragmentTitle').value='';savePool();render()});
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
    cloud.src='./cloud-sync.js?v=20260825-0020';
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

(()=>{
  /* 目录级任务引擎：把“当前主线”拆成可执行知识点、练习量和验收标准。 */
  if(typeof state==='undefined')return;
  state.topicCursor=state.topicCursor||{math:0,cs:0,english:0,politics:0};
  state.topicMastery=state.topicMastery||{};

  const initialMath=[
    {chapter:'函数、极限、连续',topic:'函数概念与性质',title:'函数基础①：函数概念 + 三要素',detail:'确认自变量、因变量、对应法则；辨认“是否构成函数”。先看例题/讲义，再做 3–4 道判断或基础题。',check:'能说清定义域、值域、对应法则分别是什么；基础判断题正确率 ≥75%。'},
    {chapter:'函数、极限、连续',topic:'定义域与值域',title:'函数基础②：定义域专项',detail:'做 5–6 个定义域：分母≠0、偶次根号≥0、对数真数>0，以及简单组合条件。',check:'至少独立做对 4/5；错题能指出是哪条限制漏了。'},
    {chapter:'函数、极限、连续',topic:'复合函数与反函数',title:'函数基础③：复合函数 + 反函数',detail:'先做复合关系拆解，再做 3–4 道 f(g(x)) 定义域/表达式；反函数只掌握“交换 x、y 再解 y”的基本思路。',check:'能判断谁是内层函数、谁是外层函数；能完成简单复合函数。'},
    {chapter:'函数、极限、连续',topic:'数列极限',title:'极限概念①：数列极限在说什么',detail:'先不碰严格证明。用 1/n、(n+1)/n 等例子理解 n→∞ 时“越来越靠近某个数”。',check:'能用自己的话解释“趋近”不是“等于”，并说出 1/n 的极限。'},
    {chapter:'函数、极限、连续',topic:'函数极限',title:'极限概念②：x→a 与 f(x)→A',detail:'区分“x 靠近 a”和“x=a”；理解极限关心附近，不一定关心点值。做 3–4 道读图/判断题。',check:'能解释为什么 f(a) 不存在也可能有极限。'},
    {chapter:'函数、极限、连续',topic:'左右极限',title:'极限概念③：左极限 + 右极限',detail:'分别从 x<a 与 x>a 接近 a；用分段函数做 4 道左右极限判断。',check:'知道“两侧都存在且相等 ⇔ 极限存在”；能独立判断分段函数。'},
    {chapter:'函数、极限、连续',topic:'极限运算法则',title:'极限计算①：直接代入 + 四则运算',detail:'先识别可直接代入的题，再做 5–6 道和、差、积、商的基本极限。',check:'能判断什么时候可直接代入；不把 0/0 直接当答案。'},
    {chapter:'函数、极限、连续',topic:'极限运算法则',title:'极限计算②：因式分解消 0/0',detail:'重点练平方差、完全平方、提公因式；做 5–6 道“约掉致零因子”题。',check:'至少 4/5 独立做对；能指出为什么原式不能直接代入。'},
    {chapter:'函数、极限、连续',topic:'极限运算法则',title:'极限计算③：有理化',detail:'根式差导致 0/0 时乘共轭式；做 4–5 道根式极限。',check:'会写共轭式并完成约分；不只是背结论。'},
    {chapter:'函数、极限、连续',topic:'两个重要极限',title:'两个重要极限①：sin x / x',detail:'先理解 x→0 时 sinx/x→1 的使用条件，再做换元型 5 道。',check:'能识别“里面不是 x 也能换元”的结构。'},
    {chapter:'函数、极限、连续',topic:'两个重要极限',title:'两个重要极限②：(1+1/x)^x',detail:'掌握 e 型结构与常见变形，先做 4–5 道基础识别题。',check:'能识别底数→1、指数→∞ 的 e 型极限。'},
    {chapter:'函数、极限、连续',topic:'等价无穷小',title:'无穷小①：常用等价无穷小',detail:'先掌握 sinx~x、tanx~x、1-cosx~x²/2、ln(1+x)~x、e^x-1~x；做 6 道直接替换题。',check:'知道只能在乘除主导结构中安全替换，先不乱用于加减。'},
    {chapter:'函数、极限、连续',topic:'无穷小与无穷大',title:'无穷小②：阶数比较',detail:'比较同阶、高阶、低阶；做 5 道阶数判断题。',check:'能用比值极限判断同阶/高阶/低阶。'},
    {chapter:'函数、极限、连续',topic:'连续与间断点',title:'连续①：连续定义 + 左右连续',detail:'把连续拆成“有定义、极限存在、极限=函数值”三件事；做 4 道判断题。',check:'能完整说出点连续的三个条件。'},
    {chapter:'函数、极限、连续',topic:'连续与间断点',title:'连续②：间断点分类',detail:'可去、跳跃、无穷、振荡间断点；做 5–6 道分类题。',check:'看到分段函数能先查左右极限再分类。'}
  ];

  const cPrereq=[
    {chapter:'C语言前置',topic:'地址与取地址',title:'C指针①：变量地址 + & 运算符',detail:'用 int a=10; 观察 a 与 &a 的含义；手写 3 组“变量值/变量地址”对应。',check:'看到 &a 能立即说出“a 的地址”，不把地址和值混淆。'},
    {chapter:'C语言前置',topic:'一级指针',title:'C指针②：int *p 与 p=&a',detail:'只学一级指针。理解 p 是“存地址的变量”；画出 a → 地址 → p 的关系图，做 3 道代码跟踪。',check:'能解释 int *p、p=&a 两句分别做了什么。'},
    {chapter:'C语言前置',topic:'解引用',title:'C指针③：*p 解引用',detail:'理解 *p 是“顺着地址找到值”；跟踪 a=10,p=&a,*p=20 后 a 的变化。做 4 道代码题。',check:'能判断修改 *p 是否会修改 a。'},
    {chapter:'C语言前置',topic:'指针与数组',title:'C指针④：数组名 + 指针移动',detail:'只掌握 a、&a[0]、p=a、*(p+1) 的关系，不进入二级指针。做 4 道数组访问题。',check:'能把 *(p+i) 与 a[i] 对应起来。'}
  ];

  let mapMath=null,map408=null;
  const loadMaps=Promise.all([
    fetch('./data/maps/math.json',{cache:'no-store'}).then(r=>r.json()),
    fetch('./data/maps/408.json',{cache:'no-store'}).then(r=>r.json())
  ]).then(([m,c])=>{mapMath=m;map408=c}).catch(()=>{});

  function flattenMap(map){
    if(!map?.groups)return [];
    const out=[];
    map.groups.forEach(g=>(g.chapters||[]).forEach(ch=>(ch.topics||[]).forEach(topic=>out.push({chapter:ch.name,chapterId:ch.id,topic}))));
    return out;
  }
  function genericStep(subject,item,index){
    const practice=subject==='数学'?'做 4–6 道对应基础题':'做 4–6 道王道基础选择/代码理解题';
    return {
      chapter:item.chapter,chapterId:item.chapterId,topic:item.topic,
      title:`${item.chapter}｜${item.topic}`,
      detail:`先用讲义/课程把「${item.topic}」的核心定义、规则和典型例题过一遍，然后${practice}。不要整章视频一次看完。`,
      check:`能脱离讲义说出「${item.topic}」的核心规则，并在对应基础题中达到约 70% 以上正确率。`,
      index
    };
  }
  function mathTrack(){
    const rest=flattenMap(mapMath).filter(x=>x.chapter!=='函数、极限、连续').map((x,i)=>genericStep('数学',x,initialMath.length+i));
    return [...initialMath.map((x,i)=>({...x,index:i,chapterId:'math-g1'})),...rest];
  }
  function csTrack(){
    const rest=flattenMap(map408).map((x,i)=>genericStep('408',x,cPrereq.length+i));
    return [...cPrereq.map((x,i)=>({...x,index:i,chapterId:'c-prereq'})),...rest];
  }
  const englishTrack=[
    {chapter:'英语一基线',topic:'真题阅读基线',title:'英语阅读基线①：真题阅读 1 篇',detail:'限时做 1 篇英语一真题阅读，不查词。记录 5 题对几题、用时、最大障碍（词汇/长句/定位/逻辑）。',check:'必须留下“用时 + 5题正确数 + 最大障碍”三项数据。'},
    {chapter:'英语一基线',topic:'长难句主干',title:'长难句①：主干识别',detail:'从真题阅读里挑 3 个长句，只做主谓宾/主系表主干提取，再标从句。',check:'3 句至少 2 句能找到主干，不要求全文精翻。'},
    {chapter:'英语一基线',topic:'阅读定位',title:'阅读方法①：题干关键词 + 原文定位',detail:'重做 1 篇阅读，只练题干关键词和原文定位句，不追求速度。',check:'每题都能指出答案依据来自哪一句或哪两句。'}
  ];
  const politicsTrack=[
    {chapter:'马原',topic:'哲学基本问题',title:'政治轻量①：哲学基本问题',detail:'20–30 分钟过核心考案对应小节，再做 5–8 道1000题选择题。',check:'知道物质与意识、可知论/不可知论的基本区分。'},
    {chapter:'马原',topic:'唯物论',title:'政治轻量②：物质、意识与实践',detail:'看核心概念 + 5–8 道选择题，不做长笔记。',check:'错题能定位到概念，而不是只记选项。'}
  ];

  function trackFor(subject){
    if(subject==='数学')return mathTrack();
    if(subject==='408')return csTrack();
    if(subject==='英语')return englishTrack;
    if(subject==='政治')return politicsTrack;
    return [];
  }
  function cursorKey(subject){return subject==='数学'?'math':subject==='408'?'cs':subject==='英语'?'english':'politics'}
  function currentStep(subject,offset=0){
    const track=trackFor(subject);if(!track.length)return null;
    const key=cursorKey(subject),base=Math.max(0,Number(state.topicCursor[key])||0);
    return track[Math.min(track.length-1,base+offset)]||track[track.length-1];
  }
  function isCore(subject){return ['数学','408','英语','政治'].includes(subject)}
  function detailedSlots(profile,analysis){
    const base=typeof adaptSlots==='function'?adaptSlots(profile,analysis):profile.slots.map(s=>({...s}));
    const offsets={数学:0,'408':0,英语:0,政治:0};
    return base.map(slot=>{
      if(!isCore(slot.subject))return {...slot,detail:slot.detail||'完成当天结果记录与卡点整理。',check:slot.check||'留下真实完成状态和最大卡点。'};
      const step=currentStep(slot.subject,offsets[slot.subject]++);
      if(!step)return slot;
      return {...slot,title:step.title,detail:step.detail,check:step.check,chapter:step.chapter,chapterId:step.chapterId||'',topic:step.topic,topicIndex:step.index??0};
    });
  }

  if(typeof parseRatio==='function'){
    parseRatio=function(v){if(!v)return null;const m=String(v).match(/(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)/);if(!m)return null;const attempted=Number(m[1]),correct=Number(m[2]);if(attempted<=0)return null;return clamp(correct/attempted,0,1)};
  }

  generatePlan=function(resetStatuses=true){
    const p=planConfig.profiles[state.shift]||planConfig.profiles.late,analysis=analyzeLearning(),slots=detailedSlots(p,analysis),date=todayKey().replaceAll('-','');
    if(resetStatuses)state.generatedTasks.forEach(t=>delete state.taskStatus[t.id]);
    state.generatedTasks=slots.map((s,i)=>({id:`${date}-${state.shift}-${i+1}`,subject:s.subject,title:s.title,minutes:s.minutes,time:s.time,detail:s.detail||'',check:s.check||'',chapter:s.chapter||'',chapterId:s.chapterId||'',topic:s.topic||'',topicIndex:s.topicIndex??null,generated:true,adaptive:true}));
    state.generatedDate=todayKey();state.planMeta={createdAt:new Date().toISOString(),analysis:{...analysis,rows:undefined,last:analysis.last?{dayEnergy:analysis.last.dayEnergy}:null},engine:'curriculum-detail-v1'};
    save();renderPlanner();renderToday();
  };

  renderPlanner=function(){
    const p=planConfig.profiles[state.shift]||planConfig.profiles.late,meta=state.planMeta||{},analysis=meta.analysis||analyzeLearning(),tasks=plannerTasks();
    $('#shiftSelect').value=state.shift;
    const total=tasks.reduce((s,t)=>s+(Number(t.minutes)||0),0);$('#planTarget').textContent=`今日建议 ${(total/60).toFixed(1)}h`;
    const reasons=analysis.reasons||[];
    $('#planAdvice').innerHTML=`<div><b>${p.label} · 目录级智能调度</b><span>${p.note}</span><div class="decision-reasons">${reasons.map(r=>`<i>${r}</i>`).join('')}</div></div>`;
    $('#planTimeline').innerHTML=tasks.map(s=>`<div class="timeline-row"><div class="timeline-time">${s.time||'弹性'}</div><div class="timeline-dot"></div><div class="timeline-content"><b>${s.subject}｜${s.title}</b><span>${s.detail||''}</span><small style="display:block;margin-top:5px;color:#667085">验收：${s.check||'按实际结果验收'} · 建议 ${s.minutes} 分钟</small></div></div>`).join('');
  };

  renderToday=function(){
    const tasks=allTasks(),box=$('#todayTasks');box.innerHTML='';
    tasks.forEach(t=>{
      const st=state.taskStatus[t.id]||'todo',card=document.createElement('div');card.className=`task-card ${st}`;card.dataset.taskId=t.id;
      card.innerHTML=`<div class="task-top"><div><div class="task-meta">${t.subject} · ${t.minutes}min${t.time?` · ${t.time}`:''}${t.chapter?` · ${t.chapter}`:''}</div><div class="task-title">${t.title}</div></div><span class="badge">${({todo:'待执行',done:'已完成',partial:'部分完成',stuck:'卡住',delay:'延期'})[st]}</span></div>${t.detail?`<div style="margin-top:10px;font-size:13px;line-height:1.65">${t.detail}</div>`:''}${t.check?`<div style="margin-top:8px;padding:9px 10px;border-radius:10px;background:rgba(127,127,127,.08);font-size:12px"><b>验收标准：</b>${t.check}</div>`:''}<div class="task-actions"><button data-s="done">完成</button><button data-s="partial">部分完成</button><button data-s="stuck">卡住</button><button data-s="delay">延期</button><button data-edit>修改</button><button data-del>删除</button></div>`;
      card.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{
        const old=state.taskStatus[t.id]||'todo',next=b.dataset.s;state.taskStatus[t.id]=next;
        if(t.topic&&old!=='done'&&next==='done'){
          const key=cursorKey(t.subject),cur=Number(state.topicCursor[key])||0;
          if(Number.isInteger(t.topicIndex)&&t.topicIndex>=cur)state.topicCursor[key]=t.topicIndex+1;
          state.topicMastery[`${t.subject}|${t.chapter}|${t.topic}`]={status:'done',at:new Date().toISOString()};
        }
        if(t.topic&&next==='stuck')state.topicMastery[`${t.subject}|${t.chapter}|${t.topic}`]={status:'stuck',at:new Date().toISOString()};
        save();renderToday();
      }));
      card.querySelector('[data-edit]').addEventListener('click',()=>editTask(t));card.querySelector('[data-del]').addEventListener('click',()=>deleteTask(t));box.appendChild(card);
    });
    const done=tasks.filter(t=>(state.taskStatus[t.id]||'todo')==='done').length,rate=tasks.length?Math.round(done/tasks.length*100):0;
    $('#todaySummary').textContent=`${done} / ${tasks.length} 完成`;$('#todayRate').textContent=`${rate}%`;$('#todayBar').style.width=rate+'%';
    $('#todayMini').innerHTML=tasks.map(t=>`<div class="mini">${({todo:'⬜',done:'✅',partial:'🔵',stuck:'🟠',delay:'⏸️'})[state.taskStatus[t.id]||'todo']} ${t.subject}｜${t.title}</div>`).join('');
  };

  loadMaps.then(()=>{
    const todayTasks=state.generatedTasks||[],hasProgress=todayTasks.some(t=>['done','partial','stuck'].includes(state.taskStatus[t.id]));
    const oldGeneric=todayTasks.length&&todayTasks.every(t=>!t.detail);
    if(oldGeneric&&!hasProgress){generatePlan(true)}else{renderPlanner();renderToday()}
  });
})();
