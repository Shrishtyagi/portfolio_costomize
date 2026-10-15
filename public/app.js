/* ==========================================================================
   SAFE STORAGE HELPERS (Edge Tracking Prevention Safe)
   ========================================================================== */
function safeGetStorage(type, key, fallback = null) {
  try {
    const storage = type === 'session' ? window.sessionStorage : window.localStorage;
    return storage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSetStorage(type, key, value) {
  try {
    const storage = type === 'session' ? window.sessionStorage : window.localStorage;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch (e) {
    // Ignore storage block warnings
  }
}

let adminToken = safeGetStorage('session', 'adminToken', null);
let currentPalette = safeGetStorage('local', 'themePalette', 'cyan');
let currentAnimation = safeGetStorage('local', 'animationMode', 'octaSphere');
let userTheme = safeGetStorage('local', 'userTheme', 'dark');

let portfolioCards = [];
let contactLinks = [];
let receivedMessages = [];
let activeGalleryMediaList = [];

document.addEventListener('DOMContentLoaded', () => {
  applyUserTheme(userTheme);
  applyThemePalette(currentPalette);
  init3DCanvasEngine();
  initCustomCursor();
  initMobileNav();
  checkAdminState();
  loadProfile();
  loadContacts();
  loadCards();

  // User Light/Dark Mode Switcher
  const userThemeToggleBtn = document.getElementById('userThemeToggleBtn');
  if (userThemeToggleBtn) {
    userThemeToggleBtn.addEventListener('click', () => {
      userTheme = userTheme === 'dark' ? 'light' : 'dark';
      safeSetStorage('local', 'userTheme', userTheme);
      applyUserTheme(userTheme);
    });
  }

  // Floating Owner Button
  const ownerBtn = document.getElementById('ownerBtn');
  if (ownerBtn) {
    ownerBtn.addEventListener('click', () => {
      if (adminToken) {
        if (confirm("You are currently in Owner Mode. Would you like to log out?")) {
          adminToken = null;
          safeSetStorage('session', 'adminToken', null);
          checkAdminState();
        }
      } else {
        openAdminModal();
      }
    });
  }

  // Contact Form Submission
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('.submit-btn');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Sending...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;

      const payload = {
        name: document.getElementById('senderName').value,
        email: document.getElementById('senderEmail').value,
        message: document.getElementById('senderMessage').value
      };

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert("Thank you! Your message has been sent and recorded.");
          contactForm.reset();
          if (adminToken) loadMessages();
        } else {
          alert("Failed to send message: " + data.message);
        }
      } catch (err) {
        alert("Error sending message. Please check backend connection.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Tagline / Bio Edit Form Submission
  const taglineEditForm = document.getElementById('taglineEditForm');
  if (taglineEditForm) {
    taglineEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ensureAdminUnlocked()) return;

      const newTagline = document.getElementById('editTaglineInput').value.trim();

      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': adminToken
          },
          body: JSON.stringify({ tagline: newTagline })
        });

        if (res.ok) {
          document.getElementById('heroTagline').innerText = newTagline;
          closeTaglineModal();
          alert("Bio updated successfully!");
        } else {
          handleAuthFailure(res);
        }
      } catch (err) {
        console.error(err);
        alert("Server communication error.");
      }
    });
  }

  // Contact Link Add/Edit Form Submission
  const contactLinkForm = document.getElementById('contactLinkForm');
  if (contactLinkForm) {
    contactLinkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ensureAdminUnlocked()) return;

      const id = document.getElementById('editContactLinkId').value;
      const payload = {
        label: document.getElementById('editContactLabel').value.trim(),
        url: document.getElementById('editContactUrl').value.trim(),
        icon: document.getElementById('editContactIcon').value.trim() || 'fa-solid fa-link'
      };

      const url = id ? `/api/contacts/${id}` : '/api/contacts';
      const method = id ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': adminToken
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          closeContactLinkModal();
          await loadContacts();
          alert("Contact link saved successfully!");
        } else {
          handleAuthFailure(res);
        }
      } catch (err) {
        console.error(err);
        alert("Server communication error.");
      }
    });
  }

  // Card Add/Edit Form Submission
  const cardEditForm = document.getElementById('cardEditForm');
  if (cardEditForm) {
    cardEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ensureAdminUnlocked()) return;

      const id = document.getElementById('editCardId').value;
      const section = document.getElementById('editCardSection').value;
      const rawGallery = document.getElementById('editGallery').value;

      const parsedGallery = rawGallery
        ? rawGallery.split(/[\n,;]+/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        : [];

      const payload = {
        section: section,
        title: document.getElementById('editTitle').value.trim(),
        tags: document.getElementById('editTags').value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        icon: section === 'skills' ? document.getElementById('editIcon').value.trim() : '',
        subtitle: section === 'skills' ? '' : document.getElementById('editSubtitle').value.trim(),
        period: section === 'skills' ? '' : document.getElementById('editPeriod').value.trim(),
        description: section === 'skills' ? [] : document.getElementById('editDescription').value
          .split('|')
          .map(s => s.trim())
          .filter(Boolean),
        gallery: (section === 'skills' || section === 'education') ? [] : parsedGallery,
        links: {
          certificatePdf: (section === 'skills' || section === 'education' || section === 'projects') ? '' : document.getElementById('editCertPdf').value.trim(),
          lorPdf: (section === 'experience') ? document.getElementById('editLorPdf').value.trim() : ''
        }
      };

      const url = id ? `/api/cards/${id}` : '/api/cards';
      const method = id ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': adminToken
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          closeEditModal();
          await loadCards();
          alert("Card saved successfully!");
        } else {
          handleAuthFailure(res);
        }
      } catch (err) {
        console.error(err);
        alert("Server communication error.");
      }
    });
  }

  // Backdrop modal closer
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeAllModals();
    }
  });
});

/* ==========================================================================
   USER THEME (DARK / LIGHT) & ADMIN STUDIO (6 ANIMATIONS & 5 PALETTES)
   ========================================================================== */
function applyUserTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('userThemeToggleBtn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>';
  }
}

function applyThemePalette(palette) {
  currentPalette = palette || 'cyan';
  document.documentElement.setAttribute('data-palette', currentPalette);
  safeSetStorage('local', 'themePalette', currentPalette);

  document.querySelectorAll('.palette-card').forEach(card => {
    card.classList.remove('active-palette');
    const pill = card.querySelector('.select-pill');
    if (pill) pill.innerText = 'Select';
  });

  const el = document.getElementById(`palette-${currentPalette}`);
  if (el) {
    el.classList.add('active-palette');
    const pill = el.querySelector('.select-pill');
    if (pill) pill.innerText = 'Active ✓';
  }
}

