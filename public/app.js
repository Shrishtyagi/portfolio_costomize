let adminToken = sessionStorage.getItem('adminToken') || null;
let currentPalette = 'cyan';
let currentAnimation = 'octaSphere'; // 'octaSphere', 'cyberTorus', 'quantumWave', 'hyperCube', 'dnaHelix', 'orbitalRings'
let userTheme = localStorage.getItem('userTheme') || 'dark';

let portfolioCards = [];
let contactLinks = [];
let receivedMessages = [];
let activeGalleryMediaList = [];

// Three.js Core Variables
let threeScene, threeCamera, threeRenderer;
let activeAnimContainer = null;
let starfieldMesh = null;
let threeMaterials = {};
let waveGeometry = null;

document.addEventListener('DOMContentLoaded', () => {
  applyUserTheme(userTheme);
  initThreeBackground();
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
      localStorage.setItem('userTheme', userTheme);
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
          sessionStorage.removeItem('adminToken');
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
  updateThreeColors();
}

function applyThemePalette(palette) {
  currentPalette = palette || 'cyan';
  document.documentElement.setAttribute('data-palette', currentPalette);

  document.querySelectorAll('.palette-card').forEach(card => {
    card.classList.remove('active-palette');
  });
  const el = document.getElementById(`palette-${currentPalette}`);
  if (el) el.classList.add('active-palette');

  updateThreeColors();
}

function previewThemePalette(palette) {
  applyThemePalette(palette);
}

function applyAnimationModel(model) {
  currentAnimation = model || 'octaSphere';

  document.querySelectorAll('.anim-card').forEach(card => {
    card.classList.remove('active-anim');
  });
  const el = document.getElementById(`anim-${currentAnimation}`);
  if (el) el.classList.add('active-anim');

  build3DAnimation(currentAnimation);
}

function previewAnimation(model) {
  applyAnimationModel(model);
}

function openThemeStudioModal() {
  if (!ensureAdminUnlocked()) return;
  const modal = document.getElementById('themeStudioModal');
  if (modal) {
    document.querySelectorAll('.palette-card').forEach(c => c.classList.remove('active-palette'));
    const pCard = document.getElementById(`palette-${currentPalette}`);
    if (pCard) pCard.classList.add('active-palette');

    document.querySelectorAll('.anim-card').forEach(c => c.classList.remove('active-anim'));
    const aCard = document.getElementById(`anim-${currentAnimation}`);
    if (aCard) aCard.classList.add('active-anim');

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
   MULTI-DEVICE RESPONSIVE 3D ENGINE (6 UNIQUE MODELS + SOFT CONTRAST)
   ========================================================================== */
function getDeviceLayoutMetrics() {
  const w = window.innerWidth;
  if (w < 480) {
    return { camZ: 35, scale: 0.68, offsetX: 0, offsetY: 1.4, isMobile: true };
  } else if (w < 768) {
    return { camZ: 31, scale: 0.78, offsetX: 0, offsetY: 1.0, isMobile: true };
  } else if (w < 1080) {
    return { camZ: 27, scale: 0.88, offsetX: 3.2, offsetY: 0.8, isMobile: false };
  } else {
    return { camZ: 24, scale: 1.0, offsetX: 5.8, offsetY: 0.6, isMobile: false };
  }
}

function updateResponsive3DLayout() {
  if (!threeCamera || !threeRenderer) return;
  const metrics = getDeviceLayoutMetrics();

  threeCamera.aspect = window.innerWidth / window.innerHeight;
  threeCamera.position.z = metrics.camZ;
  threeCamera.updateProjectionMatrix();

  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (activeAnimContainer) {
    activeAnimContainer.scale.set(metrics.scale, metrics.scale, metrics.scale);
    if (currentAnimation === 'quantumWave') {
      activeAnimContainer.position.x = 0;
      activeAnimContainer.position.y = metrics.isMobile ? -3.5 : -1.5;
    } else {
      activeAnimContainer.position.x = metrics.offsetX;
      activeAnimContainer.position.y = metrics.offsetY;
    }
  }
}

function initThreeBackground() {
  const canvas = document.getElementById('threeCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const metrics = getDeviceLayoutMetrics();
  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
  threeCamera.position.z = metrics.camZ;

  threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Subtle Ambient Cosmic Dust Particles
  const particleCount = metrics.isMobile ? 320 : 600;
  const pPositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    pPositions[i3] = (Math.random() - 0.5) * 90;
    pPositions[i3 + 1] = (Math.random() - 0.5) * 90;
    pPositions[i3 + 2] = (Math.random() - 0.5) * 65;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.13,
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending
  });
  starfieldMesh = new THREE.Points(particleGeo, particleMat);
  threeScene.add(starfieldMesh);

  threeMaterials.particleMat = particleMat;

  build3DAnimation(currentAnimation);

  // Smooth Mouse & Touch Parallax
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 1.4;
      mouseY = (e.touches[0].clientY / window.innerHeight - 0.5) * 1.4;
    }
  }, { passive: true });

  window.addEventListener('resize', updateResponsive3DLayout);

  // 60FPS Fluid Animation Loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    const m = getDeviceLayoutMetrics();

    if (activeAnimContainer) {
      // 1. Octa-Geodesic Shield
      if (currentAnimation === 'octaSphere') {
        activeAnimContainer.rotation.y = elapsedTime * 0.065;
        activeAnimContainer.rotation.x = elapsedTime * 0.03;

        if (activeAnimContainer.userData.innerOcta) {
          activeAnimContainer.userData.innerOcta.rotation.y = -elapsedTime * 0.1;
          activeAnimContainer.userData.innerOcta.rotation.z = elapsedTime * 0.06;
        }
        const pulse = m.scale * (1 + Math.sin(elapsedTime * 1.4) * 0.025);
        activeAnimContainer.scale.set(pulse, pulse, pulse);
      } 
      // 2. Cyber Torus Vortex
      else if (currentAnimation === 'cyberTorus') {
        const { torus1, torus2, knot } = activeAnimContainer.userData;
        if (torus1) {
          torus1.rotation.x = elapsedTime * 0.07;
          torus1.rotation.y = elapsedTime * 0.08;
        }
        if (torus2) {
          torus2.rotation.x = -elapsedTime * 0.06;
          torus2.rotation.z = elapsedTime * 0.09;
        }
        if (knot) {
          knot.rotation.y = elapsedTime * 0.11;
          knot.rotation.z = -elapsedTime * 0.07;
        }
      } 
      // 3. Quantum Wave Lattice
      else if (currentAnimation === 'quantumWave') {
        if (waveGeometry) {
          const pos = waveGeometry.attributes.position;
          const count = pos.count;
          for (let i = 0; i < count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = Math.sin(x * 0.24 + elapsedTime * 1.5) * Math.cos(y * 0.24 + elapsedTime * 1.2) * 2.3;
            pos.setZ(i, z);
          }
          pos.needsUpdate = true;
        }
        activeAnimContainer.rotation.z = elapsedTime * 0.015;
      } 
      // 4. 4D Tesseract Cube
      else if (currentAnimation === 'hyperCube') {
        const { outerCube, innerCube, core } = activeAnimContainer.userData;
        if (outerCube) {
          outerCube.rotation.x = elapsedTime * 0.055;
          outerCube.rotation.y = elapsedTime * 0.075;
        }
        if (innerCube) {
          innerCube.rotation.x = -elapsedTime * 0.09;
          innerCube.rotation.y = -elapsedTime * 0.08;
        }
        if (core) {
          core.rotation.y = elapsedTime * 0.14;
        }
      }
      // 5. Neural DNA Helix (NEW)
      else if (currentAnimation === 'dnaHelix') {
        const { helixGroup } = activeAnimContainer.userData;
        if (helixGroup) {
          helixGroup.rotation.y = elapsedTime * 0.18;
        }
        activeAnimContainer.position.y = m.offsetY + Math.sin(elapsedTime * 1.2) * 0.45;
      }
      // 6. Celestial Gyro Rings (NEW)
      else if (currentAnimation === 'orbitalRings') {
        const { ring1, ring2, ring3, coreGem } = activeAnimContainer.userData;
        if (ring1) {
          ring1.rotation.x = elapsedTime * 0.12;
          ring1.rotation.y = elapsedTime * 0.06;
        }
        if (ring2) {
          ring2.rotation.y = -elapsedTime * 0.14;
          ring2.rotation.z = elapsedTime * 0.08;
        }
        if (ring3) {
          ring3.rotation.x = elapsedTime * 0.07;
          ring3.rotation.z = -elapsedTime * 0.15;
        }
        if (coreGem) {
          coreGem.rotation.y = elapsedTime * 0.22;
          coreGem.rotation.x = -elapsedTime * 0.12;
        }
      }
    }

    if (starfieldMesh) {
      starfieldMesh.rotation.y = elapsedTime * 0.008;
    }

    // Smooth Parallax Interpolation
    targetX += (mouseX * 2.5 - targetX) * 0.045;
    targetY += (-mouseY * 2.5 - targetY) * 0.045;
    threeCamera.position.x = targetX;
    threeCamera.position.y = targetY;
    threeCamera.lookAt(threeScene.position);

    threeRenderer.render(threeScene, threeCamera);
  }
  animate();
}

