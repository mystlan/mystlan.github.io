(()=>{
  if(typeof state==='undefined'||typeof save!=='function'||typeof allTasks!=='function'||typeof renderToday!=='function')return;
  state.taskAssessments=state.taskAssessments||{};
  state.reviewSchedule=state.reviewSchedule||[];
  state.wrongQuestions=state.wrongQuestions||{};

  const CORE_SUBJECTS=new Set(['数学','408','英语','政治']);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>v==null?'—':`${Math.round(v*100)}%`;
  const addDays=(dateStr,days)=>{const [y,m,d]=dateStr.split('-').map(Number),x=new Date(y,m-1,d);x.setDate(x.getDate()+days);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};

  function modeOf(task){
    const s=String(task.subject||''),t=String(task.title||'').toLowerCase();
    if(s==='词汇'||/墨墨|单词|词汇|vocab|背单词/.test(t))return 'vocab';
    if(/音频|通勤|碎片|复盘|打卡|公式回想|公式默写|回看卡片|错题卡片/.test(t))return 'habit';
    if(/做题|练习|专项|真题|选择题|阅读|长难句|例题|习题|刷题|测试|验收|计算|证明|编程|代码/.test(t))return 'practice';
    if(/概念|定义|讲义|课程|视频|看课|理解|学习|重建|基础|知识点|复习/.test(t))return 'learn';
    return CORE_SUBJECTS.has(s)?'learn':'habit';
  }

  const modeMeta={
    practice:{name:'做题验收',desc:'用正确率、得分和掌握程度判断是否真正通过。'},
    learn:{name:'知识掌握验收',desc:'不硬填做题数据，只判断能否讲清、掌握程度和卡点。'},
    vocab:{name:'词汇任务',desc:'词汇详细数据去“词汇”模块记录；这里只确认任务是否完成。'},
    habit:{name:'轻任务确认',desc:'音频、复盘、碎片任务不做复杂验收，只记录完成状态和备注。'}
  };

  function ensureStyles(){
    if(document.getElementById('taskAcceptanceStyles'))return;
    const s=document.createElement('style');s.id='taskAcceptanceStyles';s.textContent=`
      .acceptance-summary{margin-top:10px;padding:9px 10px;border:1px dashed #d0d5dd;border-radius:10px;font-size:12px;color:#475467;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.acceptance-summary b{color:#101828}.acceptance-chip{padding:3px 7px;border-radius:999px;background:#f2f4f7}.acceptance-pass{color:#067647}.acceptance-relearn{color:#b42318}
      .acceptance-overlay{position:fixed;inset:0;background:rgba(15,23,42,.46);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}.acceptance-modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.2)}.acceptance-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.acceptance-head h3{margin:0 0 4px}.acceptance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.acceptance-grid label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#344054}.acceptance-grid input,.acceptance-grid select,.acceptance-grid textarea{font:inherit;font-size:16px;padding:10px 11px;border:1px solid #d0d5dd;border-radius:10px;background:#fff}.acceptance-grid textarea{min-height:88px;resize:vertical}.acceptance-wide{grid-column:1/-1}.acceptance-result{margin-top:14px;padding:12px;border-radius:12px;background:#f8fafc;font-size:13px;line-height:1.6}.acceptance-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}.acceptance-actions button{min-height:42px}.acceptance-close{border:none;background:transparent;font-size:20px;line-height:1;padding:6px;cursor:pointer}.acceptance-note{font-size:12px;color:#667085}.wrong-entry-box{grid-column:1/-1;padding:12px;border:1px dashed #f79009;border-radius:12px;background:#fffcf5}.wrong-entry-box textarea{min-height:130px}.acceptance-mode{display:inline-flex;margin-top:6px;padding:4px 8px;border-radius:999px;background:#f2f4f7;font-size:12px;color:#344054}
      @media(max-width:560px){.acceptance-grid{grid-template-columns:1fr}.acceptance-wide,.wrong-entry-box{grid-column:auto}.acceptance-modal{padding:15px;border-radius:14px}}
    `;document.head.appendChild(s);
  }

  function removeOldReviews(taskId){state.customTasks=state.customTasks.filter(x=>x.parentTaskId!==taskId||!x.autoReview);state.reviewSchedule=state.reviewSchedule.filter(x=>x.parentTaskId!==taskId)}
  function createReviews(task,assessment){
    removeOldReviews(task.id);if(!CORE_SUBJECTS.has(task.subject)||!['practice','learn'].includes(assessment.mode))return;const base=todayKey();
    [1,3,7].forEach(offset=>{const date=addDays(base,offset),isRelearn=offset===1&&!assessment.pass,title=isRelearn?`补学 + D+1复习：${task.title}`:`D+${offset}复习：${task.title}`,minutes=isRelearn?Math.max(20,Math.min(45,Math.round((Number(task.minutes)||30)*.65/5)*5)):Math.max(10,Math.min(25,Math.round((Number(task.minutes)||30)*.35/5)*5)),id=`review-${task.id}-${offset}`;state.customTasks.push({id,date,subject:task.subject,title,minutes,autoReview:true,parentTaskId:task.id,reviewOffset:offset});state.reviewSchedule.push({id,parentTaskId:task.id,date,subject:task.subject,title,minutes,offset,status:'due'})});
  }

  function upsertWrongQuestion(task,text,assessment){
    const clean=String(text||'').trim(),id=`wrong-task-${task.id}`;
    if(!clean){if(state.wrongQuestions[id]?.fromAcceptance)delete state.wrongQuestions[id];return null}
    const old=state.wrongQuestions[id]||{},date=todayKey();
    state.wrongQuestions[id]={...old,id,fromAcceptance:true,taskId:task.id,taskTitle:task.title,subject:task.subject,questionText:clean,sourceName:old.sourceName||'任务验收录入',wrongReason:assessment.maxBlock||old.wrongReason||'',correctIdea:old.correctIdea||'',mastery:assessment.mastery||old.mastery||2,secondPass:Boolean(old.secondPass),assessmentDate:date,reviewDates:old.reviewDates?.length?old.reviewDates:[1,3,7].map(x=>addDays(date,x)),createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    return id;
  }

  function practiceFields(old,oldWrong){return `<label>验收得分（0–100）<input id="accScore" type="number" min="0" max="100" value="${old.score??''}" placeholder="可不填，按正确率折算"></label><label>掌握程度<select id="accMastery"><option value="1">1 · 基本不会</option><option value="2">2 · 有印象</option><option value="3">3 · 基本会做</option><option value="4">4 · 比较稳定</option><option value="5">5 · 能独立讲清</option></select></label><label>做题数<input id="accTotal" type="number" min="0" value="${old.total??''}" placeholder="如 8"></label><label>正确数<input id="accCorrect" type="number" min="0" value="${old.correct??''}" placeholder="如 6"></label><label class="acceptance-wide">正确率（自动计算）<input id="accAccuracy" readonly value="${old.accuracy==null?'—':pct(old.accuracy)}"></label><label class="acceptance-wide">最大卡点<textarea id="accBlock" placeholder="卡在哪一步、哪个知识点">${esc(old.maxBlock||'')}</textarea></label><div class="wrong-entry-box"><label>❌ 错题录入（可选）<textarea id="accWrongText" placeholder="只粘贴真正值得复习的完整错题原文；保存后自动同步错题库。">${esc(oldWrong.questionText||old.wrongQuestionText||'')}</textarea></label><div class="acceptance-note">没有值得留的错题就留空，不会生成记录。</div></div>`}
  function learnFields(old){return `<label>掌握程度<select id="accMastery"><option value="1">1 · 基本没懂</option><option value="2">2 · 有印象</option><option value="3">3 · 基本理解</option><option value="4">4 · 能独立说明</option><option value="5">5 · 能讲清并应用</option></select></label><label>能否不看资料讲清？<select id="accExplain"><option value="no">还不能</option><option value="mostly">大部分可以</option><option value="yes">可以</option></select></label><label class="acceptance-wide">最大卡点<textarea id="accBlock" placeholder="还没弄懂的概念、条件或逻辑">${esc(old.maxBlock||'')}</textarea></label>`}
  function lightFields(old,mode){return `<label>完成情况<select id="accSimpleStatus"><option value="done">已完成</option><option value="partial">部分完成</option><option value="stuck">卡住 / 未完成</option></select></label><label class="acceptance-wide">${mode==='vocab'?'备注（可选）':'备注 / 卡点（可选）'}<textarea id="accBlock" placeholder="${mode==='vocab'?'具体词汇数据请到“词汇”模块记录':'只写对后续安排有用的信息'}">${esc(old.maxBlock||'')}</textarea></label>`}

  function openModal(task){
    ensureStyles();document.querySelector('.acceptance-overlay')?.remove();const old=state.taskAssessments[task.id]||{},mode=modeOf(task),meta=modeMeta[mode],oldWrong=state.wrongQuestions[`wrong-task-${task.id}`]||{};
    const fields=mode==='practice'?practiceFields(old,oldWrong):mode==='learn'?learnFields(old):lightFields(old,mode);
    const overlay=document.createElement('div');overlay.className='acceptance-overlay';overlay.innerHTML=`<div class="acceptance-modal" role="dialog" aria-modal="true"><div class="acceptance-head"><div><h3>任务验收</h3><div class="acceptance-note">${esc(task.subject)}｜${esc(task.title)}</div><span class="acceptance-mode">${meta.name}</span><div class="acceptance-note" style="margin-top:6px">${meta.desc}</div></div><button type="button" class="acceptance-close">×</button></div><div class="acceptance-grid">${fields}</div><div id="accResult" class="acceptance-result"></div><div class="acceptance-actions"><button type="button" data-cancel>取消</button><button type="button" class="primary" data-save>保存验收</button></div></div>`;
    document.body.appendChild(overlay);
    if(overlay.querySelector('#accMastery'))overlay.querySelector('#accMastery').value=String(old.mastery||3);
    if(overlay.querySelector('#accExplain'))overlay.querySelector('#accExplain').value=old.canExplain||'no';
    if(overlay.querySelector('#accSimpleStatus'))overlay.querySelector('#accSimpleStatus').value=old.simpleStatus||'done';
    const close=()=>overlay.remove();overlay.querySelector('.acceptance-close').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close()});

    const refresh=()=>{
      let pass=false,strong=false,score=null,accuracy=null,mastery=null,summary='';
      if(mode==='practice'){
        const total=Number(overlay.querySelector('#accTotal').value)||0,correct=Number(overlay.querySelector('#accCorrect').value)||0;accuracy=total>0?Math.max(0,Math.min(1,correct/total)):null;const raw=overlay.querySelector('#accScore').value;score=raw===''?(accuracy==null?0:Math.round(accuracy*100)):Math.max(0,Math.min(100,Number(raw)||0));mastery=Math.max(1,Math.min(5,Number(overlay.querySelector('#accMastery').value)||1));pass=score>=70&&(accuracy==null||accuracy>=.6)&&mastery>=3;strong=score>=85&&(accuracy==null||accuracy>=.8)&&mastery>=4;overlay.querySelector('#accAccuracy').value=pct(accuracy);summary=pass?(strong?'验收通过 · 掌握较稳，进入 1/3/7 天巩固。':'验收通过 · 继续用 1/3/7 天复习加固。'):'需要补学 · 明天优先安排补学 + D+1。';
      }else if(mode==='learn'){
        mastery=Math.max(1,Math.min(5,Number(overlay.querySelector('#accMastery').value)||1));const can=overlay.querySelector('#accExplain').value;pass=mastery>=3&&can!=='no';strong=mastery>=4&&can==='yes';score=strong?90:pass?75:50;summary=pass?(strong?'掌握较稳 · 能独立讲清，进入间隔复习。':'基本掌握 · 仍需通过 1/3/7 天复习稳定。'):'尚未掌握 · 不继续堆新内容，先补清当前卡点。';
      }else{
        const st=overlay.querySelector('#accSimpleStatus').value;pass=st==='done';score=pass?100:st==='partial'?60:30;summary=mode==='vocab'?(pass?'任务已完成 · 详细词汇数据在“词汇”模块记录。':st==='partial'?'部分完成 · 不补复杂验收数据。':'今天未完成 · 后续计划可据此降负荷或补回。'):(pass?'已完成 · 轻任务不生成额外复习链。':st==='partial'?'部分完成 · 仅记录，不做复杂判定。':'已标记卡住 / 未完成。');
      }
      const result=overlay.querySelector('#accResult');result.innerHTML=`<b class="${pass?'acceptance-pass':'acceptance-relearn'}">${pass?'通过':'未通过'}</b> · ${summary}`;return {pass,strong,score,accuracy,mastery};
    };
    overlay.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refresh));refresh();

    overlay.querySelector('[data-save]').onclick=()=>{
      const r=refresh(),maxBlock=overlay.querySelector('#accBlock')?.value.trim()||'';let assessment={taskId:task.id,subject:task.subject,title:task.title,date:todayKey(),mode,score:r.score,accuracy:r.accuracy,mastery:r.mastery,result:r.pass?'pass':'relearn',strong:r.strong,maxBlock,assessedAt:new Date().toISOString(),pass:r.pass};
      if(mode==='practice'){
        const q=Math.max(0,Math.floor(Number(overlay.querySelector('#accTotal').value)||0)),c=Math.max(0,Math.floor(Number(overlay.querySelector('#accCorrect').value)||0));if(q>0&&c>q){alert('正确数不能大于做题数。');return}const wrongQuestionText=overlay.querySelector('#accWrongText').value.trim();assessment={...assessment,total:q||null,correct:q?c:null,wrongQuestionText};upsertWrongQuestion(task,wrongQuestionText,assessment);
      }else if(mode==='learn')assessment.canExplain=overlay.querySelector('#accExplain').value;
      else assessment.simpleStatus=overlay.querySelector('#accSimpleStatus').value;
      state.taskAssessments[task.id]=assessment;
      state.taskStatus[task.id]=r.pass?'done':(mode==='practice'?(r.score<60||r.mastery<=2?'stuck':'partial'):(mode==='learn'?(r.mastery<=2?'stuck':'partial'):(assessment.simpleStatus||'partial')));
      createReviews(task,assessment);save();close();renderToday();try{renderReview()}catch(e){}try{window.kaoyanWrongQuestions?.render?.()}catch(e){}
    };
  }

  function decorate(){
    ensureStyles();const tasks=allTasks(),cards=[...document.querySelectorAll('#todayTasks .task-card')];cards.forEach((card,i)=>{const task=tasks[i];if(!task)return;const a=state.taskAssessments[task.id],doneBtn=card.querySelector('[data-s="done"]');if(doneBtn)doneBtn.textContent=a?'重新验收':'验收完成';if(!a)return;const mode=a.mode||modeOf(task);let detail='';if(mode==='practice')detail=`<span class="acceptance-chip">得分 ${Math.round(a.score||0)}</span><span class="acceptance-chip">正确率 ${pct(a.accuracy)}</span><span class="acceptance-chip">掌握 ${a.mastery||1}/5</span>${a.wrongQuestionText?'<span>❌ 错题已同步</span>':''}`;else if(mode==='learn')detail=`<span class="acceptance-chip">掌握 ${a.mastery||1}/5</span><span>${a.canExplain==='yes'?'能讲清':a.canExplain==='mostly'?'大部分能讲':'还不能讲清'}</span>`;else detail=`<span>${a.simpleStatus==='done'?'已完成':a.simpleStatus==='partial'?'部分完成':'卡住 / 未完成'}</span>`;const sum=document.createElement('div');sum.className='acceptance-summary';sum.innerHTML=`<b>${a.result==='pass'?'✅ 验收通过':'🧩 未通过'}</b><span class="acceptance-chip">${modeMeta[mode]?.name||'任务验收'}</span>${detail}${a.maxBlock?`<span>卡点：${esc(a.maxBlock)}</span>`:''}`;card.appendChild(sum)})
  }

  const baseRenderToday=renderToday;renderToday=function(){baseRenderToday();decorate()};
  const baseRenderReview=typeof renderReview==='function'?renderReview:null;if(baseRenderReview){renderReview=function(){baseRenderReview();const due=document.getElementById('dueList');if(!due)return;const t=todayKey(),rows=(state.reviewSchedule||[]).filter(x=>x.date<=t).sort((a,b)=>a.date.localeCompare(b.date));if(rows.length)due.innerHTML=rows.slice(-12).reverse().map(x=>`<div class="history-item">📌 ${esc(x.date)} · ${esc(x.subject)}｜${esc(x.title)}</div>`).join('')}}
  document.getElementById('todayTasks')?.addEventListener('click',e=>{const btn=e.target.closest('button[data-s="done"]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();const card=btn.closest('.task-card'),cards=[...document.querySelectorAll('#todayTasks .task-card')],task=allTasks()[cards.indexOf(card)];if(task)openModal(task)},true);
  decorate();try{renderReview()}catch(e){}
})();