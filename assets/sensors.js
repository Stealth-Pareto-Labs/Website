/* ============================================================
   The hardware — sensor showcase
   Static site, no build step. Three.js is dynamically imported
   only when the section scrolls into view, so it costs the page
   nothing until it is needed.

   REAL MODEL ASSETS
   -----------------
   Drop a modeller's export at  /assets/models/sensors/<file>.glb
   and set  glb:'<file>.glb'  on that sensor in FAMILY below.
   The loader picks it up and the procedural body is never built.
   No other change is required.

   SPECIFICATIONS
   --------------
   range / accuracy / output are omitted until confirmed figures
   exist. Add them to a sensor entry and the row renders itself.
   Nothing is invented here: every field shown is either supplied
   or describes geometry that is actually modelled.
   ============================================================ */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

/* ---------- the physical family, shared across all industries ---------- */
const FAMILY = {
  flow:   { name:'Pareto Flow',   model:'PF-608',
            body:'Twin-tube Coriolis body between raised-face flanges', glb:null },
  pulse:  { name:'Pareto Pulse',  model:'PP-4730',
            body:'Hex process fitting, sealed housing, local display', glb:null },
  level:  { name:'Pareto Level',  model:'PL-4700',
            body:'Submersible probe, slotted nose, vented cable gland', glb:null },
  therm:  { name:'Pareto Therm',  model:'PT-4831',
            body:'Tapered thermowell with screwed connection head', glb:null },
  vibra:  { name:'Pareto Vibra',  model:'PV-100',
            body:'Accelerometer puck, integral stud, 2-pin connector', glb:null },
  torque: { name:'Pareto Torque', model:'PQ-200',
            body:'Inline shaft body, flanged stubs, telemetry collar', glb:null },
  edge:   { name:'Pareto Edge',   model:'PE-1',
            body:'DIN-rail enclosure, 16 terminals, dual antenna', glb:null },
};

/* ---------- per-industry scoping ----------
   Each industry shows ONLY the instruments it actually runs, plus Edge,
   which always closes the family. Keep these lists tight: if every
   industry lists every sensor the rail stops saying anything.
   `feeds` must match that page's numbered "Where AI helps" cap-list.   */
const INDUSTRY = {
  'oil-gas': {
    list:[
      {k:'flow',   measures:'Production fluid and fuel-gas mass flow', mounts:'Separator outlet, fuel-gas skid, LACT unit', feeds:'02 Production accounting'},
      {k:'pulse',  measures:'Wellhead, pipeline and compressor pressure', mounts:'Wellhead, pipeline, compressor discharge', feeds:'01 Asset reliability'},
      {k:'level',  measures:'Separator and storage-tank level', mounts:'Separator, stock tank, produced-water tank', feeds:'02 Production accounting'},
      {k:'vibra',  measures:'Pump and compressor vibration signature', mounts:'Bearing cap, motor frame, skid rail', feeds:'01 Asset reliability'},
      {k:'edge',   measures:'Field DAQ aggregating the array', mounts:'Skid panel or field junction box', feeds:'Ties the family to the platform'},
    ],
  },
  'telecom': {
    list:[
      {k:'therm',  measures:'Equipment-shelter and cabinet temperature', mounts:'Shelter wall, cabinet interior, battery string', feeds:'02 Outage deflection'},
      {k:'pulse',  measures:'Rectifier and battery-plant line pressure', mounts:'Power plant, rectifier shelf', feeds:'02 Outage deflection'},
      {k:'vibra',  measures:'Tower, mast and generator vibration', mounts:'Mast leg, generator frame', feeds:'04 Field dispatch'},
      {k:'level',  measures:'Backup-generator fuel-tank level', mounts:'Day tank, bulk fuel tank', feeds:'04 Field dispatch'},
      {k:'edge',   measures:'Site DAQ aggregating the array', mounts:'Shelter DIN rail', feeds:'Ties the family to the platform'},
    ],
  },
  'manufacturing': {
    list:[
      {k:'vibra',  measures:'Motor, spindle and line vibration', mounts:'Motor frame, spindle housing, gearbox', feeds:'03 Predictive maintenance'},
      {k:'therm',  measures:'Bearing, motor and process-oven temperature', mounts:'Bearing housing, oven wall, motor winding', feeds:'03 Predictive maintenance'},
      {k:'torque', measures:'Drive-shaft and conveyor torque', mounts:'Inline on the drive shaft', feeds:'03 Predictive maintenance'},
      {k:'pulse',  measures:'Hydraulic and pneumatic line pressure', mounts:'Hydraulic manifold, pneumatic header', feeds:'02 Quality and defects'},
      {k:'edge',   measures:'Plant-floor DAQ aggregating the array', mounts:'Control-panel DIN rail', feeds:'Ties the family to the platform'},
    ],
  },
  'mining': {
    list:[
      {k:'vibra',  measures:'Mill, crusher and conveyor-idler vibration', mounts:'Mill trunnion bearing, crusher frame, idler roller', feeds:'01 Asset reliability'},
      {k:'torque', measures:'Mill pinion and conveyor drive torque', mounts:'Inline on the mill pinion and conveyor drive', feeds:'01 Asset reliability'},
      {k:'level',  measures:'Fine-ore bin, stockpile and thickener level', mounts:'Fine-ore bin, surge pile, thickener tank', feeds:'04 Metallurgical accounting'},
      {k:'flow',   measures:'Slurry and reagent mass flow', mounts:'Cyclone feed, reagent dosing line, tailings line', feeds:'02 Grade and recovery'},
      {k:'edge',   measures:'Plant and pit DAQ aggregating the array', mounts:'MCC panel DIN rail or pit junction box', feeds:'Ties the family to the platform'},
    ],
  },
};

