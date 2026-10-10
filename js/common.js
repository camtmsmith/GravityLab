/* =====================================================================
   Shared helpers for every lab. Loaded first; each lab reads from PL.
   ===================================================================== */
window.PL = (function(){
  "use strict";
  const TAU = Math.PI*2;

  const COLORS = {
    cyan:'#5BC8D8', red:'#E8442B', amber:'#F2B134', navy:'#123E6B', muted:'#6E7681'
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // id lookup with an optional per-lab prefix: const $ = PL.byPrefix('j_')
  const byPrefix = prefix => id => document.getElementById(prefix + id);

  // match a canvas's backing store to its CSS size at the device pixel ratio
  function sizeCanvas(c){
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth*dpr; c.height = c.clientHeight*dpr;
    const x = c.getContext('2d');
    x.setTransform(dpr,0,0,dpr,0,0);
    return x;
  }

  // a canvas is zero-sized while its tab is hidden
  const hidden = c => c.clientWidth < 40 || c.clientHeight < 40;

  // normally distributed random number (Box–Muller)
  function gauss(mu, sigma){
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return mu + sigma*Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);
  }

  // least-squares straight line through {x,y} points; null if x never varies
  function fitLine(pts){
    const n = pts.length;
    if(n < 2) return null;
    let sx=0, sy=0, sxy=0, sxx=0;
    pts.forEach(p => { sx+=p.x; sy+=p.y; sxy+=p.x*p.y; sxx+=p.x*p.x; });
    const den = n*sxx - sx*sx;
    if(Math.abs(den) < 1e-12*Math.max(1, n*sxx)) return null;
    const m = (n*sxy - sx*sy)/den;
    return {m, c:(sy - m*sx)/n};
  }

  // a "nice" tick spacing giving roughly n ticks across span
  function niceStep(span, n){
    const raw = Math.max(span,1e-6)/n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw/p;
    return (f<1.5?1:f<3?2:f<7?5:10)*p;
  }

  function arrow(x, x1, y1, x2, y2, color, w, head){
    const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy), hd = head || 8;
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = w;
    x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2,y2); x.stroke();
    if(len < 6) return;
    const a = Math.atan2(dy,dx);
    x.beginPath(); x.moveTo(x2,y2);
    x.lineTo(x2 - hd*Math.cos(a-0.4), y2 - hd*Math.sin(a-0.4));
    x.lineTo(x2 - hd*Math.cos(a+0.4), y2 - hd*Math.sin(a+0.4));
    x.closePath(); x.fill();
  }

  // rows: array of arrays; the first row is the header
  function downloadCSV(filename, rows){
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  }

  // a row of aria-pressed buttons; onPick gets the clicked button's dataset.
  // locked() returning true ignores clicks (e.g. mid-animation).
  function segmented(el, onPick, locked){
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if(!b || (locked && locked())) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      onPick(b.dataset, b);
    });
  }

  // "Add measurement error" switch: off = exact theory, on = reveal the error controls.
  // Returns a function telling the lab whether errors are currently on.
  function errorToggle(chk, box, onChange){
    const apply = () => { box.hidden = !chk.checked; };
    chk.addEventListener('change', () => { apply(); if(onChange) onChange(); });
    apply();
    return () => chk.checked;
  }

  // +1.2 / −0.4, and never "-0.0" from a rounding remainder
  const signed = (v, dp) => { const r = Number(v.toFixed(dp)) || 0; return (r >= 0 ? '+' : '') + r.toFixed(dp); };
  const pad2 = i => String(i).padStart(2,'0');

  return {TAU, COLORS, reduced, byPrefix, sizeCanvas, hidden, gauss, fitLine, niceStep,
          arrow, downloadCSV, segmented, errorToggle, signed, pad2};
})();
