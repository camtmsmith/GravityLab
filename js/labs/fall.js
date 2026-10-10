/* =====================================================================
   FREE FALL LAB — drop a ball, time it by hand, find g
   ===================================================================== */
(function(){
  "use strict";
  const {gauss, sizeCanvas, downloadCSV, segmented, pad2} = PL;

  const G = 9.81, MAX_H = 4.5, MIN_H = 0.05, BALL = 34;
  const $ = id => document.getElementById(id);

  const stage=$('stage'), tower=$('tower'), ball=$('ball'), hline=$('hline'),
        watch=$('watch'), hRead=$('hRead'), log=$('log');
  const heightIn=$('height'), uncIn=$('unc');
  const reactOut=$('reactOut'), biasOut=$('biasOut');
  const btnDrop=$('drop'), btnRand=$('randomH'), btnExport=$('export'), btnClear=$('clear');
  const reactIn=$('react'), biasIn=$('bias'), resIn=$('res'), tRead=$('tRead');
  const NOMINAL_LAG = 0.20;      // typical thumb lag; cancels between the two presses

  let height = 1.25;      // metres above the floor
  let trials = [];        // {t, h}
  let pxPerM = 100;
  let dropping = false;
  let rate = 1;                    // playback speed: 1 = real time, 0.1 = ten times slower
  const vRead = $('vRead');
  const auxToggle = $('aux');

  auxToggle.addEventListener('change', () => { if(!dropping) idleGraphs(); });

  segmented($('speed'), d => rate = parseFloat(d.rate), () => dropping);
  const reduced = PL.reduced;

  /* ---------- ruler ---------- */
  function layout(){
    if(tower.clientHeight < 40) return;                        // tab is hidden
    pxPerM = (tower.clientHeight - BALL) / MAX_H;
    tower.querySelectorAll('.tick,.tlabel').forEach(n => n.remove());
    const frag = document.createDocumentFragment();
    for(let cm = 0; cm <= MAX_H*100; cm += 5){
      const y = (cm/100) * pxPerM;
      const t = document.createElement('div');
      const major = cm % 50 === 0, mid = cm % 10 === 0;
      t.className = 'tick' + (major ? ' major' : mid ? ' mid' : '');
      t.style.bottom = y + 'px';
      t.style.width = (major ? 34 : mid ? 22 : 14) + 'px';
      t.style.marginLeft = '-' + (major ? 17 : mid ? 11 : 7) + 'px';
      frag.appendChild(t);
      if(major){
        const l = document.createElement('div');
        l.className = 'tlabel mono';
        l.textContent = (cm/100).toFixed(1);
        l.style.bottom = y + 'px';
        l.style.transform = 'translateY(50%)';
        frag.appendChild(l);
      }
    }
    tower.insertBefore(frag, ball);
    place(height);
  }

  function place(h){
    const y = h * pxPerM;
    ball.style.bottom = y + 'px';
    hline.style.bottom = y + 'px';
  }

  function setHeight(h, fromInput){
    if(!dropping) clearStrobes();
    height = Math.min(MAX_H, Math.max(MIN_H, h));
    place(height);
    ball.setAttribute('aria-valuenow', height.toFixed(3));
    hRead.textContent = 'release height ' + height.toFixed(3) + ' m';
    if(!fromInput) heightIn.value = height.toFixed(3);
    if(!dropping) idleGraphs();
  }

  /* ---------- drag & keyboard ---------- */
  ball.addEventListener('pointerdown', e => {
    if(dropping) return;
    ball.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = tower.getBoundingClientRect();
      setHeight((r.bottom - ev.clientY - BALL/2) / pxPerM);
    };
    const up = ev => {
      ball.releasePointerCapture(e.pointerId);
      ball.removeEventListener('pointermove', move);
      ball.removeEventListener('pointerup', up);
    };
    ball.addEventListener('pointermove', move);
    ball.addEventListener('pointerup', up);
    move(e);
  });

  ball.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if(e.key === 'ArrowUp'){ setHeight(height + step); e.preventDefault(); }
    if(e.key === 'ArrowDown'){ setHeight(height - step); e.preventDefault(); }
    if(e.key === 'Enter' || e.key === ' '){ drop(); e.preventDefault(); }
  });

  heightIn.addEventListener('input', () => {
    const v = parseFloat(heightIn.value);
    if(isFinite(v)) setHeight(v, true);
  });
  heightIn.addEventListener('blur', () => setHeight(height));
  reactIn.addEventListener('input', () =>
    reactOut.textContent = (+reactIn.value).toFixed(3) + ' s');
  biasIn.addEventListener('input', () =>
    biasOut.textContent = ((+biasIn.value) >= 0 ? '+' : '') + (+biasIn.value).toFixed(3) + ' s');

  /* ---------- physics ---------- */
  function drop(){
    if(dropping) return;

    const dh    = Math.max(0, parseFloat(uncIn.value) || 0);   // height measurement error
    const sigma = +reactIn.value;                              // spread on each button press
    const bias  = +biasIn.value;                               // net late-stop tendency

    // --- what actually happens ---
    const hRec  = height;                              // the height as recorded, frozen for this drop
    const hTrue = Math.max(0.001, gauss(hRec, dh));    // the ball is not quite where you think
    const tTrue = Math.sqrt(2*hTrue/G);                 // the real fall, governed by real g

    // --- what the human records ---
    // Two independent presses. The start delay largely cancels the stop delay, so the
    // NOMINAL lag drops out and only the spread (and any bias) survives into the reading.
    const dStart = NOMINAL_LAG + gauss(0, sigma);
    const dStop  = NOMINAL_LAG + gauss(0, sigma) + bias;
    let reading  = Math.max(0.001, tTrue + (dStop - dStart));
    if(resIn.checked) reading = Math.round(reading*100)/100;   // digital watch quantisation

    dropping = true;
    btnDrop.disabled = btnRand.disabled = true;
    ball.classList.remove('armed');

    animate(tTrue, dStart, tTrue + dStop, reading, () => {
      dropping = false;
      btnDrop.disabled = btnRand.disabled = false;
      ball.classList.add('armed');
      record(reading, hRec, tTrue);
      place(height);
    });
  }

  function clearStrobes(){
    tower.querySelectorAll('.strobe').forEach(n => n.remove());
  }

  function addStrobe(h, label){
    const s = document.createElement('div');
    s.className = 'strobe';
    s.style.left = ball.offsetLeft + 'px';
    s.style.bottom = (h * pxPerM) + 'px';
    s.innerHTML = '<span>' + label + '</span>';
    tower.appendChild(s);
  }

  // tTrue: real fall duration. wStart/wStop: when the human's thumb actually moves.
  function animate(tTrue, wStart, wStop, reading, done){
    const h0 = height;
    clearStrobes();

    const span = Math.max(tTrue, wStop) + 0.05;     // run on until the watch is stopped
    const strobeStep = rate < 1 ? 0.1 : 0;
    let nextStrobe = strobeStep;

    const showWatch = tau => {
      const v = tau < wStart ? 0 : tau > wStop ? reading : tau - wStart;
      watch.innerHTML = v.toFixed(resIn.checked ? 2 : 3) + '<small>s</small>';
    };
    const finish = () => {
      place(0);
      watch.innerHTML = reading.toFixed(resIn.checked ? 2 : 3) + '<small>s</small>';
      tRead.textContent = 'true fall ' + tTrue.toFixed(4) + ' s  ·  read ' +
                          (reading >= tTrue ? '+' : '') + (reading - tTrue).toFixed(3) + ' s';
      vRead.textContent = (G*tTrue).toFixed(2) + ' m/s at impact';
      drawGraphs(G, tTrue, tTrue);
      setTimeout(done, rate < 1 ? 600 : 200);
    };

    if(reduced && rate === 1){ finish(); return; }

    const t0 = performance.now();
    (function frame(now){
      const tau = Math.min(span, ((now - t0)/1000) * rate);   // elapsed real time since release
      const fall = Math.min(tau, tTrue);
      const frac = fall / tTrue;

      place(h0 * (1 - frac*frac));                            // quadratic fall
      showWatch(tau);
      vRead.textContent = (G*fall).toFixed(2) + ' m/s';
      drawGraphs(G, tTrue, fall);

      while(strobeStep && fall >= nextStrobe && nextStrobe < tTrue){
        addStrobe(h0 * (1 - (nextStrobe/tTrue)**2), nextStrobe.toFixed(1) + ' s');
        nextStrobe += strobeStep;
      }

      if(tau < span) requestAnimationFrame(frame);
      else finish();
    })(t0);
  }

  /* ---------- graphs ---------- */
  const PLOTS = [
    {c:$('gD'), out:$('nD'), unit:' m',    f:(tau,a,T)=>0.5*a*tau*tau, top:(a,T)=>0.5*a*T*T, tangent:true},
    {c:$('gV'), out:$('nV'), unit:' m/s',  f:(tau,a)=>a*tau,           top:(a,T)=>a*T,
      area:true, areaVal:(tau,a)=>0.5*a*tau*tau, areaUnit:' m'},
    {c:$('gA'), out:$('nA'), unit:' m/s²', f:(tau,a)=>a,               top:(a)=>Math.max(12, a*1.35),
      area:true, areaVal:(tau,a)=>a*tau,         areaUnit:' m/s'}
  ];
  const AUX = '#123E6B';
  const PAD = {l:26, r:6, t:6, b:16};

  // a = acceleration for this fall, T = total fall time, tau = time to trace to (or null)
  function drawGraphs(a, T, tau){
    if($('gD').clientWidth < 40) return;                       // tab is hidden
    const aux = auxToggle.checked;
    PLOTS.forEach(p => {
      const x = sizeCanvas(p.c);
      const W = p.c.clientWidth, H = p.c.clientHeight;
      const x0 = PAD.l, y0 = H - PAD.b, w = W - PAD.l - PAD.r, h = H - PAD.t - PAD.b;
      const yMax = p.top(a, T) || 1;
      const px = t => x0 + (t/T) * w;
      const py = v => y0 - (v/yMax) * h;

      x.clearRect(0, 0, W, H);

      // grid + axis labels
      x.strokeStyle = 'rgba(21,24,28,.14)';
      x.fillStyle = '#6E7681';
      x.font = '9px "IBM Plex Mono", monospace';
      x.lineWidth = 1;
      for(let i = 0; i <= 2; i++){
        const v = yMax * i/2, y = Math.round(py(v)) + .5;
        x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + w, y); x.stroke();
        x.textAlign = 'right'; x.textBaseline = 'middle';
        x.fillText(v.toFixed(v < 10 ? 1 : 0), x0 - 5, y);
      }
      x.strokeStyle = 'rgba(21,24,28,.5)';
      x.beginPath(); x.moveTo(x0 + .5, PAD.t); x.lineTo(x0 + .5, y0 + .5); x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'top';
      x.fillText('0', x0, y0 + 4);
      x.fillText(T.toFixed(2) + ' s', x0 + w - 12, y0 + 4);

      // area under the velocity curve = displacement
      if(p.area && aux && tau != null && tau > 0){
        x.fillStyle = 'rgba(18,62,107,.16)';
        x.beginPath();
        x.moveTo(px(0), y0);
        for(let i = 0; i <= 60; i++){
          const t = tau * i/60;
          x.lineTo(px(t), py(p.f(t, a, T)));
        }
        x.lineTo(px(tau), y0);
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(18,62,107,.45)';
        x.lineWidth = 1; x.stroke();
      }

      // full predicted curve, faint
      const plot = (from, to, style, width) => {
        x.strokeStyle = style; x.lineWidth = width;
        x.beginPath();
        const steps = 60;
        for(let i = 0; i <= steps; i++){
          const t = from + (to - from) * i/steps;
          const X = px(t), Y = py(p.f(t, a, T));
          i ? x.lineTo(X, Y) : x.moveTo(X, Y);
        }
        x.stroke();
      };
      plot(0, T, 'rgba(21,24,28,.22)', 1.5);

      // traced portion + playhead
      if(tau != null && tau > 0){
        plot(0, tau, '#E8442B', 2.5);

        // tangent to the displacement curve: its gradient is the instantaneous velocity
        if(p.tangent && aux){
          const v0 = p.f(tau, a, T), slope = a*tau, arm = T*0.3;
          x.strokeStyle = AUX; x.lineWidth = 1.75;
          x.setLineDash([5,3]);
          x.beginPath();
          x.moveTo(px(Math.max(0, tau - arm)), py(v0 + slope*(Math.max(0, tau - arm) - tau)));
          x.lineTo(px(Math.min(T, tau + arm)), py(v0 + slope*(Math.min(T, tau + arm) - tau)));
          x.stroke();
          x.setLineDash([]);
        }

        x.fillStyle = '#E8442B';
        x.beginPath(); x.arc(px(tau), py(p.f(tau, a, T)), 3.5, 0, 7); x.fill();

        // labels for the two constructions
        if(aux && (p.tangent || p.area)){
          x.fillStyle = AUX;
          x.font = '600 10px "IBM Plex Mono", monospace';
          x.textBaseline = 'top';
          if(p.tangent){
            x.textAlign = 'right';
            x.fillText('gradient = ' + (a*tau).toFixed(2) + ' m/s', x0 + w, PAD.t);
          }else{
            x.textAlign = 'left';
            x.fillText('area = ' + p.areaVal(tau, a).toFixed(2) + p.areaUnit, x0 + 6, PAD.t);
          }
        }
      }

      const v = p.f(tau == null ? 0 : tau, a, T);
      p.out.textContent = v.toFixed(2) + p.unit;
    });
  }

  // resting state: predicted curves for the current height at g = 9.81
  function idleGraphs(){
    drawGraphs(G, Math.sqrt(2*height/G), null);
  }


  /* ---------- data ---------- */
  function record(reading, h, tTrue){
    // g is computed the way a student would: from the height they wrote down and the
    // time their stopwatch showed. Both carry error, and that is the point.
    trials.push({t: reading, h: h, tTrue: tTrue, g: 2*h/(reading*reading)});
    render();
  }

  function render(){
    const n = trials.length;
    btnExport.disabled = btnClear.disabled = n === 0;

    if(n === 0){
      log.innerHTML = '<div class="empty">No trials yet. Drop the ball to start recording.</div>';
      $('sN').textContent = '0';
      $('sMean').textContent = $('sSD').textContent = $('sSE').textContent = '—';
      $('sTrue').textContent = '—';
      $('gVal').innerHTML = '—<small>m/s²</small>';
      $('gErr').textContent = 'Measured g appears after the first drop.';
      return;
    }

    const ts = trials.map(x => x.t);
    const mean = ts.reduce((a,b)=>a+b,0)/n;
    const sd = n > 1 ? Math.sqrt(ts.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)) : 0;
    const se = n > 1 ? sd/Math.sqrt(n) : 0;

    const hMean = trials.reduce((a,x)=>a+x.h,0)/n;
    const trueMean = trials.reduce((a,x)=>a+x.tTrue,0)/n;
    const gMeas = 2*hMean/(mean*mean);
    const err = (gMeas - G)/G*100;

    $('sN').textContent = n;
    $('sMean').textContent = mean.toFixed(4) + ' s';
    $('sSD').textContent = n > 1 ? sd.toFixed(4) + ' s' : '—';
    $('sSE').textContent = n > 1 ? '± ' + se.toFixed(4) + ' s' : '—';
    $('sTrue').textContent = trueMean.toFixed(4) + ' s';

    $('gVal').innerHTML = gMeas.toFixed(2) + '<small>m/s²</small>';
    $('gErr').innerHTML = 'From mean time over ' + n + ' trial' + (n>1?'s':'') +
                          ' · <b>' + (err>=0?'+':'') + err.toFixed(1) + '%</b> from 9.81';

    log.innerHTML = trials.map((x,i)=>
      '<div class="row"><span class="n">' + pad2(i+1) + '</span>' +
      '<span>' + x.t.toFixed(4) + ' s</span>' +
      '<span class="g">' + x.g.toFixed(2) + '</span></div>'
    ).reverse().join('');
  }

  /* ---------- buttons ---------- */
  btnDrop.addEventListener('click', drop);

  btnRand.addEventListener('click', () => {
    if(dropping) return;
    setHeight(Math.round((0.5 + Math.random()*3.5)*1000)/1000);
  });

  btnClear.addEventListener('click', () => { trials = []; render(); });

  btnExport.addEventListener('click', () => {
    downloadCSV('freefall-trials.csv', [['trial','height_m','stopwatch_s','true_fall_s','timing_error_s','g_m_s2']]
      .concat(trials.map((x,i)=>[i+1, x.h.toFixed(3), x.t.toFixed(3),
                                 x.tTrue.toFixed(4), (x.t-x.tTrue).toFixed(4), x.g.toFixed(3)])));
  });

  window.addEventListener('resize', () => { layout(); if(!dropping) idleGraphs(); });
  layout();
  setHeight(1.25);
  idleGraphs();
  render();
})();
