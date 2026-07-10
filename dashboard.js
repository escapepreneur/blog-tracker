const BLOGGING_PROJECT_URL='https://claude.ai/project/019cd821-e61f-73e4-bc71-51bda336a345';
const GSC_URLS={esc:'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Aeschub.com&item_url=',nms:'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Aescapepreneur.com&item_url='};

// STATE
let sb=null,activeBlog='esc',activeTab='dashboard',activePTab='details';
let sfilt='live',curPost=null,curSocId=null;
let allPosts=[],allDests=[],_links=[],_clChecked={},_gscOpps=[],_kwClusters=[],_seedSuggestions=[],_kwMode='ideas',_kwCluster=null,_kwActiveCluster=null;
const BM={esc:{name:'ESC Hub',sub:'ESC Hub — eschub.com/blog'},nms:{name:'No More Somedays',sub:'No More Somedays — escapepreneur.com/blog'}};
const IDX={no:{cls:'idx-no',dc:'idc-no',label:'Not indexed'},requested:{cls:'idx-req',dc:'idc-req',label:'Index requested'},'yes':{cls:'idx-yes',dc:'idc-yes',label:'Indexed'}};

// TIMEZONE
function localToday(){
  const offset=parseInt(localStorage.getItem('tz-offset')||'0');
  const now=new Date();
  const local=new Date(now.getTime()+offset*60*60*1000);
  return local.toISOString().split('T')[0];
}
function localNow(){
  const offset=parseInt(localStorage.getItem('tz-offset')||'0');
  return new Date(Date.now()+offset*60*60*1000);
}
function titleCase(str){
  if(!str)return str;
  const minors=new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','vs','via','per']);
  return str.replace(/[^\s-]+/g,(word,idx)=>{
    const w=word.toLowerCase();
    if(idx===0||!minors.has(w))return w.charAt(0).toUpperCase()+w.slice(1);
    return w;
  });
}

function calcNextAvailableDate(){
  const cadence=parseInt(localStorage.getItem('pub-cadence')||'1');
  // Get all posts with proposed/scheduled dates that aren't live yet
  const taken=new Set(allPosts.filter(p=>p.blog===activeBlog&&(p.status==='approved'||p.status==='scheduled')&&p.scheduled_date).map(p=>p.scheduled_date));
  let d=new Date(localNow());
  d.setHours(0,0,0,0);
  // Start from tomorrow
  d.setDate(d.getDate()+1);
  let attempts=0;
  while(attempts<365){
    const ds=d.toISOString().split('T')[0];
    if(!taken.has(ds))return ds;
    d.setDate(d.getDate()+cadence);
    attempts++;
  }
  return null;
}

// SCORE
function calcScore(ks,vol){
  if(!vol&&ks==null)return null;
  const v=vol||0,k=ks!=null?ks:40;
  // Volume factor: log scale 0-100
  const vf=v<=0?0:Math.min(100,Math.round(20*Math.log10(v+1)));
  // Competition factor: 0-1, KS 0=1.0, KS 35=0.5, KS 50+=0.1
  const cf=k<=30?1-(k/30)*0.25:k<=40?0.75-(k-30)/10*0.35:Math.max(0.05,0.4-(k-40)/20*0.35);
  return Math.min(100,Math.max(1,Math.round(vf*cf)));
}
function scoreClass(s){return s===null?'score-n':'score-badge';}

// INIT
async function initApp(){
  const url=localStorage.getItem('sb-url'),key=localStorage.getItem('sb-key');
  if(!url||!key){document.getElementById('con-screen').style.display='flex';return}
  try{
    sb=supabase.createClient(url,key);
    document.getElementById('main-app').style.display='flex';
    const savedBlog=localStorage.getItem('cd_blog');if(savedBlog==='esc'||savedBlog==='nms')activeBlog=savedBlog; // remember brand across reloads
    await loadAll();
    // reflect the restored brand in the switcher, and reopen the tab the user was on
    document.getElementById('btn-esc').className='bsw-btn'+(activeBlog==='esc'?' a-esc':'');
    document.getElementById('btn-nms').className='bsw-btn'+(activeBlog==='nms'?' a-nms':'');
    const savedTab=localStorage.getItem('cd_tab');if(savedTab&&document.getElementById('pane-'+savedTab))switchTab(savedTab);
  }catch(e){
    console.error('initApp error:',e);
    document.getElementById('con-screen').style.display='flex';
    document.getElementById('main-app').style.display='none';
  }
}
async function connectSB(){
  const url=document.getElementById('sb-url').value.trim(),key=document.getElementById('sb-key').value.trim();
  if(!url||!key){document.getElementById('con-err').textContent='Please enter both.';return}
  try{
    const c=supabase.createClient(url,key);
    const{error}=await c.from('posts').select('id').limit(1);
    if(error)throw error;
    localStorage.setItem('sb-url',url);localStorage.setItem('sb-key',key);
    sb=c;document.getElementById('con-screen').style.display='none';
    document.getElementById('main-app').style.display='flex';loadAll();
  }catch(e){document.getElementById('con-err').textContent='Could not connect: '+e.message}
}
function updateSB(){
  const url=document.getElementById('set-sb-url').value.trim(),key=document.getElementById('set-sb-key').value.trim();
  if(!url||!key)return;
  localStorage.setItem('sb-url',url);localStorage.setItem('sb-key',key);
  document.getElementById('set-sb-msg').textContent='Saved. Reloading...';
  setTimeout(()=>location.reload(),800);
}
function saveApiKey(){
  const k=document.getElementById('set-api-key').value.trim();if(!k)return;
  localStorage.setItem('claude-api-key',k);
  document.getElementById('set-api-key').value='';
  document.getElementById('set-api-msg').textContent='API key saved.';
}
function saveCadence(){
  const v=document.getElementById('set-cadence').value;
  localStorage.setItem('pub-cadence',v);
  document.getElementById('set-cadence-msg').textContent='Saved.';
  renderSchedPill();
}

// DATA
async function loadAll(){await Promise.all([loadPosts(),loadDests()]);await loadLinks();render();updateWeeklyButtons();}
async function loadPosts(){const{data}=await sb.from('posts').select('*,social_tracking(*)').order('scheduled_date',{ascending:true,nullsFirst:false});allPosts=data||[];}
async function loadDests(){const{data}=await sb.from('link_destinations').select('*');allDests=data||[];}
async function loadLinks(){
  const ids=bp().map(p=>p.id);if(!ids.length){_links=[];return}
  const{data}=await sb.from('internal_links').select('*').eq('blog',activeBlog);_links=data||[];
}

// BLOG/TAB
function switchBlog(blog){
  activeBlog=blog;
  try{localStorage.setItem('cd_blog',blog);}catch(e){}
  const cb=document.getElementById('cluster-launch-status');if(cb)cb.innerHTML=''; // drop any other-brand cluster banner
  document.getElementById('btn-esc').className='bsw-btn'+(blog==='esc'?' a-esc':'');
  document.getElementById('btn-nms').className='bsw-btn'+(blog==='nms'?' a-nms':'');
  sfilt='live';document.querySelectorAll('.fchip').forEach((b,i)=>b.classList.toggle('on',i===1));
  loadLinks().then(()=>{render();updateTabs();refreshActivePane()});
}
// Re-render the pane the user is currently on (used when the brand toggle changes,
// since render() only refreshes dashboard/posts — the other panes have their own renderers).
function refreshActivePane(){
  switch(activeTab){
    case 'links':renderLinksPane();break;
    case 'insights':renderOpportunities();renderRecentOptimizations();break;
    case 'keywords':{ // research results + seed suggestions are brand-specific — clear the previous brand's run; refresh clusters + idea backlog
      _kwClusters=[];_seedSuggestions=[];
      const r=document.getElementById('kw-research-results');if(r)r.innerHTML='';
      const s=document.getElementById('kw-research-status');if(s)s.innerHTML='';
      const sg=document.getElementById('kw-seed-suggestions');if(sg)sg.innerHTML='';
      renderClusters();renderResearch();
      break;}
    case 'calendar':renderCalendar();renderPipeline();break;
  }
}
function switchTab(name,filter){
  activeTab=name;
  try{if(name)localStorage.setItem('cd_tab',name);}catch(e){}
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  document.getElementById('pane-'+name).classList.add('on');
  updateTabs();
  if(filter){
    sfilt=filter;
    document.querySelectorAll('.fchip').forEach(b=>{
      const oc=b.getAttribute('onclick')||'';
      b.classList.toggle('on',oc.includes("'"+filter+"'"));
    });
    renderPosts();
  }
  if(name==='links')renderLinksPane();
  if(name==='keywords'){initKeywordsTab();renderClusters();renderResearch();}
  if(name==='insights'){renderOpportunities();renderRecentOptimizations();}
  if(name==='ideas')renderRequests();
  if(name==='calendar'){setTimeout(()=>{
    const now=new Date();
    const mo=document.getElementById('cal-month');
    const yr=document.getElementById('cal-year');
    if(mo)mo.value=now.getMonth();
    if(yr)yr.value=now.getFullYear();
    renderCalendar();renderPipeline(); // Pipeline list folded into the Calendar pane
  },50)}
}
function goToNotIndexed(){
  sfilt='not-indexed';
  switchTab('posts');
  document.querySelectorAll('.fchip').forEach(b=>{
    const oc=b.getAttribute('onclick')||'';
    b.classList.toggle('on',oc.includes("'not-indexed'"));
  });
  renderPosts();
}
function updateTabs(){
  const isN=activeBlog==='nms';
  document.querySelectorAll('.nav-i').forEach(n=>n.classList.remove('a-esc','a-nms'));
  ['dashboard','posts','links','calendar','insights','keywords','ideas'].forEach((n,i)=>{
    const el=document.querySelectorAll('.nav-i')[i];
    if(el&&n===activeTab)el.classList.add(isN?'a-nms':'a-esc');
  });
  ['add-post-btn','add-idea-btn','dash-add-btn','add-research-btn'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.className='btn '+(isN?'btn-pp':'btn-p')+' btn-sm';
  });
}
function switchPTab(name){
  activePTab=name;
  ['details','draft','social','gsc','links'].forEach(n=>{
    document.getElementById('pm-'+n).classList.toggle('on',n===name);
    document.getElementById('ptab-'+n).classList.toggle('on',n===name);
  });
  if(name==='gsc')renderRankingsTab();
  if(name==='links')renderModalLinks();
  if(name==='draft')renderDraftTab();
}
function setFilter(f,btn){sfilt=f;document.querySelectorAll('.fchip').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');renderPosts()}

// HELPERS
function bp(){return allPosts.filter(p=>p.blog===activeBlog)}
function bd(){return allDests.filter(d=>d.blog===activeBlog)}
function gp(id){return allPosts.find(p=>p.id===id)}
function gt(id){const p=allPosts.find(x=>x.id===id);if(p)return{label:p.title||p.primary_keyword,url:p.url,type:'post'};const d=allDests.find(x=>x.id===id);if(d)return{label:d.label,url:d.url,type:'dest'};return null}
function fl(n){return n===0?'red':n<3?'amber':'green'}
function fd(d){if(!d)return'—';const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function sbadge(s){
  const m={live:'b-live',scheduled:'b-scheduled',approved:'b-approved',review:'b-review','pending-review':'b-review',drafted:'b-drafted',idea:'b-idea'};
  const labels={live:'Live',scheduled:'Scheduled',approved:'Approved',review:'Pending Review','pending-review':'Pending Review',drafted:'Drafted',idea:'Idea'};
  return`<span class="badge ${m[s]||'b-idea'}">${labels[s]||s}</span>`;
}
function idxBadge(v){const x=IDX[v||'no'];return`<span class="idx-dot ${x.cls}"><span class="idx-dot-circle ${x.dc}"></span>${x.label}</span>`}
function stepLabel(n){if(!n||n===0)return'<span class="step-badge" style="color:var(--text3)">Step 0/6</span>';if(n>=6)return`<span class="step-badge" style="background:var(--green-l);color:var(--green);border:1px solid #b8dfc6">✓ Done</span>`;return`<span class="step-badge">Step ${n}/6</span>`}
const STEP_NAMES={0:'Brief not started',2:'Blogging Project',3:'Create Assets',4:'Claude Review',5:'Set Up in ESC Hub',6:'Go-Live steps'};
function stuckLabel(n){const nm=STEP_NAMES[n||0]||('Step '+(n||0));const late=(n||0)<=2;return`<span class="stuck-label${late?' s-late':''}">▸ ${nm}</span>`}
function toast(msg,dur=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),dur)}
async function copyToClipboard(text){
  try{await navigator.clipboard.writeText(text)}
  catch(e){const el=document.createElement('textarea');el.value=text;el.style.cssText='position:fixed;opacity:0';document.body.appendChild(el);el.focus();el.select();document.execCommand('copy');document.body.removeChild(el)}
}
function buildBriefPrompt(kw,ks,vol,supp,take,serpLink,blog){
  const blogName=blog==='esc'?'ESC Hub Blog (blog.eschub.com)':'No More Somedays (escapepreneur.com/blog)';
  const urlSlug=(kw||'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
  return`Blog: ${blogName}\nPrimary keyword: ${kw||''}\nSuggested URL slug: ${urlSlug}\nKS Score: ${ks||'not provided'}\nMonthly search volume: ${vol||'not provided'}\nSecondary keywords: ${supp||'not provided'}\nUnique take / Karen's story: ${take||'not provided — please suggest the best fit'}\n${serpLink?'SERP analysis doc: '+serpLink:'SERP analysis: not provided'}\n\nPlease generate the complete blog post brief.`;
}
function getSuppString(){
  const rows=document.querySelectorAll('.np-supp-row');
  const parts=[];
  rows.forEach(r=>{
    const kw=r.querySelector('.supp-kw').value.trim();
    const ks=r.querySelector('.supp-ks').value.trim();
    const vol=r.querySelector('.supp-vol').value.trim();
    if(kw){parts.push(kw+(vol||ks?` (${vol||'?'}/${ks||'?'})`:'')); }
  });
  return parts.join(', ');
}

// SCHEDULE PILL
function renderSchedPill(){
  const cadence=parseInt(localStorage.getItem('pub-cadence')||'1');
  const needed=Math.ceil(7/cadence);
  const posts=bp();
  const scheduled=posts.filter(p=>p.status==='scheduled').length;
  const pct=scheduled/needed;
  let cls,label,dot;
  if(pct>=1){cls='sched-green';dot='background:#2a7d3f';label=`${scheduled}/${needed} scheduled ✓`}
  else if(pct>=0.5){cls='sched-amber';dot='background:#e8960a';label=`${scheduled}/${needed} scheduled`}
  else{cls='sched-red';dot='background:#e04444';label=`${scheduled}/${needed} scheduled`}
  const spw=document.getElementById('sched-pill-wrap');if(spw)spw.innerHTML=`<button class="sched-pill ${cls}" onclick="switchTab('posts','scheduled')"><span class="sched-dot" style="${dot}"></span>${label}</button>`;
}

// RENDER
function render(){renderDashboard();renderPosts();renderLinksPane();renderSchedPill()}

// DASHBOARD

function socialIconRow(s,p){
  // Returns icon badges for missing items
  const icons=[];
  const mkIcon=(label,color,missing)=>missing?`<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:${color}20;color:${color};border:1px solid ${color}40">${label}</span>`:'';
  icons.push(mkIcon('📌 Pin','#e04444',!s.pinterest_shared));
  icons.push(mkIcon('🔗 Blog','#e04444',!s.pinterest_in_blog));
  icons.push(mkIcon('📘 FB','#1877f2',!s.fb_shared));
  icons.push(mkIcon('📷 IG','#c13584',!s.ig_shared));
  const filtered=icons.filter(Boolean);
  if(!filtered.length)return'';
  return`<div class="post-row" onclick="openPost('${p.id}','social')" style="padding:8px 12px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div class="kw-primary" style="flex:1;min-width:0;font-size:12px">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'')}</div><div style="display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0">${filtered.join('')}</div></div></div>`;
}

function renderDashboard(){
  if(activeTab!=='dashboard')return;
  const posts=bp();
  const today=localToday();
  document.getElementById('dash-title').textContent=BM[activeBlog].name;
  document.getElementById('dash-sub').textContent=BM[activeBlog].sub;
  const live=posts.filter(p=>p.status==='live').length;
  const sched=posts.filter(p=>p.status==='scheduled').length;
  const drafted=posts.filter(p=>p.status==='drafted').length;
  const notIdx=posts.filter(p=>p.status==='live'&&(p.indexed==='no'||!p.indexed)).length;
  const idxReq=posts.filter(p=>p.indexed==='requested').length;
  const ideas=posts.filter(p=>p.status==='idea').length;
  const review=posts.filter(p=>p.status==='pending-review').length;

  // HORIZONTAL METRIC PILLS
  const dmEl=document.getElementById('dash-metrics');if(dmEl)dmEl.innerHTML=`
    <button class="dash-pill dash-pill-green" onclick="switchTab('posts','live')"><span class="dp-num">${live}</span><span class="dp-lbl">Live</span></button>
    <button class="dash-pill dash-pill-blue" onclick="switchTab('posts','scheduled')"><span class="dp-num">${sched}</span><span class="dp-lbl">Scheduled</span></button>
    <button class="dash-pill dash-pill-purple" onclick="switchTab('posts','drafted')"><span class="dp-num">${drafted}</span><span class="dp-lbl">Drafted</span></button>
    ${review?`<button class="dash-pill dash-pill-amber" onclick="switchTab('posts','pending-review')"><span class="dp-num">${review}</span><span class="dp-lbl">Pending review</span></button>`:''}
    <button class="dash-pill dash-pill-amber" onclick="switchTab('posts','not-indexed')"><span class="dp-num">${notIdx+idxReq}</span><span class="dp-lbl">Indexing needed</span></button>
    <button class="dash-pill dash-pill-teal" onclick="switchTab('keywords')"><span class="dp-num">${ideas}</span><span class="dp-lbl">In queue</span></button>`;

  // NEXT UP — pipeline order (proposed date, not yet scheduled/live)
  const isN=activeBlog==='nms';
  const pipelinePosts=posts.filter(p=>p.proposed_date&&!['scheduled','live'].includes(p.status)).sort((a,b)=>new Date(a.proposed_date)-new Date(b.proposed_date)).slice(0,3);
  const nuEl=document.getElementById('nextup-list');
  if(nuEl){
    if(!pipelinePosts.length){nuEl.innerHTML='<div style="font-size:12px;color:var(--text3);padding:6px 0">No proposed dates set yet. Add in Planning → Research queue.</div>'}
    else{nuEl.innerHTML=pipelinePosts.map((p,i)=>`<div class="next-up-item"><div class="nui-num">${i+1}</div><div style="flex:1;min-width:0"><div class="kw-primary">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'Untitled')}</div><div style="display:flex;align-items:center;gap:6px;margin-top:2px">${sbadge(p.status)}<span class="prk" style="margin:0">${fd(p.proposed_date)}</span></div></div><button class="btn ${isN?'btn-pp':'btn-p'} btn-xs" onclick="openPost('${p.id}','details')">Open →</button></div>`).join('')}
  }

  // TODAY — posts scheduled for today
  const todayPosts=posts.filter(p=>p.status==='scheduled'&&p.scheduled_date===today);
  const todayEl=document.getElementById('dash-today');
  if(todayEl){
    if(!todayPosts.length){todayEl.innerHTML='<div style="font-size:12px;color:var(--text3);padding:6px 0">No posts scheduled for today.</div>'}
    else{todayEl.innerHTML=todayPosts.map(p=>`<div class="post-row" style="border-left:3px solid var(--teal)"><div class="kw-primary">${esc(p.primary_keyword||p.title||'Post')}</div>${p.title&&p.primary_keyword?`<div class="post-title-sub">${esc(p.title)}</div>`:''}<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" onclick="confirmGoLive('${p.id}')">✓ Confirm live + socials</button><button class="btn btn-sm" onclick="openPost('${p.id}','details')">View</button></div></div>`).join('')}
  }

  // SOCIAL INCOMPLETE — live posts with missing social items
  const si=posts.filter(p=>{const s=p.social_tracking?.[0];return s&&p.status==='live'&&(!s.fb_shared||!s.ig_shared||!s.pinterest_shared||!s.pinterest_in_blog)});
  const siEl=document.getElementById('dash-social-incomplete');
  if(siEl){
    if(!si.length){siEl.innerHTML='<div style="font-size:12px;color:var(--green);padding:6px 0">✓ All social complete.</div>'}
    else{siEl.innerHTML=si.slice(0,5).map(p=>{const s=p.social_tracking?.[0]||{};return socialIconRow(s,p)}).filter(Boolean).join('')||'<div style="font-size:12px;color:var(--green);padding:6px 0">✓ All social complete.</div>'}
  }

  // NEEDS LINKS for dashboard
  const nlDash=posts.filter(p=>p.status==='live').map(p=>({...p,postLn:_links.filter(l=>l.from_post_id===p.id&&l.to_post_id).length,pageLn:_links.filter(l=>l.from_post_id===p.id&&l.to_dest_id).length})).filter(p=>p.postLn<3||p.pageLn<2);
  const nlDashEl=document.getElementById('dash-needs-links');
  if(nlDashEl){
    if(!nlDash.length){nlDashEl.innerHTML='<div style="font-size:12px;color:var(--green);padding:6px 0">✓ All posts fully linked.</div>'}
    else{nlDashEl.innerHTML=nlDash.slice(0,5).map(p=>{const lv=p.postLn>=3&&p.pageLn>=2?'green':(p.postLn>0||p.pageLn>0)?'amber':'red';return`<div class="post-row" onclick="openPost('${p.id}','links')"><div style="display:flex;align-items:center;justify-content:space-between"><div class="kw-primary" style="flex:1;min-width:0">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'')}</div><span class="flag f-${lv}">${p.postLn}/3·${p.pageLn}/2</span></div></div>`}).join('')+(nlDash.length>5?`<div style="font-size:11px;color:var(--text3);margin-top:6px;cursor:pointer" onclick="switchTab('links')">+${nlDash.length-5} more → Links</div>`:'')}
  }

  // PINTEREST ACTION
  const pinNeeded=posts.filter(p=>{const s=p.social_tracking?.[0];return p.status==='live'&&s&&(!s.pinterest_shared||!s.pinterest_in_blog)});
  const pinEl=document.getElementById('dash-pinterest-action');
  if(pinEl){
    if(!pinNeeded.length){pinEl.innerHTML='<div style="font-size:12px;color:var(--green);padding:6px 0">✓ All Pinterest actions complete.</div>'}
    else{pinEl.innerHTML=pinNeeded.slice(0,5).map(p=>{const s=p.social_tracking?.[0]||{};return`<div class="post-row" onclick="openPost('${p.id}','social')" style="border-left:3px solid #e04444"><div style="flex:1;min-width:0"><div class="kw-primary">${esc(p.primary_keyword||p.title)}</div><div style="font-size:11px;color:var(--red-t);margin-top:2px">${!s.pinterest_shared?'📌 Not yet pinned ':''}${!s.pinterest_in_blog?'🔗 Not linked in blog':''}</div></div></div>`}).join('')}
  }

  // INDEXING
  const idxGroups={no:posts.filter(p=>p.status==='live'&&(p.indexed==='no'||!p.indexed)),requested:posts.filter(p=>p.indexed==='requested'),'yes':posts.filter(p=>p.indexed==='yes')};
  let idxHtml='';
  ['no','requested','yes'].forEach(k=>{const x=IDX[k],ps=idxGroups[k];idxHtml+=`<div style="margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span class="idx-dot ${x.cls}"><span class="idx-dot-circle ${x.dc}"></span>${x.label}</span><span style="font-size:14px;font-weight:700">${ps.length}</span></div>${ps.slice(0,2).map(p=>`<div style="font-size:11px;color:var(--text2);padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="openPost('${p.id}','details')">${esc(p.primary_keyword||p.title)}</div>`).join('')}${ps.length>2?`<div style="font-size:10px;color:var(--text3)">+${ps.length-2} more</div>`:''}</div>`});
  const idxEl=document.getElementById('dash-indexing');if(idxEl)idxEl.innerHTML=idxHtml;

  // COMPLETE PILL
  const completePosts=posts.filter(p=>p.current_step>=6).length;
  const totalPosts=posts.filter(p=>p.status!=='idea').length;
  const completePct=totalPosts>0?Math.round(completePosts/totalPosts*100):0;
  const cpWrap=document.getElementById('complete-pill-wrap');
  if(cpWrap){const cpCls=completePct>=80?'sched-green':completePct>=40?'sched-amber':'sched-red';cpWrap.innerHTML=`<button class="sched-pill ${cpCls}" onclick="switchTab('posts','needs-work')"><span class="sched-dot" style="${completePct>=80?'background:#2a7d3f':completePct>=40?'background:#e8960a':'background:#e04444'}"></span>${completePosts}/${totalPosts} complete</button>`}
}

async function confirmGoLive(id){
  const p=gp(id);if(!p)return;
  await sb.from('posts').update({status:'live',published_date:localToday()}).eq('id',id);
  const s=p.social_tracking?.[0];
  if(s){await sb.from('social_tracking').update({fb_shared:true,ig_shared:true,pinterest_image_created:true}).eq('id',s.id)}
  await loadPosts();render();
  toast('✓ Post live — FB and IG marked done. Pinterest still needs pinning.',4000);
}

async function approvePost(id,sendBack=false,note=''){
  const p=gp(id);if(!p)return;
  if(sendBack){
    await sb.from('posts').update({status:'drafted',serp_notes:(p.serp_notes||'')+(note?'\nKaren: '+note:'')}).eq('id',id);
    await loadPosts();render();closeModal('approve-modal');toast('Sent back to Drafted');return;
  }
  const nextDate=calcNextAvailableDate();
  await sb.from('posts').update({status:'approved',scheduled_date:nextDate}).eq('id',id);
  await loadPosts();render();closeModal('approve-modal');
  toast('✓ Approved — proposed date: '+(nextDate||'none available'),3000);
}

function openApproveModal(id){
  curPost=id;const p=gp(id);if(!p)return;
  document.getElementById('approve-kw').textContent=titleCase(p.primary_keyword||p.title||'Post');
  document.getElementById('approve-title').textContent=p.title||'';
  document.getElementById('approve-note').value='';
  // Show next available date
  const nd=calcNextAvailableDate();
  document.getElementById('approve-date-preview').textContent=nd?'Proposed date: '+nd:'No available slots — check cadence in Settings';
  document.getElementById('approve-modal').classList.add('on');
}



let _dragSrcId=null;
let _researchSort='score'; // score | volume | ks | manual

function renderResearch(){
  // Only show posts with NO proposed date (once dated they move to Pipeline)
  const all=bp().filter(p=>!['scheduled','live'].includes(p.status)&&!p.proposed_date);
  const el=document.getElementById('research-list');if(!el)return;
  const search=(document.getElementById('research-search')?.value||'').toLowerCase();

  // Apply sort
  let sorted=[...all];
  if(_researchSort==='score')sorted.sort((a,b)=>(calcScore(b.ks_score,b.search_volume)||0)-(calcScore(a.ks_score,a.search_volume)||0));
  else if(_researchSort==='volume')sorted.sort((a,b)=>(b.search_volume||0)-(a.search_volume||0));
  else if(_researchSort==='ks')sorted.sort((a,b)=>(a.ks_score||99)-(b.ks_score||99));
  else sorted.sort((a,b)=>(a.sort_order||9999)-(b.sort_order||9999)); // manual

  const filtered=search?sorted.filter(p=>(p.primary_keyword||'').toLowerCase().includes(search)||(p.title||'').toLowerCase().includes(search)):sorted;
  const isN=activeBlog==='nms';
  const badgeStyle=isN?'border-color:var(--purple);background:var(--purple-l);color:var(--purple-t)':'border-color:var(--teal);background:var(--teal-l);color:var(--teal-d)';
  const isManual=_researchSort==='manual';

  // Render sort chips
  const sortEl=document.getElementById('research-sort-chips');
  if(sortEl){
    sortEl.innerHTML=['score','volume','ks','manual'].map(s=>`<button class="fchip${_researchSort===s?' on':''}" onclick="setResearchSort('${s}')">${s==='score'?'Priority score':s==='volume'?'Volume':s==='ks'?'KS score (easiest)':'Manual order'}</button>`).join('')
    +`<button class="btn btn-danger btn-xs" id="research-bulk-delete-btn" style="display:none;margin-left:8px" onclick="bulkDeleteResearch()">Delete selected</button>`;
  }

  if(!filtered.length){el.innerHTML=`<div class="empty">${search?'No keywords match.':all.length?'No unplanned keywords — all have a proposed date (see the Calendar).':'No keywords yet. Use + Log keyword to add some.'}</div>`;return}

  el.innerHTML=filtered.map((p,i)=>{
    const score=calcScore(p.ks_score,p.search_volume);
    const drag=isManual?`draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragover="dragOver(event)" ondrop="dragDrop(event,'${p.id}')" ondragend="dragEnd(event)"`:'' ;
    return`<div class="research-card" ${drag} data-id="${p.id}">
      <input type="checkbox" data-id="${p.id}" onclick="event.stopPropagation();updateResearchBulkBtn()" style="width:16px;height:16px;flex-shrink:0;cursor:pointer;accent-color:var(--red)">
      ${isManual?`<div class="drag-handle" title="Drag to reorder">⋮⋮</div>`:''}
      <div class="research-num">${i+1}</div>
      ${score!=null?`<div class="score-badge" style="${badgeStyle};width:32px;height:32px;font-size:11px;flex-shrink:0">${score}</div>`:''}
      <div style="flex:1;min-width:0;cursor:pointer" onclick="openPost('${p.id}','details')">
        <div class="kw-primary">${esc(titleCase(p.primary_keyword||'Untitled'))}</div>
        ${p.supplementary_keywords?`<div class="prk">${esc(p.supplementary_keywords.substring(0,60))}${p.supplementary_keywords.length>60?'…':''}</div>`:''}
        ${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''}</div>`:''}
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <span style="font-size:10px;color:var(--text3)">Proposed:</span>
          <input type="date" value="${p.proposed_date||''}" style="font-size:10px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;font-family:Poppins,sans-serif;color:var(--text2)" onchange="saveProposedDate('${p.id}',this.value)" onclick="event.stopPropagation()">
        </div>
      </div>
      <button class="btn ${isN?'btn-pp':'btn-p'} btn-sm" onclick="getBriefForPost('${p.id}')">Get brief →</button>
    </div>`;
  }).join('');
}

function updateResearchBulkBtn(){
  const checked=document.querySelectorAll('#research-list input[type=checkbox]:checked');
  const btn=document.getElementById('research-bulk-delete-btn');
  if(btn)btn.style.display=checked.length?'inline-flex':'none';
  if(btn&&checked.length)btn.textContent=`Delete ${checked.length} selected`;
}

async function bulkDeleteResearch(){
  const checked=[...document.querySelectorAll('#research-list input[type=checkbox]:checked')];
  if(!checked.length)return;
  const ids=checked.map(cb=>cb.dataset.id);
  if(!confirm(`Delete ${ids.length} keyword${ids.length>1?'s':''}? This cannot be undone.`))return;
  for(const id of ids){
    await sb.from('internal_links').delete().or(`source_post_id.eq.${id},dest_post_id.eq.${id}`);
    await sb.from('gsc_positions').delete().eq('post_id',id);
    await sb.from('post_checklist').delete().eq('post_id',id);
    await sb.from('social_tracking').delete().eq('post_id',id);
    await sb.from('posts').delete().eq('id',id);
  }
  await loadPosts();renderResearch();
  toast(`${ids.length} keyword${ids.length>1?'s':''} deleted`);
}

function setResearchSort(s){_researchSort=s;renderResearch()}

async function saveProposedDate(id,val){
  await sb.from('posts').update({proposed_date:val||null}).eq('id',id);
  const p=allPosts.find(x=>x.id===id);if(p)p.proposed_date=val;
  await loadPosts();renderResearch();renderPipeline();renderDashboard();
  toast(val?'Added to pipeline — '+fd(val):'Proposed date cleared');
}
function dragStart(e,id){_dragSrcId=id;e.currentTarget.style.opacity='0.4';e.dataTransfer.effectAllowed='move'}
function dragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';return false}
function dragEnd(e){e.currentTarget.style.opacity='1'}
async function dragDrop(e,targetId){
  e.preventDefault();if(_dragSrcId===targetId)return;
  const ideas=bp().filter(p=>!['scheduled','live'].includes(p.status)&&!p.proposed_date).sort((a,b)=>(a.sort_order||9999)-(b.sort_order||9999));
  const srcIdx=ideas.findIndex(p=>p.id===_dragSrcId),tgtIdx=ideas.findIndex(p=>p.id===targetId);
  if(srcIdx===-1||tgtIdx===-1)return;
  const reordered=[...ideas];const[moved]=reordered.splice(srcIdx,1);reordered.splice(tgtIdx,0,moved);
  await Promise.all(reordered.map((p,i)=>sb.from('posts').update({sort_order:i+1}).eq('id',p.id)));
  await loadPosts();renderResearch();renderDashboard();
}

async function renderDashRankings(){const el=document.getElementById('dash-rankings');if(el)el.innerHTML=''}
// POSTS LIST
function renderPosts(){
  document.getElementById('posts-sub').textContent=BM[activeBlog].sub;
  const search=(document.getElementById('post-search')?.value||'').toLowerCase();
  let posts=bp();
  if(sfilt==='not-indexed')posts=posts.filter(p=>(p.indexed==='no'||!p.indexed||p.indexed==='requested')&&p.status!=='idea');
  else if(sfilt==='needs-work')posts=posts.filter(p=>!['idea','pending-review','approved'].includes(p.status)&&(p.current_step||0)<6).sort((a,b)=>(a.current_step||0)-(b.current_step||0));
  else if(sfilt!=='all')posts=posts.filter(p=>p.status===sfilt);
  if(sfilt==='live'||sfilt==='all')posts=[...posts].sort((a,b)=>new Date(b.published_date||0)-new Date(a.published_date||0));
  if(sfilt==='approved')posts=[...posts].sort((a,b)=>(a.sort_order||9999)-(b.sort_order||9999)||new Date(a.scheduled_date||'9999')-new Date(b.scheduled_date||'9999'));
  if(sfilt==='review'||sfilt==='pending-review')posts=[...posts].sort((a,b)=>new Date(a.updated_at||0)-new Date(b.updated_at||0));
  const searchVal=(document.getElementById('post-search')?.value||'').toLowerCase();
  if(searchVal)posts=posts.filter(p=>(p.title||'').toLowerCase().includes(searchVal)||(p.primary_keyword||'').toLowerCase().includes(searchVal));
  if(!posts.length){document.getElementById('posts-list').innerHTML='<div class="empty">No posts found.</div>';return}
  const isN=activeBlog==='nms';
  document.getElementById('posts-list').innerHTML=posts.map(p=>{
    const isIdea=p.status==='idea'||p.status==='drafted';
    const ln=_links.filter(l=>l.from_post_id===p.id).length;
    const postLn=_links.filter(l=>l.from_post_id===p.id&&l.to_post_id).length;
    const pageLn=_links.filter(l=>l.from_post_id===p.id&&l.to_dest_id).length;
    const lv=postLn>=3&&pageLn>=2?'green':(postLn>0||pageLn>0)?'amber':'red';
    const s=p.social_tracking?.[0]||{};
    const sd=[s.pinterest_image_created,s.pinterest_shared,s.fb_shared,s.ig_shared].filter(Boolean).length;
    const dateStr=p.status==='live'?fd(p.published_date):p.scheduled_date?fd(p.scheduled_date):'';
    const ix=IDX[p.indexed||'no'];
    const score=calcScore(p.ks_score,p.search_volume);
    return`<div class="post-row" onclick="${isIdea?'':``}openPost('${p.id}','details')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px">${sbadge(p.status)}${stepLabel(p.current_step)}${sfilt==='needs-work'?stuckLabel(p.current_step):''}</div>
          <div class="kw-primary">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'Untitled')}</div>
          ${p.title?`<div class="post-title-sub">${esc(p.title)}</div>`:''}
          ${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''}</div>`:''}
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
            ${dateStr?`<span class="pill pill-g">${dateStr}</span>`:''}
            ${p.status==='live'&&(p.indexed==='no'||!p.indexed)?`<button class="btn btn-xs f-red" style="border:1px solid #f0c8c8;background:var(--red-l);color:var(--red-t)" onclick="event.stopPropagation();requestIndexing('${p.id}')">Request indexing →</button>`:''}
            ${p.status==='live'&&p.indexed==='requested'?`<span class="idx-dot idx-req" style="font-size:9px;padding:1px 6px"><span class="idx-dot-circle idc-req"></span>Index requested</span><button class="btn btn-xs" style="font-size:9px;padding:1px 7px" onclick="event.stopPropagation();checkIndexing('${p.id}')">Check →</button><button class="btn btn-xs f-green" style="border:1px solid #b8dfc6;background:var(--green-l);color:var(--green);font-size:9px;padding:1px 7px" onclick="event.stopPropagation();confirmIndexed('${p.id}')">Confirm ✓</button>`:''}
            ${p.indexed==='yes'?`<span class="idx-dot idx-yes" style="font-size:9px;padding:1px 6px"><span class="idx-dot-circle idc-yes"></span>Indexed</span>`:''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          ${score!==null&&isIdea?`<div class="score-badge" style="${isN?'border-color:var(--purple);background:var(--purple-l);color:var(--purple-t)':'border-color:var(--teal);background:var(--teal-l);color:var(--teal-d)'}">${score}</div>`:''}
          ${isIdea?`<button class="btn ${isN?'btn-pp':'btn-p'} btn-xs" onclick="event.stopPropagation();getBriefForPost('${p.id}')">Get brief →</button>`:p.status==='pending-review'?`<button class="btn btn-p btn-xs" onclick="event.stopPropagation();openApproveModal('${p.id}')">Review →</button>`:`<span class="flag f-${lv}">${postLn}/3 · ${pageLn}/2</span>`}
          ${p.status==='live'?`<span class="flag" style="${sd>=4?'background:var(--green-l);color:var(--green);border:1px solid #b8dfc6':'background:var(--amber-l);color:var(--amber-t);border:1px solid #f0d8a0'}">${sd}/4 social</span>`:''}
        </div>
      </div></div>`;
  }).join('');
}

