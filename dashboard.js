const BLOGGING_PROJECT_URL='https://claude.ai/project/019cd821-e61f-73e4-bc71-51bda336a345';
const GSC_URLS={esc:'https://search.google.com/search-console/inspect?resource_id=sc-domain:eschub.com&url=',nms:'https://search.google.com/search-console/inspect?resource_id=https://escapepreneur.com/&url='};
const CL_STEPS=[
  {id:'s2',num:'02',title:'Blogging Project → Google Doc',note:'Open a new chat in the Blogging project, paste the brief, and wait. Save the full output to a Google Doc.',items:[
    {id:'cl1',text:'Open a new chat in the Escapepreneur Blogging project (claude.ai)'},
    {id:'cl2',text:'Paste the brief — nothing else needed'},
    {id:'cl3',text:'Wait for Claude to return the full output'},
    {id:'cl4',text:'Save content to a Google Doc named with the keyword — sharing set to Anyone with the link can view. Save in: The Escapepreneur™ > Blog > Blogs in Progress'},
  ]},
  {id:'s3',num:'03',title:'Create All Assets',note:'Create all images and social graphics. Screenshot Freepik images for Claude to review before downloading. Do NOT resize or convert anything yet.',items:[
    {id:'im1',text:'FEATURED IMAGE — Open Canva featured image template (canva.com/brand/brand-templates/EAHE2ynVR3A). Search Canva Photos using Claude\'s suggestions. Add title and subtitle. Export as PNG.'},
    {id:'im2',text:'BODY IMAGE 1 — Freepik, ratio 16:9, size 1K. Generate 2 variations using Claude\'s prompt.'},
    {id:'im3',text:'Screenshot Image 1 variations and paste into Claude Blogging project chat — ask Claude which to use.'},
    {id:'im4',text:'BODY IMAGE 2 — Generate 2 variations at 16:9, 1K. Screenshot, ask Claude to choose.'},
    {id:'im5',text:'BODY IMAGE 3 (if applicable) — Generate 2 variations at 16:9, 1K. Screenshot, ask Claude to choose.'},
    {id:'im6',text:'Download all Claude-approved body images from Freepik — do not resize or convert yet.'},
    {id:'im7',text:'IG/FB GRAPHIC — Open Brand Templates (canva.com/brand/brand-templates/EAHHhN1Proo). Open Claude\'s recommended template. Drop in image, update all text fields. Export.'},
    {id:'im8',text:'PINTEREST GRAPHIC — Open Brand Templates (canva.com/brand/brand-templates/EAHHhJ4jZ8Y). Open Claude\'s recommended template. Drop in image, update all text fields. Export.'},
  ]},
  {id:'s4',num:'04',title:'Claude Review',note:'Share the Google Doc link and upload all images for a holistic review. Only resize and convert once Claude has approved everything.',items:[
    {id:'rv1',text:'Open a new chat (not the Blogging project). Paste the Google Doc link and say: Please review this post and all images.'},
    {id:'rv2',text:'Upload the featured image PNG'},
    {id:'rv3',text:'Upload all body images'},
    {id:'rv4',text:'Upload the IG/FB graphic'},
    {id:'rv5',text:'Upload the Pinterest graphic'},
    {id:'rv6',text:'Read the review — fix any content issues in the Google Doc and remake any flagged images'},
    {id:'rv7',text:'Resize body images at: birme.net/?target_width=1200&target_height=675'},
    {id:'rv8',text:'Convert ALL images to WebP at: tinyimage.online/convert/png-to-webp/ — MAXIMUM 150KB'},
    {id:'rv9',text:'Rename all files using the SEO filenames from Claude\'s output'},
  ]},
  {id:'s5',num:'05',title:'Set Up & Schedule in ESC Hub',note:'All content and images are approved and converted. Build the post in ESC Hub and schedule it.',items:[
    {id:'p1',text:'Paste the article from the Google Doc into the ESC Hub blog editor'},
    {id:'p2',text:'At the top of the page, add a Code Block and enter the code from: docs.google.com/document/d/1w2KiNdQBKAsp7pxksz_c7_t17aOMQI5aWZZMe4n_Ot8/edit'},
    {id:'p3',text:'Upload all WebP images to the Blogging folder in the ESC Hub media library'},
    {id:'p4',text:'Find each [Insert Image: filename.webp] marker — insert the matching image, add alt text, delete the markers'},
    {id:'p5',text:'At the bottom of the post, insert the Pinterest image — set width to 350 and leave height blank'},
    {id:'p6',text:'Click the button at top right to move to the next screen'},
    {id:'p7',text:'Set the URL slug — use the URL SLUG from Claude\'s output'},
    {id:'p8',text:'Set the category (ESC Hub posts only) — use Claude\'s Category recommendation'},
    {id:'p9',text:'Set the featured image — add the alt text and caption from Claude\'s Featured Image section'},
    {id:'p10',text:'Paste in the meta title from Claude\'s output'},
    {id:'p11',text:'Paste in the meta description from Claude\'s output'},
    {id:'p12',text:'Preview on desktop and mobile'},
    {id:'p13',text:'Check the schedule date in the dashboard'},
    {id:'p14',text:'Schedule the post — do not publish immediately'},
    {id:'p15',text:'Schedule on Instagram for the go-live date using Claude\'s Instagram caption'},
    {id:'p16',text:'Share to Facebook on the go-live date using Claude\'s Facebook caption'},
  ]},
  {id:'s6',num:'06',title:'Go-Live Date',note:'These steps happen ON the go-live date.',items:[
    {id:'gl1',text:'Confirm the post is live at the scheduled URL'},
    {id:'gl2',text:'Submit to Google Search Console: URL Inspection → paste URL → Request Indexing — update indexed status to Index Requested'},
    {id:'gl3',text:'PINTEREST FIRST — Pin the graphic to the primary board as specified in Claude\'s output'},
    {id:'gl4',text:'Resave the pin to the secondary board: ESC Hub Blog or No More Somedays Blog'},
    {id:'gl5',text:'Copy the Pinterest pin URL'},
    {id:'gl6',text:'Go into ESC Hub and open the blog post in the editor'},
    {id:'gl7',text:'Find the Pinterest image at the bottom of the post'},
    {id:'gl8',text:'Add the Pinterest pin URL as a hyperlink on the image with anchor text: Click to save this for later'},
    {id:'gl9',text:'Save the post — update social tracker'},
    {id:'gl10',text:'Once confirmed indexed in GSC, update indexed status to Indexed'},
  ]}
];
const ALL_ITEM_IDS=CL_STEPS.flatMap(s=>s.items.map(i=>i.id));

