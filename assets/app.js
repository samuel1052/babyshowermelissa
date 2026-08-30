// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://yobstbrdvnqaoydrjhhk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYnN0YnJkdm5xYW95ZHJqaGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1ODIwNTksImV4cCI6MjEwMzE1ODA1OX0.nITMqJofv5hMFVrpMTWX31jJJ4AG_R_frQ8dJeRdlqk';

let supabaseClient = null;
let giftsData = [];
let currentCategory = '*';
let selectedGiftId = null;

// Elementos DOM
let listEl, searchEl, controlsEl, hideClaimedEl, progressCountEl;
let modalBackdrop, modalGiftName, modalForm, modalSuccess, claimerNameInput, claimerMessageInput;
let suggestModalBackdrop, rsvpModalBackdrop;

function initSupabase() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  listEl = document.getElementById('list');
  searchEl = document.getElementById('search');
  controlsEl = document.getElementById('controls');
  hideClaimedEl = document.getElementById('hide-claimed');
  progressCountEl = document.getElementById('progress-count');

  modalBackdrop = document.getElementById('modal-backdrop');
  modalGiftName = document.getElementById('modal-gift-name');
  modalForm = document.getElementById('modal-form');
  modalSuccess = document.getElementById('modal-success');
  claimerNameInput = document.getElementById('claimer-name');
  claimerMessageInput = document.getElementById('claimer-message');

  suggestModalBackdrop = document.getElementById('suggest-modal-backdrop');
  rsvpModalBackdrop = document.getElementById('rsvp-modal-backdrop');

  initSupabase();
  fetchGifts();
  setupEventListeners();
});

async function fetchGifts() {
  if (!supabaseClient) {
    initSupabase();
  }
  
  if (!supabaseClient) {
    console.error('No se pudo inicializar Supabase.');
    if (listEl) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #a33;">
          <h3>⚠️ Error de conexión</h3>
          <p>No se pudo conectar con la base de datos.</p>
          <button onclick="location.reload()" class="btn btn-primary" style="margin-top:10px;">Recargar página</button>
        </div>`;
    }
    return;
  }

  try {
    if (listEl) {
      listEl.innerHTML = `
        <div class="loading">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <p>Cargando la lista para Éster…</p>
        </div>`;
    }

    const { data, error } = await supabaseClient
      .from('regalos')
      .select('*');

    if (error) throw error;

    giftsData = data || [];
    renderCategories();
    renderGifts();
    updateProgress();
  } catch (err) {
    console.error('Error fetching gifts:', err);
    if (listEl) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #a33;">
          <h3>⚠️ No se pudieron cargar los regalos</h3>
          <p>${err.message || 'Error al conectar con la base de datos.'}</p>
          <button onclick="fetchGifts()" class="btn btn-primary" style="margin-top:10px;">Reintentar</button>
        </div>`;
    }
  }
}

function updateProgress() {
  if (!giftsData.length) return;
  const reserved = giftsData.filter(g => g.reservado).length;
  if (progressCountEl) {
    progressCountEl.textContent = `${reserved} de ${giftsData.length} regalos reservados 🩷`;
  }
}

function renderCategories() {
  if (!controlsEl) return;
  const categories = ['*'];
  giftsData.forEach(g => {
    if (g.categoria && !categories.includes(g.categoria)) {
      categories.push(g.categoria);
    }
  });

  controlsEl.innerHTML = categories.map(cat => `
    <button class="chip ${cat === currentCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat === '*' ? 'Todo' : cat}
    </button>
  `).join('');

  controlsEl.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      controlsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.getAttribute('data-cat');
      renderGifts();
    });
  });
}

function renderGifts() {
  if (!listEl) return;
  const query = (searchEl?.value || '').toLowerCase().trim();
  const hideClaimed = hideClaimedEl?.checked || false;

  const filtered = giftsData.filter(gift => {
    const matchesCat = currentCategory === '*' || gift.categoria === currentCategory;
    const matchesSearch = (gift.nombre || '').toLowerCase().includes(query) ||
                          (gift.descripcion || '').toLowerCase().includes(query);
    const matchesClaimed = hideClaimed ? !gift.reservado : true;
    return matchesCat && matchesSearch && matchesClaimed;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding: 40px; color: #7a6e5d;">No se encontraron regalos.</div>`;
    return;
  }

  listEl.innerHTML = `<div class="grid">${filtered.map(createGiftCard).join('')}</div>`;

  listEl.querySelectorAll('.btn-reserve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openReserveModal(id);
    });
  });
}