// IDEAS

// LINKS PANE
async function renderLinksPane(){
  // render from the in-memory _links cache (refreshed by loadAll + on every link mutation);
  // no need for a Supabase round-trip on every dashboard render.
  const posts=bp();
  const needs=posts.filter(p=>p.status==='live'&&_links.filter(l=>l.from_post_id===p.id).length<3);
  document.getElementById('links-needs').innerHTML=!needs.length?`<div style="text-align:center;padding:2rem 1rem"><div style="font-size:40px;margin-bottom:.5rem">🎉</div><div style="font-size:16px;font-weight:700;color:var(--green);margin-bottom:.25rem">All posts fully linked!</div><div style="font-size:13px;color:var(--text3)">Every live post has 3 or more internal links.</div></div>`:needs.map(p=>{const n=_links.filter(l=>l.from_post_id===p.id).length,lv=fl(n);return`<div class="post-row" onclick="openPost('${p.id}','links')" style="border-left:3px solid var(--${lv==='red'?'red':lv==='amber'?'amber':'green'})"><div style="display:flex;align-items:center;justify-content:space-between"><div style="flex:1;min-width:0"><div class="kw-primary">${esc(p.primary_keyword||p.title)}</div></div><span class="flag f-${lv}">${n}/3</span></div></div>`}).join('');
  const sel=document.getElementById('link-map-sel'),cur=sel.value;
  sel.innerHTML='<option value="">Select a post…</option>';
  posts.filter(p=>p.status==='live').forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=(p.primary_keyword||p.title||'Untitled');if(p.id===cur)o.selected=true;sel.appendChild(o)});
  renderLinkMap();
}
function renderLinkMap(){
  const id=document.getElementById('link-map-sel').value;
  if(!id){document.getElementById('link-map-detail').innerHTML='';return}
  const p=gp(id);if(!p)return;
  const out=_links.filter(l=>l.from_post_id===id),inc=_links.filter(l=>l.to_post_id===id);
  let html=`<div class="card"><div class="sh">Links out (${out.length}/3)</div>`;
  if(!out.length)html+='<div style="font-size:12px;color:var(--text3)">No outbound links yet</div>';
  else out.forEach(l=>{const t=gt(l.to_post_id||l.to_dest_id);if(!t)return;html+=`<div class="lr"><span style="color:var(--teal)">→</span><div style="flex:1;font-size:12px;font-weight:500">${esc(t.label)}</div><button class="btn btn-danger btn-xs" onclick="removeLinkDirect('${l.id}')">✕</button></div>`});
  html+=`<div class="sh" style="margin-top:12px">Links in (${inc.length})</div>`;
  if(!inc.length)html+='<div style="font-size:12px;color:var(--text3)">No posts link here yet</div>';
  else inc.forEach(l=>{const f=gp(l.from_post_id);if(!f)return;html+=`<div class="lr"><span style="color:var(--text3)">←</span><div style="font-size:12px;font-weight:500">${esc(f.primary_keyword||f.title)}</div></div>`});
  html+='</div>';document.getElementById('link-map-detail').innerHTML=html;
}
async function removeLinkDirect(lid){await sb.from('internal_links').delete().eq('id',lid);await loadLinks();renderLinksPane();renderLinkMap();render()}

// SUPP ROWS
function initSuppRows(){
  document.getElementById('np-supp-rows').innerHTML='';
  addSuppRow();
}
function addSuppRow(kw='',ks='',vol=''){
  const wrap=document.getElementById('np-supp-rows');
  const div=document.createElement('div');
  div.className='kw-row np-supp-row';
  div.innerHTML=`<input type="text" class="supp-kw" placeholder="keyword" value="${esc(kw)}"><input type="number" class="kw-score supp-ks" placeholder="KS" value="${esc(ks)}"><input type="number" class="kw-vol supp-vol" placeholder="Vol" value="${esc(vol)}"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove()" style="flex-shrink:0">✕</button>`;
  wrap.appendChild(div);
}

// NEW POST
function openNewPost(){
  const isN=activeBlog==='nms';
  document.getElementById('np-title').textContent='Log keyword — '+BM[activeBlog].name;
  document.getElementById('np-save-btn').className='btn '+(isN?'btn-pp':'btn-p');
  document.getElementById('np-brief-btn').className='btn btn-ghost';
  ['np-kw','np-ks','np-vol','np-serp','np-take','np-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  document.getElementById('kw-rank-result').style.display='none';
  const dw=document.getElementById('dup-warning');if(dw)dw.style.display='none';
  initSuppRows();
  document.getElementById('new-post-modal').classList.add('on');
  // Add duplicate check listener
  const kwInput=document.getElementById('np-kw');
  if(kwInput){
    kwInput.oninput=function(){
      const dup=checkDuplicateKeyword(this.value.trim());
      const dw=document.getElementById('dup-warning');
      if(!dw)return;
      if(dup){
        const typeMsg={exact:'Exact match',similar:'Very similar keyword',overlap:'Overlapping keywords'};
        dw.style.display='block';
        dw.innerHTML=`⚠️ <strong>${typeMsg[dup.type]}</strong> already exists: "${esc(dup.post.primary_keyword||dup.post.title)}" (${dup.post.status}). <button class="btn btn-xs btn-ghost" style="margin-left:6px" onclick="openPost('${dup.post.id}','details');closeModal('new-post-modal')">View post</button>`;
      }else{dw.style.display='none'}
    };
  }
}
function getNewPostData(){
  return{
    kw:document.getElementById('np-kw').value.trim(),
    ks:parseInt(document.getElementById('np-ks').value)||null,
    vol:parseInt(document.getElementById('np-vol').value)||null,
    supp:getSuppString()||null,
    serp:document.getElementById('np-serp').value.trim()||null,
    take:document.getElementById('np-take').value.trim()||null,
    notes:document.getElementById('np-notes')?.value.trim()||null,
  };
}
async function saveToIdeas(){
  const d=getNewPostData();
  if(!d.kw){alert('Please enter a primary keyword.');return}
  const btn=document.getElementById('np-save-btn');btn.textContent='Saving…';btn.disabled=true;
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:d.kw,ks_score:d.ks,search_volume:d.vol,supplementary_keywords:d.supp,serp_notes:d.serp,unique_take:d.take,status:'idea',current_step:0,indexed:'no',title:d.notes?('[Notes] '+d.notes):null}).select().single();
  if(error){alert('Error: '+error.message);btn.textContent='Save to Ideas';btn.disabled=false;return}
  await sb.from('social_tracking').insert({post_id:data.id});
  await loadPosts();render();closeModal('new-post-modal');toast('Saved to Ideas');
  btn.textContent='Save to Ideas';btn.disabled=false;
}
async function saveAndGetBrief(){
  const d=getNewPostData();
  if(!d.kw){alert('Please enter a primary keyword.');return}
  const btn=document.getElementById('np-brief-btn');btn.textContent='Saving…';btn.disabled=true;
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:d.kw,ks_score:d.ks,search_volume:d.vol,supplementary_keywords:d.supp,serp_notes:d.serp,unique_take:d.take,status:'idea',current_step:0,indexed:'no',title:d.notes?('[Notes] '+d.notes):null}).select().single();
  if(error){alert('Error: '+error.message);btn.textContent='Get brief now →';btn.disabled=false;return}
  await sb.from('social_tracking').insert({post_id:data.id});
  await loadPosts();render();
  const prompt=buildBriefPrompt(d.kw,d.ks,d.vol,d.supp,d.take,d.serp,activeBlog);
  await copyToClipboard(prompt);
  closeModal('new-post-modal');
  toast('Saved + brief copied — opening Blogging project…');
  setTimeout(()=>window.open(BLOGGING_PROJECT_URL,'_blank'),600);
  btn.textContent='Get brief now →';btn.disabled=false;
}
async function getBriefForPost(id){
  const p=gp(id);if(!p)return;
  const prompt=buildBriefPrompt(p.primary_keyword,p.ks_score,p.search_volume,p.supplementary_keywords,p.unique_take,p.serp_notes,p.blog);
  await copyToClipboard(prompt);
  toast('Brief copied — opening Blogging project…');
  setTimeout(()=>window.open(BLOGGING_PROJECT_URL,'_blank'),600);
}
async function reCopyBrief(){
  if(!curPost)return;
  const p=gp(curPost);if(!p)return;
  const prompt=buildBriefPrompt(p.primary_keyword||p.title,p.ks_score,p.search_volume,p.supplementary_keywords,p.unique_take,p.serp_notes,p.blog);
  await copyToClipboard(prompt);
  toast('Brief prompt copied');
}

