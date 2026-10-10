/* =====================================================================
   PROJECTILE LAB — ideal projectile motion, resolved into components.
   Up to two projectiles: B is complementary, at its own angle, or dropped from rest.
   ===================================================================== */
(function(){
  "use strict";
  const {TAU, sizeCanvas, niceStep, arrow, downloadCSV, segmented, pad2} = PL;
  const {cyan:CYAN, red:RED, amber:AMBER} = PL.COLORS;
  const G = 9.81, D2R = Math.PI/180;
  const $ = PL.byPrefix('j_');

  const cv=$('cv');
  const speedIn=$('speed'), heightIn=$('height');
  const angA=$('angle'), angANum=$('angleNum'), angB=$('angleB'), angBNum=$('angleBNum');
  const twoChk=$('two');
  const compChk=$('comp'), resChk=$('res'), trailChk=$('trail'), strobeChk=$('strobe');
  const btnLaunch=$('launch'), btnClear=$('clear'), btnExport=$('export');
  const reduced = PL.reduced;

  let speed = 20, h0 = 0, rate = 0.5;
  let bMode = 'comple';               // B: 'comple' (90° − θA), 'angle' (its own), 'drop' (released from rest)
  let flying = false, launches = [];
  let scale = 20, originX = 60, groundY = 300, velScale = 4;

  // the two projectiles; B is only in play when the checkbox is on
  const P = [
    {key:'A', angle:30, col:RED,   hi:'#ff8b76', lo:'#a52a17', trail:[]},
    {key:'B', angle:60, col:AMBER, hi:'#ffe09a', lo:'#9a6a08', trail:[]}
  ];
  const active = () => twoChk.checked ? P : [P[0]];

  /* ---------- the physics (all deterministic), per projectile p ---------- */
  // B can be dropped from rest instead of launched: same height, zero launch speed
  const dropped = p => p.key === 'B' && bMode === 'drop';
  const spd   = p => dropped(p) ? 0 : speed;
  const vx    = p => spd(p)*Math.cos(p.angle*D2R);
  const vy0   = p => spd(p)*Math.sin(p.angle*D2R);
  const tof   = p => { const u = vy0(p); return (u + Math.sqrt(u*u + 2*G*h0))/G; };
  const xAt   = (p,t) => vx(p)*Math.min(t, tof(p));
  const yAt   = (p,t) => { const tt = Math.min(t, tof(p)); return Math.max(0, h0 + vy0(p)*tt - 0.5*G*tt*tt); };
  const vyAt  = (p,t) => vy0(p) - G*Math.min(t, tof(p));
  const hmax  = p => h0 + vy0(p)*vy0(p)/(2*G);
  const range = p => vx(p)*tof(p);
  const vimp  = p => Math.hypot(vx(p), vyAt(p, tof(p)));
  const Tall  = () => Math.max(0.001, ...active().map(p => tof(p)));

  /* ---------- the stage ---------- */
  function drawStage(t){               // t = seconds into flight, or null for the idle preview
    if(cv.clientWidth < 40 || cv.clientHeight < 40) return;
    const x = sizeCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    const padL = 54, padR = 20, padTop = 24, padBot = 40;
    const ps = active();
    const xW = Math.max(1, ...ps.map(p => range(p))) * 1.08;
    const yW = Math.max(1, h0, ...ps.map(p => hmax(p))) * 1.15;
    scale = Math.min((W-padL-padR)/xW, (H-padTop-padBot)/yW);
    originX = padL; groundY = H - padBot;
    velScale = 95/Math.max(speed,1);

    const PX = mx => originX + mx*scale;
    const PY = my => groundY - my*scale;
    x.clearRect(0,0,W,H);

    // ground + horizontal distance ticks
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, groundY); x.lineTo(W, groundY); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '10px "IBM Plex Mono", monospace';
    x.textAlign = 'center'; x.textBaseline = 'top';
    const xs = niceStep(xW, 6);
    for(let d = 0; d <= xW; d += xs){
      const px = PX(d); if(px > W-6) break;
      x.strokeStyle = 'rgba(255,255,255,.18)';
      x.beginPath(); x.moveTo(px, groundY); x.lineTo(px, groundY+5); x.stroke();
      x.fillText(d.toFixed(xs<1?1:0), px, groundY+7);
    }
    // vertical height ticks up the left edge
    x.textAlign = 'right'; x.textBaseline = 'middle';
    const ys = niceStep(yW, 4);
    for(let hgt = 0; hgt <= yW; hgt += ys){
      const py = PY(hgt); if(py < padTop) break;
      x.strokeStyle = 'rgba(255,255,255,.14)';
      x.beginPath(); x.moveTo(originX-5, py); x.lineTo(W, py); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.4)';
      x.fillText(hgt.toFixed(ys<1?1:0)+'m', originX-8, py);
    }

    ps.forEach(p => {
      const T = Math.max(tof(p), 0.001);
      // predicted path, faint
      x.strokeStyle = p.key === 'A' ? 'rgba(255,255,255,.28)' : 'rgba(242,177,52,.35)';
      x.setLineDash([4,4]); x.lineWidth = 1.25;
      x.beginPath();
      for(let i = 0; i <= 120; i++){ const tt = T*i/120; (i?x.lineTo:x.moveTo).call(x, PX(xAt(p,tt)), PY(yAt(p,tt))); }
      x.stroke(); x.setLineDash([]);
      // flown trail
      if(trailChk.checked && p.trail.length > 1){
        x.strokeStyle = p.col; x.lineWidth = 2.5;
        x.beginPath(); p.trail.forEach((q,i)=> (i?x.lineTo:x.moveTo).call(x, PX(q.x), PY(q.y))); x.stroke();
      }
      // strobe marks
      if(strobeChk.checked){
        const end = Math.min(T, t == null ? T : t);
        x.strokeStyle = p.key === 'A' ? 'rgba(255,255,255,.5)' : 'rgba(242,177,52,.65)';
        for(let s = 0.2; s <= end + 1e-6; s += 0.2){
          x.beginPath(); x.arc(PX(xAt(p,s)), PY(yAt(p,s)), 3, 0, TAU); x.stroke();
        }
      }
    });

    // each ball and its vectors — at the current instant, or at the launch point when idle
    const tt = t == null ? 0 : t;
    ps.forEach(p => {
      const landed = tt >= tof(p) && t != null;
      const bx = PX(xAt(p,tt)), by = PY(yAt(p,tt));
      const vxv = vx(p), vyv = vyAt(p,tt);

      if(!landed && (compChk.checked || resChk.checked)){
        const cxEnd = bx + vxv*velScale, cyEnd = by - vyv*velScale;
        if(compChk.checked && resChk.checked){     // dashed parallelogram: components add to resultant
          x.strokeStyle = 'rgba(255,255,255,.35)'; x.setLineDash([3,3]); x.lineWidth = 1;
          x.beginPath(); x.moveTo(cxEnd, by); x.lineTo(cxEnd, cyEnd);
          x.moveTo(bx, cyEnd); x.lineTo(cxEnd, cyEnd); x.stroke(); x.setLineDash([]);
        }
        if(compChk.checked){
          arrow(x, bx, by, bx + vxv*velScale, by, CYAN, 3);      // horizontal
          arrow(x, bx, by, bx, by - vyv*velScale, RED, 3);       // vertical
        }
        if(resChk.checked) arrow(x, bx, by, cxEnd, cyEnd, p.key === 'A' ? '#fff' : AMBER, 2);
      }

      const grd = x.createRadialGradient(bx-5, by-6, 1, bx, by, 13);
      grd.addColorStop(0,p.hi); grd.addColorStop(.6,p.col); grd.addColorStop(1,p.lo);
      x.fillStyle = grd; x.strokeStyle = '#fff'; x.lineWidth = 2;
      x.beginPath(); x.arc(bx, by, 11, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = '#15181C'; x.font = '700 10px "IBM Plex Mono", monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(p.key, bx, by + .5);
    });

    // live readouts
    $('tRead').innerHTML = Math.min(tt, Tall()).toFixed(2) + '<small>s</small>';
    ps.forEach(p => {
      $('read' + p.key).textContent = p.key + ' ' + angLabel(p) + '  v ' +
        Math.hypot(vx(p), vyAt(p,tt)).toFixed(1) + ' m/s · x ' + xAt(p,tt).toFixed(1) +
        ' · y ' + yAt(p,tt).toFixed(1) + ' m';
    });
  }

  /* ---------- graphs ---------- */
  const PAD = {l:38, r:10, t:10, b:20};
  function frame(c){
    if(c.clientWidth < 40 || c.clientHeight < 40) return null;
    const x = sizeCanvas(c), W = c.clientWidth, H = c.clientHeight;
    x.clearRect(0,0,W,H);
    return {x, W, H, x0:PAD.l, y0:H-PAD.b, w:W-PAD.l-PAD.r, h:H-PAD.t-PAD.b};
  }
  function gridY(f, yMin, yMax, unit, T){
    const {x,x0,y0,w,h} = f;
    x.font = '9px "IBM Plex Mono", monospace'; x.lineWidth = 1;
    for(let i = 0; i <= 2; i++){
      const v = yMin + (yMax-yMin)*i/2, y = Math.round(y0 - (v-yMin)/(yMax-yMin)*h) + .5;
      x.strokeStyle = (Math.abs(v) < 1e-9 && yMin < 0) ? 'rgba(21,24,28,.45)' : 'rgba(21,24,28,.14)';
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0+w, y); x.stroke();
      x.fillStyle = '#6E7681'; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillText(v.toFixed(0), x0-5, y);
    }
    x.strokeStyle = 'rgba(21,24,28,.5)';
    x.beginPath(); x.moveTo(x0+.5, PAD.t); x.lineTo(x0+.5, y0+.5); x.stroke();
    x.fillStyle='#6E7681'; x.textAlign='left'; x.textBaseline='top'; x.fillText(unit, x0+2, PAD.t);
    x.textAlign='right'; x.fillText(T.toFixed(2)+' s', x0+w, y0+4);
  }
  // T = time-axis span, Tend = this projectile's own flight time, dashed = projectile B
  function series(f, T, Tend, tau, fn, yMin, yMax, color, dashed){
    const {x,x0,y0,w,h} = f;
    const PX = t => x0 + t/T*w, PY = v => y0 - (v-yMin)/(yMax-yMin)*h;
    x.strokeStyle = color; x.globalAlpha = .28; x.lineWidth = 1.25;
    x.setLineDash([4,3]);
    x.beginPath();
    for(let i=0;i<=100;i++){ const t=Tend*i/100; (i?x.lineTo:x.moveTo).call(x, PX(t), PY(fn(t))); }
    x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    if(tau != null && tau > 0){
      const end = Math.min(tau, Tend);
      x.lineWidth = dashed ? 2 : 2.25;
      if(dashed) x.setLineDash([6,4]);
      x.beginPath();
      const steps = Math.max(40, Math.round(end/T*100));
      for(let i=0;i<=steps;i++){ const t=end*i/steps; (i?x.lineTo:x.moveTo).call(x, PX(t), PY(fn(t))); }
      x.stroke(); x.setLineDash([]);
      x.fillStyle = color; x.beginPath(); x.arc(PX(end), PY(fn(end)), 3, 0, TAU); x.fill();
    }
  }

  function drawVel(tau){
    const f = frame($('gVel')); if(!f) return;
    const ps = active(), T = Tall();
    const mag = Math.max(1, ...ps.map(p => Math.max(vx(p), vy0(p), Math.abs(vyAt(p, tof(p))))));
    const yMin = -Math.ceil(mag/5)*5, yMax = Math.ceil(mag/5)*5;
    gridY(f, yMin, yMax, 'm/s', T);
    const tt = tau == null ? 0 : tau;
    ps.forEach(p => {
      const B = p.key === 'B', Te = Math.max(tof(p), 0.001);
      series(f, T, Te, tau, () => vx(p),     yMin, yMax, CYAN, B);   // horizontal: flat
      series(f, T, Te, tau, t => vyAt(p,t),  yMin, yMax, RED,  B);   // vertical: slopes by -g
    });
    $('nVel').innerHTML = ps.map(p => p.key + ' <span style="color:'+CYAN+'">vₓ '+vx(p).toFixed(1)+
      '</span> <span style="color:'+RED+'">v_y '+vyAt(p,tt).toFixed(1)+'</span>').join(' · ');
  }
  function drawPos(tau){
    const f = frame($('gPos')); if(!f) return;
    const ps = active(), T = Tall();
    const yMax = Math.max(1, ...ps.map(p => Math.max(range(p), hmax(p))))*1.1;
    gridY(f, 0, yMax, 'm', T);
    const tt = tau == null ? 0 : tau;
    ps.forEach(p => {
      const B = p.key === 'B', Te = Math.max(tof(p), 0.001);
      series(f, T, Te, tau, t => xAt(p,t), 0, yMax, CYAN, B);      // horizontal distance: straight
      series(f, T, Te, tau, t => yAt(p,t), 0, yMax, RED,  B);      // height: parabola
    });
    $('nPos').innerHTML = ps.map(p => p.key + ' <span style="color:'+CYAN+'">x '+xAt(p,tt).toFixed(1)+
      '</span> <span style="color:'+RED+'">y '+yAt(p,tt).toFixed(1)+'</span>').join(' · ');
  }

  let shownT = null;                  // the instant on screen, kept so a resize or toggle does not rewind
  function redraw(t){ shownT = t; drawStage(t); drawVel(t); drawPos(t); }

  /* ---------- keeping the panel in step with the inputs ---------- */
  const clampAng = v => Math.min(90, Math.max(0, v));
  const fmtAng = a => (Math.round(a*10)/10) + '°';
  const angLabel = p => dropped(p) ? 'dropped' : fmtAng(p.angle);

  function statsTable(){
    const ps = active();
    const rows = [
      ['Angle θ',              p => angLabel(p)],
      ['Launch speed',         p => spd(p).toFixed(1) + ' m/s'],
      ['Horizontal vₓ = v cosθ', p => vx(p).toFixed(2) + ' m/s'],
      ['Vertical v_y = v sinθ',  p => vy0(p).toFixed(2) + ' m/s'],
      ['Time of flight',       p => tof(p).toFixed(2) + ' s'],
      ['Maximum height',       p => hmax(p).toFixed(2) + ' m'],
      ['Range',                p => range(p).toFixed(2) + ' m'],
      ['Impact speed',         p => vimp(p).toFixed(2) + ' m/s']
    ];
    const el = $('stats');
    el.className = 'stats' + (ps.length > 1 ? ' three' : '');
    el.innerHTML = (ps.length > 1 ? '<dt></dt><dd class="ha">A</dd><dd class="hb">B</dd>' : '') +
      rows.map(([lbl, fn]) => '<dt>' + lbl + '</dt>' + ps.map(p => '<dd>' + fn(p) + '</dd>').join('')).join('');
  }

  function rangeCard(s){                 // s = a recorded launch, or null for the prediction
    const ps = active();
    const rA = s ? s.A.range : range(P[0]);
    $('range').innerHTML = rA.toFixed(1) + '<small>m range' + (ps.length > 1 ? ' · A' : '') + '</small>';
    const bOn = s ? !!s.B : ps.length > 1;
    $('rangeB').hidden = !bOn;
    if(bOn) $('rangeB').innerHTML = (s ? s.B.range : range(P[1])).toFixed(1) + '<small>m range · B</small>';

    let note;
    if(!s) note = 'Predicted — launch to watch it resolve into components.';
    else{
      note = 'At ' + fmtAng(s.A.angle) + (s.B && !s.B.dropped ? ' and ' + fmtAng(s.B.angle) : '') + ' from ' + s.speed.toFixed(1) + ' m/s';
      if(s.B && s.B.dropped){
        note += ', B dropped from ' + s.h0 + ' m';
        if(s.h0 === 0) note += ' · raise the launch height so B has somewhere to fall';
        else if(Math.abs(s.A.tof - s.B.tof) < 1e-9)
          note += ' · <b>both land together after ' + s.A.tof.toFixed(2) + ' s</b> — horizontal motion does not change the vertical fall';
        else note += ' · A lands at ' + s.A.tof.toFixed(2) + ' s, B at ' + s.B.tof.toFixed(2) + ' s — set θA = 0° for a horizontal launch';
      }else if(s.B && Math.abs(s.A.angle + s.B.angle - 90) < 1e-6){
        note += s.h0 === 0
          ? ' · <b>complementary angles give equal range on level ground</b> (sin 2θ = sin(180° − 2θ))'
          : ' · launched from ' + s.h0 + ' m up, so complementary angles no longer land together';
      }else if(s.A.angle === 45 && s.h0 === 0 && !s.B){
        note += ' · <b>45° gives maximum range on level ground</b>';
      }
    }
    $('rangeNote').innerHTML = note;
  }

  function syncAngles(src){
    if(src === 'Anum'){ const v = parseFloat(angANum.value); if(isFinite(v)){ P[0].angle = clampAng(v); angA.value = P[0].angle; } }
    if(src === 'A'){ P[0].angle = +angA.value; angANum.value = P[0].angle; }
    if(src === 'Bnum'){ const v = parseFloat(angBNum.value); if(isFinite(v)){ P[1].angle = clampAng(v); angB.value = P[1].angle; } }
    if(src === 'B'){ P[1].angle = +angB.value; angBNum.value = P[1].angle; }
    if(bMode === 'comple'){
      P[1].angle = Math.round((90 - P[0].angle)*1000)/1000;
      angB.value = P[1].angle; angBNum.value = P[1].angle;
    }
    angB.disabled = angBNum.disabled = bMode !== 'angle' || !twoChk.checked;
    $('bang').hidden = bMode === 'drop';
    $('bhint').textContent = {comple:'Complementary angle, same speed.', angle:'Its own angle, same speed.',
      drop:'Released from rest at the launch height, at the same moment A is fired.'}[bMode];
    $('bwrap').hidden = !twoChk.checked;
    $('legB').hidden = $('readB').hidden = !twoChk.checked;
  }

  function sync(src){
    speed = Math.max(0.1, parseFloat(speedIn.value) || 0);
    h0 = Math.max(0, parseFloat(heightIn.value) || 0);
    syncAngles(src);
    statsTable();
    if(!launches.length) rangeCard(null);
    if(!flying){ P.forEach(p => p.trail = []); redraw(null); }
  }

  speedIn.addEventListener('input', () => sync());
  heightIn.addEventListener('input', () => sync());
  angA.addEventListener('input', () => sync('A'));
  angANum.addEventListener('input', () => sync('Anum'));
  angB.addEventListener('input', () => sync('B'));
  angBNum.addEventListener('input', () => sync('Bnum'));
  [angANum, angBNum].forEach(el => el.addEventListener('blur', () => {
    el.value = Math.round(P[el === angANum ? 0 : 1].angle*1000)/1000;
  }));
  twoChk.addEventListener('change', () => { if(!flying) sync(); });
  segmented($('bmode'), d => {
    bMode = d.mode;
    if(bMode === 'drop'){                  // the classic demo: fire A horizontally, drop B, same height
      P[0].angle = 0; angA.value = 0; angANum.value = 0;
      if(!(parseFloat(heightIn.value) > 0)) heightIn.value = 10;
    }
    sync();
  }, () => flying);
  [compChk,resChk,trailChk,strobeChk].forEach(c => c.addEventListener('change', () => { if(!flying) redraw(shownT); }));
  segmented($('speedsel'), d => rate = parseFloat(d.rate), () => flying);

  /* ---------- a launch ---------- */
  function launch(){
    if(flying) return;
    sync();
    const ps = active(), T = Tall();
    const snapOf = p => ({angle: p.angle, dropped: dropped(p), speed: spd(p), range: range(p), tof: tof(p),
                          hmax: hmax(p), vimp: vimp(p)});
    const snap = {speed: speed, h0: h0, A: snapOf(P[0]), B: ps.length > 1 ? snapOf(P[1]) : null};
    flying = true; P.forEach(p => p.trail = []);
    btnLaunch.disabled = true;
    [twoChk, angA, angANum, angB, angBNum].forEach(el => el.disabled = true);

    const pushTrail = tau => ps.forEach(p => p.trail.push({x: xAt(p, tau), y: yAt(p, tau)}));
    const finish = () => {
      flying = false; btnLaunch.disabled = false;
      twoChk.disabled = angA.disabled = angANum.disabled = false;
      syncAngles();
      record(snap); redraw(T);
    };
    if(reduced){ for(let i=0;i<=60;i++) pushTrail(T*i/60); finish(); return; }

    const t0 = performance.now();
    (function step(now){
      const tau = Math.min(T, ((now-t0)/1000)*rate);
      pushTrail(tau);
      redraw(tau);
      if(tau < T) requestAnimationFrame(step); else finish();
    })(t0);
  }

  /* ---------- results ---------- */
  function record(s){
    launches.push(s);
    btnClear.disabled = btnExport.disabled = false;
    rangeCard(s);
    render();
  }

  function render(){
    const n = launches.length;
    if(!n){
      $('log').innerHTML = '<div class="empty">No launches yet. Try the same speed at 30° and 60°.</div>';
      return;
    }
    const row = (i, key, s, p) =>
      '<div class="row"><span class="n">' + pad2(i+1) + (s.B ? key : '') + '</span>' +
      '<span>' + (p.dropped ? 'drop' : fmtAng(p.angle)) + '</span>' +
      '<span>' + p.speed.toFixed(1) + ' m/s</span>' +
      '<span class="g">' + p.range.toFixed(1) + ' m</span></div>';
    $('log').innerHTML = '<div class="row hd"><span>#</span><span>angle</span><span>speed</span><span>range</span></div>' +
      launches.map((s,i) => (s.B ? row(i,'B',s,s.B) : '') + row(i,'A',s,s.A)).reverse().join('');
  }

  btnLaunch.addEventListener('click', launch);
  btnClear.addEventListener('click', () => { launches = []; render(); sync(); });
  btnExport.addEventListener('click', () => {
    const rows = [['launch','projectile','angle_deg','speed_ms','launch_height_m','vx_ms','vy_ms','time_of_flight_s','max_height_m','range_m','impact_speed_ms']];
    launches.forEach((s,i) => [['A',s.A],['B',s.B]].forEach(([k,p]) => {
      if(!p) return;
      const vxx = p.speed*Math.cos(p.angle*D2R), vyy = p.speed*Math.sin(p.angle*D2R);
      rows.push([i+1, k, p.dropped ? 'dropped' : p.angle, p.speed.toFixed(2), s.h0, vxx.toFixed(2), vyy.toFixed(2),
                 p.tof.toFixed(3), p.hmax.toFixed(3), p.range.toFixed(2), p.vimp.toFixed(2)]);
    }));
    downloadCSV('projectile-launches.csv', rows);
  });

  window.addEventListener('resize', () => { if(!flying) redraw(shownT); });
  sync();
})();
