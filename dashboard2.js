async function importGKPCSV(e){
  const file=e.target.files[0];if(!file)return;
  document.getElementById('kw-file-label').textContent=file.name+' — processing…';
  const buffer=await file.arrayBuffer();
  const text=new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/).filter(Boolean);
  // Find header row
  const headerIdx=lines.findIndex(l=>l.includes('Avg. monthly searches'));
  if(headerIdx===-1){document.getElementById('kw-import-result').innerHTML=`<div style="color:var(--red-t);font-size:12px">Could not find GKP header row. Make sure you exported from Google Keyword Planner.</div>`;return}
  const headers=lines[headerIdx].split('\t');
  const kwIdx=headers.findIndex(h=>h.toLowerCase().includes('keyword'));
  const volIdx=headers.findIndex(h=>h.includes('Avg. monthly searches'));
  const compIdx=headers.findIndex(h=>h==='Competition');
  const compNumIdx=headers.findIndex(h=>h.includes('indexed value'));
  const imported=[];
  for(let i=headerIdx+1;i<lines.length;i++){
    const cols=lines[i].split('\t');
    if(cols.length<3)continue;
    const kw=(cols[kwIdx]||'').trim();
    if(!kw||kw.startsWith('http'))continue;
    const volRaw=(cols[volIdx]||'').replace(/,/g,'').trim();
    const vol=volRaw&&volRaw!=='--'?parseInt(volRaw)||null:null;
    // Map competition to approximate KS score
    const comp=(cols[compIdx]||'').trim().toLowerCase();
    const compNum=parseFloat(cols[compNumIdx]||'')||null;
    let ks=null;
    if(compNum!=null)ks=Math.round(compNum*0.4); // scale 0-100 → 0-40
    else if(comp==='low')ks=20;
    else if(comp==='medium')ks=35;
    else if(comp==='high')ks=60;
    imported.push({
      id:'kw-'+Date.now()+'-'+Math.random().toString(36).slice(2),
      keyword:kw,ks_score:ks,volume:vol,
      status:kwStatus(ks,vol),
      added:localToday(),source:'gkp'
    });
  }
  if(!imported.length){document.getElementById('kw-import-result').innerHTML=`<div style="color:var(--red-t);font-size:12px">No keywords found. Check the file format.</div>`;return}
  const queue=getKwQueue();
  const existingKws=new Set(queue.map(k=>k.keyword.toLowerCase().trim()));
  const newOnes=imported.filter(k=>!existingKws.has(k.keyword.toLowerCase().trim()));
  const skipped=imported.length-newOnes.length;
  saveKwQueue([...queue,...newOnes]);
  renderKwValidation();
  document.getElementById('kw-import-result').innerHTML=`<div style="color:var(--green);font-weight:600;font-size:12px">✓ ${newOnes.length} keywords imported from Google Keyword Planner · ${skipped} duplicates skipped</div>`;
  document.getElementById('kw-file-label').textContent='✓ '+file.name;
  switchKwTab('validate');toast(`${newOnes.length} keywords imported from GKP`);
  e.target.value='';
}