function previewThemePalette(palette) {
  applyThemePalette(palette);
}

function applyAnimationModel(model) {
  currentAnimation = model || 'octaSphere';
  safeSetStorage('local', 'animationMode', currentAnimation);

  document.querySelectorAll('.anim-card').forEach(card => {
    card.classList.remove('active-anim');
    const pill = card.querySelector('.select-pill');
    if (pill) pill.innerText = 'Select';
  });

  const el = document.getElementById(`anim-${currentAnimation}`);
  if (el) {
    el.classList.add('active-anim');
    const pill = el.querySelector('.select-pill');
    if (pill) pill.innerText = 'Active ✓';
  }

  buildActive3DGeometry(currentAnimation);
}

function previewAnimation(model) {
  applyAnimationModel(model);
}

function openThemeStudioModal() {
  if (!ensureAdminUnlocked()) return;
  const modal = document.getElementById('themeStudioModal');
  if (modal) {
    applyThemePalette(currentPalette);
    applyAnimationModel(currentAnimation);
    modal.classList.add('show-modal');
    modal.style.display = 'flex';
  }
}

function closeThemeStudioModal() {
  const modal = document.getElementById('themeStudioModal');
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

async function saveStudioSettings() {
  if (!ensureAdminUnlocked()) return;

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': adminToken
      },
      body: JSON.stringify({ 
        themePalette: currentPalette,
        animationMode: currentAnimation
      })
    });

    if (res.ok) {
      alert(`Published! 3D Animation: "${currentAnimation}" | Color Palette: "${currentPalette.toUpperCase()}".`);
      closeThemeStudioModal();
    } else {
      handleAuthFailure(res);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to save settings to server.");
  }
}

const saveThemePalette = saveStudioSettings;

window.saveStudioSettings = saveStudioSettings;
window.saveThemePalette = saveThemePalette;
window.openThemeStudioModal = openThemeStudioModal;
window.closeThemeStudioModal = closeThemeStudioModal;
window.previewThemePalette = previewThemePalette;
window.previewAnimation = previewAnimation;

/* ==========================================================================
   ZERO-WEBGL 3D MATHEMATICAL PROJECTION ENGINE (100% CRASH-PROOF & FIXED)
   ========================================================================== */
let ctx2D = null;
let canvasWidth = 0;
let canvasHeight = 0;
let modelData = { groups: [], stars: [] };
let mouseParallaxX = 0, mouseParallaxY = 0;
let smoothMouseX = 0, smoothMouseY = 0;

const PALETTE_COLORS = {
  dark: {
    cyan:    { primary: '56, 189, 248',  secondary: '129, 140, 248' },
    violet:  { primary: '192, 132, 252', secondary: '244, 114, 182' },
    emerald: { primary: '52, 211, 153',  secondary: '56, 189, 248' },
    crimson: { primary: '251, 113, 133', secondary: '251, 146, 60' },
    amber:   { primary: '251, 191, 36',  secondary: '249, 115, 22' }
  },
  light: {
    cyan:    { primary: '2, 132, 199',   secondary: '67, 56, 202' },
    violet:  { primary: '109, 40, 217',  secondary: '190, 24, 93' },
    emerald: { primary: '4, 120, 87',    secondary: '14, 116, 144' },
    crimson: { primary: '190, 18, 60',   secondary: '194, 65, 12' },
    amber:   { primary: '180, 83, 9',    secondary: '159, 18, 57' }
  }
};

function init3DCanvasEngine() {
  const oldCanvas = document.getElementById('threeCanvas');
  if (!oldCanvas) return;

  const canvas = oldCanvas.cloneNode(false);
  // Enforce fixed background positioning so canvas never pushes navbar or content down
  canvas.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: -2 !important; pointer-events: none !important; display: block !important;';
  oldCanvas.parentNode.replaceChild(canvas, oldCanvas);

  ctx2D = canvas.getContext('2d');
  if (!ctx2D) return;

  function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }
  resizeCanvas();

  window.addEventListener('resize', resizeCanvas);

  window.addEventListener('mousemove', (e) => {
    mouseParallaxX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseParallaxY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouseParallaxX = (e.touches[0].clientX / window.innerWidth - 0.5) * 1.5;
      mouseParallaxY = (e.touches[0].clientY / window.innerHeight - 0.5) * 1.5;
    }
  }, { passive: true });

  modelData.stars = [];
  for (let i = 0; i < 160; i++) {
    modelData.stars.push({
      x: (Math.random() - 0.5) * 70,
      y: (Math.random() - 0.5) * 70,
      z: (Math.random() - 0.5) * 40,
      size: Math.random() * 1.6 + 0.6
    });
  }

  buildActive3DGeometry(currentAnimation);

  const startTime = performance.now();
  function renderLoop(now) {
    requestAnimationFrame(renderLoop);
    if (document.hidden || !ctx2D) return;

    const t = (now - startTime) * 0.001;
    draw3DScene(t);
  }
  requestAnimationFrame(renderLoop);
}

