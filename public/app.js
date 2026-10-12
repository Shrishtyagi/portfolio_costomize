let adminToken = sessionStorage.getItem('adminToken') || null;
let portfolioCards = [];
let contactLinks = [];
let receivedMessages = [];
let activeGalleryMediaList = [];

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  checkAdminState();
  loadProfile();
  loadContacts();
  loadCards();

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

/* Auth Guard Helpers */
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

/* Load Bio / Tagline */
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data && data.tagline) {
      const el = document.getElementById('heroTagline');
      if (el) el.innerText = data.tagline;
    }
  } catch (err) {
    console.error("Error loading profile tagline:", err);
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

/* Contact Link Modal Controls */
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

/* Google Drive ID Extractor */
function extractDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/(?:\/file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

/* Media Type Detection */
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

/* Render Cards into Grids */
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

    // 1. Technical Skills
    if (card.section === 'skills') {
      const iconHtml = card.icon ? `<i class="${card.icon}"></i>` : `<i class="fa-solid fa-code"></i>`;
      cardEl.innerHTML = `
        <div class="skill-head">
          ${iconHtml}
          <h3 class="card-title" style="margin: 0; font-size: 1.2rem;">${card.title}</h3>
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

    // 2. Action Buttons
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
}

/* Tagline / Bio Modal */
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

/* Gallery Modal */
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
  closeAdminModal();
  closeEditModal();
}

/* Owner Authentication */
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
      alert("Owner mode unlocked! You can now edit cards, bio, and contacts.");
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
    ownerBtn.style.borderColor = '#34d399';
    ownerBtn.style.color = '#34d399';
    const textSpan = ownerBtn.querySelector('.btn-text');
    if (textSpan) textSpan.innerText = "Owner (Unlocked)";
    loadMessages();
  } else {
    document.body.classList.remove('admin-mode-active');
    ownerBtn.style.borderColor = 'var(--accent-cyan)';
    ownerBtn.style.color = 'var(--accent-cyan)';
    const textSpan = ownerBtn.querySelector('.btn-text');
    if (textSpan) textSpan.innerText = "Owner Mode";
  }
}

/* PDF Modal */
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

/* Dynamic Field Adjustment based on Card Section */
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
    // Experience
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