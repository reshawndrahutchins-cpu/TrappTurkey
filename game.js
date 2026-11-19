/* =========================================================
   CONFIG
   ========================================================= */
const START_SECONDS = 45 * 60;   // total game clock
const HINT_COST_SECONDS = 120;   // "Ask Harrison" penalty
const MAX_WRONG = 3;

/* Answers are stored as hashes so students can't read them in View Source. */
function h(s){let x=2166136261; s='HT~'+s; for(let i=0;i<s.length;i++){x^=s.charCodeAt(i); x=Math.imul(x,16777619);} return (x>>>0).toString(36);}
function digits(s){return String(s).replace(/[^0-9]/g,'');}

/* =========================================================
   AUDIO: festive harvest jig + sound effects (Web Audio API)
   ========================================================= */
const Audio = (() => {
  let ctx=null, master=null, musicBus=null, sfxBus=null, noiseBuf=null;
  let schedId=null, step=0, nextTime=0, musicOn=true;
  const BPM=118, EIGHTH=60/BPM/2;

  // Original melody (midi, length in eighth notes). 16 bars, 8 eighths per bar. 0 = rest.
  const MEL=[
    [67,2],[71,1],[74,1],[79,2],[74,2],
    [76,2],[74,1],[72,1],[71,2],[69,2],
    [66,1],[69,1],[74,2],[72,1],[71,1],[69,2],
    [71,2],[67,2],[67,4],
    [71,1],[74,1],[76,2],[79,2],[76,2],
    [72,1],[76,1],[74,2],[72,2],[71,2],
    [69,2],[74,2],[78,2],[76,1],[78,1],
    [79,4],[0,2],[74,2],
    [72,2],[76,2],[79,3],[76,1],
    [74,2],[71,2],[67,4],
    [69,1],[72,1],[76,2],[74,1],[72,1],[69,2],
    [66,2],[69,2],[74,4],
    [76,1],[74,1],[72,2],[76,1],[74,1],[72,2],
    [71,1],[74,1],[79,2],[78,1],[76,1],[74,2],
    [72,2],[71,2],[69,2],[66,2],
    [67,6],[0,2]
  ];
  const CH={G:{r:43,t:[55,59,62]},C:{r:48,t:[55,60,64]},D:{r:50,t:[57,62,66]},Em:{r:40,t:[55,59,64]},Am:{r:45,t:[57,60,64]}};
  const PROG=['G','C','D','G','Em','C','D','G','C','G','Am','D','C','G','D','G'];
  const STEPS=PROG.length*8;
  const song=Array.from({length:STEPS},()=>[]);
  (function build(){
    let s=0; for(const [m,l] of MEL){ if(m) song[s].push({t:'mel',m,l}); s+=l; }
    PROG.forEach((c,bar)=>{
      const b=bar*8, ch=CH[c];
      song[b].push({t:'bass',m:ch.r,l:3});
      song[b+4].push({t:'bass',m:ch.r+7,l:3});
      [2,6].forEach(o=>ch.t.forEach(n=>song[b+o].push({t:'chord',m:n,l:1.4})));
    });
    for(let i=0;i<STEPS;i++) song[i].push({t:'shk',acc:i%2===1});
  })();

  const f=m=>440*Math.pow(2,(m-69)/12);
  function tone(m,t,dur,type,vol,dest,attack=0.012){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(f(m),t);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+attack);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t+dur+0.05);
  }
  function noise(t,dur,vol,freq,dest){
    const s=ctx.createBufferSource(); s.buffer=noiseBuf;
    const fl=ctx.createBiquadFilter(); fl.type='highpass'; fl.frequency.value=freq;
    const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(fl).connect(g).connect(dest); s.start(t); s.stop(t+dur+0.02);
  }
  function playStep(i,t){
    for(const e of song[i]){
      if(e.t==='mel'){ tone(e.m,t,e.l*EIGHTH*0.95,'triangle',0.22,musicBus); tone(e.m+12,t,e.l*EIGHTH*0.6,'sine',0.04,musicBus); }
      else if(e.t==='bass') tone(e.m,t,e.l*EIGHTH,'triangle',0.28,musicBus,0.008);
      else if(e.t==='chord') tone(e.m,t,e.l*EIGHTH,'square',0.025,musicBus,0.005);
      else if(e.t==='shk') noise(t,0.05,e.acc?0.05:0.022,6000,musicBus);
    }
  }
  function scheduler(){
    while(nextTime < ctx.currentTime + 0.12){
      playStep(step,nextTime); nextTime+=EIGHTH; step=(step+1)%STEPS;
    }
  }
  return {
    init(){
      if(ctx) return;
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      ctx=new AC();
      master=ctx.createGain(); master.gain.value=0.55; master.connect(ctx.destination);
      musicBus=ctx.createGain(); musicBus.gain.value=0.8; musicBus.connect(master);
      sfxBus=ctx.createGain(); sfxBus.gain.value=1; sfxBus.connect(master);
      noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.1,ctx.sampleRate);
      const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    },
    startMusic(){ if(!ctx||schedId||!musicOn) return; if(ctx.state==='suspended') ctx.resume(); step=0; nextTime=ctx.currentTime+0.1; schedId=setInterval(scheduler,25); },
    stopMusic(){ if(schedId){clearInterval(schedId); schedId=null;} },
    toggle(){ musicOn=!musicOn; musicOn?this.startMusic():this.stopMusic(); return musicOn; },
    setVol(v){ if(master) master.gain.value=v; },
    unlock(){ if(!ctx) return; const t=ctx.currentTime; noise(t,0.06,0.4,1500,sfxBus); noise(t+0.09,0.05,0.35,2500,sfxBus);
      [79,83,86,91].forEach((m,i)=>tone(m,t+0.18+i*0.09,0.5,'triangle',0.25,sfxBus)); },
    wrong(){ if(!ctx) return; const t=ctx.currentTime; tone(50,t,0.25,'square',0.12,sfxBus); tone(45,t+0.22,0.4,'square',0.12,sfxBus); },
    hint(){ if(!ctx) return; const t=ctx.currentTime; tone(84,t,0.3,'sine',0.15,sfxBus); tone(88,t+0.1,0.4,'sine',0.12,sfxBus); },
    win(){ if(!ctx) return; this.stopMusic(); const t=ctx.currentTime;
      [67,71,74,79,74,79].forEach((m,i)=>tone(m,t+i*0.14,0.35,'triangle',0.28,sfxBus));
      [55,59,62,67,71].forEach(m=>tone(m,t+0.9,1.8,'triangle',0.12,sfxBus)); },
    lose(){ if(!ctx) return; this.stopMusic(); const t=ctx.currentTime;
      [62,61,60].forEach((m,i)=>tone(m,t+i*0.38,0.36,'sawtooth',0.09,sfxBus));
      tone(59,t+1.14,1.2,'sawtooth',0.09,sfxBus); }
  };
})();