// STATE
let sb=null,activeBlog='esc',activeTab='dashboard',activePTab='details';
let sfilt='all',curPost=null,curSocId=null;
let allPosts=[],allDests=[],_links=[],_clChecked={};
const BM={esc:{name:'ESC Hub',sub:'ESC Hub — eschub.com/blog'},nms:{name:'No More Somedays',sub:'No More Somedays — escapepreneur.com/blog'}};
const IDX={no:{cls:'idx-no',dc:'idc-no',label:'Not indexed'},requested:{cls:'idx-req',dc:'idc-req',label:'Index requested'},'yes':{cls:'idx-yes',dc:'idc-yes',label:'Indexed'}};

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
function scoreClass(s){if(s===null)return'score-n';if(s>=60)return'score-h';if(s>=30)return'score-m';return'score-l';}

// INIT
function initApp(){
  const url=localStorage.getItem('sb-url'),key=localStorage.getItem('sb-key');
  if(!url||!key){document.getElementById('con-screen').style.display='flex';return}
  try{sb=supabase.createClient(url,key);document.getElementById('main-app').style.display='flex';loadAll()}
  catch(e){document.getElementById('con-screen').style.display='flex'}
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
async function loadAll(){await Promise.all([loadPosts(),loadDests()]);await loadLinks();render()}
async function loadPosts(){const{data}=await sb.from('posts').select('*,social_tracking(*)').order('scheduled_date',{ascending:true,nullsFirst:false});allPosts=data||[]}
async function loadDests(){const{data}=await sb.from('link_destinations').select('*');allDests=data||[]}
async function loadLinks(){
  const ids=bp().map(p=>p.id);if(!ids.length){_links=[];return}
  const{data}=await sb.from('internal_links').select('*').eq('blog',activeBlog);_links=data||[];
}
async function loadChecklist(pid){
  const{data}=await sb.from('post_checklist').select('*').eq('post_id',pid);
  _clChecked={};(data||[]).forEach(r=>{if(r.checked)_clChecked[r.item_id]=true});
}

// BLOG/TAB
function switchBlog(blog){
  activeBlog=blog;
  document.getElementById('btn-esc').className='bsw-btn'+(blog==='esc'?' a-esc':'');
  document.getElementById('btn-nms').className='bsw-btn'+(blog==='nms'?' a-nms':'');
  sfilt='all';document.querySelectorAll('.fchip').forEach((b,i)=>b.classList.toggle('on',i===0));
  loadLinks().then(()=>{render();updateTabs()});
}
function switchTab(name,filter){
  activeTab=name;
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
  if(name==='ideas')renderIdeas();
  if(name==='calendar'){setTimeout(()=>{
    const now=new Date();
    const mo=document.getElementById('cal-month');
    const yr=document.getElementById('cal-year');
    if(mo)mo.value=now.getMonth();
    if(yr)yr.value=now.getFullYear();
    renderCalendar();
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
  ['dashboard','posts','links','ideas','calendar','insights','keywords'].forEach((n,i)=>{
    const el=document.querySelectorAll('.nav-i')[i];
    if(el&&n===activeTab)el.classList.add(isN?'a-nms':'a-esc');
  });
  ['add-post-btn','add-idea-btn','dash-add-btn'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.className='btn '+(isN?'btn-pp':'btn-p')+' btn-sm';
  });
}
function switchPTab(name){
  activePTab=name;
  ['details','progress','social','gsc','links'].forEach(n=>{
    document.getElementById('pm-'+n).classList.toggle('on',n===name);
    document.getElementById('ptab-'+n).classList.toggle('on',n===name);
  });
  if(name==='gsc')renderGscHistory();
  if(name==='links')renderModalLinks();
  if(name==='progress')renderChecklist();
}
function setFilter(f,btn){sfilt=f;document.querySelectorAll('.fchip').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');renderPosts()}

// HELPERS
function bp(){return allPosts.filter(p=>p.blog===activeBlog)}
function bd(){return allDests.filter(d=>d.blog===activeBlog)}
function gp(id){return allPosts.find(p=>p.id===id)}
function gt(id){const p=allPosts.find(x=>x.id===id);if(p)return{label:p.title||p.primary_keyword,url:p.url,type:'post'};const d=allDests.find(x=>x.id===id);if(d)return{label:d.label,url:d.url,type:'dest'};return null}
function fl(n){return n===0?'red':n<3?'amber':'green'}
function fd(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function sbadge(s){const m={live:'b-live',scheduled:'b-scheduled',drafted:'b-drafted',review:'b-review',idea:'b-idea'};return`<span class="badge ${m[s]||'b-idea'}">${s==='review'?'Review':s}</span>`}
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
  document.getElementById('sched-pill-wrap').innerHTML=`<button class="sched-pill ${cls}" onclick="switchTab('posts','scheduled')"><span class="sched-dot" style="${dot}"></span>${label}</button>`;
}

// RENDER
function render(){renderDashboard();renderPosts();renderLinksPane();renderIdeas();renderSchedPill()}

// DASHBOARD
function renderDashboard(){
  const posts=bp();
  document.getElementById('dash-title').textContent=BM[activeBlog].name+' Dashboard';
  document.getElementById('dash-sub').textContent=BM[activeBlog].sub;
  const live=posts.filter(p=>p.status==='live').length;
  const sched=posts.filter(p=>p.status==='scheduled').length;
  const review=posts.filter(p=>p.status==='review').length;
  const drafted=posts.filter(p=>p.status==='drafted').length;
  const needsLinks=posts.filter(p=>p.status==='live'&&_links.filter(l=>l.from_post_id===p.id).length<3).length;
  const notIdx=posts.filter(p=>p.status==='live'&&(p.indexed==='no'||!p.indexed)).length;
  document.getElementById('dash-metrics').innerHTML=`
    <div class="metric m-live" onclick="switchTab('posts','live')"><div class="mn" style="color:var(--green)">${live}</div><div class="ml">Live</div></div>
    <div class="metric m-sched" onclick="switchTab('posts','scheduled')"><div class="mn" style="color:var(--blue)">${sched}</div><div class="ml">Scheduled</div></div>
    <div class="metric m-review" onclick="switchTab('posts','review')"><div class="mn" style="color:var(--pink)">${review}</div><div class="ml">Ready for review</div></div>
    <div class="metric m-drafted" onclick="switchTab('posts','drafted')"><div class="mn" style="color:var(--purple)">${drafted}</div><div class="ml">Drafted</div></div>
    <div class="metric m-links" onclick="switchTab('links')"><div class="mn" style="color:var(--red)">${needsLinks}</div><div class="ml">Need links</div></div>
    <div class="metric m-idx" onclick="goToNotIndexed()" style="cursor:pointer"><div class="mn" style="color:var(--amber)">${notIdx}</div><div class="ml">Not indexed</div></div>`;

  // NEXT UP — top 3 by score
  const ideas=bp().filter(p=>p.status==='idea');
  const scored=ideas.map(p=>({...p,_score:calcScore(p.ks_score,p.search_volume)||0})).sort((a,b)=>b._score-a._score).slice(0,3);
  if(!scored.length){document.getElementById('nextup-list').innerHTML='<div class="empty" style="padding:1rem">No ideas in the queue yet. Use + Log keyword to add some.</div>'}
  else{document.getElementById('nextup-list').innerHTML=scored.map((p,i)=>`<div class="next-up-item"><div class="nui-num">${i+1}</div><div style="flex:1;min-width:0"><div class="kw-primary">${esc(p.primary_keyword||'Untitled')}</div>${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''} · Score ${p._score}</div>`:''}</div><button class="btn btn-p btn-xs" onclick="getBriefForPost('${p.id}')">Get brief</button></div>`).join('')}

  const nl=posts.filter(p=>p.status==='live'&&_links.filter(l=>l.from_post_id===p.id).length<3).slice(0,6);
  document.getElementById('dash-links').innerHTML=!nl.length?`<div class="empty" style="padding:1rem;color:var(--green)">All live posts have 3+ links.</div>`:nl.map(p=>{const n=_links.filter(l=>l.from_post_id===p.id).length,lv=fl(n);return`<div class="post-row" onclick="openPost('${p.id}','links')" style="border-left:3px solid var(--${lv==='red'?'red':lv==='amber'?'amber':'green'})"><div style="display:flex;align-items:center;justify-content:space-between"><div style="flex:1;min-width:0"><div class="kw-primary">${esc(p.primary_keyword||p.title)}</div>${p.title&&p.primary_keyword?`<div class="post-title-sub">${esc(p.title)}</div>`:''}</div><span class="flag f-${lv}">${n}/3</span></div></div>`}).join('');

  renderDashRankings();
  const si=posts.filter(p=>{const s=p.social_tracking?.[0];return s&&p.status==='live'&&(!s.pinterest_image_created||!s.pinterest_shared||!s.fb_shared||!s.ig_shared)}).slice(0,5);
  document.getElementById('dash-social').innerHTML=!si.length?`<div class="empty" style="padding:1rem">No incomplete social items.</div>`:si.map(p=>{const s=p.social_tracking?.[0]||{};const done=[s.pinterest_image_created,s.pinterest_shared,s.pinterest_in_blog,s.fb_image_created,s.fb_shared,s.ig_image_created,s.ig_shared].filter(Boolean).length;return`<div class="post-row" onclick="openPost('${p.id}','social')"><div style="display:flex;align-items:center;justify-content:space-between"><div class="kw-primary">${esc(p.primary_keyword||p.title)}</div><span class="flag f-amber">${done}/7</span></div></div>`}).join('');
  const rc=[...posts].filter(p=>p.status==='live'&&p.published_date).sort((a,b)=>new Date(b.published_date)-new Date(a.published_date)).slice(0,5);
  document.getElementById('dash-recent').innerHTML=!rc.length?`<div class="empty" style="padding:1rem">No live posts yet.</div>`:rc.map(p=>`<div class="post-row" onclick="openPost('${p.id}','details')"><div class="kw-primary">${esc(p.primary_keyword||p.title)}</div>${p.title&&p.primary_keyword?`<div class="post-title-sub">${esc(p.title)}</div>`:''}<div class="prk">${fd(p.published_date)}</div></div>`).join('');
  // Complete posts pill
  const completePosts=posts.filter(p=>p.current_step>=6).length;
  const totalPosts=posts.filter(p=>p.status!=='idea').length;
  const completePct=totalPosts>0?Math.round(completePosts/totalPosts*100):0;
  let cpCls=completePct>=80?'sched-green':completePct>=40?'sched-amber':'sched-red';
  const cpWrap=document.getElementById('complete-pill-wrap');
  if(cpWrap)cpWrap.innerHTML=`<button class="sched-pill ${cpCls}" onclick="switchTab('posts','needs-work')"><span class="sched-dot" style="${completePct>=80?'background:#2a7d3f':completePct>=40?'background:#e8960a':'background:#e04444'}"></span>${completePosts}/${totalPosts} complete</button>`;
  // Links pill
  const needsLinkCount=posts.filter(p=>p.status==='live'&&_links.filter(l=>l.from_post_id===p.id).length<3).length;
  const lpWrap=document.getElementById('links-pill-wrap');
  if(lpWrap){const lpCls=needsLinkCount===0?'sched-green':needsLinkCount<=10?'sched-amber':'sched-red';lpWrap.innerHTML=`<button class="sched-pill ${lpCls}" onclick="switchTab('links')"><span class="sched-dot" style="${needsLinkCount===0?'background:#2a7d3f':needsLinkCount<=10?'background:#e8960a':'background:#e04444'}"></span>${needsLinkCount} need links</button>`}
  const idxG={no:posts.filter(p=>p.status==='live'&&(p.indexed==='no'||!p.indexed)),requested:posts.filter(p=>p.indexed==='requested'),'yes':posts.filter(p=>p.indexed==='yes')};
  let idxHtml='';
  ['no','requested','yes'].forEach(k=>{const x=IDX[k],ps=idxG[k];idxHtml+=`<div class="card" style="padding:.75rem 1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span class="idx-dot ${x.cls}"><span class="idx-dot-circle ${x.dc}"></span>${x.label}</span><span style="font-size:18px;font-weight:700">${ps.length}</span></div>${ps.slice(0,3).map(p=>`<div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="openPost('${p.id}','details')">${esc(p.primary_keyword||p.title)}</div>`).join('')}${ps.length>3?`<div style="font-size:10px;color:var(--text3);margin-top:4px">+${ps.length-3} more</div>`:''}</div>`});
  document.getElementById('dash-indexing').innerHTML=idxHtml;
}

async function renderDashRankings(){
  const posts=bp().filter(p=>p.status==='live');
  if(!posts.length){document.getElementById('dash-rankings').innerHTML=`<div class="empty" style="padding:1rem">No live posts yet.</div>`;return}
  const{data}=await sb.from('gsc_positions').select('*').in('post_id',posts.map(p=>p.id)).order('recorded_date',{ascending:false});
  if(!data||!data.length){document.getElementById('dash-rankings').innerHTML=`<div class="empty" style="padding:1rem">No GSC data yet. Import from Settings or open a post to add manually.</div>`;return}
  const byPost={};data.forEach(r=>{if(!byPost[r.post_id])byPost[r.post_id]=[];if(byPost[r.post_id].length<2)byPost[r.post_id].push(r)});
  let html='';
  Object.entries(byPost).slice(0,8).forEach(([pid,ents])=>{
    const post=gp(pid);if(!post)return;
    const lt=ents[0],pv=ents[1];let ch='';
    if(pv&&lt.position&&pv.position){const d=pv.position-lt.position;ch=d>0?`<span class="pos-up">▲${d.toFixed(1)}</span>`:d<0?`<span class="pos-dn">▼${Math.abs(d).toFixed(1)}</span>`:'<span style="color:var(--text3)">—</span>'}
    html+=`<div class="post-row" onclick="openPost('${pid}','gsc')"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="flex:1;min-width:0"><div class="kw-primary">${esc(post.primary_keyword||post.title)}</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:16px;font-weight:700">${lt.position||'—'}</div>${ch}</div></div></div>`;
  });
  document.getElementById('dash-rankings').innerHTML=html||`<div class="empty" style="padding:1rem">No data.</div>`;
}

// POSTS LIST
function renderPosts(){
  document.getElementById('posts-sub').textContent=BM[activeBlog].sub;
  const search=(document.getElementById('post-search')?.value||'').toLowerCase();
  let posts=bp();
  if(sfilt==='not-indexed')posts=posts.filter(p=>p.status==='live'&&(p.indexed==='no'||!p.indexed));
  else if(sfilt==='needs-work')posts=posts.filter(p=>(p.current_step||0)<6).sort((a,b)=>(a.current_step||0)-(b.current_step||0));
  else if(sfilt!=='all')posts=posts.filter(p=>p.status===sfilt);
  if(search)posts=posts.filter(p=>(p.title||'').toLowerCase().includes(search)||(p.primary_keyword||'').toLowerCase().includes(search));
  if(!posts.length){document.getElementById('posts-list').innerHTML='<div class="empty">No posts found.</div>';return}
  document.getElementById('posts-list').innerHTML=posts.map(p=>{
    const ln=_links.filter(l=>l.from_post_id===p.id).length;
    const postLn=_links.filter(l=>l.from_post_id===p.id&&l.to_post_id).length;
    const pageLn=_links.filter(l=>l.from_post_id===p.id&&l.to_dest_id).length;
    const lv=postLn>=3&&pageLn>=2?'green':(postLn>0||pageLn>0)?'amber':'red';
    const s=p.social_tracking?.[0]||{};
    const sd=[s.pinterest_image_created,s.pinterest_shared,s.fb_shared,s.ig_shared].filter(Boolean).length;
    const dateStr=p.status==='live'?fd(p.published_date):p.scheduled_date?fd(p.scheduled_date):'';
    const ix=IDX[p.indexed||'no'];
    const score=calcScore(p.ks_score,p.search_volume);
    return`<div class="post-row" onclick="openPost('${p.id}','details')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px">${sbadge(p.status)}${stepLabel(p.current_step)}${sfilt==='needs-work'?stuckLabel(p.current_step):''}</div>
          <div class="kw-primary">${esc(p.primary_keyword||p.title||'Untitled')}</div>
          ${p.title?`<div class="post-title-sub">${esc(p.title)}</div>`:''}
          ${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''}</div>`:''}
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
            ${dateStr?`<span class="pill pill-g">${dateStr}</span>`:''}
            ${p.status==='live'&&(p.indexed==='no'||!p.indexed)?`<button class="btn btn-xs f-red" style="border:1px solid #f0c8c8;background:var(--red-l);color:var(--red-t)" onclick="event.stopPropagation();requestIndexing('${p.id}')">Request indexing →</button>`:''}
            ${p.status==='live'&&p.indexed==='requested'?`<span class="idx-dot idx-req" style="font-size:9px;padding:1px 6px"><span class="idx-dot-circle idc-req"></span>Index requested</span><button class="btn btn-xs" style="font-size:9px;padding:1px 7px" onclick="event.stopPropagation();checkIndexing('${p.id}')">Check →</button><button class="btn btn-xs f-green" style="border:1px solid #b8dfc6;background:var(--green-l);color:var(--green);font-size:9px;padding:1px 7px" onclick="event.stopPropagation();confirmIndexed('${p.id}')">Confirm ✓</button>`:''}
            ${p.indexed==='yes'?`<span class="idx-dot idx-yes" style="font-size:9px;padding:1px 6px"><span class="idx-dot-circle idc-yes"></span>Indexed</span>`:(!p.status==='live'?`<span class="idx-dot ${ix.cls}" style="font-size:9px;padding:1px 6px"><span class="idx-dot-circle ${ix.dc}"></span>${ix.label}</span>`:'')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          ${score!==null&&(p.status==='idea'||p.status==='drafted')?`<div class="score-badge ${scoreClass(score)}">${score}</div>`:''}
          <span class="flag f-${lv}">${postLn}/3 · ${pageLn}/2</span>
          ${p.status==='live'?`<span class="flag" style="${sd>=4?'background:var(--green-l);color:var(--green);border:1px solid #b8dfc6':'background:var(--amber-l);color:var(--amber-t);border:1px solid #f0d8a0'}">${sd}/4 social</span>`:''}
        </div>
      </div></div>`;
  }).join('');
}

// IDEAS
function renderIdeas(){
  const ideaPosts=bp().filter(p=>p.status==='idea');
  const el=document.getElementById('ideas-list');if(!el)return;
  if(!ideaPosts.length){el.innerHTML='<div class="empty">No ideas yet. Use + Log keyword to queue posts for writing.</div>';return}
  const sorted=[...ideaPosts].map(p=>({...p,_score:calcScore(p.ks_score,p.search_volume)||0})).sort((a,b)=>b._score-a._score);
  el.innerHTML=sorted.map(p=>`<div class="post-row">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="score-badge ${scoreClass(p._score||null)}" style="margin-top:2px">${p._score||'?'}</div>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="openPost('${p.id}','details')">
        <div class="kw-primary">${esc(p.primary_keyword||'Untitled')}</div>
        ${p.supplementary_keywords?`<div class="prk">${esc(p.supplementary_keywords.substring(0,80))}${p.supplementary_keywords.length>80?'…':''}</div>`:''}
        ${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        <button class="btn btn-p btn-sm" onclick="getBriefForPost('${p.id}')">Get brief →</button>
        <button class="btn btn-ghost btn-xs" onclick="openPost('${p.id}','details')">Edit</button>
      </div>
    </div>
  </div>`).join('');
}

// LINKS PANE
async function renderLinksPane(){
  await loadLinks();
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
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:800,messages:[{role:'user',content:prompt}]})});
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
async function rankAndGroupKeywords(){
  const apiKey=localStorage.getItem('claude-api-key');
  const input=document.getElementById('kw-dump-input').value.trim();
  if(!input){toast('Paste some keywords first');return}
  if(!apiKey){toast('Add Claude API key in Settings first');return}
  const btn=document.getElementById('kw-dump-btn');btn.textContent='Thinking…';btn.disabled=true;
  document.getElementById('kw-dump-result').innerHTML=`<div class="card"><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)"><div class="spinner"></div>Grouping and ranking keywords…</div></div>`;
  const prompt=`You are a content strategist for ${BM[activeBlog].name}, a blog targeting coaches and solopreneurs.\n\nHere are keywords to group and rank:\n${input}\n\nGroup them into topic clusters. Within each cluster, rank by writing priority based on: lower KD = better, higher volume = better.\n\nFor each keyword note: estimated KD (if provided), volume (if provided), and why it's worth writing.\n\nRespond ONLY with JSON:\n[{"cluster":"cluster name","keywords":[{"keyword":"kw","ks":null,"volume":null,"priority":"high|medium|low","reason":"brief reason"}]}]`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]})});
    const rd=await res.json();
    if(!res.ok){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">API error ${res.status}: ${esc(rd.error?.message||JSON.stringify(rd))}</div>`;return}
    const rawText=rd.content?.[0]?.text||'';
    if(!rawText){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">Empty response from Claude. Check your API key in Settings.</div>`;return}
    let clusters=[];
    try{clusters=JSON.parse(rawText.replace(/```json|```/g,'').trim())}
    catch(pe){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">Could not parse response. Raw output:<br><pre style="font-size:10px;white-space:pre-wrap;margin-top:6px">${esc(rawText.slice(0,500))}</pre></div>`;return}
    let html='';
    clusters.forEach(c=>{
      html+=`<div class="kw-cluster"><div class="kw-cluster-title">${esc(c.cluster)}</div>`;
      c.keywords.forEach(k=>{
        const sc=calcScore(k.ks,k.volume);
        const pri=k.priority||'medium';
        const priColor=pri==='high'?'var(--red-t)':pri==='medium'?'var(--amber-t)':'var(--green)';
        html+=`<div class="kw-cluster-item"><div style="flex:1"><div style="font-size:12px;font-weight:600">${esc(k.keyword)}</div><div style="font-size:11px;color:var(--text3)">${esc(k.reason)}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0">${k.ks!=null?`<span class="pill pill-g">KS ${k.ks}</span>`:''}<span style="font-size:10px;font-weight:700;color:${priColor}">${pri.toUpperCase()}</span><button class="btn btn-p btn-xs" onclick="addKwToIdeas(this)" data-kw="${esc(k.keyword)}" data-ks="${k.ks||''}" data-vol="${k.volume||''}">+ Add</button></div></div>`;
      });
      html+='</div>';
    });
    document.getElementById('kw-dump-result').innerHTML=html||'<div class="empty">No clusters returned.</div>';
  }catch(e){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">Error: ${esc(e.message)}</div>`}
  finally{btn.textContent='✦ Rank and group';btn.disabled=false}
}

async function addKwToIdeas(el){const kw=el.dataset.kw,ks=el.dataset.ks,vol=el.dataset.vol;
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:kw,ks_score:parseInt(ks)||null,search_volume:parseInt(vol)||null,status:'idea',current_step:0,indexed:'no'}).select().single();
  if(error){toast('Error: '+error.message);return}
  await sb.from('social_tracking').insert({post_id:data.id});
  await loadPosts();render();toast('Added to Ideas: '+kw);
}

// POST MODAL
async function openPost(id,tab){
  curPost=id;await loadLinks();await loadChecklist(id);
  const post=gp(id);if(!post)return;
  const kw=post.primary_keyword||'',title=post.title||'';
  document.getElementById('pm-title').textContent=kw||title||'Post';
  document.getElementById('pm-kw-display').textContent=kw&&title?title:(kw?'No title yet':'');
  document.getElementById('pm-title-i').value=title;
  document.getElementById('pm-url').value=post.url||'';
  document.getElementById('pm-status').value=post.status||'idea';
  document.getElementById('pm-sched').value=post.scheduled_date||'';
  document.getElementById('pm-pub').value=post.published_date||'';
  document.getElementById('pm-indexed').value=post.indexed||'no';
  document.getElementById('pm-kw').value=kw;
  document.getElementById('pm-ks').value=post.ks_score!=null?post.ks_score:'';
  document.getElementById('pm-vol').value=post.search_volume||'';
  document.getElementById('pm-supp').value=post.supplementary_keywords||'';
  document.getElementById('pm-serp-link').value=post.serp_notes||'';
  document.getElementById('pm-doc-link').value=post.unique_take||'';
  document.getElementById('pm-take').value='';
  const isN=activeBlog==='nms';
  document.getElementById('pm-save-btn').className='btn '+(isN?'btn-pp':'btn-p');
  document.getElementById('pm-add-link-btn').className='btn '+(isN?'btn-pp':'btn-p')+' btn-sm';
  document.getElementById('sug-btn').className='btn '+(isN?'btn-pp':'btn-p')+' btn-sm';
  const social=post.social_tracking?.[0];curSocId=social?.id||null;
  const cks=['pin-img','pin-shared','pin-blog','fb-img','fb-shared','ig-img','ig-shared'];
  const flds=['pinterest_image_created','pinterest_shared','pinterest_in_blog','fb_image_created','fb_shared','ig_image_created','ig_shared'];
  cks.forEach((c,i)=>{const el=document.getElementById('ch-'+c),ci=document.getElementById('ci-'+c);if(el){el.checked=!!(social?.[flds[i]]);if(ci)ci.classList.toggle('done',el.checked)}});
  document.getElementById('pm-del-row').classList.remove('on');
  document.getElementById('sug-area').innerHTML='';
  document.getElementById('sug-btn').textContent='Get suggestions';
  document.getElementById('sug-btn').disabled=false;
  // Show review button only for live posts with a URL
  const reviewBtn=document.getElementById('review-post-btn');
  if(reviewBtn)reviewBtn.style.display=(post.status==='live'&&post.url)?'inline-flex':'none';
  document.getElementById('post-modal').classList.add('on');
  switchPTab(tab||'details');
}
async function savePost(){
  if(!curPost)return;
  const u={title:document.getElementById('pm-title-i').value.trim()||null,url:document.getElementById('pm-url').value.trim()||null,status:document.getElementById('pm-status').value,scheduled_date:document.getElementById('pm-sched').value||null,published_date:document.getElementById('pm-pub').value||null,indexed:document.getElementById('pm-indexed').value||'no',primary_keyword:document.getElementById('pm-kw').value.trim()||null,ks_score:parseInt(document.getElementById('pm-ks').value)||null,search_volume:parseInt(document.getElementById('pm-vol').value)||null,supplementary_keywords:document.getElementById('pm-supp').value.trim()||null,serp_notes:document.getElementById('pm-serp-link').value.trim()||null,unique_take:document.getElementById('pm-doc-link').value.trim()||null};
  // Extra fields stored in metadata
  const extraMeta={word_count:parseInt(document.getElementById('pm-wordcount')?.value)||null,pinterest_board:document.getElementById('pm-pinterest-board')?.value.trim()||null,email_mentioned:document.getElementById('pm-email-mentioned')?.value||null,email_date:document.getElementById('pm-email-date')?.value||null,pub_notes:document.getElementById('pm-notes')?.value.trim()||null};
  // Store extras in supplementary_keywords field as JSON suffix if they exist
  // Actually store publishing notes in title field prefix if title is notes-only
  if(extraMeta.pub_notes!==null)u.serp_notes=(u.serp_notes||'')+(u.serp_notes?'||NOTES:'+extraMeta.pub_notes:'NOTES:'+extraMeta.pub_notes);
  const btn=document.getElementById('pm-save-btn');btn.textContent='Saving…';btn.disabled=true;
  await sb.from('posts').update(u).eq('id',curPost);
  await loadPosts();render();toast('Saved');
  btn.textContent='Save changes';btn.disabled=false;
}
async function saveSocial(){
  if(!curSocId&&!curPost)return;
  const u={pinterest_image_created:document.getElementById('ch-pin-img').checked,pinterest_shared:document.getElementById('ch-pin-shared').checked,pinterest_in_blog:document.getElementById('ch-pin-blog').checked,fb_image_created:document.getElementById('ch-fb-img').checked,fb_shared:document.getElementById('ch-fb-shared').checked,ig_image_created:document.getElementById('ch-ig-img').checked,ig_shared:document.getElementById('ch-ig-shared').checked};
  ['pin-img','pin-shared','pin-blog','fb-img','fb-shared','ig-img','ig-shared'].forEach(c=>{const ci=document.getElementById('ci-'+c),el=document.getElementById('ch-'+c);if(ci&&el)ci.classList.toggle('done',el.checked)});
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
function renderChecklist(){
  const total=ALL_ITEM_IDS.length,done=ALL_ITEM_IDS.filter(id=>_clChecked[id]).length,pct=Math.round((done/total)*100);
  document.getElementById('prog-summary').textContent=`${done} of ${total} steps complete (${pct}%)`;
  document.getElementById('prog-fill').style.width=pct+'%';
  // Remember which sections are open before wiping
  const openSections=new Set();
  CL_STEPS.forEach(s=>{const b=document.getElementById('cl-body-'+s.id);if(b&&b.style.display!=='none')openSections.add(s.id)});
  let html='';
  CL_STEPS.forEach(step=>{
    const sd=step.items.filter(i=>_clChecked[i.id]).length,allDone=sd===step.items.length;
    html+=`<div class="cl-section"><button class="cl-hdr" onclick="toggleClStep('${step.id}')"><div class="cl-num ${allDone?'done':''}">${allDone?'✓':step.num}</div><div class="cl-title">${step.title}</div><div class="cl-prog">${sd}/${step.items.length}</div><span id="cl-arr-${step.id}" style="font-size:13px;color:var(--text3);margin-left:6px;transition:transform .2s;display:inline-block">⌄</span></button><div id="cl-body-${step.id}" class="cl-body" style="display:none">${step.note?`<div class="cl-note">💡 ${esc(step.note)}</div>`:''}${step.items.map(item=>`<div class="cl-item${_clChecked[item.id]?' ck':''}"><div class="cl-cb" onclick="toggleClItem('${item.id}')" title="Mark as done">${_clChecked[item.id]?'✓':''}</div><span class="cl-text">${esc(item.text)}</span></div>`).join('')}</div></div>`;
  });
  document.getElementById('cl-sections').innerHTML=html;
  // Restore open sections first
  openSections.forEach(id=>{
    const body=document.getElementById('cl-body-'+id),arr=document.getElementById('cl-arr-'+id);
    if(body){body.style.display='block';if(arr)arr.style.transform='rotate(180deg)'}
  });
  // If nothing was open yet, auto-open the first incomplete step
  if(!openSections.size){
    const activeStep=CL_STEPS.find(s=>s.items.some(i=>!_clChecked[i.id]));
    if(activeStep){const body=document.getElementById('cl-body-'+activeStep.id),arr=document.getElementById('cl-arr-'+activeStep.id);if(body){body.style.display='block';if(arr)arr.style.transform='rotate(180deg)'}}
  }
}
function toggleClStep(id){const body=document.getElementById('cl-body-'+id),arr=document.getElementById('cl-arr-'+id);if(!body)return;const open=body.style.display!=='none';body.style.display=open?'none':'block';if(arr)arr.style.transform=open?'rotate(0)':'rotate(180deg)'}
async function toggleClItem(itemId){
  if(!curPost)return;
  const wasComplete=ALL_ITEM_IDS.every(id=>_clChecked[id]);
  const newVal=!_clChecked[itemId];_clChecked[itemId]=newVal;
  await sb.from('post_checklist').upsert({post_id:curPost,item_id:itemId,checked:newVal},{onConflict:'post_id,item_id'});
  const step=calcCurrentStep();
  await sb.from('posts').update({current_step:step}).eq('id',curPost);
  await loadPosts();renderChecklist();renderPosts();
  // Check if just became complete
  const nowComplete=ALL_ITEM_IDS.every(id=>_clChecked[id]);
  if(!wasComplete&&nowComplete){
    const post=gp(curPost);
    celebrate(post?.primary_keyword||post?.title||'Post');
    checkMilestone();
  }
}
function calcCurrentStep(){
  let maxStep=0;
  CL_STEPS.forEach((s,i)=>{if(s.items.some(item=>_clChecked[item.id]))maxStep=i+2});
  if(ALL_ITEM_IDS.every(id=>_clChecked[id]))maxStep=6;
  return maxStep;
}
async function resetChecklist(){
  if(!confirm('Reset all checklist items for this post?'))return;
  _clChecked={};
  await sb.from('post_checklist').delete().eq('post_id',curPost);
  await sb.from('posts').update({current_step:0}).eq('id',curPost);
  await loadPosts();renderChecklist();renderPosts();toast('Checklist reset');
}

// GSC
function showAddGsc(){document.getElementById('gsc-form').style.display='block';document.getElementById('gsc-date').value=new Date().toISOString().split('T')[0]}
function hideAddGsc(){document.getElementById('gsc-form').style.display='none'}
async function renderGscHistory(){
  if(!curPost)return;
  const{data}=await sb.from('gsc_positions').select('*').eq('post_id',curPost).order('recorded_date',{ascending:false});
  const rows=data||[];
  if(!rows.length){document.getElementById('gsc-tbody').innerHTML=`<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text3)">No rankings yet.</td></tr>`;return}
  document.getElementById('gsc-tbody').innerHTML=rows.map((r,i)=>{const pv=rows[i+1];let ch='—';if(pv&&r.position&&pv.position){const d=pv.position-r.position;ch=d>0?`<span class="pos-up">▲${d.toFixed(1)}</span>`:d<0?`<span class="pos-dn">▼${Math.abs(d).toFixed(1)}</span>`:'—'}return`<tr><td>${fd(r.recorded_date)}</td><td style="font-weight:700">${r.position||'—'}</td><td>${r.impressions?.toLocaleString()||'—'}</td><td>${r.clicks?.toLocaleString()||'—'}</td><td>${ch}</td><td><button class="btn btn-danger btn-xs" onclick="delGsc('${r.id}')">✕</button></td></tr>`}).join('');
}
async function saveGsc(){
  const e={post_id:curPost,recorded_date:document.getElementById('gsc-date').value||new Date().toISOString().split('T')[0],position:parseFloat(document.getElementById('gsc-pos').value)||null,impressions:parseInt(document.getElementById('gsc-impr').value)||null,clicks:parseInt(document.getElementById('gsc-clicks').value)||null,notes:document.getElementById('gsc-notes').value.trim()||null};
  if(!e.position){alert('Please enter a position.');return}
  await sb.from('gsc_positions').insert(e);
  ['gsc-pos','gsc-impr','gsc-clicks','gsc-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  hideAddGsc();renderGscHistory();renderDashRankings();toast('Ranking saved');
}
async function delGsc(id){await sb.from('gsc_positions').delete().eq('id',id);renderGscHistory()}

// GSC IMPORT
async function handleGscFile(event){
  const file=event.target.files[0];if(!file)return;
  const importDate=document.getElementById('gsc-import-date').value||new Date().toISOString().split('T')[0];
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
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]})});
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
  document.getElementById('set-sb-url').value=url;
  document.getElementById('set-sb-key').value='';
  document.getElementById('set-api-key').placeholder=ak?'sk-ant-••••••':'sk-ant-...';
  document.getElementById('set-api-msg').textContent=ak?'API key saved.':'No API key saved.';
  document.getElementById('set-cadence').value=cadence;
  document.getElementById('gsc-import-date').value=new Date().toISOString().split('T')[0];
  renderDestList();document.getElementById('settings-modal').classList.add('on');
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
  const p=gp(id);if(!p||!p.url)return;
  const gscUrl=GSC_URLS[p.blog]+encodeURIComponent(p.url);
  window.open(gscUrl,'_blank');
}
async function confirmIndexed(id){
  await sb.from('posts').update({indexed:'yes'}).eq('id',id);
  await loadPosts();render();toast('Marked as indexed ✓');
}
initApp();
// ── DUPLICATE KEYWORD DETECTOR ──────────────────────────────────
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
        model:'claude-sonnet-4-20250514',
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
function renderCalendar(){
  const el=document.getElementById('cal-grid');
  if(!el)return;
  const posts=bp().filter(p=>p.scheduled_date||p.published_date);
  // Get current month range
  const now=new Date();
  const year=parseInt(document.getElementById('cal-year')?.value||now.getFullYear());
  const month=parseInt(document.getElementById('cal-month')?.value??now.getMonth());
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const startDow=firstDay.getDay();
  
  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>html+=`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:4px">${d}</div>`);
  html+='</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
  
  // Empty cells before first day
  for(let i=0;i<startDow;i++)html+=`<div style="min-height:60px"></div>`;
  
  for(let day=1;day<=lastDay.getDate();day++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayPosts=posts.filter(p=>(p.scheduled_date||p.published_date)===dateStr);
    const isToday=dateStr===new Date().toISOString().split('T')[0];
    html+=`<div style="min-height:60px;background:${isToday?'var(--teal-l)':'var(--bg)'};border:1px solid ${isToday?'var(--teal)':'var(--border)'};border-radius:6px;padding:4px">
      <div style="font-size:10px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--teal-d)':'var(--text3)'};margin-bottom:2px">${day}</div>
      ${dayPosts.map(p=>`<div onclick="openPost('${p.id}','details')" style="font-size:9px;background:${p.status==='live'?'var(--green-l)':'var(--blue-l)'};color:${p.status==='live'?'var(--green)':'var(--blue)'};border-radius:3px;padding:1px 4px;margin-bottom:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.primary_keyword||p.title||'Post')}</div>`).join('')}
    </div>`;
  }
  html+='</div>';
  el.innerHTML=html;
}

// ── CONTENT GAP FINDER ──────────────────────────────────────────
async function findContentGaps(){
  const apiKey=localStorage.getItem('claude-api-key');
  if(!apiKey){document.getElementById('gap-result').innerHTML='<div style="color:var(--amber-t);font-size:12px">Add Claude API key in Settings first.</div>';return}
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
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,messages:[{role:'user',content:prompt}]})
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
