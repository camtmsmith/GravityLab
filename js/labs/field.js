/* =====================================================================
   MAGNETIC FIELD LAB — measure B from a fixed bar magnet or a solenoid
   with a magnetometer probe that moves along the bench axis.
   ===================================================================== */
(function(){
  "use strict";
  const {TAU, gauss, sizeCanvas, fitLine, downloadCSV, segmented, pad2} = PL;
  const {red:RED, amber:AMBER, navy:NAVY} = PL.COLORS;
  const MU0 = 4*Math.PI*1e-7;
  const $ = PL.byPrefix('f_');

  // the bar magnet: modelled as two pole sheets at its end faces, so the field is
  // realistic close in and tends to the dipole law μ0·m / 2πr³ far away
  const MAG_LEN = 0.05, MAG_M = 2.5, MAG_HALF_H = 0.009;
  const SOL_R = 0.025;                  // solenoid radius
  const RMAX = 0.45;                    // bench length (m)

  const cv = $('cv');
  const Nin=$('N'), lenIn=$('len'), Iin=$('I'), posIn=$('pos'), noiseIn=$('noise'), puncIn=$('punc');
  const btnRec=$('record'), btnClear=$('clear'), btnExport=$('export');

  // errors off by default: the probe reads the ideal law exactly
  // theory mode: the probe reads the ideal law exactly. Experiment mode: sensor noise and
  // placement scatter, the real magnet/coil size, and hidden systematic offsets.
  const err = PL.errorPanel({box:$('errctl'), note:$('theoryNote'), sysHost:$('sys'),
    onChange:() => { tick(); render(); }, sources:[
    {key:'zero', label:'Probe not zeroed (Earth’s field etc.)', gen:() => PL.offset(8, 30), fmt:v => PL.signed(v, 1) + ' µT'},
    {key:'ruler', label:'Ruler zero offset', gen:() => PL.offset(0.002, 0.008), fmt:v => PL.signed(v*1000, 1) + ' mm'}
  ]});
  const errOn = err.on;
  let src = 'magnet', N = 200, len = 0.2, I = 2, noise = 2;
  let pos = { magnet: 0.10, sol: 0.0 };      // recorded probe position per source
  let posErr = 0;                             // how far the probe really is from where you think
  let shown = 0;                              // the flickering value on the meter, µT
  const pts = { magnet: [], sol: [] };
  let sx = 100, cy = 200, pxPerM = 800, lineCache = {key:'', lines:[]};

  /* ---------- the physics: field along the axis, in µT ---------- */
  function Bmagnet(r){
    if(!errOn()) return 2e-7*MAG_M/(r*r*r) * 1e6;     // ideal point dipole: B = μ0 m / 2πr³
    const a = MAG_LEN/2, q = MAG_M/MAG_LEN;
    return 1e-7*q*(1/((r-a)*(r-a)) - 1/((r+a)*(r+a))) * 1e6;
  }
  function Bsol(x, n, l, i){               // finite solenoid, on axis, x from its centre
    const R = errOn() ? SOL_R : 0.001;     // ideal: a thin coil, so the centre field is μ0 n I
    const p = x + l/2, m = x - l/2;
    return MU0*(n/l)*i/2 * (p/Math.hypot(p, R) - m/Math.hypot(m, R)) * 1e6;
  }
  const Bnow = x => src === 'magnet' ? Bmagnet(x) : Bsol(x, N, len, I);
  const minPos = () => src === 'magnet' ? MAG_LEN/2 + 0.02 : 0;
  const bg = () => err.sys('zero');
  const posTrue = () => Math.min(RMAX, Math.max(minPos() - 0.01, pos[src] + err.sys('ruler') + (errOn() ? posErr : 0)));

  function sample(){                        // one reading off the meter
    const v = Bnow(posTrue()) + bg() + (errOn() ? gauss(0, noise) : 0);
    return Math.round(v*10)/10;
  }

  /* ---------- helpers ---------- */
  const fmtB = v => Math.abs(v) >= 1000 ? (v/1000).toFixed(2) + ' mT' : v.toFixed(1) + ' µT';

  /* ---------- field lines, traced from pole sheets on the two end faces ---------- */
  function traceLines(W, H, a, h){
    const key = [src, W, H, a.toFixed(1), h.toFixed(1)].join('|');
    if(lineCache.key === key) return lineCache.lines;
    const K = 7, charges = [];
    for(let k = 0; k < K; k++){
      const y = cy - h + 2*h*k/(K-1);
      charges.push({x: sx + a, y, q: 1}, {x: sx - a, y, q: -1});
    }
    const field = (px, py) => {
      let fx = 0, fy = 0;
      for(const c of charges){
        const dx = px - c.x, dy = py - c.y, r2 = dx*dx + dy*dy + 1, r3 = r2*Math.sqrt(r2);
        fx += c.q*dx/r3; fy += c.q*dy/r3;
      }
      return [fx, fy];
    };
    // start points: across the N face, then fanned around it so the loops spread out
    const starts = [];
    if(src === 'sol'){
      [-1, -0.5, 0, 0.5, 1].forEach(f => starts.push([sx + a + 2, cy + f*h*0.9]));
      [10, 24, 44].forEach(d => { starts.push([sx + a + 2, cy - h - d]); starts.push([sx + a + 2, cy + h + d]); });
    }else{
      const r0 = h + 4;
      [0, 18, 36, 54, 72, 92, 115].forEach(deg => [1, -1].forEach(sgn => {
        if(deg === 0 && sgn < 0) return;
        const t = sgn*deg*Math.PI/180;
        starts.push([sx + a + r0*Math.cos(t), cy + r0*Math.sin(t)]);
      }));
    }
    const lines = starts.map(([x0, y0]) => {
      let px = x0, py = y0;
      const pts_ = [[x0, y0]];
      for(let s = 0; s < 2500; s++){
        const [fx, fy] = field(px, py), m = Math.hypot(fx, fy) || 1;
        px += 3*fx/m; py += 3*fy/m;
        pts_.push([px, py]);
        if(px < -40 || px > W + 40 || py < -40 || py > H + 40) break;
        if(Math.abs(px - sx) < a && Math.abs(py - cy) < h + 1) break;     // back into the S face
      }
      return pts_;
    });
    lineCache = {key, lines};
    return lines;
  }

  /* ---------- the stage ---------- */
  function drawStage(){
    if(cv.clientWidth < 40 || cv.clientHeight < 40) return;
    const x = sizeCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    x.clearRect(0,0,W,H);
    cy = Math.round(H*0.56);
    sx = src === 'magnet' ? Math.max(70, W*0.16) : Math.max(70, W*0.08 + len/2*((W*0.92 - 30)/RMAX));
    pxPerM = (W - sx - 30)/RMAX;
    const a = (src === 'magnet' ? MAG_LEN/2 : len/2)*pxPerM;
    const h = (src === 'magnet' ? MAG_HALF_H : SOL_R)*pxPerM;

    // field lines
    x.strokeStyle = 'rgba(91,200,216,.32)'; x.lineWidth = 1.2; x.fillStyle = 'rgba(91,200,216,.55)';
    traceLines(W, H, a, h).forEach(line => {
      x.beginPath(); line.forEach((p,i) => i ? x.lineTo(p[0],p[1]) : x.moveTo(p[0],p[1])); x.stroke();
      const mid = Math.floor(line.length*0.35);
      if(line.length > 12){
        const [x1,y1] = line[mid-2], [x2,y2] = line[mid+2], ang = Math.atan2(y2-y1, x2-x1);
        x.beginPath(); x.moveTo(x2,y2);
        x.lineTo(x2-7*Math.cos(ang-0.45), y2-7*Math.sin(ang-0.45));
        x.lineTo(x2-7*Math.cos(ang+0.45), y2-7*Math.sin(ang+0.45)); x.closePath(); x.fill();
      }
    });

    // bench axis + ruler (cm from the centre of the source)
    x.strokeStyle = 'rgba(242,177,52,.45)'; x.setLineDash([5,5]); x.lineWidth = 1;
    x.beginPath(); x.moveTo(sx, cy); x.lineTo(W-10, cy); x.stroke(); x.setLineDash([]);
    const rulerY = cy + Math.max(h, 30) + 34;
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.moveTo(sx, rulerY); x.lineTo(sx + RMAX*pxPerM, rulerY); x.stroke();
    x.font = '10px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'top';
    for(let cm = 0; cm <= RMAX*100 + 1e-6; cm += 1){
      const px = sx + cm/100*pxPerM, major = cm % 5 === 0;
      x.strokeStyle = major ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)';
      x.beginPath(); x.moveTo(px, rulerY); x.lineTo(px, rulerY + (major ? 8 : 4)); x.stroke();
      if(cm % 5 === 0){ x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText(cm, px, rulerY + 10); }
    }
    x.textAlign = 'left'; x.fillText('cm', sx + RMAX*pxPerM + 8, rulerY + 10);

    // the source
    if(src === 'magnet'){
      x.fillStyle = '#2F5E9E'; x.fillRect(sx - a, cy - h, a, 2*h);
      x.fillStyle = RED;       x.fillRect(sx, cy - h, a, 2*h);
      x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.strokeRect(sx - a, cy - h, 2*a, 2*h);
      x.fillStyle = '#fff'; x.font = '700 11px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('S', sx - a/2, cy + .5); x.fillText('N', sx + a/2, cy + .5);
    }else{
      // interior field: uniform, straight lines
      x.strokeStyle = 'rgba(91,200,216,.32)'; x.lineWidth = 1.2;
      for(let k = 0; k < 5; k++){ const y = cy - h*0.9 + 1.8*h*k/4; x.beginPath(); x.moveTo(sx - a, y); x.lineTo(sx + a, y); x.stroke(); }
      const loops = Math.max(8, Math.min(40, Math.round(N/10)));
      x.strokeStyle = '#C98B4A'; x.lineWidth = 2;
      for(let k = 0; k < loops; k++){
        const px = sx - a + 2*a*(k + 0.5)/loops;
        x.beginPath(); x.moveTo(px - 2, cy - h); x.lineTo(px + 2, cy + h); x.stroke();
      }
      x.strokeStyle = 'rgba(201,139,74,.6)'; x.lineWidth = 1; x.strokeRect(sx - a, cy - h, 2*a, 2*h);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '10px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'bottom';
      x.fillText('N = ' + N + ' · ℓ = ' + len.toFixed(3) + ' m · I = ' + I.toFixed(1) + ' A', sx, cy - h - 8);
    }

    // the probe
    const px = sx + pos[src]*pxPerM;
    x.strokeStyle = AMBER; x.lineWidth = 2;
    x.beginPath(); x.moveTo(px, cy); x.lineTo(px, cy - 62); x.stroke();
    x.fillStyle = AMBER; x.fillRect(px - 4, cy - 4, 8, 8);
    x.fillStyle = '#15181C'; x.strokeStyle = AMBER;
    x.fillRect(px - 38, cy - 88, 76, 26); x.strokeRect(px - 38, cy - 88, 76, 26);
    x.fillStyle = '#fff'; x.font = '600 11px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(fmtB(shown), px, cy - 75);
  }

  /* ---------- graphs ---------- */
  const PAD = {l:44, r:10, t:12, b:20};
  function frame(c){
    if(c.clientWidth < 40 || c.clientHeight < 40) return null;
    const x = sizeCanvas(c), W = c.clientWidth, H = c.clientHeight;
    x.clearRect(0,0,W,H);
    return {x, x0:PAD.l, y0:H-PAD.b, w:W-PAD.l-PAD.r, h:H-PAD.t-PAD.b};
  }
  function axes(f, xMin, xMax, yMax, xLab, yLab){
    const {x,x0,y0,w,h} = f;
    x.font = '9px "IBM Plex Mono", monospace'; x.lineWidth = 1;
    for(let i = 0; i <= 2; i++){
      const v = yMax*i/2, y = Math.round(y0 - v/yMax*h) + .5;
      x.strokeStyle = 'rgba(21,24,28,.14)'; x.beginPath(); x.moveTo(x0,y); x.lineTo(x0+w,y); x.stroke();
      x.fillStyle = '#6E7681'; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillText(v >= 100 ? v.toFixed(0) : v.toFixed(1), x0-4, y);
    }
    x.strokeStyle = 'rgba(21,24,28,.5)'; x.beginPath(); x.moveTo(x0+.5,PAD.t); x.lineTo(x0+.5,y0+.5); x.stroke();
    x.fillStyle = '#6E7681'; x.textBaseline = 'top';
    x.textAlign = 'left'; x.fillText(xMin === 0 ? '0' : xMin.toPrecision(2), x0, y0+4);
    x.textAlign = 'right'; x.fillText(xLab, x0+w, y0+4);
    x.textAlign = 'left'; x.fillText(yLab, x0+3, 1);
  }
  function curve(f, xMin, xMax, yMax, fn, style, width, dash){
    const {x,x0,y0,w,h} = f;
    x.save(); x.beginPath(); x.rect(x0, PAD.t, w, h); x.clip();
    x.strokeStyle = style; x.lineWidth = width; if(dash) x.setLineDash(dash);
    x.beginPath();
    for(let i = 0; i <= 160; i++){
      const t = xMin + (xMax-xMin)*i/160;
      const X = x0 + (t-xMin)/(xMax-xMin)*w, Y = y0 - fn(t)/yMax*h;
      i ? x.lineTo(X,Y) : x.moveTo(X,Y);
    }
    x.stroke(); x.restore();
  }
  function dots(f, xMin, xMax, yMax, list, color, r){
    const {x,x0,y0,w,h} = f;
    x.fillStyle = color;
    list.forEach(p => {
      const X = x0 + (p.x-xMin)/(xMax-xMin)*w, Y = y0 - Math.min(p.y, yMax*1.04)/yMax*h;
      x.beginPath(); x.arc(X, Y, r, 0, TAU); x.fill();
    });
  }

  // graph 1: B against position, for either source
  function drawPosGraph(c){
    const f = frame(c); if(!f) return;
    const lo = minPos(), hi = RMAX, mine = pts[src];
    const refY = src === 'magnet' ? Bmagnet(Math.max(lo + 0.03, Math.min(pos.magnet, 0.12))) : Bsol(0, N, len, I);
    const yMax = Math.max(1, refY, shown, ...mine.map(p => p.B))*1.15;
    axes(f, lo, hi, yMax, (src === 'magnet' ? 'r' : 'x') + ' ' + hi + ' m', 'µT');
    curve(f, lo, hi, yMax, Bnow, 'rgba(21,24,28,.3)', 1.5);
    if(src === 'sol'){                         // where the coil ends
      const X = f.x0 + (len/2 - lo)/(hi-lo)*f.w;
      f.x.strokeStyle = 'rgba(201,139,74,.8)'; f.x.setLineDash([3,3]);
      f.x.beginPath(); f.x.moveTo(X, PAD.t); f.x.lineTo(X, f.y0); f.x.stroke(); f.x.setLineDash([]);
      f.x.fillStyle = '#9a6a2e'; f.x.textAlign = 'left'; f.x.textBaseline = 'top'; f.x.fillText('coil end', X+3, PAD.t);
    }
    dots(f, lo, hi, yMax, mine.map(p => ({x:p.pos, y:p.B})), RED, 3.2);
    dots(f, lo, hi, yMax, [{x:pos[src], y:shown}], AMBER, 4.2);
  }

  // graph 2, magnet: B against 1/r³ — straight in the far field
  function drawInvCube(c){
    const f = frame(c); if(!f) return;
    const mine = pts.magnet.map(p => ({x: 1/p.pos**3, y: p.B}));
    const live = 1/pos.magnet**3;
    const xMax = Math.max(100, live, ...mine.map(p => p.x))*1.1;
    const yMax = Math.max(1, shown, ...mine.map(p => p.y), 2e-7*MAG_M*xMax*1e6*0.6)*1.1;
    axes(f, 0, xMax, yMax, xMax.toFixed(0) + ' m⁻³', 'µT');
    curve(f, 0, xMax, yMax, u => 2e-7*MAG_M*u*1e6, 'rgba(21,24,28,.3)', 1.25, [5,4]);   // ideal dipole
    const fit = fitLine(mine);
    if(fit) curve(f, 0, xMax, yMax, u => fit.m*u + fit.c, NAVY, 2);
    dots(f, 0, xMax, yMax, mine, RED, 3.2);
    dots(f, 0, xMax, yMax, [{x:live, y:shown}], AMBER, 4.2);
    $('g2now').textContent = fit ? 'gradient ' + fit.m.toFixed(3) + ' µT·m³' : '1/r³ = ' + live.toFixed(0) + ' m⁻³';
  }

  // graph 2, solenoid: B against nI — gradient is μ0
  function drawNI(c){
    const f = frame(c); if(!f) return;
    const mine = pts.sol.map(p => ({x: p.N/p.len*p.I, y: p.B}));
    const live = N/len*I;
    const xMax = Math.max(500, live, ...mine.map(p => p.x))*1.1;
    const yMax = Math.max(1, shown, ...mine.map(p => p.y), MU0*xMax*1e6*0.6)*1.1;
    axes(f, 0, xMax, yMax, xMax.toFixed(0) + ' A/m', 'µT');
    curve(f, 0, xMax, yMax, u => MU0*u*1e6, 'rgba(21,24,28,.3)', 1.25, [5,4]);           // ideal long solenoid
    const fit = fitLine(mine);
    if(fit) curve(f, 0, xMax, yMax, u => fit.m*u + fit.c, NAVY, 2);
    dots(f, 0, xMax, yMax, mine, RED, 3.2);
    dots(f, 0, xMax, yMax, [{x:live, y:shown}], AMBER, 4.2);
    $('g2now').textContent = fit ? 'gradient ' + fit.m.toFixed(3) + ' µT·m/A' : 'nI = ' + live.toFixed(0) + ' A/m';
  }

  function drawGraphs(){
    drawPosGraph($('g1'));
    $('g1now').textContent = fmtB(shown);
    if(src === 'magnet') drawInvCube($('g2')); else drawNI($('g2'));
  }

  /* ---------- readouts ---------- */
  function readouts(){
    $('read').innerHTML = (Math.abs(shown) >= 1000 ? (shown/1000).toFixed(2) + '<small>mT</small>' : shown.toFixed(1) + '<small>µT</small>');
    $('where').textContent = (src === 'magnet' ? 'r = ' : 'x = ') + pos[src].toFixed(3) + ' m' +
      (src === 'magnet' ? ' from magnet centre' : ' from coil centre');
    $('true').textContent = 'theory ' + fmtB(Bnow(pos[src])) + (err.revealed() && bg() ? ' ' + PL.signed(bg(), 1) + ' µT offset' : '');
  }

  function tick(){
    if(cv.clientWidth < 40) return;           // tab hidden
    shown = sample();
    drawStage(); drawGraphs(); readouts();
  }

  /* ---------- inputs ---------- */
  function setPos(v, fromInput){
    pos[src] = Math.min(RMAX, Math.max(minPos(), v));
    posErr = gauss(0, Math.max(0, parseFloat(puncIn.value) || 0));   // every placement is slightly off
    if(!fromInput) posIn.value = pos[src].toFixed(3);
    tick();
  }

  function syncSource(){
    $('magCtl').hidden = src !== 'magnet';
    $('solCtl').hidden = src !== 'sol';
    $('posLbl').innerHTML = src === 'magnet'
      ? 'Probe distance r <span class="u">(m, from magnet centre)</span>'
      : 'Probe position x <span class="u">(m, from coil centre)</span>';
    $('g1name').textContent = src === 'magnet' ? 'B vs r' : 'B along the axis vs x';
    $('g2name').textContent = src === 'magnet' ? 'B vs 1/r³' : 'B vs nI  (n = N/ℓ)';
    $('sLawL').textContent = src === 'magnet' ? 'Far-field law' : 'Long-solenoid law';
    $('sLaw').textContent  = src === 'magnet' ? 'B = μ₀m / 2πr³' : 'B = μ₀ N I / ℓ';
    $('hint').textContent = src === 'magnet'
      ? 'Drag the probe along the bench, or type a distance. Close to the magnet the field departs from 1/r³ — find where the straight line holds.'
      : 'Put the probe at the centre (x = 0) and vary I, N or ℓ. Move it toward the coil end to see the field fall to about half.';
    posIn.min = minPos();
    posIn.value = pos[src].toFixed(3);
    setPos(pos[src]);
    render();
  }

  segmented($('src'), d => { src = d.src; syncSource(); });
  Nin.addEventListener('input', () => { N = Math.max(1, parseFloat(Nin.value) || 1); tick(); });
  lenIn.addEventListener('input', () => { const v = parseFloat(lenIn.value); if(v > 0.01){ len = Math.min(0.4, v); tick(); } });
  Iin.addEventListener('input', () => { I = +Iin.value; $('IOut').textContent = I.toFixed(1) + ' A'; tick(); });
  posIn.addEventListener('input', () => { const v = parseFloat(posIn.value); if(isFinite(v)) setPos(v, true); });
  posIn.addEventListener('blur', () => posIn.value = pos[src].toFixed(3));
  noiseIn.addEventListener('input', () => { noise = +noiseIn.value; $('noiseOut').textContent = noise.toFixed(1) + ' µT'; });

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = cv.getBoundingClientRect();
      setPos(Math.round(((ev.clientX - r.left) - sx)/pxPerM*1000)/1000);
    };
    const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
    move(e);
  });
  cv.style.cursor = 'ew-resize';

  /* ---------- results ---------- */
  function render(){
    const mine = pts[src], n = mine.length;
    btnClear.disabled = btnExport.disabled = n === 0;
    $('sN').textContent = n;
    $('sBg').textContent = !errOn() ? '0 µT' : err.revealed() ? PL.signed(bg(), 1) + ' µT' : 'hidden';
    if(!n){
      $('log').innerHTML = '<div class="empty">No readings yet. ' +
        (src === 'magnet' ? 'Record at several distances, ideally a few readings at each.' : 'Record at the centre for several currents.') + '</div>';
      $('sLast').textContent = $('sTrue').textContent = '—';
      $('big').innerHTML = '—';
      $('bignote').textContent = src === 'magnet' ? 'Record readings at several distances to find the magnetic moment.'
                                                  : 'Record readings at several currents to find μ₀.';
      return;
    }
    const last = mine[n-1];
    $('sLast').textContent = fmtB(last.B);
    $('sTrue').textContent = fmtB(last.Btrue);

    if(src === 'magnet'){
      const fit = fitLine(mine.map(p => ({x: 1/p.pos**3, y: p.B})));
      const mEst = fit ? fit.m*1e-6/2e-7 : last.B*1e-6*last.pos**3/2e-7;
      const err = (mEst - MAG_M)/MAG_M*100;
      $('big').innerHTML = 'm = ' + mEst.toFixed(2) + '<small>A·m²</small>';
      $('bignote').innerHTML = (fit ? 'From the gradient of B vs 1/r³ over ' + n + ' readings' : 'From one reading · vary r for a gradient') +
        ' · <b>' + PL.signed(err, 1) + '%</b> from ' + MAG_M.toFixed(2) + ' A·m²';
      $('log').innerHTML = '<div class="row hd"><span>#</span><span>r (m)</span><span>1/r³ (m⁻³)</span><span>B (µT)</span></div>' +
        mine.map((p,i) => '<div class="row"><span class="n">' + pad2(i+1) + '</span>' +
          '<span>' + p.pos.toFixed(3) + '</span><span>' + (1/p.pos**3).toFixed(0) + '</span>' +
          '<span class="g">' + p.B.toFixed(1) + '</span></div>').reverse().join('');
    }else{
      const fit = fitLine(mine.map(p => ({x: p.N/p.len*p.I, y: p.B})));
      const nI = last.N/last.len*last.I;
      const mu = fit ? fit.m*1e-6 : (nI > 0 ? last.B*1e-6/nI : 0);
      const err = (mu - MU0)/MU0*100;
      $('big').innerHTML = 'μ₀ = ' + (mu*1e6).toFixed(3) + '<small>×10⁻⁶ T·m/A</small>';
      $('bignote').innerHTML = (fit ? 'From the gradient of B vs nI over ' + n + ' readings' : 'From one reading · vary I for a gradient') +
        ' · <b>' + PL.signed(err, 1) + '%</b> from 4π×10⁻⁷';
      $('log').innerHTML = '<div class="row hd"><span>#</span><span>x · I</span><span>N / ℓ</span><span>B (µT)</span></div>' +
        mine.map((p,i) => '<div class="row"><span class="n">' + pad2(i+1) + '</span>' +
          '<span>' + p.pos.toFixed(3) + 'm ' + p.I.toFixed(1) + 'A</span><span>' + p.N + ' / ' + p.len.toFixed(3) + '</span>' +
          '<span class="g">' + p.B.toFixed(1) + '</span></div>').reverse().join('');
    }
  }

  btnRec.addEventListener('click', () => {
    pts[src].push({pos: pos[src], N, len, I, B: shown, Btrue: Bnow(pos[src]), bg: bg()});
    render(); drawGraphs();
  });
  btnClear.addEventListener('click', () => { pts[src] = []; render(); drawGraphs(); });
  btnExport.addEventListener('click', () => {
    const rows = src === 'magnet'
      ? [['reading','r_m','inv_r3_m-3','B_uT']].concat(pts.magnet.map((p,i) =>
          [i+1, p.pos.toFixed(3), (1/p.pos**3).toFixed(1), p.B.toFixed(1)]))
      : [['reading','x_m','N','length_m','I_A','nI_A_per_m','B_uT']].concat(pts.sol.map((p,i) =>
          [i+1, p.pos.toFixed(3), p.N, p.len.toFixed(3), p.I.toFixed(2), (p.N/p.len*p.I).toFixed(1), p.B.toFixed(1)]));
    downloadCSV(src === 'magnet' ? 'field-magnet.csv' : 'field-solenoid.csv', rows);
  });

  window.addEventListener('resize', tick);
  setInterval(tick, 350);                     // the meter flickers like a real sensor
  syncSource();
})();