/* ============================================================ */
function boot(root){
  const key = root.getAttribute('data-sensor-showcase');
  const cfg = INDUSTRY[key];
  if(!cfg) return;

  const sensors = cfg.list.map(s => Object.assign({}, FAMILY[s.k], s));
  const rail  = root.querySelector('[data-sx-rail]');
  const stage = root.querySelector('[data-sx-stage]');
  const vp    = root.querySelector('[data-sx-vp]');

  /* ---- spec panel: renders only fields that hold real data ---- */
  function paint(s){
    root.querySelector('[data-sx-name]').textContent  = s.name;
    root.querySelector('[data-sx-model]').textContent = s.model;
    const rows = [
      ['Measures', s.measures],
      ['Mounts',   s.mounts],
      ['Body',     s.body],
      ['Signal',   s.k === 'edge' ? 'Uplink to the Pareto platform' : 'To Pareto Edge PE-1'],
      ['Range',    s.range],
      ['Accuracy', s.accuracy],
      ['Output',   s.output],
    ].filter(r => r[1]);
    root.querySelector('[data-sx-list]').innerHTML = rows.map(([k,v]) =>
      '<div class="sx-row"><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('');
    root.querySelector('[data-sx-feeds]').innerHTML =
      s.feeds.replace(/^(\d\d)\s(.+)$/, '$1 <em>$2</em>');
    const vl = root.querySelector('[data-sx-vlabel]');
    if(vl) vl.textContent = s.name + '  ·  ' + s.model;
  }

  /* ---- tabs work immediately, with or without 3D ---- */
  let viewer = null, active = sensors[0];
  sensors.forEach((s,i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role','tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.innerHTML = '<span class="sx-rn">'+s.name+'</span><span class="sx-rt">'+s.model+'</span>';
    b.addEventListener('click', () => {
      [...rail.children].forEach(c => c.setAttribute('aria-selected','false'));
      b.setAttribute('aria-selected','true');
      active = s; paint(s); if(viewer) viewer.show(s);
    });
    rail.appendChild(b);
  });
  paint(active);

  /* ---- 3D loads only when the section is actually reached ---- */
  const io = new IntersectionObserver(async entries => {
    if(!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    try {
      const THREE = await import(THREE_URL);
      viewer = buildViewer(THREE, vp, stage, root);
      viewer.show(active);
    } catch (err) {
      const h = root.querySelector('[data-sx-hint]');
      if(h) h.textContent = 'Interactive view unavailable';
    }
  }, { rootMargin: '300px' });
  io.observe(root);
}

/* ============================================================
   VIEWER
   ============================================================ */
function buildViewer(THREE, vp, stage, root){

  const PO = { polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1 };
  const M = {
    steel:  new THREE.MeshPhysicalMaterial({color:0xC2C6CA,metalness:1,roughness:0.28,...PO}),
    steelD: new THREE.MeshPhysicalMaterial({color:0x9AA0A6,metalness:1,roughness:0.42,...PO}),
    paint:  new THREE.MeshPhysicalMaterial({color:0x2E3339,metalness:0.05,roughness:0.42,clearcoat:0.7,clearcoatRoughness:0.26,...PO}),
    gold:   new THREE.MeshPhysicalMaterial({color:0xA8854F,metalness:1,roughness:0.32,...PO}),
    dark:   new THREE.MeshPhysicalMaterial({color:0x15181C,metalness:0.3,roughness:0.60,...PO}),
    poly:   new THREE.MeshPhysicalMaterial({color:0x33383E,metalness:0,roughness:0.70,...PO}),
    glass:  new THREE.MeshPhysicalMaterial({color:0xE4E8EB,metalness:0,roughness:0.05,transmission:0.92,thickness:0.3,ior:1.5,transparent:true,...PO}),
    led:    new THREE.MeshStandardMaterial({color:0xC8AE7D,emissive:0xC8AE7D,emissiveIntensity:2.0,roughness:0.4,...PO}),
  };
  const EDGE_MAT = new THREE.LineBasicMaterial({color:0x272C33,transparent:true,opacity:0.62});
  let edgeSets = [], showEdges = true;

  /* ---------- geometry helpers ---------- */
  const centered = g => { g.computeBoundingBox(); const c=new THREE.Vector3();
    g.boundingBox.getCenter(c); g.translate(-c.x,-c.y,-c.z); return g; };

  function roundedRect(w,h,r){
    const s=new THREE.Shape(), x=-w/2, y=-h/2;
    s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s;
  }
  const bevelBox = (w,h,d,r=0.03,bev=0.012) => centered(new THREE.ExtrudeGeometry(
    roundedRect(w,h,r),{depth:d-bev*2,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:3,curveSegments:12}));

  function flange(od,bore,th,bolts,bcd,bd){
    const s=new THREE.Shape(); s.absarc(0,0,od/2,0,Math.PI*2,false);
    const h0=new THREE.Path(); h0.absarc(0,0,bore/2,0,Math.PI*2,true); s.holes.push(h0);
    for(let i=0;i<bolts;i++){ const a=(i/bolts)*Math.PI*2+Math.PI/bolts; const p=new THREE.Path();
      p.absarc(Math.cos(a)*bcd/2,Math.sin(a)*bcd/2,bd/2,0,Math.PI*2,true); s.holes.push(p); }
    return centered(new THREE.ExtrudeGeometry(s,{depth:th-0.016,bevelEnabled:true,
      bevelThickness:0.008,bevelSize:0.008,bevelSegments:2,curveSegments:48}));
  }
  function hexPrism(across,h,bev=0.01){
    const s=new THREE.Shape(), r=across/Math.sqrt(3);
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+Math.PI/6;
      const x=Math.cos(a)*r,y=Math.sin(a)*r; i?s.lineTo(x,y):s.moveTo(x,y); }
    s.closePath();
    return centered(new THREE.ExtrudeGeometry(s,{depth:h-bev*2,bevelEnabled:true,
      bevelThickness:bev,bevelSize:bev,bevelSegments:2}));
  }
  const cyl = (rt,rb,h,seg=48) => new THREE.CylinderGeometry(rt,rb,h,seg);
  const mesh = (g,m,x=0,y=0,z=0) => { const o=new THREE.Mesh(g,m);
    o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return o; };
  /* Knurl teeth and thread rings are decorative detail: they are numerous,
     tiny, and individually meaningless. They skip shadow casting and edge
     extraction, which is most of the frame budget on this section. */
  function knurl(r,h,teeth,m){
    const g=new THREE.Group(), tooth=new THREE.BoxGeometry(0.012,h,0.022);
    for(let i=0;i<teeth;i++){ const a=i/teeth*Math.PI*2;
      const t=mesh(tooth,m,Math.cos(a)*r,0,Math.sin(a)*r);
      t.rotation.y=-a; t.castShadow=false; t.userData.noEdge=true; g.add(t); }
    return g;
  }
  function threads(r,h,turns,m){
    const g=new THREE.Group();
    for(let i=0;i<turns;i++){ const t=mesh(new THREE.TorusGeometry(r,0.011,6,28),m,0,-h/2+(i+0.5)*(h/turns),0);
      t.rotation.x=Math.PI/2; t.castShadow=false; t.userData.noEdge=true; g.add(t); }
    return g;
  }
  function lcdTexture(label){
    const c=document.createElement('canvas'); c.width=256; c.height=160;
    const x=c.getContext('2d');
    x.fillStyle='#1d2b25'; x.fillRect(0,0,256,160);
    x.fillStyle='#8fd9b6'; x.font='500 60px ui-monospace,monospace'; x.textAlign='center';
    x.fillText('----',128,84);
    x.font='400 20px ui-monospace,monospace'; x.globalAlpha=.75; x.fillText(label,128,128);
    x.globalAlpha=.5; x.fillRect(30,20,196,3);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
  }

  /* ---------- the instruments ---------- */
  function buildFlow(){
    const g=new THREE.Group();
    [-1,1].forEach(s=>{
      const f=mesh(flange(1.02,0.30,0.13,8,0.78,0.10),M.steelD,s*1.18,0,0);
      f.rotation.y=Math.PI/2; g.add(f);
      const rf=mesh(cyl(0.24,0.24,0.05),M.steel,s*1.09,0,0); rf.rotation.z=Math.PI/2; g.add(rf);
      g.add(mesh(bevelBox(0.34,0.46,0.52,0.07),M.steelD,s*0.86,0.02,0));
      const nk=mesh(cyl(0.15,0.19,0.30,32),M.steelD,s*1.0,0,0); nk.rotation.z=Math.PI/2; g.add(nk);
    });
    [-0.17,0.17].forEach(z=>{
      const cv=new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.78,0.10,z), new THREE.Vector3(-0.62,0.52,z*1.5),
        new THREE.Vector3(-0.30,0.92,z*1.9), new THREE.Vector3(0,1.02,z*2.0),
        new THREE.Vector3(0.30,0.92,z*1.9), new THREE.Vector3(0.62,0.52,z*1.5),
        new THREE.Vector3(0.78,0.10,z)]);
      g.add(mesh(new THREE.TubeGeometry(cv,72,0.062,20,false),M.steel));
    });
    [-0.34,0.34].forEach(x=>{ const b=mesh(cyl(0.05,0.05,0.30,20),M.gold,x,0.86,0);
      b.rotation.x=Math.PI/2; g.add(b); });
    g.add(mesh(cyl(0.10,0.10,0.34,24),M.steelD,0,-0.30,0));
    g.add(mesh(cyl(0.30,0.30,0.40,40),M.paint,0,-0.66,0));
    const ring=mesh(new THREE.TorusGeometry(0.30,0.022,8,44),M.steel,0,-0.50,0);
    ring.rotation.x=Math.PI/2; g.add(ring);
    g.add(mesh(cyl(0.26,0.26,0.06,40),M.steelD,0,-0.89,0));
    g.add(mesh(cyl(0.055,0.055,0.20,20),M.steelD,0.30,-0.66,0).rotateZ(Math.PI/2));
    return g;
  }

  function buildPressure(){
    const g=new THREE.Group();
    g.add(threads(0.15,0.30,7,M.steelD).translateY(-1.10));
    g.add(mesh(cyl(0.145,0.145,0.32,28),M.steelD,0,-1.10,0));
    g.add(mesh(hexPrism(0.46,0.20),M.steelD,0,-0.84,0).rotateX(Math.PI/2));
    g.add(mesh(cyl(0.17,0.20,0.34,32),M.steel,0,-0.57,0));
    g.add(mesh(cyl(0.24,0.24,0.16,36),M.steelD,0,-0.32,0));
    g.add(mesh(cyl(0.42,0.42,0.62,48),M.paint,0,0.05,0));
    [0.36,-0.26].forEach(y=>{ const t=mesh(new THREE.TorusGeometry(0.42,0.026,10,52),M.steel,0,y,0);
      t.rotation.x=Math.PI/2; g.add(t); });
    const bez=mesh(cyl(0.33,0.33,0.10,44),M.steelD,0,0.05,0.30); bez.rotation.x=Math.PI/2; g.add(bez);
    const bk=knurl(0.345,0.10,30,M.steelD); bk.rotation.x=Math.PI/2; bk.position.set(0,0.05,0.30); g.add(bk);
    g.add(mesh(new THREE.CircleGeometry(0.25,40),
      new THREE.MeshStandardMaterial({map:lcdTexture('PP-4730'),roughness:0.5,...PO}),0,0.05,0.357));
    g.add(mesh(new THREE.CircleGeometry(0.27,40),M.glass,0,0.05,0.368));
    g.add(mesh(cyl(0.115,0.115,0.26,26),M.steelD,-0.50,0.05,0).rotateZ(Math.PI/2));
    g.add(mesh(hexPrism(0.28,0.10),M.steelD,-0.62,0.05,0).rotateZ(Math.PI/2));
    g.add(mesh(cyl(0.045,0.045,0.10,16),M.gold,0.40,0.28,0).rotateZ(Math.PI/2));
    g.add(mesh(cyl(0.38,0.40,0.16,44),M.paint,0,0.44,0));
    g.add(mesh(cyl(0.36,0.36,0.05,44),M.steelD,0,0.54,0));
    return g;
  }

  function buildLevel(){
    const g=new THREE.Group();
    g.add(mesh(cyl(0.135,0.135,1.55,36),M.steel,0,0.05,0));
    g.add(mesh(cyl(0.137,0.137,0.10,36),M.dark,0,0.52,0));
    g.add(mesh(cyl(0.135,0.115,0.20,36),M.steelD,0,-0.82,0));
    const nose=mesh(new THREE.SphereGeometry(0.115,32,20,0,Math.PI*2,0,Math.PI/2),M.steelD,0,-0.92,0);
    nose.rotation.x=Math.PI; g.add(nose);
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2;
      g.add(mesh(new THREE.BoxGeometry(0.035,0.13,0.05),M.dark,
        Math.cos(a)*0.106,-0.80,Math.sin(a)*0.106).rotateY(-a)); }
    g.add(mesh(hexPrism(0.34,0.13),M.steelD,0,0.90,0).rotateX(Math.PI/2));
    g.add(mesh(cyl(0.12,0.15,0.20,28),M.steelD,0,1.06,0));
    g.add(mesh(cyl(0.055,0.085,0.26,22),M.poly,0,1.24,0));
    const cv=new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,1.34,0), new THREE.Vector3(0.02,1.70,0.06),
      new THREE.Vector3(0.16,2.02,0.20), new THREE.Vector3(0.44,2.20,0.30)]);
    g.add(mesh(new THREE.TubeGeometry(cv,48,0.048,16,false),M.poly));
    return g;
  }

  function buildTherm(){
    const g=new THREE.Group();
    g.add(mesh(cyl(0.052,0.075,1.45,28),M.steel,0,-0.75,0));
    g.add(mesh(new THREE.SphereGeometry(0.052,20,14),M.steel,0,-1.475,0));
    g.add(mesh(hexPrism(0.40,0.18),M.steelD,0,0.03,0).rotateX(Math.PI/2));
    g.add(threads(0.13,0.22,5,M.steelD).translateY(-0.18));
    g.add(mesh(cyl(0.10,0.10,0.30,24),M.steelD,0,0.27,0));
    g.add(mesh(cyl(0.36,0.38,0.44,44),M.paint,0,0.64,0));
    const t=mesh(new THREE.TorusGeometry(0.365,0.024,10,48),M.steel,0,0.84,0);
    t.rotation.x=Math.PI/2; g.add(t);
    g.add(mesh(cyl(0.34,0.36,0.14,44),M.paint,0,0.93,0));
    g.add(knurl(0.355,0.14,26,M.steelD).translateY(0.93));
    g.add(mesh(cyl(0.30,0.30,0.04,44),M.steelD,0,1.01,0));
    g.add(mesh(cyl(0.10,0.10,0.22,24),M.steelD,-0.44,0.62,0).rotateZ(Math.PI/2));
    g.add(mesh(hexPrism(0.24,0.09),M.steelD,-0.55,0.62,0).rotateZ(Math.PI/2));
    return g;
  }

  function buildVibra(){
    const g=new THREE.Group();
    g.add(mesh(cyl(0.44,0.44,0.36,48),M.steel,0,0,0));
    const t=mesh(new THREE.TorusGeometry(0.44,0.02,8,52),M.steelD,0,0.17,0);
    t.rotation.x=Math.PI/2; g.add(t);
    g.add(mesh(hexPrism(0.72,0.18),M.steelD,0,-0.26,0).rotateX(Math.PI/2));
    g.add(mesh(cyl(0.11,0.11,0.24,24),M.steelD,0,-0.46,0));
    g.add(threads(0.11,0.20,5,M.steelD).translateY(-0.47));
    g.add(mesh(cyl(0.19,0.19,0.22,32),M.steelD,0,0.29,0));
    g.add(knurl(0.20,0.20,24,M.steelD).translateY(0.29));
    g.add(mesh(cyl(0.15,0.15,0.04,28),M.dark,0,0.41,0));
    [-0.055,0.055].forEach(x=>g.add(mesh(cyl(0.022,0.022,0.09,14),M.gold,x,0.44,0)));
    g.add(mesh(cyl(0.442,0.442,0.07,48),M.dark,0,-0.06,0));
    return g;
  }

  function buildTorque(){
    const g=new THREE.Group();
    g.add(mesh(cyl(0.52,0.52,0.62,48),M.paint,0,0,0).rotateZ(Math.PI/2));
    [-1,1].forEach(s=>{
      const r=mesh(new THREE.TorusGeometry(0.52,0.028,10,52),M.steel,s*0.31,0,0);
      r.rotation.y=Math.PI/2; g.add(r);
      const fl=mesh(flange(0.86,0.30,0.10,6,0.66,0.08),M.steelD,s*0.42,0,0);
      fl.rotation.y=Math.PI/2; g.add(fl);
      g.add(mesh(cyl(0.155,0.155,0.62,32),M.steel,s*0.78,0,0).rotateZ(Math.PI/2));
      g.add(mesh(new THREE.BoxGeometry(0.30,0.045,0.09),M.steelD,s*0.86,0.135,0));
      g.add(mesh(cyl(0.17,0.155,0.06,32),M.steelD,s*1.06,0,0).rotateZ(Math.PI/2));
    });
    g.add(mesh(cyl(0.58,0.58,0.16,48),M.steelD,0,0,0).rotateZ(Math.PI/2));
    const tk=knurl(0.59,0.16,36,M.steelD); tk.rotation.z=Math.PI/2; g.add(tk);
    g.add(mesh(cyl(0.13,0.13,0.22,26),M.steelD,0,0.60,0));
    g.add(mesh(cyl(0.16,0.16,0.06,26),M.dark,0,0.72,0));
    return g;
  }

  function buildEdge(){
    const g=new THREE.Group();
    g.add(mesh(bevelBox(1.30,1.05,0.62,0.05),M.paint,0,0,0));
    g.add(mesh(bevelBox(1.16,0.90,0.03,0.03),M.dark,0,0,0.315));
    [-1,1].forEach(s=>{
      for(let i=0;i<8;i++){ const x=-0.52+i*0.149;
        g.add(mesh(bevelBox(0.125,0.17,0.16,0.014),M.poly,x,s*0.40,0.30));
        g.add(mesh(cyl(0.028,0.028,0.03,12),M.gold,x,s*0.40,0.385).rotateX(Math.PI/2)); }
    });
    for(let i=0;i<5;i++) g.add(mesh(new THREE.SphereGeometry(0.026,14,10),
      i<3?M.led:M.dark,-0.50+i*0.075,0.14,0.335));
    for(let i=0;i<7;i++) g.add(mesh(new THREE.BoxGeometry(0.62,0.018,0.02),M.dark,0.12,-0.02-i*0.045,0.332));
    [-0.42,0.42].forEach(x=>{
      g.add(mesh(cyl(0.045,0.05,0.10,18),M.steelD,x,0.56,0));
      g.add(mesh(cyl(0.032,0.032,0.62,18),M.poly,x,0.92,0));
      g.add(mesh(new THREE.SphereGeometry(0.032,16,12),M.poly,x,1.23,0));
    });
    g.add(mesh(bevelBox(0.70,0.30,0.10,0.02),M.steelD,0,-0.30,-0.34));
    g.add(mesh(bevelBox(0.70,0.09,0.05,0.015),M.steelD,0,-0.46,-0.38));
    return g;
  }

  const BUILDERS = { flow:buildFlow, pulse:buildPressure, level:buildLevel,
                     therm:buildTherm, vibra:buildVibra, torque:buildTorque, edge:buildEdge };

  /* ---------- scene ---------- */
  const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the rig never moves: bake once per model
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  vp.appendChild(renderer.domElement);
  const hint = root.querySelector('[data-sx-hint]'); if(hint) hint.style.display = 'none';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34,1,0.1,100);

  (function backdrop(){
    const c=document.createElement('canvas'); c.width=4; c.height=256;
    const x=c.getContext('2d'), g=x.createLinearGradient(0,0,0,256);
    g.addColorStop(0,'#AEB4BB'); g.addColorStop(0.55,'#D3D7DB'); g.addColorStop(1,'#EDEFF1');
    x.fillStyle=g; x.fillRect(0,0,4,256);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; scene.background=t;
  })();

  (function env(){
    const s=new THREE.Scene();
    const panel=(w,h,x,y,z,i)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({color:0xffffff}));
      m.material.color.multiplyScalar(i); m.position.set(x,y,z); m.lookAt(0,0,0); s.add(m); };
    s.background=new THREE.Color(0xC8CCD0);
    panel(10,7,-6,5,5,3.0); panel(8,8,7,2,2,1.8); panel(10,5,0,4,-7,2.0); panel(14,14,0,-8,0,0.8);
    const pm=new THREE.PMREMGenerator(renderer);
    scene.environment=pm.fromScene(s,0.04).texture; pm.dispose();
  })();

  const key=new THREE.DirectionalLight(0xfffaf2,2.0); key.position.set(4,7,5);
  key.castShadow=true; key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.near=1; key.shadow.camera.far=26;
  key.shadow.camera.left=-5; key.shadow.camera.right=5;
  key.shadow.camera.top=5; key.shadow.camera.bottom=-5; key.shadow.bias=-0.0012;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,0.55); fill.position.set(-6,2,-4); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff,0.34));

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:0.24}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

  const gridGroup=new THREE.Group(); scene.add(gridGroup);
  (function grid(){
    const minor=new THREE.GridHelper(40,160,0xB4BAC1,0xB4BAC1);
    minor.material.transparent=true; minor.material.opacity=0.42; minor.material.depthWrite=false;
    const major=new THREE.GridHelper(40,16,0x7E858D,0x7E858D);
    major.material.transparent=true; major.material.opacity=0.55; major.material.depthWrite=false;
    minor.position.y=0.001; major.position.y=0.002; gridGroup.add(minor,major);
    const ax=(v,col)=>new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),v]),
      new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.85}));
    const o=new THREE.Group(); o.position.y=0.004;
    o.add(ax(new THREE.Vector3(1.1,0,0),0xC0392B));
    o.add(ax(new THREE.Vector3(0,1.1,0),0x3B8C4A));
    o.add(ax(new THREE.Vector3(0,0,1.1),0x2E6DA4));
    gridGroup.add(o);
  })();

  const holder=new THREE.Group(); scene.add(holder);

  const triadScene=new THREE.Scene();
  const triadCam=new THREE.PerspectiveCamera(46,1,0.1,20);
  (function triad(){
    const label=(txt,col)=>{
      const c=document.createElement('canvas'); c.width=c.height=64;
      const x=c.getContext('2d'); x.fillStyle=col; x.font='bold 42px ui-monospace,monospace';
      x.textAlign='center'; x.textBaseline='middle'; x.fillText(txt,32,34);
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
      const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));
      s.scale.setScalar(0.42); return s;
    };
    const arm=(v,col,txt)=>{
      triadScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),v]),
        new THREE.LineBasicMaterial({color:col})));
      const l=label(txt,col); l.position.copy(v).multiplyScalar(1.24); triadScene.add(l);
    };
    arm(new THREE.Vector3(1,0,0),'#C0392B','X');
    arm(new THREE.Vector3(0,1,0),'#3B8C4A','Y');
    arm(new THREE.Vector3(0,0,1),'#2E6DA4','Z');
  })();

  /* ---------- orbit ---------- */
  const cam={az:0.85,el:0.30,dist:5,tAz:0.85,tEl:0.30,tDist:5,tgt:new THREE.Vector3()};
  let spin=true, drag=false, px=0, py=0, pinch=0;
  const el=renderer.domElement;
  const btn=n=>root.querySelector('[data-sx-'+n+']');
  const syncSpin=()=>btn('spin')&&btn('spin').setAttribute('aria-pressed',spin?'true':'false');

  el.addEventListener('pointerdown',e=>{drag=true;px=e.clientX;py=e.clientY;
    el.setPointerCapture(e.pointerId); spin=false; syncSpin();});
  el.addEventListener('pointermove',e=>{ if(!drag)return;
    cam.tAz-=(e.clientX-px)*0.0075; cam.tEl+=(e.clientY-py)*0.0060;
    cam.tEl=Math.max(-1.15,Math.min(1.25,cam.tEl)); px=e.clientX; py=e.clientY; });
  addEventListener('pointerup',()=>drag=false);
  el.addEventListener('wheel',e=>{e.preventDefault();
    cam.tDist=Math.max(1.6,Math.min(14,cam.tDist*(1+Math.sign(e.deltaY)*0.10)));},{passive:false});
  el.addEventListener('touchmove',e=>{ if(e.touches.length!==2)return; e.preventDefault();
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
    if(pinch) cam.tDist=Math.max(1.6,Math.min(14,cam.tDist*(pinch/d)));
    pinch=d; },{passive:false});
  el.addEventListener('touchend',()=>pinch=0);

  function frame(obj){
    const b=new THREE.Box3().setFromObject(obj), sz=new THREE.Vector3();
    b.getSize(sz); obj.position.y-=b.min.y;
    cam.tgt.set(0,sz.y*0.5,0);
    const r=Math.max(sz.x,sz.y,sz.z);
    cam.tDist=r/(2*Math.tan(camera.fov*Math.PI/360))*1.85;
    cam.tAz=0.85; cam.tEl=0.26;
  }

  async function show(s){
    holder.clear(); edgeSets=[];
    let obj;
    if(s.glb){
      const {GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js');
      obj=(await new GLTFLoader().loadAsync('/assets/models/sensors/'+s.glb)).scene;
      obj.traverse(o=>{ if(o.isMesh){o.castShadow=true;o.receiveShadow=true;} });
    } else {
      obj=BUILDERS[s.k]();
    }
    obj.traverse(o=>{
      if(!o.isMesh||!o.geometry||o.userData.noEdge) return;
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,26),EDGE_MAT);
      e.visible=showEdges; e.castShadow=false; o.add(e); edgeSets.push(e);
    });
    holder.add(obj); frame(obj);
    renderer.shadowMap.needsUpdate=true;
  }

  if(btn('spin')) btn('spin').addEventListener('click',()=>{spin=!spin;syncSpin();});
  if(btn('edges')) btn('edges').addEventListener('click',()=>{
    showEdges=!showEdges; edgeSets.forEach(e=>e.visible=showEdges);
    btn('edges').setAttribute('aria-pressed',showEdges?'true':'false');
    const u=root.querySelector('[data-sx-vunits]');
    if(u) u.textContent=showEdges?'shaded with edges':'shaded';
  });
  if(btn('grid')) btn('grid').addEventListener('click',()=>{
    gridGroup.visible=!gridGroup.visible;
    btn('grid').setAttribute('aria-pressed',gridGroup.visible?'true':'false');
  });
  if(btn('reset')) btn('reset').addEventListener('click',()=>{
    if(holder.children[0]) frame(holder.children[0]);
  });
  if(btn('full')) btn('full').addEventListener('click',()=>{
    if(document.fullscreenElement) document.exitFullscreen();
    else if(stage.requestFullscreen) stage.requestFullscreen().catch(()=>{});
  });
  addEventListener('fullscreenchange',()=>{ resize();
    if(btn('full')) btn('full').textContent=document.fullscreenElement?'Exit':'Present'; });

  /* Size is cached. Reading layout inside the frame loop forces a synchronous
     reflow on every frame, which is what made the whole page unresponsive. */
  let vw=0, vh=0;
  function resize(){
    const r=vp.getBoundingClientRect();
    if(!r.width||!r.height) return;
    vw=r.width; vh=r.height;
    renderer.setSize(vw,vh,false);
    camera.aspect=vw/vh; camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate=true;
  }
  addEventListener('resize',resize);
  new ResizeObserver(resize).observe(vp);

  /* Nothing renders while the section is off-screen. */
  let onScreen=true;
  new IntersectionObserver(es=>{ onScreen=es.some(e=>e.isIntersecting); },{threshold:0}).observe(vp);

  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ spin=false; syncSpin(); }

  function tick(){
    requestAnimationFrame(tick);
    if(!onScreen||!vw||!vh) return;
    if(spin&&!drag) cam.tAz+=0.0032;
    cam.az+=(cam.tAz-cam.az)*0.09; cam.el+=(cam.tEl-cam.el)*0.09;
    cam.dist+=(cam.tDist-cam.dist)*0.09;
    camera.position.set(
      cam.tgt.x+cam.dist*Math.cos(cam.el)*Math.sin(cam.az),
      cam.tgt.y+cam.dist*Math.sin(cam.el),
      cam.tgt.z+cam.dist*Math.cos(cam.el)*Math.cos(cam.az));
    camera.lookAt(cam.tgt);

    renderer.autoClear=true;
    renderer.setViewport(0,0,vw,vh);
    renderer.render(scene,camera);

    renderer.autoClear=false; renderer.clearDepth();
    const s=Math.min(112,Math.max(70,vw*0.10));
    renderer.setViewport(vw-s-14,14,s,s);
    triadCam.position.copy(camera.position).sub(cam.tgt).normalize().multiplyScalar(3.4);
    triadCam.lookAt(0,0,0);
    renderer.render(triadScene,triadCam);
    renderer.setViewport(0,0,vw,vh);
    renderer.autoClear=true;
  }
  resize(); tick();
  return { show };
}

document.querySelectorAll('[data-sensor-showcase]').forEach(boot);