/* =========================================================
   VISUALS
   ========================================================= */
function censusChart(){
  const data=[20,32,52,85,135,205,285,360,430,455,420,380,395,410,400];
  const W=660,H=360,L=64,R=20,T=36,B=56, pw=W-L-R, ph=H-T-B;
  const x=i=>L+i*pw/14, y=v=>T+ph-(v/500)*ph;
  let g='';
  for(let v=0;v<=500;v+=50){
    const major=v%100===0;
    g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="grid${major?'':' minor'}"/>`;
    if(major) g+=`<text x="${L-10}" y="${y(v)+4}" text-anchor="end" class="axl">${v}</text>`;
  }
  for(let i=0;i<=14;i+=1) g+=`<text x="${x(i)}" y="${H-B+20}" text-anchor="middle" class="axl">${i}</text>`;
  g+=`<line x1="${L}" x2="${L}" y1="${T}" y2="${T+ph}" class="axis"/><line x1="${L}" x2="${W-R}" y1="${T+ph}" y2="${T+ph}" class="axis"/>`;
  const path=data.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
  const dots=data.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="5" class="dot"><title>Year ${i}: ${v} turkeys</title></circle>`).join('');
  g+=`<text x="${L+pw/2}" y="${H-12}" text-anchor="middle" class="axt">Years since introduction</text>`;
  g+=`<text transform="translate(18,${T+ph/2}) rotate(-90)" text-anchor="middle" class="axt">Wild turkey population (individuals)</text>`;
  g+=`<text x="${L}" y="20" class="axt" fill="#e8b44a">G.O.B.B.L.E. CENSUS · Hutchins-Trapp Island · Meleagris gallopavo</text>`;
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Line graph of the wild turkey population over 14 years. It starts at 20 birds, rises slowly, then rapidly, peaks at 455 in year 9, falls to 380 in year 11, then settles near 400.">${g}<path d="${path}" class="line"/>${dots}</svg></div>`;
}

function pyramid(w,color){
  const W=200,H=170,rowH=16,cx=100,base=H-22; let s='';
  w.forEach((v,i)=>{
    const yy=base-(i+1)*rowH, half=v*0.82;
    s+=`<rect x="${cx-half}" y="${yy}" width="${half-1.5}" height="${rowH-3}" rx="2" fill="${color}"/>`;
    s+=`<rect x="${cx+1.5}" y="${yy}" width="${half-1.5}" height="${rowH-3}" rx="2" fill="${color}" opacity=".65"/>`;
  });
  s+=`<line x1="${cx}" x2="${cx}" y1="${base-8*rowH-4}" y2="${base}" class="axis"/>`;
  s+=`<text x="4" y="${base-8*rowH+8}" class="axl" style="font-size:10px">80+</text>`;
  s+=`<text x="4" y="${base-4}" class="axl" style="font-size:10px">0–9</text>`;
  s+=`<text x="${cx-6}" y="${H-6}" text-anchor="end" class="axl" style="font-size:10px">Male</text>`;
  s+=`<text x="${cx+6}" y="${H-6}" class="axl" style="font-size:10px">Female</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="pyr" role="img" aria-label="Age structure diagram">${s}</svg>`;
}