/* Mathematical 3D Geometry Builders for All 6 Animations */
function buildActive3DGeometry(mode) {
  modelData.groups = [];

  if (mode === 'octaSphere') {
    const outer = createGeodesicSphere(10.0, 2);
    const inner = createOctahedron(5.6);
    modelData.groups.push(
      { vertices: outer.vertices, edges: outer.edges, showNodes: true, isPrimary: true, role: 'outerSphere' },
      { vertices: inner.vertices, edges: inner.edges, showNodes: false, isPrimary: false, role: 'innerCore' }
    );
  } else if (mode === 'cyberTorus') {
    const t1 = createTorusMesh(9.5, 2.1, 14, 28);
    const t2 = createTorusMesh(6.5, 1.4, 10, 22);
    const knot = createTorusKnot(3.6, 0.7, 72);
    modelData.groups.push(
      { vertices: t1.vertices, edges: t1.edges, showNodes: true, isPrimary: true, role: 'torus1' },
      { vertices: t2.vertices, edges: t2.edges, showNodes: false, isPrimary: false, role: 'torus2' },
      { vertices: knot.vertices, edges: knot.edges, showNodes: false, isPrimary: true, role: 'knot' }
    );
  } else if (mode === 'quantumWave') {
    const wave = createWaveGrid(20, 20, 34);
    modelData.groups.push(
      { vertices: wave.vertices, edges: wave.edges, showNodes: true, isPrimary: true, role: 'wave' }
    );
  } else if (mode === 'hyperCube') {
    const tesseract = createTesseractMesh(8.2, 4.4);
    const core = createOctahedron(2.4);
    modelData.groups.push(
      { vertices: tesseract.vertices, edges: tesseract.outerEdges, showNodes: true, isPrimary: true, role: 'tesseractOuter' },
      { vertices: tesseract.vertices, edges: tesseract.innerEdges, showNodes: false, isPrimary: false, role: 'tesseractInner' },
      { vertices: core.vertices, edges: core.edges, showNodes: false, isPrimary: true, role: 'hyperCore' }
    );
  } else if (mode === 'dnaHelix') {
    const dna = createDNAHelix(28, 21, 4.5);
    modelData.groups.push(
      { vertices: dna.vertices, edges: dna.rungs, showNodes: true, isPrimary: true, role: 'dnaMain' },
      { vertices: dna.vertices, edges: dna.strands, showNodes: false, isPrimary: false, role: 'dnaBackbone' }
    );
  } else if (mode === 'orbitalRings') {
    const r1 = createRingMesh(10.4, 56);
    const r2 = createRingMesh(7.9, 48);
    const r3 = createRingMesh(5.5, 40);
    const gem = createOctahedron(2.5);
    modelData.groups.push(
      { vertices: r1.vertices, edges: r1.edges, showNodes: true, isPrimary: true, role: 'gyro1' },
      { vertices: r2.vertices, edges: r2.edges, showNodes: true, isPrimary: false, role: 'gyro2' },
      { vertices: r3.vertices, edges: r3.edges, showNodes: false, isPrimary: true, role: 'gyro3' },
      { vertices: gem.vertices, edges: gem.edges, showNodes: false, isPrimary: false, role: 'gyroGem' }
    );
  }
}

function createOctahedron(r) {
  const vertices = [
    [r, 0, 0], [-r, 0, 0],
    [0, r, 0], [0, -r, 0],
    [0, 0, r], [0, 0, -r]
  ];
  const edges = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [4, 3], [3, 5], [5, 2]
  ];
  return { vertices, edges };
}

function createGeodesicSphere(radius, subdivisions) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
    [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
    [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1]
  ].map(v => {
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  });

  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];

  const midCache = {};
  function getMidpoint(i1, i2) {
    const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    if (midCache[key] !== undefined) return midCache[key];
    const v1 = verts[i1], v2 = verts[i2];
    const mx = (v1[0] + v2[0]) / 2;
    const my = (v1[1] + v2[1]) / 2;
    const mz = (v1[2] + v2[2]) / 2;
    const len = Math.hypot(mx, my, mz);
    verts.push([mx / len, my / len, mz / len]);
    const idx = verts.length - 1;
    midCache[key] = idx;
    return idx;
  }

  for (let s = 0; s < subdivisions; s++) {
    const nextFaces = [];
    for (const [a, b, c] of faces) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      nextFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = nextFaces;
  }

  const vertices = verts.map(v => [v[0] * radius, v[1] * radius, v[2] * radius]);
  const edgeSet = new Set();
  const edges = [];
  for (const [a, b, c] of faces) {
    [[a, b], [b, c], [c, a]].forEach(([u, v]) => {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([u, v]);
      }
    });
  }
  return { vertices, edges };
}

function createTorusMesh(R, r, radialSegs, tubularSegs) {
  const vertices = [];
  const edges = [];
  for (let i = 0; i < radialSegs; i++) {
    const u = (i / radialSegs) * Math.PI * 2;
    for (let j = 0; j < tubularSegs; j++) {
      const v = (j / tubularSegs) * Math.PI * 2;
      const x = (R + r * Math.cos(u)) * Math.cos(v);
      const y = (R + r * Math.cos(u)) * Math.sin(v);
      const z = r * Math.sin(u);
      vertices.push([x, y, z]);

      const curr = i * tubularSegs + j;
      const nextJ = i * tubularSegs + ((j + 1) % tubularSegs);
      const nextI = ((i + 1) % radialSegs) * tubularSegs + j;
      edges.push([curr, nextJ], [curr, nextI]);
    }
  }
  return { vertices, edges };
}

function createTorusKnot(R, tube, segs) {
  const vertices = [];
  const edges = [];
  const p = 2, q = 3;
  for (let i = 0; i < segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    const r = R + tube * Math.cos(q * t);
    const x = r * Math.cos(p * t);
    const y = r * Math.sin(p * t);
    const z = tube * Math.sin(q * t) * 2.2;
    vertices.push([x, y, z]);
    edges.push([i, (i + 1) % segs]);
  }
  return { vertices, edges };
}

function createWaveGrid(rows, cols, span) {
  const vertices = [];
  const edges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1) - 0.5) * span;
      const y = (r / (rows - 1) - 0.5) * span;
      vertices.push([x, y, 0, x, y]);
      const idx = r * cols + c;
      if (c < cols - 1) edges.push([idx, idx + 1]);
      if (r < rows - 1) edges.push([idx, idx + cols]);
    }
  }
  return { vertices, edges };
}

function createTesseractMesh(s1, s2) {
  const vertices = [];
  for (const s of [s1, s2]) {
    for (let i = 0; i < 8; i++) {
      vertices.push([
        (i & 1 ? 1 : -1) * s,
        (i & 2 ? 1 : -1) * s,
        (i & 4 ? 1 : -1) * s
      ]);
    }
  }
  const boxEdges = [
    [0,1],[2,3],[4,5],[6,7],
    [0,2],[1,3],[4,6],[5,7],
    [0,4],[1,5],[2,6],[3,7]
  ];
  const outerEdges = boxEdges.map(([a, b]) => [a, b]);
  const innerEdges = boxEdges.map(([a, b]) => [a + 8, b + 8]);
  for (let i = 0; i < 8; i++) {
    innerEdges.push([i, i + 8]);
  }
  return { vertices, outerEdges, innerEdges };
}

function createDNAHelix(rungsCount, height, radius) {
  const vertices = [];
  const rungs = [];
  const strands = [];
  for (let i = 0; i < rungsCount; i++) {
    const t = i / (rungsCount - 1);
    const y = (t - 0.5) * height;
    const angle = t * Math.PI * 3.6;

    vertices.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
    vertices.push([Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius]);

    const idx1 = i * 2;
    const idx2 = i * 2 + 1;
    rungs.push([idx1, idx2]);
    if (i > 0) {
      strands.push([idx1 - 2, idx1], [idx2 - 2, idx2]);
    }
  }
  return { vertices, rungs, strands };
}

