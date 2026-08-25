(()=>{
  if(typeof state==='undefined'||typeof save!=='function')return;
  state.wrongQuestions=state.wrongQuestions||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const addDays=(dateStr,days)=>{const [y,m,d]=dateStr.split('-').map(Number),x=new Date(y,m-1,d);x.setDate(x.getDate()+days);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};

  function hideAcceptanceWrongNumber(){
    const input=document.getElementById('accWrong');
    if(!input)return;
    input.value='';
    const label=input.closest('label');if(label)label.style.display='none';
  }
  new MutationObserver(hideAcceptanceWrongNumber).observe(document.documentElement,{childList:true,subtree:true});
  hideAcceptanceWrongNumber();

  function ensureStyles(){
    if(document.getElementById('wrongQuestionLiteStyles'))return;
    const s=document.createElement('style');s.id='wrongQuestionLiteStyles';s.textContent=`
      .wrong-card{padding:14px;border:1px solid #eaecf0;border-radius:14px;background:#fff}.wrong-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.wrong-text{white-space:pre-wrap;padding:13px;border:1px solid #e4e7ec;border-radius:12px;background:#fafafa;line-height:1.7;font-size:14px;margin-top:12px}.wrong-meta{font-size:12px;color:#667085;margin-top:4px}.wrong-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.wrong-tabs button.active{background:#101828;color:#fff}.wrong-overlay{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px}.wrong-modal{width:min(700px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px}.wrong-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.wrong-modal label{display:flex;flex-direction:column;gap:6px;font-size:13px}.wrong-modal input,.wrong-modal textarea,.wrong-modal select{font:inherit;font-size:16px;padding:10px 11px;border:1px solid #d0d5dd;border-radius:10px}.wrong-modal textarea{min-height:120px;resize:vertical}.wrong-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}.wrong-ok{color:#067647}.wrong-due{color:#b42318}@media(max-width:640px){.wrong-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function statusOf(q){
    if(q.secondPass&&Number(q.mastery)>=4)return 'mastered';
    const dates=q.reviewDates||[];if(dates.some(d=>d<=today()))return 'due';
    return 'active';
  }

  function ensureUI(){
    ensureStyles();
    if(document.getElementById('view-wrong'))return;
    const nav=document.querySelector('.tabs'),before=document.querySelector('.tab[data-view="review"]');
    const btn=document.createElement('button');btn.className='tab';btn.dataset.view='wrong';btn.textContent='❌ 错题库';
    if(nav){if(before)nav.insertBefore(btn,before);else nav.appendChild(btn)}
    const sec=document.createElement('section');sec.id='view-wrong';sec.className='view hidden';sec.dataset.filter='active';
    sec.innerHTML=`<article class="panel"><div class="section-head"><div><h2>错题库</h2><p>只收真正值得复习的题。把错题原文直接复制进来即可，不记题号、不要求截图。</p></div><button id="wrongAdd" class="primary" type="button">粘贴一条错题</button></div><div id="wrongStats" class="subject-grid" style="margin-top:14px"></div><div class="wrong-tabs"><button data-wfilter="active" class="active">学习中</button><button data-wfilter="due">待复习</button><button data-wfilter="mastered">已掌握</button><button data-wfilter="all">全部</button></div><div id="wrongList" class="stack"></div></article>`;
    const main=document.querySelector('main'),anchor=document.getElementById('view-review');if(main){if(anchor)main.insertBefore(sec,anchor);else main.appendChild(sec)}
    btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));sec.classList.remove('hidden');render()});
    sec.querySelectorAll('[data-wfilter]').forEach(b=>b.addEventListener('click',()=>{sec.querySelectorAll('[data-wfilter]').forEach(x=>x.classList.toggle('active',x===b));sec.dataset.filter=b.dataset.wfilter;render()}));
    document.getElementById('wrongAdd').addEventListener('click',()=>openEditor(null));
  }

  function render(){
    ensureUI();
    const sec=document.getElementById('view-wrong');if(!sec)return;
    const list=Object.values(state.wrongQuestions||{}).filter(q=>q.questionText).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    const counts={active:0,due:0,mastered:0};list.forEach(q=>counts[statusOf(q)]++);
    document.getElementById('wrongStats').innerHTML=`<div class="metric"><span>学习中</span><b>${counts.active}</b><small>已录入，继续消化</small></div><div class="metric"><span>待复习</span><b>${counts.due}</b><small>按 1 / 3 / 7 天回看</small></div><div class="metric"><span>已掌握</span><b>${counts.mastered}</b><small>二刷通过 + 掌握≥4</small></div>`;
    const filter=sec.dataset.filter||'active',rows=filter==='all'?list:list.filter(q=>statusOf(q)===filter),box=document.getElementById('wrongList');
    if(!rows.length){box.innerHTML='<div class="empty">这里暂时没有错题。以后遇到值得留的题，直接复制题目文本进来就行。</div>';return}
    box.innerHTML=rows.map(q=>{const st=statusOf(q),statusText={active:'学习中',due:'到期复习',mastered:'已掌握'}[st];return `<div class="wrong-card" data-wid="${esc(q.id)}"><div class="wrong-head"><div><b>${esc(q.subject)}｜${esc(q.title||'错题')}</b><div class="wrong-meta">${esc(q.sourceName||'来源未填')} · 掌握 ${Number(q.mastery)||1}/5</div></div><span class="badge ${st==='due'?'wrong-due':st==='mastered'?'wrong-ok':''}">${statusText}</span></div><div class="wrong-text">${esc(q.questionText)}</div>${q.wrongReason?`<div style="margin-top:10px"><b>为什么错：</b>${esc(q.wrongReason)}</div>`:''}${q.correctIdea?`<details style="margin-top:8px"><summary>查看正确思路</summary><div class="wrong-text">${esc(q.correctIdea)}</div></details>`:''}<div class="task-actions" style="margin-top:12px"><button data-edit>编辑</button><button data-pass>二刷通过</button><button data-delete>删除</button></div></div>`}).join('');
    box.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(b.closest('[data-wid]').dataset.wid)));
    box.querySelectorAll('[data-pass]').forEach(b=>b.addEventListener('click',()=>{const id=b.closest('[data-wid]').dataset.wid,q=state.wrongQuestions[id];if(!q)return;q.secondPass=true;q.mastery=Math.max(4,Number(q.mastery)||4);q.reviewDates=[];q.updatedAt=new Date().toISOString();save();render()}));
    box.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{const id=b.closest('[data-wid]').dataset.wid;if(confirm('删除这条错题记录？')){delete state.wrongQuestions[id];save();render()}}));
  }

  function openEditor(id){
    const old=id?state.wrongQuestions[id]:null;
    const ov=document.createElement('div');ov.className='wrong-overlay';ov.innerHTML=`<div class="wrong-modal"><div class="section-head"><div><h3>${old?'编辑错题':'粘贴错题'}</h3><p class="muted">把题目原文完整复制进来即可。题号、截图、页码都不强制。</p></div><button type="button" data-close>×</button></div><div class="wrong-grid"><label>科目<select id="wSubject"><option>数学</option><option>408</option><option>英语</option><option>政治</option></select></label><label>来源（可选）<input id="wSource" value="${esc(old?.sourceName||'')}" placeholder="如 汤家凤高数讲义 / 系统生成"></label><label style="grid-column:1/-1">错题原文<textarea id="wText" placeholder="直接粘贴完整题干、选项、条件">${esc(old?.questionText||'')}</textarea></label><label style="grid-column:1/-1">为什么错（可选）<textarea id="wReason" placeholder="如：没有想到有理化 / 定义域漏掉对数条件">${esc(old?.wrongReason||'')}</textarea></label><label style="grid-column:1/-1">正确思路（可后补）<textarea id="wIdea" placeholder="先不想整理也可以留空">${esc(old?.correctIdea||'')}</textarea></label><label>掌握程度<select id="wMastery"><option value="1">1 · 不会</option><option value="2">2 · 有印象</option><option value="3">3 · 基本会</option><option value="4">4 · 稳定</option><option value="5">5 · 能讲清</option></select></label></div><div class="wrong-actions"><button data-close>取消</button><button class="primary" data-save>保存错题</button></div></div>`;document.body.appendChild(ov);
    ov.querySelector('#wSubject').value=old?.subject||'数学';ov.querySelector('#wMastery').value=String(old?.mastery||2);ov.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>ov.remove()));
    ov.querySelector('[data-save]').addEventListener('click',()=>{
      const text=ov.querySelector('#wText').value.trim();if(!text){alert('请先粘贴错题原文。');return}
      const rid=id||`wrong-manual-${Date.now()}`,date=old?.assessmentDate||today(),base=old||{};
      state.wrongQuestions[rid]={...base,id:rid,subject:ov.querySelector('#wSubject').value,title:(text.split('\n')[0]||'错题').slice(0,40),sourceName:ov.querySelector('#wSource').value.trim(),questionText:text,wrongReason:ov.querySelector('#wReason').value.trim(),correctIdea:ov.querySelector('#wIdea').value.trim(),mastery:Number(ov.querySelector('#wMastery').value)||2,assessmentDate:date,secondPass:old?.secondPass||false,reviewDates:old?.reviewDates?.length?old.reviewDates:[1,3,7].map(n=>addDays(date,n)),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      save();ov.remove();render();
    });
  }

  ensureUI();render();
})();