/* =========================================================
   PUZZLES
   ========================================================= */
const HARRISON='<b>Harrison Hutchins-Trapp:</b>';
const GOBBLE='<b>G.O.B.B.L.E.:</b>';

const PUZZLES=[
/* ---------- LOCK 1 ---------- */
{
  room:'Lock 1 of 4 · The Heritage Corn Greenhouse',
  title:'The Harvest Ledger',
  unit:'Unit 1 · Primary productivity, trophic levels & the 10% rule',
  type:'text', placeholder:'Access code (kcal)',
  hash:'17myf5x',
  html:()=>`
    <div class="story">
      <p>The first steel door, between the dining hall and the estate's <b>Heritage Corn Greenhouse</b>, has a glowing amber keypad. Above it, G.O.B.B.L.E.'s screen brings up a document.</p>
    </div>
    <div class="terminal">
      <div class="hdr">HUTCHIND-TRAPP ESTATE · CLOSED-LOOP FOOD CHAIN AUDIT</div>
      <div class="row">🌽 This season the greenhouse corn captured solar energy at a <b>Gross Primary Productivity (GPP) of 3,200,000 kcal</b>.</div>
      <div class="row">🔥 The corn used <b>1,200,000 kcal</b> of that energy for its own <b>cellular respiration</b>.</div>
      <div class="row">🦃 All remaining plant energy was fed to the estate's heritage turkeys.</div>
      <div class="row">🍽️ The turkeys were then served to tonight's dinner guests.</div>
      <div class="row warn">⚠️ Assume standard ecological efficiency between each trophic level.</div>
      <div class="prompt">ENTER ACCESS CODE: THE KILOCALORIES AVAILABLE TO TONIGHT'S DINNER GUESTS.</div>
    </div>
    <div class="say">${HARRISON} "My nephew always told me, 'Uncle Harrison, energy isn't recycled, it <i>flows</i>.' I never knew what he meant…"</div>`,
  specific:{
    '3200000':`${GOBBLE} "That is the energy the corn <i>captured</i>. Has any of it been spent before a turkey takes a bite?"`,
    '2000000':`${GOBBLE} "Correct net primary productivity, Doctor. That is what the corn <i>stored</i>. But I asked about the guests. How many trophic levels up are they?"`,
    '200000':`${GOBBLE} "That is how much energy reached the <i>turkeys</i>. The guests are one more step up the pyramid."`,
    '320000':`${GOBBLE} "You applied the 10% rule to the gross productivity. Can a turkey eat energy the corn already burned in respiration?"`,
    '32000':`${GOBBLE} "Your transfers look right, but your starting point does not. Gross or net: which one is available to consumers?"`,
    '2000':`${GOBBLE} "Count the hand-offs again: corn → turkey → guests. How many arrows is that?"`
  },
  hints:[
    `${GOBBLE} "Not all the sunlight the corn captured is available to a turkey. What does a plant spend on itself first, and what do ecologists call what's left over?"`,
    `${HARRISON} "My nephew said only about a <i>tenth</i> of the energy makes it up each step and the rest is lost as heat. How many steps are there between the corn and the people at this table?"`,
    `${GOBBLE} "Work in order. NPP = GPP − respiration. Then apply roughly 10% at each transfer. Producer → primary consumer → secondary consumer. Which level are the guests?"`
  ],
  success:`
    <p><b>CLICK.</b> The amber keypad turns green. Heavy bolts slide back, and the greenhouse door hisses open on warm air that smells of damp soil and cornstalks.</p>
    <div class="lab"><b>Lab note:</b> NPP = GPP − R = 3,200,000 − 1,200,000 = <b>2,000,000 kcal</b>. Turkeys (primary consumers) get ~10% = 200,000 kcal. Guests (secondary consumers) get ~10% of that = <b>20,000 kcal</b>. The other ~90% at each step leaves as heat from metabolism, which is why energy <i>flows</i> through an ecosystem and is never recycled.</div>
    <p>At the far end of the greenhouse, past rows of drying corn, a second door leads into the dome's <b>Forest Wing</b>. Something on the other side is gobbling.</p>`
},
/* ---------- LOCK 2 ---------- */
{
  room:'Lock 2 of 4 · The Forest Wing',
  title:'The Wild Turkey Census',
  unit:'Unit 3 · Population growth & carrying capacity (data interpretation)',
  type:'text', placeholder:'Carrying capacity (K)',
  hash:'1v28g57',
  check:v=>{const n=parseInt(digits(v),10); return !isNaN(n) && h(String(Math.round(n/50)*50))===PUZZLES[1].hash;},
  html:()=>`
    <div class="story">
      <p>The Forest Wing is a dim strip of temperate deciduous forest under the glass: oaks, hickories, and leaf litter crunching underfoot. Fourteen years ago, Harrison released <b>20 wild turkeys</b> here. G.O.B.B.L.E. has counted them every year since.</p>
      <p>A screen bolted to an old oak lights up with a graph. <em>(Hover or tap a point to read its value.)</em></p>
    </div>
    ${censusChart()}
    <div class="terminal"><div class="prompt">ENTER THE CARRYING CAPACITY (K) OF HUTCHIND-TRAPP ISLAND FOR WILD TURKEYS.</div></div>
    <div class="say">${HARRISON} "Year nine was <i>glorious</i>. Turkeys everywhere! Year eleven was… less glorious."</div>`,
  specific:{
    '455':`${GOBBLE} "That was the population's highest point. Was that number <i>sustainable</i>? Look at what happened in the next two years."`,
    '460':`${GOBBLE} "That is the peak region. When a population rises past what its resources can support, what usually follows?"`,
    '500':`${GOBBLE} "The graph's axis ends at 500. The turkeys never reached it. Where did the population actually settle?"`,
    '20':`${GOBBLE} "That is the founding population, N₀. Carrying capacity is about where a population <i>ends up</i>, not where it starts."`,
    '380':`${GOBBLE} "That is the dip after the crash. Where does the population sit between its highs and lows?"`,
    '360':`${GOBBLE} "One data point doesn't define K. Look at the long-run pattern in the final years."`
  },
  hints:[
    `${GOBBLE} "Look at the shape: slow growth, then explosive growth, then leveling off. Which growth model is this? What does the horizontal line it levels toward represent?"`,
    `${HARRISON} "We ran out of acorns after year nine, you know. Can a population briefly <i>exceed</i> what its resources support? What happens to it afterward?"`,
    `${GOBBLE} "Picture a horizontal line through the middle of the wobble in years 9–14, where the population rises above and falls below. At what value does that line sit?"`
  ],
  success:`
    <p><b>CLUNK.</b> The oak's screen flashes <b>K ACCEPTED</b>, and a door hidden in the trunk (Harrison likes theatrics) swings open.</p>
    <div class="lab"><b>Lab note:</b> This is a <b>logistic (S-shaped) growth curve</b>. The population grew slowly at first (lag), then exponentially, then <b>overshot</b> K (455 in year 9). Resources ran out, causing a <b>die-off</b> (380 in year 11), and the population then oscillated around the <b>carrying capacity, K ≈ 400 turkeys</b>. Density-dependent factors such as food (acorns), disease, and competition hold it there.</div>
    <p>Beyond the door the air smells of old smoke. You've reached the estate's <b>Burnt Orchard</b>.</p>`
},
/* ---------- LOCK 3 ---------- */
{
  room:'Lock 3 of 4 · The Burnt Orchard',
  title:'The Succession Sequence',
  unit:'Unit 2 · Ecological succession & natural disruptions',
  type:'order',
  hash:'1fofyil',
  plants:[
    {id:'s',ico:'🫐',txt:'Woody shrubs: sumac, blackberry brambles'},
    {id:'o',ico:'🌳',txt:'Shade-tolerant oak–hickory hardwood forest'},
    {id:'w',ico:'🌱',txt:'Annual weeds & grasses: crabgrass, ragweed (tiny seeds, short lives)'},
    {id:'p',ico:'🌲',txt:'Fast-growing, sun-loving pine saplings'},
    {id:'g',ico:'🌼',txt:'Perennial grasses & wildflowers: goldenrod, asters'}
  ],
  html:()=>`
    <div class="story">
      <p>Last October, a lightning strike (or, by some accounts, a candle Harrison left burning during a "harvest séance") swept through the estate's old apple orchard. The trees are charred stumps now. But the <b>soil survived</b>, along with buried seeds and roots.</p>
      <p>G.O.B.B.L.E. projects five shimmering holograms of plant communities over the ash. A voice fills the orchard:</p>
    </div>
    <div class="terminal"><div class="prompt">ARRANGE THE COMMUNITIES IN THE ORDER THEY WILL DOMINATE THIS SITE AS IT RECOVERS, FROM FIRST TO LAST.</div></div>
    <div class="say">${HARRISON} "I miss my apples. But my nephew says forests know how to heal themselves… in a particular order."</div>
    <p style="margin:6px 0 0;font-size:.85rem;color:var(--muted)">Tap the cards to place them in the slots. Tap a filled slot to remove it.</p>
    <div class="cards" id="plantCards"></div>
    <div class="arrow-row"><span>◀ First to arrive</span><span>Final community ▶</span></div>
    <div class="slots" id="slots"></div>`,
  specific:{},
  hints:[
    `${GOBBLE} "The fire burned the plants but left the soil. Which species move in first after a disturbance: large, slow-growing, long-lived ones, or small, fast, r-selected pioneers that scatter thousands of tiny seeds?"`,
    `${HARRISON} "Each group of plants changes the place for the next one: more shade, deeper soil, more moisture. Woody shrubs need deeper soil than the earliest weeds can build. Where do they fit between grasses and trees?"`,
    `${GOBBLE} "Pine seedlings need full sun. Once the pine canopy closes, which tree seedlings can still grow in the shade beneath it? That is your <i>climax community</i>."`
  ],
  success:`
    <p><b>WHOOSH.</b> The holograms slide into a line and bloom one after another, like a time-lapse of fifty years. Behind them, the orchard's stone gate grinds open.</p>
    <div class="lab"><b>Lab note:</b> Because soil remained, this is <b>secondary succession</b>, which is faster than primary succession on bare rock. Order: <b>annual weeds → perennial grasses & wildflowers → shrubs → pines → oak–hickory climax forest</b>. The early r-selected pioneers build soil and change conditions. The sun-loving pines eventually shade out their own seedlings, so shade-tolerant hardwoods take over. A fire like this is a <b>natural disruption</b> that resets succession and can <b>increase</b> biodiversity over time.</div>
    <p>The gate leads to the last room: <b>Harrison's private study</b>, where the master override sits in a safe.</p>`
},
/* ---------- LOCK 4 ---------- */
{
  room:'Lock 4 of 4 · Harrison\'s Study',
  title:'The Demographic Vault',
  unit:'Unit 3 · Demographic Transition Model, TFR & age structure',
  type:'text', placeholder:'4-digit vault code',
  hash:'mrbyvj',
  nations:[
    {seat:1,nation:'Brevonia',guest:'Lady Pemberton-Gourd, shipping heiress',cbr:22,cdr:8,tfr:2.6,inf:24,w:[70,73,70,64,55,44,31,16],c:'#e07a2f'},
    {seat:2,nation:'Kestrel Isles',guest:'Mr. Okonjo-Ash, cranberry magnate',cbr:44,cdr:38,tfr:6.6,inf:142,w:[100,76,56,40,28,18,10,4],c:'#c4334a'},
    {seat:3,nation:'Valdmark',guest:'Dr. Linnea Stout, gravy futures trader',cbr:10,cdr:10,tfr:1.7,inf:3,w:[54,56,59,61,61,58,51,38],c:'#8fb27a'},
    {seat:4,nation:'Ombara',guest:'Count Basilio Yam, crypto-farmer',cbr:41,cdr:12,tfr:5.7,inf:58,w:[100,88,75,61,47,33,20,9],c:'#e8b44a'}
  ],
  html:()=>`
    <div class="story">
      <p>Harrison's study is all mahogany, taxidermied pheasants, and a framed photo of him hugging a manatee. Behind the desk is a <b>steel vault</b> with a four-digit dial. Inside is the <b>master override</b>.</p>
      <p>Four of tonight's guests have followed you in. G.O.B.B.L.E. scans their passports and shows each home nation's demographic profile.</p>
    </div>
    <div class="passports">
      ${PUZZLES[3].nations.map(n=>`
        <div class="passport">
          <div class="seat">SEAT ${n.seat}</div>
          <div class="nation">${n.nation}</div>
          <div class="guest">${n.guest}</div>
          <table>
            <tr><td>Crude birth rate</td><td>${n.cbr} / 1,000</td></tr>
            <tr><td>Crude death rate</td><td>${n.cdr} / 1,000</td></tr>
            <tr><td>Total fertility rate</td><td>${n.tfr}</td></tr>
            <tr><td>Infant mortality</td><td>${n.inf} / 1,000</td></tr>
          </table>
          ${pyramid(n.w,n.c)}
        </div>`).join('')}
    </div>
    <div class="terminal"><div class="prompt">VAULT CODE: THE DEMOGRAPHIC TRANSITION MODEL STAGE (1–4) OF EACH GUEST'S NATION, IN SEAT ORDER 1 → 4.</div></div>
    <div class="say">${HARRISON} "I set this one after reading a book on the airplane. Something about birth rates, death rates, and the whole <i>arc</i> of a nation…"</div>`,
  specific:{
    '1234':`${GOBBLE} "That is simply counting, Doctor. The guests are not seated in DTM order. Check each nation's data on its own."`,
    '4321':`${GOBBLE} "Reversing the order won't help. Judge each passport separately."`
  },
  hints:[
    `${GOBBLE} "Start with the gap between birth rate and death rate for each nation. Which nation has both rates high and nearly equal? What would its population growth look like?"`,
    `${HARRISON} "In the model, which drops first as a country develops, births or deaths? Think about food supply, clean water, and vaccines. What do you call a nation with low deaths but still-high births?"`,
    `${GOBBLE} "Use the age-structure shapes too. A wide base means many young people, and a column means births ≈ deaths. As education and urbanization rise and children become costly to raise, TFR falls toward replacement (~2.1). Which stage is that?"`
  ],
  success:`
    <p><b>KA-CHUNK.</b> The dial spins on its own, the vault door swings wide, and inside, on a velvet cushion, sits a glowing <b>master override key</b> shaped like a drumstick.</p>
    <div class="lab"><b>Lab note:</b> Seat 1, Brevonia: <b>Stage 3</b> (birth rate falling, TFR nearing replacement, narrowing base). Seat 2, Kestrel Isles: <b>Stage 1</b> (high CBR and CDR, little growth, steep pyramid). Seat 3, Valdmark: <b>Stage 4</b> (low CBR = low CDR, TFR below replacement, column shape). Seat 4, Ombara: <b>Stage 2</b> (CDR has dropped while CBR stays high, so the population is booming and the pyramid has a wide base). Code: <b>3-1-4-2</b>.</div>`
}
];