function createRingMesh(radius, segs) {
  const vertices = [];
  const edges = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    vertices.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
    edges.push([i, (i + 1) % segs]);
  }
  return { vertices, edges };
}

function rotate3D(x, y, z, rx, ry, rz) {
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
  let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
  let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
  return [x3, y3, z2];
}

function draw3DScene(t) {
  ctx2D.clearRect(0, 0, canvasWidth, canvasHeight);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const themeColors = (isLight ? PALETTE_COLORS.light : PALETTE_COLORS.dark)[currentPalette] || PALETTE_COLORS.dark.cyan;

  const isMobile = canvasWidth < 768;
  const fov = isMobile ? 28 : 24;
  const unitScale = Math.min(canvasWidth, canvasHeight) * (isMobile ? 0.043 : 0.048);
  const offsetX = (isMobile || currentAnimation === 'quantumWave') ? 0 : 4.8;
  const offsetY = currentAnimation === 'quantumWave' ? 2.5 : (isMobile ? -0.8 : -0.4);

  smoothMouseX += (mouseParallaxX * 2.2 - smoothMouseX) * 0.05;
  smoothMouseY += (mouseParallaxY * 2.2 - smoothMouseY) * 0.05;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // 1. Ambient 3D Starfield
  ctx2D.fillStyle = `rgba(${themeColors.primary}, ${isLight ? 0.25 : 0.32})`;
  for (const star of modelData.stars) {
    const [rx, ry, rz] = rotate3D(star.x, star.y, star.z, 0, t * 0.02, 0);
    const depth = fov + rz + 18;
    if (depth > 1) {
      const p = fov / depth;
      const sx = centerX + (rx - smoothMouseX * 1.2) * p * unitScale;
      const sy = centerY + (ry - smoothMouseY * 1.2) * p * unitScale;
      ctx2D.beginPath();
      ctx2D.arc(sx, sy, star.size * p, 0, Math.PI * 2);
      ctx2D.fill();
    }
  }

  // 2. Active 3D Wireframe & Vertex Groups
  for (const group of modelData.groups) {
    let rx = 0, ry = 0, rz = 0, scaleMult = 1;

    if (group.role === 'outerSphere') {
      rx = t * 0.08; ry = t * 0.14;
      scaleMult = 1 + Math.sin(t * 1.4) * 0.025;
    } else if (group.role === 'innerCore') {
      rx = -t * 0.12; ry = -t * 0.18; rz = t * 0.09;
    } else if (group.role === 'torus1') {
      rx = t * 0.14; ry = t * 0.16;
    } else if (group.role === 'torus2') {
      rx = -t * 0.12; rz = t * 0.18;
    } else if (group.role === 'knot') {
      ry = t * 0.22; rz = -t * 0.14;
    } else if (group.role === 'wave') {
      rx = 1.12; rz = t * 0.04;
      for (const v of group.vertices) {
        v[2] = Math.sin(v[3] * 0.28 + t * 1.6) * Math.cos(v[4] * 0.28 + t * 1.3) * 2.1;
      }
    } else if (group.role === 'tesseractOuter' || group.role === 'tesseractInner') {
      rx = t * 0.11; ry = t * 0.15; rz = t * 0.06;
    } else if (group.role === 'hyperCore') {
      rx = -t * 0.2; ry = t * 0.25;
    } else if (group.role === 'dnaMain' || group.role === 'dnaBackbone') {
      ry = t * 0.28; rz = 0.42;
    } else if (group.role === 'gyro1') {
      rx = t * 0.22; ry = t * 0.12;
    } else if (group.role === 'gyro2') {
      ry = -t * 0.24; rz = t * 0.16;
    } else if (group.role === 'gyro3') {
      rx = t * 0.15; rz = -t * 0.26;
    } else if (group.role === 'gyroGem') {
      rx = -t * 0.25; ry = t * 0.32;
    }

    const projected = new Array(group.vertices.length);
    for (let i = 0; i < group.vertices.length; i++) {
      const v = group.vertices[i];
      const [x, y, z] = rotate3D(v[0] * scaleMult, v[1] * scaleMult, v[2] * scaleMult, rx, ry, rz);
      const depth = fov + z + 14;
      const p = fov / Math.max(1, depth);
      const sx = centerX + (x + offsetX - smoothMouseX) * p * unitScale;
      const sy = centerY + (y + offsetY - smoothMouseY) * p * unitScale;
      projected[i] = [sx, sy, p];
    }

    const colorRGB = group.isPrimary ? themeColors.primary : themeColors.secondary;
    const lineAlpha = isLight ? (group.isPrimary ? 0.20 : 0.24) : (group.isPrimary ? 0.17 : 0.22);

    ctx2D.strokeStyle = `rgba(${colorRGB}, ${lineAlpha})`;
    ctx2D.lineWidth = isLight ? 1.15 : 1.0;
    ctx2D.beginPath();
    for (let i = 0; i < group.edges.length; i++) {
      const [u, v] = group.edges[i];
      const p1 = projected[u];
      const p2 = projected[v];
      if (p1 && p2) {
        ctx2D.moveTo(p1[0], p1[1]);
        ctx2D.lineTo(p2[0], p2[1]);
      }
    }
    ctx2D.stroke();

    if (group.showNodes) {
      const nodeAlpha = isLight ? 0.42 : 0.52;
      ctx2D.fillStyle = `rgba(${colorRGB}, ${nodeAlpha})`;
      for (let i = 0; i < projected.length; i++) {
        if (group.role === 'torus1' && i % 2 !== 0) continue;
        const pt = projected[i];
        const radius = Math.max(1.2, 2.4 * pt[2]);
        ctx2D.beginPath();
        ctx2D.arc(pt[0], pt[1], radius, 0, Math.PI * 2);
        ctx2D.fill();
      }
    }
  }
}

/* ==========================================================================
   CUSTOM SMOOTH MAGNETIC CURSOR
   ========================================================================== */
