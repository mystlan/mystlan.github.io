(()=>{
  const SUPABASE_URL='https://bojwshfjozqbwhzdypdy.supabase.co';
  const SUPABASE_KEY='sb_publishable_FO76xCB6bhy34N6gqlk-jQ_00OH6GUo';
  const APP_KEY='kaoyan_v7_state';
  const VOCAB_KEY='kaoyan_v7_vocab';
  const FRAG_KEY='kaoyan_v7_fragment_pool';
  const TARGET_KEY='kaoyan_v7_target_date';
  const SYNC_USER_KEY='kaoyan_v7_cloud_user';
  const LAST_SYNC_KEY='kaoyan_v7_cloud_last_sync';
  const WATCHED=new Set([APP_KEY,VOCAB_KEY,FRAG_KEY,TARGET_KEY]);

  if(!window.supabase?.createClient){
    console.warn('Supabase client unavailable; cloud sync disabled.');
    return;
  }

  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  window.kaoyanCloud={client};

  const originalSetItem=Storage.prototype.setItem;
  const originalRemoveItem=Storage.prototype.removeItem;
  let syncTimer=null;
  let syncing=false;
  let pulling=false;
  let currentUser=null;
  let suppressSync=false;
  let authPanel=null;
  let realtimeChannel=null;

  const safeParse=(key,fallback)=>{
    try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(e){return fallback}
  };
  const snapshot=()=>({
    state:safeParse(APP_KEY,{}),
    vocab:safeParse(VOCAB_KEY,{}),
    fragments:safeParse(FRAG_KEY,[]),
    target_date:localStorage.getItem(TARGET_KEY)||null
  });
  const stampMs=v=>{const n=v?Date.parse(v):NaN;return Number.isFinite(n)?n:0};

  function setCloudStatus(text,tone='muted'){
    const el=document.getElementById('cloudSyncStatus');
    if(!el)return;
    el.textContent=text;
    el.dataset.tone=tone;
    el.style.color=tone==='ok'?'#067647':tone==='warn'?'#b54708':tone==='bad'?'#b42318':'#667085';
  }
  function humanTime(iso){
    if(!iso)return '未同步';
    const d=new Date(iso);
    return Number.isNaN(d.getTime())?'未同步':d.toLocaleString();
  }
  function buildAuthPanel(){
    if(authPanel)return;
    const shell=document.querySelector('.app-shell');
    const top=document.querySelector('.topbar');
    if(!shell||!top)return;
    const panel=document.createElement('article');
    panel.id='cloudAuthPanel';
    panel.className='panel';
    panel.style.marginBottom='14px';
    panel.innerHTML=`
      <div class="section-head">
        <div><h2>☁️ 云端同步</h2><p>登录后，任务、墨墨、碎片池、目标日期和历史记录会自动跨设备同步。</p></div>
        <span id="cloudSyncBadge" class="badge">未登录</span>
      </div>
      <div id="cloudLoggedOut" class="cloud-auth-form" style="display:grid;grid-template-columns:minmax(180px,1fr) minmax(160px,1fr) auto auto;gap:10px;margin-top:14px">
        <input id="cloudEmail" type="email" autocomplete="email" placeholder="邮箱">
        <input id="cloudPassword" type="password" autocomplete="current-password" placeholder="密码（至少6位）">
        <button id="cloudSignIn" type="button" class="primary">登录</button>
        <button id="cloudSignUp" type="button">注册</button>
      </div>
      <div id="cloudLoggedIn" style="display:none;margin-top:14px">
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div><b id="cloudUserEmail">—</b><div id="cloudSyncStatus" class="muted" style="font-size:12px;margin-top:3px">准备同步…</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button id="cloudSyncNow" type="button">立即同步</button><button id="cloudPullNow" type="button">从云端刷新</button><button id="cloudSignOut" type="button">退出登录</button></div>
        </div>
      </div>
      <div id="cloudAuthMessage" class="muted" style="font-size:12px;margin-top:10px"></div>`;
    top.insertAdjacentElement('afterend',panel);
    authPanel=panel;

    const email=panel.querySelector('#cloudEmail');
    const password=panel.querySelector('#cloudPassword');
    panel.querySelector('#cloudSignIn').addEventListener('click',async()=>{
      const e=email.value.trim(),p=password.value;
      if(!e||p.length<6){showAuthMessage('请输入有效邮箱和至少 6 位密码。','bad');return}
      showAuthMessage('正在登录…');
      const {error}=await client.auth.signInWithPassword({email:e,password:p});
      if(error){showAuthMessage(`登录失败：${error.message}`,'bad');return}
      showAuthMessage('登录成功，正在同步…','ok');
    });
    panel.querySelector('#cloudSignUp').addEventListener('click',async()=>{
      const e=email.value.trim(),p=password.value;
      if(!e||p.length<6){showAuthMessage('请输入有效邮箱和至少 6 位密码。','bad');return}
      showAuthMessage('正在注册…');
      const {data,error}=await client.auth.signUp({email:e,password:p});
      if(error){showAuthMessage(`注册失败：${error.message}`,'bad');return}
      if(data.session)showAuthMessage('注册并登录成功，正在同步…','ok');
      else showAuthMessage('注册成功。若收到验证邮件，请先验证邮箱，然后回来登录。','warn');
    });
    panel.querySelector('#cloudSignOut').addEventListener('click',async()=>{
      if(realtimeChannel){await client.removeChannel(realtimeChannel);realtimeChannel=null;}
      await client.auth.signOut();
      currentUser=null;
      originalRemoveItem.call(localStorage,SYNC_USER_KEY);
      updateAuthUI(null);
    });
    panel.querySelector('#cloudSyncNow').addEventListener('click',()=>pushSnapshot(true));
    panel.querySelector('#cloudPullNow').addEventListener('click',()=>pullSnapshot(true,true));
  }
  function showAuthMessage(text,tone='muted'){
    const el=document.getElementById('cloudAuthMessage');
    if(!el)return;
    el.textContent=text;
    el.style.color=tone==='ok'?'#067647':tone==='warn'?'#b54708':tone==='bad'?'#b42318':'#667085';
  }
  function updateAuthUI(user){
    buildAuthPanel();
    const out=document.getElementById('cloudLoggedOut'),inside=document.getElementById('cloudLoggedIn'),badge=document.getElementById('cloudSyncBadge'),email=document.getElementById('cloudUserEmail');
    if(!out||!inside||!badge)return;
    if(user){
      out.style.display='none';inside.style.display='block';badge.textContent='已连接云端';if(email)email.textContent=user.email||'已登录';
      const last=localStorage.getItem(LAST_SYNC_KEY);setCloudStatus(last?`本机已同步：${humanTime(last)}`:'已登录，等待首次同步');
    }else{
      out.style.display='grid';inside.style.display='none';badge.textContent='未登录';showAuthMessage('不登录也可继续使用，但只保存在当前浏览器。');
    }
  }

  function applyCloudData(data,reload=true){
    suppressSync=true;
    try{
      originalSetItem.call(localStorage,APP_KEY,JSON.stringify(data.state||{}));
      originalSetItem.call(localStorage,VOCAB_KEY,JSON.stringify(data.vocab||{}));
      originalSetItem.call(localStorage,FRAG_KEY,JSON.stringify(data.fragments||[]));
      if(data.target_date)originalSetItem.call(localStorage,TARGET_KEY,data.target_date);else originalRemoveItem.call(localStorage,TARGET_KEY);
      if(currentUser)originalSetItem.call(localStorage,SYNC_USER_KEY,currentUser.id);
      originalSetItem.call(localStorage,LAST_SYNC_KEY,data.updated_at||new Date().toISOString());
    }finally{suppressSync=false}
    setCloudStatus(`已从云端更新：${humanTime(data.updated_at)}`,'ok');
    if(reload)setTimeout(()=>location.reload(),180);
  }

  async function pushSnapshot(manual=false){
    if(!currentUser||syncing||suppressSync)return;
    syncing=true;
    if(manual)setCloudStatus('正在上传本机数据…');
    const data=snapshot();
    const {data:row,error}=await client.from('app_state').upsert({
      user_id:currentUser.id,
      state:data.state,
      vocab:data.vocab,
      fragments:data.fragments,
      target_date:data.target_date
    },{onConflict:'user_id'}).select('updated_at').single();
    syncing=false;
    if(error){setCloudStatus(`同步失败：${error.message}`,'bad');return}
    const serverStamp=row?.updated_at||new Date().toISOString();
    originalSetItem.call(localStorage,LAST_SYNC_KEY,serverStamp);
    originalSetItem.call(localStorage,SYNC_USER_KEY,currentUser.id);
    setCloudStatus(`已上传：${humanTime(serverStamp)}`,'ok');
  }
  function scheduleSync(){
    if(!currentUser||suppressSync)return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>pushSnapshot(false),350);
  }
  Storage.prototype.setItem=function(key,value){
    originalSetItem.call(this,key,value);
    if(this===localStorage&&WATCHED.has(String(key)))scheduleSync();
  };
  Storage.prototype.removeItem=function(key){
    originalRemoveItem.call(this,key);
    if(this===localStorage&&WATCHED.has(String(key)))scheduleSync();
  };

  async function pullSnapshot(manual=false,force=false){
    if(!currentUser||pulling||syncing)return;
    pulling=true;
    if(manual)setCloudStatus('正在读取云端最新数据…');
    const {data,error}=await client.from('app_state').select('state,vocab,fragments,target_date,updated_at').eq('user_id',currentUser.id).maybeSingle();
    pulling=false;
    if(error){setCloudStatus(`读取失败：${error.message}`,'bad');return}
    if(!data){if(manual)setCloudStatus('云端暂无数据，正在上传本机数据…','warn');await pushSnapshot(true);return}
    const cloudMs=stampMs(data.updated_at),localMs=stampMs(localStorage.getItem(LAST_SYNC_KEY));
    if(force||cloudMs>localMs+250){applyCloudData(data,true);return}
    if(manual)setCloudStatus(`已是最新：${humanTime(data.updated_at)}`,'ok');
  }

  async function hydrateFromCloud(user){
    currentUser=user;
    updateAuthUI(user);
    const syncedUser=localStorage.getItem(SYNC_USER_KEY);
    setCloudStatus('正在检查云端最新版本…');
    const {data,error}=await client.from('app_state').select('state,vocab,fragments,target_date,updated_at').eq('user_id',user.id).maybeSingle();
    if(error){setCloudStatus(`读取失败：${error.message}`,'bad');return}
    if(!data){
      originalSetItem.call(localStorage,SYNC_USER_KEY,user.id);
      setCloudStatus('首次连接：正在上传本机数据…');
      await pushSnapshot(true);
      return;
    }
    const localLast=localStorage.getItem(LAST_SYNC_KEY);
    if(syncedUser!==user.id||stampMs(data.updated_at)>stampMs(localLast)+250){
      applyCloudData(data,true);
      return;
    }
    setCloudStatus(`云端已连接 · ${humanTime(data.updated_at)}`,'ok');
  }

  function startRealtime(){
    if(!currentUser)return;
    if(realtimeChannel){client.removeChannel(realtimeChannel);realtimeChannel=null;}
    realtimeChannel=client.channel(`kaoyan-sync-${currentUser.id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'app_state',filter:`user_id=eq.${currentUser.id}`},payload=>{
        if(syncing||pulling||suppressSync)return;
        const cloudStamp=payload.new?.updated_at;
        const localStamp=localStorage.getItem(LAST_SYNC_KEY);
        if(stampMs(cloudStamp)>stampMs(localStamp)+250){
          setCloudStatus('检测到其他设备更新，正在刷新…','ok');
          pullSnapshot(false,false);
        }
      })
      .subscribe(status=>{
        if(status==='SUBSCRIBED')setCloudStatus('实时同步已连接','ok');
      });
  }

  async function init(){
    buildAuthPanel();
    const {data:{session}}=await client.auth.getSession();
    currentUser=session?.user||null;
    updateAuthUI(currentUser);
    if(currentUser){await hydrateFromCloud(currentUser);startRealtime();}
    client.auth.onAuthStateChange(async(event,sessionNow)=>{
      const next=sessionNow?.user||null;
      currentUser=next;
      updateAuthUI(next);
      if(next&&['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event)){
        await hydrateFromCloud(next);
        startRealtime();
      }
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'&&currentUser)pullSnapshot(false,false);
    });
    window.addEventListener('focus',()=>{if(currentUser)pullSnapshot(false,false)});
    setInterval(()=>{if(currentUser&&document.visibilityState==='visible')pullSnapshot(false,false)},15000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
