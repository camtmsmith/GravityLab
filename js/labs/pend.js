/* =====================================================================
   PENDULUM LAB — time N swings, plot T² against L, find g
   ===================================================================== */
(function(){
  "use strict";
  const {TAU, gauss, sizeCanvas, fitLine, downloadCSV, segmented, pad2} = PL;

  const G = 9.81, MAXL = 2.0, MINL = 0.10, NOMINAL_LAG = 0.20;
  const $ = PL.byPrefix('p_');

  const cv=$('cv'), stage=$('stage'), watch=$('watch'), sub=$('sub'), countEl=$('count'), log=$('log');
  const lenIn=$('len'), uncIn=$('unc'), ampIn=$('amp'), reactIn=$('react'), biasIn=$('bias'), resIn=$('res');
  const btnRun=$('run'), btnRand=$('randomL'), btnExport=$('export'), btnClear=$('clear');
  const reduced = PL.reduced;

  let L = 1.0;            // measured length, metres
  let amp = 10;           // amplitude, degrees
  let N = 10;             // cycles per timing run
  let rate = 4;
  let running = false;
  let trials = [];
  let pxPerM = 200, pivot = {x:0, y:0};
  let liveAngle = null;   // {span, T, theta0, tNow, wStart, wStop}

  /* ---------- the physics ---------- */
  // A real pendulum is not quite isochronous: the period grows with amplitude.
  // First-order correction, exact to about 0.01% below 45 degrees.
  function ampFactor(deg){
    const th = deg*Math.PI/180;
    return 1 + th*th/16 + 11*Math.pow(th,4)/3072;
  }
  function truePeriod(len, deg){ return TAU*Math.sqrt(len/G) * ampFactor(deg); }

  /* ---------- drawing the pendulum ---------- */
  function drawStage(theta){         // theta in radians, 0 = hanging straight down
    if(cv.clientWidth < 40 || cv.clientHeight < 40) return;   // tab is hidden
    const x = sizeCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    pivot = {x: W/2, y: 46};
    pxPerM = (H - 110) / MAXL;
    x.clearRect(0,0,W,H);

    const r = L*pxPerM;
    const bx = pivot.x + r*Math.sin(theta), by = pivot.y + r*Math.cos(theta);

    // protractor arc + degree ticks
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1;
    x.beginPath(); x.arc(pivot.x, pivot.y, 74, Math.PI/2 - 0.95, Math.PI/2 + 0.95); x.stroke();
    x.font = '10px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for(let d = -45; d <= 45; d += 15){
      const a = Math.PI/2 - d*Math.PI/180;
      const c1 = Math.cos(a), s1 = Math.sin(a);
      x.strokeStyle = d === 0 ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)';
      x.beginPath(); x.moveTo(pivot.x + 68*c1, pivot.y + 68*s1);
      x.lineTo(pivot.x + 80*c1, pivot.y + 80*s1); x.stroke();
      if(d % 15 === 0 && d !== 0){
        x.fillStyle = 'rgba(255,255,255,.45)';
        x.fillText(Math.abs(d) + '°', pivot.x + 92*c1, pivot.y + 92*s1);
      }
    }

    // plumb line + swept arc at the bob radius
    x.setLineDash([4,5]); x.strokeStyle = 'rgba(255,255,255,.25)';
    x.beginPath(); x.moveTo(pivot.x, pivot.y); x.lineTo(pivot.x, pivot.y + r + 40); x.stroke();
    const th0 = amp*Math.PI/180;
    x.strokeStyle = 'rgba(232,68,43,.35)';
    x.beginPath(); x.arc(pivot.x, pivot.y, r, Math.PI/2 - th0, Math.PI/2 + th0); x.stroke();
    x.setLineDash([]);

    // rod, pivot, bob
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(pivot.x, pivot.y); x.lineTo(bx, by); x.stroke();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(pivot.x, pivot.y, 5, 0, TAU); x.fill();

    const grd = x.createRadialGradient(bx-6, by-7, 2, bx, by, 19);
    grd.addColorStop(0,'#ff8b76'); grd.addColorStop(.62,'#E8442B'); grd.addColorStop(1,'#a52a17');
    x.fillStyle = grd;
    x.beginPath(); x.arc(bx, by, 17, 0, TAU); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();

    // length label along the rod
    x.save();
    x.translate((pivot.x+bx)/2, (pivot.y+by)/2);
    x.fillStyle = 'rgba(255,255,255,.5)';
    x.font = '11px "IBM Plex Mono", monospace'; x.textAlign = 'center';
    x.fillText(L.toFixed(3) + ' m', 34, 0);
    x.restore();
  }

  /* ---------- graphs ---------- */
  const PAD = {l:34, r:8, t:8, b:20};
  function frame(c){
    if(c.clientWidth < 40 || c.clientHeight < 40) return null;   // tab is hidden
    const x = sizeCanvas(c), W = c.clientWidth, H = c.clientHeight;
    x.clearRect(0,0,W,H);
    return {x, W, H, x0:PAD.l, y0:H-PAD.b, w:W-PAD.l-PAD.r, h:H-PAD.t-PAD.b};
  }
  function axes(f, xMax, yMin, yMax, xLab, yLab){
    const {x,x0,y0,w,h} = f;
    x.font = '9px "IBM Plex Mono", monospace'; x.fillStyle = '#6E7681'; x.lineWidth = 1;
    for(let i = 0; i <= 2; i++){
      const v = yMin + (yMax-yMin)*i/2, y = Math.round(y0 - (v-yMin)/(yMax-yMin)*h) + .5;
      x.strokeStyle = 'rgba(21,24,28,.14)';
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0+w, y); x.stroke();
      x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillText(Math.abs(v) < 100 ? v.toFixed(1) : v.toFixed(0), x0-5, y);
    }
    x.strokeStyle = 'rgba(21,24,28,.5)';
    x.beginPath(); x.moveTo(x0+.5, PAD.t); x.lineTo(x0+.5, y0+.5); x.stroke();
    x.textAlign = 'left'; x.textBaseline = 'top';
    x.fillText('0', x0, y0+4);
    x.textAlign = 'right';
    x.fillText(xLab, x0+w, y0+4);
    x.save(); x.translate(9, PAD.t+2); x.textAlign='left'; x.fillText(yLab, 0, 0); x.restore();
  }

  function drawAngle(){
    const f = frame($('gAng'));
    if(!f) return;
    const {x,x0,y0,w,h} = f;
    if(!liveAngle){
      // resting preview: two cycles at the current settings
      const T = truePeriod(L, amp), span = 2*T;
      axes(f, span, -amp, amp, span.toFixed(1)+' s', 'deg');
      x.strokeStyle = 'rgba(21,24,28,.22)'; x.lineWidth = 1.5; x.beginPath();
      for(let i = 0; i <= 240; i++){
        const t = span*i/240, a = amp*Math.cos(TAU*t/T);
        const X = x0 + t/span*w, Y = y0 - (a+amp)/(2*amp)*h;
        i ? x.lineTo(X,Y) : x.moveTo(X,Y);
      }
      x.stroke();
      $('nAng').textContent = 'preview';
      return;
    }
    const {span, T, theta0, tNow, wStart, wStop} = liveAngle;
    axes(f, span, -theta0, theta0, span.toFixed(1)+' s', 'deg');
    const PX = t => x0 + t/span*w, PY = a => y0 - (a+theta0)/(2*theta0)*h;

    // the timing window: from the start press to the stop press
    x.fillStyle = 'rgba(18,62,107,.14)';
    x.fillRect(PX(wStart), PAD.t, PX(Math.min(wStop,span))-PX(wStart), h);
    x.strokeStyle = 'rgba(18,62,107,.65)'; x.lineWidth = 1.25;
    [wStart, wStop].forEach(t => {
      if(t > span) return;
      x.beginPath(); x.moveTo(PX(t), PAD.t); x.lineTo(PX(t), y0); x.stroke();
    });

    const curve = (to, style, width) => {
      x.strokeStyle = style; x.lineWidth = width; x.beginPath();
      const steps = Math.max(60, Math.round(to/span*300));
      for(let i = 0; i <= steps; i++){
        const t = to*i/steps, a = theta0*Math.cos(TAU*t/T);
        i ? x.lineTo(PX(t), PY(a)) : x.moveTo(PX(t), PY(a));
      }
      x.stroke();
    };
    curve(span, 'rgba(21,24,28,.20)', 1.25);
    if(tNow > 0){
      curve(tNow, '#E8442B', 2);
      x.fillStyle = '#E8442B';
      x.beginPath(); x.arc(PX(tNow), PY(theta0*Math.cos(TAU*tNow/T)), 3.2, 0, TAU); x.fill();
      $('nAng').textContent = (theta0*Math.cos(TAU*tNow/T)).toFixed(1) + '°';
    }
  }

  function drawFit(){
    const f = frame($('gFit'));
    if(!f) return;
    const {x,x0,y0,w,h} = f;
    const pts = trials.map(t => ({x: t.L, y: t.T*t.T}));
    const xMax = Math.max(0.5, ...pts.map(p=>p.x)) * 1.15;
    const yMax = Math.max(0.5, ...pts.map(p=>p.y), TAU*TAU*xMax/G) * 1.1;
    axes(f, xMax, 0, yMax, xMax.toFixed(2)+' m', 'T²/s²');
    const PX = v => x0 + v/xMax*w, PY = v => y0 - v/yMax*h;

    // reference: what T² vs L looks like if g is exactly 9.81
    x.setLineDash([5,4]); x.strokeStyle = 'rgba(21,24,28,.3)'; x.lineWidth = 1.25;
    x.beginPath(); x.moveTo(PX(0), PY(0)); x.lineTo(PX(xMax), PY(TAU*TAU*xMax/G)); x.stroke();
    x.setLineDash([]);

    const fit = fitLine(pts);
    if(fit && fit.m > 0){
      x.strokeStyle = '#123E6B'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(PX(0), PY(fit.c)); x.lineTo(PX(xMax), PY(fit.m*xMax + fit.c)); x.stroke();
      const gFit = TAU*TAU/fit.m;
      $('nFit').innerHTML = 'gradient ' + fit.m.toFixed(3) + ' → g = ' + gFit.toFixed(2);
    }else{
      $('nFit').textContent = pts.length ? 'vary the length' : 'no data';
    }

    x.fillStyle = '#E8442B';
    pts.forEach(p => { x.beginPath(); x.arc(PX(p.x), PY(p.y), 3.4, 0, TAU); x.fill(); });
  }

  function redrawAll(theta){ drawStage(theta); drawAngle(); drawFit(); }

  /* ---------- setting up the apparatus ---------- */
  function setApparatus(newL, newAmp){
    if(newL != null) L = Math.min(MAXL, Math.max(MINL, newL));
    if(newAmp != null) amp = Math.min(45, Math.max(2, newAmp));
    lenIn.value = L.toFixed(3);
    ampIn.value = Math.round(amp);
    $('ampOut').textContent = Math.round(amp) + '°';
    sub.textContent = 'length ' + L.toFixed(3) + ' m · amplitude ' + Math.round(amp) + '°';
    $('sAmp').textContent = '+' + ((ampFactor(amp)-1)*100).toFixed(2) + '%';
    if(!running){ liveAngle = null; redrawAll(amp*Math.PI/180); }
  }

  cv.addEventListener('pointerdown', e => {
    if(running) return;
    cv.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = cv.getBoundingClientRect();
      const dx = (ev.clientX - r.left) - pivot.x, dy = (ev.clientY - r.top) - pivot.y;
      if(dy <= 0) return;
      setApparatus(Math.hypot(dx,dy)/pxPerM, Math.abs(Math.atan2(dx,dy)*180/Math.PI));
    };
    const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
    move(e);
  });

  lenIn.addEventListener('input', () => { const v = parseFloat(lenIn.value); if(isFinite(v)) setApparatus(v, null); });
  ampIn.addEventListener('input', () => setApparatus(null, +ampIn.value));
  reactIn.addEventListener('input', () => $('reactOut').textContent = (+reactIn.value).toFixed(3) + ' s');
  biasIn.addEventListener('input', () => $('biasOut').textContent =
    ((+biasIn.value) >= 0 ? '+' : '') + (+biasIn.value).toFixed(3) + ' s');

  segmented($('cycles'), d => N = +d.n, () => running);
  segmented($('speed'), d => rate = +d.rate, () => running);

  /* ---------- a timing run ---------- */
  function startRun(){
    if(running) return;
    const dL    = Math.max(0, parseFloat(uncIn.value) || 0);
    const sigma = +reactIn.value;
    const bias  = +biasIn.value;

    // what actually happens
    const Lrec  = L, Nrec = N;                        // frozen for this run
    const Ltrue = Math.max(0.01, gauss(Lrec, dL));    // the length you did not quite measure right
    const Ttrue = truePeriod(Ltrue, amp);
    const theta0 = amp;

    // the human: released at the extreme, the watch is started on a pass through
    // the centre (fastest point, easiest to judge) and stopped N cycles later.
    const first = Ttrue/4;                             // first pass through the centre
    const dStart = NOMINAL_LAG + gauss(0, sigma);
    const dStop  = NOMINAL_LAG + gauss(0, sigma) + bias;
    const wStart = first + dStart;
    const wStop  = first + N*Ttrue + dStop;
    let total = Math.max(0.01, wStop - wStart);        // what the stopwatch shows
    if(resIn.checked) total = Math.round(total*100)/100;

    const period = total/N;                            // the measured period
    const span = Math.max(first + N*Ttrue, wStop) + 0.25;

    running = true;
    btnRun.disabled = btnRand.disabled = true;
    countEl.textContent = '0';

    const finish = () => {
      running = false;
      btnRun.disabled = btnRand.disabled = false;
      record(Lrec, Nrec, total, period, Ttrue);
      setApparatus(null, null);
    };

    if(reduced && rate <= 1){
      watch.innerHTML = total.toFixed(resIn.checked?2:3) + '<small>s</small>';
      countEl.textContent = N;
      liveAngle = {span, T:Ttrue, theta0, tNow:span, wStart, wStop};
      redrawAll(theta0*Math.PI/180);
      finish();
      return;
    }

    const t0 = performance.now();
    (function step(now){
      const t = Math.min(span, ((now - t0)/1000) * rate);
      const theta = theta0 * Math.cos(TAU*t/Ttrue) * Math.PI/180;

      const shown = t < wStart ? 0 : t > wStop ? total : t - wStart;
      watch.innerHTML = shown.toFixed(resIn.checked?2:3) + '<small>s</small>';
      countEl.textContent = Math.max(0, Math.min(N, Math.floor((t - first)/Ttrue)));

      liveAngle = {span, T:Ttrue, theta0, tNow:t, wStart, wStop};
      drawStage(theta);
      drawAngle();

      if(t < span) requestAnimationFrame(step);
      else{
        watch.innerHTML = total.toFixed(resIn.checked?2:3) + '<small>s</small>';
        countEl.textContent = N;
        drawFit();
        setTimeout(finish, 300);
      }
    })(t0);
  }

  /* ---------- results ---------- */
  function record(len, n, total, period, Ttrue){
    trials.push({L: len, N: n, total: total, T: period, Ttrue: Ttrue, g: 4*Math.PI*Math.PI*len/(period*period)});
    render();
  }

  function render(){
    const n = trials.length;
    btnExport.disabled = btnClear.disabled = n === 0;
    drawFit();

    if(n === 0){
      log.innerHTML = '<div class="empty">No runs yet. Time a run to start recording.</div>';
      $('sN').textContent = '0';
      ['sT','sTrue','sErr'].forEach(i => $(i).textContent = '—');
      $('gVal').innerHTML = '—<small>m/s²</small>';
      $('gErr').textContent = 'Measured g appears after the first run.';
      return;
    }

    const last = trials[n-1];
    $('sN').textContent = n;
    $('sT').textContent = last.T.toFixed(4) + ' s';
    $('sTrue').textContent = last.Ttrue.toFixed(4) + ' s';
    const dT = last.T - last.Ttrue;
    $('sErr').textContent = (dT >= 0 ? '+' : '') + dT.toFixed(4) + ' s';

    const fit = fitLine(trials.map(t => ({x: t.L, y: t.T*t.T})));
    let gShow, note;
    if(fit && fit.m > 0){
      gShow = TAU*TAU/fit.m;
      note = 'From the gradient of T² vs L over ' + n + ' runs';
    }else{
      gShow = last.g;
      note = 'From this run alone · vary the length for a gradient fit';
    }
    const err = (gShow - G)/G*100;
    $('gVal').innerHTML = gShow.toFixed(2) + '<small>m/s²</small>';
    $('gErr').innerHTML = note + ' · <b>' + (err>=0?'+':'') + err.toFixed(1) + '%</b> from 9.81';

    log.innerHTML = '<div class="row hd"><span>#</span><span>L (m)</span><span>T (s)</span><span>g</span></div>' +
      trials.map((t,i) =>
        '<div class="row"><span class="n">' + pad2(i+1) + '</span>' +
        '<span>' + t.L.toFixed(3) + '</span>' +
        '<span>' + t.T.toFixed(4) + '</span>' +
        '<span class="g">' + t.g.toFixed(2) + '</span></div>'
      ).reverse().join('');
  }

  /* ---------- buttons ---------- */
  btnRun.addEventListener('click', startRun);
  btnRand.addEventListener('click', () => { if(!running) setApparatus(Math.round((0.2 + Math.random()*1.6)*1000)/1000, null); });
  btnClear.addEventListener('click', () => { trials = []; render(); });
  btnExport.addEventListener('click', () => {
    downloadCSV('pendulum-runs.csv', [['run','length_m','cycles_N','stopwatch_total_s','period_s','true_period_s','error_s','g_m_s2']]
      .concat(trials.map((t,i) => [i+1, t.L.toFixed(3), t.N, t.total.toFixed(3),
              t.T.toFixed(4), t.Ttrue.toFixed(4), (t.T-t.Ttrue).toFixed(4), t.g.toFixed(3)])));
  });

  window.addEventListener('resize', () => { if(!running) redrawAll(amp*Math.PI/180); });
  setApparatus(1.0, 10);
  render();
})();