// Keysearch CSV import
async function importKeysearchCSV(e){
  const file=e.target.files[0];if(!file)return;
  document.getElementById('kw-file-label').textContent=file.name+' — processing…';
  const buffer=await file.arrayBuffer();
  let text='';
  try{const decoder=new TextDecoder('utf-16le');text=decoder.decode(buffer).replace(/^\uFEFF/,'')}
  catch(ex){text=new TextDecoder('utf-8').decode(buffer)}
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const imported=[];let matched=0,skipped=0;
  const kwHeader=/^keyword\tvolume/i;
  let i=0;
  while(i<lines.length){
    if(kwHeader.test(lines[i])){
      i++;
      // Next non-empty line is the keyword data
      if(i<lines.length){
        const cols=lines[i].split('\t');
        const kw=(cols[0]||'').trim();
        const vol=parseInt(cols[1])||null;
        const ks=parseFloat(cols[4])||null;
        if(kw&&kw.toLowerCase()!=='url'){
          imported.push({id:'kw-'+Date.now()+'-'+Math.random().toString(36).slice(2),keyword:kw,ks_score:ks,volume:vol,status:kwStatus(ks,vol),added:localToday()});
          matched++;
        }
      }
    }
    i++;
  }
  if(!matched){document.getElementById('kw-import-result').innerHTML=`<div style="color:var(--red-t);font-size:12px">Could not parse file. Expected Keysearch difficulty CSV format.</div>`;document.getElementById('kw-file-label').textContent='Upload Keysearch CSV';return}
  // Merge into queue, skip duplicates
  const queue=getKwQueue();
  const existingKws=new Set(queue.map(k=>k.keyword.toLowerCase().trim()));
  const newOnes=imported.filter(k=>!existingKws.has(k.keyword.toLowerCase().trim()));
  skipped=imported.length-newOnes.length;
  saveKwQueue([...queue,...newOnes]);
  renderKwValidation();
  document.getElementById('kw-import-result').innerHTML=`<div style="color:var(--green);font-weight:600;font-size:12px">✓ ${newOnes.length} keywords imported · ${skipped} duplicates skipped</div>`;
  document.getElementById('kw-file-label').textContent='✓ '+file.name;
  switchKwTab('validate');toast(`${newOnes.length} keywords imported`);
  e.target.value='';
}

// Quick wins from GSC
async function findQuickWins(){
  const el=document.getElementById('kw-quickwins');if(!el)return;
  el.innerHTML='<div style="font-size:12px;color:var(--text2)">Checking GSC data…</div>';
  const posts=bp().filter(p=>p.status==='live');
  if(!posts.length){el.innerHTML='<div style="font-size:12px;color:var(--text3)">No live posts to check.</div>';return}
  const{data}=await sb.from('gsc_positions').select('*').in('post_id',posts.map(p=>p.id)).order('recorded_date',{ascending:false});
  if(!data||!data.length){el.innerHTML='<div style="font-size:12px;color:var(--text3)">No GSC data yet. Import from the weekly GSC button on the dashboard.</div>';return}
  const byPost={};data.forEach(r=>{if(!byPost[r.post_id])byPost[r.post_id]=r});
  const quickWins=Object.entries(byPost).filter(([pid,r])=>r.position>=11&&r.position<=30).sort((a,b)=>a[1].position-b[1].position);
  if(!quickWins.length){el.innerHTML='<div style="font-size:12px;color:var(--green);padding:6px 0">✓ No keywords in the 11-30 range — either ranking on page 1 or not yet in top 30.</div>';return}
  el.innerHTML=quickWins.map(([pid,r])=>{const p=gp(pid);if(!p)return'';return`<div class="post-row" onclick="openPost('${pid}','gsc')" style="border-left:3px solid var(--amber)"><div style="display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:12px;font-weight:600">${esc(titleCase(p.primary_keyword||p.title||''))}</div><div class="prk">Position ${r.position.toFixed(1)} · ${fd(r.recorded_date)}</div></div><span style="font-size:14px;font-weight:700;color:var(--amber-t)">#${Math.round(r.position)}</span></div></div>`}).filter(Boolean).join('');
}

// KW tab switching
let _kwTab='generate';
function switchKwTab(tab){
  _kwTab=tab;
  ['generate','validate','approved','dump'].forEach(t=>{
    const pane=document.getElementById('kwpane-'+t);if(pane)pane.style.display=t===tab?'block':'none';
    const btn=document.getElementById('kwtab-'+t);if(btn)btn.classList.toggle('on',t===tab);
  });
  if(tab==='validate')renderKwValidation();
  if(tab==='approved')renderKwApproved();
  if(tab==='generate')loadSeeds();
}

function initKeywordsTab(){
  // Show Thursday banner
  const day=new Date().getDay();
  const banner=document.getElementById('thursday-banner');
  if(banner)banner.style.display=day===4?'flex':'none';
  loadSeeds();
  renderKwValidation();
}