/* =========================================================
   GAME STATE & FLOW
   ========================================================= */
const S={lock:0,wrong:0,hintIdx:0,secs:START_SECONDS,timerId:null,over:false,order:[],hintsUsed:0};
const $=sel=>document.querySelector(sel);
const screen=$('#screen');

function fmt(s){s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function foodLine(s){
  const m=s/60;
  if(m>=40) return '🦃 The turkey is resting. The gravy is glossy. All is well… for now.';
  if(m>=30) return '🥧 The pumpkin pie has begun to weep, just slightly.';
  if(m>=20) return '🍠 The sweet potato soufflé is trembling.';
  if(m>=10) return '🫙 The cranberry sauce is forming a skin. Oxygen scrubbers at 40%.';
  if(m>=5)  return '⚠️ The dinner rolls are going stale. Oxygen scrubbers at 15%.';
  return '🚨 The soufflé is collapsing! The cranberry sauce is turning to rock!';
}
function updateHUD(){
  $('#locks').textContent=Array.from({length:4},(_,i)=>i<S.lock?'🔓':'🔒').join('');
  $('#lives').textContent=Array.from({length:MAX_WRONG},(_,i)=>i<S.wrong?'❌':'🥧').join('');
  const t=$('#timer'); t.textContent=fmt(S.secs); t.classList.toggle('urgent',S.secs<600);
  $('#foodStatus').textContent=`${4-S.lock} lock${4-S.lock===1?'':'s'} remaining · ${foodLine(S.secs)}`;
}
function tick(){
  if(S.over) return;
  S.secs--; updateHUD();
  if(S.secs<=0) lose('time');
}

function renderIntro(){
  screen.innerHTML=`
    <section class="card">
      <div class="kicker">An AP Environmental Science Escape Room</div>
      <h1>The Turkey Day <span class="accent">Trophic Trap</span></h1>
      <div class="story">
        <p><em>The lights flicker. Above you, a ventilation fan coughs, whines, and dies.</em></p>
        <p>Good evening, Doctor.</p>
        <p>You arrived at the <b>Hutchins-Trapp Biodome Estate</b> by seaplane three hours ago. It's a glittering glass dome on a lonely Atlantic island that holds a small world of its own: temperate deciduous forest under the eastern panes, freshwater marsh to the west, and in the center, under a chandelier made of recycled kelp, a <b>Thanksgiving table set for twelve</b>.</p>
        <p>Your host, eccentric billionaire conservationist <b>Harrison Hutchins-Trapp</b>, had just raised his glass of locally fermented cider.</p>
        <div class="say">${HARRISON} "To the trophic pyramid! Without which none of us would be eating tonight!"</div>
        <p>Then the dome's AI, a calm voice called <b>G.O.B.B.L.E.</b> (<i>Global Oversight of Biodome Biometric Locks &amp; Environment</i>), spoke:</p>
        <div class="say ai">${GOBBLE} "CONTAINMENT. PROTOCOL. ENGAGED."</div>
        <p>Steel shutters slammed over every exit. The oxygen scrubbers dropped to emergency power.</p>
        <div class="say">${HARRISON} "Oh no. No, no, no. I programmed G.O.B.B.L.E. to open the doors only for someone who <i>truly understands ecology</i>. It was supposed to be a party game! Doctor, you're the only real scientist here. Everyone else is a venture capitalist."</div>
        <p>A man in a fleece vest near the gravy boat begins to cry quietly.</p>
      </div>
      <h3>How to escape</h3>
      <ul>
        <li>Open <b>4 biometric locks</b> in sequence, each guarded by an APES puzzle (Units 1–3).</li>
        <li>You have <b>45 minutes</b> before the feast is ruined and the oxygen runs out.</li>
        <li>You may make only <b>3 wrong guesses in total</b>. Each wrong answer earns you a hint.</li>
        <li>Stuck? <b>Ask Harrison</b> for a hint, but it costs 2 minutes.</li>
        <li>Keep scratch paper and a calculator nearby. Show your work, and G.O.B.B.L.E. will respect you more.</li>
      </ul>
      <div class="center" style="margin-top:20px">
        <button class="primary" id="beginBtn" style="font-size:1.1rem;padding:14px 26px">🦃 Enter the Dining Hall</button>
        <p style="font-size:.8rem;color:var(--muted);margin-top:8px">🎵 Turn your sound on. Festive harvest music starts when you enter, and you can mute it at the top of the screen.</p>
      </div>
    </section>`;
  $('#beginBtn').onclick=startGame;
}

function startGame(){
  Audio.init(); Audio.setVol($('#vol').value/100); Audio.startMusic();
  Object.assign(S,{lock:0,wrong:0,hintIdx:0,secs:START_SECONDS,over:false,order:[],hintsUsed:0});
  $('#hud').hidden=false; updateHUD();
  clearInterval(S.timerId); S.timerId=setInterval(tick,1000);
  renderPuzzle();
}

function renderPuzzle(){
  const P=PUZZLES[S.lock]; S.hintIdx=0; S.order=[];
  screen.innerHTML=`
    <section class="card" id="pcard">
      <div class="kicker">${P.room}</div>
      <h2>${P.title}</h2>
      <span class="unit-tag">${P.unit}</span>
      ${P.html()}
      ${P.type==='text'
        ? `<form class="answer" id="ansForm" autocomplete="off">
             <input id="ans" placeholder="${P.placeholder}" aria-label="${P.placeholder}">
             <button class="primary" type="submit">Submit ▶</button>
           </form>`
        : `<div class="answer"><button class="ghost" id="resetOrder" type="button">↺ Reset</button><button class="primary" id="submitOrder" type="button" disabled>Submit sequence ▶</button></div>`}
      <div class="toolbar">
        <button class="small ghost" id="askBtn" type="button">🎩 Ask Harrison for a hint (−2 min)</button>
      </div>
      <div id="log"></div>
    </section>`;
  if(P.type==='text'){
    $('#ansForm').onsubmit=e=>{e.preventDefault(); const v=$('#ans').value.trim(); if(v) submit(v);};
    $('#ans').focus();
  } else setupOrder(P);
  $('#askBtn').onclick=askHarrison;
  window.scrollTo({top:0,behavior:'smooth'});
}

function setupOrder(P){
  const draw=()=>{
    $('#plantCards').innerHTML=P.plants.map(p=>`<button type="button" class="plant${S.order.includes(p.id)?' used':''}" data-id="${p.id}"><span class="ico">${p.ico}</span>${p.txt}</button>`).join('');
    $('#slots').innerHTML=Array.from({length:5},(_,i)=>{
      const id=S.order[i], p=P.plants.find(x=>x.id===id);
      return `<div class="slot${p?' filled':''}" data-i="${i}" role="button" tabindex="0"><span class="n">${i+1}</span>${p?`<span style="font-size:1.3rem">${p.ico}</span>${p.txt.split(':')[0]}`:'—'}</div>`;
    }).join('');
    document.querySelectorAll('.plant').forEach(b=>b.onclick=()=>{ if(S.order.length<5){S.order.push(b.dataset.id); draw();} });
    document.querySelectorAll('.slot.filled').forEach(s=>s.onclick=()=>{ S.order.splice(+s.dataset.i,1); draw(); });
    $('#submitOrder').disabled=S.order.length<5;
  };
  draw();
  $('#resetOrder').onclick=()=>{S.order=[]; draw();};
  $('#submitOrder').onclick=()=>submit(S.order.join(''));
}

function say(html,cls=''){
  const d=document.createElement('div'); d.className='say msg '+cls; d.innerHTML=html;
  const log=$('#log'); log.prepend(d);
}

function nextHint(){
  const P=PUZZLES[S.lock]; const hnt=P.hints[Math.min(S.hintIdx,P.hints.length-1)]; S.hintIdx++; return hnt;
}

function askHarrison(){
  if(S.over) return;
  S.secs=Math.max(1,S.secs-HINT_COST_SECONDS); S.hintsUsed++; updateHUD(); Audio.hint();
  say(`<span style="font-size:.75rem;color:var(--muted)">⏳ −2 minutes</span><br>${nextHint()}`);
}

function submit(v){
  if(S.over) return;
  const P=PUZZLES[S.lock];
  const ok = P.check ? P.check(v) : (P.type==='order' ? h(v)===P.hash : h(digits(v))===P.hash);
  if(ok) return solved();
  S.wrong++; updateHUD(); Audio.wrong();
  const card=$('#pcard'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  if(S.wrong>=MAX_WRONG) return lose('guesses');
  const left=MAX_WRONG-S.wrong;
  const key=P.type==='order'?null:digits(v);
  const specific=key&&P.specific[key];
  say(`<b style="color:var(--cran)">ACCESS DENIED.</b> <span style="color:var(--muted)">${left} wrong guess${left===1?'':'es'} remaining before the feast is ruined.</span><br>${specific||nextHint()}`,'ai');
  if(P.type==='text'){ $('#ans').select(); }
}

function solved(){
  const P=PUZZLES[S.lock];
  S.lock++; updateHUD(); Audio.unlock();
  if(S.lock>=PUZZLES.length){ screen.innerHTML=`<section class="card">${P.success}<div class="center"><button class="primary" id="go">🗝️ Insert the override key</button></div></section>`; $('#go').onclick=win; return; }
  screen.innerHTML=`
    <section class="card">
      <div class="kicker">🔓 Lock ${S.lock} of 4 open</div>
      <h2>${P.title}: Solved!</h2>
      <div class="story">${P.success}</div>
      <div class="center"><button class="primary" id="go">Continue ▶</button></div>
    </section>`;
  $('#go').onclick=renderPuzzle;
  window.scrollTo({top:0,behavior:'smooth'});
}

function win(){
  S.over=true; clearInterval(S.timerId); Audio.win(); updateHUD();
  screen.innerHTML=`
    <section class="card center">
      <div class="big-emoji">🦃🎉🥧</div>
      <h1>You <span class="accent">Escaped!</span></h1>
      <div class="story" style="text-align:left">
        <p>The drumstick key slides into the master console. G.O.B.B.L.E.'s voice softens:</p>
        <div class="say ai">${GOBBLE} "Ecological literacy confirmed. Containment protocol… disengaged. Happy Thanksgiving, Doctor."</div>
        <p>Every shutter in the dome rolls up together. Fresh Atlantic air pours in and the oxygen scrubbers hum back to life. In the dining hall, the sweet potato soufflé is <i>still standing</i>.</p>
        <div class="say">${HARRISON} "Magnificent! You must stay for dinner. And for the rest of your career, honestly. I'm naming the new wetland preserve after you."</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Time remaining</div><div class="v">${fmt(S.secs)}</div></div>
        <div class="stat"><div class="k">Wrong guesses</div><div class="v">${S.wrong} / ${MAX_WRONG}</div></div>
        <div class="stat"><div class="k">Hints bought</div><div class="v">${S.hintsUsed}</div></div>
      </div>
      <h3>Concepts mastered</h3>
      <ul class="mastered">
        <li>🌽 <b>Unit 1:</b> GPP vs. NPP and the 10% rule across trophic levels</li>
        <li>🦃 <b>Unit 3:</b> Logistic growth, overshoot, die-off, and carrying capacity (K)</li>
        <li>🌲 <b>Unit 2:</b> Secondary succession from pioneer species to climax community</li>
        <li>🌍 <b>Unit 3:</b> The Demographic Transition Model, TFR, and age-structure diagrams</li>
      </ul>
      <button class="primary" id="again">Play again</button>
    </section>`;
  $('#again').onclick=()=>{ Audio.startMusic(); startGame(); };
}

function lose(reason){
  S.over=true; clearInterval(S.timerId); Audio.lose(); updateHUD();
  const why = reason==='time'
    ? `The clock hits <b>00:00</b>. The sweet potato soufflé folds in on itself with a sad little <i>pfft</i>. The cranberry sauce has hardened into rock. The oxygen scrubbers click off.`
    : `A third <b>ACCESS DENIED</b> echoes through the dome. Somewhere in the dining hall, the sweet potato soufflé collapses. The gravy develops a skin thick enough to walk on.`;
  screen.innerHTML=`
    <section class="card center">
      <div class="big-emoji">🥀🍠💨</div>
      <h1>The Feast Is <span class="accent">Ruined</span></h1>
      <div class="story" style="text-align:left">
        <p>${why}</p>
        <div class="say ai">${GOBBLE} "Insufficient ecological literacy detected. Initiating backup protocol: <i>ordering takeout</i>. Estimated delivery to a remote island: three to five business days."</div>
        <div class="say">${HARRISON} "Well… I suppose there's always the compost pile. Lovely nitrogen cycling in there."</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Locks opened</div><div class="v">${S.lock} / 4</div></div>
        <div class="stat"><div class="k">Time left</div><div class="v">${fmt(S.secs)}</div></div>
      </div>
      <p style="color:var(--muted)">Review your notes and try again. The turkeys are counting on you.</p>
      <button class="primary" id="again">Try again</button>
    </section>`;
  $('#again').onclick=()=>{ Audio.startMusic(); startGame(); };
}

/* =========================================================
   CONTROLS & AMBIENCE
   ========================================================= */
$('#musicBtn').onclick=()=>{ Audio.init(); const on=Audio.toggle(); const b=$('#musicBtn'); b.textContent=on?'🎵 Music on':'🔇 Music off'; b.setAttribute('aria-pressed',on); };
$('#vol').oninput=e=>Audio.setVol(e.target.value/100);

(function leaves(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box=$('#leaves'), icons=['🍂','🍁','🍂','🌾'];
  for(let i=0;i<14;i++){
    const l=document.createElement('span'); l.className='leaf';
    l.textContent=icons[i%icons.length];
    l.style.left=Math.random()*100+'vw';
    l.style.animationDuration=(12+Math.random()*14)+'s';
    l.style.animationDelay=(-Math.random()*20)+'s';
    l.style.fontSize=(16+Math.random()*14)+'px';
    box.appendChild(l);
  }
})();

renderIntro();
