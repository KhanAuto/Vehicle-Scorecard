(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  const CANDIDATE_CACHE_KEY = "vehicleScorecardPhotoCandidatesV4";
  const SELECTED_CACHE_KEY = "vehicleScorecardSelectedPhotosV4";

  function readCache(key){ try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return{};} }
  function writeCache(key,value){ localStorage.setItem(key,JSON.stringify(value)); }
  function fieldsName(f={}){ return [f.year,f.make,f.model,f.trim].filter(Boolean).join(" "); }
  function photoKey(f={}){ return [f.year,f.make,f.model].filter(Boolean).join("|").toLowerCase(); }
  function modelTokens(f={}){ return String(f.model||"").toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>1); }
  function extractYears(text){ return (String(text||"").match(/\b(19|20)\d{2}\b/g)||[]).map(Number); }

  function scoreCandidate(title,fields){
    const text=String(title||"").toLowerCase();
    const wantedYear=Number(fields.year)||0;
    let score=0;
    const make=String(fields.make||"").toLowerCase();
    if(make&&text.includes(make)) score+=18;
    modelTokens(fields).forEach(token=>{ if(text.includes(token)) score+=14; });
    const years=extractYears(text);
    if(wantedYear){
      if(text.includes(String(wantedYear))) score+=45;
      if(years.length){
        const distance=Math.min(...years.map(y=>Math.abs(y-wantedYear)));
        score+=Math.max(-35,18-distance*12);
        if(distance>=4) score-=25;
      } else score-=6;
    }
    if(/front|rear|side|three.?quarter|wagon|sedan|coupe|suv|hatchback|vehicle|automobile|car/.test(text)) score+=4;
    if(/interior|engine|wheel|rim|logo|badge|emblem|diagram|drawing|wreck|crash|race|police|toy|model car/.test(text)) score-=35;
    return score;
  }

  async function commonsCandidates(fields={}){
    if(!fields.make||!fields.model) return [];
    const searches=[
      [fields.year,fields.make,fields.model].filter(Boolean).join(" "),
      [fields.make,fields.model,fields.year,"car"].filter(Boolean).join(" ")
    ];
    const all=[];
    for(const search of searches){
      const endpoint=new URL("https://commons.wikimedia.org/w/api.php");
      endpoint.search=new URLSearchParams({action:"query",generator:"search",gsrsearch:search,gsrnamespace:"6",gsrlimit:"35",prop:"imageinfo",iiprop:"url|mime",iiurlwidth:"960",origin:"*",format:"json"}).toString();
      try{
        const response=await fetch(endpoint.toString(),{mode:"cors",cache:"force-cache",credentials:"omit"});
        if(!response.ok) continue;
        const data=await response.json();
        Object.values(data.query?.pages||{}).forEach(page=>{
          const info=page.imageinfo?.[0];
          if(!String(info?.mime||"").startsWith("image/")) return;
          const url=info?.thumburl||info?.url||"";
          if(!url) return;
          all.push({url,title:page.title||"",score:scoreCandidate(page.title,fields)});
        });
      }catch{}
    }
    return all.sort((a,b)=>b.score-a.score).filter((item,index,list)=>list.findIndex(x=>x.url===item.url)===index);
  }

  async function wikipediaCandidates(fields={}){
    if(!fields.make||!fields.model) return [];
    const endpoint=new URL("https://en.wikipedia.org/w/api.php");
    endpoint.search=new URLSearchParams({action:"query",generator:"search",gsrsearch:[fields.make,fields.model].filter(Boolean).join(" "),gsrnamespace:"0",gsrlimit:"8",prop:"pageimages",piprop:"thumbnail|name",pithumbsize:"960",origin:"*",format:"json"}).toString();
    try{
      const response=await fetch(endpoint.toString(),{mode:"cors",cache:"force-cache",credentials:"omit"});
      if(!response.ok) return [];
      const data=await response.json();
      return Object.values(data.query?.pages||{}).map(page=>({url:page.thumbnail?.source||"",title:page.pageimage||page.title||"",score:scoreCandidate(`${page.title||""} ${page.pageimage||""}`,fields)-20})).filter(x=>x.url).sort((a,b)=>b.score-a.score);
    }catch{return[];}
  }

  async function getCandidates(fields={}){
    const key=photoKey(fields);
    if(!key) return [];
    const cached=readCache(CANDIDATE_CACHE_KEY);
    if(Array.isArray(cached[key])&&cached[key].length) return cached[key];
    let candidates=await commonsCandidates(fields);
    const wantedYear=Number(fields.year)||0;
    const exactOrNear=candidates.filter(c=>{
      const years=extractYears(c.title);
      return !wantedYear||!years.length||Math.min(...years.map(y=>Math.abs(y-wantedYear)))<=1;
    });
    if(exactOrNear.length) candidates=[...exactOrNear,...candidates.filter(c=>!exactOrNear.includes(c))];
    if(candidates.length<3) candidates=[...candidates,...await wikipediaCandidates(fields)];
    candidates=candidates.filter((item,index,list)=>item.url&&list.findIndex(x=>x.url===item.url)===index).slice(0,12);
    cached[key]=candidates;
    writeCache(CANDIDATE_CACHE_KEY,cached);
    return candidates;
  }

  function vehicleForCard(card){
    const id=card.dataset.vehicleId;
    if(id) return (APP.getSaved?.()||[]).find(v=>String(v.id)===String(id))||null;
    const title=card.querySelector(".v12-vehicle-title")?.textContent?.trim();
    return (APP.getSaved?.()||[]).find(v=>fieldsName(v.fields||{})===title)||null;
  }

  function renderImage(host,url,fields,key){
    const img=new Image();
    img.alt=`Representative ${fieldsName(fields)}`;
    img.decoding="async";
    img.loading="lazy";
    img.src=url;
    host.innerHTML="";
    host.appendChild(img);
    host.dataset.photoKey=key;
    host.dataset.photoUrl=url;
    return img;
  }

  function installPhoto(host,fields={}){
    const key=photoKey(fields);
    if(!host||!key) return;
    const selected=readCache(SELECTED_CACHE_KEY);
    const selectedUrl=selected[key];

    if(host.dataset.photoKey===key&&host.querySelector("img")) return;
    if(selectedUrl){
      const img=renderImage(host,selectedUrl,fields,key);
      img.onerror=()=>{ delete selected[key]; writeCache(SELECTED_CACHE_KEY,selected); host.dataset.photoKey=""; installPhoto(host,fields); };
      return;
    }

    host.innerHTML='<div class="v12-photo-loading">Finding model-year photo…</div>';
    getCandidates(fields).then(candidates=>{
      if(!host.isConnected) return;
      let index=0;
      const tryNext=()=>{
        if(index>=candidates.length){
          host.innerHTML='<div class="v122-photo-none"><img src="logo-mark.svg" alt=""><span>Representative photo unavailable</span></div>';
          host.dataset.photoKey=key;
          return;
        }
        const candidate=candidates[index++];
        const tester=new Image();
        tester.onload=()=>{
          if(!host.isConnected) return;
          const current=readCache(SELECTED_CACHE_KEY);
          current[key]=candidate.url;
          writeCache(SELECTED_CACHE_KEY,current);
          renderImage(host,candidate.url,fields,key);
        };
        tester.onerror=tryNext;
        tester.src=candidate.url;
      };
      tryNext();
    });
  }

  function enhanceCards(){
    document.querySelectorAll(".v12-vehicle-card").forEach(card=>{
      const vehicle=vehicleForCard(card);
      if(!vehicle) return;
      card.dataset.vehicleId=String(vehicle.id);
      installPhoto(card.querySelector(".v12-vehicle-photo"),vehicle.fields||{});
    });
    const hero=document.querySelector(".v12-hero-photo");
    if(hero) installPhoto(hero,APP.getVehicle?.()||{});
  }

  let queued=false;
  function refresh(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhanceCards();});
  }

  ["scorecard:core-ready","scorecard:dashboardrender","scorecard:vehiclechange","scorecard:pathchange"].forEach(name=>document.addEventListener(name,refresh));
  window.addEventListener("load",refresh,{once:true});
  setTimeout(refresh,100);
})();