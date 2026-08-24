(()=>{
  const TARGET_KEY='kaoyan_v7_target_date';
  const VOCAB_KEY='kaoyan_v7_vocab';
  const targetInput=document.getElementById('targetDateInput');
  const saveTarget=document.getElementById('saveTargetDate');
  const countdownDays=document.getElementById('countdownDays');
  const targetLabel=document.getElementById('targetDateLabel');
  const stageBox=document.querySelector('.stage-box');

  function targetDaysLeft(){
    const date=localStorage.getItem(TARGET_KEY)||'';
    if(!date)return null;
    const [y,m,d]=date.split('-').map(Number);
    const now=new Date();
    const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    const target=Date.UTC(y,m-1,d);
    return Math.ceil((target-today)/86400000);
  }
  function renderTarget(){
    const date=localStorage.getItem(TARGET_KEY)||'';
    if(targetInput)targetInput.value=date;
    const days=targetDaysLeft();
    if(days===null){
      if(countdownDays)countdownDays.textContent='--';
      if(targetLabel)targetLabel.textContent='请设置目标日期';
      return;
    }
    if(countdownDays)countdownDays.textContent=Math.max(0,days);
    if(targetLabel)targetLabel.textContent=days>=0?`目标日 ${date}`:`目标日 ${date} · 已过去 ${Math.abs(days)} 天`;
    if(stageBox&&typeof stageByDays==='function'){
      const stage=stageByDays(Math.max(0,days));
      const strong=stageBox.querySelector('strong'),small=stageBox.querySelector('small');
      if(strong)strong.textContent=stage[0];
      if(small)small.textContent=stage[1];
    }
  }
  try{
    daysLeft=function(){const v=targetDaysLeft();return v===null?999:Math.max(0,v)};
    renderCountdown=renderTarget;
  }catch(e){}
  if(saveTarget)saveTarget.addEventListener('click',()=>{
    const value=targetInput?.value||'';
    if(value)localStorage.setItem(TARGET_KEY,value);else localStorage.removeItem(TARGET_KEY);
    renderTarget();
    try{if(typeof generatePlan==='function')generatePlan(true)}catch(e){}
  });

  let vocab={};
  try{vocab=JSON.parse(localStorage.getItem(VOCAB_KEY)||'{}')||{}}catch(e){vocab={}}
  const saveVocabState=()=>localStorage.setItem(VOCAB_KEY,JSON.stringify(vocab));
  const todayKeyLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const val=id=>document.getElementById(id)?.value||'';
  const num=id=>Math.max(0,Number(val(id))||0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??''};
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function calcStreak(){
    let streak=0;const d=new Date();d.setHours(0,0,0,0);
    while(vocab[dateKey(d)]){streak++;d.setDate(d.getDate()-1)}
    return streak;
  }
  function weekStats(){
    const now=new Date();now.setHours(23,59,59,999);
    const monday=new Date(now);const day=(monday.getDay()+6)%7;monday.setDate(monday.getDate()-day);monday.setHours(0,0,0,0);
    let reviewed=0,newWords=0,minutes=0;
    Object.entries(vocab).forEach(([date,r])=>{const d=new Date(date+'T00:00:00');if(d>=monday&&d<=now){reviewed+=Number(r.reviewed)||0;newWords+=Number(r.newWords)||0;minutes+=Number(r.minutes)||0}});
    return {reviewed,newWords,minutes};
  }
  function trend7(){
    const rows=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const k=dateKey(d),r=vocab[k]||{};rows.push({date:k,label:`${d.getMonth()+1}/${d.getDate()}`,reviewed:Number(r.reviewed)||0,newWords:Number(r.newWords)||0})}
    return rows;
  }

  function renderVocab(){
    const today=vocab[todayKeyLocal()]||null;
    const rows=Object.entries(vocab).sort((a,b)=>b[0].localeCompare(a[0]));
    const latest=rows[0]?.[1]||{};
    const learned=Number(latest.learnedTotal)||0;
    const book=Math.max(1,Number(latest.bookTotal)||5683);
    const pct=Math.min(100,Math.round(learned/book*100));
    const reviewed7=rows.slice(0,7).reduce((s,[,r])=>s+(Number(r.reviewed)||0),0);
    const new7=rows.slice(0,7).reduce((s,[,r])=>s+(Number(r.newWords)||0),0);
    const min7=rows.slice(0,7).reduce((s,[,r])=>s+(Number(r.minutes)||0),0);
    const weak7=rows.slice(0,7).reduce((s,[,r])=>s+(Number(r.weak)||0),0);
    const badge=document.getElementById('vocabTodayBadge');if(badge)badge.textContent=today?`今日 复习${today.reviewed} · 新词${today.newWords}`:'今日未记录';
    const stats=document.getElementById('vocabStats');if(stats)stats.innerHTML=`<div class="metric"><span>当前已学</span><b>${learned}</b><small>/ ${book} 词</small></div><div class="metric"><span>当前待复习</span><b>${Number(latest.pending)||0}</b><small>墨墨队列</small></div><div class="metric"><span>近7天复习</span><b>${reviewed7}</b><small>新词 ${new7}</small></div><div class="metric"><span>近7天用时</span><b>${min7}m</b><small>模糊/忘记 ${weak7}</small></div>`;
    const pText=document.getElementById('vocabProgressText'),bar=document.getElementById('vocabProgressBar');if(pText)pText.textContent=`${pct}%`;if(bar)bar.style.width=pct+'%';
    const focus=document.getElementById('vocabFocus');if(focus)focus.textContent=rows.length?`已学 ${learned}/${book} · 待复习 ${Number(latest.pending)||0}`:'墨墨每日数据待记录';
    const history=document.getElementById('vocabHistory');if(history)history.innerHTML=rows.length?rows.slice(0,30).map(([date,r])=>`<div class="history-item"><div class="section-head"><div><b>${date}</b><div class="muted">已学 ${r.learnedTotal}/${r.bookTotal} · 待复习 ${r.pending}</div></div><span class="badge">${r.minutes}min</span></div><div class="muted">今日复习 ${r.reviewed} · 新词 ${r.newWords} · 模糊/忘记 ${r.weak||0}</div>${r.note?`<div style="margin-top:6px">${r.note}</div>`:''}</div>`).join(''):'<div class="empty">还没有墨墨记录。</div>';

    const streak=calcStreak(),week=weekStats(),trend=trend7();
    const streakEl=document.getElementById('vocabStreak'),streakBadge=document.getElementById('vocabStreakBadge');if(streakEl)streakEl.textContent=streak;if(streakBadge)streakBadge.textContent=`连续 ${streak} 天`;
    const wn=document.getElementById('vocabWeekNew'),wr=document.getElementById('vocabWeekReviewed'),wm=document.getElementById('vocabWeekMinutes');if(wn)wn.textContent=week.newWords;if(wr)wr.textContent=week.reviewed;if(wm)wm.textContent=week.minutes;
    const trendBox=document.getElementById('vocabTrend');
    if(trendBox){const max=Math.max(1,...trend.flatMap(x=>[x.reviewed,x.newWords]));trendBox.innerHTML=trend.map(x=>`<div style="display:flex;flex-direction:column;align-items:center;gap:5px"><div style="height:88px;display:flex;align-items:flex-end;gap:3px"><span title="复习 ${x.reviewed}" style="display:block;width:10px;height:${Math.max(3,Math.round(x.reviewed/max*82))}px;background:#64748b;border-radius:4px 4px 0 0"></span><span title="新增 ${x.newWords}" style="display:block;width:10px;height:${Math.max(3,Math.round(x.newWords/max*82))}px;background:#22c55e;border-radius:4px 4px 0 0"></span></div><small class="muted">${x.label}</small></div>`).join('')}

    if(today){set('vocabLearnedTotal',today.learnedTotal);set('vocabBookTotal',today.bookTotal);set('vocabPending',today.pending);set('vocabReviewed',today.reviewed);set('vocabNew',today.newWords);set('vocabMinutes',today.minutes);set('vocabWeak',today.weak);set('vocabNote',today.note||'')}
    else if(latest.bookTotal)set('vocabBookTotal',latest.bookTotal);
  }

  document.getElementById('saveVocab')?.addEventListener('click',()=>{
    const date=todayKeyLocal();
    vocab[date]={learnedTotal:num('vocabLearnedTotal'),bookTotal:Math.max(1,num('vocabBookTotal')||5683),pending:num('vocabPending'),reviewed:num('vocabReviewed'),newWords:num('vocabNew'),minutes:num('vocabMinutes'),weak:num('vocabWeak'),note:val('vocabNote').trim()};
    saveVocabState();renderVocab();
  });

  window.addEventListener('DOMContentLoaded',()=>{renderTarget();renderVocab()},{once:true});
  setTimeout(()=>{renderTarget();renderVocab()},300);
})();
