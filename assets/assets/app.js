function initApp() {
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
    console.error('Faltan las claves de Supabase en assets/config.js');
    const listEl = document.getElementById('list');
    if (listEl) listEl.innerHTML = `<div class="loading"><p>⚠️ Faltan las claves en assets/config.js</p></div>`;
    return;
  }

  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let regalosList = [];
  let selectedGiftName = null;

  const listEl = document.getElementById('list');
  const searchEl = document.getElementById('search');
  const hideClaimedEl = document.getElementById('hide-claimed');
  const progressCountEl = document.getElementById('progress-count');

  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalGiftName = document.getElementById('modal-gift-name');
  const claimerNameInput = document.getElementById('claimer-name');
  const claimerMsgInput = document.getElementById('claimer-message');
  const btnCancel = document.getElementById('modal-cancel');
  const btnConfirm = document.getElementById('modal-confirm');
  const modalForm = document.getElementById('modal-form');
  const modalSuccess = document.getElementById('modal-success');
  const btnClose = document.getElementById('modal-close');
  const toastEl = document.getElementById('toast');

  async function loadGifts() {
    try {
      const { data, error } = await db.from('regalos').select('*');
      if (error) throw error;

      regalosList = data || [];
      renderGifts();
      updateProgress();
    } catch (err) {
      console.error('Error al cargar regalos:', err);
      if (listEl) {
        listEl.innerHTML = `<div class="loading"><p>⚠️ Error al conectar con Supabase: ${err.message || 'Verifica la configuración'}</p></div>`;
      }
    }
  }

  function renderGifts() {
    if (!listEl) return;

    const query = (searchEl ? searchEl.value : '').toLowerCase().trim();
    const hideClaimed = hideClaimedEl ? hideClaimedEl.checked : false;

    const filtered = regalosList.filter(item => {
      const matchesSearch = item.nombre.toLowerCase().includes(query) || 
                            (item.descripcion && item.descripcion.toLowerCase().includes(query));
      const matchesClaimed = hideClaimed ? !item.reservado : true;
      return matchesSearch && matchesClaimed;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="loading"><p>No se encontraron regalos disponibles 🌸</p></div>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(item => {
      const card = document.createElement('article');
      card.className = `gift-card ${item.reservado ? 'claimed' : ''}`;

      const placeholderImg = 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400';
      const imgSrc = item.imagen && item.imagen.trim() !== '' ? item.imagen : placeholderImg;

      const actionHTML = item.reservado
        ? `<span class="tag-claimed">Reservado por ${item.reservado_por || 'un invitado'}</span>`
        : `<button class="btn-reserve" data-name="${item.nombre}">Reservar este regalo 🎁</button>`;

      card.innerHTML = `
        <img src="${imgSrc}" alt="${item.nombre}" loading="lazy">
        <div class="gift-card-body">
          <h3>${item.nombre}</h3>
          <p>${item.descripcion || ''}</p>
          <div class="gift-status">
            ${actionHTML}
          </div>
        </div>
      `;

      listEl.appendChild(card);
    });

    document.querySelectorAll('.btn-reserve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedGiftName = e.target.getAttribute('data-name');
        openModal(selectedGiftName);
      });
    });
  }

  function updateProgress() {
    if (!progressCountEl) return;
    const total = regalosList.length;
    const reserved = regalosList.filter(r => r.reservado).length;
    progressCountEl.textContent = `${reserved} de ${total} regalos reservados 🎀`;
  }

  function openModal(giftName) {
    if (modalGiftName) modalGiftName.textContent = giftName;
    if (claimerNameInput) claimerNameInput.value = '';
    if (modalMsgInput = claimerMsgInput) claimerMsgInput.value = '';
    if (modalForm) modalForm.style.display = 'block';
    if (modalSuccess) modalSuccess.style.display = 'none';
    if (modalBackdrop) modalBackdrop.classList.add('open');
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.classList.remove('open');
    selectedGiftName = null;
  }

  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      if (!selectedGiftName) return;

      let name = claimerNameInput ? claimerNameInput.value.trim() : '';
      let msg = claimerMsgInput ? claimerMsgInput.value.trim() : '';
      let finalName = name !== '' ? name : 'Alguien muy especial';
      if (msg !== '') finalName += ` ("${msg}")`;

      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Guardando...';

      try {
        const { error } = await db
          .from('regalos')
          .update({ reservado: true, reservado_por: finalName })
          .eq('nombre', selectedGiftName);

        if (error) throw error;

        if (modalForm) modalForm.style.display = 'none';
        if (modalSuccess) modalSuccess.style.display = 'block';

        showToast('¡Regalo reservado con éxito! 🎉');
        await loadGifts();
      } catch (err) {
        console.error('Error reservando:', err);
        alert('Ocurrió un error al reservar. Inténtalo de nuevo.');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Reservar 🎁';
      }
    });
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => { toastEl.classList.remove('show'); }, 3500);
  }

  if (searchEl) searchEl.addEventListener('input', renderGifts);
  if (hideClaimedEl) hideClaimedEl.addEventListener('change', renderGifts);

  loadGifts();
}

// Ejecutar inmediatamente si la página ya cargó
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