// KEYWORD RANKING
async function rankKeywords(){
  const apiKey=localStorage.getItem('claude-api-key');
  const supp=getSuppString();
  const kw=document.getElementById('np-kw').value.trim();
  if(!supp){toast('Add supplementary keywords first');return}
  if(!apiKey){toast('Add Claude API key in Settings first');return}
  const btn=document.getElementById('rank-btn');btn.textContent='…';btn.disabled=true;
  const result=document.getElementById('kw-rank-result');
  result.style.display='block';
  result.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:12px;color:var(--text2)"><div class="spinner"></div>Ranking keywords…</div>`;
  const prompt=`You are helping plan SEO content for a blog post targeting coaches and solopreneurs.\n\nPrimary keyword: "${kw}"\nSupplementary keywords: ${supp}\n\nFor each supplementary keyword recommend where to use it: H2 heading, intro_meta (intro and meta description), or natural (mention once naturally).\n\nRespond ONLY with JSON:\n[{"keyword":"exact keyword","category":"H2"|"intro_meta"|"natural","reason":"brief reason"}]`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:800,messages:[{role:'user',content:prompt}]})});
    const rd=await res.json();
    const recs=JSON.parse(rd.content?.[0]?.text?.replace(/```json|```/g,'').trim()||'[]');
    const catMap={'H2':'krl-h2','intro_meta':'krl-intro','natural':'krl-natural'};
    const catLabel={'H2':'H2 heading','intro_meta':'Intro + meta','natural':'Natural mention'};
    let html='<div class="kw-rank-box"><div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Keyword placement</div>';
    recs.forEach(r=>{html+=`<div class="kw-rank-item"><span class="kw-rank-label ${catMap[r.category]||'krl-natural'}">${catLabel[r.category]||r.category}</span><div style="font-size:12px;font-weight:600">${esc(r.keyword)}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(r.reason)}</div></div>`});
    result.innerHTML=html+'</div>';
  }catch(e){result.innerHTML=`<div style="font-size:12px;color:var(--red-t)">Could not rank: ${esc(e.message)}</div>`}
  finally{btn.textContent='✦ Rank';btn.disabled=false}
}

// KEYWORD DUMP
// ── KEYWORD RESEARCH SYSTEM ─────────────────────────────────────

// Default seed lists
const DEFAULT_PLATFORMS=['Kajabi','Teachable','Calendly','ActiveCampaign','ClickFunnels','Leadpages','Mailchimp','Dubsado','HoneyBook','Systeme.io','Kartra','Podia','Thinkific','Keap','HubSpot','Klaviyo'];
const DEFAULT_PROBLEMS=[
  'too many business tools',
  'tech overwhelm small business',
  'automate client onboarding',
  'consolidate business software',
  'reduce software costs',
  'email automation for coaches',
  'crm for coaches',
  'all in one platform for coaches',
  'automate follow up emails',
  'business systems for solopreneurs',
  'simplify online business tools',
  'client management software coaches',
  'online business too complicated',
  'how to manage a coaching business',
  'best tools for online coaches',
  'how to scale coaching business',
  'stop paying for too many apps',
  'cheap all in one business software',
  'business automation for coaches',
  'marketing automation small business'
];
// Platform modifiers — proven search patterns only
const PLATFORM_MODIFIERS_TOP=['alternatives','alternative','vs','pricing','review'];
const PLATFORM_MODIFIERS_OTHER=['for coaches','for solopreneurs','cheapest alternative'];
// Problem phrases stand alone — no modifiers stacked on them











// KW QUEUE (localStorage)



let _kwFilter='all';










// UNIFIED MULTI-FILE IMPORTER — handles Keysearch + GKP, merges overlaps
// GKP CSV import

// Keysearch CSV import

// Quick wins from GSC

// KW tab switching
let _kwTab='generate';

function initKeywordsTab(){
  // New Keywords tab is static HTML (seed box + research button); nothing to initialise.
  const ta=document.getElementById('kw-seeds');if(ta)ta.focus();
}


async function addKwToIdeas(el){const kw=el.dataset.kw,ks=el.dataset.ks,vol=el.dataset.vol;
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:kw,ks_score:parseInt(ks)||null,search_volume:parseInt(vol)||null,status:'idea',current_step:0,indexed:'no'}).select().single();
  if(error){toast('Error: '+error.message);return}
  await sb.from('social_tracking').insert({post_id:data.id});
  el.textContent='✓ Added';el.disabled=true;el.style.cssText='background:var(--green-l);color:var(--green);border:1px solid #b8dfc6;font-size:10px;padding:3px 8px;border-radius:30px';
  await loadPosts();toast('Added: '+kw);
}

async function addClusterAsPost(ci){
  const cluster=window._kwClusterData?.[ci];
  if(!cluster||!cluster.length)return;
  const primary=cluster[0];
  const supp=cluster.slice(1).map(k=>{
    const parts=[k.keyword];
    if(k.volume)parts.push(k.volume);
    if(k.ks!=null)parts.push('KS'+k.ks);
    return parts.join(' ');
  }).join(', ');
  const{data,error}=await sb.from('posts').insert({
    blog:activeBlog,
    primary_keyword:primary.keyword,
    ks_score:parseInt(primary.ks)||null,
    search_volume:parseInt(primary.volume)||null,
    supplementary_keywords:supp||null,
    status:'idea',current_step:0,indexed:'no'
  }).select().single();
  if(error){toast('Error: '+error.message);return}
  await sb.from('social_tracking').insert({post_id:data.id});
  await loadPosts();toast(`✓ Cluster added — "${titleCase(primary.keyword)}" as primary, ${cluster.length-1} supplementary`);
  // Mark the button as done
  const btns=document.querySelectorAll('.kw-cluster button');
  btns.forEach(b=>{if(b.textContent.includes('Add cluster')&&b.getAttribute('onclick')===`addClusterAsPost(${ci})`){b.textContent='✓ Added';b.disabled=true;b.style.cssText='background:var(--green-l);color:var(--green);border:1px solid #b8dfc6;border-radius:30px;font-size:10px;padding:3px 10px'}});
}

// POST MODAL
async function openPost(id,tab){
  curPost=id; // Progress checklist removed; _links cached + Links tab loads lazily
  const post=gp(id);if(!post)return;
  const kw=post.primary_keyword||'',title=post.title||'';
  document.getElementById('pm-title').textContent=kw||title||'Post';
  document.getElementById('pm-kw-display').textContent=kw&&title?title:(kw?'No title yet':'');
  document.getElementById('pm-title-i').value=title;
  document.getElementById('pm-url').value=post.url||'';
  document.getElementById('pm-status').value=post.status||'idea';
  const pmSched=document.getElementById('pm-sched');if(pmSched)pmSched.value=post.scheduled_date||'';
  const pmPub=document.getElementById('pm-pub');if(pmPub)pmPub.value=post.published_date||'';
  const pmProp=document.getElementById('pm-proposed');if(pmProp)pmProp.value=post.proposed_date||'';
  document.getElementById('pm-indexed').value=post.indexed||'no';
  document.getElementById('pm-kw').value=kw;
  document.getElementById('pm-ks').value=post.ks_score!=null?post.ks_score:'';
  document.getElementById('pm-vol').value=post.search_volume||'';
  document.getElementById('pm-supp').value=post.supplementary_keywords||'';
  {const pc=document.getElementById('pm-cluster');if(pc)pc.value=post.cluster||'';const pp=document.getElementById('pm-pillar');if(pp)pp.value=post.is_pillar?'yes':'';}
  document.getElementById('pm-serp-link').value=post.serp_notes||'';
  document.getElementById('pm-doc-link').value=post.unique_take||'';
  document.getElementById('pm-take').value='';
  const isN=activeBlog==='nms';
  document.getElementById('pm-save-btn').className='btn '+(isN?'btn-pp':'btn-p');
  document.getElementById('pm-add-link-btn').className='btn '+(isN?'btn-pp':'btn-p')+' btn-sm';
  document.getElementById('sug-btn').className='btn '+(isN?'btn-pp':'btn-p')+' btn-sm';
  const social=post.social_tracking?.[0];curSocId=social?.id||null;
  const cks=['pin-img','pin-sched','pin-shared','pin-blog','fb-img','fb-sched','fb-shared','ig-img','ig-sched','ig-shared'];
  const flds=['pinterest_image_created','pinterest_scheduled','pinterest_shared','pinterest_in_blog','fb_image_created','fb_scheduled','fb_shared','ig_image_created','ig_scheduled','ig_shared'];
  cks.forEach((c,i)=>{const el=document.getElementById('ch-'+c),ci=document.getElementById('ci-'+c);if(el){el.checked=!!(social?.[flds[i]]);if(ci)ci.classList.toggle('done',el.checked)}});
  document.getElementById('pm-del-row').classList.remove('on');
  document.getElementById('sug-area').innerHTML='';
  document.getElementById('sug-btn').textContent='Get suggestions';
  document.getElementById('sug-btn').disabled=false;
  // Show/hide live post link
  const liveLink=document.getElementById('pm-live-link');
  if(liveLink){
    if(post.status==='live'&&post.url){liveLink.style.display='inline-flex';liveLink.href=post.url}
    else{liveLink.style.display='none';liveLink.href='#'}
  }
  // Show review button only for live posts with a URL
  const reviewBtn=document.getElementById('review-post-btn');
  if(reviewBtn)reviewBtn.style.display=(post.status==='live'&&post.url)?'inline-flex':'none';
  document.getElementById('post-modal').classList.add('on');
  switchPTab(tab||'draft');
}
async function savePost(){
  if(!curPost)return;
  const btn=document.getElementById('pm-save-btn');
  btn.textContent='Saving…';btn.disabled=true;
  try{
    const u={
      title:document.getElementById('pm-title-i')?.value.trim()||null,
      url:document.getElementById('pm-url')?.value.trim()||null,
      status:document.getElementById('pm-status')?.value||'idea',
      scheduled_date:document.getElementById('pm-sched')?.value||null,
      published_date:document.getElementById('pm-pub')?.value||null,
      proposed_date:document.getElementById('pm-proposed')?.value||null,
      indexed:document.getElementById('pm-indexed')?.value||'no',
      primary_keyword:document.getElementById('pm-kw')?.value.trim()||null,
      ks_score:parseInt(document.getElementById('pm-ks')?.value)||null,
      search_volume:parseInt(document.getElementById('pm-vol')?.value)||null,
      supplementary_keywords:document.getElementById('pm-supp')?.value.trim()||null,
      serp_notes:document.getElementById('pm-serp-link')?.value.trim()||null,
      unique_take:document.getElementById('pm-doc-link')?.value.trim()||null,
      priority:document.getElementById('pm-priority')?.value||null,
      cluster:document.getElementById('pm-cluster')?.value.trim()||null,
      is_pillar:document.getElementById('pm-pillar')?.value==='yes',
    };
    const{error}=await sb.from('posts').update(u).eq('id',curPost);
    if(error)throw error;
    await loadPosts();render();toast('Saved ✓');
  }catch(e){
    toast('Error: '+e.message);
    console.error('savePost error:',e);
  }finally{
    btn.textContent='Save changes';btn.disabled=false;
  }
}
async function saveSocial(){
  if(!curSocId&&!curPost)return;
  const u={
    pinterest_image_created:document.getElementById('ch-pin-img').checked,
    pinterest_scheduled:document.getElementById('ch-pin-sched')?.checked||false,
    pinterest_shared:document.getElementById('ch-pin-shared').checked,
    pinterest_in_blog:document.getElementById('ch-pin-blog').checked,
    fb_image_created:document.getElementById('ch-fb-img').checked,
    fb_scheduled:document.getElementById('ch-fb-sched')?.checked||false,
    fb_shared:document.getElementById('ch-fb-shared').checked,
    ig_image_created:document.getElementById('ch-ig-img').checked,
    ig_scheduled:document.getElementById('ch-ig-sched')?.checked||false,
    ig_shared:document.getElementById('ch-ig-shared').checked
  };
  // Update UI
  ['pin-img','pin-sched','pin-shared','pin-blog','fb-img','fb-sched','fb-shared','ig-img','ig-sched','ig-shared'].forEach(c=>{
    const ci=document.getElementById('ci-'+c),el=document.getElementById('ch-'+c);
    if(ci&&el)ci.classList.toggle('done',el.checked);
  });
  if(curSocId){await sb.from('social_tracking').update(u).eq('id',curSocId)}
  else{const{data}=await sb.from('social_tracking').insert({...u,post_id:curPost}).select().single();if(data)curSocId=data.id}
  await loadPosts();renderDashboard();renderPosts();
}
function confirmDel(){document.getElementById('pm-del-row').classList.add('on')}
async function deletePost(){
  if(!curPost)return;
  await sb.from('posts').delete().eq('id',curPost);await loadAll();render();closeModal('post-modal');toast('Post deleted');
}

// CHECKLIST

// GSC
function showAddGsc(){document.getElementById('gsc-form').style.display='block';document.getElementById('gsc-date').value=localToday()}
function hideAddGsc(){document.getElementById('gsc-form').style.display='none'}
async function renderGscHistory(){
  if(!curPost)return;
  const{data}=await sb.from('gsc_positions').select('*').eq('post_id',curPost).order('recorded_date',{ascending:false});
  const rows=data||[];
  if(!rows.length){document.getElementById('gsc-tbody').innerHTML=`<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--text3)">No rankings yet — the weekly auto-snapshot will fill this in.</td></tr>`;return}
  document.getElementById('gsc-tbody').innerHTML=rows.map((r,i)=>{const pv=rows[i+1];let ch='—';if(pv&&r.position&&pv.position){const d=pv.position-r.position;ch=d>0?`<span class="pos-up">▲${d.toFixed(1)}</span>`:d<0?`<span class="pos-dn">▼${Math.abs(d).toFixed(1)}</span>`:'—'}
  const n=r.notes||'';
  const src=n.includes('GSC-auto')?'Auto':n.startsWith('SerpRobot')?'SerpRobot':n.startsWith('GSC')?'GSC':'Manual';
  const srcColor=src==='Auto'?'var(--green)':src==='SerpRobot'?'var(--teal-d)':src==='GSC'?'var(--blue)':'var(--text3)';
  const ctr=(r.impressions&&r.clicks!=null)?((r.clicks/r.impressions)*100).toFixed(1)+'%':'—';
  return`<tr><td>${fd(r.recorded_date)}</td><td style="font-weight:700">${r.position||'—'}</td><td>${r.impressions?.toLocaleString()||'—'}</td><td>${r.clicks?.toLocaleString()||'—'}</td><td>${ctr}</td><td>${ch}</td><td style="font-size:10px;font-weight:600;color:${srcColor}">${src}</td><td><button class="btn btn-danger btn-xs" onclick="delGsc('${r.id}')">✕</button></td></tr>`}).join('');
}
async function saveGsc(){
  const e={post_id:curPost,recorded_date:document.getElementById('gsc-date').value||localToday(),position:parseFloat(document.getElementById('gsc-pos').value)||null,impressions:parseInt(document.getElementById('gsc-impr').value)||null,clicks:parseInt(document.getElementById('gsc-clicks').value)||null,notes:document.getElementById('gsc-notes').value.trim()||null};
  if(!e.position){alert('Please enter a position.');return}
  await sb.from('gsc_positions').insert(e);
  ['gsc-pos','gsc-impr','gsc-clicks','gsc-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  hideAddGsc();renderGscHistory();renderDashRankings();toast('Ranking saved');
}
async function delGsc(id){await sb.from('gsc_positions').delete().eq('id',id);renderGscHistory()}

// ── OPTIMIZATION PANEL (Rankings tab): live metrics + health + optimization log ──
let _gscMetrics=null;
async function renderRankingsTab(){
  await renderGscMetrics();   // sets _gscMetrics (used by the log's before/after)
  await renderOptLog();
  renderGscHistory();
}
function _statTile(label,val,sub){return`<div style="flex:1;min-width:0;background:var(--bg2);border-radius:var(--r2);padding:10px 12px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">${label}</div><div style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:2px">${val}</div>${sub?`<div style="font-size:10px;color:var(--text3);margin-top:1px">${sub}</div>`:''}</div>`}
function _chip(text,tone){const c={amber:['#8a5a00','#fff7e6','#f2d9a0'],blue:['#1a4d8f','var(--blue-l)','#b8ccf0'],green:['#1c6b3a','#e9f7ee','#b6e0c4'],grey:['var(--text2)','var(--bg2)','var(--border)']}[tone||'grey'];return`<span style="display:inline-block;font-size:11px;font-weight:600;color:${c[0]};background:${c[1]};border:1px solid ${c[2]};border-radius:20px;padding:3px 10px;margin:0 6px 6px 0">${text}</span>`}
function _healthFlags(page,post){
  const f=[];
  if(!page||!page.impressions){f.push(_chip('No search impressions yet — give it time / check indexing','grey'));}
  else{
    const pos=page.position,ctr=page.ctr||0,impr=page.impressions;
    if(pos<=5&&ctr>=0.03)f.push(_chip('✓ Performing well','green'));
    if(pos<=10&&ctr<0.02&&impr>=50)f.push(_chip('Page 1 but low CTR — sharpen title/meta','amber'));
    if(pos>10&&pos<=20)f.push(_chip('Just off page 1 — push it up','blue'));
    if(pos>20&&pos<=50&&impr>=50)f.push(_chip('Page 2–3 with real demand — needs a lift','blue'));
    if(pos>50&&impr>=50)f.push(_chip('Ranking far back — big rewrite or new post','grey'));
  }
  if(post&&post.indexed&&post.indexed!=='yes')f.push(_chip('Not confirmed indexed','amber'));
  return f.length?f.join(''):_chip('No flags','grey');
}
async function renderGscMetrics(){
  _gscMetrics=null;
  const el=document.getElementById('pm-gsc-metrics');if(!el)return;
  const post=allPosts.find(p=>p.id===curPost);
  if(!post||!post.url){el.innerHTML='<div class="empty" style="padding:1rem">No live URL yet — publish this post to start tracking Search Console results.</div>';return}
  el.innerHTML='<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);padding:.5rem"><div class="spinner"></div>Loading Search Console data…</div>';
  let j;
  try{const r=await fetch('/.netlify/functions/gsc-metrics?blog='+encodeURIComponent(post.blog||activeBlog)+'&url='+encodeURIComponent(post.url));j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));}
  catch(e){el.innerHTML='<div class="empty" style="padding:1rem;color:var(--red-t)">Could not load metrics: '+esc(String(e&&e.message||e))+'</div>';return;}
  _gscMetrics=j;
  const p=j.page;
  const tiles=p?`<div style="display:flex;gap:8px;margin-bottom:10px">
      ${_statTile('Position',p.position.toFixed(1))}
      ${_statTile('Impressions',p.impressions.toLocaleString())}
      ${_statTile('Clicks',p.clicks.toLocaleString())}
      ${_statTile('CTR',(p.ctr*100).toFixed(2)+'%')}
    </div>`:'<div class="empty" style="padding:.75rem;margin-bottom:10px">No Search Console impressions in the last 90 days.</div>';
  const q=(j.queries||[]).slice(0,6);
  const qList=q.length?`<div style="margin-top:6px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text3);margin-bottom:4px">Top queries</div>${q.map(x=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0;border-bottom:1px solid var(--bg2)"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.query)}</span><span style="color:var(--text3);white-space:nowrap;font-variant-numeric:tabular-nums">pos ${x.position.toFixed(1)} · ${x.impressions.toLocaleString()} impr · ${(x.ctr*100).toFixed(1)}%</span></div>`).join('')}</div>`:'';
  el.innerHTML=`<div class="card" style="padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700">Search Console — last 90 days</div>
      <div style="font-size:10px;color:var(--text3)">${j.range?esc(j.range.start+' → '+j.range.end):''}</div>
    </div>
    ${tiles}
    <div>${_healthFlags(p,post)}</div>
    ${qList}
  </div>`;
}
function showOptForm(){const f=document.getElementById('opt-form');if(f){f.style.display='block';const d=document.getElementById('opt-date');if(d&&!d.value)d.value=localToday();}}
function hideOptForm(){const f=document.getElementById('opt-form');if(f)f.style.display='none';}
async function saveOptimization(){
  if(!curPost)return;
  const post=allPosts.find(p=>p.id===curPost);
  const kind=(document.getElementById('opt-kind')||{}).value||'other';
  const opt_date=(document.getElementById('opt-date')||{}).value||localToday();
  const note=((document.getElementById('opt-note')||{}).value||'').trim()||null;
  const pg=_gscMetrics&&_gscMetrics.page;
  const baseline=pg?{position:pg.position,impressions:pg.impressions,clicks:pg.clicks,ctr:pg.ctr,window:'90d',captured:localToday()}:null;
  const{error}=await sb.from('optimizations').insert({post_id:curPost,blog:post?post.blog:activeBlog,opt_date,kind,note,baseline});
  if(error){toast('Save failed: '+error.message,4000);return;}
  // drop a marker on the position history so the "before" point is visible on the trend
  if(baseline)await sb.from('gsc_positions').insert({post_id:curPost,recorded_date:opt_date,position:baseline.position,impressions:baseline.impressions,clicks:baseline.clicks,notes:'optimization: '+kind+(note?' — '+note:'')});
  ['opt-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  hideOptForm();renderOptLog();renderGscHistory();toast('Optimization logged ✓');
}
async function delOpt(id){if(!confirm('Delete this optimization log entry?'))return;await sb.from('optimizations').delete().eq('id',id);renderOptLog();}
function _optKindLabel(k){return{'title-meta':'Title / meta','content':'Content','links':'Internal links','featured':'Featured image','keywords':'Keyword targeting','other':'Other'}[k]||k;}
function _delta(before,after,lowerBetter){
  if(before==null||after==null)return '<span style="color:var(--text3)">—</span>';
  const d=after-before;const good=lowerBetter?d<0:d>0;
  if(Math.abs(d)<(lowerBetter?0.1:0.0005))return '<span style="color:var(--text3)">no change</span>';
  const arrow=good?'▲':'▼';const col=good?'var(--green)':'var(--red-t)';
  return `<span style="color:${col};font-weight:700">${arrow} ${lowerBetter?Math.abs(d).toFixed(1):''}</span>`;
}
async function renderOptLog(){
  const el=document.getElementById('pm-opt-list');if(!el||!curPost)return;
  const{data}=await sb.from('optimizations').select('*').eq('post_id',curPost).order('opt_date',{ascending:false});
  const rows=data||[];
  if(!rows.length){el.innerHTML='<div class="empty" style="padding:.75rem">No optimizations logged yet. When you improve this post, log it here to measure the lift.</div>';return;}
  const cur=_gscMetrics&&_gscMetrics.page;
  el.innerHTML=rows.map(o=>{
    const b=o.baseline||{};
    const beforeTxt=b.position!=null?`pos ${(+b.position).toFixed(1)} · ${(+b.impressions||0).toLocaleString()} impr · ${((+b.ctr||0)*100).toFixed(1)}% CTR`:'no baseline captured';
    let afterBlock='';
    if(cur&&b.position!=null){
      afterBlock=`<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin-top:6px">
        <span>Position ${(+b.position).toFixed(1)} → <b>${cur.position.toFixed(1)}</b> ${_delta(+b.position,cur.position,true)}</span>
        <span>Clicks ${(+b.clicks||0).toLocaleString()} → <b>${cur.clicks.toLocaleString()}</b> ${_delta(+b.clicks||0,cur.clicks,false)}</span>
        <span>CTR ${((+b.ctr||0)*100).toFixed(1)}% → <b>${(cur.ctr*100).toFixed(1)}%</b> ${_delta(+b.ctr||0,cur.ctr,false)}</span>
      </div>`;
    }
    return`<div class="card" style="padding:11px 13px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:700">${esc(_optKindLabel(o.kind))} <span style="color:var(--text3);font-weight:400">· ${fd(o.opt_date)}</span></div>
          ${o.note?`<div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(o.note)}</div>`:''}
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Before: ${beforeTxt}</div>
          ${afterBlock}
        </div>
        <button class="btn btn-danger btn-xs" onclick="delOpt('${o.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

