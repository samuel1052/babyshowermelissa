// 1. CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://yobstbrdvnqaoydrjhhk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_laR6A943f2AxxCF0DuRckA_10ojnXjS';

// Inicializar Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let giftsData = [];
let currentCategory = '*';
let selectedGiftId = null;

// Elementos DOM
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const controlsEl = document.getElementById('controls');
const hideClaimedEl = document.getElementById('hide-claimed');
const progressCountEl = document.getElementById('progress-count');

// Modales
const modalBackdrop = document.getElementById('modal-backdrop');
const modalGiftName = document.getElementById('modal-gift-name');
const modalForm = document.getElementById('modal-form');
const modalSuccess = document.getElementById('modal-success');
const claimerNameInput = document.getElementById('claimer-name');
const claimerMessageInput = document.getElementById('claimer-message');

const suggestModalBackdrop = document.getElementById('suggest-modal-backdrop');
const rsvpModalBackdrop = document.getElementById('rsvp-modal-backdrop');

// Cargar Regalos al Iniciar
document.addEventListener('DOMContentLoaded', () => {
  fetchGifts();
  setupEventListeners();
});

async function fetchGifts() {
  try {
    listEl.innerHTML = `
      <div class="loading">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <p>Cargando la lista para Éster…</p>
      </div>`;

    const { data, error } = await supabaseClient
      .from('regalos')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    giftsData = data || [];
    renderCategories();
    renderGifts();
    updateProgress();
  } catch (err) {
    console.error('Error fetching gifts:', err);
    listEl.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #a33;">
        <h3>⚠️ No se pudieron cargar los regalos</h3>
        <p>Por favor comprueba la conexión o inténtalo de nuevo en unos momentos.</p>
        <button onclick="fetchGifts()" class="btn btn-primary" style="margin-top:10px;">Reintentar</button>
      </div>`;
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

  // Asignar eventos a botones de reservar
  listEl.querySelectorAll('.btn-reserve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openReserveModal(id);
    });
  });
}

function createGiftCard(gift) {
  const isClaimed = !!gift.reservado;
  const imgUrl = gift.imagen_url || gift.image_url || 'https://via.placeholder.com/300x200?text=Regalo+%C3%89ster';
  
  return `
    <div class="card ${isClaimed ? 'claimed' : ''}">
      <div class="card-img-wrap">
        <img src="${imgUrl}" alt="${gift.nombre}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x200?text=Regalo'">
        ${isClaimed ? '<span class="claimed-badge">Reservado 🎀</span>' : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title">${gift.nombre}</h3>
        <p class="card-desc">${gift.descripcion || ''}</p>
        ${gift.link ? `<a href="${gift.link}" target="_blank" rel="noopener" class="card-link">Ver idea de referencia ↗</a>` : ''}
        <div class="card-footer">
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

// RESERVAR REGALO
function openReserveModal(id) {
  const gift = giftsData.find(g => g.id == id);
  if (!gift) return;
  selectedGiftId = id;
  modalGiftName.textContent = gift.nombre;
  modalForm.style.display = 'block';
  modalSuccess.style.display = 'none';
  claimerNameInput.value = '';
  if (claimerMessageInput) claimerMessageInput.value = '';
  modalBackdrop.classList.add('show');
}

async function confirmReservation() {
  if (!selectedGiftId) return;

  const name = claimerNameInput.value.trim() || 'Alguien especial';
  const msg = claimerMessageInput ? claimerMessageInput.value.trim() : '';

  try {
    const { error } = await supabaseClient
      .from('regalos')
      .update({
        reservado: true,
        reservado_por: name,
        mensaje: msg
      })
      .eq('id', selectedGiftId);

    if (error) throw error;

    modalForm.style.display = 'none';
    modalSuccess.style.display = 'block';
    showToast('¡Regalo reservado con éxito!');
    fetchGifts();
  } catch (err) {
    console.error('Error al reservar:', err);
    alert('Hubo un error al guardar la reserva. Por favor reintenta.');
  }
}

// EVENT LISTENERS
function setupEventListeners() {
  if (searchEl) searchEl.addEventListener('input', renderGifts);
  if (hideClaimedEl) hideClaimedEl.addEventListener('change', renderGifts);

  document.getElementById('modal-cancel')?.addEventListener('click', () => modalBackdrop.classList.remove('show'));
  document.getElementById('modal-close')?.addEventListener('click', () => modalBackdrop.classList.remove('show'));
  document.getElementById('modal-confirm')?.addEventListener('click', confirmReservation);

  // Sugerir regalo
  document.getElementById('btn-open-suggest')?.addEventListener('click', () => {
    suggestModalBackdrop.classList.add('show');
  });
  document.getElementById('suggest-cancel')?.addEventListener('click', () => {
    suggestModalBackdrop.classList.remove('show');
  });
  document.getElementById('suggest-confirm')?.addEventListener('click', submitSuggestion);

  // Confirmar Asistencia (RSVP)
  document.getElementById('btn-open-rsvp')?.addEventListener('click', () => {
    rsvpModalBackdrop.classList.add('show');
  });
  document.getElementById('rsvp-cancel')?.addEventListener('click', () => {
    rsvpModalBackdrop.classList.remove('show');
  });
  document.getElementById('rsvp-confirm')?.addEventListener('click', submitRSVP);
}

// SUGERIR Y RESERVAR
async function submitSuggestion() {
  const title = document.getElementById('suggest-title').value.trim();
  const desc = document.getElementById('suggest-desc').value.trim();
  const name = document.getElementById('suggest-name').value.trim() || 'Alguien especial';

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
        reservado_por: name,
        categoria: 'Sugerencias'
      }]);

    if (error) throw error;

    suggestModalBackdrop.classList.remove('show');
    showToast('¡Sugerencia añadida y reservada!');
    document.getElementById('suggest-title').value = '';
    document.getElementById('suggest-desc').value = '';
    document.getElementById('suggest-name').value = '';
    fetchGifts();
  } catch (err) {
    console.error('Error al sugerir:', err);
    alert('No se pudo añadir la sugerencia.');
  }
}

// CONFIRMAR ASISTENCIA
async function submitRSVP() {
  const name = document.getElementById('rsvp-name').value.trim();
  const count = document.getElementById('rsvp-count').value;
  const comments = document.getElementById('rsvp-comments').value.trim();

  if (!name) {
    alert('Por favor introduce tu nombre y apellidos.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('asistencias')
      .insert([{
        nombre: name,
        personas: parseInt(count, 10),
        notas: comments
      }]);

    if (error) throw error;

    rsvpModalBackdrop.classList.remove('show');
    showToast('¡Asistencia confirmada! Mil gracias 🩷');
    document.getElementById('rsvp-name').value = '';
    document.getElementById('rsvp-comments').value = '';
  } catch (err) {
    console.error('Error al guardar asistencia:', err);
    alert('No se pudo confirmar la asistencia.');
  }
}

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
