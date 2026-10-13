/* =====================================================================
   SNELL'S LAW LAB — a ray crosses the boundary between two materials.
   n₁ sinθ₁ = n₂ sinθ₂; plot sinθ₁ against sinθ₂ to find n.
   ===================================================================== */
(function(){
  "use strict";
  const {TAU, gauss, sizeCanvas, fitLine, downloadCSV, pad2} = PL;
  const {red:RED, amber:AMBER, navy:NAVY} = PL.COLORS;
  const D2R = Math.PI/180, R2D = 180/Math.PI, C = 3.00e8;
  const $ = PL.byPrefix('s_');

  const MATERIALS = [
    {id:'air',      name:'Air',               n:1.000},
    {id:'water',    name:'Water',             n:1.333},
    {id:'ethanol',  name:'Ethanol',           n:1.361},
    {id:'perspex',  name:'Perspex (acrylic)', n:1.490},
    {id:'glass',    name:'Crown glass',       n:1.520},
    {id:'diamond',  name:'Diamond',           n:2.417},
    {id:'unknown',  name:'Unknown block',     n:1.460, hidden:true}
  ];

  const cv = $('cv'), m1Sel = $('m1'), m2Sel = $('m2'), angIn = $('ang'), angNum = $('angNum');
  const reflChk = $('refl'), spreadIn = $('spread'), roundChk = $('round');
  const btnRec = $('record'), btnSweep = $('sweep'), btnClear = $('clear'), btnExport = $('export');
  // theory mode: θ₂ read exactly. Experiment mode: protractor reading scatter, plus a
  // normal drawn slightly off — the same wrong line for every reading in a scenario.
  const err = PL.errorPanel({box:$('errctl'), note:$('theoryNote'), sysHost:$('sys'),
    onChange:() => redraw(), sources:[
    {key:'tilt', label:'Normal drawn off true', gen:() => PL.offset(0.5, 3), fmt:v => PL.signed(v, 1) + '°'}
  ]});
  const errOn = err.on;

  let th1 = 30, m1 = MATERIALS[0], m2 = MATERIALS[3];
  const sets = {};                         // recorded readings, kept per material pair
  let O = {x:0, y:0}, Lray = 100;

  const pairKey = () => m1.id + '|' + m2.id;
  const points = () => sets[pairKey()] || (sets[pairKey()] = []);
  const nLabel = m => m.hidden ? '?' : m.n.toFixed(3);
  const secret = () => m1.hidden || m2.hidden;      // the unknown block: no theory curves to give it away

  /* ---------- the physics ---------- */
  // refraction angle in degrees for incidence a (degrees), or null past the critical angle
  function refract(a, n1, n2){
    const s = n1*Math.sin(a*D2R)/n2;
    return s > 1 ? null : Math.asin(s)*R2D;
  }
  const critical = () => m1.n > m2.n ? Math.asin(m2.n/m1.n)*R2D : null;

  // what the student reads off the protractor for incidence a
  function measure(a){
    if(!errOn()) return refract(a, m1.n, m2.n);
    const tilt = err.sys('tilt');
    // with the normal drawn tilt° off, the ray really meets the boundary at a + tilt,
    // and the refracted angle is read against the same wrong line on the far side
    const t2 = refract(a + tilt, m1.n, m2.n);
    if(t2 == null) return null;
    let r = t2 - tilt + gauss(0, +spreadIn.value);
    if(roundChk.checked) r = Math.round(r);
    return Math.max(0, r);
  }

  /* ---------- the stage ---------- */
  function drawStage(){
    if(PL.hidden(cv)) return;
    const x = sizeCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    x.clearRect(0,0,W,H);
    O = {x: W/2, y: H/2};
    Lray = Math.min(W*0.42, H*0.44);

    // the two media, tinted by refractive index
    const tint = n => 'rgba(91,200,216,' + Math.min(.42, (n - 1)*0.22 + 0.02).toFixed(3) + ')';
    x.fillStyle = tint(m1.n); x.fillRect(0, 0, W, O.y);
    x.fillStyle = tint(m2.n); x.fillRect(0, O.y, W, H - O.y);
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(0, O.y); x.lineTo(W, O.y); x.stroke();
    x.font = '11px "IBM Plex Mono", monospace'; x.fillStyle = 'rgba(255,255,255,.75)';
    x.textAlign = 'left'; x.textBaseline = 'top';
    x.fillText(m1.name + '  n = ' + nLabel(m1), 16, O.y - 22);
    x.fillText(m2.name + '  n = ' + nLabel(m2), 16, O.y + 8);

    // protractor
    const rp = Lray*0.62;
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1;
    x.beginPath(); x.arc(O.x, O.y, rp, 0, TAU); x.stroke();
    x.font = '9px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for(let d = -90; d <= 90; d += 5){
      [-1, 1].forEach(side => {               // side −1: upper half, +1: lower half
        const a = side*Math.PI/2 + d*D2R*(side < 0 ? 1 : -1);
        const major = d % 10 === 0, len = major ? 9 : 5;
        x.strokeStyle = major ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.25)';
        x.beginPath();
        x.moveTo(O.x + rp*Math.cos(a), O.y + rp*Math.sin(a));
        x.lineTo(O.x + (rp - len)*Math.cos(a), O.y + (rp - len)*Math.sin(a)); x.stroke();
        if(major && d % 30 === 0 && Math.abs(d) < 90){
          x.fillStyle = 'rgba(255,255,255,.4)';
          x.fillText(Math.abs(d), O.x + (rp + 11)*Math.cos(a), O.y + (rp + 11)*Math.sin(a));
        }
      });
    }

    // normal (true), and the misdrawn one when that error is on
    x.setLineDash([6,5]); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.25;
    x.beginPath(); x.moveTo(O.x, O.y - Lray*1.05); x.lineTo(O.x, O.y + Lray*1.05); x.stroke();
    const tilt = err.sys('tilt');
    if(tilt && err.revealed()){             // the true normal is only shown once revealed
      const t = tilt*D2R, dx = Math.sin(t)*Lray, dy = Math.cos(t)*Lray;
      x.strokeStyle = 'rgba(200,200,200,.5)';
      x.beginPath(); x.moveTo(O.x - dx, O.y - dy); x.lineTo(O.x + dx, O.y + dy); x.stroke();
      x.fillStyle = 'rgba(220,220,220,.6)'; x.textAlign = 'left';
      x.fillText('your normal', O.x - dx + 6, O.y - dy + 8);
    }
    x.setLineDash([]);

    const a1 = th1*D2R, a2deg = refract(th1, m1.n, m2.n), tir = a2deg == null;
    const src = {x: O.x - Lray*Math.sin(a1), y: O.y - Lray*Math.cos(a1)};
    const ray = (x1, y1, x2, y2, col, w, alpha) => {
      x.globalAlpha = alpha; x.strokeStyle = col; x.fillStyle = col; x.lineWidth = w;
      x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
      const mx = (x1 + x2)/2, my = (y1 + y2)/2, ang = Math.atan2(y2 - y1, x2 - x1);
      x.beginPath(); x.moveTo(mx + 7*Math.cos(ang), my + 7*Math.sin(ang));
      x.lineTo(mx - 6*Math.cos(ang - 0.5), my - 6*Math.sin(ang - 0.5));
      x.lineTo(mx - 6*Math.cos(ang + 0.5), my - 6*Math.sin(ang + 0.5)); x.closePath(); x.fill();
      x.globalAlpha = 1;
    };

    // ray box at the source end
    x.save(); x.translate(src.x, src.y); x.rotate(Math.atan2(O.y - src.y, O.x - src.x));
    x.fillStyle = '#2a3346'; x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1;
    x.fillRect(-30, -9, 30, 18); x.strokeRect(-30, -9, 30, 18); x.restore();

    ray(src.x, src.y, O.x, O.y, AMBER, 3, 1);
    if(tir || reflChk.checked){
      ray(O.x, O.y, O.x + Lray*Math.sin(a1), O.y - Lray*Math.cos(a1), AMBER, tir ? 3 : 1.5, tir ? 1 : .35);
    }
    if(!tir){
      const a2 = a2deg*D2R;
      ray(O.x, O.y, O.x + Lray*Math.sin(a2), O.y + Lray*Math.cos(a2), RED, 3, 1);
    }

    // angle arcs and labels
    x.lineWidth = 1.5; x.font = '600 12px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
    if(th1 > 0.5){
      x.strokeStyle = AMBER; x.beginPath(); x.arc(O.x, O.y, 46, -Math.PI/2 - a1, -Math.PI/2); x.stroke();
      x.fillStyle = AMBER; x.textAlign = 'right';
      x.fillText('θ₁ ' + th1.toFixed(1) + '°', O.x - 8 - 52*Math.sin(a1/2), O.y - 56*Math.cos(a1/2));
    }
    if(!tir && a2deg > 0.5){
      const a2 = a2deg*D2R;
      x.strokeStyle = RED; x.beginPath(); x.arc(O.x, O.y, 46, Math.PI/2 - a2, Math.PI/2); x.stroke();
      x.fillStyle = RED; x.textAlign = 'left';
      x.fillText('θ₂ ' + a2deg.toFixed(1) + '°', O.x + 8 + 52*Math.sin(a2/2), O.y + 56*Math.cos(a2/2));
    }
    if(tir){
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '600 13px "IBM Plex Mono", monospace';
      x.fillText('Total internal reflection', O.x, O.y + 40);
    }
  }

  /* ---------- graphs ---------- */
  const PAD = {l:40, r:10, t:12, b:20};
  function frame(c){
    if(PL.hidden(c)) return null;
    const x = sizeCanvas(c), W = c.clientWidth, H = c.clientHeight;
    x.clearRect(0,0,W,H);
    return {x, x0:PAD.l, y0:H-PAD.b, w:W-PAD.l-PAD.r, h:H-PAD.t-PAD.b};
  }
  function axes(f, xMax, yMax, xLab, yLab, dp){
    const {x,x0,y0,w,h} = f;
    x.font = '9px "IBM Plex Mono", monospace'; x.lineWidth = 1;
    for(let i = 0; i <= 2; i++){
      const v = yMax*i/2, y = Math.round(y0 - v/yMax*h) + .5;
      x.strokeStyle = 'rgba(21,24,28,.14)'; x.beginPath(); x.moveTo(x0,y); x.lineTo(x0+w,y); x.stroke();
      x.fillStyle = '#6E7681'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText(v.toFixed(dp), x0-4, y);
    }
    x.strokeStyle = 'rgba(21,24,28,.5)'; x.beginPath(); x.moveTo(x0+.5,PAD.t); x.lineTo(x0+.5,y0+.5); x.stroke();
    x.fillStyle = '#6E7681'; x.textBaseline = 'top';
    x.textAlign = 'left'; x.fillText('0', x0, y0+4);
    x.textAlign = 'right'; x.fillText(xLab, x0+w, y0+4);
    x.textAlign = 'left'; x.fillText(yLab, x0+3, 1);
  }
  const map = (f, xMax, yMax) => [v => f.x0 + v/xMax*f.w, v => f.y0 - v/yMax*f.h];
  function dots(f, xMax, yMax, list, col, r){
    const [PX, PY] = map(f, xMax, yMax);
    f.x.fillStyle = col;
    list.forEach(p => { f.x.beginPath(); f.x.arc(PX(p.x), PY(p.y), r, 0, TAU); f.x.fill(); });
  }
  function line(f, xMax, yMax, fn, col, w, dash){
    const [PX, PY] = map(f, xMax, yMax), x = f.x;
    x.save(); x.beginPath(); x.rect(f.x0, PAD.t, f.w, f.h); x.clip();
    x.strokeStyle = col; x.lineWidth = w; if(dash) x.setLineDash(dash);
    x.beginPath(); let started = false;
    for(let i = 0; i <= 180; i++){
      const t = xMax*i/180, v = fn(t);
      if(v == null){ started = false; continue; }
      started ? x.lineTo(PX(t), PY(v)) : x.moveTo(PX(t), PY(v)); started = true;
    }
    x.stroke(); x.restore();
  }

  function drawGraphs(){
    const pts = points(), a2 = refract(th1, m1.n, m2.n);

    // θ2 against θ1 — a curve, not a straight line
    const f1 = frame($('g1'));
    if(f1){
      axes(f1, 90, 90, 'θ₁ 90°', 'θ₂ °', 0);
      if(!secret()) line(f1, 90, 90, t => refract(t, m1.n, m2.n), 'rgba(21,24,28,.35)', 1.5);
      dots(f1, 90, 90, pts.map(p => ({x:p.t1, y:p.t2})), RED, 3.2);
      if(a2 != null) dots(f1, 90, 90, [{x:th1, y:a2}], AMBER, 4.2);
    }
    $('g1now').textContent = a2 == null ? 'TIR' : 'θ₂ = ' + a2.toFixed(1) + '°';

    // sinθ1 against sinθ2 — straight, gradient n2/n1
    const f2 = frame($('g2'));
    const xy = pts.map(p => ({x: Math.sin(p.t2*D2R), y: Math.sin(p.t1*D2R)}));
    const fit = fitLine(xy);
    if(f2){
      axes(f2, 1, 1, 'sin θ₂  1.0', 'sin θ₁', 1);
      if(!secret()) line(f2, 1, 1, s => s*m2.n/m1.n, 'rgba(21,24,28,.3)', 1.25, [5,4]);
      if(fit) line(f2, 1, 1, s => fit.m*s + fit.c, NAVY, 2);
      dots(f2, 1, 1, xy, RED, 3.2);
      if(a2 != null) dots(f2, 1, 1, [{x:Math.sin(a2*D2R), y:Math.sin(th1*D2R)}], AMBER, 4.2);
    }
    $('g2now').textContent = fit ? 'gradient ' + fit.m.toFixed(3) + ' = n₂/n₁' : 'record to fit';
    return fit;
  }

  /* ---------- panel ---------- */
  function readouts(){
    const a2 = refract(th1, m1.n, m2.n), crit = critical();
    $('read').innerHTML = a2 == null ? 'TIR' : a2.toFixed(1) + '<small>°</small>';
    $('sub').textContent = a2 == null
      ? 'θ₁ is past the critical angle (' + crit.toFixed(1) + '°)'
      : nLabel(m1) + ' × sin ' + th1.toFixed(1) + '° = ' + nLabel(m2) + ' × sin ' + a2.toFixed(1) + '°';
    $('n').textContent = nLabel(m1) + ' · ' + nLabel(m2);
    $('sin1').textContent = Math.sin(th1*D2R).toFixed(4);
    $('sin2').textContent = a2 == null ? '—' : Math.sin(a2*D2R).toFixed(4);
    $('ratio').textContent = a2 == null || th1 === 0 ? '—' : (Math.sin(th1*D2R)/Math.sin(a2*D2R)).toFixed(4);
    $('crit').textContent = crit == null ? 'none (n₁ < n₂)' : crit.toFixed(1) + '°';
    $('v2').textContent = m2.hidden ? '?' : (C/m2.n/1e8).toFixed(3) + ' ×10⁸ m/s';
  }

  function render(){
    const pts = points(), n = pts.length;
    btnClear.disabled = btnExport.disabled = n === 0;
    const fit = drawGraphs();
    if(!n){
      $('log').innerHTML = '<div class="empty">No readings yet. Record θ₂ at several angles of incidence.</div>';
      $('big').innerHTML = '—';
      $('bignote').textContent = 'Record θ₂ at several angles of incidence.';
      return;
    }
    const last = pts[n-1];
    const nEst = fit ? m1.n*fit.m : m1.n*Math.sin(last.t1*D2R)/Math.sin(last.t2*D2R);
    $('big').innerHTML = 'n₂ = ' + (isFinite(nEst) ? nEst.toFixed(3) : '—');
    const err = (nEst - m2.n)/m2.n*100;
    $('bignote').innerHTML = (fit ? 'From the gradient of sin θ₁ vs sin θ₂ over ' + n + ' readings'
                                  : 'From one reading · record more angles for a gradient') +
      (secret() || !isFinite(err) ? ' · true value hidden — compare with other groups'
                                   : ' · <b>' + PL.signed(err, 1) + '%</b> from ' + m2.n.toFixed(3));
    $('log').innerHTML = '<div class="row hd"><span>#</span><span>θ₁</span><span>θ₂</span><span>sinθ₁/sinθ₂</span></div>' +
      pts.map((p,i) => '<div class="row"><span class="n">' + pad2(i+1) + '</span>' +
        '<span>' + p.t1.toFixed(1) + '°</span><span>' + p.t2.toFixed(1) + '°</span>' +
        '<span class="g">' + (p.t2 > 0 ? (Math.sin(p.t1*D2R)/Math.sin(p.t2*D2R)).toFixed(3) : '—') + '</span></div>').reverse().join('');
  }

  function redraw(){ drawStage(); readouts(); render(); }

  /* ---------- inputs ---------- */
  const opts = MATERIALS.map(m => '<option value="' + m.id + '">' + m.name + (m.hidden ? '' : ' (n = ' + m.n.toFixed(2) + ')') + '</option>').join('');
  m1Sel.innerHTML = opts; m2Sel.innerHTML = opts;
  m1Sel.value = m1.id; m2Sel.value = m2.id;
  m1Sel.addEventListener('change', () => { m1 = MATERIALS.find(m => m.id === m1Sel.value); redraw(); });
  m2Sel.addEventListener('change', () => { m2 = MATERIALS.find(m => m.id === m2Sel.value); redraw(); });

  function setAngle(a, from){
    th1 = Math.min(89, Math.max(0, a));
    if(from !== 'num') angNum.value = Math.round(th1*10)/10;
    if(from !== 'range') angIn.value = th1;
    redraw();
  }
  angIn.addEventListener('input', () => setAngle(+angIn.value, 'range'));
  angNum.addEventListener('input', () => { const v = parseFloat(angNum.value); if(isFinite(v)) setAngle(v, 'num'); });
  angNum.addEventListener('blur', () => angNum.value = Math.round(th1*10)/10);
  reflChk.addEventListener('change', drawStage);
  spreadIn.addEventListener('input', () => $('spreadOut').textContent = (+spreadIn.value).toFixed(1) + '°');

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = cv.getBoundingClientRect();
      const dx = (ev.clientX - r.left) - O.x, dy = O.y - (ev.clientY - r.top);
      if(dy <= 2) return;                      // aim from the top half only
      setAngle(Math.round(Math.atan(Math.abs(dx)/dy)*R2D*2)/2);
    };
    const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
    move(e);
  });

  /* ---------- recording ---------- */
  function recordAt(a){
    const t2 = measure(a);
    if(t2 == null) return false;              // no refracted ray to measure
    points().push({t1: a, t2});
    return true;
  }
  btnRec.addEventListener('click', () => {
    if(!recordAt(th1)) $('bignote').textContent = 'No refracted ray at this angle — total internal reflection.';
    else render();
  });
  btnSweep.addEventListener('click', () => { for(let a = 10; a <= 70; a += 10) recordAt(a); render(); });
  btnClear.addEventListener('click', () => { sets[pairKey()] = []; render(); });
  btnExport.addEventListener('click', () => {
    downloadCSV('snells-law.csv', [['reading','medium_1','n1','medium_2','n2','theta1_deg','theta2_deg','sin_theta1','sin_theta2']]
      .concat(points().map((p,i) => [i+1, m1.name, m1.hidden ? '' : m1.n, m2.name, m2.hidden ? '' : m2.n,
        p.t1.toFixed(1), p.t2.toFixed(1), Math.sin(p.t1*D2R).toFixed(4), Math.sin(p.t2*D2R).toFixed(4)])));
  });

  window.addEventListener('resize', redraw);
  redraw();
})();