// TARJETA DE REGALO SIN FOTOS
function createGiftCard(gift) {
  const isClaimed = !!gift.reservado;
  
  return `
    <div class="card ${isClaimed ? 'claimed' : ''}">
      <div class="card-body">
        ${isClaimed ? '<div style="margin-bottom:8px;"><span class="claimed-badge">Reservado 🎀</span></div>' : ''}
        <h3 class="card-title">${gift.nombre || ''}</h3>
        <p class="card-desc">${gift.descripcion || ''}</p>
        ${gift.link ? `<a href="${gift.link}" target="_blank" rel="noopener" class="card-link">Ver idea de referencia ↗</a>` : ''}
        <div class="card-footer" style="margin-top:15px;">
          ${isClaimed ? `
            <button class="btn btn-disabled" disabled>
              ${gift.reservado_por ? `Reservado por ${gift.reservado_por}` : 'Reservado'}
            </button>
          ` : `
            <button class="btn btn-primary btn-reserve" data-id="${gift.id}">
              Reservar este regalo
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function openReserveModal(id) {
  const gift = giftsData.find(g => g.id == id);
  if (!gift) return;
  selectedGiftId = id;
  if (modalGiftName) modalGiftName.textContent = gift.nombre;
  if (modalForm) modalForm.style.display = 'block';
  if (modalSuccess) modalSuccess.style.display = 'none';
  if (claimerNameInput) claimerNameInput.value = '';
  if (claimerMessageInput) claimerMessageInput.value = '';
  if (modalBackdrop) modalBackdrop.classList.add('show');
}

async function confirmReservation() {
  if (!selectedGiftId || !supabaseClient) return;

  const name = claimerNameInput ? claimerNameInput.value.trim() : '';
  const finalName = name || 'Alguien especial';
  const msg = claimerMessageInput ? claimerMessageInput.value.trim() : '';

  try {
    const { error } = await supabaseClient
      .from('regalos')
      .update({
        reservado: true,
        reservado_por: finalName,
        mensaje: msg
      })
      .eq('id', selectedGiftId);

    if (error) throw error;

    if (modalForm) modalForm.style.display = 'none';
    if (modalSuccess) modalSuccess.style.display = 'block';
    showToast('¡Regalo reservado con éxito!');
    fetchGifts();
  } catch (err) {
    console.error('Error al reservar:', err);
    alert('Hubo un error al guardar la reserva: ' + (err.message || 'Error de conexión'));
  }
}

function setupEventListeners() {
  if (searchEl) searchEl.addEventListener('input', renderGifts);
  if (hideClaimedEl) hideClaimedEl.addEventListener('change', renderGifts);

  document.getElementById('modal-cancel')?.addEventListener('click', () => modalBackdrop?.classList.remove('show'));
  document.getElementById('modal-close')?.addEventListener('click', () => modalBackdrop?.classList.remove('show'));
  document.getElementById('modal-confirm')?.addEventListener('click', confirmReservation);

  document.getElementById('btn-open-suggest')?.addEventListener('click', () => {
    suggestModalBackdrop?.classList.add('show');
  });
  document.getElementById('suggest-cancel')?.addEventListener('click', () => {
    suggestModalBackdrop?.classList.remove('show');
  });
  document.getElementById('suggest-confirm')?.addEventListener('click', submitSuggestion);

  document.getElementById('btn-open-rsvp')?.addEventListener('click', () => {
    rsvpModalBackdrop?.classList.add('show');
  });
  document.getElementById('rsvp-cancel')?.addEventListener('click', () => {
    rsvpModalBackdrop?.classList.remove('show');
  });
  document.getElementById('rsvp-confirm')?.addEventListener('click', submitRSVP);
}

async function submitSuggestion() {
  const titleEl = document.getElementById('suggest-title');
  const descEl = document.getElementById('suggest-desc');
  const nameEl = document.getElementById('suggest-name');

  const title = titleEl ? titleEl.value.trim() : '';
  const desc = descEl ? descEl.value.trim() : '';
  const name = nameEl ? nameEl.value.trim() : '';
  const finalName = name || 'Alguien especial';

  if (!title) {
    alert('Por favor escribe el nombre del regalo.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('regalos')
      .insert([{
        nombre: title,
        descripcion: desc,
        reservado: true,
        reservado_por: finalName,
        categoria: 'Sugerencias'
      }]);

    if (error) throw error;

    suggestModalBackdrop?.classList.remove('show');
    showToast('¡Sugerencia añadida y reservada!');
    if (titleEl) titleEl.value = '';
    if (descEl) descEl.value = '';
    if (nameEl) nameEl.value = '';
    fetchGifts();
  } catch (err) {
    console.error('Error al sugerir:', err);
    alert('No se pudo añadir la sugerencia: ' + (err.message || ''));
  }
}

// ASISTENCIAS CORREGIDO SEGÚN TUS COLUMNAS EXACTAS (nombre, asistentes, comentarios)
async function submitRSVP() {
  const nameEl = document.getElementById('rsvp-name');
  const countEl = document.getElementById('rsvp-count');
  const commentsEl = document.getElementById('rsvp-comments');

  const name = nameEl ? nameEl.value.trim() : '';
  const count = countEl ? countEl.value : '1';
  const comments = commentsEl ? commentsEl.value.trim() : '';

  if (!name) {
    alert('Por favor introduce tu nombre y apellidos.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('asistencias')
      .insert([{
        nombre: name,
        asistentes: parseInt(count, 10),
        comentarios: comments
      }]);

    if (error) throw error;

    rsvpModalBackdrop?.classList.remove('show');
    showToast('¡Asistencia confirmada! Mil gracias 🩷');
    if (nameEl) nameEl.value = '';
    if (commentsEl) commentsEl.value = '';
  } catch (err) {
    console.error('Error al guardar asistencia:', err);
    alert('No se pudo confirmar la asistencia: ' + (err.message || ''));
  }
}

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
