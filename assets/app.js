// Manejo de la aplicación Baby Shower
document.addEventListener('DOMContentLoaded', () => {
  const supabaseUrl = window.ENV_SUPABASE_URL;
  const supabaseKey = window.ENV_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan las credenciales de Supabase en config.js');
    return;
  }

  const db = supabase.createClient(supabaseUrl, supabaseKey);

  let giftsData = [];
  let claimsData = [];
  let selectedGift = null;

  // Elementos del DOM
  const listContainer = document.getElementById('list');
  const searchInput = document.getElementById('search');
  const hideClaimedCheckbox = document.getElementById('hide-claimed');
  const controlsContainer = document.getElementById('controls');
  const progressCount = document.getElementById('progress-count');

  // Modales
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');
  const claimerNameInput = document.getElementById('claimer-name');
  const claimerMessageInput = document.getElementById('claimer-message');

  const suggestModal = document.getElementById('suggest-modal-backdrop');
  const btnOpenSuggest = document.getElementById('btn-open-suggest');
  const suggestCancel = document.getElementById('suggest-cancel');
  const suggestConfirm = document.getElementById('suggest-confirm');

  const rsvpModal = document.getElementById('rsvp-modal-backdrop');
  const btnOpenRsvp = document.getElementById('btn-open-rsvp');
  const rsvpCancel = document.getElementById('rsvp-cancel');
  const rsvpConfirm = document.getElementById('rsvp-confirm');

  // Cargar datos
  async function fetchData() {
    try {
      const [giftsRes, claimsRes] = await Promise.all([
        db.from('gifts').select('*').order('id', { ascending: true }),
        db.from('claims').select('*')
      ]);

      if (giftsRes.error) throw giftsRes.error;
      if (claimsRes.error) throw claimsRes.error;

      giftsData = giftsRes.data || [];
      claimsData = claimsRes.data || [];

      renderCategories();
      renderList();
      updateProgress();
    } catch (err) {
      console.error('Error cargando datos:', err);
      if (listContainer) {
        listContainer.innerHTML = '<p class="error">Hubo un error al cargar la lista. Por favor, recarga la página.</p>';
      }
    }
  }

  // Filtrar y Renderizar Lista
  function renderList() {
    if (!listContainer) return;

    const query = (searchInput?.value || '').toLowerCase().trim();
    const hideClaimed = hideClaimedCheckbox?.checked || false;
    const activeChip = document.querySelector('.chip.active');
    const selectedCat = activeChip ? activeChip.dataset.cat : '*';

    const filtered = giftsData.filter(gift => {
      const giftClaims = claimsData.filter(c => c.gift_id === gift.id);
      const isFullyClaimed = giftClaims.length >= (gift.quantity || 1);

      if (hideClaimed && isFullyClaimed) return false;
      if (selectedCat !== '*' && gift.category !== selectedCat) return false;
      
      if (query) {
        const matchTitle = gift.title?.toLowerCase().includes(query);
        const matchDesc = gift.description?.toLowerCase().includes(query);
        return matchTitle || matchDesc;
      }

      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<p class="empty">No se encontraron regalos con esos criterios.</p>';
      return;
    }

    listContainer.innerHTML = filtered.map(gift => {
      const giftClaims = claimsData.filter(c => c.gift_id === gift.id);
      const count = giftClaims.length;
      const total = gift.quantity || 1;
      const isFullyClaimed = count >= total;

      return `
        <div class="card ${isFullyClaimed ? 'claimed' : ''}">
          <h3>🎁 ${escapeHtml(gift.title)}</h3>
          <p>${escapeHtml(gift.description || '')}</p>
          ${isFullyClaimed 
            ? `<button class="btn-claim disabled" disabled>Reservado (Completo)</button>` 
            : `<button class="btn-claim" data-id="${gift.id}">Reservar este regalo 🎁</button>`
          }
        </div>
      `;
    }).join('');

    // Eventos a botones de reserva
    document.querySelectorAll('.btn-claim:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        selectedGift = giftsData.find(g => g.id === id);
        if (selectedGift && modalBackdrop) {
          document.getElementById('modal-gift-name').innerText = selectedGift.title;
          modalBackdrop.classList.add('show');
        }
      });
    });
  }

  function renderCategories() {
    if (!controlsContainer) return;
    const categories = ['*', ...new Set(giftsData.map(g => g.category).filter(Boolean))];
    
    controlsContainer.innerHTML = categories.map(cat => `
      <button class="chip ${cat === '*' ? 'active' : ''}" data-cat="${escapeHtml(cat)}">
        ${cat === '*' ? 'Todo' : escapeHtml(cat)}
      </button>
    `).join('');

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderList();
      });
    });
  }

  function updateProgress() {
    if (!progressCount) return;
    const totalGifts = giftsData.reduce((acc, g) => acc + (g.quantity || 1), 0);
    const claimedGifts = claimsData.length;
    progressCount.innerText = `${claimedGifts} de ${totalGifts} regalos reservados`;
  }

  // Modal Reserva
  modalCancel?.addEventListener('click', () => modalBackdrop.classList.remove('show'));
  modalConfirm?.addEventListener('click', async () => {
    if (!selectedGift) return;
    const claimerName = claimerNameInput?.value.trim() || 'Anónimo';
    const message = claimerMessageInput?.value.trim() || '';

    try {
      const { error } = await db.from('claims').insert([{
        gift_id: selectedGift.id,
        claimer_name: claimerName,
        message: message
      }]);

      if (error) throw error;

      modalBackdrop.classList.remove('show');
      if (claimerNameInput) claimerNameInput.value = '';
      if (claimerMessageInput) claimerMessageInput.value = '';
      
      showToast('¡Reserva realizada con éxito! 🩷');
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error al reservar el regalo');
    }
  });

  // Modal Sugerir
  btnOpenSuggest?.addEventListener('click', () => suggestModal.classList.add('show'));
  suggestCancel?.addEventListener('click', () => suggestModal.classList.remove('show'));
  suggestConfirm?.addEventListener('click', async () => {
    const title = document.getElementById('suggest-title')?.value.trim();
    const desc = document.getElementById('suggest-desc')?.value.trim();
    const name = document.getElementById('suggest-name')?.value.trim() || 'Anónimo';

    if (!title) {
      alert('Por favor introduce un título para el regalo');
      return;
    }

    try {
      const { data: newGift, error: giftErr } = await db.from('gifts').insert([{
        title: title,
        description: desc,
        quantity: 1,
        category: 'Sugeridos'
      }]).select().single();

      if (giftErr) throw giftErr;

      await db.from('claims').insert([{
        gift_id: newGift.id,
        claimer_name: name,
        message: 'Regalo añadido por el invitado'
      }]);

      suggestModal.classList.remove('show');
      document.getElementById('suggest-title').value = '';
      document.getElementById('suggest-desc').value = '';
      document.getElementById('suggest-name').value = '';

      showToast('¡Regalo añadido y reservado! 🎁');
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error al sugerir el regalo');
    }
  });

  // Modal RSVP
  btnOpenRsvp?.addEventListener('click', () => rsvpModal.classList.add('show'));
  rsvpCancel?.addEventListener('click', () => rsvpModal.classList.remove('show'));
  rsvpConfirm?.addEventListener('click', async () => {
    const name = document.getElementById('rsvp-name')?.value.trim();
    const count = parseInt(document.getElementById('rsvp-count')?.value || '1', 10);
    const comments = document.getElementById('rsvp-comments')?.value.trim();

    if (!name) {
      alert('Por favor introduce tu nombre');
      return;
    }

    try {
      const { error } = await db.from('rsvps').insert([{
        guest_name: name,
        attendees_count: count,
        comments: comments
      }]);

      if (error) throw error;

      rsvpModal.classList.remove('show');
      document.getElementById('rsvp-name').value = '';
      document.getElementById('rsvp-comments').value = '';

      showToast('¡Asistencia confirmada! Muchas gracias 🎉');
    } catch (err) {
      console.error(err);
      showToast('Error al confirmar asistencia');
    }
  });

  // Escuchadores de Filtros
  searchInput?.addEventListener('input', renderList);
  hideClaimedCheckbox?.addEventListener('change', renderList);

  // Auxiliares
  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Carga inicial
  fetchData();
});
