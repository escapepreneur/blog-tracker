const BLOGGING_PROJECT_URL='https://claude.ai/project/019cd821-e61f-73e4-bc71-51bda336a345';
const GSC_URLS={esc:'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Aeschub.com&item_url=',nms:'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Aescapepreneur.com&item_url='};
const CL_STEPS=[
  {id:'s1b',num:'01',title:'Before You Start',note:'Complete these before generating the brief.',items:[
    {id:'s1b1',text:'Add the primary keyword to SerpRobot rank tracking (serprobot.com) — check you have slots available, 75 max per bot'},
  ]},
  {id:'s2',num:'02',title:'Generate the Full Post',note:'Use the button below to copy the brief and open the Blogging project. Claude will return the complete post package including title, image prompts, meta data, and social captions. Download the output as a DOCX.',items:[
    {id:'cl1',text:'Click the "Copy brief & open project" button below — this copies your brief and opens the Blogging project in a new tab'},
    {id:'cl2',text:'Paste the brief into the new chat — nothing else needed'},
    {id:'cl3',text:'Wait for Claude to return the FULL output: post, meta title, meta description, image prompts, Canva recommendations, social captions'},
    {id:'cl4',text:'Download the Claude output as a DOCX file (click the download icon on the message)'},
  ]},
  {id:'s3',num:'03',title:'Create All Assets',note:'Create each image and review it with Claude immediately after creation. Do NOT batch them at the end. Do NOT resize or convert anything yet.',items:[
    {id:'im1',text:'FEATURED IMAGE — Open Canva featured image template (canva.com/brand/brand-templates/EAHE2ynVR3A). Search Canva Photos using Claude\'s suggestions. Add title and subtitle. Export as PNG. Screenshot and paste into the Blogging project chat for Claude to review.'},
    {id:'im2',text:'BODY IMAGE 1 — Freepik, ratio 16:9, size 1K. Generate 2 variations using Claude\'s prompt.'},
    {id:'im3',text:'Screenshot Image 1 variations immediately and paste into the Blogging project chat — ask Claude which to use. Only then move to Image 2.'},
    {id:'im4',text:'BODY IMAGE 2 — Generate 2 variations at 16:9, 1K. Screenshot immediately and ask Claude to choose before moving on.'},
    {id:'im5',text:'BODY IMAGE 3 (if applicable) — Generate 2 variations at 16:9, 1K. Screenshot immediately and ask Claude to choose.'},
    {id:'im6',text:'Download all Claude-approved body images from Freepik — do not resize or convert yet.'},
    {id:'im7',text:'IG/FB GRAPHIC — Open Brand Templates (canva.com/brand/brand-templates/EAHHhN1Proo). Open Claude\'s recommended template number. Drop in image, update all text fields. Export. Screenshot and paste into Blogging project chat for review.'},
    {id:'im8',text:'PINTEREST GRAPHIC — Open Brand Templates (canva.com/brand/brand-templates/EAHHhJ4jZ8Y). Open Claude\'s recommended template number. Drop in image, update all text fields. Export. Screenshot and paste into Blogging project chat for review.'},
  ]},
  {id:'s4',num:'04',title:'Full Review',note:'Upload the DOCX and all final images to the ESC Hub Blog Reviewer Bot for a complete review before anything goes into ESC Hub.',items:[
    {id:'rv1',text:'Open a new chat in the ESC Hub Blog Reviewer Bot. Upload the DOCX and say: Please review this post and all images.'},
    {id:'rv2',text:'Upload the featured image PNG'},
    {id:'rv3',text:'Upload all body images'},
    {id:'rv4',text:'Upload the IG/FB graphic'},
    {id:'rv5',text:'Upload the Pinterest graphic'},
    {id:'rv6',text:'Read the review — fix any content issues in the DOCX and remake any flagged images'},
    {id:'rv7',text:'Resize body images at: birme.net/?target_width=1200&target_height=675'},
    {id:'rv8',text:'Convert ALL images to WebP at: tinyimage.online/convert/png-to-webp/ — MAXIMUM 150KB'},
    {id:'rv9',text:'Rename all files using the SEO filenames from Claude\'s output'},
  ]},
  {id:'s5',num:'05',title:'Set Up & Schedule in ESC Hub',note:'All content and images are approved and converted. Build the post in ESC Hub and schedule it.',items:[
    {id:'p1',text:'Paste the article from the DOCX into the ESC Hub blog editor'},
    {id:'p2',text:'Add a Code Block in the position Claude specified in the output, and enter the code from: docs.google.com/document/d/1w2KiNdQBKAsp7pxksz_c7_t17aOMQI5aWZZMe4n_Ot8/edit'},
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
let sfilt='live',curPost=null,curSocId=null;
let allPosts=[],allDests=[],_links=[],_clChecked={};
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
async function loadAll(){await Promise.all([loadPosts(),loadDests()]);await loadLinks();render();updateWeeklyButtons()}
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
  sfilt='live';document.querySelectorAll('.fchip').forEach((b,i)=>b.classList.toggle('on',i===1));
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
  if(name==='research')renderResearch();
  if(name==='keywords')initKeywordsTab();
  if(name==='pipeline')renderPipeline();  if(name==='planning'){renderPlanning();}
  if(name==='tracking')renderTracking();
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
  ['dashboard','posts','pipeline','links','planning','calendar','tracking','insights','keywords'].forEach((n,i)=>{
    const el=document.querySelectorAll('.nav-i')[i];
    if(el&&n===activeTab)el.classList.add(isN?'a-nms':'a-esc');
  });
  ['add-post-btn','add-idea-btn','dash-add-btn','add-research-btn'].forEach(id=>{
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
function render(){renderDashboard();renderPosts();renderLinksPane();renderIdeas();renderSchedPill()}

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

  // HORIZONTAL METRIC PILLS
  const dmEl=document.getElementById('dash-metrics');if(dmEl)dmEl.innerHTML=`
    <button class="dash-pill dash-pill-green" onclick="switchTab('posts','live')"><span class="dp-num">${live}</span><span class="dp-lbl">Live</span></button>
    <button class="dash-pill dash-pill-blue" onclick="switchTab('posts','scheduled')"><span class="dp-num">${sched}</span><span class="dp-lbl">Scheduled</span></button>
    <button class="dash-pill dash-pill-purple" onclick="switchTab('posts','drafted')"><span class="dp-num">${drafted}</span><span class="dp-lbl">Drafted</span></button>
    <button class="dash-pill dash-pill-amber" onclick="switchTab('posts','not-indexed')"><span class="dp-num">${notIdx+idxReq}</span><span class="dp-lbl">Indexing needed</span></button>
    <button class="dash-pill dash-pill-teal" onclick="switchTab('planning')"><span class="dp-num">${ideas}</span><span class="dp-lbl">In queue</span></button>`;

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
    else{nlDashEl.innerHTML=nlDash.slice(0,5).map(p=>{const lv=p.postLn>=3&&p.pageLn>=2?'green':(p.postLn>0||p.pageLn>0)?'amber':'red';return`<div class="post-row" onclick="openPost('${p.id}','links')"><div style="display:flex;align-items:center;justify-content:space-between"><div class="kw-primary" style="flex:1;min-width:0">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'')}</div><span class="flag f-${lv}">${p.postLn}/3·${p.pageLn}/2</span></div></div>`}).join('')+(nlDash.length>5?`<div style="font-size:11px;color:var(--text3);margin-top:6px;cursor:pointer" onclick="switchTab('tracking')">+${nlDash.length-5} more → Tracking</div>`:'')}
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

function renderTracking(){
  const posts=bp();
  // NEEDS LINKS
  const nl=posts.filter(p=>p.status==='live').map(p=>({...p,postLn:_links.filter(l=>l.from_post_id===p.id&&l.to_post_id).length,pageLn:_links.filter(l=>l.from_post_id===p.id&&l.to_dest_id).length})).filter(p=>p.postLn<3||p.pageLn<2);
  const nlEl=document.getElementById('track-links');
  if(nlEl)nlEl.innerHTML=!nl.length?`<div class="empty" style="padding:1rem;color:var(--green)">All live posts fully linked.</div>`:nl.map(p=>{const lv=p.postLn>=3&&p.pageLn>=2?'green':(p.postLn>0||p.pageLn>0)?'amber':'red';return`<div class="post-row" onclick="openPost('${p.id}','links')" style="border-left:3px solid var(--${lv})"><div style="display:flex;align-items:center;justify-content:space-between"><div class="kw-primary" style="flex:1;min-width:0">${esc(p.primary_keyword||p.title)}</div><span class="flag f-${lv}">${p.postLn}/3 · ${p.pageLn}/2</span></div></div>`}).join('');
  // SOCIAL INCOMPLETE
  const si=posts.filter(p=>{const s=p.social_tracking?.[0];return s&&p.status==='live'&&(!s.pinterest_image_created||!s.pinterest_shared||!s.pinterest_in_blog||!s.fb_shared||!s.ig_shared)});
  const siEl=document.getElementById('track-social');
  if(siEl)siEl.innerHTML=!si.length?`<div class="empty" style="padding:1rem;color:var(--green)">All social complete.</div>`:si.map(p=>{const s=p.social_tracking?.[0]||{};return socialIconRow(s,p)}).filter(Boolean).join('');
  // RECENTLY PUBLISHED
  const rc=[...posts].filter(p=>p.status==='live'&&p.published_date).sort((a,b)=>new Date(b.published_date)-new Date(a.published_date)).slice(0,8);
  const rcEl=document.getElementById('track-recent');
  if(rcEl)rcEl.innerHTML=!rc.length?`<div class="empty" style="padding:1rem">No live posts yet.</div>`:rc.map(p=>`<div class="post-row" onclick="openPost('${p.id}','details')"><div class="kw-primary">${esc(p.primary_keyword||p.title)}</div><div class="prk">${fd(p.published_date)}</div></div>`).join('');
  renderTrackingRankings();
}

async function renderTrackingRankings(){
  const posts=bp().filter(p=>p.status==='live');
  const rankEl=document.getElementById('track-rankings');if(!rankEl)return;
  if(!posts.length){rankEl.innerHTML='<div class="empty" style="padding:1rem">No live posts yet.</div>';return}
  const{data}=await sb.from('gsc_positions').select('*').in('post_id',posts.map(p=>p.id)).order('recorded_date',{ascending:false});
  if(!data||!data.length){rankEl.innerHTML='<div class="empty" style="padding:1rem">No ranking data yet. Import from SerpRobot or GSC.</div>';return}
  const byPost={};data.forEach(r=>{if(!byPost[r.post_id])byPost[r.post_id]=[];if(byPost[r.post_id].length<2)byPost[r.post_id].push(r)});
  let html='';
  Object.entries(byPost).forEach(([pid,ents])=>{
    const post=gp(pid);if(!post)return;
    const lt=ents[0],pv=ents[1];let ch='';
    if(pv&&lt.position&&pv.position){const d=pv.position-lt.position;ch=d>0?`<span class="pos-up">▲${d.toFixed(1)}</span>`:d<0?`<span class="pos-dn">▼${Math.abs(d).toFixed(1)}</span>`:'<span style="color:var(--text3)">—</span>'}
    const src=lt.notes?.startsWith('SerpRobot')?'SR':lt.notes?.startsWith('GSC')?'GSC':'';
    html+=`<div class="post-row" onclick="openPost('${pid}','gsc')"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="flex:1;min-width:0"><div class="kw-primary">${esc(post.primary_keyword||post.title)}</div></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0">${src?`<span style="font-size:9px;font-weight:700;color:var(--text3)">${src}</span>`:''}<div style="font-size:16px;font-weight:700">${lt.position||'—'}</div>${ch}</div></div></div>`;
  });
  rankEl.innerHTML=html||'<div class="empty" style="padding:1rem">No data.</div>';
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
    sortEl.innerHTML=['score','volume','ks','manual'].map(s=>`<button class="fchip${_researchSort===s?' on':''}" onclick="setResearchSort('${s}')">${s==='score'?'Priority score':s==='volume'?'Volume':s==='ks'?'KS score (easiest)':'Manual order'}</button>`).join('');
  }

  if(!filtered.length){el.innerHTML=`<div class="empty">${search?'No keywords match.':all.length?'No unplanned keywords. All have proposed dates — see Pipeline.':'No keywords yet. Use + Log keyword to add some.'}</div>`;return}

  el.innerHTML=filtered.map((p,i)=>{
    const score=calcScore(p.ks_score,p.search_volume);
    const drag=isManual?`draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragover="dragOver(event)" ondrop="dragDrop(event,'${p.id}')" ondragend="dragEnd(event)"`:'' ;
    return`<div class="research-card" ${drag} data-id="${p.id}">
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
function renderIdeas(){
  const isN=activeBlog==='nms';
  const ideaPosts=bp().filter(p=>!['scheduled','live'].includes(p.status));
  const el=document.getElementById('ideas-list');if(!el)return;
  const search=(document.getElementById('ideas-search')?.value||'').toLowerCase();
  const sorted=[...ideaPosts].map(p=>({...p,_score:calcScore(p.ks_score,p.search_volume)||0})).sort((a,b)=>b._score-a._score);
  const filtered=search?sorted.filter(p=>(p.primary_keyword||'').toLowerCase().includes(search)||(p.supplementary_keywords||'').toLowerCase().includes(search)||(p.title||'').toLowerCase().includes(search)):sorted;
  if(!filtered.length){el.innerHTML=`<div class="empty">${search?'No keywords match that search.':'No ideas yet. Use + Log keyword to queue posts for writing.'}</div>`;return}
  const badgeStyle=isN?'border-color:var(--purple);background:var(--purple-l);color:var(--purple-t)':'border-color:var(--teal);background:var(--teal-l);color:var(--teal-d)';
  el.innerHTML=filtered.map(p=>`<div class="post-row">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="score-badge" style="${p._score?badgeStyle:'background:var(--bg2);color:var(--text3);border-color:var(--border)'};margin-top:2px">${p._score||'?'}</div>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="openPost('${p.id}','details')">
        <div class="kw-primary">${esc(p.primary_keyword||'Untitled')}</div>
        ${p.supplementary_keywords?`<div class="prk">${esc(p.supplementary_keywords.substring(0,80))}${p.supplementary_keywords.length>80?'…':''}</div>`:''}
        ${p.ks_score!=null?`<div class="prk">KS ${p.ks_score}${p.search_volume?' · '+p.search_volume.toLocaleString()+'/mo':''}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        <button class="btn ${isN?'btn-pp':'btn-p'} btn-sm" onclick="getBriefForPost('${p.id}')">Get brief →</button>
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

function clearUsedCombinations(){
  if(!confirm('Clear all used keyword combinations? Next generation will include previously generated keywords.'))return;
  localStorage.removeItem('kw-used-combos-'+activeBlog);
  toast('Cleared — next generation starts fresh');
}

function getSeeds(){
  return{
    platforms:(localStorage.getItem('kw-seeds-platforms')||DEFAULT_PLATFORMS.join('\n')).split('\n').map(s=>s.trim()).filter(Boolean),
    problems:(localStorage.getItem('kw-seeds-problems')||DEFAULT_PROBLEMS.join('\n')).split('\n').map(s=>s.trim()).filter(Boolean),
    modifiers:PLATFORM_MODIFIERS_TOP.concat(PLATFORM_MODIFIERS_OTHER)
  };
}

function saveSeeds(){
  const p=document.getElementById('kw-seeds-platforms')?.value||'';
  const pr=document.getElementById('kw-seeds-problems')?.value||'';
  localStorage.setItem('kw-seeds-platforms',p);
  localStorage.setItem('kw-seeds-problems',pr);
  toast('Seed lists saved');
}

function loadSeeds(){
  const s=getSeeds();
  const pe=document.getElementById('kw-seeds-platforms');if(pe)pe.value=s.platforms.join('\n');
  const pre=document.getElementById('kw-seeds-problems');if(pre)pre.value=s.problems.join('\n');
}

function getUsedCombinations(){return new Set(JSON.parse(localStorage.getItem('kw-used-combos-'+activeBlog)||'[]'))}
function saveUsedCombination(combo){const s=getUsedCombinations();s.add(combo);localStorage.setItem('kw-used-combos-'+activeBlog,JSON.stringify([...s].slice(-500)))}

function getExistingKeywords(){
  return new Set(allPosts.filter(p=>p.blog===activeBlog&&p.primary_keyword).map(p=>p.primary_keyword.toLowerCase().trim()));
}

function buildCandidatePool(type){
  const seeds=getSeeds();
  const used=getUsedCombinations();
  const existing=getExistingKeywords();
  const inQueue=new Set(getKwQueue().map(k=>k.keyword.toLowerCase().trim()));
  const candidates=[];const tried=new Set();

  const ok=(kw)=>!tried.has(kw)&&!used.has(kw)&&!existing.has(kw)&&!inQueue.has(kw);
  const add=(kw,t)=>{if(ok(kw)){candidates.push({kw,type:t});tried.add(kw)}};

  if(type==='competitor'||type==='all'){
    // Top converting: platform + alternatives/vs/pricing/review
    for(const mod of PLATFORM_MODIFIERS_TOP){
      for(const plat of seeds.platforms){
        add(`${plat.toLowerCase()} ${mod}`,'competitor');
      }
    }
    // Secondary: platform + for coaches / for solopreneurs
    for(const mod of PLATFORM_MODIFIERS_OTHER){
      for(const plat of seeds.platforms){
        add(`${plat.toLowerCase()} ${mod}`,'competitor');
      }
    }
  }

  if(type==='problem'||type==='all'){
    // Problem phrases stand alone — already complete search queries
    for(const prob of seeds.problems){
      add(prob.toLowerCase(),'problem');
    }
  }

  return candidates;
}

function generateCandidates(count,type='balanced'){
  const used=getUsedCombinations();
  let selected=[];

  if(type==='balanced'){
    const third=Math.floor(count/3);
    const competitorPool=buildCandidatePool('competitor');
    const problemPool=buildCandidatePool('problem');
    // Shuffle each pool for variety
    const shuffle=arr=>[...arr].sort(()=>Math.random()-.5);
    selected=[
      ...shuffle(competitorPool).slice(0,third+Math.ceil((count-third*2)/2)),
      ...shuffle(problemPool).slice(0,third+Math.floor((count-third*2)/2)),
    ].slice(0,count);
  } else {
    selected=buildCandidatePool(type).slice(0,count);
  }

  if(!selected.length){
    document.getElementById('kw-generated-output').style.display='none';
    toast('No new combinations available — try adding more seeds or clearing used combinations');
    return;
  }

  // Mark as used
  selected.forEach(c=>saveUsedCombination(c.kw));
  if(!selected.length){document.getElementById('kw-generated-output').style.display='none';toast('No new combinations available — try adding more seeds');return}

  // Mark as used
  selected.forEach(c=>saveUsedCombination(c.kw));

  const kwList=selected.map(c=>c.kw);
  const el=document.getElementById('kw-generated-text');
  if(el)el.textContent=kwList.join(', ');
  document.getElementById('kw-generated-output').style.display='block';
  // Store for bulk add
  window._generatedKws=kwList;
  toast(`${selected.length} keywords generated — copy for Keysearch`);
}

function copyGeneratedKeywords(){
  const text=document.getElementById('kw-generated-text')?.textContent||'';
  if(!text){toast('Generate keywords first');return}
  navigator.clipboard.writeText(text);toast('Copied — paste into Keysearch');
}

function addAllToValidation(){
  // Try stored variable first, fall back to reading from DOM
  let kws=window._generatedKws||[];
  if(!kws.length){
    const text=document.getElementById('kw-generated-text')?.textContent||'';
    if(text.trim())kws=text.split(',').map(k=>k.trim()).filter(Boolean);
  }
  if(!kws.length){toast('Generate keywords first');return}
  const queue=getKwQueue();
  const existing=new Set(queue.map(k=>k.keyword.toLowerCase()));
  let added=0;
  kws.forEach(kw=>{
    if(!existing.has(kw.toLowerCase())){
      queue.push({id:'kw-'+Date.now()+'-'+Math.random().toString(36).slice(2),keyword:kw,ks_score:null,volume:null,status:'new',added:localToday()});
      added++;
    }
  });
  saveKwQueue(queue);renderKwValidation();switchKwTab('validate');
  toast(`${added} keywords added to validation queue`);
}

// KW QUEUE (localStorage)
function getKwQueue(){return JSON.parse(localStorage.getItem('kw-queue-'+activeBlog)||'[]')}
function saveKwQueue(q){localStorage.setItem('kw-queue-'+activeBlog,JSON.stringify(q))}
function getKwApproved(){return JSON.parse(localStorage.getItem('kw-approved-'+activeBlog)||'[]')}
function saveKwApproved(a){localStorage.setItem('kw-approved-'+activeBlog,JSON.stringify(a))}

function kwStatus(ks,vol){
  if(ks==null||vol==null)return'new';
  if(ks<=30&&vol>=100&&vol<=3000)return'pass';
  if(ks<=40&&vol>=50)return'maybe';
  return'fail';
}

function kwStatusBadge(s){
  const map={pass:'background:#e8f5ee;color:#1a6b37;border:1px solid #b8dfc6',maybe:'background:var(--amber-l);color:var(--amber-t);border:1px solid #f0d8a0',fail:'background:var(--red-l);color:var(--red-t);border:1px solid #f0c8c8',new:'background:var(--bg2);color:var(--text3);border:1px solid var(--border)'};
  const labels={pass:'✓ Pass',maybe:'~ Maybe',fail:'✕ Fail',new:'Not checked'};
  return`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;${map[s]||map.new}">${labels[s]||s}</span>`;
}

let _kwFilter='all';
function setKwFilter(f,btn){_kwFilter=f;document.querySelectorAll('#kwpane-validate .fchip').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');renderKwValidation()}

function renderKwValidation(){
  const queue=getKwQueue();
  const el=document.getElementById('kw-validate-list');if(!el)return;
  const existingKws=getExistingKeywords();

  let filtered=queue;
  if(_kwFilter!=='all')filtered=queue.filter(k=>k.status===_kwFilter||(k.status===undefined&&_kwFilter==='new'));

  // Sort: pass first, then maybe, then new, then fail; within each by score desc
  const order={pass:0,maybe:1,new:2,fail:3};
  filtered.sort((a,b)=>{
    const od=(order[a.status]||2)-(order[b.status]||2);
    if(od!==0)return od;
    return(calcScore(b.ks_score,b.volume)||0)-(calcScore(a.ks_score,a.volume)||0);
  });

  // Update counts
  const passCount=queue.filter(k=>k.status==='pass').length;
  const totalCount=queue.length;
  const approvedEl=document.getElementById('kw-validate-count');if(approvedEl)approvedEl.textContent=totalCount;
  const appCountEl=document.getElementById('kw-approved-count');if(appCountEl)appCountEl.textContent=getKwApproved().length;

  if(!filtered.length){el.innerHTML=`<div class="empty">${queue.length?'No keywords match this filter.':'No keywords in queue. Generate candidates or upload a Keysearch CSV.'}</div>`;return}

  el.innerHTML=filtered.map(k=>{
    const score=calcScore(k.ks_score,k.volume);
    const isN=activeBlog==='nms';
    const badgeStyle=isN?'border-color:var(--purple);background:var(--purple-l);color:var(--purple-t)':'border-color:var(--teal);background:var(--teal-l);color:var(--teal-d)';
    const isExisting=existingKws.has((k.keyword||'').toLowerCase().trim());
    const sweetSpot=k.volume>=300&&k.volume<=3000&&k.ks_score<=30;
    return`<div class="post-row" style="padding:12px 16px;${k.status==='pass'?'border-left:3px solid var(--green)':k.status==='maybe'?'border-left:3px solid var(--amber)':k.status==='fail'?'border-left:3px solid var(--red-t)':''}">
      <div style="display:flex;align-items:center;gap:10px;justify-content:space-between">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-size:13px;font-weight:600">${esc(titleCase(k.keyword||''))}</span>
            ${sweetSpot?'<span style="font-size:9px;background:var(--teal);color:#fff;border-radius:10px;padding:1px 6px;font-weight:700">⭐ Sweet spot</span>':''}
            ${isExisting?'<span style="font-size:9px;background:var(--amber-l);color:var(--amber-t);border-radius:10px;padding:1px 6px;border:1px solid #f0d8a0">Already have post</span>':''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="display:flex;gap:4px;align-items:center">
              <span style="font-size:10px;color:var(--text3)">KS</span>
              <input type="number" value="${k.ks_score!=null?k.ks_score:''}" min="0" max="100" placeholder="—" style="width:50px;padding:3px 6px;font-size:11px;border:1px solid var(--border);border-radius:20px;text-align:center;font-family:Poppins,sans-serif" onchange="updateKwScore('${k.id}','ks_score',this.value)">
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <span style="font-size:10px;color:var(--text3)">Vol</span>
              <input type="number" value="${k.volume!=null?k.volume:''}" placeholder="—" style="width:70px;padding:3px 6px;font-size:11px;border:1px solid var(--border);border-radius:20px;text-align:center;font-family:Poppins,sans-serif" onchange="updateKwScore('${k.id}','volume',this.value)">
            </div>
            ${kwStatusBadge(k.status||'new')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
          ${score!=null?`<div class="score-badge" style="${badgeStyle};width:34px;height:34px;font-size:11px">${score}</div>`:''}
          <div style="display:flex;gap:4px">
            ${k.status==='pass'?`<button class="btn btn-p btn-xs" onclick="sendKwToPlanning('${k.id}')">→ Planning</button>`:''}
            <button class="btn btn-danger btn-xs" onclick="removeFromQueue('${k.id}')">✕</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateKwScore(id,field,val){
  const queue=getKwQueue();
  const idx=queue.findIndex(k=>k.id===id);if(idx===-1)return;
  queue[idx][field]=val===''?null:parseFloat(val);
  queue[idx].status=kwStatus(queue[idx].ks_score,queue[idx].volume);
  saveKwQueue(queue);renderKwValidation();
}

function removeFromQueue(id){
  const queue=getKwQueue().filter(k=>k.id!==id);saveKwQueue(queue);renderKwValidation();
}

async function sendKwToPlanning(id){
  const queue=getKwQueue();
  const kw=queue.find(k=>k.id===id);if(!kw)return;
  const{data,error}=await sb.from('posts').insert({blog:activeBlog,primary_keyword:kw.keyword,ks_score:kw.ks_score,search_volume:kw.volume,status:'idea',current_step:0,indexed:'no'}).select().single();
  if(error){toast('Error: '+error.message);return}
  await sb.from('social_tracking').insert({post_id:data.id});
  // Move to approved history
  const approved=getKwApproved();
  approved.unshift({...kw,sent:localToday()});
  saveKwApproved(approved.slice(0,200));
  // Remove from queue
  saveKwQueue(queue.filter(k=>k.id!==id));
  await loadPosts();renderKwValidation();renderKwApproved();
  toast(`"${titleCase(kw.keyword)}" sent to Planning`);
}

function clearFailedKw(){
  const queue=getKwQueue();
  const remaining=queue.filter(k=>k.status!=='fail');
  const count=queue.length-remaining.length;
  if(!count){toast('No failed keywords to clear');return}
  if(!confirm(`Clear ${count} failed keyword${count>1?'s':''}?`))return;
  saveKwQueue(remaining);renderKwValidation();toast(`${count} failed keywords cleared`);
}

function clearAllKwQueue(){
  const queue=getKwQueue();
  if(!queue.length){toast('Queue is already empty');return}
  if(!confirm(`Clear all ${queue.length} keywords from the queue? This cannot be undone.`))return;
  saveKwQueue([]);renderKwValidation();toast('Queue cleared');
}