// GSC IMPORT
async function handleGscFile(event){
  const file=event.target.files[0];if(!file)return;
  const importDate=document.getElementById('gsc-import-date').value||localToday();
  const resultEl=document.getElementById('gsc-import-result');
  resultEl.innerHTML='<div style="display:flex;align-items:center;gap:6px"><div class="spinner"></div> Reading CSV…</div>';
  document.getElementById('gsc-file-label').textContent='✓ '+file.name;
  const text=await file.text();
  const lines=text.split('\n').filter(l=>l.trim());
  if(!lines.length){resultEl.innerHTML='<span style="color:var(--red-t)">Could not read file.</span>';return}
  function parseCSVLine(line){const result=[];let current='',inQ=false;for(let i=0;i<line.length;i++){if(line[i]==='"'){inQ=!inQ}else if(line[i]===','&&!inQ){result.push(current.trim());current=''}else{current+=line[i]}}result.push(current.trim());return result}
  const headers=parseCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/['"]/g,'').trim());
  const urlIdx=headers.findIndex(h=>h.includes('page')||h.includes('url')||h.includes('top page'));
  const posIdx=headers.findIndex(h=>h.includes('position')||h.includes('rank'));
  const imprIdx=headers.findIndex(h=>h.includes('impression'));
  const clickIdx=headers.findIndex(h=>h.includes('click'));
  if(urlIdx===-1||posIdx===-1){resultEl.innerHTML='<span style="color:var(--red-t)">Could not find URL and Position columns.</span>';return}
  const posts=allPosts.filter(p=>p.url);
  let matched=0,skipped=0;const inserts=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const cols=parseCSVLine(lines[i]);
    const rowUrl=(cols[urlIdx]||'').replace(/['"]/g,'').trim();
    const position=parseFloat((cols[posIdx]||'').replace(/['"]/g,'').trim());
    if(!rowUrl||isNaN(position)){skipped++;continue}
    const post=posts.find(p=>p.url===rowUrl||p.url===rowUrl.replace(/\/$/,'')||rowUrl.includes(p.url.replace(/https?:\/\//,'').replace(/\/$/,'')));
    if(!post){skipped++;continue}
    inserts.push({post_id:post.id,recorded_date:importDate,position,impressions:imprIdx>=0?parseInt((cols[imprIdx]||'').replace(/['"]/g,''))||null:null,clicks:clickIdx>=0?parseInt((cols[clickIdx]||'').replace(/['"]/g,''))||null:null});
    matched++;
  }
  if(!inserts.length){resultEl.innerHTML=`<span style="color:var(--amber-t)">No URLs matched. ${skipped} rows skipped.</span>`;return}
  const batchSize=50;
  for(let i=0;i<inserts.length;i+=batchSize){await sb.from('gsc_positions').insert(inserts.slice(i,i+batchSize))}
  resultEl.innerHTML=`<span style="color:var(--green)">✓ Imported ${matched} position${matched!==1?'s':''}. ${skipped} skipped.</span>`;
  event.target.value='';renderDashRankings();toast(`${matched} GSC positions imported`);
}

// MODAL LINKS
async function renderModalLinks(){
  if(!curPost)return;await loadLinks();
  const out=_links.filter(l=>l.from_post_id===curPost),inc=_links.filter(l=>l.to_post_id===curPost);
  // Split outbound into blog post links and page/dest links
  const postLinks=out.filter(l=>l.to_post_id);
  const pageLinks=out.filter(l=>l.to_dest_id);
  const pl=postLinks.length,pgl=pageLinks.length;
  const plLv=pl>=3?'green':pl>0?'amber':'red';
  const pglLv=pgl>=2?'green':pgl>0?'amber':'red';
  document.getElementById('lc-badge').innerHTML=`<span class="flag f-${plLv}" style="margin-right:4px">${pl}/3 posts</span><span class="flag f-${pglLv}">${pgl}/2 pages</span>`;
  let html='';
  if(!out.length)html='<div style="font-size:12px;color:var(--text3);padding:4px 0 10px">No outbound links yet. Aim for 3 blog posts + 2 pages.</div>';
  else{
    if(postLinks.length){html+=`<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;margin-top:2px">Blog posts (${pl}/3)</div>`;postLinks.forEach(l=>{const t=gt(l.to_post_id||l.to_dest_id);if(!t)return;html+=`<div class="lr"><div style="flex:1;font-size:12px;font-weight:500">${esc(t.label)}</div><button class="btn btn-danger btn-xs" onclick="removeLink('${l.id}')">Remove</button></div>`})}
    if(pageLinks.length){html+=`<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;margin-top:10px">Pages (${pgl}/2)</div>`;pageLinks.forEach(l=>{const t=gt(l.to_post_id||l.to_dest_id);if(!t)return;html+=`<div class="lr"><div style="flex:1;font-size:12px;font-weight:500">${esc(t.label)} <span class="pill pill-g">page</span></div><button class="btn btn-danger btn-xs" onclick="removeLink('${l.id}')">Remove</button></div>`})}
  }
  document.getElementById('pm-link-list').innerHTML=html;
  const sel=document.getElementById('pm-link-sel');sel.innerHTML='<option value="">— select —</option>';
  const li=new Set(out.map(l=>l.to_post_id||l.to_dest_id));
  const ap=bp().filter(p=>p.id!==curPost&&!li.has(p.id));
  const ad=bd().filter(d=>!li.has(d.id));
  if(ap.length){const og=document.createElement('optgroup');og.label='Blog posts (aim for 3)';ap.forEach(p=>{const o=document.createElement('option');o.value='p:'+p.id;o.textContent=(p.primary_keyword||p.title||'Untitled');og.appendChild(o)});sel.appendChild(og)}
  if(ad.length){const og=document.createElement('optgroup');og.label='Pages (aim for 2)';ad.forEach(d=>{const o=document.createElement('option');o.value='d:'+d.id;o.textContent=d.label;og.appendChild(o)});sel.appendChild(og)}
  let inh='';
  if(!inc.length)inh='<div style="font-size:12px;color:var(--text3);padding:4px 0">No posts link here yet</div>';
  else inc.forEach(l=>{const f=gp(l.from_post_id);if(!f)return;inh+=`<div class="lr"><span style="color:var(--text3)">←</span><div style="font-size:12px;font-weight:500">${esc(f.primary_keyword||f.title)}</div></div>`});
  document.getElementById('pm-inbound').innerHTML=inh;
}
async function addLink(){
  const val=document.getElementById('pm-link-sel').value;if(!val||!curPost)return;
  const[type,id]=val.split(':');
  await sb.from('internal_links').insert({blog:activeBlog,from_post_id:curPost,to_post_id:type==='p'?id:null,to_dest_id:type==='d'?id:null});
  await loadLinks();renderModalLinks();render();toast('Link added');
}
async function removeLink(lid){await sb.from('internal_links').delete().eq('id',lid);await loadLinks();renderModalLinks();render()}

// AI SUGGESTIONS
async function getSuggestions(){
  const apiKey=localStorage.getItem('claude-api-key');
  if(!apiKey){document.getElementById('sug-area').innerHTML=`<div style="background:var(--amber-l);border:1px solid var(--amber);border-radius:var(--r2);padding:10px;font-size:12px;color:var(--amber-t)">No API key. Add in Settings.</div>`;return}
  const post=gp(curPost);if(!post)return;
  const li=new Set(_links.filter(l=>l.from_post_id===curPost).map(l=>l.to_post_id).filter(Boolean));
  const cands=bp().filter(p=>p.id!==curPost&&!li.has(p.id)&&p.status==='live');
  if(!cands.length){document.getElementById('sug-area').innerHTML='<div style="font-size:12px;color:var(--text3)">No unlinked live posts.</div>';return}
  const btn=document.getElementById('sug-btn');btn.disabled=true;btn.textContent='Thinking…';
  document.getElementById('sug-area').innerHTML=`<div class="sug-box"><div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--teal-t)"><div class="spinner"></div>Asking Claude…</div></div>`;
  const cl=cands.map((p,i)=>`${i+1}. "${p.primary_keyword||p.title}"${p.supplementary_keywords?' | '+p.supplementary_keywords:''}`).join('\n');
  const prompt=`Internal link suggestions for ${BM[activeBlog].name} blog.\n\nPost: "${post.primary_keyword||post.title}"\n${post.supplementary_keywords?'Supp: '+post.supplementary_keywords:''}\n\nAvailable live posts:\n${cl}\n\nRecommend 3 most relevant. One sentence reason each.\n\nJSON only:\n[{"index":1,"title":"keyword or title","reason":"reason"}]`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:600,messages:[{role:'user',content:prompt}]})});
    const rd=await res.json();
    const sugs=JSON.parse(rd.content?.[0]?.text?.replace(/```json|```/g,'').trim()||'[]');
    let html='<div class="sug-box">';
    sugs.forEach(s=>{const m=cands.find(c=>(c.primary_keyword||c.title)===s.title)||cands[s.index-1];if(!m)return;html+=`<div class="sug-item"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${esc(m.primary_keyword||m.title)}</div><div class="sug-rsn">${esc(s.reason)}</div></div><button class="btn btn-p btn-xs" id="sugbtn-${m.id}" onclick="addSugLink('${m.id}')">Add</button></div></div>`});
    document.getElementById('sug-area').innerHTML=html+'</div>';
  }catch(e){document.getElementById('sug-area').innerHTML=`<div style="background:var(--red-l);border-radius:var(--r2);padding:10px;font-size:12px;color:var(--red-t)">Error: ${esc(e.message)}</div>`}
  finally{btn.disabled=false;btn.textContent='Get suggestions'}
}
async function addSugLink(toId){
  if(!curPost)return;
  await sb.from('internal_links').insert({blog:activeBlog,from_post_id:curPost,to_post_id:toId,to_dest_id:null});
  await loadLinks();renderModalLinks();render();
  const btn=document.getElementById('sugbtn-'+toId);
  if(btn){btn.textContent='Added';btn.disabled=true;btn.style.cssText='background:var(--green-l);color:var(--green);border:1px solid #b8dfc6;font-size:10px;padding:3px 8px'}
  toast('Link added');
}

// DESTINATIONS
function renderDestList(){
  const el=document.getElementById('dest-list');if(!el)return;
  if(!allDests.length){el.innerHTML='<div style="font-size:12px;color:var(--text3)">No destinations yet.</div>';return}
  el.innerHTML=allDests.map(d=>`<div class="lr"><span class="badge ${d.blog==='esc'?'b-live':'b-drafted'}" style="flex-shrink:0">${d.blog==='esc'?'ESC':'NMS'}</span><div style="flex:1;min-width:0;font-size:12px"><strong>${esc(d.label)}</strong> <span style="color:var(--text3)">${esc(d.url)}</span></div><button class="btn btn-danger btn-xs" onclick="deleteDest('${d.id}')">✕</button></div>`).join('');
}
async function addDest(){
  const blog=document.getElementById('dest-blog').value,label=document.getElementById('dest-label').value.trim(),url=document.getElementById('dest-url').value.trim();
  if(!label||!url){alert('Enter both label and URL.');return}
  await sb.from('link_destinations').insert({id:blog[0]+'d'+Date.now(),blog,label,url});
  await loadDests();renderDestList();
  document.getElementById('dest-label').value='';document.getElementById('dest-url').value='';toast('Destination added');
}
async function deleteDest(id){await sb.from('link_destinations').delete().eq('id',id);await loadDests();renderDestList()}

// SETTINGS
function showSettings(){
  const url=localStorage.getItem('sb-url')||'',ak=localStorage.getItem('claude-api-key'),cadence=localStorage.getItem('pub-cadence')||'1';
  const tz=localStorage.getItem('tz-offset')||'0';
  document.getElementById('set-sb-url').value=url;
  document.getElementById('set-sb-key').value='';
  document.getElementById('set-api-key').placeholder=ak?'sk-ant-••••••':'sk-ant-...';
  document.getElementById('set-api-msg').textContent=ak?'API key saved.':'No API key saved.';
  document.getElementById('set-cadence').value=cadence;
  document.getElementById('set-tz-offset').value=tz;
  document.getElementById('set-tz-preview').textContent='Today = '+localToday();
  document.getElementById('gsc-import-date').value=localToday();
  renderDestList();document.getElementById('settings-modal').classList.add('on');
}
function saveTzOffset(){
  const v=document.getElementById('set-tz-offset').value;
  localStorage.setItem('tz-offset',v);
  document.getElementById('set-tz-preview').textContent='Today = '+localToday();
  toast('Timezone saved');
  renderDashboard();
}

// RESET
function showReset(b){document.getElementById('rst-'+b).classList.add('on')}
function hideReset(b){document.getElementById('rst-'+b).classList.remove('on')}
async function doReset(b){
  await sb.from('posts').delete().eq('blog',b);await loadAll();render();hideReset(b);toast((b==='esc'?'ESC Hub':'NMS')+' data reset');
}

// MODAL HELPERS
function closeModal(id){document.getElementById(id).classList.remove('on')}
function mbgClick(e,id){if(e.target===document.getElementById(id))closeModal(id)}

// CELEBRATION
function celebrate(keyword){
  const overlay=document.getElementById('celebrate-overlay');
  const kw=document.getElementById('celebrate-kw');
  const sub=document.getElementById('celebrate-sub');
  if(!overlay)return;
  kw.textContent=keyword;
  sub.textContent='Post complete! 🎉';
  overlay.classList.add('on');
  spawnConfetti();
  setTimeout(()=>overlay.classList.remove('on'),3000);
}
function spawnConfetti(){
  const wrap=document.getElementById('confetti-wrap');
  if(!wrap)return;
  wrap.innerHTML='';
  const colors=['#29abac','#209a9b','#7c5cbf','#e8960a','#2a7d3f','#e04444','#fff'];
  for(let i=0;i<60;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    el.style.cssText=`left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;animation-delay:${Math.random()*0.8}s;animation-duration:${2+Math.random()*1.5}s;border-radius:${Math.random()>0.5?'50%':'2px'}`;
    wrap.appendChild(el);
  }
  setTimeout(()=>{wrap.innerHTML=''},4000);
}
function checkMilestone(){
  const posts=bp();
  const completePosts=posts.filter(p=>p.current_step>=6).length;
  const milestones=[5,10,25,50,100];
  const key='milestone-'+activeBlog;
  const reached=parseInt(localStorage.getItem(key)||'0');
  for(const m of milestones){
    if(completePosts>=m&&reached<m){
      localStorage.setItem(key,m);
      const msgs={5:'5 posts fully complete — great start!',10:'10 posts done — you are building momentum!',25:'25 posts complete — a quarter century! 🌟',50:'50 posts fully complete — halfway hero! 🏆',100:'100 posts complete — absolutely incredible! 🚀'};
      showMilestone(msgs[m]||`${m} posts complete!`);
      break;
    }
  }
}
function showMilestone(msg){
  const el=document.getElementById('milestone-toast');
  if(!el)return;
  el.textContent='🏆 '+msg;
  el.classList.add('on');
  setTimeout(()=>el.classList.remove('on'),5000);
}
async function requestIndexing(id){
  const p=gp(id);if(!p||!p.url)return;
  await sb.from('posts').update({indexed:'requested'}).eq('id',id);
  await loadPosts();render();
  const gscUrl=GSC_URLS[p.blog]+encodeURIComponent(p.url);
  window.open(gscUrl,'_blank');
  toast('Marked as index requested — submit in GSC');
}
async function checkIndexing(id){
  const p=gp(id);if(!p||!p.url){toast('No URL set for this post');return}
  const gscUrl=GSC_URLS[p.blog]+encodeURIComponent(p.url);
  window.open(gscUrl,'_blank');
  // Copy URL to clipboard as fallback in case GSC doesn't pre-fill
  try{await navigator.clipboard.writeText(p.url)}catch(e){}
  toast('Post URL copied to clipboard — paste into GSC URL inspection if needed',3500);
}
async function confirmIndexed(id){
  await sb.from('posts').update({indexed:'yes'}).eq('id',id);
  await loadPosts();render();toast('Marked as indexed ✓');
}
// ── WEEKLY IMPORT BUTTONS ────────────────────────────────────────
function getWeekKey(source){
  const now=new Date();
  const mon=new Date(now);
  mon.setDate(now.getDate()-((now.getDay()+6)%7));
  return source+'-week-'+mon.toISOString().split('T')[0];
}
function isWeeklyDone(source){return localStorage.getItem(getWeekKey(source))==='done'}
function markWeeklyDone(source){localStorage.setItem(getWeekKey(source),'done')}
function updateWeeklyButtons(){
  const srBtn=document.getElementById('weekly-sr-btn');
  const gscBtn=document.getElementById('weekly-gsc-btn');
  if(!srBtn||!gscBtn)return;
  const srDone=isWeeklyDone('serprobot');
  const gscDone=isWeeklyDone('gsc');
  srBtn.className='btn btn-sm weekly-import-btn'+(srDone?' weekly-done':' weekly-active');
  srBtn.innerHTML=srDone?'✓ SerpRobot imported':'⬆ Import SerpRobot';
  gscBtn.className='btn btn-sm weekly-import-btn'+(gscDone?' weekly-done':' weekly-active');
  gscBtn.innerHTML=gscDone?'✓ GSC imported':'⬆ Import GSC';
}

// SerpRobot CSV import
function openSerpRobotImport(){
  document.getElementById('sr-import-modal').classList.add('on');
  document.getElementById('sr-import-date').value=localToday();
  document.getElementById('sr-import-result').innerHTML='';
  document.getElementById('sr-file-label').textContent='Click to upload SerpRobot CSV';
}

async function handleSerpRobotFile(e){
  const file=e.target.files[0];if(!file)return;
  document.getElementById('sr-file-label').textContent=file.name+' — processing…';
  const importDate=document.getElementById('sr-import-date').value||localToday();
  // SerpRobot CSV is UTF-16 tab-separated: Keyword, Rank, Change, Volume
  const buffer=await file.arrayBuffer();
  let text='';
  try{
    // Try UTF-16 LE (with BOM)
    const decoder=new TextDecoder('utf-16le');
    const raw=decoder.decode(buffer);
    text=raw.replace(/^\uFEFF/,'');
  }catch(ex){
    text=new TextDecoder('utf-8').decode(buffer);
  }
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length){document.getElementById('sr-import-result').innerHTML='<div style="color:var(--red-t);font-size:12px">Could not read file.</div>';return}
  const header=lines[0].split('\t').map(h=>h.trim().toLowerCase());
  const kwIdx=header.findIndex(h=>h.includes('keyword'));
  const rankIdx=header.findIndex(h=>h.includes('rank'));
  const changeIdx=header.findIndex(h=>h.includes('change'));
  const volIdx=header.findIndex(h=>h.includes('volume'));
  if(kwIdx===-1||rankIdx===-1){document.getElementById('sr-import-result').innerHTML='<div style="color:var(--red-t);font-size:12px">Could not find Keyword and Rank columns. Check your export format.</div>';return}
  const rows=lines.slice(1).map(l=>l.split('\t').map(c=>c.trim())).filter(r=>r.length>rankIdx);
  let matched=0,skipped=0,updated=0;
  for(const row of rows){
    const kw=(row[kwIdx]||'').toLowerCase().trim();
    const rank=parseFloat(row[rankIdx]);
    const change=changeIdx>=0?parseFloat(row[changeIdx])||null:null;
    const vol=volIdx>=0?parseInt(row[volIdx])||null:null;
    if(!kw||isNaN(rank))continue;
    const post=allPosts.find(p=>p.blog===activeBlog&&(p.primary_keyword||'').toLowerCase().trim()===kw);
    if(!post){skipped++;continue}
    matched++;
    // Log to gsc_positions with source=serprobot
    await sb.from('gsc_positions').insert({post_id:post.id,recorded_date:importDate,position:rank,notes:'SerpRobot'+(change!=null?` | change: ${change>0?'+':''}${change}`:'')});
    // Update search volume if we have it
    if(vol&&vol>0){await sb.from('posts').update({search_volume:vol}).eq('id',post.id);updated++}
  }
  await loadPosts();
  document.getElementById('sr-import-result').innerHTML=`<div style="font-size:12px;color:var(--green);font-weight:600">✓ Import complete</div><div style="font-size:12px;color:var(--text2);margin-top:4px">${matched} keywords matched · ${skipped} not found · ${updated} volumes updated</div>`;
  document.getElementById('sr-file-label').textContent='✓ '+file.name;
  markWeeklyDone('serprobot');updateWeeklyButtons();
}

// Updated GSC import with source label
async function handleGscFile(e){
  const file=e.target.files[0];if(!file)return;
  document.getElementById('gsc-file-label').textContent=file.name+' — processing…';
  const importDate=document.getElementById('gsc-import-date').value||localToday();
  const text=await file.text();
  const lines=text.split('\n').filter(l=>l.trim());
  if(!lines.length)return;
  const header=lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
  const urlIdx=header.findIndex(h=>h.includes('page')||h.includes('url'));
  const posIdx=header.findIndex(h=>h.includes('position'));
  const impIdx=header.findIndex(h=>h.includes('impression'));
  const clkIdx=header.findIndex(h=>h.includes('click'));
  if(urlIdx===-1||posIdx===-1){document.getElementById('gsc-import-result').innerHTML='<div style="color:var(--red-t)">Could not find URL and Position columns.</div>';return}
  const rows=lines.slice(1).map(l=>{const cols=l.split(',').map(c=>c.replace(/"/g,'').trim());return cols});
  let matched=0,skipped=0;
  for(const row of rows){
    if(row.length<=posIdx)continue;
    const url=(row[urlIdx]||'').trim();
    const pos=parseFloat(row[posIdx]);
    if(!url||isNaN(pos))continue;
    const post=allPosts.find(p=>p.url&&(p.url===url||url.includes(p.url)||p.url.includes(url)));
    if(!post){skipped++;continue}
    matched++;
    const impr=impIdx>=0?parseInt(row[impIdx])||null:null;
    const clicks=clkIdx>=0?parseInt(row[clkIdx])||null:null;
    await sb.from('gsc_positions').insert({post_id:post.id,recorded_date:importDate,position:pos,impressions:impr,clicks:clicks,notes:'GSC'});
  }
  document.getElementById('gsc-import-result').innerHTML=`<div style="color:var(--green);font-weight:600;font-size:12px">✓ ${matched} posts updated · ${skipped} URLs not matched</div>`;
  document.getElementById('gsc-file-label').textContent='✓ '+file.name;
  markWeeklyDone('gsc');updateWeeklyButtons();
}


async function handleGscFileWeekly(e){
  const file=e.target.files[0];if(!file)return;
  document.getElementById('gsc-file-label2').textContent=file.name+' — processing…';
  const importDate=document.getElementById('gsc-import-date2').value||localToday();
  // Reuse same logic but output to weekly modal result div
  const text=await file.text();
  const lines=text.split('\n').filter(l=>l.trim());
  const header=lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
  const urlIdx=header.findIndex(h=>h.includes('page')||h.includes('url'));
  const posIdx=header.findIndex(h=>h.includes('position'));
  const impIdx=header.findIndex(h=>h.includes('impression'));
  const clkIdx=header.findIndex(h=>h.includes('click'));
  if(urlIdx===-1||posIdx===-1){document.getElementById('gsc-weekly-result').innerHTML='<div style="color:var(--red-t);font-size:12px">Could not find URL and Position columns.</div>';return}
  const rows=lines.slice(1).map(l=>l.split(',').map(c=>c.replace(/"/g,'').trim()));
  let matched=0,skipped=0;
  for(const row of rows){
    if(row.length<=posIdx)continue;
    const url=(row[urlIdx]||'').trim();const pos=parseFloat(row[posIdx]);
    if(!url||isNaN(pos))continue;
    const post=allPosts.find(p=>p.url&&(p.url===url||url.includes(p.url)||p.url.includes(url)));
    if(!post){skipped++;continue}
    matched++;
    await sb.from('gsc_positions').insert({post_id:post.id,recorded_date:importDate,position:pos,impressions:impIdx>=0?parseInt(row[impIdx])||null:null,clicks:clkIdx>=0?parseInt(row[clkIdx])||null:null,notes:'GSC'});
  }
  document.getElementById('gsc-weekly-result').innerHTML=`<div style="color:var(--green);font-weight:600;font-size:12px">✓ ${matched} posts updated · ${skipped} URLs not matched</div>`;
  document.getElementById('gsc-file-label2').textContent='✓ '+file.name;
  markWeeklyDone('gsc');updateWeeklyButtons();
}

// COPY BRIEF AND OPEN PROJECT

// ── IN-APP DRAFT GENERATION + REVIEW ────────────────────────────
const GEN_FN='/.netlify/functions/generate-background';
let _genPolling={},_curDraft=null;

async function loadDraft(postId){
  try{const{data}=await sb.from('post_drafts').select('*').eq('post_id',postId).maybeSingle();return data||null;}
  catch(e){return null;}
}
// Search Console opportunities (Insights tab): striking-distance + low-CTR queries.
async function renderOpportunities(){
  const el=document.getElementById('gsc-opps');if(!el)return;
  el.innerHTML='<div class="empty" style="padding:1rem">Loading from Search Console…</div>';
  let j;
  try{const r=await fetch('/.netlify/functions/gsc-opportunities?blog='+activeBlog);j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));}
  catch(e){el.innerHTML='<div class="empty" style="padding:1rem;color:var(--red-t)">Could not load opportunities: '+esc(String(e&&e.message||e))+'</div>';return;}
  _gscOpps=[...(j.striking||[]),...(j.lowCtr||[]),...(j.growing||[])];
  const GRID='display:grid;grid-template-columns:minmax(0,1fr) 50px 64px 52px 132px;gap:10px;align-items:center';
  const hdr=`<div style="${GRID};padding:0 4px 4px;border-bottom:1px solid var(--bg2)">
      <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em">Keyword</div>
      <div style="font-size:9px;color:var(--text3);text-align:right;text-transform:uppercase">Pos</div>
      <div style="font-size:9px;color:var(--text3);text-align:right;text-transform:uppercase">Impr</div>
      <div style="font-size:9px;color:var(--text3);text-align:right;text-transform:uppercase">CTR</div>
      <div></div>
    </div>`;
  const row=(x,i)=>{
    const post=allPosts.find(p=>p.url&&x.page&&p.url.replace(/\/+$/,'')===x.page.replace(/\/+$/,''));
    const act=post?`<button class="btn btn-xs" onclick="openPost('${post.id}','draft')">Optimise</button>`:(x.page?`<a class="btn btn-xs" href="${esc(x.page)}" target="_blank" rel="noopener">Page</a>`:'');
    // + Idea only when there's NO tracked post for this keyword — if a post already ranks
    // for it, the move is to Optimise that post, not spin up a duplicate targeting the same term.
    const idea=post?'':`<button class="btn btn-xs btn-ghost" onclick="addOpportunityKeyword(${i})">+ Idea</button>`;
    return `<div style="${GRID};padding:7px 4px;border-bottom:1px solid var(--bg2)">
      <div style="min-width:0;font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.query)}</div>
      <div style="text-align:right;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums">${x.position.toFixed(1)}</div>
      <div style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${x.impressions.toLocaleString()}</div>
      <div style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${(x.ctr*100).toFixed(1)}%</div>
      <div style="display:flex;gap:4px;justify-content:flex-end">${act}${idea}</div>
    </div>`;
  };
  const nS=(j.striking||[]).length,nL=(j.lowCtr||[]).length;
  const sec=(title,note,arr,off)=>arr.length?`<div style="margin-top:14px"><div class="sh">${title}</div><div style="font-size:11px;color:var(--text3);margin:2px 0 8px">${note}</div>${hdr}${arr.map((x,k)=>row(x,off+k)).join('')}</div>`:'';
  el.innerHTML=`<div style="font-size:11px;color:var(--text3)">${j.range.start} to ${j.range.end} · ${j.counts.rows} queries analysed</div>`
    +sec('Striking distance — nudge to page 1','Already ranking just off the top. Optimise the post, or write a stronger one.',j.striking||[],0)
    +sec('Page 1, weak click-through','Ranking but barely clicked - usually a title/meta tweak.',j.lowCtr||[],nS)
    +sec('Page 2–3, real demand','Big search volume but ranking too far back to get clicks. High-reward targets — refresh the post or build authority.',j.growing||[],nS+nL)
    +((!(j.striking||[]).length&&!(j.lowCtr||[]).length&&!(j.growing||[]).length)?'<div class="empty" style="padding:1rem">No clear opportunities in this window yet.</div>':'');
}
// ── IDEAS / REQUESTS BOARD (Ideas tab) ── Karen drops tool ideas/requests here as she
// works; Claude reads the `requests` table directly (Supabase) and actions them.
async function renderRequests(){
  const openEl=document.getElementById('ideas-open'),doneEl=document.getElementById('ideas-done');
  if(!openEl)return;
  const{data,error}=await sb.from('requests').select('*').order('created_at',{ascending:false});
  if(error){openEl.innerHTML='<div class="empty" style="padding:1rem;color:var(--red-t)">Could not load: '+esc(error.message)+'</div>';if(doneEl)doneEl.innerHTML='';return;}
  const rows=data||[];
  const open=rows.filter(r=>r.status!=='done'),done=rows.filter(r=>r.status==='done');
  const card=(r)=>`<div class="card" style="padding:11px 13px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">
      <button class="btn btn-xs" title="Mark done" onclick="toggleRequestDone('${r.id}',true)" style="flex:none">✓</button>
      <div style="flex:1;min-width:0;font-size:13px;white-space:pre-wrap;word-break:break-word">${esc(r.text)}</div>
      <div style="flex:none;font-size:10px;color:var(--text3);white-space:nowrap">${fd((r.created_at||'').slice(0,10))}</div>
      <button class="btn btn-danger btn-xs" title="Delete" onclick="delRequest('${r.id}')" style="flex:none">✕</button>
    </div>`;
  openEl.innerHTML=open.length?`<div class="sh">Open (${open.length})</div>`+open.map(card).join(''):'<div class="empty" style="padding:1rem">No open ideas yet. Add one above — I’ll pick it up next time we work on the tool.</div>';
  if(doneEl){
    doneEl.innerHTML=done.length?`<div class="sh">Done (${done.length})</div>`+done.map(r=>`<div style="display:flex;gap:10px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--bg2);opacity:.6">
        <button class="btn btn-xs btn-ghost" title="Reopen" onclick="toggleRequestDone('${r.id}',false)" style="flex:none">↺</button>
        <div style="flex:1;min-width:0;font-size:12px;text-decoration:line-through;white-space:pre-wrap;word-break:break-word">${esc(r.text)}</div>
        <button class="btn btn-danger btn-xs" onclick="delRequest('${r.id}')" style="flex:none">✕</button>
      </div>`).join(''):'';
  }
}
async function addRequest(){
  const ta=document.getElementById('idea-input');const text=(ta&&ta.value||'').trim();
  if(!text){if(ta)ta.focus();return;}
  const{error}=await sb.from('requests').insert({text});
  if(error){toast('Add failed: '+error.message,4000);return;}
  if(ta)ta.value='';renderRequests();toast('Added to the ideas board ✓');
}
async function toggleRequestDone(id,done){
  await sb.from('requests').update({status:done?'done':'open',done_at:done?new Date().toISOString():null}).eq('id',id);
  renderRequests();
}
async function delRequest(id){if(!confirm('Delete this idea?'))return;await sb.from('requests').delete().eq('id',id);renderRequests();}

// Recently-optimized results (Insights): posts with a logged optimization + the lift since.
async function renderRecentOptimizations(){
  const el=document.getElementById('opt-recent');if(!el)return;
  const{data,error}=await sb.from('optimizations').select('*,posts(title,url,primary_keyword)').eq('blog',activeBlog).order('opt_date',{ascending:false}).limit(15);
  if(error){el.innerHTML='<div class="empty" style="padding:1rem;color:var(--red-t)">Could not load: '+esc(error.message)+'</div>';return;}
  const rows=data||[];
  if(!rows.length){el.innerHTML='<div class="empty" style="padding:1rem">No optimizations logged yet. Open a post → Rankings → “Log optimization”.</div>';return;}
  const ids=[...new Set(rows.map(o=>o.post_id))];
  const{data:snaps}=await sb.from('gsc_positions').select('post_id,recorded_date,position,impressions,clicks,notes').in('post_id',ids).order('recorded_date',{ascending:false});
  const latest={};(snaps||[]).forEach(s=>{if(!latest[s.post_id]&&(s.notes||'').includes('GSC-auto'))latest[s.post_id]=s;});
  el.innerHTML=rows.map(o=>{
    const b=o.baseline||{};const post=o.posts||{};
    const title=post.title||post.primary_keyword||'(untitled)';
    const after=latest[o.post_id];
    const hasAfter=after&&b.position!=null&&after.recorded_date>o.opt_date;
    let lift='<span style="color:var(--text3);font-size:11px">awaiting next weekly snapshot</span>';
    if(hasAfter){
      lift=`<span style="font-size:11px">pos ${(+b.position).toFixed(1)} → <b>${(+after.position).toFixed(1)}</b> ${_delta(+b.position,+after.position,true)}</span>`;
    }
    return`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--bg2)">
      <div style="min-width:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><a href="#" onclick="openPost('${o.post_id}','gsc');return false" style="color:var(--text);text-decoration:none">${esc(title)}</a></div>
        <div style="font-size:10px;color:var(--text3)">${esc(_optKindLabel(o.kind))} · ${fd(o.opt_date)}${o.note?' · '+esc(o.note):''}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">${lift}</div>
    </div>`;
  }).join('');
}
async function addOpportunityKeyword(i){
  const x=_gscOpps[i];if(!x)return;
  const exists=bp().find(p=>(p.primary_keyword||'').toLowerCase()===x.query.toLowerCase());
  if(exists){toast('Already in your list');return;}
  const{error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:x.query,status:'idea',current_step:0,indexed:'no',serp_notes:`GSC opportunity: pos ${x.position.toFixed(1)}, ${x.impressions} impr, ${(x.ctr*100).toFixed(1)}% CTR — ${x.page||''}`});
  if(error){toast('Add failed: '+error.message,4000);return;}
  await loadPosts();render();toast('Added "'+x.query+'" as an idea ✓',3000);
}
// KEYWORD RESEARCH (Keywords tab): seeds -> DataForSEO expand -> Claude cluster/score.
const _kwErr=(m)=>`<div class="card" style="padding:1rem;color:var(--red-t);background:#fff5f5;border-color:#f3c0c0">${esc(m)}</div>`;
const _kwUUID=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)});
async function suggestSeeds(){
  const theme=((document.getElementById('kw-seed-theme')||{}).value||'').trim();
  const btn=document.getElementById('kw-suggest-btn');if(btn)btn.disabled=true;
  const box=document.getElementById('kw-seed-suggestions');
  if(box)box.innerHTML='<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);padding:8px 2px"><div class="spinner"></div>Thinking up seed words…</div>';
  const covered=[...new Set(bp().flatMap(p=>[p.title,p.primary_keyword]).filter(Boolean))].slice(0,120);
  let j;
  try{const r=await fetch('/.netlify/functions/suggest-seeds',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({blog:activeBlog,theme,covered})});j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));}
  catch(e){if(box)box.innerHTML=_kwErr('Could not suggest seeds: '+esc(String(e&&e.message||e)));if(btn)btn.disabled=false;return;}
  if(btn)btn.disabled=false;
  renderSeedSuggestions(j.seeds||[]);
}
function renderSeedSuggestions(seeds){
  _seedSuggestions=seeds||[];
  const box=document.getElementById('kw-seed-suggestions');if(!box)return;
  if(!_seedSuggestions.length){box.innerHTML='<div class="empty" style="padding:.5rem">No suggestions — try a different focus.</div>';return;}
  const groups={};_seedSuggestions.forEach((s,i)=>{const g=s.category||'Other';(groups[g]=groups[g]||[]).push(i)});
  let html='<div class="card" style="padding:12px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:12px;font-weight:700">Suggested seeds — click to add</div><button class="btn btn-xs btn-ghost" onclick="addAllSeeds()">+ Add all</button></div>';
  for(const g in groups){
    html+=`<div style="margin-bottom:8px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text3);margin-bottom:4px">${esc(g)}</div>`;
    html+=groups[g].map(i=>`<button class="btn btn-xs" id="seedchip-${i}" onclick="addSeed(${i})" style="margin:2px 4px 2px 0">+ ${esc(_seedSuggestions[i].term)}</button>`).join('');
    html+='</div>';
  }
  html+='</div>';box.innerHTML=html;
}
function _addSeedTerm(term){
  const ta=document.getElementById('kw-seeds');if(!ta)return false;
  const cur=ta.value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(cur.some(x=>x.toLowerCase()===term.toLowerCase()))return false;
  cur.push(term);ta.value=cur.join('\n');return true;
}
function addSeed(i){
  const s=_seedSuggestions[i];if(!s)return;
  _addSeedTerm(s.term);
  const b=document.getElementById('seedchip-'+i);if(b){b.disabled=true;b.style.opacity='.5';b.textContent='✓ '+s.term;}
}
function addAllSeeds(){
  let n=0;
  _seedSuggestions.forEach((s,i)=>{if(_addSeedTerm(s.term)){n++;const b=document.getElementById('seedchip-'+i);if(b){b.disabled=true;b.style.opacity='.5';}}});
  toast(n?('Added '+n+' seed'+(n===1?'':'s')):'Already added');
}
async function researchKeywords(){
  const ta=document.getElementById('kw-seeds');if(!ta)return;
  const seeds=(ta.value||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,8);
  if(!seeds.length){toast('Add at least one seed keyword');return;}
  const broaden=!!(document.getElementById('kw-broaden')||{}).checked;
  const minVolEl=document.getElementById('kw-minvol');
  const minVolume=minVolEl&&minVolEl.value!==''?Math.max(0,parseInt(minVolEl.value,10)||0):100;
  const runId=_kwUUID();
  const btn=document.getElementById('kw-research-btn');if(btn)btn.disabled=true;
  const status=document.getElementById('kw-research-status');
  const results=document.getElementById('kw-research-results');if(results)results.innerHTML='';
  if(status)status.innerHTML='<div class="card" style="text-align:center;padding:1.5rem;color:var(--text2)"><div class="spinner" style="margin:0 auto 10px"></div>Pulling live keyword data and clustering into post ideas… this takes 30–60 seconds.</div>';
  const{error:insErr}=await sb.from('keyword_runs').insert({id:runId,blog:activeBlog,seeds,broaden,status:'working'});
  if(insErr){if(status)status.innerHTML=_kwErr('Could not start: '+insErr.message);if(btn)btn.disabled=false;return;}
  if(status)status.innerHTML='<div class="card" style="text-align:center;padding:1.5rem;color:var(--text2)"><div class="spinner" style="margin:0 auto 10px"></div>'+(_kwMode==='cluster'?'Building your content cluster (pillar + supporting posts)':'Pulling live keyword data and clustering into post ideas')+'… this takes 30–60 seconds.</div>';
  let httpStatus;
  try{const r=await fetch('/.netlify/functions/keyword-research-background',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run_id:runId,blog:activeBlog,seeds,broaden,min_volume:minVolume,mode:_kwMode})});httpStatus=r.status;}
  catch(e){httpStatus='err';}
  if(httpStatus!==202&&httpStatus!==200){if(status)status.innerHTML=_kwErr('Could not start research (status '+httpStatus+'). Try again in a moment.');if(btn)btn.disabled=false;return;}
  const start=Date.now();
  const iv=setInterval(async()=>{
    const{data}=await sb.from('keyword_runs').select('status,result,error').eq('id',runId).single();
    if(data&&data.status==='done'){clearInterval(iv);if(btn)btn.disabled=false;renderClusters(data.result);}
    else if(data&&data.status==='error'){clearInterval(iv);if(btn)btn.disabled=false;if(status)status.innerHTML=_kwErr(data.error||'Research failed.');}
    else if(Date.now()-start>200000){clearInterval(iv);if(btn)btn.disabled=false;if(status)status.innerHTML=_kwErr('Still working or it hit a snag. Try again.');}
  },5000);
}
function _oppColor(n){return n>=80?'var(--green)':n>=60?'#0891b2':n>=40?'#b45309':'var(--text3)'}
function _clusterCard(c,i){
  const dup=c.overlaps_existing?`<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:6px 9px;margin:8px 0 0;font-size:11px;color:#9a3412">⚠ Looks similar to an existing post: <b>${esc(c.overlaps_existing)}</b></div>`:'';
  const chip=(t)=>`<span style="display:inline-block;background:var(--bg2);border-radius:10px;padding:2px 8px;font-size:11px;color:var(--text2);margin:2px 4px 2px 0">${esc(t)}</span>`;
  const supp=(c.supporting_keywords||[]).slice(0,8).map(chip).join('');
  const action=c.overlaps_existing
    ? `<button class="btn btn-xs btn-ghost" id="kwadd-${i}" onclick="addClusterIdea(${i})">+ Add anyway</button>`
    : `<button class="btn btn-xs btn-p" id="kwadd-${i}" onclick="addClusterIdea(${i})">+ Add to ideas</button>`;
  return `<div class="card" style="margin-bottom:10px;padding:14px">
    <div style="display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:start">
      <div style="text-align:center"><div style="font-size:20px;font-weight:800;line-height:1;color:${_oppColor(c.opportunity)}">${c.opportunity}</div><div style="font-size:8px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">score</div></div>
      <div style="min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.3">${esc(c.suggested_title||c.topic)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:5px">${esc(c.angle||'')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <span style="font-size:12px;font-weight:600;color:var(--teal-d)">${esc(c.primary_keyword)}</span>
          <span style="font-size:11px;color:var(--text3)">${(c.primary_volume!=null?c.primary_volume.toLocaleString():'?')}/mo · KD ${c.primary_difficulty??'?'} · ${esc(c.intent||'')}</span>
        </div>
        ${supp?`<div style="margin-top:8px">${supp}</div>`:''}
        ${dup}
      </div>
      <div style="white-space:nowrap">${action}</div>
    </div>
  </div>`;
}
function setKwMode(m){
  _kwMode=m;
  const a=document.getElementById('kwmode-ideas'),b=document.getElementById('kwmode-cluster');
  if(a)a.className='btn btn-xs'+(m==='ideas'?' btn-p':'');
  if(b)b.className='btn btn-xs'+(m==='cluster'?' btn-p':'');
  const rb=document.getElementById('kw-research-btn');if(rb)rb.innerHTML=(m==='cluster'?'✦ Build content cluster':'✦ Research keywords');
  const ta=document.getElementById('kw-seeds');if(ta)ta.placeholder=(m==='cluster'?'one broad topic, e.g.\ngohighlevel':'gohighlevel\nemail marketing for coaches\nsales funnel\ncrm');
}
function renderClusters(out){
  if(out&&out.mode==='cluster')return renderContentCluster(out);
  _kwActiveCluster=null;_kwCluster=null;
  _kwClusters=(out&&out.clusters)||[];
  const status=document.getElementById('kw-research-status');if(status)status.innerHTML='';
  const el=document.getElementById('kw-research-results');if(!el)return;
  if(!_kwClusters.length){el.innerHTML=`<div class="empty" style="padding:1.5rem">${esc((out&&out.note)||'No new post ideas found — those seeds may already be well covered. Try different or broader seeds.')}</div>`;return;}
  const fresh=_kwClusters.filter(c=>!c.overlaps_existing);
  const cnt=(out&&out.counts)||{};
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:4px 2px 12px">
      <div style="font-size:12px;color:var(--text2)">${_kwClusters.length} topic ${_kwClusters.length===1?'idea':'ideas'}${cnt.aboveMin!=null?` · ${cnt.aboveMin} keyword${cnt.aboveMin===1?'':'s'} at ${out.minVolume??100}+/mo${cnt.raw?` (of ${cnt.raw})`:''}`:(cnt.raw?` · ${cnt.raw} keywords analysed`:'')}${out.cost?` · $${out.cost}`:''}</div>
      ${fresh.length?`<button class="btn btn-p btn-sm" onclick="addAllClusters()">+ Add all ${fresh.length} new ${fresh.length===1?'idea':'ideas'}</button>`:''}
    </div>`+_kwClusters.map((c,i)=>_clusterCard(c,i)).join('');
}
async function addClusterIdea(i){
  const c=_kwClusters[i];if(!c)return;
  const exists=bp().find(p=>(p.primary_keyword||'').toLowerCase()===(c.primary_keyword||'').toLowerCase());
  if(exists){toast('Already in your list');return;}
  const supp=(c.supporting_keywords||[]).join(', ');
  const{error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:c.primary_keyword,title:c.suggested_title||null,status:'idea',current_step:0,indexed:'no',search_volume:c.primary_volume||null,total_search_volume:c.total_volume||null,supplementary_keywords:supp||null,unique_take:c.angle||null,cluster:_kwActiveCluster||null,is_pillar:false,serp_notes:`Keyword research: ${(c.total_volume||c.primary_volume||'?')}/mo total, difficulty ~${c.avg_difficulty??c.primary_difficulty??'?'}, ${c.intent||''} intent. Opportunity ${c.opportunity}/100.`});
  if(error){toast('Add failed: '+error.message,4000);return;}
  await loadPosts();render();
  const btn=document.getElementById('kwadd-'+i);if(btn)btn.outerHTML='<span style="font-size:12px;color:var(--green);font-weight:600">✓ Added</span>';
  toast('Added "'+c.primary_keyword+'" to ideas ✓',2500);
}
async function addAllClusters(){
  let added=0;
  for(let i=0;i<_kwClusters.length;i++){
    const c=_kwClusters[i];if(c.overlaps_existing)continue;
    if(bp().find(p=>(p.primary_keyword||'').toLowerCase()===(c.primary_keyword||'').toLowerCase()))continue;
    const supp=(c.supporting_keywords||[]).join(', ');
    const{error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:c.primary_keyword,title:c.suggested_title||null,status:'idea',current_step:0,indexed:'no',search_volume:c.primary_volume||null,total_search_volume:c.total_volume||null,supplementary_keywords:supp||null,unique_take:c.angle||null,cluster:_kwActiveCluster||null,is_pillar:false,serp_notes:`Keyword research opportunity ${c.opportunity}/100.`});
    if(!error){added++;const btn=document.getElementById('kwadd-'+i);if(btn)btn.outerHTML='<span style="font-size:12px;color:var(--green);font-weight:600">✓ Added</span>';}
  }
  await loadPosts();render();toast('Added '+added+' new '+(added===1?'idea':'ideas')+' ✓',3000);
}
// CONTENT CLUSTER (pillar + supporting) rendering + adding.
function _pillarCard(p){
  return `<div class="card" style="margin-bottom:12px;padding:14px;border-left:3px solid var(--teal)">
    <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start">
      <div style="min-width:0">
        <div style="font-size:10px;font-weight:700;color:var(--teal-d);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">★ Pillar post</div>
        <div style="font-size:15px;font-weight:700;line-height:1.3">${esc(p.suggested_title||'')}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:5px">${esc(p.angle||'')}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">${esc(p.primary_keyword||'')} · ${(p.primary_volume!=null?p.primary_volume.toLocaleString():'?')}/mo · KD ${p.primary_difficulty??'?'}</div>
      </div>
      <button class="btn btn-xs btn-p" id="kwpadd" onclick="addPillar()">+ Add</button>
    </div></div>`;
}
function renderContentCluster(out){
  _kwCluster=out;
  _kwActiveCluster=out.cluster_name||null;
  _kwClusters=(out.supporting||[]);          // reuse the idea-card path for supporting posts
  const status=document.getElementById('kw-research-status');if(status)status.innerHTML='';
  const el=document.getElementById('kw-research-results');if(!el)return;
  if(!out.pillar&&!_kwClusters.length){el.innerHTML=`<div class="empty" style="padding:1.5rem">${esc(out.note||'No cluster found — try a broader topic.')}</div>`;return;}
  const fresh=_kwClusters.filter(c=>!c.overlaps_existing).length+(out.pillar?1:0);
  const cnt=out.counts||{};
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:4px 2px 12px">
      <div style="font-size:13px;font-weight:700">Cluster: ${esc(out.cluster_name||'')} <span style="font-weight:400;color:var(--text2)">· 1 pillar + ${_kwClusters.length} supporting${cnt.raw?` · ${cnt.raw} kw analysed`:''}${out.cost?` · $${out.cost}`:''}</span></div>
      ${fresh?`<button class="btn btn-p btn-sm" onclick="addContentCluster()">+ Add whole cluster (${fresh})</button>`:''}
    </div>`;
  if(out.pillar)html+=_pillarCard(out.pillar);
  html+=`<div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text3);margin:14px 2px 6px">Supporting posts — each links up to the pillar</div>`;
  html+=_kwClusters.map((c,i)=>_clusterCard(c,i)).join('');
  el.innerHTML=html;
}
async function addPillar(){
  const p=_kwCluster&&_kwCluster.pillar;if(!p)return;
  if(bp().find(x=>(x.primary_keyword||'').toLowerCase()===(p.primary_keyword||'').toLowerCase())){toast('Pillar already in your list');return;}
  const{error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:p.primary_keyword,title:p.suggested_title||null,status:'idea',current_step:0,indexed:'no',search_volume:p.primary_volume||null,total_search_volume:p.total_volume||null,supplementary_keywords:(p.supporting_keywords||[]).join(', ')||null,unique_take:p.angle||null,cluster:_kwActiveCluster||null,is_pillar:true,serp_notes:`Cluster pillar (${_kwActiveCluster||''}).`});
  if(error){toast('Add failed: '+error.message,4000);return;}
  await loadPosts();render();
  const b=document.getElementById('kwpadd');if(b)b.outerHTML='<span style="font-size:12px;color:var(--green);font-weight:600">✓ Added</span>';
  toast('Pillar added ✓',2500);
}
async function addContentCluster(){
  await addPillar();
  await addAllClusters();
}
// CONTENT CLUSTER VIEW (Insights): existing posts grouped by their cluster tag.
function _statusPill(s){
  const m={idea:['#6b7280','Idea'],drafted:['#b45309','Draft'],'pending-review':['#b45309','Review'],approved:['#0891b2','Approved'],scheduled:['#0891b2','Scheduled'],live:['var(--green)','Live']};
  const x=m[s]||['#6b7280',esc(s||'—')];
  return `<span style="font-size:10px;font-weight:700;color:${x[0]}">${x[1]}</span>`;
}
let _clusterDrafts={}; // post_id -> draft meta for unpublished clustered posts (drives Prepare/Publish state)
async function loadClusterDraftState(){
  _clusterDrafts={};
  const ids=bp().filter(p=>p.cluster&&String(p.cluster).trim()&&!p.ghl_post_id).map(p=>p.id);
  if(!ids.length)return;
  try{const{data}=await sb.from('post_drafts').select('post_id,check_report').in('post_id',ids);(data||[]).forEach(d=>{_clusterDrafts[d.post_id]={verdict:d.check_report&&d.check_report.verdict};});}catch(e){}
}
// Load draft-readiness, then paint the cluster view (so Prepare/Publish buttons reflect reality).
async function renderClusters(){await loadClusterDraftState();renderClusterView();}
function renderClusterView(){
  const el=document.getElementById('cluster-view');if(!el)return;
  const posts=bp().filter(p=>p.cluster&&String(p.cluster).trim());
  if(!posts.length){el.innerHTML='<div class="empty" style="padding:1rem">No clusters yet. Build one with the researcher above (<b>Content cluster</b> mode), or tag posts with a cluster name via the <b>Topic cluster</b> field in each post\'s details.</div>';return;}
  const groups={};posts.forEach(p=>{const c=String(p.cluster).trim();(groups[c]=groups[c]||[]).push(p)});
  const names=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  const row=(p)=>`<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--bg2)">
      <div style="min-width:0;font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="openPost('${p.id}','${_clusterDrafts[p.id]?'draft':'details'}')">${p.is_pillar?'★ ':''}${esc(p.title||p.primary_keyword||'Untitled')}</div>
      <div style="display:flex;gap:10px;align-items:center;white-space:nowrap">${_clusterDrafts[p.id]&&_clusterDrafts[p.id].verdict==='fail'?'<span style="font-size:10px;color:#b45309;font-weight:700" title="Draft has a must-fix issue — open to see it">⚠ fix</span>':''}${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener" style="font-size:11px">view</a>`:''}${_statusPill(p.status)}</div>
    </div>`;
  el.innerHTML=names.map(name=>{
    const arr=groups[name];
    const pillar=arr.find(p=>p.is_pillar);
    const supp=arr.filter(p=>!p.is_pillar);
    const live=arr.filter(p=>p.status==='live').length;
    const unpubPosts=arr.filter(p=>!p.ghl_post_id);
    const unpub=unpubPosts.length;
    const drafted=unpubPosts.filter(p=>_clusterDrafts[p.id]).length;
    const failing=unpubPosts.filter(p=>_clusterDrafts[p.id]&&_clusterDrafts[p.id].verdict==='fail').length;
    const allDrafted=unpub>0&&drafted===unpub;
    const ready=allDrafted&&failing===0; // all unpublished posts drafted AND passing -> safe to publish
    const en=esc(name).replace(/'/g,"\\'");
    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px">
        <div style="font-size:13px;font-weight:700;min-width:0">${esc(name)}${pillar?'':' <span style="font-size:10px;font-weight:600;color:#b45309">· no pillar yet</span>'}</div>
        <div style="display:flex;align-items:center;gap:8px;white-space:nowrap;flex-wrap:wrap;justify-content:flex-end">
          <span style="font-size:11px;color:var(--text3)">${arr.length} post${arr.length===1?'':'s'} · ${live} live</span>
          ${unpub?`<button class="btn btn-xs btn-p" onclick="prepareCluster('${en}')" title="Generate all posts as interlinked drafts to review — nothing goes live">${allDrafted?'Re-prepare':'Prepare '+unpub+' for review'}</button>`:''}
          ${ready?`<button class="btn btn-xs" style="background:var(--green);color:#fff;border-color:var(--green)" onclick="publishCluster('${en}')" title="Publish the reviewed drafts live, all at once and interlinked">Publish ${unpub} →</button>`:''}
          ${unpub?`<button class="btn btn-xs btn-ghost" onclick="launchCluster('${en}')" title="Skip review: generate and publish in one go">⚡ Launch now</button>`:''}
          <button class="btn btn-xs btn-danger" onclick="deleteCluster('${en}')" title="Remove this whole cluster">Remove</button>
        </div>
      </div>
      ${ready?`<div style="font-size:11px;color:var(--green);margin-bottom:4px">✓ ${unpub} draft${unpub===1?'':'s'} ready — open each post's Draft tab to review, then Publish</div>`
        :allDrafted&&failing?`<div style="font-size:11px;color:#b45309;margin-bottom:4px">⚠ ${drafted-failing} of ${unpub} ready · ${failing} need fixing before you can publish — open the ⚠ post(s) below, then Re-prepare</div>`:''}
      ${pillar?row(pillar):''}${supp.map(row).join('')}
    </div>`;
  }).join('');
}
function _clusterBanner(html,kind){
  const el=document.getElementById('cluster-launch-status');if(!el)return;
  const bg=kind==='error'?'#fff5f5':kind==='done'?'var(--green-l)':'var(--teal-l)';
  const bd=kind==='error'?'#f3c0c0':kind==='done'?'#bfe3c9':'#c5e6e6';
  el.innerHTML=`<div style="background:${bg};border:1px solid ${bd};border-radius:var(--r2);padding:10px 12px;margin-bottom:12px;font-size:12px;display:flex;align-items:center;gap:8px">${kind==='working'?'<div class="spinner"></div>':''}<div>${html}</div></div>`;
}
// Shared runner for the three cluster actions. payload picks the backend mode;
// working = banner text while it runs; onDone(result) fires on success.
async function _startClusterJob({name,payload,working,onDone}){
  const jobBlog=activeBlog;                                                   // the brand this job belongs to
  const bn=(html,kind)=>{if(activeBlog===jobBlog)_clusterBanner(html,kind);}; // only paint on the matching brand
  const id=_kwUUID();
  const{error}=await sb.from('cluster_launches').insert({id,blog:jobBlog,cluster:name,status:'working'});
  if(error){toast('Could not start: '+error.message,4000);return;}
  let st;try{const r=await fetch('/.netlify/functions/launch-cluster-background',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({launch_id:id,blog:jobBlog,cluster:name,...payload})});st=r.status;}catch(e){st='err';}
  if(st!==202&&st!==200){bn('Could not start (status '+st+').','error');return;}
  bn(working,'working');
  const start=Date.now();
  const iv=setInterval(async()=>{
    const{data}=await sb.from('cluster_launches').select('status,result,error').eq('id',id).single();
    if(!data)return;
    if(data.status==='done'){clearInterval(iv);await loadPosts();onDone(data.result||{},{bn,same:activeBlog===jobBlog});}
    else if(data.status==='error'){clearInterval(iv);bn('⚠ '+esc(data.error||'Failed.'),'error');}
    if(Date.now()-start>840000){clearInterval(iv);bn('Still working — refresh shortly to see the result.','working');}
  },6000);
}
// Step 1 of the reviewed launch: generate every post as an interlinked DRAFT (nothing goes live).
async function prepareCluster(name){
  const unpub=bp().filter(p=>String(p.cluster||'').trim()===name&&!p.ghl_post_id);
  if(!unpub.length){toast('Every post in this cluster is already live');return;}
  if(!confirm(`Prepare the "${name}" cluster?\n\nThis writes all ${unpub.length} post${unpub.length===1?'':'s'} as drafts, fully interlinked (pillar ↔ supporting), so you can review every one before anything goes live. Nothing is published yet.\n\nTakes a few minutes; you can keep working. Continue?`))return;
  _startClusterJob({name,payload:{dry_run:true},
    working:`Preparing <b>${esc(name)}</b> — writing ${unpub.length} interlinked drafts. A few minutes; nothing goes live.`,
    onDone:(res,ui)=>{renderClusters();if(!ui.same)return;
      const ready=(res.ready!=null?res.ready:(res.would_publish||[]).length);const nf=res.needs_fixing||[];
      if(nf.length){ui.bn(`Prepared <b>${esc(name)}</b> — ${ready} ready, ${nf.length} need fixing: ${nf.map(f=>esc(f.title)).join(', ')}. Open the ⚠ post's <b>Draft</b> tab, then <b>Re-prepare</b>.`,'error');toast(`Prepared — ${nf.length} need fixing`,4500);}
      else{ui.bn(`✓ Prepared <b>${esc(name)}</b> — ${ready} draft${ready===1?'':'s'} ready. Open each post's <b>Draft</b> tab to review, then click <b>Publish</b>.`,'done');toast('Cluster prepared — review then publish ✓',4000);}}});
}
// Step 2: publish the reviewed drafts, all at once, to their reserved URLs (links stay intact).
async function publishCluster(name){
  const unpub=bp().filter(p=>String(p.cluster||'').trim()===name&&!p.ghl_post_id);
  if(!unpub.length){toast('Every post in this cluster is already live');return;}
  if(!confirm(`Publish the "${name}" cluster?\n\nThis takes the ${unpub.length} reviewed draft${unpub.length===1?'':'s'} and publishes them live — all at once, fully interlinked. Continue?`))return;
  _startClusterJob({name,payload:{publish_prepared:true},
    working:`Publishing <b>${esc(name)}</b> — ${unpub.length} reviewed post${unpub.length===1?'':'s'} going live…`,
    onDone:(res,ui)=>{renderClusters();if(!ui.same)return;const n=res.count||0;ui.bn(`✓ Published <b>${esc(name)}</b> — ${n} post${n===1?'':'s'} now live and interlinked. Featured images are rendering and will appear shortly.`,'done');toast('Cluster published — '+n+' live ✓',4000);}});
}
// One-shot: generate AND publish in a single pass, skipping the review gate (checker still blocks).
async function launchCluster(name){
  const unpub=bp().filter(p=>String(p.cluster||'').trim()===name&&!p.ghl_post_id);
  if(!unpub.length){toast('Every post in this cluster is already live');return;}
  if(!confirm(`Launch the "${name}" cluster now?\n\nThis GENERATES and PUBLISHES ${unpub.length} post${unpub.length===1?'':'s'} live in one go — fully interlinked, with no review stop. They go live immediately.\n\n(Prefer to check them first? Use "Prepare for review" instead.) Continue?`))return;
  _startClusterJob({name,payload:{},
    working:`Launching <b>${esc(name)}</b> — generating ${unpub.length} posts. A few minutes; you can keep working.`,
    onDone:(res,ui)=>{renderClusters();if(!ui.same)return;const n=res.count||0;ui.bn(`✓ Launched <b>${esc(name)}</b> — ${n} post${n===1?'':'s'} now live and interlinked. Featured images are rendering and will appear shortly.`,'done');toast('Cluster launched — '+n+' live ✓',4000);}});
}
// Remove a whole cluster: deletes every post tagged with this cluster name (same child-row
// cleanup as bulkDeleteResearch). Warns if any are already live (they stay published on the blog).
async function deleteCluster(name){
  const posts=bp().filter(p=>String(p.cluster||'').trim()===name);
  if(!posts.length)return;
  const live=posts.filter(p=>p.status==='live').length;
  let msg=`Remove the "${name}" cluster?\n\nThis deletes all ${posts.length} post${posts.length===1?'':'s'} in it from the tracker. This cannot be undone.`;
  if(live)msg+=`\n\n⚠ ${live} ${live===1?'is':'are'} already LIVE — removing here deletes them from this tracker but they STAY published on your blog. Unpublish those in GHL first if you want them gone.`;
  if(!confirm(msg))return;
  for(const p of posts){
    const id=p.id;
    await sb.from('internal_links').delete().or(`source_post_id.eq.${id},dest_post_id.eq.${id}`);
    await sb.from('gsc_positions').delete().eq('post_id',id);
    await sb.from('post_checklist').delete().eq('post_id',id);
    await sb.from('social_tracking').delete().eq('post_id',id);
    await sb.from('posts').delete().eq('id',id);
  }
  await loadPosts();renderClusters();renderResearch();render();
  toast(`"${name}" cluster removed — ${posts.length} post${posts.length===1?'':'s'} deleted`);
}
// Possible-duplicate check: does this post's keyword/title closely match an existing
// LIVE post on the same blog? Returns the matching live post, or null.
function findDuplicate(post){
  if(!post||!post.primary_keyword)return null;
  const stop=new Set(['the','a','an','to','of','for','and','or','in','on','with','your','you','how','what','why','is','are','vs','best','guide','tips','my','2026','2025','2024']);
  const norm=s=>(String(s||'').toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!stop.has(w));
  const it=new Set(norm(post.primary_keyword+' '+(post.title||'')));
  if(!it.size)return null;
  let best=null;
  for(const p of allPosts){
    if(p.blog!==post.blog||p.status!=='live'||p.id===post.id)continue;
    const pt=new Set(norm((p.primary_keyword||'')+' '+(p.title||'')));
    if(!pt.size)continue;
    let overlap=0;it.forEach(t=>{if(pt.has(t))overlap++});
    const score=overlap/it.size;
    if(overlap>=2&&score>=0.6&&(!best||score>best.score))best={post:p,score};
  }
  return best?best.post:null;
}
function _dupBanner(){
  const dup=findDuplicate(gp(curPost));
  if(!dup)return'';
  const label=dup.title||dup.primary_keyword;
  return `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:var(--r2);padding:10px 12px;margin-bottom:12px;font-size:12px;color:#9a3412">⚠ <b>Possible duplicate.</b> This looks a lot like an existing live post: ${dup.url?`<a href="${esc(dup.url)}" target="_blank" style="color:#9a3412;font-weight:700">${esc(label)}</a>`:`<b>${esc(label)}</b>`}. Worth checking before you generate or publish.</div>`;
}
async function renderDraftTab(){
  const el=document.getElementById('pm-draft-body');if(!el)return;
  const pid=curPost;
  if(_genPolling[pid]){el.innerHTML=_draftWorkingHtml();return;}
  el.innerHTML='<div class="empty" style="padding:1.5rem">Loading draft…</div>';
  const d=await loadDraft(pid);
  if(pid!==curPost)return;
  _curDraft=d;
  el.innerHTML=_dupBanner()+(d?_draftViewHtml(d):_draftEmptyHtml());
}
function _draftEmptyHtml(){
  return `<div style="text-align:center;padding:2rem 1rem">
    <div style="font-size:13px;color:var(--text2);margin:0 auto 14px;line-height:1.7;max-width:440px">No draft yet. Generate a full, brand-checked draft from this post's brief - article, meta, slug, internal links, image briefs and captions - written in your voice and ready to review.</div>
    <button class="btn btn-p" onclick="generateDraftNow()">Generate draft</button>
    <div style="font-size:11px;color:var(--text3);margin-top:10px">Takes about 90 seconds. You can keep working while it runs.</div>
  </div>`;
}
function _draftWorkingHtml(){
  return `<div style="text-align:center;padding:2.5rem 1rem">
    <div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:8px">Generating and checking the draft…</div>
    <div style="font-size:12px;color:var(--text2)">About 90 seconds. You can close this and come back - it will be here when it is done.</div>
  </div>`;
}
function _verdictBadge(v){
  const m={fail:['Needs fixes','var(--red-l)','var(--red-t)','#f0c8c8'],review:['Review','var(--amber-l)','var(--amber-t)','#f0d8a0'],pass:['Clean','var(--green-l)','var(--green)','#b8dfc6']};
  const[label,bg,fg,bd]=m[v]||m.review;
  return `<span style="display:inline-block;padding:3px 11px;border-radius:999px;font-size:11px;font-weight:700;background:${bg};color:${fg};border:1px solid ${bd}">${label}</span>`;
}
function copyDraftField(k){
  if(!_curDraft)return;
  const v=k==='title'?(_curDraft.assets||{}).title:_curDraft[k];
  navigator.clipboard.writeText(v||'').then(()=>toast('Copied')).catch(()=>toast('Copy failed'));
}
function _bodyImageSlot(slot,i){
  const thumbs=(slot.candidates||[]).map((c,j)=>`<img id="bimg-${i}-${j}" src="${esc(c.thumb||c.url)}" title="${esc(c.photographer||'')}" onclick="chooseBodyImage(${i},${j})" style="width:104px;height:68px;object-fit:cover;border-radius:6px;cursor:pointer;border:3px solid ${slot.chosen===c.url?'#29abab':'transparent'}">`).join('')||'<span style="font-size:11px;color:var(--text3)">no matches — edit the term and Regenerate</span>';
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
    <input id="bterm-${i}" value="${esc(slot.term||'')}" onkeydown="if(event.key==='Enter')regenSlotImages(${i})" style="flex:1;font-size:11px;border:1px solid var(--border);border-radius:4px;padding:3px 7px;background:#fff;color:var(--text2)" title="Edit the search term, then Regenerate">
    <button id="bregen-${i}" class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 9px;white-space:nowrap" onclick="regenSlotImages(${i})">Regenerate</button>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">${thumbs}</div>`;
}
function chooseBodyImage(i,j){
  if(!_curDraft||!_curDraft.assets||!_curDraft.assets.body_images)return;
  const a=_curDraft.assets,slot=a.body_images[i];if(!slot)return;
  const c=(slot.candidates||[])[j];slot.chosen=c?c.url:null;
  // update borders in place (no full re-render -> no scroll jump)
  (slot.candidates||[]).forEach((cc,k)=>{const el=document.getElementById('bimg-'+i+'-'+k);if(el)el.style.border='3px solid '+(k===j?'#29abab':'transparent')});
  sb.from('post_drafts').update({assets:a}).eq('post_id',curPost).then(()=>toast('Image selected')).catch(()=>toast('Save failed'));
}
async function regenSlotImages(i){
  if(!_curDraft||!_curDraft.assets||!_curDraft.assets.body_images)return;
  const slot=_curDraft.assets.body_images[i];if(!slot)return;
  const term=((document.getElementById('bterm-'+i)||{}).value||'').trim();
  const btn=document.getElementById('bregen-'+i);if(btn){btn.disabled=true;btn.textContent='Finding…';}
  try{
    const res=await fetch('/.netlify/functions/regen-image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:curPost,index:i,term})});
    const d=await res.json().catch(()=>({}));
    if(!res.ok||!d.ok){toast('Regenerate failed: '+(d.error||('HTTP '+res.status)),4000);return}
    slot.candidates=d.candidates||[];slot.term=d.term||slot.term;slot.page=d.page;
    if(slot.chosen&&!slot.candidates.some(c=>c.url===slot.chosen))slot.chosen=null;
    const el=document.getElementById('bslot-'+i);if(el)el.innerHTML=_bodyImageSlot(slot,i);
    toast(slot.candidates.length?'New photos loaded':'No more results — try a different term',2500);
  }catch(e){toast('Regenerate error: '+e.message,4000)}
  finally{const b=document.getElementById('bregen-'+i);if(b){b.disabled=false;b.textContent='Regenerate';}}
}
async function scheduleNow(override){
  const p=gp(curPost);if(!p)return;
  const brand=(BM[p.blog]||{}).name||'the blog';
  const date=p.proposed_date||p.scheduled_date;
  if(!date){toast('Set a proposed date in the Details tab first');return}
  if(date<localToday()){toast('That date ('+fd(date)+') is in the past — update the date in the Details tab before scheduling.',5000);return}
  const warn=override?'\n\n⚠ This has a flagged check — you are scheduling it anyway.':'';
  if(!confirm('Schedule "'+(p.primary_keyword||p.title||'this post')+'" to '+brand+' for '+fd(date)+'?\n\nIt is created now and goes live automatically on that date.'+warn))return;
  toast('Scheduling…',3000);
  try{
    const res=await fetch('/.netlify/functions/schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:curPost,date,override:!!override})});
    const d=await res.json().catch(()=>({}));
    if(!res.ok||!d.ok){toast('Schedule failed: '+(d.error||('HTTP '+res.status)),4000);return}
    await loadPosts();if(typeof renderPosts==='function')renderPosts();if(curPost===p.id)await openPost(curPost,activePTab||'draft');
    toast('Scheduled + sent to '+brand+' ✓',3000);
  }catch(e){toast('Schedule error: '+e.message,4000)}
}
async function rerenderFeatured(swap){
  if(!_curDraft||!_curDraft.assets)return;
  const pid=curPost;
  const old=(_curDraft.assets.featured_image_url)||'';
  const ft=((document.getElementById('feat-title')||{}).value||'').trim();
  const tg=((document.getElementById('feat-tag')||{}).value||'').trim();
  document.querySelectorAll('#feat-area button').forEach(b=>b.disabled=true);
  const prev=document.getElementById('feat-preview');
  if(prev)prev.innerHTML='<div style="padding:18px 14px;background:var(--bg2);border:1px dashed var(--border);border-radius:var(--r2);margin:4px 0 8px;text-align:center;font-size:13px;color:var(--text)">⏳ '+(swap?'Swapping the background':'Rendering your featured image')+'… <b><span id="feat-elapsed">0</span>s</b><div style="font-size:11px;color:var(--text3);margin-top:6px">Usually about a minute (it builds the image on a server). The preview updates by itself.</div></div>';
  let status;
  try{const res=await fetch('/.netlify/functions/rerender-featured',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:pid,featured_title:ft,featured_tagline:tg,swap:!!swap})});status=res.status;const d=await res.json().catch(()=>({}));if(!res.ok||!d.ok){toast('Re-render failed: '+(d.error||('HTTP '+status)),4500);if(curPost===pid)renderDraftTab();return;}}
  catch(e){toast('Re-render error: '+e.message,4000);if(curPost===pid)renderDraftTab();return;}
  const start=Date.now();
  const iv=setInterval(async()=>{
    const elEl=document.getElementById('feat-elapsed');if(elEl)elEl.textContent=Math.round((Date.now()-start)/1000);
    const d=await loadDraft(pid);
    const url=d&&d.assets&&d.assets.featured_image_url;
    if(url&&url!==old){clearInterval(iv);if(curPost===pid){_curDraft=d;renderDraftTab();}toast('Featured image updated ✓',3000);}
    else if(Date.now()-start>240000){clearInterval(iv);if(curPost===pid)renderDraftTab();toast('Still rendering — hit Check again in a moment',4500);}
  },4000);
}
async function resetSent(){
  const p=gp(curPost);if(!p)return;
  if(!confirm('Reset this post so you can regenerate or publish again?\n\nUse this if you deleted the post in GHL, or want to re-do it. This clears the link to the GHL post and sets it back to Drafted — it does NOT change anything in GHL.'))return;
  try{
    await sb.from('posts').update({ghl_post_id:null,status:'drafted',scheduled_date:null,url:null,published_date:null,confirmed_live:false}).eq('id',curPost);
    await loadPosts();if(typeof renderPosts==='function')renderPosts();if(curPost===p.id)await openPost(curPost,activePTab||'draft');
    toast('Reset — you can publish or schedule again',3000);
  }catch(e){toast('Reset failed: '+e.message,4000)}
}
async function publishNow(override){
  const p=gp(curPost);if(!p)return;
  const brand=(BM[p.blog]||{}).name||'the blog';
  const warn=override?'\n\n⚠ This has a flagged check — you are publishing it anyway.':'';
  if(!confirm('Publish "'+(p.primary_keyword||p.title||'this post')+'" to '+brand+' NOW?\n\nIt goes live immediately.'+warn))return;
  toast('Publishing…',3000);
  try{
    const res=await fetch('/.netlify/functions/schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:curPost,publish:true,override:!!override})});
    const d=await res.json().catch(()=>({}));
    if(!res.ok||!d.ok){toast('Publish failed: '+(d.error||('HTTP '+res.status)),4000);return}
    await loadPosts();if(typeof renderPosts==='function')renderPosts();if(curPost===p.id)await openPost(curPost,activePTab||'draft');
    toast('Published live to '+brand+' ✓',3500);
  }catch(e){toast('Publish error: '+e.message,4000)}
}
function aiEditAsk(){const i=document.getElementById('ai-instr');if(!i||!i.value.trim()){toast('Type an instruction for Claude');return}aiEditRun(i.value.trim());}
function aiEditFix(){const r=(_curDraft&&_curDraft.check_report)||{};const items=[...(r.hard||[]),...(r.warn||[])];if(!items.length){toast('Nothing flagged');return}aiEditRun('Resolve these flagged issues, changing only what is needed: '+items.join('; '));}
async function aiEditRun(instruction){
  const pid=curPost;
  const before=await loadDraft(pid);const prevTs=before?before.generated_at:null;
  const el=document.getElementById('pm-draft-body');
  if(el)el.innerHTML='<div style="text-align:center;padding:2.5rem 1rem"><div style="font-size:14px;font-weight:600;color:var(--text)">Claude is revising the draft…</div><div style="font-size:12px;color:var(--text2);margin-top:8px">About 30-60 seconds. The checks re-run automatically.</div></div>';
  let status;
  try{const res=await fetch('/.netlify/functions/ai-edit-background',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:pid,instruction})});status=res.status;}catch(e){status='err';}
  if(status!==202&&status!==200){if(curPost===pid)renderDraftTab();toast('Could not start AI edit ('+status+')',4000);return;}
  const start=Date.now();
  const iv=setInterval(async()=>{
    const d=await loadDraft(pid);
    if(d&&d.generated_at!==prevTs){clearInterval(iv);if(curPost===pid)renderDraftTab();toast('Draft updated by Claude ✓',3000);}
    else if(Date.now()-start>180000){clearInterval(iv);if(curPost===pid)renderDraftTab();toast('AI edit timed out — try again',4000);}
  },6000);
}
// Run the editorial pass on the current draft (background fn + poll for the result).
async function runEditorialReview(){
  const pid=curPost;
  const before=await loadDraft(pid);const prev=before&&before.editorial?before.editorial.checked_at:null;
  const box=document.getElementById('pm-editorial');
  if(box)box.innerHTML='<div style="font-size:12px;color:var(--text2);padding:2px 0">Editorial review running… about a minute. You can keep working and come back.</div>';
  let status;
  try{const res=await fetch('/.netlify/functions/editorial-review-background',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:pid})});status=res.status;}catch(e){status='err';}
  if(status!==202&&status!==200){if(curPost===pid)renderDraftTab();toast('Could not start editorial review ('+status+')',4000);return;}
  const start=Date.now();
  const iv=setInterval(async()=>{
    const d=await loadDraft(pid);
    const ts=d&&d.editorial?d.editorial.checked_at:null;
    if(ts&&ts!==prev){clearInterval(iv);if(curPost===pid){_curDraft=d;renderDraftTab();}toast('Editorial review ready ✓',3000);}
    else if(Date.now()-start>180000){clearInterval(iv);if(curPost===pid)renderDraftTab();toast('Editorial review timed out — try again',4000);}
  },5000);
}
function _draftRow(label,value,copyKey){
  return `<div style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><label class="fl" style="margin:0">${label}</label>${copyKey?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:0 7px" onclick="copyDraftField('${copyKey}')">Copy</button>`:''}</div>
    <div style="font-size:13px;color:var(--text);background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:7px 10px;word-break:break-word">${value}</div>
  </div>`;
}
function _reportBlock(title,items,color){
  if(!items||!items.length)return'';
  return `<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em">${title}</div><ul style="margin:4px 0 0;padding-left:18px;font-size:12px;color:var(--text2);line-height:1.6">${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`;
}
function _editorialBadge(o){
  const m={strong:['Strong','var(--green-l)','var(--green)','#b8dfc6'],minor:['Minor tweaks','var(--amber-l)','var(--amber-t)','#f0d8a0'],needs_work:['Needs work','var(--red-l)','var(--red-t)','#f0c8c8']};
  const[l,bg,fg,bd]=m[o]||m.minor;
  return `<span style="display:inline-block;padding:3px 11px;border-radius:999px;font-size:11px;font-weight:700;background:${bg};color:${fg};border:1px solid ${bd}">${l}</span>`;
}
// Editorial review block: Claude's read on voice/audience/substance/CTA + broken-link flags.
function _editorialBlock(d){
  const e=d.editorial;
  if(!e)return `<div id="pm-editorial" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:11px 13px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">Editorial review</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:9px">A Claude read for what the checks can't see — voice, audience fit, substance, the right CTA, and links that won't resolve.</div>
    <button class="btn btn-p btn-sm" onclick="runEditorialReview()">Run editorial review</button>
    <span style="font-size:11px;color:var(--text3);margin-left:8px">about a minute</span>
  </div>`;
  const sevColor={high:'var(--red-t)',medium:'var(--amber-t)',low:'var(--text3)'},sevRank={high:0,medium:1,low:2};
  const issues=[...(e.issues||[])].sort((a,b)=>(sevRank[a.severity]??3)-(sevRank[b.severity]??3));
  const issueHtml=issues.length?issues.map(i=>`<div style="margin-bottom:7px;padding-left:9px;border-left:2px solid ${sevColor[i.severity]||'var(--text3)'}">
      <div style="font-size:12px;color:var(--text)"><b style="text-transform:uppercase;font-size:10px;color:${sevColor[i.severity]||'var(--text3)'}">${esc(i.severity||'')} · ${esc(i.area||'')}</b><br>${esc(i.detail||'')}</div>
      ${i.fix?`<div style="font-size:11px;color:var(--text2);margin-top:2px">Fix: ${esc(i.fix)}</div>`:''}
    </div>`).join(''):'<div style="font-size:12px;color:var(--green)">No issues raised.</div>';
  const strengths=(e.strengths||[]).length?`<details style="margin-top:6px"><summary style="font-size:11px;color:var(--text3);cursor:pointer">What's working (${e.strengths.length})</summary><ul style="margin:4px 0 0;padding-left:18px;font-size:12px;color:var(--text2);line-height:1.6">${e.strengths.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:'';
  return `<div id="pm-editorial" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:11px 13px;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:700;color:var(--text)">Editorial review</span>
      ${_editorialBadge(e.overall)}
      <button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:10px" onclick="runEditorialReview()">Re-run</button>
    </div>
    <div style="font-size:12px;color:var(--text);line-height:1.6;margin-bottom:8px">${esc(e.summary||'')}</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px"><b>Voice:</b> ${e.voice_ok?'✓':'⚠'} ${esc(e.voice_note||'')}<br><b>Audience:</b> ${e.audience_ok?'✓':'⚠'} ${esc(e.audience_note||'')}</div>
    ${issueHtml}
    ${strengths}
  </div>`;
}
function _draftViewHtml(d){
  const r=d.check_report||{},a=d.assets||{};
  const post=gp(curPost)||{};
  const brandNm=(BM[post.blog]||{}).name||'the blog';
  const tdate=post.proposed_date||post.scheduled_date;
  const datePast=tdate&&tdate<localToday();
  const futureDate=tdate&&tdate>localToday();
  const il=(d.internal_links||[]).map(l=>`<li><a href="${esc(l.url)}" target="_blank">${esc(l.anchor)}</a></li>`).join('');
  const bimg=(a.body_images||[]);
  const imgPick=bimg.length?bimg.map((slot,i)=>`<div id="bslot-${i}" style="margin-bottom:12px">${_bodyImageSlot(slot,i)}</div>`).join(''):`<span style="color:var(--text3)">Search terms: ${(a.body_image_searches||[]).map(esc).join('; ')||'—'} (connect Pexels to fetch photos)</span>`;
  return `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:10px;margin-bottom:12px">
    <div style="display:flex;gap:6px">
      <input id="ai-instr" placeholder="Ask Claude to revise - e.g. trim the keyword, cut the salesy line" style="flex:1;font-size:12px;border:1px solid var(--border);border-radius:var(--r2);padding:6px 8px;background:#fff;color:var(--text)" onkeydown="if(event.key==='Enter')aiEditAsk()">
      <button class="btn btn-p btn-sm" onclick="aiEditAsk()">Ask Claude</button>
    </div>
    ${((r.hard&&r.hard.length)||(r.warn&&r.warn.length))?`<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px" onclick="aiEditFix()">Fix flagged issues with Claude</button>`:''}
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
    ${_verdictBadge(r.verdict)}
    <span style="font-size:11px;color:var(--text3)">${r.wordCount||'?'} words · ${esc(d.model||'')}</span>
    <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="generateDraftNow()">Regenerate</button>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:10px 12px;margin-bottom:14px">
    ${_reportBlock('Must fix before publishing',r.hard,'var(--red-t)')}
    ${_reportBlock('Worth a look',r.warn,'var(--amber-t)')}
    <details${(r.hard&&r.hard.length)||(r.warn&&r.warn.length)?'':' open'}><summary style="font-size:11px;color:var(--text3);cursor:pointer">${(r.pass||[]).length} checks passed</summary><ul style="margin:4px 0 0;padding-left:18px;font-size:12px;color:var(--text3);line-height:1.6">${(r.pass||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul></details>
  </div>
  ${_editorialBlock(d)}
  ${a.featured_image_search?`<div id="feat-area" style="margin-bottom:14px">
    <label class="fl">Featured image</label>
    <div id="feat-preview">${a.featured_image_url
      ? `<img src="${esc(a.featured_image_url)}" alt="featured" style="display:block;width:100%;border-radius:var(--r2);border:1px solid var(--border);margin:4px 0 8px">`
      : `<div style="font-size:12px;color:var(--text3);padding:10px 12px;background:var(--bg2);border:1px dashed var(--border);border-radius:var(--r2);margin:4px 0 8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span>Rendering…</span><button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="renderDraftTab()">Check again</button></div>`}</div>
    <input id="feat-title" value="${esc(a.featured_title||'')}" placeholder="Image title" style="width:100%;font-size:12px;border:1px solid var(--border);border-radius:4px;padding:6px 8px;background:#fff;color:var(--text);margin-bottom:6px">
    <input id="feat-tag" value="${esc(a.featured_tagline||'')}" placeholder="Image tagline" style="width:100%;font-size:12px;border:1px solid var(--border);border-radius:4px;padding:6px 8px;background:#fff;color:var(--text);margin-bottom:6px">
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button id="feat-rerender" class="btn btn-p btn-sm" style="font-size:11px" onclick="rerenderFeatured(false)">Re-render image</button><button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="rerenderFeatured(true)">Swap background</button></div>
    <div style="font-size:10px;color:var(--text3);margin-top:5px">Edit the title/tagline (separate from the post title), then re-render. Takes about a minute.</div>
  </div>`:''}
  ${_draftRow('Title (H1)',esc(a.title||'—'))}
  ${_draftRow('Meta title',`${esc(d.meta_title||'')} <span style="color:var(--text3)">(${(d.meta_title||'').length})</span>`)}
  ${_draftRow('Meta description',`${esc(d.meta_description||'')} <span style="color:var(--text3)">(${(d.meta_description||'').length})</span>`)}
  ${_draftRow('Slug',esc(d.slug||''))}
  ${_draftRow('Category',esc(d.category||'—'))}
  ${_draftRow('Matched CTA link',a.cta_choice?esc(({trial:'ESC Hub trial',savings:'Savings Simulator',blueprint:'Freedom Blueprint','reality-check':'Reality Check'})[a.cta_choice]||a.cta_choice):'— (footer CTAs only)')}
  <div style="margin-bottom:10px"><label class="fl">Internal links</label><ul style="margin:4px 0 0;padding-left:18px;font-size:12px;line-height:1.6">${il||'<li style="color:var(--text3)">none</li>'}</ul></div>
  <details style="margin:14px 0;border:1px solid var(--border);border-radius:var(--r2);background:var(--bg2)">
    <summary style="cursor:pointer;padding:11px 13px;font-weight:700;font-size:13px;color:var(--text);display:flex;align-items:center;gap:8px">📄 Read the full article <span style="font-weight:400;font-size:11px;color:var(--text3)">${r.wordCount||'?'} words — click to expand</span></summary>
    <div style="max-height:440px;overflow-y:auto;border-top:1px solid var(--border);padding:14px 16px;background:#fff;font-size:13px;line-height:1.7">${d.body_html||''}</div>
  </details>
  <details style="margin-bottom:6px"><summary style="font-size:12px;color:var(--text2);cursor:pointer;font-weight:600">Images & captions</summary>
    <div style="font-size:12px;color:var(--text2);line-height:1.8;margin-top:8px">
      <div style="margin-bottom:4px"><b>Body images</b> - click a photo to choose it:</div>
      ${imgPick}
      <div style="margin-top:10px"><b>Facebook:</b> ${esc(a.facebook_caption||'—')}<br>
      <b>Instagram:</b> ${esc(a.instagram_caption||'—')}<br>
      <b>Pinterest:</b> ${esc(a.pinterest_description||'—')}</div>
    </div>
  </details>
  <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
    ${post.ghl_post_id
      ? `<div style="font-size:12px;color:var(--green);font-weight:600">${post.status==='live'?('✓ Published to '+esc(brandNm)):('✓ Scheduled to '+esc(brandNm)+(post.scheduled_date?(' · '+fd(post.scheduled_date)):''))}</div>${post.url?`<div style="margin-top:4px"><a href="${esc(post.url)}" target="_blank" style="font-size:11px;color:var(--text2)">${esc(post.url)}</a></div>`:''}<button class="btn btn-ghost btn-sm" style="font-size:10px;margin-top:8px" onclick="resetSent()">Reset — re-publish / deleted in GHL</button>`
      : r.verdict==='fail'
        ? `<div style="font-size:12px;color:var(--red-t)">Fix the must-fix items above — or if you've reviewed it and it's fine, override the check:</div>
           <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
             ${futureDate?`<button class="btn btn-ghost btn-sm" onclick="scheduleNow(true)">Schedule anyway →</button>`:''}
             <button class="btn btn-ghost btn-sm" onclick="publishNow(true)">Publish anyway</button>
           </div>`
        : `<div style="display:flex;gap:8px;flex-wrap:wrap">
            ${futureDate?`<button class="btn btn-p" onclick="scheduleNow()">Schedule for ${fd(tdate)} →</button>`:''}
            <button class="btn ${futureDate?'btn-ghost':'btn-p'}" onclick="publishNow()">Publish now</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">${futureDate
            ? ('“Schedule” creates it now and it goes live on '+esc(brandNm)+' automatically on '+fd(tdate)+'. “Publish now” makes it live immediately.')
            : ('“Publish now” makes it live on '+esc(brandNm)+' immediately.'+(datePast?(' The date '+fd(tdate)+' is in the past — set a future date to schedule instead.'):' To schedule for later, set a future date in the Details tab.'))}</div>`}
  </div>`;
}
async function generateDraftNow(){
  const pid=curPost;
  const dp=findDuplicate(gp(pid));
  if(dp&&!confirm('Heads up - this looks a lot like an existing live post:\n\n"'+(dp.title||dp.primary_keyword)+'"\n'+(dp.url||'')+'\n\nThat topic may already be covered. Generate a new draft anyway?'))return;
  const before=await loadDraft(pid);const prevTs=before?before.generated_at:null;
  _genPolling[pid]=true;renderDraftTab();
  let status;
  try{const res=await fetch(GEN_FN,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({post_id:pid})});status=res.status;}
  catch(e){status='err';}
  if(status!==202&&status!==200){
    delete _genPolling[pid];
    if(curPost===pid){const el=document.getElementById('pm-draft-body');if(el)el.innerHTML=`<div class="empty" style="padding:1.5rem;color:var(--red-t)">Could not start generation (status ${status}). Try again in a moment.</div><div style="text-align:center"><button class="btn btn-sm" onclick="renderDraftTab()">Back</button></div>`;}
    return;
  }
  const start=Date.now();
  const iv=setInterval(async()=>{
    const d=await loadDraft(pid);
    if(d&&d.generated_at!==prevTs){
      clearInterval(iv);delete _genPolling[pid];
      await loadPosts();
      if(curPost===pid)renderDraftTab();
      if(typeof renderPosts==='function')renderPosts();
      toast('Draft ready');
    }else if(Date.now()-start>210000){
      clearInterval(iv);delete _genPolling[pid];
      if(curPost===pid){const el=document.getElementById('pm-draft-body');if(el)el.innerHTML=`<div class="empty" style="padding:1.5rem">Still working, or it hit a snag. <button class="btn btn-sm" onclick="renderDraftTab()">Check again</button></div>`;}
    }
  },7000);
}

// PINTEREST TEMPLATE TRACKER
function renderPinterestTracker(){
  const el=document.getElementById('pinterest-tracker-list');if(!el)return;
  const posts=bp().filter(p=>p.pinterest_board&&p.status==='live');
  // Count template usage from canva_template field (stored in serp_notes for now - we'll use a dedicated approach)
  // Show posts with pinterest board set, grouped by board
  const boards={};
  posts.forEach(p=>{if(p.pinterest_board){if(!boards[p.pinterest_board])boards[p.pinterest_board]=[];boards[p.pinterest_board].push(p)}});
  if(!Object.keys(boards).length){el.innerHTML='<div class="empty">No Pinterest boards recorded yet. Add boards in post details.</div>';return}
  el.innerHTML=Object.entries(boards).map(([board,bposts])=>`<div style="margin-bottom:10px"><div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px">${esc(board)} <span style="font-size:10px;color:var(--text3)">(${bposts.length} posts)</span></div>${bposts.map(p=>`<div style="font-size:11px;color:var(--text2);padding:2px 0">${esc(titleCase(p.primary_keyword||p.title||''))}</div>`).join('')}</div>`).join('');
}

// POST LIST — copyable
function renderPostList(){
  const el=document.getElementById('post-list-content');if(!el)return;
  const posts=bp().filter(p=>p.status==='live'||p.status==='scheduled').sort((a,b)=>new Date(b.published_date||b.scheduled_date||0)-new Date(a.published_date||a.scheduled_date||0));
  if(!posts.length){el.innerHTML='<div class="empty">No live or scheduled posts yet.</div>';return}
  const text=posts.map(p=>`${titleCase(p.primary_keyword||p.title||'Untitled')} — ${p.url||'no URL'}`).join('\n');
  el.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-p btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('post-list-text').value);toast('Post list copied')">Copy all</button></div><textarea id="post-list-text" rows="15" style="width:100%;font-size:11px;font-family:monospace;border:1px solid var(--border);border-radius:var(--r2);padding:10px;resize:vertical;color:var(--text2);background:var(--bg2)">${esc(text)}</textarea>`;
}
// PINTEREST TEMPLATE LOG (localStorage based)
function getPinTemplates(){return JSON.parse(localStorage.getItem('pin-templates-'+activeBlog)||'[]')}
function renderPinTemplates(){
  const el=document.getElementById('pinterest-template-log');if(!el)return;
  const t=getPinTemplates();
  el.textContent=t.length?t.map((e,i)=>`${i+1}. ${e}`).join('\n'):'No templates logged yet.';
}
function logPinterestTemplate(){
  const inp=document.getElementById('pin-template-input');if(!inp||!inp.value.trim())return;
  const t=getPinTemplates();
  const entry=`${inp.value.trim()} — ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
  t.unshift(entry);
  localStorage.setItem('pin-templates-'+activeBlog,JSON.stringify(t.slice(0,50)));
  inp.value='';renderPinTemplates();toast('Template logged');
}
function copyPinTemplates(){
  const t=getPinTemplates();
  if(!t.length){toast('No templates logged yet');return}
  const text='Pinterest/IG/FB templates used (most recent first):\n'+t.map((e,i)=>`${i+1}. ${e}`).join('\n')+'\n\nPlease recommend a template not in this list.';
  navigator.clipboard.writeText(text);toast('Template list copied');
}
function clearPinTemplates(){if(!confirm('Clear all logged templates?'))return;localStorage.removeItem('pin-templates-'+activeBlog);renderPinTemplates();toast('Cleared')}

function checkDuplicateKeyword(kw){
  if(!kw||kw.length<3)return null;
  const kwLower=kw.toLowerCase().trim();
  const existing=allPosts.filter(p=>p.blog===activeBlog&&p.primary_keyword);
  for(const p of existing){
    const pk=(p.primary_keyword||'').toLowerCase().trim();
    if(pk===kwLower)return{type:'exact',post:p};
    // Check if one contains the other (similarity)
    if(pk.includes(kwLower)||kwLower.includes(pk)){
      if(Math.abs(pk.length-kwLower.length)<8)return{type:'similar',post:p};
    }
    // Word overlap check
    const kwWords=new Set(kwLower.split(/\s+/).filter(w=>w.length>3));
    const pkWords=new Set(pk.split(/\s+/).filter(w=>w.length>3));
    let overlap=0;
    kwWords.forEach(w=>{if(pkWords.has(w))overlap++});
    if(overlap>=2&&kwWords.size>=2)return{type:'overlap',post:p};
  }
  return null;
}

// ── LIVE POST REVIEW ────────────────────────────────────────────
async function reviewLivePost(id){
  const p=gp(id);
  if(!p||!p.url){toast('No URL set for this post');return}
  toast('Fetching post for review…',3000);
  const apiKey=localStorage.getItem('claude-api-key');
  if(!apiKey){
    // Just open the URL for manual review
    window.open(p.url,'_blank');
    return;
  }
  try{
    const prompt=`Please review this live blog post URL and check for the following issues. Fetch the page at: ${p.url}

Check for:
1. Any broken or suspicious links (links with typos, wrong domains, 404s)
2. Missing or duplicate meta title/description
3. Missing alt text on images
4. CTA present and linking to eschub.com (ESC Hub posts) or escapepreneur.com/freedom-blueprint (No More Somedays)
5. Internal links present (at least 2)
6. Any obvious content issues

Report findings clearly. If everything looks good say so. Keep it brief.`;
    
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-5',
        max_tokens:1000,
        tools:[{type:'web_search_20250305',name:'web_search'}],
        messages:[{role:'user',content:prompt}]
      })
    });
    const rd=await res.json();
    const text=rd.content?.filter(b=>b.type==='text').map(b=>b.text).join('\n')||'Could not fetch review.';
    showReviewModal(p,text);
  }catch(e){
    window.open(p.url,'_blank');
    toast('Could not auto-review — opened in new tab');
  }
}

function showReviewModal(post,reviewText){
  // Reuse the post modal with a review pane
  document.getElementById('pm-title').textContent=(post.primary_keyword||post.title||'Post')+' — Review';
  document.getElementById('pm-kw-display').textContent=post.url||'';
  // Show in details pane temporarily
  const detailsEl=document.getElementById('pm-details');
  const origContent=detailsEl.innerHTML;
  detailsEl.innerHTML=`
    <div style="background:var(--bg2);border-radius:var(--r2);padding:1rem;font-size:12px;line-height:1.8;white-space:pre-wrap;max-height:400px;overflow-y:auto">${esc(reviewText)}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <a href="${esc(post.url)}" target="_blank" class="btn btn-p btn-sm">Open live post →</a>
      <button class="btn btn-sm" onclick="this.closest('.modal').querySelector('#pm-details').innerHTML=window._reviewOrigContent;switchPTab('details')">Back to details</button>
    </div>`;
  window._reviewOrigContent=origContent;
  document.getElementById('post-modal').classList.add('on');
  switchPTab('details');
}

// ── WORD COUNT ──────────────────────────────────────────────────
// Added to post details form — save via savePost()
// We store word_count in the unique_take field... no wait that's Google Doc link
// word_count needs a DB column — for now store in serp_notes as JSON if no serp link
// Actually best to just show/save via the details tab

// ── BULK STATUS UPDATER ─────────────────────────────────────────
let bulkSelected=new Set();
let bulkMode=false;

function toggleBulkMode(){
  bulkMode=!bulkMode;
  bulkSelected.clear();
  renderPosts();
  const btn=document.getElementById('bulk-btn');
  if(btn){
    btn.textContent=bulkMode?'Cancel bulk select':'Bulk select';
    btn.className=bulkMode?'btn btn-ghost btn-sm':'btn btn-sm';
  }
  document.getElementById('bulk-actions').style.display=bulkMode?'flex':'none';
}

function toggleBulkSelect(id,e){
  if(!bulkMode)return;
  e.stopPropagation();
  if(bulkSelected.has(id))bulkSelected.delete(id);
  else bulkSelected.add(id);
  renderPosts();
  document.getElementById('bulk-count').textContent=`${bulkSelected.size} selected`;
}

async function applyBulkStatus(){
  const status=document.getElementById('bulk-status-sel').value;
  if(!status||!bulkSelected.size){toast('Select posts and a status first');return}
  if(!confirm(`Update ${bulkSelected.size} posts to "${status}"?`))return;
  const ids=Array.from(bulkSelected);
  await sb.from('posts').update({status}).in('id',ids);
  bulkSelected.clear();
  bulkMode=false;
  await loadPosts();render();
  document.getElementById('bulk-actions').style.display='none';
  const btn=document.getElementById('bulk-btn');
  if(btn){btn.textContent='Bulk select';btn.className='btn btn-sm'}
  toast(`${ids.length} posts updated to ${status}`);
}

// ── CALENDAR VIEW ───────────────────────────────────────────────
function renderPipeline(){
  const el=document.getElementById('pipeline-list');if(!el)return;
  const posts=bp().filter(p=>p.proposed_date&&!['scheduled','live'].includes(p.status)).sort((a,b)=>new Date(a.proposed_date)-new Date(b.proposed_date));
  const isN=activeBlog==='nms';
  if(!posts.length){el.innerHTML='<div class="empty">No posts with proposed dates yet. Set dates in Planning → Research queue.</div>';return}
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:40px 1fr 140px 120px 60px;gap:0;background:var(--bg);border:1px solid var(--border);border-radius:var(--r)">
      <div style="display:contents;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">
        <div style="padding:10px 12px;border-bottom:2px solid var(--border);background:var(--bg2)">#</div>
        <div style="padding:10px 12px;border-bottom:2px solid var(--border);background:var(--bg2)">Keyword</div>
        <div style="padding:10px 12px;border-bottom:2px solid var(--border);background:var(--bg2)">Date</div>
        <div style="padding:10px 12px;border-bottom:2px solid var(--border);background:var(--bg2)">Status</div>
        <div style="padding:10px 12px;border-bottom:2px solid var(--border);background:var(--bg2);text-align:center">Score</div>
      </div>
      ${posts.map((p,i)=>{
        const score=calcScore(p.ks_score,p.search_volume);
        const isN=activeBlog==='nms';
        const badgeStyle=isN?'border-color:var(--purple);background:var(--purple-l);color:var(--purple-t)':'border-color:var(--teal);background:var(--teal-l);color:var(--teal-d)';
        const bg=i%2===0?'var(--bg)':'var(--bg2)';
        return`<div style="display:contents;cursor:pointer" onclick="openPost('${p.id}','details')">
          <div style="padding:14px 12px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text3);font-weight:600;background:${bg};display:flex;align-items:center">${i+1}</div>
          <div style="padding:14px 12px;border-bottom:1px solid var(--border);background:${bg};display:flex;align-items:center">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'Untitled')}</div>
              ${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''}</div>`:''}
            </div>
          </div>
          <div style="padding:14px 12px;border-bottom:1px solid var(--border);font-size:12px;white-space:nowrap;background:${bg};display:flex;align-items:center">${fd(p.proposed_date)}</div>
          <div style="padding:14px 12px;border-bottom:1px solid var(--border);background:${bg};display:flex;align-items:center">${sbadge(p.status)}</div>
          <div style="padding:14px 12px;border-bottom:1px solid var(--border);background:${bg};display:flex;align-items:center;justify-content:center">${score!=null?`<span style="font-size:12px;font-weight:700;color:${isN?'var(--purple-t)':'var(--teal-d)'}">${score}</span>`:'—'}</div>
        </div>`;
      }).join('')}
    </div>`;
}


function renderCalendar(){
  const el=document.getElementById('cal-grid');if(!el)return;
  const fixedPosts=bp().filter(p=>(p.status==='live'||p.status==='scheduled')&&(p.scheduled_date||p.published_date));
  const proposedPosts=bp().filter(p=>p.proposed_date&&!['scheduled','live'].includes(p.status));
  const now=new Date();
  const year=parseInt(document.getElementById('cal-year')?.value||now.getFullYear());
  const month=parseInt(document.getElementById('cal-month')?.value??now.getMonth());
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const startDow=firstDay.getDay();
  let html='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;margin-bottom:6px">';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>html+=`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:4px">${d}</div>`);
  html+='</div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px">';
  for(let i=0;i<startDow;i++)html+=`<div style="height:100px"></div>`;
  for(let day=1;day<=lastDay.getDate();day++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayFixed=fixedPosts.filter(p=>(p.scheduled_date||p.published_date)===dateStr);
    const dayProp=proposedPosts.filter(p=>p.proposed_date===dateStr);
    const isToday=dateStr===localToday();
    html+=`<div class="cal-day" data-date="${dateStr}"
      ondragover="calDragOver(event)"
      ondrop="calDrop(event,'${dateStr}')"
      ondragleave="calDragLeave(event)"
      style="height:100px;overflow-y:auto;min-width:0;background:${isToday?'var(--teal-l)':'var(--bg)'};border:1px solid ${isToday?'var(--teal)':'var(--border)'};border-radius:6px;padding:4px;position:relative">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:10px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--teal-d)':'var(--text3)'}">${day}</span>
      </div>
      ${dayFixed.map(p=>`<div onclick="openPost('${p.id}','details')" style="font-size:9px;background:${p.status==='live'?'var(--green-l)':'var(--blue-l)'};color:${p.status==='live'?'var(--green)':'var(--blue)'};border-radius:3px;padding:2px 4px;margin-bottom:2px;cursor:pointer;line-height:1.3;word-break:break-word">${esc(titleCase(p.primary_keyword||p.title||''))}</div>`).join('')}
      ${dayProp.map(p=>{
        const sc=calcScore(p.ks_score,p.search_volume);
        return`<div draggable="true"
        ondragstart="calDragStart(event,'${p.id}')"
        ondragend="calDragEnd(event)"
        style="font-size:9px;background:var(--bg2);color:var(--text2);border:1px dashed var(--border-d);border-radius:3px;padding:2px 4px;margin-bottom:2px;cursor:grab;line-height:1.3;word-break:break-word;display:flex;align-items:flex-start;justify-content:space-between;gap:3px">
        <span style="flex:1;cursor:pointer" onclick="openPost('${p.id}','details')">${esc(titleCase(p.primary_keyword||p.title||''))}</span>
        <div style="display:flex;align-items:center;gap:2px;flex-shrink:0">
          ${sc!=null?`<span style="font-weight:700;color:var(--teal-d);font-size:8px">${sc}</span>`:''}
          <button onclick="event.stopPropagation();clearProposedDate('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:10px;line-height:1;padding:0 1px;font-weight:700" title="Remove from calendar">✕</button>
        </div>
        </div>`;
      }).join('')}
      <div style="display:flex;justify-content:center;margin-top:2px">
        <button onclick="calAddPost('${dateStr}')" style="opacity:0;transition:opacity .15s;background:none;border:1px solid var(--teal);border-radius:50%;cursor:pointer;color:var(--teal);font-size:14px;line-height:1;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:700" class="cal-plus" title="Add post to this date">+</button>
      </div>
    </div>`;
  }
  html+='</div>';
  el.innerHTML=html;
  // Show + buttons on hover
  el.querySelectorAll('.cal-day').forEach(d=>{
    d.addEventListener('mouseenter',()=>d.querySelector('.cal-plus').style.opacity='1');
    d.addEventListener('mouseleave',()=>d.querySelector('.cal-plus').style.opacity='0');
  });
}

