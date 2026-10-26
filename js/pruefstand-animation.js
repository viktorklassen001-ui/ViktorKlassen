// Prüfstand-Animation (3D, three.js): Hydraulic Burst and Leak Tester. Motor, Riemen, Spindel und Hebel bewegen
// die Kolbenstange des Hydraulikzylinders; Dichtheits- und Berstprüfung eines Katheterballons, danach Entlasten.
// Wird bei Bedarf in einen Container eingehängt: TesterAnimation.mount(el).
(() => {
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  let threeLoading = null;

  // three.js erst laden, wenn die Animation gebraucht wird
  const loadThree = () => {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threeLoading) {
      threeLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = THREE_URL;
        script.onload = () => resolve(window.THREE);
        script.onerror = reject;
        document.head.append(script);
      });
    }
    return threeLoading;
  };

  // ---------- Hilfsfunktionen ----------
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (e0, e1, x) => {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

  // ---------- Prüfablauf (Sekunden) ----------
  // u: Stellung der Mechanik (0 Ausgangslage, 1 Endlage), p: Druck relativ zum Berstdruck, valve: Ventil offen (0–1)
  const CYCLE = 30;
  const HOLD = 0.55;
  const BURST_AT = 21.5;
  const PHASES = [
    { from: 0, to: 3, step: 0, name: 'Bereit', text: 'Der Katheterballon ist angeschlossen, das System ist drucklos.' },
    { from: 3, to: 11, step: 1, name: 'Druckaufbau', text: 'Der Motor treibt über den Riemen die Riemenscheibe an. Ihre Mutter schiebt die Spindel, der Hebel schwenkt und zieht die Kolbenstange aus dem Zylinder. Der Druck steigt.' },
    { from: 11, to: 16, step: 2, name: 'Dichtheitsprüfung', text: 'Der Motor steht, das Ventil ist geschlossen. Der Druckaufnehmer zeigt, ob der Druck konstant bleibt.' },
    { from: 16, to: 24, step: 3, name: 'Berstprüfung', text: 'Der Motor läuft weiter und der Druck steigt, bis der Ballon platzt.' },
    { from: 24, to: 29.5, step: 4, name: 'Entlasten', text: 'Das Ventil öffnet, der Motor läuft zurück und der Hebel schwenkt in die Ausgangslage.' },
    { from: 29.5, to: CYCLE, step: 0, name: 'Bereit', text: 'Ein neuer Katheterballon wird angeschlossen.' },
  ];

  const stateAt = (t) => {
    let u = 0;
    let p = 0;
    let valve = 0;
    if (t >= 3 && t < 11) {
      const q = easeInOut((t - 3) / 8);
      u = HOLD * q;
      p = HOLD * q ** 1.6;
    } else if (t >= 11 && t < 16) {
      u = HOLD;
      p = HOLD;
    } else if (t >= 16 && t < BURST_AT) {
      const q = smooth(16, BURST_AT + 1.2, t) / smooth(16, BURST_AT + 1.2, BURST_AT);
      u = HOLD + (1 - HOLD) * q;
      p = HOLD + (1 - HOLD) * q ** 1.25;
    } else if (t >= BURST_AT && t < 24) {
      u = 1;
      p = 0.04 + 0.96 * Math.exp(-(t - BURST_AT) * 14);
    } else if (t >= 24 && t < 29.5) {
      u = 1 - easeInOut(clamp01((t - 24.4) / 4.8));
      p = 0.04 * (1 - smooth(24.1, 24.9, t));
      valve = smooth(24, 24.5, t);
    } else if (t >= 29.5) {
      valve = 1 - smooth(29.5, 29.9, t);
    }
    return { u, p, valve, burst: t >= BURST_AT && t < 29.5 };
  };

  const phaseAt = (t) => PHASES.find((phase) => t >= phase.from && t < phase.to) || PHASES[0];

  // Welche Bauteile während des Rundgangs beschriftet sind
  const LABEL_TIMES = [
    { from: 0.2, to: 3, ids: ['2', '9', '1'] },
    { from: 3.4, to: 7.1, ids: ['3', '8'] },
    { from: 7.3, to: 11, ids: ['4', '5'] },
    { from: 11.3, to: 16, ids: ['6', '7'] },
    { from: 16.3, to: 24, ids: ['anschluss', '6'] },
    { from: 24.3, to: 29.5, ids: ['7', '4'] },
  ];

  const LABELS = {
    1: { num: 1, name: 'Gehäuse' },
    2: { num: 2, name: 'Grundplatte' },
    3: { num: 3, name: 'Motor mit Riemenscheibe', sub: 'Treibt über den Riemen an' },
    4: { num: 4, name: 'Hebel', sub: 'Schwenkt um seinen Drehpunkt' },
    5: { num: 5, name: 'Hydraulikzylinder', sub: 'Erzeugt den Prüfdruck' },
    6: { num: 6, name: 'Druckaufnehmer', sub: 'Misst den Druck im System' },
    7: { num: 7, name: 'Ventil', sub: 'Sperrt oder entlastet das System' },
    8: { num: 8, name: 'Riemenscheibe', sub: 'Dreht die Spindelmutter' },
    9: { num: 9, name: 'Zweite Grundplatte', sub: 'Trägt Lagerböcke und Spindel' },
    spindel: { name: 'Gewindespindel', sub: 'Fährt vor und zurück, ohne sich zu drehen' },
    riemen: { name: 'Riemen' },
    lagerbock: { name: 'Lagerbock' },
    hebellager: { name: 'Hebellager', sub: 'Drehpunkt des Hebels' },
    zylinderbock: { name: 'Zylinderbock' },
    leitung: { name: 'Hydraulikleitung' },
    anschluss: { name: 'Anschluss Prüfling', sub: 'Katheterballon (schematisch)' },
  };

  const create = (THREE, container) => {
    const stage = container.querySelector('.rig-stage');
    const canvas = container.querySelector('.rig-canvas');
    const leaders = container.querySelector('.rig-leaders');
    const labelLayer = container.querySelector('.rig-labels');
    const stepEl = container.querySelector('.rig-readout-label');
    const phaseEl = container.querySelector('.rig-readout-value');
    const explainEl = container.querySelector('.rig-explain');
    const chart = container.querySelector('.rig-chart');
    const balloonSvg = container.querySelector('.rig-balloon');
    const sampleState = container.querySelector('.rig-sample-state');
    const playButton = container.querySelector('.rig-play');
    const playLabel = playButton.querySelector('span');
    const playIcon = playButton.querySelector('path');
    const tourButton = container.querySelector('.rig-tour');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const DEG = Math.PI / 180;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd2d6, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(-6, 14, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(keyLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    keyLight.shadow.bias = -0.0006;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(8, 6, -7);
    scene.add(fillLight);

    const root = new THREE.Group();
    scene.add(root);

    // ---------- Materialien (Graustufen wie im CAD-Modell, rote Etiketten) ----------
    const standard = (color, roughness, metalness = 0.15) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const mats = {
      plate: standard(0x5b5f66, 0.7),
      plateLight: standard(0x6c7078, 0.65),
      metal: standard(0xc3c6cb, 0.45, 0.3),
      steel: standard(0x9ea2a8, 0.35, 0.55),
      lever: standard(0x63676e, 0.55, 0.25),
      dark: standard(0x2c2e32, 0.6),
      black: standard(0x1b1c1f, 0.5),
      bronze: standard(0xb8794a, 0.4, 0.5),
      labelWhite: standard(0xf2f2f0, 0.6, 0),
      labelRed: standard(0xc8363b, 0.55, 0),
      pipe: new THREE.MeshStandardMaterial({ color: 0xb5b8bd, roughness: 0.35, metalness: 0.5, emissive: 0x000000 }),
      case: standard(0x8a8f96, 0.65, 0.2),
      caseGlass: new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.65, metalness: 0.2, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide }),
      belt: new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.8, side: THREE.DoubleSide }),
      wireYellow: standard(0xe2b93b, 0.5, 0),
      wireBlue: standard(0x3a6cc9, 0.5, 0),
    };
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x1d1f22, transparent: true, opacity: 0.3 });
    const noRaycast = () => {};

    // Kantenlinien wie in der CAD-Ansicht liegen als zweite Schicht auf jedem Bauteil
    const add = (parent, geometry, material, { pos, rot, edges = true } = {}) => {
      const mesh = new THREE.Mesh(geometry, material);
      if (pos) mesh.position.set(...pos);
      if (rot) mesh.rotation.set(...rot);
      mesh.castShadow = !material.transparent;
      mesh.receiveShadow = true;
      if (edges) {
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), edgeMat);
        lines.raycast = noRaycast;
        mesh.add(lines);
      }
      parent.add(mesh);
      return mesh;
    };
    // Baugruppe mit Bauteilschlüssel (Nummer aus der CAD-Zeichnung oder Name)
    const group = (parent, part, pos) => {
      const g = new THREE.Group();
      if (part) g.userData.part = part;
      if (pos) g.position.set(...pos);
      parent.add(g);
      return g;
    };
    // Quader über seine Kanten angeben: [x0, x1], [y0, y1], [z0, z1]
    const span = (parent, [x0, x1], [y0, y1], [z0, z1], material, opts = {}) => add(
      parent,
      new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
      material,
      { ...opts, pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] },
    );
    const cylY = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg);
    const cylX = (r, len, seg = 32) => cylY(r, len, seg).rotateZ(Math.PI / 2);
    const cylZ = (r, len, seg = 32) => cylY(r, len, seg).rotateX(Math.PI / 2);
    const hexY = (r, len) => cylY(r, len, 6);
    const hexX = (r, len) => cylX(r, len, 6);
    const hexZ = (r, len) => cylZ(r, len, 6);
    // Rillen (Gewinde, Führungsbuchse) als Drehteil entlang der x-Achse
    const ribbed = (rIn, rOut, length, pitch, seg = 24) => {
      const points = [new THREE.Vector2(0, 0)];
      for (let i = 0; i * (pitch / 2) <= length + 1e-6; i += 1) points.push(new THREE.Vector2(i % 2 ? rIn : rOut, i * (pitch / 2)));
      points.push(new THREE.Vector2(0, length));
      return new THREE.LatheGeometry(points, seg).rotateZ(-Math.PI / 2);
    };

    // ---------- Maße (Grundplatte: Oberseite y = 0) ----------
    const Y_AX = 1.2; // Höhe von Spindel, Hebel und Kolbenstange
    const X_P = -3.0; // Drehpunkt des Hebels
    const Z_P = -1.0;
    const Z_C = -2.0; // Achse des Hydraulikzylinders
    const Z_S = 1.6; // Achse der Spindel
    const ARM_BACK = Z_P - Z_C; // Hebelarm zur Kolbenstange
    const ARM_FRONT = Z_S - Z_P; // Hebelarm zur Spindel
    const X_B = 0.65; // Riemenebene
    const Y_M = 2.25; // Motorachse
    const Z_M = 0.3;
    const R8 = 0.97; // Riemenradius an der Riemenscheibe 8
    const RM = 0.31; // Riemenradius an der Motorriemenscheibe
    const Z_L = -1.15; // Hydraulikleitung

    // ---------- 1 Gehäuse ----------
    const casing = group(root, '1');
    span(casing, [-5.4, 5.4], [-0.55, -0.45], [-3.7, 3.7], mats.case);
    [-1, 1].forEach((side) => {
      const x = side * 5.36;
      span(casing, [x - 0.04, x + 0.04], [-0.45, 2.7], [-3.7, 3.7], mats.caseGlass);
      span(casing, side < 0 ? [x, x + 0.32] : [x - 0.32, x], [2.66, 2.74], [-3.7, 3.7], mats.caseGlass);
    });

    // ---------- 2 Grundplatte ----------
    const basePlate = group(root, '2');
    span(basePlate, [-4.7, 4.7], [-0.12, 0], [-3.2, 3.2], mats.plate);
    [[-4.3, -2.8], [4.3, -2.8], [-4.3, 2.8], [4.3, 2.8]].forEach(([x, z]) => {
      add(basePlate, cylY(0.17, 0.33, 20), mats.black, { pos: [x, -0.285, z] });
      add(basePlate, cylY(0.08, 0.02, 16), mats.dark, { pos: [x, 0.01, z], edges: false });
    });

    // ---------- 9 Zweite Grundplatte, Lagerböcke ----------
    const base9 = group(root, '9');
    span(base9, [-1.5, 3.0], [0, 0.14], [1.0, 2.7], mats.plateLight);
    [[-1.3, 1.2], [2.8, 1.2], [-1.3, 2.5], [2.8, 2.5]].forEach(([x, z]) => {
      add(base9, cylY(0.07, 0.02, 16), mats.dark, { pos: [x, 0.15, z], edges: false });
    });
    const bearings = group(root, 'lagerbock');
    [[-1.2, -0.4], [1.7, 2.5]].forEach(([x0, x1]) => {
      span(bearings, [x0, x1], [0.14, 1.75], [Z_S - 0.55, Z_S + 0.55], mats.metal);
      [Z_S - 0.36, Z_S + 0.36].forEach((z) => add(bearings, hexY(0.08, 0.06), mats.steel, { pos: [(x0 + x1) / 2, 1.78, z] }));
    });
    // Axiallager (bronzefarben) zwischen Lagerböcken und Riemenscheibe
    [-0.27, 1.57].forEach((x) => add(bearings, cylX(0.33, 0.12, 36), mats.bronze, { pos: [x, Y_AX, Z_S] }));

    // ---------- Hebellager und 4 Hebel ----------
    const pivotBlock = group(root, 'hebellager');
    span(pivotBlock, [-3.7, -2.3], [0, 0.95], [Z_P - 0.7, Z_P + 0.7], mats.metal);
    add(pivotBlock, cylY(0.55, 0.12, 40), mats.steel, { pos: [X_P, 1.01, Z_P] });
    [[-3.55, Z_P - 0.55], [-2.45, Z_P + 0.55]].forEach(([x, z]) => add(pivotBlock, hexY(0.08, 0.06), mats.steel, { pos: [x, 0.98, z] }));

    const leverPin = group(root, '4');
    add(leverPin, cylY(0.13, 0.42, 24), mats.steel, { pos: [X_P, 1.28, Z_P] });
    add(leverPin, cylY(0.24, 0.08, 32), mats.steel, { pos: [X_P, 1.53, Z_P] });

    // Flacher Hebel mit Langlöchern an beiden Enden; er schwenkt um die senkrechte Achse
    const lever = group(root, '4', [X_P, Y_AX, Z_P]);
    const leverShape = new THREE.Shape();
    const HALF_W = 0.26;
    const yBack = ARM_BACK + 0.12;
    const yFront = -(ARM_FRONT + 0.12);
    leverShape.moveTo(-HALF_W, yFront);
    leverShape.lineTo(-HALF_W, yBack);
    leverShape.absarc(0, yBack, HALF_W, Math.PI, 0, true);
    leverShape.lineTo(HALF_W, yFront);
    leverShape.absarc(0, yFront, HALF_W, 0, Math.PI, true);
    const slot = (cy, half) => {
      const r = 0.065;
      const path = new THREE.Path();
      path.moveTo(-r, cy - half);
      path.lineTo(-r, cy + half);
      path.absarc(0, cy + half, r, Math.PI, 0, true);
      path.lineTo(r, cy - half);
      path.absarc(0, cy - half, r, 0, Math.PI, true);
      return path;
    };
    leverShape.holes.push(slot(ARM_BACK, 0.07), slot(-ARM_FRONT, 0.1));
    const leverGeo = new THREE.ExtrudeGeometry(leverShape, {
      depth: 0.16, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 24,
    });
    leverGeo.translate(0, 0, -0.08).rotateX(-Math.PI / 2);
    add(lever, leverGeo, mats.lever);

    // Gabelkopf: zwei Laschen über und unter dem Hebel, der Bolzen läuft im Langloch
    const clevis = (parent) => {
      [-1, 1].forEach((s) => span(parent, [-0.14, 0.34], [s * 0.135 - 0.03, s * 0.135 + 0.03], [-0.15, 0.15], mats.steel));
      span(parent, [0.32, 0.56], [-0.165, 0.165], [-0.15, 0.15], mats.steel);
      add(parent, cylY(0.055, 0.42, 16), mats.steel);
    };

    // ---------- Gewindespindel (fährt, dreht sich nicht) ----------
    const spindle = group(root, 'spindel', [X_P, Y_AX, Z_S]);
    clevis(spindle);
    add(spindle, cylX(0.11, 0.22, 20), mats.steel, { pos: [0.66, 0, 0] });
    add(spindle, ribbed(0.105, 0.13, 5.6, 0.07, 20).translate(0.77, 0, 0), mats.steel, { edges: false });

    // ---------- 5 Hydraulikzylinder mit Kolbenstange ----------
    const cylinder = group(root, '5');
    add(cylinder, cylX(0.42, 3.3, 48), mats.steel, { pos: [0.65, Y_AX, Z_C] });
    add(cylinder, cylX(0.425, 1.0, 48), mats.labelWhite, { pos: [0.8, Y_AX, Z_C], edges: false });
    add(cylinder, cylX(0.428, 0.22, 48), mats.labelRed, { pos: [0.5, Y_AX, Z_C], edges: false });
    add(cylinder, cylX(0.45, 0.12, 48), mats.metal, { pos: [-0.94, Y_AX, Z_C] });
    add(cylinder, ribbed(0.3, 0.36, 0.4, 0.08, 36).translate(-1.4, Y_AX, Z_C), mats.metal, { edges: false });
    span(cylinder, [2.22, 2.32], [Y_AX - 0.5, Y_AX + 0.5], [Z_C - 0.5, Z_C + 0.5], mats.metal);

    const rod = group(root, '5', [X_P, Y_AX, Z_C]);
    clevis(rod);
    add(rod, cylX(0.1, 3.2, 24), mats.steel, { pos: [2.16, 0, 0] });

    const cylinderBlock = group(root, 'zylinderbock');
    span(cylinderBlock, [2.32, 3.3], [0, 1.8], [Z_C - 0.65, Z_C + 0.65], mats.metal);
    add(cylinderBlock, cylY(0.36, 0.03, 36), mats.steel, { pos: [2.8, 1.815, Z_C] });
    add(cylinderBlock, hexY(0.3, 0.18), mats.steel, { pos: [2.8, 1.92, Z_C] });

    // ---------- 7 Ventil mit Handrad ----------
    const valve = group(root, '7');
    add(valve, cylZ(0.07, 0.3, 16), mats.steel, { pos: [-0.55, Y_AX, -1.47] });
    add(valve, cylX(0.2, 0.7, 32), mats.metal, { pos: [-0.3, Y_AX, Z_L] });
    add(valve, cylX(0.205, 0.22, 32), mats.labelWhite, { pos: [-0.12, Y_AX, Z_L], edges: false });
    add(valve, cylX(0.207, 0.06, 32), mats.labelRed, { pos: [-0.12, Y_AX, Z_L], edges: false });
    add(valve, hexX(0.15, 0.14), mats.steel, { pos: [0.12, Y_AX, Z_L] });
    const knob = group(valve, null, [-0.5, Y_AX + 0.2, Z_L]);
    add(knob, cylY(0.1, 0.16, 20), mats.black, { pos: [0, 0.08, 0] });
    add(knob, new THREE.BoxGeometry(0.34, 0.05, 0.07), mats.black, { pos: [0, 0.18, 0] });

    // ---------- Hydraulikleitung, 6 Druckaufnehmer, Anschluss Prüfling ----------
    const line = group(root, 'leitung');
    add(line, cylX(0.055, 3.43, 16), mats.pipe, { pos: [0.19 + 3.43 / 2, Y_AX, Z_L] });
    add(line, hexX(0.11, 0.12), mats.steel, { pos: [1.8, Y_AX, Z_L] });
    add(line, new THREE.BoxGeometry(0.26, 0.26, 0.26), mats.pipe, { pos: [3.75, Y_AX, Z_L] });
    add(line, cylX(0.055, 0.45, 16), mats.pipe, { pos: [4.105, Y_AX, Z_L] });

    const sensor = group(root, '6');
    add(sensor, hexZ(0.13, 0.14), mats.steel, { pos: [3.75, Y_AX, -0.95] });
    add(sensor, cylZ(0.26, 0.55, 40), mats.metal, { pos: [3.75, Y_AX, -0.605] });
    add(sensor, cylZ(0.263, 0.24, 40), mats.labelWhite, { pos: [3.75, Y_AX, -0.58], edges: false });
    add(sensor, cylZ(0.266, 0.06, 40), mats.labelRed, { pos: [3.75, Y_AX, -0.58], edges: false });
    add(sensor, cylZ(0.09, 0.2, 16), mats.black, { pos: [3.75, Y_AX, -0.23] });
    const cable = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.75, Y_AX, -0.13),
      new THREE.Vector3(3.75, 1.0, 0.25),
      new THREE.Vector3(3.6, 0.35, 0.55),
      new THREE.Vector3(3.25, 0.05, 0.72),
      new THREE.Vector3(2.7, 0.05, 0.8),
    ]);
    add(sensor, new THREE.TubeGeometry(cable, 40, 0.04, 8, false), mats.black, { edges: false });

    const outlet = group(root, 'anschluss');
    add(outlet, new THREE.BoxGeometry(0.16, 0.16, 0.16), mats.pipe, { pos: [4.4, Y_AX, Z_L] });
    add(outlet, cylY(0.055, 0.5, 16), mats.pipe, { pos: [4.4, Y_AX + 0.25, Z_L] });
    add(outlet, new THREE.BoxGeometry(0.16, 0.16, 0.16), mats.pipe, { pos: [4.4, Y_AX + 0.52, Z_L] });
    add(outlet, cylX(0.09, 0.3, 20), mats.black, { pos: [4.63, Y_AX + 0.52, Z_L] });

    // ---------- 3 Motor mit Riemenscheibe ----------
    const motor = group(root, '3');
    span(motor, [0.95, 1.1], [0, 2.95], [-0.4, 1.0], mats.metal);
    span(motor, [0.7, 1.45], [0, 0.08], [-0.4, 1.0], mats.metal);
    span(motor, [1.1, 1.24], [Y_M - 0.58, Y_M + 0.58], [Z_M - 0.58, Z_M + 0.58], mats.metal);
    add(motor, cylX(0.55, 1.6, 48), mats.black, { pos: [2.04, Y_M, Z_M] });
    add(motor, cylX(0.5, 0.08, 48), mats.dark, { pos: [2.88, Y_M, Z_M] });
    span(motor, [1.9, 2.5], [Y_M + 0.5, Y_M + 0.72], [Z_M - 0.22, Z_M + 0.22], mats.dark);
    [[mats.wireYellow, 2.05], [mats.wireBlue, 2.15], [mats.dark, 2.25]].forEach(([material, x]) => {
      add(motor, cylY(0.025, 0.14, 8), material, { pos: [x, Y_M + 0.79, Z_M + 0.12], edges: false });
    });

    const motorSpin = group(root, '3', [X_B, Y_M, Z_M]);
    add(motorSpin, cylX(0.07, 0.6, 16), mats.steel, { pos: [0.15, 0, 0] });
    add(motorSpin, cylX(RM - 0.03, 0.3, 36), mats.metal);
    [-0.16, 0.16].forEach((x) => add(motorSpin, cylX(0.34, 0.03, 36), mats.metal, { pos: [x, 0, 0] }));
    add(motorSpin, new THREE.BoxGeometry(0.06, 0.08, 0.08), mats.dark, { pos: [-0.18, 0.22, 0] });

    // ---------- 8 Riemenscheibe mit Spindelmutter ----------
    const pulley = group(root, '8', [X_B, Y_AX, Z_S]);
    add(pulley, cylX(0.95, 0.3, 64), mats.metal);
    add(pulley, new THREE.CylinderGeometry(0.953, 0.953, 0.26, 64, 1, true).rotateZ(Math.PI / 2), mats.dark, { edges: false });
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      add(pulley, cylX(0.13, 0.304, 24), mats.dark, { pos: [0, Math.cos(a) * 0.55, Math.sin(a) * 0.55], edges: false });
    }
    add(pulley, cylX(0.22, 1.72, 32), mats.steel);
    add(pulley, hexX(0.27, 0.14), mats.steel, { pos: [0.57, 0, 0] });

    // ---------- Riemen: offener Riementrieb zwischen beiden Riemenscheiben ----------
    const belt = group(root, 'riemen');
    const c1 = new THREE.Vector2(Y_AX, Z_S);
    const c2 = new THREE.Vector2(Y_M, Z_M);
    const towards = c2.clone().sub(c1);
    const centerDist = towards.length();
    towards.divideScalar(centerDist);
    const across = new THREE.Vector2(-towards.y, towards.x);
    const k = (R8 - RM) / centerDist;
    const vUp = towards.clone().multiplyScalar(k).addScaledVector(across, Math.sqrt(1 - k * k));
    const vDown = towards.clone().multiplyScalar(k).addScaledVector(across, -Math.sqrt(1 - k * k));
    const angleOf = (v) => Math.atan2(v.y, v.x);
    // Bogen von a nach b, der durch die Richtung via läuft
    const sweep = (a, b, via) => {
      let ccw = b - a;
      while (ccw <= 0) ccw += Math.PI * 2;
      let rel = via - a;
      while (rel < 0) rel += Math.PI * 2;
      return rel % (Math.PI * 2) < ccw ? ccw : ccw - Math.PI * 2;
    };
    const beltPath = [];
    const pushArc = (center, r, a0, delta, steps) => {
      for (let i = 0; i < steps; i += 1) {
        const a = a0 + (delta * i) / steps;
        const n = new THREE.Vector2(Math.cos(a), Math.sin(a));
        beltPath.push({ p: center.clone().addScaledVector(n, r), n });
      }
    };
    const pushLine = (from, to, n, steps) => {
      for (let i = 0; i < steps; i += 1) beltPath.push({ p: from.clone().lerp(to, i / steps), n: n.clone() });
    };
    const sweepBig = sweep(angleOf(vUp), angleOf(vDown), angleOf(towards.clone().negate()));
    pushArc(c1, R8, angleOf(vUp), sweepBig, 72);
    pushLine(c1.clone().addScaledVector(vDown, R8), c2.clone().addScaledVector(vDown, RM), vDown, 24);
    pushArc(c2, RM, angleOf(vDown), sweep(angleOf(vDown), angleOf(vUp), angleOf(towards)), 30);
    pushLine(c2.clone().addScaledVector(vUp, RM), c1.clone().addScaledVector(vUp, R8), vUp, 24);
    const beltDir = Math.sign(sweepBig);

    const beltLengths = [0];
    for (let i = 1; i <= beltPath.length; i += 1) {
      beltLengths.push(beltLengths[i - 1] + beltPath[i % beltPath.length].p.distanceTo(beltPath[i - 1].p));
    }
    const beltLength = beltLengths[beltPath.length];
    const ribbon = new THREE.BufferGeometry();
    const ribbonPos = [];
    const ribbonNor = [];
    const ribbonIdx = [];
    beltPath.forEach(({ p, n }, i) => {
      [-0.13, 0.13].forEach((dx) => {
        ribbonPos.push(X_B + dx, p.x, p.y);
        ribbonNor.push(0, n.x, n.y);
      });
      const j = (i + 1) % beltPath.length;
      ribbonIdx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
    });
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPos, 3));
    ribbon.setAttribute('normal', new THREE.Float32BufferAttribute(ribbonNor, 3));
    ribbon.setIndex(ribbonIdx);
    add(belt, ribbon, mats.belt, { edges: false });

    // Querrippen auf dem Riemen machen seinen Lauf sichtbar
    const teeth = [];
    const toothGeo = new THREE.BoxGeometry(0.27, 0.045, 0.04);
    const TOOTH_COUNT = Math.round(beltLength / 0.12);
    for (let i = 0; i < TOOTH_COUNT; i += 1) teeth.push(add(belt, toothGeo, mats.belt, { edges: false }));
    const beltPoint = new THREE.Vector2();
    const beltNormal = new THREE.Vector2();
    const placeTeeth = (offset) => {
      teeth.forEach((tooth, i) => {
        let s = ((i / TOOTH_COUNT) * beltLength + offset) % beltLength;
        if (s < 0) s += beltLength;
        let lo = 0;
        let hi = beltPath.length;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (beltLengths[mid] <= s) lo = mid;
          else hi = mid;
        }
        const f = (s - beltLengths[lo]) / (beltLengths[lo + 1] - beltLengths[lo] || 1);
        const a = beltPath[lo];
        const b = beltPath[(lo + 1) % beltPath.length];
        beltPoint.copy(a.p).lerp(b.p, f);
        beltNormal.copy(a.n).lerp(b.n, f).normalize();
        tooth.position.set(X_B, beltPoint.x, beltPoint.y);
        tooth.rotation.x = Math.atan2(beltNormal.y, beltNormal.x);
      });
    };

    // Alle Bauteile kennen ihren Schlüssel, damit ein Klick den Namen findet
    root.traverse((obj) => {
      if (!obj.isMesh || obj.userData.part) return;
      let parent = obj.parent;
      while (parent && !parent.userData.part) parent = parent.parent;
      if (parent) obj.userData.part = parent.userData.part;
    });

    // ---------- Mechanik ----------
    // Die Riemenscheibe dreht die Spindelmutter, die Spindel fährt und schwenkt den Hebel,
    // der Hebel zieht die Kolbenstange (Übersetzung ARM_FRONT : ARM_BACK)
    const THETA0 = -9 * DEG;
    const THETA1 = 9 * DEG;
    const LEAD = 0.12;
    const X_S0 = X_P + ARM_FRONT * Math.tan(THETA0);
    const setMechanism = (u) => {
      const theta = THETA0 + (THETA1 - THETA0) * u;
      const tan = Math.tan(theta);
      lever.rotation.y = theta;
      spindle.position.x = X_P + ARM_FRONT * tan;
      rod.position.x = X_P - ARM_BACK * tan;
      const turn = ((spindle.position.x - X_S0) / LEAD) * Math.PI * 2;
      pulley.rotation.x = turn;
      motorSpin.rotation.x = turn * (R8 / RM);
      placeTeeth(beltDir * turn * R8);
    };

    // Druck in der Leitung: leicht glühend, von grün über gelb nach rot
    const lowColor = new THREE.Color(0x93d3a2);
    const midColor = new THREE.Color(0xf0c24b);
    const highColor = new THREE.Color(0xe0484d);
    const glow = new THREE.Color();
    const setPressureGlow = (p) => {
      if (p < 0.5) glow.copy(lowColor).lerp(midColor, p / 0.5);
      else glow.copy(midColor).lerp(highColor, (p - 0.5) / 0.5);
      mats.pipe.emissive.copy(glow).multiplyScalar(smooth(0.02, 0.2, p) * (0.12 + 0.4 * p));
    };

    // ---------- Beschriftungen ----------
    const at = (obj, x, y, z) => ({ obj, local: new THREE.Vector3(x, y, z) });
    const anchors = {
      1: at(root, -5.36, 2.1, 2.6),
      2: at(root, -3.6, 0, 2.7),
      3: at(root, 2.1, Y_M + 0.55, Z_M + 0.2),
      4: at(lever, 0, 0.09, ARM_FRONT * 0.55),
      5: at(root, 1.5, Y_AX + 0.42, Z_C),
      6: at(root, 3.75, Y_AX + 0.26, -0.62),
      7: at(root, -0.3, Y_AX + 0.2, Z_L),
      8: at(root, X_B - 0.15, Y_AX + 0.95, Z_S),
      9: at(root, 2.4, 0.14, 2.7),
      spindel: at(spindle, 1.4, 0.13, 0),
      riemen: at(root, X_B, (Y_AX + Y_M) / 2 + 0.55, (Z_S + Z_M) / 2 + 0.45),
      lagerbock: at(root, -0.8, 1.75, Z_S),
      hebellager: at(root, -2.4, 0.95, -0.35),
      zylinderbock: at(root, 3.2, 1.8, -1.4),
      leitung: at(root, 2.4, Y_AX + 0.05, Z_L),
      anschluss: at(root, 4.7, Y_AX + 0.52, Z_L),
    };

    const SVG_NS = 'http://www.w3.org/2000/svg';
    Object.entries(LABELS).forEach(([id, def]) => {
      const box = document.createElement('div');
      box.className = 'rig-label';
      const name = document.createElement('span');
      name.className = 'rig-label-name';
      if (def.num) {
        const num = document.createElement('b');
        num.className = 'rig-label-num';
        num.textContent = String(def.num);
        name.append(num);
      }
      name.append(document.createTextNode(def.name));
      box.append(name);
      if (def.sub) {
        const sub = document.createElement('span');
        sub.className = 'rig-label-sub';
        sub.textContent = def.sub;
        box.append(sub);
      }
      labelLayer.append(box);
      def.el = box;
      def.line = document.createElementNS(SVG_NS, 'line');
      def.dot = document.createElementNS(SVG_NS, 'circle');
      def.dot.setAttribute('r', '3.5');
      leaders.append(def.line, def.dot);
      def.anchor = anchors[id];
    });

    // ---------- Selbst drehen und Bauteile anklicken ----------
    // Sobald jemand zieht oder klickt, pausiert der Rundgang; der Prüfablauf läuft weiter.
    const BASE_YAW = 0.38;
    const SWAY = 0.3;
    const DEFAULT_PITCH = 0.6;
    let manual = false;
    let manualYaw = 0;
    let resumedAt = -Infinity;
    let picked = null;
    let pitch = DEFAULT_PITCH;
    let cameraDistance = 30;

    const shortestAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    const placeCamera = () => {
      camera.position.set(0, 0.9 + cameraDistance * Math.sin(pitch), cameraDistance * Math.cos(pitch));
      camera.lookAt(0, 0.9, 0);
    };

    const enterManual = () => {
      if (manual) return;
      manual = true;
      manualYaw = root.rotation.y;
      if (tourButton) tourButton.hidden = false;
    };

    const resumeTour = () => {
      manual = false;
      picked = null;
      manualYaw = root.rotation.y;
      resumedAt = performance.now();
      pitch = DEFAULT_PITCH;
      placeCamera();
      if (tourButton) tourButton.hidden = true;
    };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    // Liefert das Bauteil unter dem Mauszeiger samt Trefferpunkt im Bauteil
    const pickAt = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(root, true);
      const hit = hits.find((h) => h.object.userData.part && !h.object.material.transparent)
        || hits.find((h) => h.object.userData.part);
      if (!hit) return null;
      return { id: hit.object.userData.part, object: hit.object, local: hit.object.worldToLocal(hit.point.clone()) };
    };

    const anchor = new THREE.Vector3();
    const placeLabels = (tc) => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const top = 70;
      const bottom = 56;
      const gap = Math.max(20, Math.min(56, W * 0.07));
      const placed = [];

      Object.entries(LABELS).forEach(([id, def]) => {
        let fade = 0;
        if (manual) {
          fade = picked && picked.id === id ? 1 : 0;
        } else {
          LABEL_TIMES.forEach((slotTime) => {
            if (slotTime.ids.includes(id)) {
              fade = Math.max(fade, smooth(slotTime.from, slotTime.from + 0.45, tc) * (1 - smooth(slotTime.to - 0.45, slotTime.to, tc)));
            }
          });
        }
        if (fade <= 0.01) {
          def.el.style.opacity = '0';
          def.line.style.opacity = '0';
          def.dot.style.opacity = '0';
          return;
        }
        if (manual && picked.object) picked.object.localToWorld(anchor.copy(picked.local)).project(camera);
        else def.anchor.obj.localToWorld(anchor.copy(def.anchor.local)).project(camera);
        const ax = ((anchor.x + 1) / 2) * W;
        const ay = ((1 - anchor.y) / 2) * H;
        const bw = def.el.offsetWidth;
        const bh = def.el.offsetHeight;
        const onLeft = ax < W / 2;
        let x = onLeft ? ax - gap - bw : ax + gap;
        x = Math.min(W - 10 - bw, Math.max(10, x));
        let y = Math.min(H - bottom - bh, Math.max(top, ay - bh / 2 - 22));
        placed.forEach((p) => {
          if (x < p.x + p.w && x + bw > p.x && y < p.y + p.h + 10 && y + bh > p.y - 10) y = p.y + p.h + 10;
        });
        placed.push({ x, y, w: bw, h: bh });

        def.el.style.transform = `translate(${x}px, ${y}px)`;
        def.el.style.opacity = String(fade);
        const ex = onLeft ? x + bw : x;
        const ey = y + bh / 2;
        def.line.setAttribute('x1', ax);
        def.line.setAttribute('y1', ay);
        def.line.setAttribute('x2', ex);
        def.line.setAttribute('y2', ey);
        def.line.style.opacity = String(fade);
        def.dot.setAttribute('cx', ax);
        def.dot.setAttribute('cy', ay);
        def.dot.style.opacity = String(fade);
      });
    };

    // ---------- Druckverlauf und Prüfling (SVG) ----------
    const svg = (tag, attrs, parent) => {
      const node = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      if (parent) parent.append(node);
      return node;
    };
    const CX0 = 14;
    const CX1 = 352;
    const CY0 = 22;
    const CY1 = 84;
    const tx = (t) => CX0 + (t / CYCLE) * (CX1 - CX0);
    const py = (p) => CY1 - p * (CY1 - CY0);
    const curve = [];
    for (let i = 0; i <= CYCLE * 10; i += 1) curve.push([tx(i / 10), py(stateAt(i / 10).p)]);
    const toPath = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

    chart.replaceChildren();
    svg('line', { x1: CX0, y1: CY1, x2: CX1, y2: CY1, class: 'rig-chart-axis' }, chart);
    svg('text', { x: CX0, y: 10, class: 'rig-chart-title' }, chart).textContent = 'Druck';
    [3, 11, 16, 24, 29.5].forEach((t) => svg('line', { x1: tx(t), y1: CY0 - 6, x2: tx(t), y2: CY1, class: 'rig-chart-sep' }, chart));
    [['Aufbau', 3, 11], ['Halten', 11, 16], ['Bersten', 16, 24], ['Entlasten', 24, 29.5]].forEach(([name, a, b]) => {
      svg('text', { x: (tx(a) + tx(b)) / 2, y: CY1 + 15, 'text-anchor': 'middle' }, chart).textContent = name;
    });
    svg('line', { x1: tx(3), y1: py(HOLD), x2: tx(16), y2: py(HOLD), class: 'rig-chart-hold' }, chart);
    svg('text', { x: tx(11) + 4, y: py(HOLD) - 5 }, chart).textContent = 'Prüfdruck';
    svg('path', { d: toPath(curve), class: 'rig-chart-all' }, chart);
    const progressPath = svg('path', { d: '', class: 'rig-chart-now' }, chart);
    svg('circle', { cx: tx(BURST_AT), cy: py(1), r: 3.2, class: 'rig-chart-burst' }, chart);
    svg('text', { x: tx(BURST_AT) + 7, y: py(1) + 3 }, chart).textContent = 'Berstdruck';
    const nowDot = svg('circle', { cx: tx(0), cy: py(0), r: 3, class: 'rig-chart-dot' }, chart);

    balloonSvg.replaceChildren();
    svg('line', { x1: 4, y1: 32, x2: 140, y2: 32, class: 'rig-balloon-shaft' }, balloonSvg);
    svg('circle', { cx: 142, cy: 32, r: 2.6, class: 'rig-balloon-tip' }, balloonSvg);
    const intact = svg('g', {}, balloonSvg);
    const balloonShape = svg('ellipse', { cx: 76, cy: 32, rx: 26, ry: 4, class: 'rig-balloon-skin' }, intact);
    [64, 88].forEach((x) => svg('rect', { x: x - 1.5, y: 29, width: 3, height: 6, class: 'rig-balloon-marker' }, intact));
    const torn = svg('g', { class: 'rig-balloon-torn' }, balloonSvg);
    svg('path', { d: 'M46 32 Q52 20 61 25 L57 29 L64 32 L56 37 Q51 42 46 32 Z' }, torn);
    svg('path', { d: 'M106 32 Q100 20 91 25 L95 29 L88 32 L96 37 Q101 42 106 32 Z' }, torn);

    let lastPhase = null;
    let lastSample = '';
    const updatePanel = (tc, st) => {
      const phase = phaseAt(tc);
      if (phase !== lastPhase) {
        lastPhase = phase;
        stepEl.textContent = phase.step ? `Schritt ${phase.step} von 4` : 'Ausgangslage';
        phaseEl.textContent = phase.name;
        explainEl.textContent = phase.text;
      }

      const upto = curve.filter(([x]) => x <= tx(tc));
      upto.push([tx(tc), py(st.p)]);
      progressPath.setAttribute('d', toPath(upto));
      nowDot.setAttribute('cx', tx(tc).toFixed(1));
      nowDot.setAttribute('cy', py(st.p).toFixed(1));

      const fill = Math.min(st.p / HOLD, 1);
      const over = clamp01((st.p - HOLD) / (1 - HOLD));
      balloonShape.setAttribute('rx', (26 + 10 * fill + 4 * over).toFixed(2));
      balloonShape.setAttribute('ry', (4 + 9 * fill + 5 * over).toFixed(2));
      intact.style.display = st.burst ? 'none' : '';
      intact.style.opacity = tc >= 29.5 ? String(smooth(29.5, 29.95, tc)) : '1';
      torn.style.display = st.burst ? '' : 'none';

      let sample = 'drucklos';
      if (st.burst) sample = 'geplatzt';
      else if (tc >= 29.5) sample = 'neuer Prüfling';
      else if (tc >= 16) sample = 'Druck steigt';
      else if (tc >= 11) sample = 'Prüfdruck gehalten';
      else if (tc >= 3) sample = 'wird gefüllt';
      if (sample !== lastSample) {
        lastSample = sample;
        sampleState.textContent = sample;
      }
    };

    // ---------- Ablauf ----------
    const renderAt = (time) => {
      const tc = ((time % CYCLE) + CYCLE) % CYCLE;
      const st = stateAt(tc);
      const autoYaw = BASE_YAW + SWAY * Math.sin((Math.PI * 2 * tc) / CYCLE);
      if (manual) {
        root.rotation.y = manualYaw;
      } else {
        // Nach „Rundgang fortsetzen“ weich zur automatischen Drehung zurückkehren
        const blend = easeInOut(clamp01((performance.now() - resumedAt) / 900));
        root.rotation.y = manualYaw + shortestAngle(autoYaw - manualYaw) * blend;
      }

      setMechanism(st.u);
      knob.rotation.y = st.valve * Math.PI * 0.5;
      setPressureGlow(st.p);

      root.updateMatrixWorld(true);
      renderer.render(scene, camera);
      placeLabels(tc);
      updatePanel(tc, st);
    };

    const resize = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const vfov = camera.fov * DEG;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      // Im Querformat darf das Gehäuse am Rand angeschnitten sein, in schmalen Bühnen bleibt der Hebel ganz im Bild
      const fit = 5.1 + 0.9 * clamp01((4 / 3 - camera.aspect) / (1 / 3));
      cameraDistance = fit / Math.sin(Math.min(vfov, hfov) / 2);
      placeCamera();
      camera.updateProjectionMatrix();
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let playing = !reduceMotion.matches;
    let visible = true;
    let time = playing ? 0 : 8;
    let last = performance.now();
    let frame = 0;

    const setPlaying = (value) => {
      playing = value;
      playLabel.textContent = playing ? 'Pause' : 'Abspielen';
      playIcon.setAttribute('d', playing ? 'M3 2h2v8H3zM7 2h2v8H7z' : 'M3 1.5v9l7.5-4.5z');
    };

    // Ziehen dreht den Prüfstand (Maus zusätzlich: hoch/runter kippt die Ansicht), Klicken zeigt den Namen
    let drag = null;
    let hover = null;

    // Nur rechnen, solange die Animation zu sehen ist
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        if (playing) time += dt;
        renderAt(time);
        // Zeiger über einem Bauteil? Dann Hand-Cursor (höchstens einmal pro Bild geprüft)
        if (hover && !drag) {
          canvas.style.cursor = pickAt(hover.x, hover.y) ? 'pointer' : 'grab';
          hover = null;
        }
      }
      frame = requestAnimationFrame(loop);
    };

    const onPlay = () => setPlaying(!playing);
    playButton.addEventListener('click', onPlay);
    if (tourButton) tourButton.addEventListener('click', resumeTour);

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    };

    const onPointerMove = (event) => {
      if (!drag || event.pointerId !== drag.id) {
        if (event.pointerType === 'mouse') hover = { x: event.clientX, y: event.clientY };
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        enterManual();
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
      manualYaw += dx * 0.012;
      if (event.pointerType === 'mouse') {
        pitch = Math.min(1.25, Math.max(0.05, pitch + dy * 0.006));
        placeCamera();
      }
    };

    const onPointerUp = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const wasDrag = drag.moved;
      drag = null;
      canvas.style.cursor = 'grab';
      if (wasDrag) return;
      const result = pickAt(event.clientX, event.clientY);
      if (result) {
        enterManual();
        picked = result;
      } else {
        picked = null;
      }
    };

    const onPointerCancel = () => {
      drag = null;
      canvas.style.cursor = 'grab';
    };

    const onPointerLeave = () => {
      hover = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      renderAt(time);
    });
    resizeObserver.observe(stage);

    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    visibilityObserver.observe(stage);

    setPlaying(playing);
    resize();
    renderAt(time);
    frame = requestAnimationFrame(loop);

    return {
      destroy() {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        playButton.removeEventListener('click', onPlay);
        if (tourButton) tourButton.removeEventListener('click', resumeTour);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerCancel);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  };

  const mount = (container) => {
    let destroyed = false;
    let instance = null;
    loadThree()
      .then((THREE) => {
        if (destroyed) return;
        try {
          instance = create(THREE, container);
        } catch (error) {
          container.classList.add('is-unavailable');
        }
      })
      .catch(() => container.classList.add('is-unavailable'));
    return {
      destroy() {
        destroyed = true;
        if (instance) instance.destroy();
        instance = null;
      },
    };
  };

  window.TesterAnimation = { mount };
})();