async function rankAndGroupKeywords(){
  const apiKey=localStorage.getItem('claude-api-key');
  const input=document.getElementById('kw-dump-input').value.trim();
  if(!input){toast('Paste some keywords first');return}
  if(!apiKey){toast('Add Claude API key in Settings first');return}
  const btn=document.getElementById('kw-dump-btn');btn.textContent='Thinking…';btn.disabled=true;
  document.getElementById('kw-dump-result').innerHTML=`<div class="card"><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)"><div class="spinner"></div>Grouping and ranking keywords…</div></div>`;
  const prompt=`You are a content strategist for ${BM[activeBlog].name}, a blog targeting coaches and solopreneurs.\n\nHere are keywords to group and rank:\n${input}\n\nGroup them into topic clusters. Within each cluster, rank by writing priority based on: lower KD = better, higher volume = better.\n\nFor each keyword note: estimated KD (if provided), volume (if provided), and why it's worth writing.\n\nRespond ONLY with JSON:\n[{"cluster":"cluster name","keywords":[{"keyword":"kw","ks":null,"volume":null,"priority":"high|medium|low","reason":"brief reason"}]}]`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:2000,messages:[{role:'user',content:prompt}]})});
    const rd=await res.json();
    if(!res.ok){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">API error ${res.status}: ${esc(rd.error?.message||JSON.stringify(rd))}</div>`;return}
    const rawText=rd.content?.[0]?.text||'';
    if(!rawText){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">Empty response from Claude. Check your API key in Settings.</div>`;return}
    let clusters=[];
    try{clusters=JSON.parse(rawText.replace(/```json|```/g,'').trim())}
    catch(pe){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">Could not parse response. Raw output:<br><pre style="font-size:10px;white-space:pre-wrap;margin-top:6px">${esc(rawText.slice(0,500))}</pre></div>`;return}
    let html='';
    let _clusterData={};
    clusters.forEach((c,ci)=>{
      // Pick best primary = highest priority then highest score
      const ranked=[...c.keywords].sort((a,b)=>{
        const pOrder={high:0,medium:1,low:2};
        const pd=(pOrder[a.priority||'medium']||1)-(pOrder[b.priority||'medium']||1);
        if(pd!==0)return pd;
        return(calcScore(b.ks,b.volume)||0)-(calcScore(a.ks,a.volume)||0);
      });
      _clusterData[ci]=ranked;
      const primary=ranked[0];
      const suppArr=ranked.slice(1).map(k=>k.keyword);
      html+=`<div class="kw-cluster">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="kw-cluster-title" style="margin:0">${esc(c.cluster)}</div>
          <button class="btn btn-p btn-xs" onclick="addClusterAsPost(${ci})" style="white-space:nowrap;flex-shrink:0">＋ Add cluster as post</button>
        </div>`;
      c.keywords.forEach(k=>{
        const sc=calcScore(k.ks,k.volume);
        const pri=k.priority||'medium';
        const priColor=pri==='high'?'var(--red-t)':pri==='medium'?'var(--amber-t)':'var(--green)';
        const isPrimary=k.keyword===primary.keyword;
        html+=`<div class="kw-cluster-item" style="${isPrimary?'background:var(--teal-l);border-left:3px solid var(--teal);':''}"><div style="flex:1"><div style="font-size:12px;font-weight:600">${esc(k.keyword)}${isPrimary?' <span style="font-size:9px;background:var(--teal);color:#fff;border-radius:10px;padding:1px 6px;font-weight:600;vertical-align:middle">PRIMARY</span>':''}</div><div style="font-size:11px;color:var(--text3)">${esc(k.reason)}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0">${k.ks!=null?`<span class="pill pill-g">KS ${k.ks}</span>`:''}<span style="font-size:10px;font-weight:700;color:${priColor}">${pri.toUpperCase()}</span><button class="btn btn-xs" onclick="addKwToIdeas(this)" data-kw="${esc(k.keyword)}" data-ks="${k.ks||''}" data-vol="${k.volume||''}">+ Add</button></div></div>`;
      });
      html+=`</div>`;
    });
    // Store cluster data globally for addClusterAsPost
    window._kwClusterData=_clusterData;
    document.getElementById('kw-dump-result').innerHTML=html||'<div class="empty">No clusters returned.</div>';
  }catch(e){document.getElementById('kw-dump-result').innerHTML=`<div class="card" style="color:var(--red-t);font-size:13px">Error: ${esc(e.message)}</div>`}
  finally{btn.textContent='✦ Rank and group';btn.disabled=false}
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
  curPost=id;await loadLinks();await loadChecklist(id);
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
  switchPTab(tab||'details');
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
    html+=`<div class="cl-section"><button class="cl-hdr" onclick="toggleClStep('${step.id}')"><div class="cl-num ${allDone?'done':''}">${allDone?'✓':step.num}</div><div class="cl-title">${step.title}</div><div class="cl-prog">${sd}/${step.items.length}</div><span id="cl-arr-${step.id}" style="font-size:13px;color:var(--text3);margin-left:6px;transition:transform .2s;display:inline-block">⌄</span></button><div id="cl-body-${step.id}" class="cl-body" style="display:none">${step.note?`<div class="cl-note">💡 ${esc(step.note)}${step.id==='s2'?`<div style="margin-top:8px"><button class="btn btn-p btn-sm" onclick="copyBriefAndOpen()" style="font-size:11px">📋 Copy brief & open Blogging project</button></div>`:''}</div>`:''} ${step.items.map(item=>`<div class="cl-item${_clChecked[item.id]?' ck':''}"><div class="cl-cb" onclick="toggleClItem('${item.id}')" title="Mark as done">${_clChecked[item.id]?'✓':''}</div><span class="cl-text">${esc(item.text)}</span></div>`).join('')}</div></div>`;
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
function toggleClStep(id){
  CL_STEPS.forEach(s=>{
    const body=document.getElementById('cl-body-'+s.id);
    const arr=document.getElementById('cl-arr-'+s.id);
    if(s.id===id){
      const open=body?.style.display!=='none';
      if(body)body.style.display=open?'none':'block';
      if(arr)arr.style.transform=open?'rotate(0)':'rotate(180deg)';
    } else {
      if(body)body.style.display='none';
      if(arr)arr.style.transform='rotate(0)';
    }
  });
}
async function toggleClItem(itemId){
  if(!curPost)return;
  const wasAllDone=ALL_ITEM_IDS.every(id=>_clChecked[id]);
  const newVal=!_clChecked[itemId];_clChecked[itemId]=newVal;
  await sb.from('post_checklist').upsert({post_id:curPost,item_id:itemId,checked:newVal},{onConflict:'post_id,item_id'});
  const step=calcCurrentStep();
  await sb.from('posts').update({current_step:step}).eq('id',curPost);
  await loadPosts();

  // Check if a step just completed — auto-open next step
  const prevStepIdx=CL_STEPS.findIndex(s=>s.items.some(i=>i.id===itemId));
  if(newVal&&prevStepIdx>=0){
    const thisStep=CL_STEPS[prevStepIdx];
    const stepDone=thisStep.items.every(i=>_clChecked[i.id]);
    if(stepDone&&prevStepIdx<CL_STEPS.length-1){
      // Auto-open next step after re-render
      setTimeout(()=>{
        const nextId=CL_STEPS[prevStepIdx+1].id;
        toggleClStep(nextId);
      },150);
    }
  }

  renderChecklist();renderPosts();
  const nowAllDone=ALL_ITEM_IDS.every(id=>_clChecked[id]);
  if(!wasAllDone&&nowAllDone){const p=gp(curPost);celebrate(p?.primary_keyword||p?.title||'Post');checkMilestone();}
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
function showAddGsc(){document.getElementById('gsc-form').style.display='block';document.getElementById('gsc-date').value=localToday()}
function hideAddGsc(){document.getElementById('gsc-form').style.display='none'}
async function renderGscHistory(){
  if(!curPost)return;
  const{data}=await sb.from('gsc_positions').select('*').eq('post_id',curPost).order('recorded_date',{ascending:false});
  const rows=data||[];
  if(!rows.length){document.getElementById('gsc-tbody').innerHTML=`<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text3)">No rankings yet.</td></tr>`;return}
  document.getElementById('gsc-tbody').innerHTML=rows.map((r,i)=>{const pv=rows[i+1];let ch='—';if(pv&&r.position&&pv.position){const d=pv.position-r.position;ch=d>0?`<span class="pos-up">▲${d.toFixed(1)}</span>`:d<0?`<span class="pos-dn">▼${Math.abs(d).toFixed(1)}</span>`:'—'}
  const src=r.notes?.startsWith('SerpRobot')?'SerpRobot':r.notes?.startsWith('GSC')?'GSC':'Manual';
  const srcColor=src==='SerpRobot'?'var(--teal-d)':src==='GSC'?'var(--blue)':'var(--text3)';
  return`<tr><td>${fd(r.recorded_date)}</td><td style="font-weight:700">${r.position||'—'}</td><td>${r.impressions?.toLocaleString()||'—'}</td><td>${r.clicks?.toLocaleString()||'—'}</td><td>${ch}</td><td style="font-size:10px;font-weight:600;color:${srcColor}">${src}</td><td><button class="btn btn-danger btn-xs" onclick="delGsc('${r.id}')">✕</button></td></tr>`}).join('');
}
async function saveGsc(){
  const e={post_id:curPost,recorded_date:document.getElementById('gsc-date').value||localToday(),position:parseFloat(document.getElementById('gsc-pos').value)||null,impressions:parseInt(document.getElementById('gsc-impr').value)||null,clicks:parseInt(document.getElementById('gsc-clicks').value)||null,notes:document.getElementById('gsc-notes').value.trim()||null};
  if(!e.position){alert('Please enter a position.');return}
  await sb.from('gsc_positions').insert(e);
  ['gsc-pos','gsc-impr','gsc-clicks','gsc-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  hideAddGsc();renderGscHistory();renderDashRankings();toast('Ranking saved');
}
async function delGsc(id){await sb.from('gsc_positions').delete().eq('id',id);renderGscHistory()}

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
function copyBriefAndOpen(){
  const p=gp(curPost);if(!p)return;
  const supp=p.supplementary_keywords||'';
  const brief=`Blog: ${activeBlog==='esc'?'ESC Hub — eschub.com/blog':'No More Somedays — escapepreneur.com/blog'}
Primary keyword: ${p.primary_keyword||''}
KS Score: ${p.ks_score!=null?p.ks_score:'—'}
Monthly search volume: ${p.search_volume!=null?p.search_volume.toLocaleString():'—'}
${supp?`Secondary keywords: ${supp}`:''}
${p.unique_take?`Unique take / Karen's angle: ${p.unique_take}`:''}
${p.serp_notes?`SERP analysis doc: ${p.serp_notes}`:''}

Please generate the complete blog post package including: full article, meta title, meta description, URL slug, category, all Freepik image prompts with SEO filenames and alt text, featured image Canva brief, Canva template recommendation, Pinterest board recommendation, Instagram caption, Facebook caption, and Pinterest description.`;
  navigator.clipboard.writeText(brief).then(()=>{
    window.open(BLOGGING_PROJECT_URL,'_blank');
    toast('Brief copied — paste it into the new chat',3000);
  }).catch(()=>{
    window.open(BLOGGING_PROJECT_URL,'_blank');
    toast('Open the project and paste your brief manually',3000);
  });
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

function renderPlanning(){
  const isN=activeBlog==='nms';
  // PENDING REVIEW
  const reviewPosts=bp().filter(p=>p.status==='pending-review');
  const rvEl=document.getElementById('planning-review-list');
  if(rvEl){
    if(!reviewPosts.length){rvEl.innerHTML='<div style="font-size:12px;color:var(--green);padding:6px 0">✓ Nothing waiting for review.</div>'}
    else{rvEl.innerHTML=reviewPosts.map(p=>`
      <div class="post-row" style="border-left:3px solid var(--amber)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0">
            <div class="kw-primary">${esc(titleCase(p.primary_keyword)||titleCase(p.title)||'Untitled')}</div>
            ${p.serp_notes?`<div class="prk" style="margin-top:3px;font-style:italic">${esc(p.serp_notes.replace('NOTES:','').slice(0,80))}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-p btn-xs" onclick="event.stopPropagation();openApproveModal('${p.id}')">Review →</button>
            <button class="btn btn-xs" onclick="event.stopPropagation();openPost('${p.id}','details')">View</button>
          </div>
        </div>
      </div>`).join('')}
  }
  // RESEARCH QUEUE
  renderResearch();
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