async function clearProposedDate(id){
  await sb.from('posts').update({proposed_date:null}).eq('id',id);
  const p=allPosts.find(x=>x.id===id);if(p)p.proposed_date=null;
  await loadPosts();renderCalendar();renderPipeline();renderResearch();renderDashboard();
  toast('Removed from calendar — back in Planning');
}

// Calendar drag and drop for proposed entries
let _calDragId=null;
function calDragStart(e,id){_calDragId=id;e.dataTransfer.effectAllowed='move';e.currentTarget.style.opacity='0.4'}
function calDragEnd(e){e.currentTarget.style.opacity='1'}
function calDragOver(e){e.preventDefault();e.currentTarget.style.background='var(--teal-l)';e.currentTarget.style.borderColor='var(--teal)'}
function calDragLeave(e){const d=e.currentTarget;d.style.background='';d.style.borderColor=''}
async function calDrop(e,dateStr){
  e.preventDefault();
  const d=e.currentTarget;d.style.background='';d.style.borderColor='';
  if(!_calDragId)return;
  await saveProposedDate(_calDragId,dateStr);
  await loadPosts();renderCalendar();renderPipeline();renderDashboard();
  toast('Moved to '+fd(dateStr));
  _calDragId=null;
}

// Calendar + button — pick existing post or log new keyword for this date
function calAddPost(dateStr){
  const allUnplanned=bp().filter(p=>!['scheduled','live'].includes(p.status)&&!p.proposed_date);
  const posts=[...allUnplanned].sort((a,b)=>(calcScore(b.ks_score,b.search_volume)||0)-(calcScore(a.ks_score,a.search_volume)||0));
  const existing=bp().filter(p=>p.proposed_date===dateStr&&!['scheduled','live'].includes(p.status));
  let html='<div>';
  if(existing.length){
    html+=`<div style="background:var(--amber-l);border:1px solid var(--amber);border-radius:var(--r2);padding:8px 12px;font-size:11px;color:var(--amber-t);margin-bottom:12px">⚠️ ${existing.length} post${existing.length>1?'s':''} already planned for this date: ${existing.map(p=>esc(titleCase(p.primary_keyword||p.title||''))).join(', ')}</div>`;
  }
  if(posts.length){
    html+=`<div style="font-size:11px;color:var(--text2);margin-bottom:6px;font-weight:600">Assign an existing post:</div>`;
    html+=`<input type="text" id="cal-search" placeholder="Search posts…" oninput="calFilterPosts()" style="width:100%;padding:7px 10px;border:1.5px solid var(--teal);border-radius:30px;font-size:12px;font-family:Poppins,sans-serif;margin-bottom:6px;outline:none">`;
    html+=`<div id="cal-post-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r2);margin-bottom:10px">`;
    posts.forEach(p=>{
      const sc=calcScore(p.ks_score,p.search_volume);
      html+=`<div class="cal-post-item" data-id="${p.id}" data-kw="${esc((p.primary_keyword||p.title||'').toLowerCase())}" onclick="calSelectPost(this,'${dateStr}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background .1s">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(titleCase(p.primary_keyword||p.title||'Untitled'))}</span>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
          ${sc!=null?`<span style="font-size:11px;font-weight:700;color:var(--teal-d)">${sc}</span>`:''}
          ${sbadge(p.status)}
        </div>
      </div>`;
    });
    html+=`</div>`;
  }
  html+=`<div style="font-size:11px;color:var(--text2);margin-bottom:6px;font-weight:600;border-top:1px solid var(--border);padding-top:10px">Or log a new keyword for this date:</div>`;
  html+=`<input type="text" id="cal-new-kw" placeholder="Primary keyword" style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:30px;font-size:12px;font-family:Poppins,sans-serif;margin-bottom:8px;outline:none">`;
  html+=`<button class="btn btn-p btn-sm" onclick="calAddNewKw('${dateStr}')" style="width:100%;justify-content:center">Add to pipeline</button>`;
  html+='</div>';
  document.getElementById('cal-popup-body').innerHTML=html;
  document.getElementById('cal-popup-date').textContent=fd(dateStr);
  document.getElementById('cal-popup-modal').classList.add('on');
  setTimeout(()=>document.getElementById('cal-search')?.focus(),100);
}
function calFilterPosts(){
  const q=(document.getElementById('cal-search')?.value||'').toLowerCase();
  document.querySelectorAll('.cal-post-item').forEach(item=>{
    const kw=item.dataset.kw||'';
    item.style.display=kw.includes(q)?'flex':'none';
  });
}

