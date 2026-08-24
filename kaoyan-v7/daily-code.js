(()=>{
  const APP_KEY='kaoyan_v7_state';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readState=()=>{try{return JSON.parse(localStorage.getItem(APP_KEY)||'{}')||{}}catch(e){return {}}};
  const writeState=s=>localStorage.setItem(APP_KEY,JSON.stringify(s));

  const prereq=[
    {chapter:'C语言前置',topic:'地址与取地址',title:'C代码①：变量、值与地址',goal:'亲手运行 int a=10;，分别输出 a 与 &a；再改 a 的值观察地址是否变化。',check:'能说清 a 是值、&a 是地址；知道改变量值通常不会改变变量地址。'},
    {chapter:'C语言前置',topic:'一级指针',title:'C代码②：int *p 与 p=&a',goal:'独立敲出 int a=10; int *p=&a;，分别输出 a、p、&a，并画出 p → a 的关系。',check:'能解释 p 保存的是地址，而不是 a 的数值。'},
    {chapter:'C语言前置',topic:'解引用',title:'C代码③：*p 解引用',goal:'运行 a=10,p=&a,*p=20；输出修改前后 a 和 *p，观察两者同步变化。',check:'能解释为什么修改 *p 会修改 a。'},
    {chapter:'C语言前置',topic:'指针与数组',title:'C代码④：数组与指针访问',goal:'定义 int a[4]={1,2,3,4}; 用 a[i] 和 *(a+i) 各遍历一次。',check:'能对应 *(p+i) 与 a[i]；暂不碰二级指针。'}
  ];

  const topicTemplates=[
    [/时间复杂度/,t=>({title:'复杂度代码：两种循环对比',goal:'分别写一个单循环和双重循环，手算执行次数数量级，再运行验证输出次数。',check:'能判断 O(n) 与 O(n²)，并说明依据。'})],
    [/顺序表/,t=>({title:'顺序表：插入一个元素',goal:'用数组模拟顺序表，在指定位置插入一个元素并后移后续元素。',check:'能独立写出后移循环，并知道为什么要从后往前移动。'})],
    [/单链表|链表/,t=>({title:'单链表：创建 + 遍历',goal:'定义结点结构体，创建 3 个结点并用 next 串起来，再循环输出。',check:'能解释 head、next 和 NULL 的作用。'})],
    [/双链表/,t=>({title:'双链表：前驱与后继',goal:'定义 prior/next，连接 3 个结点并从中间结点向前、向后各走一次。',check:'能说清插入时哪些指针需要同时修改。'})],
    [/栈/,t=>({title:'栈：数组实现 push / pop',goal:'用数组 + top 写最小可运行栈，实现入栈、出栈和读取栈顶。',check:'能解释 top 何时增减以及栈空条件。'})],
    [/队列/,t=>({title:'队列：数组实现入队 / 出队',goal:'先用最简单数组队列理解 front/rear，再观察普通队列会浪费前部空间的问题。',check:'能解释 front 和 rear 各指向什么。'})],
    [/递归/,t=>({title:'递归：阶乘调用过程',goal:'手敲 factorial(n)，并用 n=4 写出调用展开与回收顺序。',check:'能指出递归出口和递归式。'})],
    [/二叉树.*遍历|遍历/,t=>({title:'二叉树：前序递归遍历',goal:'先写 TreeNode 结构体，再手敲前序遍历函数；有余力再改成中序。',check:'能解释“根左右”如何对应递归代码。'})],
    [/BFS/,t=>({title:'图 BFS：队列版伪代码',goal:'不追求完整工程，只写 visited + queue 的核心流程，并手推一个 5 个点的小图。',check:'知道为什么 BFS 必须配队列。'})],
    [/DFS/,t=>({title:'图 DFS：递归版核心',goal:'写 visited + dfs(v) 的核心递归流程，并手推访问顺序。',check:'知道递归调用对应“沿一条路走到底”。'})],
    [/折半查找/,t=>({title:'折半查找：手写 while 版本',goal:'对有序数组写 low/high/mid 循环，测试查到与查不到两种情况。',check:'能正确更新 low=mid+1 或 high=mid-1。'})],
    [/快速排序/,t=>({title:'快速排序：只练一次划分',goal:'先不写完整递归，只对一个数组完成一次 partition，并观察枢轴最终位置。',check:'理解一次划分后枢轴左小右大。'})],
    [/排序/,t=>({title:`${t}：手写核心过程`,goal:`围绕“${t}”手写最核心的一趟过程，并用 5 个数手推一遍。`,check:'能不看答案写出核心循环，并解释每轮发生了什么。'})]
  ];

  function genericTask(topic){
    for(const [re,fn] of topicTemplates)if(re.test(topic))return {...fn(topic),topic};
    return {topic,title:`408代码手感：${topic}`,goal:`围绕“${topic}”写一个 10–15 分钟的小代码/伪代码例子；只验证核心机制，不做完整项目。`,check:'能运行或手推通过，并用一句话解释代码和当前知识点的对应关系。'};
  }

  function ensureUI(){
    if($('#view-code'))return;
    const nav=$('.tabs');
    const before=$('.tab[data-view="fragment"]')||$('.tab[data-view="map"]');
    const btn=document.createElement('button');btn.className='tab';btn.dataset.view='code';btn.textContent='💻 每日代码';
    if(nav){if(before)nav.insertBefore(btn,before);else nav.appendChild(btn)}
    const main=document.querySelector('main');
    const anchor=$('#view-fragment')||$('#view-map');
    const sec=document.createElement('section');sec.id='view-code';sec.className='view hidden';
    sec.innerHTML=`
      <article class="panel">
        <div class="section-head"><div><h2>💻 每日代码 · 408实践辅助</h2><p>不做第五门主科。每次 10–20 分钟，休息日可到 20–30 分钟；目标是保持 C / 数据结构代码手感。</p></div><span id="codeTodayBadge" class="badge">今日待安排</span></div>
        <div id="codeSuggestion" class="task-grid" style="margin-top:14px"></div>
      </article>
      <div id="codeStats" class="subject-grid"></div>
      <article class="panel">
        <div class="section-head"><div><h2>近 7 天代码训练</h2><p>只看是否持续接触，不追求刷题数量。</p></div><span id="codeWeekBadge" class="badge">0 次</span></div>
        <div id="codeHistory" class="stack" style="margin-top:14px"></div>
      </article>`;
    if(main){if(anchor)main.insertBefore(sec,anchor);else main.appendChild(sec)}
    btn.addEventListener('click',()=>{
      $$('.tab').forEach(x=>x.classList.toggle('active',x===btn));
      $$('.view').forEach(x=>x.classList.add('hidden'));
      sec.classList.remove('hidden');render();
    });
  }

  async function currentTask(){
    const s=readState();
    const cursor=Math.max(0,Number(s.topicCursor?.cs)||0);
    if(cursor<prereq.length)return {...prereq[cursor],source:'C前置'};
    try{
      const r=await fetch('./data/maps/408.json',{cache:'no-store'});const map=await r.json();
      const topics=[];(map.groups||[]).forEach(g=>(g.chapters||[]).forEach(ch=>(ch.topics||[]).forEach(topic=>topics.push({chapter:ch.name,topic}))));
      const item=topics[Math.max(0,Math.min(topics.length-1,cursor-prereq.length))]||topics[0];
      if(!item)return {...prereq[prereq.length-1],source:'C前置'};
      return {...genericTask(item.topic),chapter:item.chapter,source:'408目录'};
    }catch(e){return {...prereq[Math.min(cursor,prereq.length-1)],source:'离线备用'}}
  }

  function recentStats(records){
    const keys=Object.keys(records||{}).sort().reverse();
    const cutoff=new Date();cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-6);
    const week=keys.filter(k=>new Date(k+'T00:00:00')>=cutoff).map(k=>[k,records[k]]);
    return {week,count:week.filter(([,r])=>r.status==='done').length,minutes:week.reduce((n,[,r])=>n+(Number(r.minutes)||0),0),stuck:week.filter(([,r])=>r.status==='stuck').length};
  }

  async function render(){
    ensureUI();
    const s=readState();s.codePractice=s.codePractice||{records:{}};const records=s.codePractice.records||{};
    const task=await currentTask();const today=records[todayKey()]||null;const stat=recentStats(records);
    const shift=s.shift||'late';const recommended=shift==='rest'?25:shift==='lowEnergy'?10:15;
    const need=stat.count<4||today;
    const badge=$('#codeTodayBadge');if(badge)badge.textContent=today?({done:'今日已完成',stuck:'今日卡住',skip:'今日跳过'}[today.status]||'今日已记录'):(need?'建议今天练':'本周量已够 · 可选');
    const box=$('#codeSuggestion');
    if(box)box.innerHTML=`<div class="task-card ${today?.status==='done'?'done':today?.status==='stuck'?'stuck':'todo'}"><div class="task-top"><div><div class="task-meta">${esc(task.source)} · ${esc(task.chapter)} · 建议 ${recommended}min</div><div class="task-title">${esc(task.title)}</div></div><span class="badge">${need?'建议训练':'有余力再做'}</span></div><div class="muted" style="margin-top:10px"><b>今天敲什么：</b>${esc(task.goal)}</div><div style="margin-top:8px"><b>验收：</b>${esc(task.check)}</div><div class="feedback-grid" style="margin-top:12px"><label>实际用时（分钟）<input id="codeMinutes" type="number" min="0" value="${today?.minutes??recommended}"></label><label class="wide">一句话记录<input id="codeNote" value="${esc(today?.note||'')}" placeholder="如：忘记 *p 修改的是指向变量"></label></div><div class="task-actions"><button id="codeDone" class="primary">完成</button><button id="codeStuck">卡住</button><button id="codeSkip">今天不练</button><button id="codeAddToday">加入今日任务</button></div></div>`;
    const stats=$('#codeStats');if(stats)stats.innerHTML=`<div class="metric"><span>近7天训练</span><b>${stat.count}</b><small>目标 3–5 次</small></div><div class="metric"><span>近7天代码用时</span><b>${stat.minutes}m</b><small>归入 408</small></div><div class="metric"><span>近7天卡住</span><b>${stat.stuck}</b><small>用于发现薄弱点</small></div><div class="metric"><span>当前代码点</span><b style="font-size:16px">${esc(task.topic||task.title)}</b><small>${esc(task.chapter)}</small></div>`;
    const wb=$('#codeWeekBadge');if(wb)wb.textContent=`${stat.count} 次 · ${stat.minutes}min`;
    const hist=$('#codeHistory');if(hist)hist.innerHTML=stat.week.length?stat.week.map(([d,r])=>`<div class="history-item"><div class="section-head"><div><b>${d}</b><div class="muted">${esc(r.title||'代码训练')}</div></div><span class="badge">${r.status==='done'?'完成':r.status==='stuck'?'卡住':'跳过'}</span></div><div class="muted">${Number(r.minutes)||0}min${r.note?` · ${esc(r.note)}`:''}</div></div>`).join(''):'<div class="empty">近 7 天还没有代码训练记录。</div>';

    const saveStatus=status=>{const ns=readState();ns.codePractice=ns.codePractice||{records:{}};ns.codePractice.records=ns.codePractice.records||{};ns.codePractice.records[todayKey()]={status,minutes:Math.max(0,Number($('#codeMinutes')?.value)||0),note:$('#codeNote')?.value.trim()||'',title:task.title,topic:task.topic||'',chapter:task.chapter,updatedAt:new Date().toISOString()};writeState(ns);render()};
    $('#codeDone')?.addEventListener('click',()=>saveStatus('done'));
    $('#codeStuck')?.addEventListener('click',()=>saveStatus('stuck'));
    $('#codeSkip')?.addEventListener('click',()=>saveStatus('skip'));
    $('#codeAddToday')?.addEventListener('click',()=>{
      const sub=$('#newTaskSubject'),title=$('#newTaskTitle'),mins=$('#newTaskMinutes'),add=$('#addTask');if(!sub||!title||!mins||!add)return;
      sub.value='408';title.value=`代码｜${task.title}`;mins.value=recommended;add.click();
      const todayTab=$('.tab[data-view="today"]');todayTab?.click();
    });
  }

  function init(){ensureUI();render()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