function initCustomCursor() {
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  if (window.matchMedia('(pointer: coarse)').matches) return;

  let cMouseX = 0, cMouseY = 0, ringX = 0, ringY = 0;

  window.addEventListener('mousemove', (e) => {
    cMouseX = e.clientX;
    cMouseY = e.clientY;
    dot.style.transform = `translate(${cMouseX}px, ${cMouseY}px)`;
  }, { passive: true });

  function renderCursor() {
    ringX += (cMouseX - ringX) * 0.16;
    ringY += (cMouseY - ringY) * 0.16;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    requestAnimationFrame(renderCursor);
  }
  renderCursor();

  const interactiveSelector = 'a, button, input, textarea, .card, .thumb-item, .chip-link, .palette-card, .anim-card';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactiveSelector)) {
      ring.classList.add('cursor-hover');
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(interactiveSelector)) {
      ring.classList.remove('cursor-hover');
    }
  });
}

/* ==========================================================================
   CARD 3D TILT & MOUSE SPOTLIGHT EFFECT
   ========================================================================== */
function attachCardInteractions() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5.5;
      const rotateY = ((x - centerX) / centerX) * 5.5;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });
}

/* ==========================================================================
   AUTHENTICATION & SECURITY HELPERS
   ========================================================================== */
function ensureAdminUnlocked() {
  if (!adminToken) {
    alert("Owner Mode is locked. Please unlock it first.");
    openAdminModal();
    return false;
  }
  return true;
}

function handleAuthFailure(response) {
  if (response.status === 403 || response.status === 401) {
    alert("Session expired or unauthorized. Please re-enter your Owner Password.");
    adminToken = null;
    safeSetStorage('session', 'adminToken', null);
    checkAdminState();
    openAdminModal();
  } else {
    alert("Operation failed with status: " + response.status);
  }
}

/* Mobile Drawer */
function initMobileNav() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navLinks.classList.toggle('nav-active');
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('nav-active');
      });
    });
  }
}

/* Load Bio, Theme & 3D Model from Backend */
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data) {
      if (data.tagline) {
        const el = document.getElementById('heroTagline');
        if (el) el.innerText = data.tagline;
      }
      if (data.themePalette) {
        applyThemePalette(data.themePalette);
      }
      if (data.animationMode) {
        applyAnimationModel(data.animationMode);
      }
    }
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

/* Load Contact Links */
async function loadContacts() {
  try {
    const res = await fetch('/api/contacts');
    contactLinks = await res.json();
    renderContacts();
  } catch (err) {
    console.error("Error loading contacts:", err);
  }
}