async function calSelectPost(el,dateStr){
  const id=el.dataset.id;
  document.querySelectorAll('.cal-post-item').forEach(i=>i.style.background='');
  el.style.background='var(--teal-l)';
  await saveProposedDate(id,dateStr);
  await loadPosts();renderCalendar();renderPipeline();renderDashboard();
  closeModal('cal-popup-modal');
  toast('Added to '+fd(dateStr));
}

async function calAssignPost(dateStr){
  const sel=document.getElementById('cal-post-sel');
  if(!sel||!sel.value)return;
  await saveProposedDate(sel.value,dateStr);
  await loadPosts();renderCalendar();renderPipeline();renderDashboard();
  closeModal('cal-popup-modal');toast('Added to '+fd(dateStr));
}

async function calAddNewKw(dateStr){
  const kw=document.getElementById('cal-new-kw')?.value.trim();
  if(!kw)return;
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:kw,status:'idea',current_step:0,indexed:'no',proposed_date:dateStr}).select().single();
  if(error){toast('Error: '+error.message);return}
  await sb.from('social_tracking').insert({post_id:data.id});
  await loadPosts();renderCalendar();renderPipeline();renderDashboard();
  closeModal('cal-popup-modal');toast('Added to pipeline — '+fd(dateStr));
}

// ── CONTENT GAP FINDER ──────────────────────────────────────────
async function findContentGaps(){
  const apiKey=localStorage.getItem('claude-api-key');
  const resultEl=document.getElementById('gap-result');
  if(!resultEl)return;
  if(!apiKey){resultEl.innerHTML='<div style="background:var(--amber-l);border:1px solid var(--amber);border-radius:var(--r2);padding:10px 12px;font-size:12px;color:var(--amber-t)">⚠️ No Claude API key found. Add it in Settings → Claude API key.</div>';return}
  const posts=bp().filter(p=>p.status==='live'||p.status==='drafted'||p.status==='scheduled');
  if(posts.length<3){document.getElementById('gap-result').innerHTML='<div style="font-size:12px;color:var(--text3)">Add more posts first — need at least 3 to find gaps.</div>';return}
  const btn=document.getElementById('gap-btn');
  btn.textContent='Analysing…';btn.disabled=true;
  document.getElementById('gap-result').innerHTML=`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2)"><div class="spinner"></div>Claude is analysing your content for gaps…</div>`;
  
  const kwList=posts.map(p=>p.primary_keyword||p.title).filter(Boolean).join(', ');
  const blog=BM[activeBlog].name;
  const prompt=`You are a content strategist for ${blog}, a blog targeting coaches and solopreneurs who want to simplify their tech stack and grow their business.

Existing posts cover these keywords/topics:
${kwList}

Based on this content, identify 8-10 specific keyword gaps — topics that:
1. A reader of this blog would naturally search for
2. Connect logically to the existing content
3. Have realistic ranking potential (not mega competitive)
4. Would genuinely help the target audience

For each gap provide a specific keyword phrase and one sentence explaining why it's missing and worth writing.

Respond ONLY with JSON:
[{"keyword":"specific keyword phrase","reason":"why it's a gap worth filling"}]`;

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:1200,messages:[{role:'user',content:prompt}]})
    });
    const rd=await res.json();
    const gaps=JSON.parse(rd.content?.[0]?.text?.replace(/```json|```/g,'').trim()||'[]');
    let html='<div style="margin-top:4px">';
    gaps.forEach(g=>{
      html+=`<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:10px 12px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${esc(g.keyword)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(g.reason)}</div>
        </div>
        <button class="btn btn-p btn-xs" onclick="addGapToIdeas('${g.keyword.replace(/'/g,"\\'")}')">+ Add to Ideas</button>
      </div>`;
    });
    html+='</div>';
    document.getElementById('gap-result').innerHTML=html;
  }catch(e){document.getElementById('gap-result').innerHTML=`<div style="font-size:12px;color:var(--red-t)">Error: ${esc(e.message)}</div>`}
  finally{btn.textContent='Find content gaps';btn.disabled=false}
}