/* Build All 6 Distinct 3D Animation Models */
function build3DAnimation(mode) {
  if (!threeScene) return;

  if (activeAnimContainer) {
    threeScene.remove(activeAnimContainer);
    activeAnimContainer.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
    });
    activeAnimContainer = null;
  }
  waveGeometry = null;

  activeAnimContainer = new THREE.Group();

  const mainWireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16 });
  const secondaryWireMat = new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.20 });
  const vertexMat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.34,
    transparent: true,
    opacity: 0.50,
    blending: THREE.AdditiveBlending
  });

  threeMaterials.mainWire = mainWireMat;
  threeMaterials.secondaryWire = secondaryWireMat;
  threeMaterials.vertex = vertexMat;

  // 1. OCTA-GEODESIC SHIELD
  if (mode === 'octaSphere') {
    const sphereGeo = new THREE.IcosahedronGeometry(10.0, 2);
    const wireframeSphere = new THREE.LineSegments(new THREE.WireframeGeometry(sphereGeo), mainWireMat);
    activeAnimContainer.add(wireframeSphere);

    const vertexPoints = new THREE.Points(sphereGeo, vertexMat);
    activeAnimContainer.add(vertexPoints);

    const innerGeo = new THREE.OctahedronGeometry(5.8, 1);
    const innerOcta = new THREE.LineSegments(new THREE.WireframeGeometry(innerGeo), secondaryWireMat);
    activeAnimContainer.add(innerOcta);

    activeAnimContainer.userData = { wireframeSphere, vertexPoints, innerOcta };
  }

  // 2. CYBER TORUS VORTEX
  else if (mode === 'cyberTorus') {
    const t1Geo = new THREE.TorusGeometry(9.8, 2.1, 14, 60);
    const torus1 = new THREE.LineSegments(new THREE.WireframeGeometry(t1Geo), mainWireMat);
    activeAnimContainer.add(torus1);

    const t2Geo = new THREE.TorusGeometry(6.8, 1.5, 12, 48);
    const torus2 = new THREE.LineSegments(new THREE.WireframeGeometry(t2Geo), secondaryWireMat);
    activeAnimContainer.add(torus2);

    const knotGeo = new THREE.TorusKnotGeometry(3.8, 0.65, 56, 10);
    const knot = new THREE.LineSegments(new THREE.WireframeGeometry(knotGeo), mainWireMat);
    activeAnimContainer.add(knot);

    activeAnimContainer.userData = { torus1, torus2, knot };
  }

  // 3. QUANTUM WAVE LATTICE
  else if (mode === 'quantumWave') {
    waveGeometry = new THREE.PlaneGeometry(42, 42, 34, 34);

    const wavePoints = new THREE.Points(waveGeometry, vertexMat);
    wavePoints.rotation.x = -Math.PI / 2.3;
    activeAnimContainer.add(wavePoints);

    const waveWire = new THREE.LineSegments(new THREE.WireframeGeometry(waveGeometry), mainWireMat);
    waveWire.rotation.x = -Math.PI / 2.3;
    activeAnimContainer.add(waveWire);

    activeAnimContainer.userData = { wavePoints, waveWire };
  }

  // 4. 4D TESSERACT (HYPERCUBE)
  else if (mode === 'hyperCube') {
    const size = 10.0;
    const outerGeo = new THREE.BoxGeometry(size, size, size);
    const outerCube = new THREE.LineSegments(new THREE.WireframeGeometry(outerGeo), mainWireMat);
    outerCube.add(new THREE.Points(outerGeo, vertexMat));
    activeAnimContainer.add(outerCube);

    const innerGeo = new THREE.BoxGeometry(size * 0.56, size * 0.56, size * 0.56);
    const innerCube = new THREE.LineSegments(new THREE.WireframeGeometry(innerGeo), secondaryWireMat);
    activeAnimContainer.add(innerCube);

    const coreGeo = new THREE.OctahedronGeometry(size * 0.28, 0);
    const core = new THREE.LineSegments(new THREE.WireframeGeometry(coreGeo), mainWireMat);
    activeAnimContainer.add(core);

    activeAnimContainer.userData = { outerCube, innerCube, core };
  }

  // 5. NEURAL DNA HELIX (NEW PROFESSIONAL & SIMPLE)
  else if (mode === 'dnaHelix') {
    const helixGroup = new THREE.Group();
    const numRungs = 30;
    const height = 22;
    const radius = 4.6;

    const strandPositions = [];
    const rungVertices = [];

    for (let i = 0; i < numRungs; i++) {
      const t = i / (numRungs - 1);
      const y = (t - 0.5) * height;
      const angle = t * Math.PI * 3.5;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;

      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      strandPositions.push(x1, y, z1, x2, y, z2);
      rungVertices.push(x1, y, z1, x2, y, z2);
    }

    const nodesGeo = new THREE.BufferGeometry();
    nodesGeo.setAttribute('position', new THREE.Float32BufferAttribute(strandPositions, 3));
    const nodesPoints = new THREE.Points(nodesGeo, vertexMat);
    helixGroup.add(nodesPoints);

    const rungsGeo = new THREE.BufferGeometry();
    rungsGeo.setAttribute('position', new THREE.Float32BufferAttribute(rungVertices, 3));
    const rungsLines = new THREE.LineSegments(rungsGeo, mainWireMat);
    helixGroup.add(rungsLines);

    // Tilt DNA slightly for a sleek architectural angle
    helixGroup.rotation.z = Math.PI / 7;
    activeAnimContainer.add(helixGroup);
    activeAnimContainer.userData = { helixGroup };
  }

  // 6. CELESTIAL GYRO RINGS (NEW MINIMALIST & EXECUTIVE)
  else if (mode === 'orbitalRings') {
    const r1Geo = new THREE.TorusGeometry(10.5, 0.08, 12, 90);
    const ring1 = new THREE.LineSegments(new THREE.WireframeGeometry(r1Geo), mainWireMat);
    ring1.add(new THREE.Points(r1Geo, vertexMat));
    activeAnimContainer.add(ring1);

    const r2Geo = new THREE.TorusGeometry(8.0, 0.08, 12, 75);
    const ring2 = new THREE.LineSegments(new THREE.WireframeGeometry(r2Geo), secondaryWireMat);
    activeAnimContainer.add(ring2);

    const r3Geo = new THREE.TorusGeometry(5.5, 0.08, 12, 60);
    const ring3 = new THREE.LineSegments(new THREE.WireframeGeometry(r3Geo), mainWireMat);
    activeAnimContainer.add(ring3);

    const coreGeo = new THREE.OctahedronGeometry(2.4, 0);
    const coreGem = new THREE.LineSegments(new THREE.WireframeGeometry(coreGeo), secondaryWireMat);
    activeAnimContainer.add(coreGem);

    activeAnimContainer.userData = { ring1, ring2, ring3, coreGem };
  }

  threeScene.add(activeAnimContainer);
  updateResponsive3DLayout();
  updateThreeColors();
}

