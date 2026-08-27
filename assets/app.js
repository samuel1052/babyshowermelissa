function initApp() {
  const listEl = document.getElementById('list');

  if (typeof supabase === 'undefined') {
    if (listEl) {
      listEl.innerHTML = `
        <div style="background:#fce4e4; color:#900; padding:16px; border-radius:8px; text-align:center; margin:20px;">
          <h3>⚠️ Error de Librería</h3>
          <p>No se pudo cargar Supabase. Comprueba tu conexión a internet.</p>
        </div>`;
    }
    return;
  }

  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined' || !SUPABASE_URL || !SUPABASE_KEY) {
    if (listEl) {
      listEl.innerHTML = `
        <div style="background:#fff3cd; color:#856404; padding:16px; border-radius:8px; text-align:center; margin:20px;">
          <h3>⚠️ Error de Configuración</h3>
          <p>Revisa las claves en <code>assets/config.js</code>.</p>
        </div>`;
    }
    return;
  }

  let db;
  try {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `
        <div style="background:#fce4e4; color:#900; padding:16px; border-radius:8px; text-align:center; margin:20px;">
          <h3>⚠️ Error de Conexión</h3>
          <p>${err.message}</p>
        </div>`;
    }
    return;
  }

  let regalosList = [];
  let selectedGiftName = null;

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

      if (!data || data.length === 0) {
        if (listEl) {
          listEl.innerHTML = `
            <div style="background:#e8f4f8; color:#1b4965; padding:16px; border-radius:8px; text-align:center; margin:20px;">
              <h3>🌸 Sin regalos encontrados</h3>
              <p>No hay items en la lista por ahora.</p>
            </div>`;
        }
        return;
      }

      regalosList = data;
      renderGifts();
      updateProgress();

    } catch (err) {
      console.error('Error Supabase:', err);
      if (listEl) {
        listEl.innerHTML = `
          <div style="background:#fce4e4; color:#900; padding:16px; border-radius:8px; text-align:center; margin:20px;">
            <h3>⚠️ Error al conectar con la base de datos</h3>
            <p>${err.message || 'Error de lectura'}</p>
          </div>`;
      }
    }
  }

  function renderGifts() {
    if (!listEl) return;

    const query = (searchEl ? searchEl.value : '').toLowerCase().trim();
    const hideClaimed = hideClaimedEl ? hideClaimedEl.checked : false;

    const filtered = regalosList.filter(item => {
      const nameMatch = item.nombre ? item.nombre.toLowerCase().includes(query) : false;
      const descMatch = item.descripcion ? item.descripcion.toLowerCase().includes(query) : false;
      const matchesSearch = nameMatch || descMatch;
      const matchesClaimed = hideClaimed ? !item.reservado : true;
      return matchesSearch && matchesClaimed;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="loading"><p>No hay regalos que coincidan con la búsqueda 🌸</p></div>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(item => {
      const card = document.createElement('article');
      card.className = `gift-card ${item.reservado ? 'claimed' : ''}`;

      const actionHTML = item.reservado
        ? `<span class="tag-claimed">Reservado por ${item.reservado_por || 'un invitado'}</span>`
        : `<button class="btn-reserve" data-name="${item.nombre}">Reservar este regalo 🎁</button>`;

      // Renderizado sin etiqueta <img>
      card.innerHTML = `
        <div class="gift-card-body" style="padding: 20px; width: 100%;">
          <h3 style="margin-top: 0; font-size: 1.25rem;">🎁 ${item.nombre || 'Regalo sin nombre'}</h3>
          <p style="margin: 8px 0 16px 0; color: #666;">${item.descripcion || ''}</p>
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
    if (claimerMsgInput) claimerMsgInput.value = '';
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
        alert('Ocurrió un error al reservar: ' + (err.message || ''));
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