async function addGapToIdeas(kw){
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:kw,status:'idea',current_step:0,indexed:'no'}).select().single();
  if(error){toast('Error: '+error.message);return}
  await sb.from('social_tracking').insert({post_id:data.id});
  await loadPosts();render();toast('Added to Ideas: '+kw);
}

// ── PINTEREST BOARD TRACKER ─────────────────────────────────────
// Stored in social_tracking — we'll use a notes approach via post unique_take
// Better: add to post modal social tab as a text field

// ── EMAIL MENTION TRACKER ───────────────────────────────────────
// Simple checkbox + date field per post

// ── MONTHLY SNAPSHOT ───────────────────────────────────────────
async function generateSnapshot(){
  const btn=document.getElementById('snapshot-btn');
  btn.textContent='Generating…';btn.disabled=true;
  const posts=bp();
  const now=new Date();
  const thisMonth=now.getMonth();
  const thisYear=now.getFullYear();
  const lastMonth=thisMonth===0?11:thisMonth-1;
  const lastMonthYear=thisMonth===0?thisYear-1:thisYear;
  
  const publishedThisMonth=posts.filter(p=>{
    if(!p.published_date)return false;
    const d=new Date(p.published_date);
    return d.getMonth()===thisMonth&&d.getFullYear()===thisYear;
  });
  const publishedLastMonth=posts.filter(p=>{
    if(!p.published_date)return false;
    const d=new Date(p.published_date);
    return d.getMonth()===lastMonth&&d.getFullYear()===lastMonthYear;
  });
  const livePosts=posts.filter(p=>p.status==='live');
  const completePosts=posts.filter(p=>p.current_step>=6);
  const fullyLinked=livePosts.filter(p=>_links.filter(l=>l.from_post_id===p.id).length>=3);
  const indexed=posts.filter(p=>p.indexed==='yes');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  
  const snap=`${BM[activeBlog].name} — Monthly Snapshot
${months[thisMonth]} ${thisYear}
${'─'.repeat(40)}

PUBLISHING
Posts live this month: ${publishedThisMonth.length}
Posts live last month: ${publishedLastMonth.length}
Total live posts: ${livePosts.length}

WORKFLOW
Posts fully complete (all steps done): ${completePosts.length}
Posts needing work: ${posts.filter(p=>(p.current_step||0)<6).length}

LINKS
Posts with 3+ internal links: ${fullyLinked.length} / ${livePosts.length}
Posts still needing links: ${livePosts.length-fullyLinked.length}

INDEXING
Indexed posts: ${indexed.length} / ${livePosts.length}
Awaiting indexing: ${posts.filter(p=>p.indexed==='requested').length}
Not yet submitted: ${posts.filter(p=>p.status==='live'&&(p.indexed==='no'||!p.indexed)).length}

IDEAS QUEUE
Ideas waiting: ${posts.filter(p=>p.status==='idea').length}
Drafted: ${posts.filter(p=>p.status==='drafted').length}
Ready for review: ${posts.filter(p=>p.status==='review').length}
Scheduled: ${posts.filter(p=>p.status==='scheduled').length}`;

  document.getElementById('snapshot-output').style.display='block';
  document.getElementById('snapshot-text').textContent=snap;
  btn.textContent='Generate snapshot';btn.disabled=false;
}

async function copySnapshot(){
  const text=document.getElementById('snapshot-text').textContent;
  await copyToClipboard(text);
  toast('Snapshot copied to clipboard');
}

initApp();
