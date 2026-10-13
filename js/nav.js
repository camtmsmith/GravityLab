/* =====================================================================
   NAVIGATION — unit tabs along the top, experiment tabs beneath.
   To add an experiment: give it a lab id here and a matching
   <div class="lab" id="..."> in index.html. Experiments with no lab
   show the "coming soon" panel with their blurb.
   ===================================================================== */
(function(){
  "use strict";

  const UNITS = [
    {id:'unit-1', name:'Unit 1', sub:'Thermal · nuclear · electrical', exps:[
      {id:'heat-capacity', name:'Heat capacity',
       blurb:'Heat a block or a liquid with an immersion heater, plot temperature against energy supplied, and find the specific heat capacity from c = Q / mΔT.'},
      {id:'ohms-law', name:'Ohm’s law',
       blurb:'Vary the voltage across a resistor, record the current, and find resistance from the V–I gradient. Compare an ohmic resistor with a filament lamp.'},
      {id:'radioactive-decay', name:'Radioactive decay',
       blurb:'Count decays over time and find the half-life from a plot of ln(activity) against time.'}
    ]},
    {id:'unit-2', name:'Unit 2', sub:'Linear motion · waves', exps:[
      {id:'motion-graphs', name:'Motion graphs',
       blurb:'Move an object and build displacement, velocity and acceleration–time graphs, linking them through gradients and areas.'},
      {id:'free-fall', name:'Free fall', lab:'lab-fall', tag:'free-fall timing bench · g = 9.81 m·s⁻²'},
      {id:'energy-time', name:'Energy–time graphs',
       blurb:'Track kinetic, gravitational potential and total energy through a motion to see where energy is transferred.'},
      {id:'pendulum', name:'Pendulum', lab:'lab-pend', tag:'period timing bench · g = 9.81 m·s⁻²'},
      {id:'snells-law', name:'Snell’s law', lab:'lab-snell', tag:'refraction · n₁ sinθ₁ = n₂ sinθ₂'}
    ]},
    {id:'unit-3', name:'Unit 3', sub:'Gravity · electromagnetism', exps:[
      {id:'projectiles', name:'Projectiles', mp:'MP1', lab:'lab-proj', tag:'mandatory practical 1 · projectile motion'},
      {id:'magnetic-field', name:'Magnetic field', mp:'MP2', lab:'lab-field', tag:'mandatory practical 2 · magnetic field strength'},
      {id:'force-on-wire', name:'Force on wire', mp:'MP3', lab:'lab-mag', tag:'mandatory practical 3 · F = BIL sinθ'}
    ]},
    {id:'unit-4', name:'Unit 4', sub:'Revolutions in modern physics', exps:[
      {id:'photoelectric', name:'Photoelectric effect',
       blurb:'Shine light of different frequencies on a metal, measure the stopping voltage, and find Planck’s constant and the work function from the gradient.'}
    ]},
    {id:'tools', name:'Data generator', sub:'All units', exps:[
      {id:'data', name:'Dataset generator', lab:'lab-data', tag:'dataset generator'}
    ]}
  ];

  // old single-level links keep working
  const LEGACY = {'#freefall':'unit-2/free-fall', '#pendulum':'unit-2/pendulum', '#projectile':'unit-3/projectiles',
                  '#field':'unit-3/magnetic-field', '#magnetism':'unit-3/force-on-wire', '#data':'tools/data'};

  const unitTabs = document.getElementById('unitTabs'), expTabs = document.getElementById('expTabs');
  const labs = [...document.querySelectorAll('.lab')];
  const lastExp = {};                  // remembered experiment per unit
  let cur = {unit: null, exp: null};

  unitTabs.innerHTML = UNITS.map(u =>
    '<button role="tab" data-unit="' + u.id + '"><span class="unit">' + u.sub + '</span>' + u.name + '</button>').join('');

  function show(unitId, expId, push){
    const unit = UNITS.find(u => u.id === unitId) || UNITS[2];
    const exp = unit.exps.find(e => e.id === expId) || unit.exps.find(e => e.id === lastExp[unit.id]) ||
                unit.exps.find(e => e.lab) || unit.exps[0];
    cur = {unit: unit.id, exp: exp.id};
    lastExp[unit.id] = exp.id;

    unitTabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.unit === unit.id));
    expTabs.innerHTML = unit.exps.map(e =>
      '<button role="tab" data-exp="' + e.id + '" aria-selected="' + (e.id === exp.id) + '">' +
      (e.mp ? '<span class="mp">' + e.mp + '</span>' : '') + e.name +
      (e.lab ? '' : '<span class="soon">soon</span>') + '</button>').join('');

    const labId = exp.lab || 'lab-soon';
    if(!exp.lab){
      document.getElementById('soonUnit').textContent = unit.name + ' · coming soon';
      document.getElementById('soonTitle').textContent = exp.name;
      document.getElementById('soonText').textContent = exp.blurb || '';
    }
    labs.forEach(l => l.hidden = l.id !== labId);
    document.getElementById('tagline').textContent =
      (unit.id === 'tools' ? '' : unit.name + ' · ') + (exp.tag || exp.name + ' · coming soon');

    // the newly revealed lab has been sized at zero until now, so ask it to redraw
    window.dispatchEvent(new Event('resize'));
    // some browsers refuse history writes on file:// URLs; the tab still works without it
    if(push) try{ history.replaceState(null, '', '#' + unit.id + '/' + exp.id); }catch(e){}
  }

  unitTabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if(b) show(b.dataset.unit, null, true);
  });
  expTabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if(b) show(cur.unit, b.dataset.exp, true);
  });

  // left/right steps through the experiments in this unit, when not typing
  document.addEventListener('keydown', e => {
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const exps = UNITS.find(u => u.id === cur.unit).exps;
    const i = exps.findIndex(x => x.id === cur.exp), step = e.key === 'ArrowRight' ? 1 : exps.length - 1;
    show(cur.unit, exps[(i + step) % exps.length].id, true);
  });

  // theory / experiment switch: click the other side to change, or the lit side to flip
  const sw = document.querySelector('.modeswitch');
  const paint = () => sw.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String((b.dataset.mode === 'experiment') === PL.experiment())));
  sw.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    const lit = b.getAttribute('aria-pressed') === 'true';
    PL.setMode(lit ? (PL.experiment() ? 'theory' : 'experiment') : b.dataset.mode);
  });
  window.addEventListener('modechange', paint);
  paint();

  // graphs start hidden under each stage; a button shows them, remembered per lab
  document.querySelectorAll('.lab .graphs').forEach(g => {
    const key = 'qp-graphs-' + g.closest('.lab').id;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'graphtoggle';
    g.before(btn);
    const set = on => {
      g.hidden = !on;
      btn.textContent = on ? 'Hide graphs' : 'Show graphs';
      btn.setAttribute('aria-expanded', String(on));
      try{ localStorage.setItem(key, on ? '1' : '0'); }catch(e){}
    };
    let on = false;
    try{ on = localStorage.getItem(key) === '1'; }catch(e){}
    set(on);
    btn.addEventListener('click', () => {
      set(g.hidden);
      // the canvases were zero-sized while hidden, so ask the lab to redraw them
      window.dispatchEvent(new Event('resize'));
    });
  });

  const hash = LEGACY[location.hash] || location.hash.slice(1);
  const [u, x] = hash.split('/');
  show(u || 'unit-3', x, false);
})();
