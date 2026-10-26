// Kniegelenk-Animation (3D, three.js): 360°-Drehung mit zwei Kniebeugen, Beschriftungen an acht Stopps
// und farbige Belastung der Bänder. Wird bei Bedarf in einen Container eingehängt: KneeAnimation.mount(el).
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

  const create = (THREE, container) => {
    const stage = container.querySelector('.knee-stage');
    const canvas = container.querySelector('.knee-canvas');
    const leaders = container.querySelector('.knee-leaders');
    const labelLayer = container.querySelector('.knee-labels');
    const flexValue = container.querySelector('.knee-readout-value');
    const playButton = container.querySelector('.knee-play');
    const playLabel = playButton.querySelector('span');
    const playIcon = playButton.querySelector('path');
    const tourButton = container.querySelector('.knee-tour');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

    // ---------- Hilfsfunktionen ----------
    const DEG = Math.PI / 180;
    const AXIS_X = new THREE.Vector3(1, 0, 0);
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const smooth = (e0, e1, x) => {
      const t = clamp01((x - e0) / (e1 - e0));
      return t * t * (3 - 2 * t);
    };
    const gauss = (x, mu, sigma) => Math.exp(-(((x - mu) / sigma) ** 2));
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d6d6, 0.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(7, 12, 10);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(-9, 5, -8);
    scene.add(rimLight);

    // Modell: Tibia steht fest, der Femur beugt sich darüber, die Patella hängt am Femur
    const root = new THREE.Group();
    const tibia = new THREE.Group();
    const femur = new THREE.Group();
    const patella = new THREE.Group();
    scene.add(root);
    root.add(tibia, femur);
    femur.add(patella);

    // ---------- Materialien ----------
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8e7e3, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    const cartilageMat = new THREE.MeshStandardMaterial({ color: 0xc3cbd0, roughness: 0.5, side: THREE.DoubleSide });
    const meniscusMat = new THREE.MeshStandardMaterial({ color: 0xdfe5e9, roughness: 0.45, side: THREE.DoubleSide });
    const meshLines = new THREE.MeshBasicMaterial({ color: 0x222222, wireframe: true, transparent: true, opacity: 0.07, depthWrite: false });
    const fadeMats = [boneMat, cartilageMat];

    const sphere = new THREE.SphereGeometry(1, 44, 30);
    const capGeo = new THREE.SphereGeometry(1, 44, 18, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58);

    // Netzlinien wie im FE-Modell liegen als zweite Schicht auf jedem Knochen
    const add = (parent, geometry, material, pos, scale, rot, lines = true) => {
      const mesh = new THREE.Mesh(geometry, material);
      if (pos) mesh.position.set(...pos);
      if (scale) mesh.scale.set(...scale);
      if (rot) mesh.rotation.set(...rot);
      if (lines) {
        const overlay = new THREE.Mesh(geometry, meshLines);
        overlay.raycast = () => {}; // gleiche Fläche wie der Knochen, beim Anklicken nicht doppelt prüfen
        mesh.add(overlay);
      }
      parent.add(mesh);
      return mesh;
    };

    const lathe = (profile, segments = 48) => {
      const points = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(56);
      points.forEach((p) => { p.x = Math.max(0, p.x); });
      return new THREE.LatheGeometry(points, segments);
    };

    // ---------- Femur (Ursprung zwischen den Kondylen) ----------
    add(femur, sphere, boneMat, [-1.55, 0, -0.25], [1.15, 1.45, 1.75]);
    add(femur, sphere, boneMat, [1.55, 0, -0.25], [1.15, 1.45, 1.75]);
    add(femur, sphere, boneMat, [0, 0.95, 0.45], [1.85, 1.3, 1.1]);
    add(femur, lathe([[1.98, 0.25], [1.88, 0.9], [1.5, 1.8], [1.1, 2.8], [0.9, 3.8], [0.82, 5.2], [0.8, 6.2], [0, 6.25]]), boneMat, null, [1.45, 1, 0.85]);
    add(femur, sphere, boneMat, [-2.55, 0.35, -0.3], [0.42, 0.42, 0.42], null, false);
    add(femur, sphere, boneMat, [2.55, 0.35, -0.3], [0.42, 0.42, 0.42], null, false);
    add(femur, capGeo, cartilageMat, [-1.55, 0, -0.25], [1.18, 1.48, 1.78]);
    add(femur, capGeo, cartilageMat, [1.55, 0, -0.25], [1.18, 1.48, 1.78]);

    // ---------- Tibia, Fibula, Menisken (Ursprung: Mitte des Tibiaplateaus) ----------
    add(tibia, lathe([[0, -6.2], [1.05, -6.15], [1.08, -5], [1.22, -3.6], [1.55, -2.4], [2.15, -1.4], [2.65, -0.7], [2.85, -0.25], [2.72, 0], [0, 0.02]]), boneMat, null, [1.12, 1, 0.76]);
    add(tibia, sphere, boneMat, [0, -2.0, 1.66], [0.7, 1.25, 0.36]);
    add(tibia, sphere, boneMat, [0, 0.02, -0.05], [0.5, 0.26, 0.75], null, false);
    const plateCartilage = new THREE.CylinderGeometry(1, 1, 0.08, 40);
    add(tibia, plateCartilage, cartilageMat, [-1.55, 0.06, -0.1], [1.25, 1, 1.15], null, false);
    add(tibia, plateCartilage, cartilageMat, [1.55, 0.06, -0.1], [1.25, 1, 1.15], null, false);
    add(tibia, sphere, boneMat, [2.95, -1.55, -1.0], [0.62, 0.75, 0.58]);
    add(tibia, new THREE.CylinderGeometry(0.3, 0.27, 4.6, 24, 6), boneMat, [2.85, -3.95, -1.0]);

    // Menisken: keilförmiger Querschnitt (außen hoch, innen dünn auslaufend), an den Hörnern verjüngt.
    // Der Innenmeniskus ist C-förmig weit offen, der Außenmeniskus fast ringförmig.
    const meniscusGeometry = ({ a, b, width, height, gap, gapDir }) => {
      const N = 72;
      const start = gapDir + gap / 2;
      const span = Math.PI * 2 - gap;
      const profile = [[-0.5, 0], [0.5, 0], [0.57, 0.42], [0.5, 0.8], [0.3, 1], [-0.5, 0.1]];
      const rings = [];
      for (let i = 0; i <= N; i += 1) {
        const s = i / N;
        const phi = start + span * s;
        const taper = 0.45 + 0.55 * smooth(0, 0.14, s) * (1 - smooth(0.86, 1, s));
        const cx = a * Math.cos(phi);
        const cz = b * Math.sin(phi);
        let nx = Math.cos(phi) / a;
        let nz = Math.sin(phi) / b;
        const nl = Math.hypot(nx, nz);
        nx /= nl;
        nz /= nl;
        const w = width * (0.65 + 0.35 * taper);
        rings.push(profile.map(([u, v]) => [cx + nx * u * w, v * height * taper, cz + nz * u * w]));
      }
      const positions = [];
      const indices = [];
      for (let e = 0; e < profile.length; e += 1) {
        const e2 = (e + 1) % profile.length;
        const base = positions.length / 3;
        for (let i = 0; i <= N; i += 1) positions.push(...rings[i][e], ...rings[i][e2]);
        for (let i = 0; i < N; i += 1) {
          const p = base + i * 2;
          indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
        }
      }
      [0, N].forEach((i) => {
        const base = positions.length / 3;
        rings[i].forEach((pt) => positions.push(...pt));
        for (let k = 1; k < profile.length - 1; k += 1) indices.push(base, base + k, base + k + 1);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };
    add(tibia, meniscusGeometry({ a: 0.98, b: 1.2, width: 0.6, height: 0.42, gap: 70 * DEG, gapDir: 0 }), meniscusMat, [-1.55, 0.09, -0.1]);
    add(tibia, meniscusGeometry({ a: 0.88, b: 0.92, width: 0.55, height: 0.4, gap: 36 * DEG, gapDir: Math.PI }), meniscusMat, [1.55, 0.09, -0.05]);

    // ---------- Patella ----------
    add(patella, sphere, boneMat, [0, 0, 0], [1.2, 1.4, 0.5]);

    // Jede anklickbare Fläche kennt ihre Struktur (Schlüssel aus LABELS weiter unten)
    femur.children.forEach((m) => {
      if (m.isMesh) m.userData.structure = m.material === cartilageMat ? 'cart' : 'femur';
    });
    patella.children.forEach((m) => {
      if (m.isMesh) m.userData.structure = 'patella';
    });
    tibia.children.forEach((m) => {
      if (!m.isMesh) return;
      if (m.material === cartilageMat) m.userData.structure = 'cart';
      else if (m.material === meniscusMat) m.userData.structure = m.position.x < 0 ? 'menMed' : 'menLat';
      else if (m.position.x > 2.5) m.userData.structure = 'fibula';
      else m.userData.structure = 'tibia';
    });

    // ---------- Bänder ----------
    // Pfadpunkte je Bezugssystem: F = Femur, T = Tibia/Fibula, P = Patella.
    // spread verteilt die Fasern; load ist ein vereinfachter Belastungsverlauf (0–1) über den Beugewinkel;
    // wrap nennt die Knochen, um die das Band herumgeführt wird.
    const LIGAMENTS = [
      { id: 'acl', name: 'Vorderes Kreuzband', radius: 0.075,
        path: [['F', 0.28, -0.35, -0.95], ['T', 0.2, 0.1, 0.95]],
        spread: [[0, 0, 0], [0.05, 0.1, 0.12], [-0.05, -0.08, -0.1]],
        load: (d) => 0.22 + 0.78 * gauss(d, 15, 26) },
      { id: 'pcl', name: 'Hinteres Kreuzband', radius: 0.08,
        path: [['F', -0.28, -0.55, 0.25], ['T', 0, -0.65, -2.36]],
        spread: [[0, 0, 0], [-0.05, 0.1, 0.1], [0.05, -0.08, -0.1]],
        load: (d) => 0.12 + 0.88 * smooth(25, 110, d), wrap: ['tibiaCap', 'tibiaFlare'] },
      { id: 'mcl', name: 'Innenband', radius: 0.06,
        path: [['F', -2.75, 0.35, -0.15], ['T', -3.32, -0.25, 0.12], ['T', -1.45, -4.3, 0.42]],
        spread: [[0, 0, -0.36], [0, 0, -0.12], [0, 0, 0.12], [0, 0, 0.36]],
        load: (d) => 0.18 + 0.62 * gauss(d, 45, 38), wrap: ['condMed', 'tibiaCap', 'tibiaFlare'] },
      { id: 'lcl', name: 'Außenband', radius: 0.07,
        path: [['F', 2.78, 0.3, -0.35], ['T', 3.34, -0.25, -0.72], ['T', 3.12, -1.0, -1.0]],
        spread: [[0, 0, -0.1], [0, 0, 0.1]],
        load: (d) => 0.14 + 0.66 * gauss(d, 0, 38), wrap: ['condLat', 'tibiaCap', 'tibiaFlare'] },
      { id: 'pt', name: 'Patellasehne', radius: 0.075,
        path: [['P', 0, -1.2, -0.05], ['T', 0, -1.95, 2.08]],
        spread: [[-0.45, 0, 0], [-0.22, 0, 0], [0, 0, 0], [0.22, 0, 0], [0.45, 0, 0]],
        load: (d) => 0.1 + 0.9 * smooth(5, 105, d), wrap: ['condMed', 'condLat', 'troch', 'tibiaCap', 'tibiaFlare'] },
      { id: 'quad', name: 'Quadrizepssehne', radius: 0.075,
        path: [['P', 0, 1.25, -0.1], ['F', 0, 5.2, 0.9]],
        spread: [[-0.5, 0, 0], [-0.25, 0, 0], [0, 0, 0], [0.25, 0, 0], [0.5, 0, 0]],
        load: (d) => 0.12 + 0.88 * smooth(10, 115, d), wrap: ['condMed', 'condLat', 'troch', 'meta', 'shaftLow', 'shaftHigh'] },
      { id: 'mpfl', name: 'Mediales patellofemorales Band', radius: 0.045,
        path: [['P', -1.1, 0.25, -0.15], ['F', -2.55, 0.8, -0.1]],
        spread: [[0, 0.14, 0], [0, 0, 0], [0, -0.14, 0]],
        load: (d) => 0.14 + 0.76 * gauss(d, 12, 22), wrap: ['condMed', 'troch'] },
      { id: 'lpfl', name: 'Laterales patellofemorales Band', radius: 0.045,
        path: [['P', 1.1, 0.25, -0.15], ['F', 2.55, 0.75, -0.15]],
        spread: [[0, 0.14, 0], [0, 0, 0], [0, -0.14, 0]],
        load: (d) => 0.1 + 0.4 * gauss(d, 20, 30), wrap: ['condLat', 'troch'] },
    ];
    const ligamentById = {};

    const lowColor = new THREE.Color(0x93d3a2);
    const midColor = new THREE.Color(0xf0c24b);
    const highColor = new THREE.Color(0xe0484d);
    const loadColor = (t, out) => (t < 0.5
      ? out.copy(lowColor).lerp(midColor, t / 0.5)
      : out.copy(midColor).lerp(highColor, (t - 0.5) / 0.5));

    // Jede Faser ist ein Schlauch über SAMPLES Stützpunkte, der in jedem Bild neu geformt wird
    const SAMPLES = 26;
    const RADIAL = 6;
    const makeTube = () => {
      const count = SAMPLES * RADIAL;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const index = [];
      for (let i = 0; i < SAMPLES - 1; i += 1) {
        for (let j = 0; j < RADIAL; j += 1) {
          const a = i * RADIAL + j;
          const b = i * RADIAL + ((j + 1) % RADIAL);
          index.push(a, a + RADIAL, b, b, a + RADIAL, b + RADIAL);
        }
      }
      geometry.setIndex(index);
      return geometry;
    };

    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const binormal = new THREE.Vector3();
    const reference = new THREE.Vector3();
    const writeTube = (geometry, pts, radius) => {
      const pos = geometry.attributes.position.array;
      const nor = geometry.attributes.normal.array;
      for (let i = 0; i < SAMPLES; i += 1) {
        tangent.subVectors(pts[Math.min(SAMPLES - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        if (i === 0) {
          reference.set(0, 0, 1);
          if (Math.abs(tangent.dot(reference)) > 0.9) reference.set(1, 0, 0);
          normal.crossVectors(tangent, reference).normalize();
        } else {
          // Parallelverschiebung des Rahmens, damit sich der Schlauch nicht verdreht
          normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
        }
        binormal.crossVectors(tangent, normal);
        for (let j = 0; j < RADIAL; j += 1) {
          const angle = (j / RADIAL) * Math.PI * 2;
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const k = (i * RADIAL + j) * 3;
          const nx = normal.x * c + binormal.x * s;
          const ny = normal.y * c + binormal.y * s;
          const nz = normal.z * c + binormal.z * s;
          nor[k] = nx;
          nor[k + 1] = ny;
          nor[k + 2] = nz;
          pos[k] = pts[i].x + nx * radius;
          pos[k + 1] = pts[i].y + ny * radius;
          pos[k + 2] = pts[i].z + nz * radius;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    };

    LIGAMENTS.forEach((lig) => {
      ligamentById[lig.id] = lig;
      lig.value = 0;
      lig.material = new THREE.MeshStandardMaterial({ color: lowColor.clone(), roughness: 0.45, emissive: new THREE.Color(0x000000), side: THREE.DoubleSide });
      lig.fibers = lig.spread.map((offset) => {
        const points = lig.path.map(([frame, x, y, z]) => ({
          frame,
          local: new THREE.Vector3(x + offset[0], y + offset[1], z + offset[2]),
          world: new THREE.Vector3(),
        }));
        const geometry = makeTube();
        const mesh = new THREE.Mesh(geometry, lig.material);
        mesh.frustumCulled = false;
        mesh.userData.structure = lig.id;
        root.add(mesh);
        return {
          points,
          pathWorld: points.map((p) => p.world),
          samples: Array.from({ length: SAMPLES }, () => new THREE.Vector3()),
          geometry,
        };
      });
    });

    // ---------- Kinematik ----------
    const patellaMatrix = new THREE.Matrix4();
    const tmpCenter = new THREE.Vector3();
    const tmpPole = new THREE.Vector3();

    const toRoot = (frame, local, out) => {
      out.copy(local);
      if (frame === 'F') out.applyMatrix4(femur.matrix);
      else if (frame === 'P') out.applyMatrix4(patellaMatrix);
      return out;
    };

    // Kondylen-Ellipse in der Sagittalebene (zum Abrollen auf dem Tibiaplateau)
    const condyle = [];
    for (let k = 0; k < 90; k += 1) {
      const t = (k / 90) * Math.PI * 2;
      condyle.push([1.45 * Math.cos(t), -0.25 + 1.75 * Math.sin(t)]);
    }

    const PATELLA_POLE = new THREE.Vector3(0, -1.2, -0.05);
    const TUBEROSITY = new THREE.Vector3(0, -1.95, 2.08);
    // In Streckung liegt die Patella auf der Trochlea, mit zunehmender Beugung gleitet sie enger um die Kondylen
    const patellaCenter = (alpha, out) => {
      const radius = 2.45 - 0.6 * smooth(0, 90 * DEG, alpha);
      return out.set(0, 0.1 - radius * Math.sin(alpha), -0.25 + radius * Math.cos(alpha));
    };
    const poleInRoot = (alpha, out) => {
      patellaCenter(alpha, tmpCenter);
      return out.copy(PATELLA_POLE).applyAxisAngle(AXIS_X, alpha).add(tmpCenter).applyMatrix4(femur.matrix);
    };

    let patellaAlpha = -25 * DEG;
    femur.position.set(0, 0.12 + 1.45, 0);
    femur.updateMatrix();
    const tendonLength = poleInRoot(patellaAlpha, tmpPole).distanceTo(TUBEROSITY);

    const placeFemur = (deg) => {
      const th = deg * DEG;
      const c = Math.cos(th);
      const s = Math.sin(th);
      let minY = Infinity;
      condyle.forEach(([y, z]) => { minY = Math.min(minY, y * c + z * s); });
      femur.rotation.set(-th, 0, 0);
      femur.position.set(0, 0.12 - minY, -0.4 * (deg / 120));
      femur.updateMatrix();
    };

    // Die Patella gleitet so über die Femurrolle, dass die Patellasehne ihre Länge behält
    const solvePatella = () => {
      let best = patellaAlpha;
      let bestScore = Infinity;
      for (let a = patellaAlpha - 30 * DEG; a <= patellaAlpha + 30 * DEG; a += 0.5 * DEG) {
        const alpha = Math.min(140 * DEG, Math.max(-60 * DEG, a));
        const err = Math.abs(poleInRoot(alpha, tmpPole).distanceTo(TUBEROSITY) - tendonLength);
        const score = err + 0.002 * Math.abs(alpha - patellaAlpha) / DEG;
        if (score < bestScore) {
          bestScore = score;
          best = alpha;
        }
      }
      patellaAlpha = best;
    };

    let lastFlexion = 0;
    const setFlexion = (deg) => {
      // Große Sprünge (Neustart) in kleinen Schritten nachführen, damit die Patella nicht springt
      const steps = Math.max(1, Math.ceil(Math.abs(deg - lastFlexion) / 2));
      for (let i = 1; i <= steps; i += 1) {
        placeFemur(lastFlexion + ((deg - lastFlexion) * i) / steps);
        solvePatella();
      }
      lastFlexion = deg;
      patellaCenter(patellaAlpha, patella.position);
      patella.rotation.set(patellaAlpha, 0, 0);
      patella.updateMatrix();
    };

    // Knochen, um die die Bänder herumgeführt werden (etwas größer als die sichtbaren Flächen).
    // ellipsoid: Mittelpunkt c, Radien r · column: Säule entlang y mit Radien (x, z) unten/oben
    const OBSTACLES = {
      condMed: { frame: 'F', type: 'ellipsoid', c: [-1.55, 0, -0.25], r: [1.28, 1.58, 1.88] },
      condLat: { frame: 'F', type: 'ellipsoid', c: [1.55, 0, -0.25], r: [1.28, 1.58, 1.88] },
      troch: { frame: 'F', type: 'ellipsoid', c: [0, 0.95, 0.45], r: [1.92, 1.37, 1.18] },
      meta: { frame: 'F', type: 'column', y0: 0.3, y1: 2.2, bottom: [2.95, 1.75], top: [2.05, 1.22] },
      shaftLow: { frame: 'F', type: 'column', y0: 2.2, y1: 3.6, bottom: [2.05, 1.22], top: [1.42, 0.84] },
      shaftHigh: { frame: 'F', type: 'column', y0: 3.6, y1: 6.3, bottom: [1.42, 0.84], top: [1.24, 0.74] },
      // Tibiakopf: abgerundete Kappe über dem Plateaurand, darunter der Übergang zum Schaft
      tibiaCap: { frame: 'T', type: 'ellipsoid', c: [0, -0.3, -0.05], r: [3.35, 0.52, 2.27] },
      tibiaFlare: { frame: 'T', type: 'column', y0: -1.75, y1: -0.3, bottom: [2.42, 1.6], top: [3.35, 2.27] },
    };
    const femurInverse = new THREE.Matrix4();
    const probe = new THREE.Vector3();

    // Liegt ein Punkt im Knochen, wird er auf die Oberfläche geschoben
    const pushOut = (p, names) => {
      names.forEach((name) => {
        const o = OBSTACLES[name];
        probe.copy(p);
        if (o.frame === 'F') probe.applyMatrix4(femurInverse);
        let moved = false;
        if (o.type === 'ellipsoid') {
          const qx = (probe.x - o.c[0]) / o.r[0];
          const qy = (probe.y - o.c[1]) / o.r[1];
          const qz = (probe.z - o.c[2]) / o.r[2];
          const d = Math.hypot(qx, qy, qz);
          if (d < 1 && d > 1e-6) {
            probe.set(o.c[0] + (qx / d) * o.r[0], o.c[1] + (qy / d) * o.r[1], o.c[2] + (qz / d) * o.r[2]);
            moved = true;
          }
        } else if (probe.y >= o.y0 && probe.y <= o.y1) {
          const t = (probe.y - o.y0) / (o.y1 - o.y0);
          const rx = o.bottom[0] + (o.top[0] - o.bottom[0]) * t;
          const rz = o.bottom[1] + (o.top[1] - o.bottom[1]) * t;
          const d = Math.hypot(probe.x / rx, probe.z / rz);
          if (d < 1 && d > 1e-6) {
            probe.x /= d;
            probe.z /= d;
            moved = true;
          }
        }
        if (moved) {
          if (o.frame === 'F') probe.applyMatrix4(femur.matrix);
          p.copy(probe);
        }
      });
    };

    // Pfad gleichmäßig auf SAMPLES Punkte verteilen
    const resample = (pts, out) => {
      const lengths = [0];
      let total = 0;
      for (let i = 1; i < pts.length; i += 1) {
        total += pts[i].distanceTo(pts[i - 1]);
        lengths.push(total);
      }
      let seg = 1;
      for (let k = 0; k < SAMPLES; k += 1) {
        const target = (k / (SAMPLES - 1)) * total;
        while (seg < pts.length - 1 && lengths[seg] < target) seg += 1;
        const span = lengths[seg] - lengths[seg - 1] || 1;
        out[k].lerpVectors(pts[seg - 1], pts[seg], (target - lengths[seg - 1]) / span);
      }
    };

    // Wie ein Seil über eine Rolle: abwechselnd aus dem Knochen schieben und straffen
    const wrapFiber = (samples, names) => {
      for (let iter = 0; iter < 6; iter += 1) {
        for (let k = 1; k < SAMPLES - 1; k += 1) pushOut(samples[k], names);
        for (let k = 1; k < SAMPLES - 1; k += 1) {
          samples[k].multiplyScalar(0.5).addScaledVector(samples[k - 1], 0.25).addScaledVector(samples[k + 1], 0.25);
        }
      }
      for (let k = 1; k < SAMPLES - 1; k += 1) pushOut(samples[k], names);
    };

    const updateLigaments = (deg) => {
      patellaMatrix.multiplyMatrices(femur.matrix, patella.matrix);
      femurInverse.copy(femur.matrix).invert();
      LIGAMENTS.forEach((lig) => {
        lig.value = clamp01(lig.load(deg));
        loadColor(lig.value, lig.material.color);
        lig.material.emissive.copy(lig.material.color).multiplyScalar(0.18);
        lig.fibers.forEach((fiber) => {
          fiber.points.forEach((p) => toRoot(p.frame, p.local, p.world));
          resample(fiber.pathWorld, fiber.samples);
          if (lig.wrap) wrapFiber(fiber.samples, lig.wrap);
          writeTube(fiber.geometry, fiber.samples, lig.radius);
        });
      });
    };

    // ---------- Beschriftungen ----------
    const LABELS = {
      patella: { name: 'Patella', sub: 'Kniescheibe', frame: 'P', at: [0, 0.25, 0.5] },
      quad: { name: 'Quadrizepssehne', sub: 'Tendo musculi quadricipitis', ligament: 'quad' },
      pt: { name: 'Patellasehne', sub: 'Ligamentum patellae', ligament: 'pt' },
      mpfl: { name: 'Mediales patellofemorales Band', sub: 'MPFL', ligament: 'mpfl' },
      mcl: { name: 'Innenband', sub: 'Lig. collaterale mediale · MCL', ligament: 'mcl' },
      femur: { name: 'Femur', sub: 'Oberschenkelknochen', frame: 'F', at: [-1.35, 3.6, 0] },
      menMed: { name: 'Innenmeniskus', sub: 'Meniscus medialis', frame: 'T', at: [-2.74, 0.33, -0.6] },
      cart: { name: 'Gelenkknorpel', sub: 'Cartilago articularis', frame: 'F', at: [-1.6, -0.55, -1.95] },
      acl: { name: 'Vorderes Kreuzband', sub: 'Lig. cruciatum anterius · VKB', ligament: 'acl' },
      pcl: { name: 'Hinteres Kreuzband', sub: 'Lig. cruciatum posterius · HKB', ligament: 'pcl' },
      menLat: { name: 'Außenmeniskus', sub: 'Meniscus lateralis', frame: 'T', at: [2.62, 0.35, -0.46] },
      fibula: { name: 'Fibula', sub: 'Wadenbein', frame: 'T', at: [3.15, -3.8, -1.0] },
      lcl: { name: 'Außenband', sub: 'Lig. collaterale laterale · LCL', ligament: 'lcl' },
      tibia: { name: 'Tibia', sub: 'Schienbein', frame: 'T', at: [1.25, -3.9, 0.35] },
      lpfl: { name: 'Laterales patellofemorales Band', sub: 'LPFL', ligament: 'lpfl' },
    };

    // Ein Stopp je 45°: 0° vorn, 90° innen, 180° hinten, 270° außen
    const STOP_LABELS = [
      ['patella', 'quad'],
      ['pt', 'mpfl'],
      ['mcl', 'femur'],
      ['menMed', 'cart'],
      ['acl', 'pcl'],
      ['menLat', 'fibula'],
      ['lcl', 'tibia'],
      ['lpfl'],
    ];

    const SVG_NS = 'http://www.w3.org/2000/svg';
    Object.values(LABELS).forEach((def) => {
      const el = document.createElement('div');
      el.className = 'knee-label';
      const name = document.createElement('span');
      name.className = 'knee-label-name';
      name.textContent = def.name;
      const sub = document.createElement('span');
      sub.className = 'knee-label-sub';
      sub.textContent = def.sub;
      el.append(name, sub);
      if (def.ligament) {
        const load = document.createElement('span');
        load.className = 'knee-label-load';
        load.innerHTML = '<span>Belastung</span><span class="knee-label-bar"><i></i></span><b>0 %</b>';
        el.append(load);
        def.bar = load.querySelector('i');
        def.pct = load.querySelector('b');
      }
      labelLayer.append(el);
      def.el = el;
      def.line = document.createElementNS(SVG_NS, 'line');
      def.dot = document.createElementNS(SVG_NS, 'circle');
      def.dot.setAttribute('r', '3.5');
      leaders.append(def.line, def.dot);
      def.local = def.at ? new THREE.Vector3(...def.at) : null;
    });

    const anchor = new THREE.Vector3();
    const anchorFor = (def, out) => {
      if (def.ligament) {
        const lig = ligamentById[def.ligament];
        const fiber = lig.fibers[Math.floor(lig.fibers.length / 2)];
        return out.copy(fiber.samples[Math.floor(SAMPLES / 2)]);
      }
      return toRoot(def.frame, def.local, out);
    };

    const cssColor = (t) => {
      const c = loadColor(t, new THREE.Color());
      return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
    };

    // ---------- Ablauf ----------
    // 48 s: volle Drehung mit 8 Stopps (je 3 s Pause + 3 s Drehung) und zwei Kniebeugen bis 120°,
    // die tiefste Beugung fällt auf die Innen- und die Außenansicht.
    const CYCLE = 48;
    const STOPS = 8;
    const SEGMENT = CYCLE / STOPS;
    const PAUSE = 3;

    // ---------- Selbst drehen und Strukturen anklicken ----------
    // Sobald jemand zieht oder klickt, pausiert der Rundgang; die Kniebeuge läuft weiter.
    let manual = false;
    let manualYaw = 0;
    let resumedAt = -Infinity;
    let picked = null;
    const DEFAULT_PITCH = Math.atan(0.2);
    let pitch = DEFAULT_PITCH;
    let cameraDistance = 30;

    const shortestAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    const placeCamera = () => {
      camera.position.set(0, cameraDistance * Math.sin(pitch), cameraDistance * Math.cos(pitch));
      camera.lookAt(0, 0.6, 0);
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
    const screenPoint = new THREE.Vector3();

    // Liefert die Struktur unter dem Mauszeiger (Knochen mit Trefferpunkt, Bänder als Ganzes)
    const pickAt = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      ndc.set((mx / rect.width) * 2 - 1, -(my / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      LIGAMENTS.forEach((lig) => lig.fibers.forEach((fiber) => fiber.geometry.computeBoundingSphere()));

      let hit = null;
      const hits = raycaster.intersectObject(root, true);
      for (let i = 0; i < hits.length && !hit; i += 1) {
        let obj = hits[i].object;
        while (obj && !obj.userData.structure) obj = obj.parent;
        if (obj) hit = { id: obj.userData.structure, object: obj, point: hits[i].point, distance: hits[i].distance };
      }

      // Bänder sind dünn: Fasern bis 14 px neben dem Zeiger zählen mit, wenn sie vor dem getroffenen Knochen liegen
      let near = null;
      LIGAMENTS.forEach((lig) => lig.fibers.forEach((fiber) => {
        const pts = fiber.samples.map((p) => {
          screenPoint.copy(p).applyMatrix4(root.matrixWorld);
          const depth = screenPoint.distanceTo(camera.position);
          screenPoint.project(camera);
          return { x: ((screenPoint.x + 1) / 2) * rect.width, y: ((1 - screenPoint.y) / 2) * rect.height, depth };
        });
        for (let i = 0; i < pts.length - 1; i += 1) {
          const a = pts[i];
          const b = pts[i + 1];
          const lx = b.x - a.x;
          const ly = b.y - a.y;
          const t = clamp01(((mx - a.x) * lx + (my - a.y) * ly) / (lx * lx + ly * ly || 1));
          const d = Math.hypot(a.x + lx * t - mx, a.y + ly * t - my);
          if (d < 14 && (!near || d < near.d)) near = { d, id: lig.id, depth: a.depth + (b.depth - a.depth) * t };
        }
      }));

      if (near && (!hit || near.depth <= hit.distance + 0.6)) return { id: near.id };
      if (!hit) return null;
      if (ligamentById[hit.id]) return { id: hit.id };
      return { id: hit.id, object: hit.object, local: hit.object.worldToLocal(hit.point.clone()) };
    };

    const placeLabels = (stop, u) => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const top = 64;
      const bottom = 52;
      const gap = Math.max(22, Math.min(64, W * 0.09));
      const autoFade = smooth(0.15, 0.6, u) * (1 - smooth(PAUSE - 0.2, PAUSE + 0.6, u));
      const placed = [];

      Object.entries(LABELS).forEach(([id, def]) => {
        let fade = 0;
        if (manual) fade = picked && picked.id === id ? 1 : 0;
        else if (STOP_LABELS[stop].includes(id)) fade = autoFade;
        if (fade <= 0.01) {
          def.el.style.opacity = '0';
          def.line.style.opacity = '0';
          def.dot.style.opacity = '0';
          return;
        }
        if (manual && picked.object) {
          picked.object.localToWorld(anchor.copy(picked.local)).project(camera);
        } else {
          anchorFor(def, anchor).applyMatrix4(root.matrixWorld).project(camera);
        }
        const ax = ((anchor.x + 1) / 2) * W;
        const ay = ((1 - anchor.y) / 2) * H;
        const bw = def.el.offsetWidth;
        const bh = def.el.offsetHeight;
        const onLeft = ax < W / 2;
        let x = onLeft ? ax - gap - bw : ax + gap;
        x = Math.min(W - 10 - bw, Math.max(10, x));
        let y = Math.min(H - bottom - bh, Math.max(top, ay - bh / 2 - 16));
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

        if (def.ligament) {
          const value = ligamentById[def.ligament].value;
          def.bar.style.width = `${Math.round(value * 100)}%`;
          def.bar.style.background = cssColor(value);
          def.pct.textContent = `${Math.round(value * 100)} %`;
        }
      });
    };

    const renderAt = (time) => {
      const tc = ((time % CYCLE) + CYCLE) % CYCLE;
      const stop = Math.floor(tc / SEGMENT) % STOPS;
      const u = tc - stop * SEGMENT;
      const turn = u > PAUSE ? easeInOut((u - PAUSE) / (SEGMENT - PAUSE)) : 0;
      const autoYaw = (stop + turn) * 45 * DEG;
      if (manual) {
        root.rotation.y = manualYaw;
      } else {
        // Nach „Rundgang fortsetzen“ weich zur automatischen Drehung zurückkehren
        const blend = easeInOut(clamp01((performance.now() - resumedAt) / 900));
        root.rotation.y = manualYaw + shortestAngle(autoYaw - manualYaw) * blend;
      }

      const flexion = 60 * (1 - Math.cos((4 * Math.PI * tc) / CYCLE));
      setFlexion(flexion);
      updateLigaments(flexion);

      // Für die Kreuzbänder werden die Knochen kurz durchsichtig
      const xray = manual ? 0 : smooth(22.6, 24.2, tc) * (1 - smooth(27.2, 28.6, tc));
      const transparent = xray > 0.01;
      fadeMats.forEach((m) => {
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.depthWrite = !transparent;
          m.needsUpdate = true;
        }
        m.opacity = 1 - 0.62 * xray;
      });
      meshLines.opacity = 0.07 * (1 - 0.5 * xray);

      root.updateMatrixWorld(true);
      renderer.render(scene, camera);
      placeLabels(stop, u);
      flexValue.textContent = `${Math.round(flexion)}°`;
    };

    const resize = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const vfov = camera.fov * DEG;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      cameraDistance = (8.1 / Math.sin(Math.min(vfov, hfov) / 2)) * 1.02;
      placeCamera();
      camera.updateProjectionMatrix();
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let playing = !reduceMotion.matches;
    let visible = true;
    let time = playing ? 0 : 1.2;
    let last = performance.now();
    let frame = 0;

    const setPlaying = (value) => {
      playing = value;
      playLabel.textContent = playing ? 'Pause' : 'Abspielen';
      playIcon.setAttribute('d', playing ? 'M3 2h2v8H3zM7 2h2v8H7z' : 'M3 1.5v9l7.5-4.5z');
    };

    // Nur rechnen, solange die Animation zu sehen ist
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        if (playing) time += dt;
        renderAt(time);
        // Zeiger über einer Struktur? Dann Hand-Cursor (höchstens einmal pro Bild geprüft)
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

    // Ziehen dreht das Knie (Maus zusätzlich: hoch/runter kippt die Ansicht), Klicken zeigt den Namen
    let drag = null;
    let hover = null;

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
        pitch = Math.min(0.75, Math.max(-0.3, pitch + dy * 0.006));
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

  window.KneeAnimation = { mount };
})();