/* Soft & Lighter Contrast Calibration so Text Always Pops Clearly */
function updateThreeColors() {
  if (!threeMaterials.mainWire) return;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // Soft Ambient Dark Mode Palettes (Kept lighter/softer than the bright white text)
  const darkPalettes = {
    cyan: { primary: 0x0284c7, secondary: 0x4f46e5 },
    violet: { primary: 0x7c3aed, secondary: 0xc026d3 },
    emerald: { primary: 0x059669, secondary: 0x0284c7 },
    crimson: { primary: 0xe11d48, secondary: 0xd97706 },
    amber: { primary: 0xd97706, secondary: 0xe11d48 }
  };

  // Soft Muted Light Mode Palettes (Kept lighter/softer than the deep midnight ink text)
  const lightPalettes = {
    cyan: { primary: 0x0284c7, secondary: 0x4338ca },
    violet: { primary: 0x6d28d9, secondary: 0xbe185d },
    emerald: { primary: 0x047857, secondary: 0x0e7490 },
    crimson: { primary: 0xbe123c, secondary: 0xc2410c },
    amber: { primary: 0xb45309, secondary: 0x9f1239 }
  };

  const active = (isLight ? lightPalettes : darkPalettes)[currentPalette] || (isLight ? lightPalettes.cyan : darkPalettes.cyan);

  // Calibrated low opacity so 3D animations never overpower foreground text
  if (threeMaterials.mainWire) {
    threeMaterials.mainWire.color.setHex(active.primary);
    threeMaterials.mainWire.opacity = isLight ? 0.18 : 0.16;
  }
  if (threeMaterials.vertex) {
    threeMaterials.vertex.color.setHex(active.primary);
    threeMaterials.vertex.opacity = isLight ? 0.40 : 0.50;
  }
  if (threeMaterials.secondaryWire) {
    threeMaterials.secondaryWire.color.setHex(active.secondary);
    threeMaterials.secondaryWire.opacity = isLight ? 0.22 : 0.20;
  }
  if (threeMaterials.particleMat) {
    threeMaterials.particleMat.color.setHex(active.primary);
    threeMaterials.particleMat.opacity = isLight ? 0.22 : 0.28;
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

  let mouseX = 0;
  let mouseY = 0;
  let ringX = 0;
  let ringY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  });

  function renderCursor() {
    ringX += (mouseX - ringX) * 0.16;
    ringY += (mouseY - ringY) * 0.16;
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
    sessionStorage.removeItem('adminToken');
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
            <button class="chip-btn-icon delete-btn" title="Delete Message" onclick="deleteMessage('${msg._id}')">
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
      sessionStorage.setItem('adminToken', adminToken);
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