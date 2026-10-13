/* =====================================================================
   DATASET GENERATOR — realistic repeat-trial tables for any experiment
   ===================================================================== */
(function(){
  "use strict";
  const G=9.81, D2R=Math.PI/180;
  const $ = id => document.getElementById('d_' + id);

  // Each experiment: the measured quantity, its variables, and the true law.
  const EXP = {
    fall:{ label:'Free fall', dv:{sym:'t',name:'fall time',unit:'s',dp:2},
      vars:{ h:{name:'drop height',unit:'m',def:1.0,min:0.4,max:2.0,dp:3,iv:true} },
      f:v=>Math.sqrt(2*v.h/G), randMax:0.25, unit:'s',
      note:'t = √(2h/g). Plot t² against h → straight line, gradient 2/g.' },
    pend:{ label:'Pendulum', dv:{sym:'T',name:'period',unit:'s',dp:2},
      vars:{ L:{name:'length',unit:'m',def:1.0,min:0.3,max:1.5,dp:3,iv:true} },
      f:v=>2*Math.PI*Math.sqrt(v.L/G), randMax:0.25, unit:'s',
      note:'T = 2π√(L/g). Plot T² against L → straight line, gradient 4π²/g.' },
    snell:{ label:'Snell’s law', dv:{sym:'θ2',name:'angle of refraction',unit:'°',dp:1},
      vars:{ theta1:{name:'angle of incidence',unit:'°',def:30,min:10,max:70,dp:0,iv:true},
             n1:{name:'index of medium 1',unit:'n',def:1.00,min:1,max:2.5,dp:2},
             n2:{name:'index of medium 2',unit:'n',def:1.49,min:1,max:2.5,dp:2} },
      f:v=>{ const s=v.n1*Math.sin(v.theta1*D2R)/v.n2; return s>1?NaN:Math.asin(s)/D2R; }, randMax:3, unit:'°',
      note:'n₁ sinθ₁ = n₂ sinθ₂. Plot sin θ₁ against sin θ₂ → straight line through the origin, gradient n₂/n₁.' },
    proj:{ label:'Projectile', dv:{sym:'R',name:'range',unit:'m',dp:2},
      vars:{ angle:{name:'launch angle',unit:'°',def:45,min:15,max:75,dp:0,iv:true},
             speed:{name:'launch speed',unit:'m/s',def:20,min:5,max:40,dp:1} },
      f:v=>v.speed*v.speed*Math.sin(2*v.angle*D2R)/G, randMax:5, unit:'m',
      note:'R = v²·sin(2θ)/g on level ground. Range is greatest at θ = 45°, and complementary angles (θ and 90° − θ) give equal range.' },
    fmag:{ label:'Field: magnet', dv:{sym:'B',name:'field strength',unit:'µT',dp:1},
      vars:{ r:{name:'distance',unit:'m',def:0.15,min:0.10,max:0.30,dp:3,iv:true},
             m:{name:'magnetic moment',unit:'A·m²',def:2.5,min:0.5,max:10,dp:2} },
      f:v=>2e-7*v.m/Math.pow(v.r,3)*1e6, randMax:15, unit:'µT',
      note:'B = μ₀m / 2πr³ on the axis, far from the magnet. Plot B against 1/r³ → straight line, gradient μ₀m/2π.' },
    fsol:{ label:'Field: solenoid', dv:{sym:'B',name:'field strength',unit:'µT',dp:1},
      vars:{ I:{name:'current',unit:'A',def:2,min:0.5,max:5,dp:1,iv:true},
             N:{name:'turns',unit:'turns',def:200,min:50,max:1000,dp:0},
             L:{name:'coil length',unit:'m',def:0.2,min:0.05,max:0.4,dp:3} },
      f:v=>4*Math.PI*1e-7*v.N*v.I/v.L*1e6, randMax:60, unit:'µT',
      note:'B = μ₀NI / ℓ at the centre of a long solenoid. Plot B against I → straight line through the origin, gradient μ₀N/ℓ.' },
    mag:{ label:'Force on wire', dv:{sym:'F',name:'force',unit:'N',dp:3},
      vars:{ I:{name:'current',unit:'A',def:2,min:0.5,max:6,dp:1,iv:true},
             B:{name:'flux density',unit:'T',def:0.5,min:0.1,max:2,dp:2},
             L:{name:'length',unit:'m',def:0.1,min:0.02,max:0.5,dp:3},
             angle:{name:'angle θ',unit:'°',def:90,min:0,max:90,dp:0} },
      f:v=>v.B*v.I*v.L*Math.sin(v.angle*D2R), randMax:0.05, unit:'N',
      note:'F = BIL sinθ. With B, L, θ held fixed, F against I is a straight line through the origin.' }
  };

  let exp='fall', last=null;

  const {gauss, downloadCSV, copyRows, segmented} = PL;
  // theory mode: every trial is exact. Experiment mode: the scatter and offset dials apply.
  const showMode = () => { $('errctl').hidden = !PL.experiment(); $('theoryNote').hidden = PL.experiment(); };
  window.addEventListener('modechange', showMode);
  showMode();
  const cfg = () => EXP[exp];
  const ivSym = () => $('iv').value;
  const sigma = () => (+$('rand').value)/100 * cfg().randMax;

  function buildIVOptions(){
    const c=cfg(), sel=$('iv');
    sel.innerHTML=Object.entries(c.vars).map(([sym,v])=>
      '<option value="'+sym+'"'+(v.iv?' selected':'')+'>'+v.name+' ('+sym+', '+v.unit+')</option>').join('');
  }
  function buildParams(){
    const c=cfg(), host=$('params'), iVsym=ivSym();
    const others=Object.entries(c.vars).filter(([s])=>s!==iVsym);
    host.innerHTML = others.length ? others.map(([sym,v])=>
      '<div class="field" style="margin:0"><label for="d_p_'+sym+'">'+v.name+' <span class="u">('+v.unit+')</span></label>'+
      '<input type="number" id="d_p_'+sym+'" value="'+v.def+'" step="any"></div>').join('')
      : '<div class="hint" style="margin:0">No other quantities — this experiment has a single variable.</div>';
  }
  function prefillRange(){
    const v=cfg().vars[ivSym()]; $('min').value=v.min; $('max').value=v.max;
  }
  function refreshReadouts(){
    const c=cfg();
    $('randU').textContent='(± '+c.unit+', reliability)';
    $('randOut').textContent='± '+sigma().toFixed(c.dv.dp)+' '+c.unit;
    $('sysOut').textContent=((+$('sys').value)>=0?'+':'')+(+$('sys').value)+'%';
    $('trialsOut').textContent=$('trials').value;
  }

  function switchExp(e){
    exp=e; buildIVOptions(); buildParams(); prefillRange(); refreshReadouts();
  }

  segmented($('exp'), d=>switchExp(d.exp));
  $('iv').addEventListener('change',()=>{ buildParams(); prefillRange(); });
  $('rand').addEventListener('input',refreshReadouts);
  $('sys').addEventListener('input',refreshReadouts);
  $('trials').addEventListener('input',refreshReadouts);

  function linspace(a,b,n){ if(n<2) return [a]; const o=[]; for(let i=0;i<n;i++) o.push(a+(b-a)*i/(n-1)); return o; }

  function generate(){
    const c=cfg(), ivs=ivSym(), ivVar=c.vars[ivs];
    const lo=parseFloat($('min').value), hi=parseFloat($('max').value);
    const pts=Math.min(7,Math.max(3,parseInt($('pts').value)||5));
    const k=Math.min(5,Math.max(3,parseInt($('trials').value)||5));
    const live=PL.experiment();
    const sig=live?sigma():0, sys=live?(+$('sys').value)/100:0, dp=c.dv.dp, doRound=live&&$('round').checked;
    if(!isFinite(lo)||!isFinite(hi)){ return; }

    // fixed parameters from the param inputs
    const fixed={}; Object.keys(c.vars).forEach(sym=>{ if(sym!==ivs){
      const el=document.getElementById('d_p_'+sym); fixed[sym]=el?parseFloat(el.value):c.vars[sym].def; } });

    const ivVals=linspace(lo,hi,pts).map(x=>+x.toFixed(ivVar.dp));
    const rows=ivVals.map(xv=>{
      const vals=Object.assign({},fixed,{[ivs]:xv});
      const truth=c.f(vals)*(1+sys);                 // systematic error shifts every reading (validity)
      const trials=[]; for(let j=0;j<k;j++){ let r=truth+gauss(0,sig); if(doRound) r=+r.toFixed(dp); trials.push(Math.max(0,r)); }
      const mean=trials.reduce((a,b)=>a+b,0)/k;
      const rng=Math.max(...trials)-Math.min(...trials);
      return {xv, trials, mean, rng};
    });
    last={c, ivs, ivVar, sig, sys, k, dp, fixed, rows};
    renderTable();
    $('export').disabled=$('copy').disabled=false;
  }

  function renderTable(){
    const {c,ivs,ivVar,sig,sys,k,dp,fixed,rows}=last, out=$('out');
    const fixedTxt=Object.entries(fixed).map(([s,v])=>s+' = '+v+' '+c.vars[s].unit).join(' · ') || 'single variable';
    let html='<div class="datahead">'+
      '<span class="title">'+c.label+' — '+c.dv.name+' vs '+ivVar.name+'</span>'+
      '<button type="button" class="copybtn">Copy table</button></div>'+
      '<div class="datahead"><span class="meta">held fixed: '+fixedTxt+'</span>'+
      '<span class="meta">random uncertainty <b>± '+sig.toFixed(dp)+' '+c.unit+'</b></span>'+
      '<span class="meta">systematic error <b>'+(sys>=0?'+':'')+(sys*100).toFixed(1)+'%</b></span></div>';

    html+='<table class="dtable"><thead><tr><th class="iv">'+ivVar.name+'<br>'+ivs+' ('+ivVar.unit+')</th>';
    for(let j=1;j<=k;j++) html+='<th>Trial '+j+'<br>'+c.dv.sym+' ('+c.dv.unit+')</th>';
    html+='<th class="mean">mean<br>'+c.dv.sym+'</th><th>range</th></tr></thead><tbody>';
    rows.forEach(r=>{
      html+='<tr><td class="iv">'+r.xv.toFixed(ivVar.dp)+'</td>';
      r.trials.forEach(t=>html+='<td>'+t.toFixed(dp)+'</td>');
      html+='<td class="mean">'+r.mean.toFixed(dp+1)+'</td><td>'+r.rng.toFixed(dp)+'</td></tr>';
    });
    html+='</tbody></table>';
    html+='<p class="datanote"><b>Relationship:</b> '+c.note+
      '<br><b>Reliability</b> shows up as the spread across trials (the range column); <b>validity</b> is the systematic error, which shifts every reading the same way and cannot be averaged out.</p>';
    out.innerHTML=html;
    out.querySelector('.copybtn').addEventListener('click',e=>copyRows(tableRows(), e.currentTarget));
  }

  function tableRows(){
    const {c,ivs,ivVar,k,dp,rows}=last;
    const head=[ivs+'_'+ivVar.unit]; for(let j=1;j<=k;j++) head.push('trial'+j+'_'+c.dv.unit);
    head.push('mean_'+c.dv.unit,'range_'+c.dv.unit);
    const lines=[head].concat(rows.map(r=>[r.xv.toFixed(ivVar.dp),...r.trials.map(t=>t.toFixed(dp)),
      r.mean.toFixed(dp+1),r.rng.toFixed(dp)]));
    return lines;
  }

  $('gen').addEventListener('click',generate);
  $('export').addEventListener('click',()=>{ if(last) downloadCSV(last.c.label.toLowerCase().replace(/[^a-z]+/g,'-')+'-dataset.csv', tableRows()); });
  $('copy').addEventListener('click',e=>{ if(last) copyRows(tableRows(), e.currentTarget); });

  switchExp('fall');
})();
