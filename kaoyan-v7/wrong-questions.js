(()=>{
  if(typeof state==='undefined'||typeof save!=='function')return;
  const APP_KEY='kaoyan_v7_state';
  const BUCKET='wrong-question-images';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  state.wrongQuestions=state.wrongQuestions||{};

  function splitNums(v){return String(v||'').split(/[、,，;；\s]+/).map(x=>x.trim()).filter(Boolean)}
  function slug(v){return String(v||'x').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,40)||'q'}
  function addDays(dateStr,days){const [y,m,d]=dateStr.split('-').map(Number),x=new Date(y,m-1,d);x.setDate(x.getDate()+days);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
  function hasOriginal(q){return Boolean(q.questionText||q.imagePath)}
  function syncFromAssessments(){
    let changed=false;
    Object.values(state.taskAssessments||{}).forEach(a=>{
      splitNums(a.wrongNumbers).forEach(n=>{
        const id=`wrong-${slug(a.taskId)}-${slug(n)}`;
        if(state.wrongQuestions[id])return;
        state.wrongQuestions[id]={id,taskId:a.taskId,subject:a.subject||'未分类',taskTitle:a.title||'',wrongNumber:n,assessmentDate:a.date||today(),sourceType:'讲义/题集',sourceName:'',page:'',questionText:'',imagePath:'',wrongReason:a.maxBlock||'',correctIdea:'',mastery:Math.max(1,Math.min(5,Number(a.mastery)||2)),secondPass:false,reviewDates:[1,3,7].map(x=>addDays(a.date||today(),x)),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};changed=true;
      });
    });
    if(changed)save();
  }

  function ensureStyles(){
    if(document.getElementById('wrongQuestionStyles'))return;
    const s=document.createElement('style');s.id='wrongQuestionStyles';s.textContent=`
      .wrong-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.wrong-tabs button.active{background:#101828;color:#fff}.wrong-card{padding:14px;border:1px solid #eaecf0;border-radius:14px;background:#fff}.wrong-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.wrong-original{margin-top:12px;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden;background:#fafafa}.wrong-original img{display:block;max-width:100%;height:auto;margin:auto}.wrong-text{white-space:pre-wrap;padding:12px;line-height:1.65;font-size:14px}.wrong-meta{font-size:12px;color:#667085;margin-top:4px}.wrong-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.wrong-overlay{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px}.wrong-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px}.wrong-modal label{display:flex;flex-direction:column;gap:6px;font-size:13px}.wrong-modal input,.wrong-modal textarea,.wrong-modal select{font:inherit;font-size:16px;padding:10px 11px;border:1px solid #d0d5dd;border-radius:10px}.wrong-modal textarea{min-height:110px;resize:vertical}.wrong-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}.wrong-preview{margin-top:10px}.wrong-preview img{max-width:100%;border-radius:10px;border:1px solid #e4e7ec}.wrong-missing{color:#b54708}.wrong-due{color:#b42318}.wrong-ok{color:#067647}
      @media(max-width:640px){.wrong-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function ensureUI(){
    ensureStyles();
    if(document.getElementById('view-wrong'))return;
    const nav=document.querySelector('.tabs'),before=document.querySelector('.tab[data-view="review"]');
    const btn=document.createElement('button');btn.className='tab';btn.dataset.view='wrong';btn.textContent='❌ 错题库';
    if(nav){if(before)nav.insertBefore(btn,before);else nav.appendChild(btn)}
    const sec=document.createElement('section');sec.id='view-wrong';sec.className='view hidden';sec.innerHTML=`
      <article class="panel"><div class="section-head"><div><h2>错题库</h2><p>硬规则：每条错题必须能看到原题原貌。系统题保存题面；讲义题优先保存截图。</p></div><button id="wrongAdd" class="primary" type="button">手动加入错题</button></div><div id="wrongStats" class="subject-grid" style="margin-top:14px"></div><div class="wrong-tabs"><button data-wfilter="missing" class="active">待补原题</button><button data-wfilter="due">待复习</button><button data-wfilter="active">学习中</button><button data-wfilter="mastered">已掌握</button><button data-wfilter="all">全部</button></div><div id="wrongList" class="stack"></div></article>`;
    const main=document.querySelector('main'),anchor=document.getElementById('view-review');if(main){if(anchor)main.insertBefore(sec,anchor);else main.appendChild(sec)}
    btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));sec.classList.remove('hidden');render()});
    sec.querySelectorAll('[data-wfilter]').forEach(b=>b.addEventListener('click',()=>{sec.querySelectorAll('[data-wfilter]').forEach(x=>x.classList.toggle('active',x===b));sec.dataset.filter=b.dataset.wfilter;render()}));
    sec.dataset.filter='missing';
    document.getElementById('wrongAdd').addEventListener('click',()=>openEditor(null));
  }

  async function signedUrl(path){
    if(!path||!window.kaoyanCloud?.client)return '';
    try{const {data,error}=await window.kaoyanCloud.client.storage.from(BUCKET).createSignedUrl(path,3600);return error?'':(data?.signedUrl||'')}catch(e){return ''}
  }

  function statusOf(q){
    if(!hasOriginal(q))return 'missing';
    if(q.secondPass&&Number(q.mastery)>=4)return 'mastered';
    const dates=q.reviewDates||[];if(dates.some(d=>d<=today()))return 'due';
    return 'active';
  }

  async function render(){
    ensureUI();syncFromAssessments();
    const sec=document.getElementById('view-wrong');if(!sec)return;
    const list=Object.values(state.wrongQuestions||{}).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    const counts={missing:0,due:0,active:0,mastered:0};list.forEach(q=>counts[statusOf(q)]++);
    document.getElementById('wrongStats').innerHTML=`<div class="metric"><span>待补原题</span><b>${counts.missing}</b><small>没有原貌则不算完整错题</small></div><div class="metric"><span>待复习</span><b>${counts.due}</b><small>D+1 / D+3 / D+7</small></div><div class="metric"><span>学习中</span><b>${counts.active}</b><small>已收原题，尚未稳定</small></div><div class="metric"><span>已掌握</span><b>${counts.mastered}</b><small>二刷通过 + 掌握≥4</small></div>`;
    const filter=sec.dataset.filter||'missing';const rows=filter==='all'?list:list.filter(q=>statusOf(q)===filter);const box=document.getElementById('wrongList');
    if(!rows.length){box.innerHTML='<div class="empty">这里暂时没有错题。</div>';return}
    box.innerHTML=rows.map(q=>{const st=statusOf(q),statusText={missing:'待补原题',due:'到期复习',active:'学习中',mastered:'已掌握'}[st];return `<div class="wrong-card" data-wid="${esc(q.id)}"><div class="wrong-head"><div><b>${esc(q.subject)}｜${esc(q.taskTitle||'手动错题')} ${q.wrongNumber?`· 第${esc(q.wrongNumber)}题`:''}</b><div class="wrong-meta">${esc(q.sourceName||q.sourceType||'来源未补')}${q.page?` · ${esc(q.page)}`:''} · 掌握 ${Number(q.mastery)||1}/5</div></div><span class="badge ${st==='missing'?'wrong-missing':st==='due'?'wrong-due':st==='mastered'?'wrong-ok':''}">${statusText}</span></div><div class="wrong-original" data-original>${q.questionText?`<div class="wrong-text">${esc(q.questionText)}</div>`:''}${q.imagePath?'<div class="wrong-text muted">原题截图正在加载…</div>':(!q.questionText?'<div class="wrong-text wrong-missing">还没有保存原题原貌。请补截图或题干。</div>':'')}</div>${q.wrongReason?`<div style="margin-top:10px"><b>上次错因：</b>${esc(q.wrongReason)}</div>`:''}${q.correctIdea?`<details style="margin-top:8px"><summary>查看正确思路</summary><div class="wrong-text">${esc(q.correctIdea)}</div></details>`:''}<div class="task-actions" style="margin-top:12px"><button data-edit>补原题 / 编辑</button><button data-pass>二刷通过</button><button data-delete>删除</button></div></div>`}).join('');
    for(const q of rows){if(!q.imagePath)continue;const card=box.querySelector(`[data-wid="${CSS.escape(q.id)}"]`),ori=card?.querySelector('[data-original]');if(!ori)continue;const url=await signedUrl(q.imagePath);if(url){const img=document.createElement('img');img.src=url;img.alt='错题原题截图';ori.prepend(img);ori.querySelector('.muted')?.remove()}}
    box.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(b.closest('[data-wid]').dataset.wid)));
    box.querySelectorAll('[data-pass]').forEach(b=>b.addEventListener('click',()=>{const id=b.closest('[data-wid]').dataset.wid,q=state.wrongQuestions[id];if(!q)return;q.secondPass=true;q.mastery=Math.max(4,Number(q.mastery)||4);q.updatedAt=new Date().toISOString();q.reviewDates=[];save();render()}));
    box.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{const id=b.closest('[data-wid]').dataset.wid;if(confirm('删除这条错题记录？')){delete state.wrongQuestions[id];save();render()}}));
  }

  function openEditor(id){
    ensureStyles();const old=id?state.wrongQuestions[id]:null;
    const ov=document.createElement('div');ov.className='wrong-overlay';ov.innerHTML=`<div class="wrong-modal"><div class="section-head"><div><h3>${old?'补原题 / 编辑错题':'手动加入错题'}</h3><p class="muted">优先上传原题截图；系统生成题可以直接粘贴完整题面。</p></div><button type="button" data-close>×</button></div><div class="wrong-grid"><label>科目<select id="wSubject"><option>数学</option><option>408</option><option>英语</option><option>政治</option></select></label><label>题号<input id="wNumber" value="${esc(old?.wrongNumber||'')}" placeholder="如 7"></label><label>来源<input id="wSource" value="${esc(old?.sourceName||'')}" placeholder="如 汤家凤高数基础讲义"></label><label>页码/位置<input id="wPage" value="${esc(old?.page||'')}" placeholder="如 P18 / 例3"></label><label style="grid-column:1/-1">原题题干（系统题可直接粘贴）<textarea id="wText" placeholder="保留完整题干、选项、条件">${esc(old?.questionText||'')}</textarea></label><label style="grid-column:1/-1">原题截图<input id="wImage" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">讲义题建议直接截题目区域。上传截图需先登录云同步。</small></label><label style="grid-column:1/-1">错误原因<textarea id="wReason" placeholder="为什么错">${esc(old?.wrongReason||'')}</textarea></label><label style="grid-column:1/-1">正确思路<textarea id="wIdea" placeholder="二刷前可先留空，整理后补">${esc(old?.correctIdea||'')}</textarea></label><label>掌握程度<select id="wMastery"><option value="1">1 · 不会</option><option value="2">2 · 有印象</option><option value="3">3 · 基本会</option><option value="4">4 · 稳定</option><option value="5">5 · 能讲清</option></select></label><label>题目类型<select id="wType"><option value="讲义/题集">讲义/题集</option><option value="系统生成">系统生成</option><option value="真题">真题</option><option value="其他">其他</option></select></label></div><div id="wMsg" class="muted" style="margin-top:10px"></div><div class="wrong-actions"><button data-close>取消</button><button class="primary" data-save>保存错题</button></div></div>`;document.body.appendChild(ov);
    ov.querySelector('#wSubject').value=old?.subject||'数学';ov.querySelector('#wMastery').value=String(old?.mastery||2);ov.querySelector('#wType').value=old?.sourceType||'讲义/题集';
    ov.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>ov.remove()));
    ov.querySelector('[data-save]').addEventListener('click',async()=>{
      const msg=ov.querySelector('#wMsg'),file=ov.querySelector('#wImage').files?.[0];let imagePath=old?.imagePath||'';
      if(file){
        if(!window.kaoyanCloud?.client){msg.textContent='请先在页面顶部登录云同步，再上传截图。';return}
        const {data:{user}}=await window.kaoyanCloud.client.auth.getUser();if(!user){msg.textContent='请先登录云同步，再上传截图。';return}
        msg.textContent='正在上传原题截图…';const ext=(file.name.split('.').pop()||'jpg').toLowerCase();imagePath=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const {error}=await window.kaoyanCloud.client.storage.from(BUCKET).upload(imagePath,file,{upsert:false,contentType:file.type});if(error){msg.textContent=`截图上传失败：${error.message}`;return}
      }
      const rid=id||`wrong-manual-${Date.now()}`;const base=old||{};const date=base.assessmentDate||today();state.wrongQuestions[rid]={...base,id:rid,subject:ov.querySelector('#wSubject').value,wrongNumber:ov.querySelector('#wNumber').value.trim(),sourceName:ov.querySelector('#wSource').value.trim(),page:ov.querySelector('#wPage').value.trim(),questionText:ov.querySelector('#wText').value.trim(),imagePath,wrongReason:ov.querySelector('#wReason').value.trim(),correctIdea:ov.querySelector('#wIdea').value.trim(),mastery:Number(ov.querySelector('#wMastery').value)||2,sourceType:ov.querySelector('#wType').value,assessmentDate:date,reviewDates:base.reviewDates?.length?base.reviewDates:[1,3,7].map(x=>addDays(date,x)),secondPass:Boolean(base.secondPass),createdAt:base.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),taskTitle:base.taskTitle||'手动错题'};save();ov.remove();render();
    });
  }

  function init(){ensureUI();syncFromAssessments();const box=document.getElementById('todayTasks');if(box){new MutationObserver(()=>syncFromAssessments()).observe(box,{childList:true,subtree:true})}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.kaoyanWrongQuestions={render,openEditor,syncFromAssessments};
})();