function renderContacts() {
  const container = document.getElementById('quickContactsBar');
  if (!container) return;

  container.innerHTML = '';

  contactLinks.forEach(link => {
    const chipWrapper = document.createElement('div');
    chipWrapper.className = 'chip-link-wrapper';
    chipWrapper.innerHTML = `
      <a href="${link.url}" target="_blank" rel="noreferrer" class="chip-link">
        <i class="${link.icon || 'fa-solid fa-link'}"></i>
        <span>${link.label}</span>
      </a>
      <div class="chip-admin-actions">
        <button type="button" class="chip-btn-icon" title="Edit Link" onclick="openEditContactLinkModal('${link._id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="chip-btn-icon delete-btn" title="Delete Link" onclick="deleteContactLink('${link._id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    container.appendChild(chipWrapper);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-contact-btn';
  addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add Link`;
  addBtn.onclick = openAddContactLinkModal;
  container.appendChild(addBtn);
}

function openAddContactLinkModal() {
  document.getElementById('contactLinkModalTitle').innerText = 'Add Contact Link';
  document.getElementById('editContactLinkId').value = '';
  document.getElementById('editContactLabel').value = '';
  document.getElementById('editContactUrl').value = '';
  document.getElementById('editContactIcon').value = 'fa-solid fa-link';
  const modal = document.getElementById('contactLinkModal');
  modal.classList.add('show-modal');
  modal.style.display = 'flex';
}

function openEditContactLinkModal(id) {
  const item = contactLinks.find(c => String(c._id) === String(id));
  if (!item) return;

  document.getElementById('contactLinkModalTitle').innerText = 'Edit Contact Link';
  document.getElementById('editContactLinkId').value = item._id;
  document.getElementById('editContactLabel').value = item.label || '';
  document.getElementById('editContactUrl').value = item.url || '';
  document.getElementById('editContactIcon').value = item.icon || 'fa-solid fa-link';
  const modal = document.getElementById('contactLinkModal');
  modal.classList.add('show-modal');
  modal.style.display = 'flex';
}

function closeContactLinkModal() {
  const modal = document.getElementById('contactLinkModal');
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

async function deleteContactLink(id) {
  if (!ensureAdminUnlocked()) return;
  if (!confirm("Are you sure you want to remove this contact link?")) return;
  try {
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': adminToken }
    });
    if (res.ok) {
      await loadContacts();
    } else {
      handleAuthFailure(res);
    }
  } catch (err) {
    console.error(err);
  }
}

/* Messages Inbox Controls */
async function loadMessages() {
  if (!adminToken) return;
  try {
    const res = await fetch('/api/messages', {
      headers: { 'Authorization': adminToken }
    });
    if (res.ok) {
      receivedMessages = await res.json();
      const countEl = document.getElementById('inboxCount');
      if (countEl) countEl.innerText = receivedMessages.length || 0;
    }
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

function openMessagesModal() {
  const modal = document.getElementById('messagesModal');
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  if (receivedMessages.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 24px;">No messages received yet.</p>`;
  } else {
    receivedMessages.forEach(msg => {
      const dateStr = new Date(msg.createdAt).toLocaleString();
      const item = document.createElement('div');
      item.className = 'message-card-item';
      item.innerHTML = `
        <div class="message-top-row">
          <div>
            <div class="message-sender-name">${msg.name}</div>
            <a href="mailto:${msg.email}" class="message-sender-email">${msg.email}</a>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="message-date">${dateStr}</span>
            <button type="button" class="chip-btn-icon delete-btn" title="Delete Message" onclick="deleteMessage('${msg._id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="message-content-text">${msg.message}</div>
      `;
      container.appendChild(item);
    });
  }

  modal.classList.add('show-modal');
  modal.style.display = 'flex';
}

function closeMessagesModal() {
  const modal = document.getElementById('messagesModal');
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

async function deleteMessage(id) {
  if (!ensureAdminUnlocked()) return;
  if (!confirm("Are you sure you want to delete this message?")) return;
  try {
    const res = await fetch(`/api/messages/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': adminToken }
    });
    if (res.ok) {
      await loadMessages();
      openMessagesModal();
    } else {
      handleAuthFailure(res);
    }
  } catch (err) {
    console.error(err);
  }
}

/* Load Cards */
async function loadCards() {
  try {
    const res = await fetch('/api/cards');
    portfolioCards = await res.json();
    renderCards();
  } catch (err) {
    console.error("Error loading portfolio items:", err);
  }
}

function extractDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/(?:\/file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

function getMediaType(url) {
  if (!url) return 'image';
  const clean = url.trim().toLowerCase();
  if (clean.includes('drive.google.com')) return 'drive';
  if (clean.includes('youtube.com') || clean.includes('youtu.be')) return 'youtube';
  if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg') || clean.endsWith('.mov') || clean.includes('.mp4?')) {
    return 'video';
  }
  return 'image';
}

function getYouTubeEmbedUrl(url) {
  let videoId = '';
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1].split('?')[0].split('/')[0];
  } else if (url.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    videoId = urlParams.get('v');
  } else if (url.includes('youtube.com/shorts/')) {
    videoId = url.split('shorts/')[1].split('?')[0].split('/')[0];
  } else if (url.includes('youtube.com/embed/')) {
    return url;
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
}

function extractCardGallery(card) {
  if (!card || !card.gallery) return [];
  if (Array.isArray(card.gallery)) {
    return card.gallery
      .flatMap(item => typeof item === 'string' ? item.split(/[\n,;]+/) : item)
      .map(s => typeof s === 'string' ? s.trim() : s)
      .filter(Boolean);
  }
  if (typeof card.gallery === 'string') {
    return card.gallery.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function renderCards() {
  const expGrid = document.getElementById('experienceGrid');
  const projGrid = document.getElementById('projectsGrid');
  const certGrid = document.getElementById('certificatesGrid');
  const eduGrid = document.getElementById('educationGrid');
  const skillsGrid = document.getElementById('skillsGrid');

  if (expGrid) expGrid.innerHTML = '';
  if (projGrid) projGrid.innerHTML = '';
  if (certGrid) certGrid.innerHTML = '';
  if (eduGrid) eduGrid.innerHTML = '';
  if (skillsGrid) skillsGrid.innerHTML = '';

  portfolioCards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';

    if (card.section === 'skills') {
      const iconHtml = card.icon ? `<i class="${card.icon}"></i>` : `<i class="fa-solid fa-code"></i>`;
      cardEl.innerHTML = `
        <div class="skill-head">
          ${iconHtml}
          <h3 class="card-title" style="margin: 0; font-size: 1.25rem;">${card.title}</h3>
        </div>
        <div class="card-tags" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 0;">
          ${(card.tags || []).map(t => `<span style="padding: 6px 12px; font-size: 0.82rem;">${t}</span>`).join('')}
        </div>
        <div class="admin-card-controls" style="margin-top: 18px;">
          <button type="button" class="btn btn-edit" onclick="openEditCardModal('${card._id}')">Edit</button>
          <button type="button" class="btn btn-delete" onclick="deleteCard('${card._id}')">Delete</button>
        </div>
      `;
      if (skillsGrid) skillsGrid.appendChild(cardEl);
      return;
    }

    const cardGallery = extractCardGallery(card);
    let actionsHtml = '';

    if (cardGallery.length > 0) {
      actionsHtml += `
        <button type="button" class="doc-btn gallery-btn" onclick="openGalleryModal('${card._id}')">
          <i class="fa-solid fa-photo-film"></i> Gallery (${cardGallery.length})
        </button>`;
    }

    if (card.section === 'experience') {
      if (card.links?.certificatePdf) {
        actionsHtml += `
          <button type="button" class="doc-btn" onclick="openPdfModal('${card.links.certificatePdf}', '${card.title} Certificate')">
            <i class="fa-solid fa-file-lines"></i> Certificate
          </button>`;
      }
      if (card.links?.lorPdf) {
        actionsHtml += `
          <button type="button" class="doc-btn" onclick="openPdfModal('${card.links.lorPdf}', '${card.title} LOR / Offer Letter')">
            <i class="fa-solid fa-file-contract"></i> LOR
          </button>`;
      }
    } else if (card.section === 'certificates') {
      if (card.links?.certificatePdf) {
        actionsHtml += `
          <button type="button" class="doc-btn" onclick="openPdfModal('${card.links.certificatePdf}', '${card.title} Certificate')">
            <i class="fa-solid fa-file-lines"></i> Certificate
          </button>`;
      }
    }

    if (card.links?.github) {
      actionsHtml += `
        <a class="doc-btn" href="${card.links.github}" target="_blank" rel="noreferrer">
          <i class="fa-brands fa-github"></i> Code
        </a>`;
    }

    cardEl.innerHTML = `
      <div class="card-period">${card.period || ''}</div>
      <h3 class="card-title">${card.title}</h3>
      <div class="card-subtitle">${card.subtitle || ''}</div>
      ${(card.description && card.description.length > 0) ? `
        <ul class="card-bullets">
          ${card.description.map(bullet => `<li>${bullet}</li>`).join('')}
        </ul>` : ''}
      <div class="card-tags">
        ${(card.tags || []).map(t => `<span>${t}</span>`).join('')}
      </div>
      ${actionsHtml ? `<div class="card-actions">${actionsHtml}</div>` : ''}
      <div class="admin-card-controls">
        <button type="button" class="btn btn-edit" onclick="openEditCardModal('${card._id}')">Edit</button>
        <button type="button" class="btn btn-delete" onclick="deleteCard('${card._id}')">Delete</button>
      </div>
    `;

    if (card.section === 'experience' && expGrid) expGrid.appendChild(cardEl);
    if (card.section === 'projects' && projGrid) projGrid.appendChild(cardEl);
    if (card.section === 'certificates' && certGrid) certGrid.appendChild(cardEl);
    if (card.section === 'education' && eduGrid) eduGrid.appendChild(cardEl);
  });

  attachCardInteractions();
}

function openTaglineModal() {
  const currentText = document.getElementById('heroTagline').innerText;
  document.getElementById('editTaglineInput').value = currentText;
  const modal = document.getElementById('taglineEditModal');
  modal.classList.add('show-modal');
  modal.style.display = 'flex';
}

function closeTaglineModal() {
  const modal = document.getElementById('taglineEditModal');
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

function openGalleryModal(cardId) {
  const card = portfolioCards.find(c => String(c._id) === String(cardId));
  if (!card) return;

  const mediaList = extractCardGallery(card);
  if (mediaList.length === 0) {
    alert("No media links found for this card.");
    return;
  }

  const modal = document.getElementById('galleryModal');
  const titleEl = document.getElementById('galleryModalTitle');
  const thumbsContainer = document.getElementById('galleryThumbnails');

  modal.classList.add('show-modal');
  modal.style.display = 'flex';
  if (titleEl) titleEl.innerText = `${card.title} — Media Showcase`;

  activeGalleryMediaList = mediaList;
  if (thumbsContainer) {
    thumbsContainer.innerHTML = '';
    activeGalleryMediaList.forEach((url, idx) => {
      const type = getMediaType(url);
      const thumb = document.createElement('div');
      thumb.className = `thumb-item ${idx === 0 ? 'active-thumb' : ''}`;
      thumb.setAttribute('data-index', idx);

      if (type === 'drive') {
        const fileId = extractDriveFileId(url);
        thumb.innerHTML = `
          <span class="thumb-video-badge"><i class="fa-brands fa-google-drive"></i> Drive</span>
          <img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w300" alt="Drive Media ${idx + 1}" onerror="this.onerror=null; this.src='https://placehold.co/100x70?text=Drive+File';">`;
      } else if (type === 'video') {
        thumb.innerHTML = `
          <span class="thumb-video-badge"><i class="fa-solid fa-play"></i> Clip</span>
          <video src="${url}#t=0.5" muted preload="metadata"></video>`;
      } else if (type === 'youtube') {
        thumb.innerHTML = `
          <span class="thumb-video-badge"><i class="fa-brands fa-youtube"></i> Video</span>
          <div class="thumb-icon-fallback"><i class="fa-solid fa-play"></i></div>`;
      } else {
        thumb.innerHTML = `<img src="${url}" alt="Media ${idx + 1}" onerror="this.onerror=null; this.src='https://placehold.co/100x70?text=Preview';">`;
      }

      thumb.onclick = () => selectGalleryMedia(idx);
      thumbsContainer.appendChild(thumb);
    });
  }

  selectGalleryMedia(0);
}

function selectGalleryMedia(index) {
  const viewer = document.getElementById('galleryViewerScreen');
  if (!viewer) return;
  const url = activeGalleryMediaList[index];
  if (!url) return;

  document.querySelectorAll('.thumb-item').forEach((item, idx) => {
    item.classList.toggle('active-thumb', idx === index);
  });

  viewer.innerHTML = '';
  const mediaType = getMediaType(url);

  if (mediaType === 'drive') {
    const fileId = extractDriveFileId(url);
    if (fileId) {
      viewer.innerHTML = `<iframe src="https://drive.google.com/file/d/${fileId}/preview" style="width: 100%; height: 100%; border: none;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else {
      viewer.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    }
  } else if (mediaType === 'youtube') {
    const embedUrl = getYouTubeEmbedUrl(url);
    viewer.innerHTML = `<iframe src="${embedUrl}" style="width: 100%; height: 100%; border: none;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  } else if (mediaType === 'video') {
    viewer.innerHTML = `<video src="${url}" controls autoplay playsinline style="max-width: 100%; max-height: 100%;"></video>`;
  } else {
    viewer.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
  }
}

function closeGalleryModal() {
  const modal = document.getElementById('galleryModal');
  const viewer = document.getElementById('galleryViewerScreen');
  if (viewer) {
    const videoEl = viewer.querySelector('video');
    if (videoEl) { videoEl.pause(); videoEl.src = ''; }
    const iframeEl = viewer.querySelector('iframe');
    if (iframeEl) iframeEl.src = '';
    viewer.innerHTML = '';
  }
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

function closeAllModals() {
  closePdfModal();
  closeGalleryModal();
  closeTaglineModal();
  closeContactLinkModal();
  closeMessagesModal();
  closeThemeStudioModal();
  closeAdminModal();
  closeEditModal();
}

function openAdminModal() {
  const authModal = document.getElementById('adminAuthModal');
  if (authModal) {
    authModal.classList.add('show-modal');
    authModal.style.display = 'flex';
  }
}

async function authenticateAdmin() {
  const pass = document.getElementById('adminPasswordInput').value.trim();
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      safeSetStorage('session', 'adminToken', adminToken);
      checkAdminState();
      closeAdminModal();
      loadMessages();
      alert("Owner mode unlocked! You can now customize 3D animations, palettes, and portfolio cards.");
    } else {
      alert("Incorrect password: " + (data.message || ""));
    }
  } catch (err) {
    alert("Authentication server unreachable.");
  }
}

function checkAdminState() {
  const ownerBtn = document.getElementById('ownerBtn');
  if (!ownerBtn) return;

  if (adminToken) {
    document.body.classList.add('admin-mode-active');
    ownerBtn.style.borderColor = 'var(--accent-emerald)';
    ownerBtn.style.color = 'var(--accent-emerald)';
    const textSpan = ownerBtn.querySelector('.btn-text');
    if (textSpan) textSpan.innerText = "Owner (Unlocked)";
    loadMessages();
  } else {
    document.body.classList.remove('admin-mode-active');
    ownerBtn.style.borderColor = 'var(--accent-primary)';
    ownerBtn.style.color = 'var(--accent-primary)';
    const textSpan = ownerBtn.querySelector('.btn-text');
    if (textSpan) textSpan.innerText = "Owner Mode";
  }
}

function openPdfModal(pdfUrl, title) {
  const modal = document.getElementById('pdfModal');
  const titleEl = document.getElementById('pdfModalTitle');
  const frame = document.getElementById('pdfFrame');
  const downloadLink = document.getElementById('pdfDownloadLink');

  if (modal && frame) {
    titleEl.innerText = title;

    const driveId = extractDriveFileId(pdfUrl);
    if (driveId) {
      frame.src = `https://drive.google.com/file/d/${driveId}/preview`;
      downloadLink.href = `https://drive.google.com/uc?export=download&id=${driveId}`;
    } else {
      frame.src = pdfUrl;
      downloadLink.href = pdfUrl;
    }

    modal.classList.add('show-modal');
    modal.style.display = 'flex';
  }
}

function closePdfModal() {
  const modal = document.getElementById('pdfModal');
  const frame = document.getElementById('pdfFrame');
  if (frame) frame.src = '';
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

function closeAdminModal() {
  const modal = document.getElementById('adminAuthModal');
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

function closeEditModal() {
  const modal = document.getElementById('cardEditModal');
  if (modal) {
    modal.classList.remove('show-modal');
    modal.style.display = 'none';
  }
}

function adjustModalFieldsForSection(section) {
  const groupTitle = document.getElementById('groupTitle');
  const groupIcon = document.getElementById('groupIcon');
  const groupTags = document.getElementById('groupTags');
  const groupSubtitle = document.getElementById('groupSubtitle');
  const groupPeriod = document.getElementById('groupPeriod');
  const groupDescription = document.getElementById('groupDescription');
  const galleryGroup = document.getElementById('galleryFieldGroup');
  const certGroup = document.getElementById('certFieldGroup');
  const lorGroup = document.getElementById('lorFieldGroup');

  if (section === 'skills') {
    if (groupTitle) groupTitle.style.display = 'flex';
    if (groupIcon) groupIcon.style.display = 'flex';
    if (groupTags) groupTags.style.display = 'flex';

    if (groupSubtitle) groupSubtitle.style.display = 'none';
    if (groupPeriod) groupPeriod.style.display = 'none';
    if (groupDescription) groupDescription.style.display = 'none';
    if (galleryGroup) galleryGroup.style.display = 'none';
    if (certGroup) certGroup.style.display = 'none';
    if (lorGroup) lorGroup.style.display = 'none';
  } else if (section === 'projects') {
    if (groupTitle) groupTitle.style.display = 'flex';
    if (groupTags) groupTags.style.display = 'flex';
    if (groupSubtitle) groupSubtitle.style.display = 'flex';
    if (groupPeriod) groupPeriod.style.display = 'flex';
    if (groupDescription) groupDescription.style.display = 'flex';
    if (galleryGroup) galleryGroup.style.display = 'flex';

    if (groupIcon) groupIcon.style.display = 'none';
    if (certGroup) certGroup.style.display = 'none';
    if (lorGroup) lorGroup.style.display = 'none';
  } else if (section === 'certificates') {
    if (groupTitle) groupTitle.style.display = 'flex';
    if (groupTags) groupTags.style.display = 'flex';
    if (groupSubtitle) groupSubtitle.style.display = 'flex';
    if (groupPeriod) groupPeriod.style.display = 'flex';
    if (groupDescription) groupDescription.style.display = 'flex';
    if (galleryGroup) galleryGroup.style.display = 'flex';
    if (certGroup) certGroup.style.display = 'flex';

    if (groupIcon) groupIcon.style.display = 'none';
    if (lorGroup) lorGroup.style.display = 'none';
  } else if (section === 'education') {
    if (groupTitle) groupTitle.style.display = 'flex';
    if (groupTags) groupTags.style.display = 'flex';
    if (groupSubtitle) groupSubtitle.style.display = 'flex';
    if (groupPeriod) groupPeriod.style.display = 'flex';
    if (groupDescription) groupDescription.style.display = 'flex';

    if (groupIcon) groupIcon.style.display = 'none';
    if (galleryGroup) galleryGroup.style.display = 'none';
    if (certGroup) certGroup.style.display = 'none';
    if (lorGroup) lorGroup.style.display = 'none';
  } else {
    if (groupTitle) groupTitle.style.display = 'flex';
    if (groupTags) groupTags.style.display = 'flex';
    if (groupSubtitle) groupSubtitle.style.display = 'flex';
    if (groupPeriod) groupPeriod.style.display = 'flex';
    if (groupDescription) groupDescription.style.display = 'flex';
    if (galleryGroup) galleryGroup.style.display = 'none';
    if (certGroup) certGroup.style.display = 'flex';
    if (lorGroup) lorGroup.style.display = 'flex';
    if (groupIcon) groupIcon.style.display = 'none';
  }
}

function openAddCardModal(section) {
  if (!ensureAdminUnlocked()) return;
  document.getElementById('cardModalTitle').innerText = section === 'skills' ? 'Add Skill Category' : `Add New ${section}`;
  document.getElementById('editCardId').value = '';
  document.getElementById('editCardSection').value = section;
  document.getElementById('cardEditForm').reset();
  if (section === 'skills') {
    document.getElementById('editIcon').value = 'fa-solid fa-code';
  }
  adjustModalFieldsForSection(section);
  const modal = document.getElementById('cardEditModal');
  modal.classList.add('show-modal');
  modal.style.display = 'flex';
}

function openEditCardModal(id) {
  if (!ensureAdminUnlocked()) return;
  const card = portfolioCards.find(c => String(c._id) === String(id));
  if (!card) return;

  const cardGallery = extractCardGallery(card);

  document.getElementById('cardModalTitle').innerText = card.section === 'skills' ? 'Edit Skill Category' : 'Edit Card';
  document.getElementById('editCardId').value = card._id;
  document.getElementById('editCardSection').value = card.section;
  document.getElementById('editTitle').value = card.title || '';
  document.getElementById('editIcon').value = card.icon || '';
  document.getElementById('editSubtitle').value = card.subtitle || '';
  document.getElementById('editPeriod').value = card.period || '';
  document.getElementById('editDescription').value = (card.description || []).join(' | ');
  document.getElementById('editTags').value = (card.tags || []).join(', ');
  document.getElementById('editGallery').value = cardGallery.join(',\n');
  document.getElementById('editCertPdf').value = card.links?.certificatePdf || '';
  document.getElementById('editLorPdf').value = card.links?.lorPdf || '';

  adjustModalFieldsForSection(card.section);
  const modal = document.getElementById('cardEditModal');
  modal.classList.add('show-modal');
  modal.style.display = 'flex';
}

async function deleteCard(id) {
  if (!ensureAdminUnlocked()) return;
  if (!confirm("Are you sure you want to remove this card?")) return;
  try {
    const res = await fetch(`/api/cards/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': adminToken }
    });
    if (res.ok) {
      loadCards();
    } else {
      handleAuthFailure(res);
    }
  } catch (err) {
    console.error(err);
  }
}

window.openAddCardModal = openAddCardModal;
window.openEditCardModal = openEditCardModal;
window.deleteCard = deleteCard;
window.authenticateAdmin = authenticateAdmin;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.openTaglineModal = openTaglineModal;
window.closeTaglineModal = closeTaglineModal;
window.openAddContactLinkModal = openAddContactLinkModal;
window.openEditContactLinkModal = openEditContactLinkModal;
window.closeContactLinkModal = closeContactLinkModal;
window.deleteContactLink = deleteContactLink;
window.openMessagesModal = openMessagesModal;
window.closeMessagesModal = closeMessagesModal;
window.deleteMessage = deleteMessage;
window.openPdfModal = openPdfModal;
window.closePdfModal = closePdfModal;
window.openGalleryModal = openGalleryModal;
window.closeGalleryModal = closeGalleryModal;
window.selectGalleryMedia = selectGalleryMedia;
window.applyUserTheme = applyUserTheme;