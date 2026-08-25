(()=>{
  if(typeof state==='undefined'||typeof save!=='function'||typeof allTasks!=='function'||typeof renderToday!=='function')return;
  state.taskAssessments=state.taskAssessments||{};
  state.reviewSchedule=state.reviewSchedule||[];
  state.wrongQuestions=state.wrongQuestions||{};

  const CORE_SUBJECTS=new Set(['数学','408','英语','政治']);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>v==null?'—':`${Math.round(v*100)}%`;
  const addDays=(dateStr,days)=>{const [y,m,d]=dateStr.split('-').map(Number),x=new Date(y,m-1,d);x.setDate(x.getDate()+days);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};

  function ensureStyles(){
    if(document.getElementById('taskAcceptanceStyles'))return;
    const s=document.createElement('style');s.id='taskAcceptanceStyles';s.textContent=`
      .acceptance-summary{margin-top:10px;padding:9px 10px;border:1px dashed #d0d5dd;border-radius:10px;font-size:12px;color:#475467;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.acceptance-summary b{color:#101828}.acceptance-chip{padding:3px 7px;border-radius:999px;background:#f2f4f7}.acceptance-pass{color:#067647}.acceptance-relearn{color:#b42318}
      .acceptance-overlay{position:fixed;inset:0;background:rgba(15,23,42,.46);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}.acceptance-modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.2)}.acceptance-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.acceptance-head h3{margin:0 0 4px}.acceptance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.acceptance-grid label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#344054}.acceptance-grid input,.acceptance-grid select,.acceptance-grid textarea{font:inherit;font-size:16px;padding:10px 11px;border:1px solid #d0d5dd;border-radius:10px;background:#fff}.acceptance-grid textarea{min-height:88px;resize:vertical}.acceptance-wide{grid-column:1/-1}.acceptance-result{margin-top:14px;padding:12px;border-radius:12px;background:#f8fafc;font-size:13px;line-height:1.6}.acceptance-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}.acceptance-actions button{min-height:42px}.acceptance-close{border:none;background:transparent;font-size:20px;line-height:1;padding:6px;cursor:pointer}.acceptance-note{font-size:12px;color:#667085}.wrong-entry-box{grid-column:1/-1;padding:12px;border:1px dashed #f79009;border-radius:12px;background:#fffcf5}.wrong-entry-box textarea{min-height:130px}
      @media(max-width:560px){.acceptance-grid{grid-template-columns:1fr}.acceptance-wide,.wrong-entry-box{grid-column:auto}.acceptance-modal{padding:15px;border-radius:14px}}
    `;document.head.appendChild(s);
  }

  function compute(total,correct,score,mastery){
    const q=Number(total),c=Number(correct),acc=q>0?Math.max(0,Math.min(1,c/q)):null;
    let finalScore=Number(score);if(!Number.isFinite(finalScore)||score==='')finalScore=acc==null?0:Math.round(acc*100);
    finalScore=Math.max(0,Math.min(100,finalScore));const m=Math.max(1,Math.min(5,Number(mastery)||1));
    const pass=finalScore>=70&&(acc==null||acc>=.6)&&m>=3,strong=finalScore>=85&&(acc==null||acc>=.8)&&m>=4;
    return {acc,score:finalScore,mastery:m,pass,strong};
  }

  function removeOldReviews(taskId){state.customTasks=state.customTasks.filter(x=>x.parentTaskId!==taskId||!x.autoReview);state.reviewSchedule=state.reviewSchedule.filter(x=>x.parentTaskId!==taskId)}
  function createReviews(task,assessment){
    removeOldReviews(task.id);if(!CORE_SUBJECTS.has(task.subject))return;const base=todayKey();
    [1,3,7].forEach(offset=>{const date=addDays(base,offset),isRelearn=offset===1&&!assessment.pass,title=isRelearn?`补学 + D+1复习：${task.title}`:`D+${offset}复习：${task.title}`,minutes=isRelearn?Math.max(20,Math.min(45,Math.round((Number(task.minutes)||30)*.65/5)*5)):Math.max(10,Math.min(25,Math.round((Number(task.minutes)||30)*.35/5)*5)),id=`review-${task.id}-${offset}`;state.customTasks.push({id,date,subject:task.subject,title,minutes,autoReview:true,parentTaskId:task.id,reviewOffset:offset});state.reviewSchedule.push({id,parentTaskId:task.id,date,subject:task.subject,title,minutes,offset,status:'due'})});
  }
  function decisionText(a){if(a.strong)return '验收通过 · 掌握较稳，按 1/3/7 天复习巩固。';if(a.pass)return '验收通过 · 稳定性一般，按 1/3/7 天继续加固。';return '需要补学 · 明天安排补学 + D+1，并保留 D+3 / D+7。'}

  function upsertWrongQuestion(task,text,assessment){
    const clean=String(text||'').trim(),id=`wrong-task-${task.id}`;
    if(!clean){if(state.wrongQuestions[id]?.fromAcceptance)delete state.wrongQuestions[id];return null}
    const old=state.wrongQuestions[id]||{},date=todayKey();
    state.wrongQuestions[id]={...old,id,fromAcceptance:true,taskId:task.id,taskTitle:task.title,subject:task.subject,questionText:clean,sourceName:old.sourceName||'任务验收录入',wrongReason:assessment.maxBlock||old.wrongReason||'',correctIdea:old.correctIdea||'',mastery:assessment.mastery||old.mastery||2,secondPass:Boolean(old.secondPass),assessmentDate:date,reviewDates:old.reviewDates?.length?old.reviewDates:[1,3,7].map(x=>addDays(date,x)),createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    return id;
  }

  function openModal(task){
    ensureStyles();document.querySelector('.acceptance-overlay')?.remove();const old=state.taskAssessments[task.id]||{},oldWrong=state.wrongQuestions[`wrong-task-${task.id}`]||{};
    const overlay=document.createElement('div');overlay.className='acceptance-overlay';overlay.innerHTML=`<div class="acceptance-modal" role="dialog" aria-modal="true"><div class="acceptance-head"><div><h3>任务验收</h3><div class="acceptance-note">${esc(task.subject)}｜${esc(task.title)}</div></div><button type="button" class="acceptance-close">×</button></div><div class="acceptance-grid"><label>验收得分（0–100）<input id="accScore" type="number" min="0" max="100" value="${old.score??''}" placeholder="不填时按正确率折算"></label><label>掌握程度<select id="accMastery"><option value="1">1 · 基本不会</option><option value="2">2 · 有印象</option><option value="3">3 · 基本会做</option><option value="4">4 · 比较稳定</option><option value="5">5 · 能独立讲清</option></select></label><label>做题数<input id="accTotal" type="number" min="0" value="${old.total??''}" placeholder="如 8"></label><label>正确数<input id="accCorrect" type="number" min="0" value="${old.correct??''}" placeholder="如 6"></label><label class="acceptance-wide">正确率（自动计算）<input id="accAccuracy" readonly value="${old.accuracy==null?'—':pct(old.accuracy)}"></label><label class="acceptance-wide">最大卡点<textarea id="accBlock" placeholder="一句话写清卡在哪一步">${esc(old.maxBlock||'')}</textarea></label><div class="wrong-entry-box"><label>❌ 错题录入（可选）<textarea id="accWrongText" placeholder="直接粘贴完整错题原文。保存验收后会自动同步到错题库；没有错题就留空。">${esc(oldWrong.questionText||old.wrongQuestionText||'')}</textarea></label><div class="acceptance-note">这里不填题号，只放你以后复习时能直接重新看到并作答的完整题目文本。</div></div></div><div id="accResult" class="acceptance-result"></div><div class="acceptance-actions"><button type="button" data-cancel>取消</button><button type="button" class="primary" data-save>保存验收</button></div></div>`;
    document.body.appendChild(overlay);overlay.querySelector('#accMastery').value=String(old.mastery||3);
    const close=()=>overlay.remove();overlay.querySelector('.acceptance-close').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    const score=overlay.querySelector('#accScore'),total=overlay.querySelector('#accTotal'),correct=overlay.querySelector('#accCorrect'),mastery=overlay.querySelector('#accMastery'),accOut=overlay.querySelector('#accAccuracy'),result=overlay.querySelector('#accResult');
    const refresh=()=>{const r=compute(total.value,correct.value,score.value,mastery.value);accOut.value=pct(r.acc);result.innerHTML=`<b class="${r.pass?'acceptance-pass':'acceptance-relearn'}">${r.pass?'通过':'需补学'}</b> · ${decisionText(r)}`;return r};[score,total,correct,mastery].forEach(el=>el.addEventListener('input',refresh));refresh();
    overlay.querySelector('[data-save]').onclick=()=>{const q=Math.max(0,Math.floor(Number(total.value)||0)),c=Math.max(0,Math.floor(Number(correct.value)||0));if(q>0&&c>q){alert('正确数不能大于做题数。');return}const r=refresh(),maxBlock=overlay.querySelector('#accBlock').value.trim(),wrongQuestionText=overlay.querySelector('#accWrongText').value.trim(),assessment={taskId:task.id,subject:task.subject,title:task.title,date:todayKey(),score:r.score,total:q||null,correct:q?c:null,accuracy:r.acc,maxBlock,mastery:r.mastery,result:r.pass?'pass':'relearn',strong:r.strong,wrongQuestionText,assessedAt:new Date().toISOString()};state.taskAssessments[task.id]=assessment;state.taskStatus[task.id]=r.pass?'done':(r.score<60||r.mastery<=2?'stuck':'partial');createReviews(task,assessment);upsertWrongQuestion(task,wrongQuestionText,assessment);save();close();renderToday();try{renderReview()}catch(e){}try{window.kaoyanWrongQuestions?.render?.()}catch(e){}};
  }

  function decorate(){ensureStyles();const tasks=allTasks(),cards=[...document.querySelectorAll('#todayTasks .task-card')];cards.forEach((card,i)=>{const task=tasks[i];if(!task)return;const a=state.taskAssessments[task.id],doneBtn=card.querySelector('[data-s="done"]');if(doneBtn)doneBtn.textContent=a?'重新验收':'验收完成';if(a){const sum=document.createElement('div');sum.className='acceptance-summary';sum.innerHTML=`<b>${a.result==='pass'?'✅ 验收通过':'🧩 需补学'}</b><span class="acceptance-chip">得分 ${Math.round(a.score)}</span><span class="acceptance-chip">正确率 ${pct(a.accuracy)}</span><span class="acceptance-chip">掌握 ${a.mastery}/5</span>${a.wrongQuestionText?'<span>❌ 错题已同步</span>':''}${a.maxBlock?`<span>卡点：${esc(a.maxBlock)}</span>`:''}`;card.appendChild(sum)}})}

  const baseRenderToday=renderToday;renderToday=function(){baseRenderToday();decorate()};
  const baseRenderReview=typeof renderReview==='function'?renderReview:null;if(baseRenderReview){renderReview=function(){baseRenderReview();const due=document.getElementById('dueList');if(!due)return;const t=todayKey(),rows=(state.reviewSchedule||[]).filter(x=>x.date<=t).sort((a,b)=>a.date.localeCompare(b.date));if(rows.length)due.innerHTML=rows.slice(-12).reverse().map(x=>`<div class="history-item">📌 ${esc(x.date)} · ${esc(x.subject)}｜${esc(x.title)}</div>`).join('')}}
  document.getElementById('todayTasks')?.addEventListener('click',e=>{const btn=e.target.closest('button[data-s="done"]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();const card=btn.closest('.task-card'),cards=[...document.querySelectorAll('#todayTasks .task-card')],task=allTasks()[cards.indexOf(card)];if(task)openModal(task)},true);
  decorate();try{renderReview()}catch(e){}
})();