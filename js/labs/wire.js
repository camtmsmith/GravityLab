/* =====================================================================
   MAGNETISM LAB — force on a current-carrying wire, F = B I L sinθ
   ===================================================================== */
(function(){
  "use strict";
  const {TAU, sizeCanvas, downloadCSV, segmented, pad2} = PL;
  const {cyan:CYAN, red:RED} = PL.COLORS;
  const arrow = (x,x1,y1,x2,y2,col,w) => PL.arrow(x,x1,y1,x2,y2,col,w,7);
  const D2R = Math.PI/180;
  const $ = PL.byPrefix('m_');

  const cv=$('cv'), Bin=$('B'), Iin=$('I'), Lin=$('L'), angIn=$('ang');
  const btnRec=$('record'), btnClear=$('clear'), btnExport=$('export');
  let B=0.5, I=2, L=0.1, ang=90, iv='I', points=[];

  // theory mode: the balance reads F = BIL sinθ exactly. Experiment mode: reading scatter,
  // plus a balance that was not tared and an ammeter that reads slightly off.
  const err = PL.errorPanel({box:$('errctl'), note:$('theoryNote'), sysHost:$('sys'), sources:[
    {key:'tare', label:'Balance not tared', gen:() => PL.offset(0.002, 0.008), fmt:v => PL.signed(v, 4) + ' N'},
    {key:'amm',  label:'Ammeter calibration', gen:() => PL.offset(0.01, 0.05), fmt:v => PL.signed(v*100, 1) + '%'}
  ]});
  const noiseIn = $('noise');
  noiseIn.addEventListener('input', () => $('noiseOut').textContent = '±' + (+noiseIn.value).toFixed(4) + ' N');
  // what the balance shows: the ammeter says I, but the true current is a little different
  function measureF(){
    if(!err.on()) return F();
    const Itrue = I/(1 + err.sys('amm'));
    let r = Fof(B, Itrue, L, ang) + err.sys('tare') + PL.gauss(0, +noiseIn.value);
    if($('round').checked) r = Math.round(r*1000)/1000;
    return r;
  }

  const RANGE = {B:[0,2], I:[0,10], L:[0,0.5], ang:[0,180]};
  const UNIT  = {B:'T', I:'A', L:'m', ang:'°'};
  const F = () => B*I*L*Math.sin(ang*D2R);
  const Fof = (vB,vI,vL,va) => vB*vI*vL*Math.sin(va*D2R);


  function drawStage(){
    if(cv.clientWidth<40||cv.clientHeight<40) return;
    const x=sizeCanvas(cv), W=cv.clientWidth, H=cv.clientHeight, cxp=W/2, cyp=H/2;
    x.clearRect(0,0,W,H);

    // uniform field B — rows of arrows pointing right
    x.globalAlpha=.5;
    for(let gy=cyp-90; gy<=cyp+90; gy+=36){
      for(let gx=40; gx<W-60; gx+=70) arrow(x,gx,gy,gx+44,gy,CYAN,1.5);
    }
    x.globalAlpha=1;
    x.fillStyle='rgba(91,200,216,.7)'; x.font='11px "IBM Plex Mono",monospace'; x.textAlign='left'; x.textBaseline='bottom';
    x.fillText('B field →', 40, cyp-96);

    // the wire at angle θ to the field, through the centre
    const th=ang*D2R, half=Math.min(W,H)*0.33;
    const wx=Math.cos(th), wy=-Math.sin(th);
    const ax=cxp-half*wx, ay=cyp-half*wy, bx=cxp+half*wx, by=cyp+half*wy;
    x.strokeStyle='#fff'; x.lineWidth=5; x.lineCap='round';
    x.beginPath(); x.moveTo(ax,ay); x.lineTo(bx,by); x.stroke(); x.lineCap='butt';
    // current arrowheads along the wire (red)
    for(let s=-0.6;s<=0.6;s+=0.6){
      const px=cxp+half*wx*s, py=cyp+half*wy*s;
      arrow(x,px,py,px+22*wx,py+22*wy,RED,2.5);
    }
    x.fillStyle=RED; x.textAlign='center'; x.textBaseline='middle';
    x.fillText('I', bx+14*wx, by+14*wy);

    // angle marker between wire and field
    x.strokeStyle='rgba(255,255,255,.5)'; x.lineWidth=1.25;
    x.beginPath(); x.arc(cxp,cyp,30,0,-th,true); x.stroke();
    x.fillStyle='rgba(255,255,255,.8)'; x.fillText('θ='+Math.round(ang)+'°', cxp+46, cyp-14);

    // force out of the page ⊙ at the midpoint, sized by |F| relative to this config's max
    const f=F(), fmaxCfg=Math.max(B*I*L,1e-6), r=6+38*Math.sqrt(Math.max(0,f)/fmaxCfg);
    x.strokeStyle='#fff'; x.fillStyle='rgba(255,255,255,.12)'; x.lineWidth=2.5;
    x.beginPath(); x.arc(cxp,cyp,r,0,TAU); x.fill(); x.stroke();
    x.fillStyle='#fff'; x.beginPath(); x.arc(cxp,cyp,Math.min(4,r*0.3),0,TAU); x.fill();
    x.textAlign='left'; x.textBaseline='middle';
    x.fillText('F = '+f.toFixed(3)+' N  (out of page)', cxp+r+10, cyp);

    $('FRead').innerHTML=f.toFixed(3)+'<small>N</small>';
    $('formula').textContent=B.toFixed(2)+' × '+I.toFixed(1)+' × '+L.toFixed(2)+' × sin'+Math.round(ang)+'°';
  }

  /* ---------- graphs ---------- */
  const PAD={l:40,r:10,t:10,b:20};
  function plot(c, varName, markX){
    if(c.clientWidth<40||c.clientHeight<40) return;
    const x=sizeCanvas(c), W=c.clientWidth, H=c.clientHeight;
    const x0=PAD.l,y0=H-PAD.b,w=W-PAD.l-PAD.r,h=H-PAD.t-PAD.b;
    x.clearRect(0,0,W,H);
    const [lo,hi]=RANGE[varName];
    // current value of the three held constant, with varName swept
    const val=t=>{ const v={B,I,L,ang}; v[varName]=t; return Fof(v.B,v.I,v.L,v.ang); };
    let fMax=0; for(let i=0;i<=60;i++) fMax=Math.max(fMax,val(lo+(hi-lo)*i/60));
    fMax=Math.max(fMax,1e-6)*1.1;
    const PX=t=>x0+(t-lo)/(hi-lo)*w, PY=v=>y0-v/fMax*h;
    // grid
    x.font='9px "IBM Plex Mono",monospace'; x.fillStyle='#6E7681';
    for(let i=0;i<=2;i++){ const v=fMax*i/2,y=Math.round(PY(v))+.5; x.strokeStyle='rgba(21,24,28,.14)';
      x.beginPath(); x.moveTo(x0,y); x.lineTo(x0+w,y); x.stroke();
      x.textAlign='right'; x.textBaseline='middle'; x.fillText(v.toFixed(v<1?2:1),x0-4,y); }
    x.strokeStyle='rgba(21,24,28,.5)'; x.beginPath(); x.moveTo(x0+.5,PAD.t); x.lineTo(x0+.5,y0+.5); x.stroke();
    x.textAlign='left'; x.textBaseline='top'; x.fillText('N',x0+2,PAD.t);
    x.textAlign='right'; x.fillText(varName==='ang'?'θ':varName,x0+w,y0+4);
    // curve
    x.strokeStyle=RED; x.lineWidth=2; x.beginPath();
    for(let i=0;i<=80;i++){ const t=lo+(hi-lo)*i/80; (i?x.lineTo:x.moveTo).call(x,PX(t),PY(val(t))); }
    x.stroke();
    // operating point
    x.fillStyle='#123E6B'; x.beginPath(); x.arc(PX(markX),PY(val(markX)),3.6,0,TAU); x.fill();
  }
  function drawGraphs(){
    $('g1name').textContent='F vs '+(iv==='ang'?'θ':iv);
    plot($('g1'), iv, iv==='B'?B:iv==='I'?I:iv==='L'?L:ang);
    plot($('g2'), 'ang', ang);
    $('g1now').textContent=F().toFixed(3)+' N';
    $('g2now').textContent='sinθ='+Math.sin(ang*D2R).toFixed(3);
  }

  function sync(){
    B=Math.max(0,parseFloat(Bin.value)||0); I=Math.max(0,parseFloat(Iin.value)||0);
    L=Math.max(0,parseFloat(Lin.value)||0); ang=Math.min(180,Math.max(0,parseFloat(angIn.value)||0));
    $('angOut').textContent=Math.round(ang)+'°';
    const f=F();
    $('big').innerHTML=f.toFixed(3)+'<small>N</small>';
    $('bil').textContent=(B*I*L).toFixed(3)+' N';
    $('sin').textContent=Math.sin(ang*D2R).toFixed(3);
    $('fmax').textContent=(B*I*L).toFixed(3)+' N';
    drawStage(); drawGraphs();
  }
  [Bin,Iin,Lin,angIn].forEach(el=>el.addEventListener('input',sync));
  segmented($('ivsel'), d=>{ iv=d.v; drawGraphs(); });

  function render(){
    const n=points.length; btnClear.disabled=btnExport.disabled=n===0;
    if(!n){ $('log').innerHTML='<div class="empty">No points recorded. Record a few to build a set by hand.</div>'; return; }
    $('log').innerHTML='<div class="row hd"><span>#</span><span>B·I·L·θ</span><span></span><span>F</span></div>'+
      points.map((p,i)=>'<div class="row"><span class="n">'+pad2(i+1)+'</span>'+
        '<span>'+p.B.toFixed(2)+'T '+p.I.toFixed(1)+'A</span>'+
        '<span>'+p.L.toFixed(2)+'m '+Math.round(p.ang)+'°</span>'+
        '<span class="g">'+p.F.toFixed(3)+'</span></div>').reverse().join('');
  }
  btnRec.addEventListener('click',()=>{ points.push({B,I,L,ang,F:measureF()}); render(); });
  btnClear.addEventListener('click',()=>{ points=[]; render(); });
  btnExport.addEventListener('click',()=>{
    downloadCSV('force-on-wire.csv', [['point','B_T','I_A','L_m','angle_deg','F_N']].concat(points.map((p,i)=>
      [i+1,p.B.toFixed(3),p.I.toFixed(2),p.L.toFixed(3),Math.round(p.ang),p.F.toFixed(4)])));
  });

  window.addEventListener('resize',()=>{ drawStage(); drawGraphs(); });
  sync();
})();
