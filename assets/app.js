const TEL_SAMUEL = '34608761401';
const TEL_MELISSA = '34674843664';

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
  let selectedGiftId = null;

  const searchEl = document.getElementById('search');
  const hideClaimedEl = document.getElementById('hide-claimed');
  const progressCountEl = document.getElementById('progress-count');

  // Modal Reserva Normal
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

  // Modal Sugerencia de Nuevo Regalo
  const suggestModalBackdrop = document.getElementById('suggest-modal-backdrop');
  const btnOpenSuggest = document.getElementById('btn-open-suggest');
  const btnSuggestCancel = document.getElementById('suggest-cancel');
  const btnSuggestConfirm = document.getElementById('suggest-confirm');
  const suggestTitleInput = document.getElementById('suggest-title');
  const suggestDescInput = document.getElementById('suggest-desc');
  const suggestNameInput = document.getElementById('suggest-name');

  // Modal Confirmación Asistencia (RSVP)
  const rsvpModalBackdrop = document.getElementById('rsvp-modal-backdrop');
  const btnOpenRsvp = document.getElementById('btn-open-rsvp');
  const btnRsvpCancel = document.getElementById('rsvp-cancel');
  const btnRsvpConfirm = document.getElementById('rsvp-confirm');
  const rsvpNameInput = document.getElementById('rsvp-name');
  const rsvpCountInput = document.getElementById('rsvp-count');
  const rsvpCommentsInput = document.getElementById('rsvp-comments');

  async function loadGifts() {
    try {
      const { data, error } = await db.from('regalos').select('*').order('id', { ascending: true });
      
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

      regalosList = data.map(item => {
        let reservantes = [];

        if (Array.isArray(item.reservantes)) {
          reservantes = item.reservantes;
        } else if (item.reservado_por) {
          reservantes = item.reservado_por.split(',').map(n => ({ nombre: n.trim() })).filter(n => n.nombre);
        }

        const maxReservas = parseInt(item.max_reservas || item['Maximo reservas'] || 1, 10);
        const estaCompleto = item.reservado || (reservantes.length >= maxReservas);

        return {
          ...item,
          max_reservas: maxReservas,
          reservantes: reservantes,
          estaCompleto: estaCompleto
        };
      });

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
      const matchesClaimed = hideClaimed ? !item.estaCompleto : true;
      return matchesSearch && matchesClaimed;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="loading"><p>No hay regalos que coincidan con la búsqueda 🌸</p></div>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(item => {
      const card = document.createElement('article');
      card.className = `gift-card ${item.estaCompleto ? 'claimed' : ''}`;

      const textWa = encodeURIComponent(`Hola! Tengo una duda sobre el regalo "${item.nombre}" de la lista de Éster 👶`);
      const linkWaSamuel = `https://wa.me/${TEL_SAMUEL}?text=${textWa}`;
      const linkWaMelissa = `https://wa.me/${TEL_MELISSA}?text=${textWa}`;

      let actionHTML = '';
      let badgeHTML = '';

      if (item.max_reservas > 1) {
        const reservasHechas = item.reservantes.length;
        badgeHTML = `<div class="spots-badge" style="display:inline-block; background:#fdf3f5; color:#b87a8b; font-weight:bold; font-size:0.8rem; padding:4px 10px; border-radius:12px; border:1px solid #f2cfd7; margin-bottom:8px;">👥 ${reservasHechas} de ${item.max_reservas} personas han reservado este regalo</div>`;
      }

      if (item.estaCompleto) {
        const nombres = item.reservantes.map(r => r.nombre).join(', ');
        actionHTML = `<span class="tag-claimed">Reservado (${nombres || 'Completo'})</span>`;
      } else {
        const disponibles = item.max_reservas - item.reservantes.length;
        const ctaTexto = item.max_reservas > 1 ? `Reservar un cupo (${disponibles} disp.) 🎁` : `Reservar este regalo 🎁`;
        actionHTML = `<button class="btn-reserve" data-id="${item.id}" data-name="${item.nombre}">${ctaTexto}</button>`;
      }

      card.innerHTML = `
        <div class="gift-card-body" style="padding: 20px; width: 100%;">
          ${badgeHTML}
          <h3 style="margin-top: 0; font-size: 1.25rem;">🎁 ${item.nombre || 'Regalo sin nombre'}</h3>
          <p style="margin: 8px 0 16px 0; color: #666;">${item.descripcion || ''}</p>
          
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <div class="gift-status" style="margin-top:0;">
              ${actionHTML}
            </div>
            <div style="display: flex; gap: 6px;">
              <a href="${linkWaSamuel}" target="_blank" rel="noopener noreferrer" style="background-color: #25D366; color: white; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px;">
                💬 Samuel
              </a>
              <a href="${linkWaMelissa}" target="_blank" rel="noopener noreferrer" style="background-color: #25D366; color: white; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px;">
                💬 Melissa
              </a>
            </div>
          </div>
        </div>
      `;

      listEl.appendChild(card);
    });

    document.querySelectorAll('.btn-reserve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedGiftId = e.target.getAttribute('data-id');
        const giftName = e.target.getAttribute('data-name');
        openModal(giftName);
      });
    });
  }

  function updateProgress() {
    if (!progressCountEl) return;
    const total = regalosList.length;
    const completados = regalosList.filter(r => r.estaCompleto).length;
    progressCountEl.textContent = `${completados} de ${total} regalos completamente reservados 🎀`;
  }

  // --- Lógica del Modal RSVP (Asistencia) ---
  function openRsvpModal() {
    if (rsvpNameInput) rsvpNameInput.value = '';
    if (rsvpCountInput) rsvpCountInput.value = '1';
    if (rsvpCommentsInput) rsvpCommentsInput.value = '';
    if (rsvpModalBackdrop) rsvpModalBackdrop.classList.add('open');
  }

  function closeRsvpModal() {
    if (rsvpModalBackdrop) rsvpModalBackdrop.classList.remove('open');
  }

  if (btnOpenRsvp) btnOpenRsvp.addEventListener('click', openRsvpModal);
  if (btnRsvpCancel) btnRsvpCancel.addEventListener('click', closeRsvpModal);
  if (rsvpModalBackdrop) {
    rsvpModalBackdrop.addEventListener('click', (e) => {
      if (e.target === rsvpModalBackdrop) closeRsvpModal();
    });
  }

  if (btnRsvpConfirm) {
    btnRsvpConfirm.addEventListener('click', async () => {
      const name = rsvpNameInput ? rsvpNameInput.value.trim() : '';
      const count = rsvpCountInput ? parseInt(rsvpCountInput.value, 10) : 1;
      const comments = rsvpCommentsInput ? rsvpCommentsInput.value.trim() : '';

      if (!name) {
        alert('Por favor, introduce tu nombre para confirmar la asistencia.');
        return;
      }

      btnRsvpConfirm.disabled = true;
      btnRsvpConfirm.textContent = 'Guardando...';

      try {
        const { error } = await db.from('asistencias').insert([
          {
            nombre: name,
            asistentes: count,
            comentarios: comments
          }
        ]);

        if (error) throw error;

        closeRsvpModal();
        showToast('¡Asistencia confirmada! Nos vemos pronto 💖');
      } catch (err) {
        console.error('Error al confirmar asistencia:', err);
        alert('Ocurrió un error al guardar tu asistencia: ' + (err.message || ''));
      } finally {
        btnRsvpConfirm.disabled = false;
        btnRsvpConfirm.textContent = 'Confirmar Asistencia ✨';
      }
    });
  }

  // --- Modales Estándar ---
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
    selectedGiftId = null;
  }

  function openSuggestModal() {
    if (suggestTitleInput) suggestTitleInput.value = '';
    if (suggestDescInput) suggestDescInput.value = '';
    if (suggestNameInput) suggestNameInput.value = '';
    if (suggestModalBackdrop) suggestModalBackdrop.classList.add('open');
  }

  function closeSuggestModal() {
    if (suggestModalBackdrop) suggestModalBackdrop.classList.remove('open');
  }

  if (btnOpenSuggest) btnOpenSuggest.addEventListener('click', openSuggestModal);
  if (btnSuggestCancel) btnSuggestCancel.addEventListener('click', closeSuggestModal);
  if (suggestModalBackdrop) {
    suggestModalBackdrop.addEventListener('click', (e) => {
      if (e.target === suggestModalBackdrop) closeSuggestModal();
    });
  }

  if (btnSuggestConfirm) {
    btnSuggestConfirm.addEventListener('click', async () => {
      const title = suggestTitleInput ? suggestTitleInput.value.trim() : '';
      const desc = suggestDescInput ? suggestDescInput.value.trim() : '';
      const name = suggestNameInput ? suggestNameInput.value.trim() : '';
      const finalName = name !== '' ? name : 'Alguien muy especial';

      if (!title) {
        alert('Por favor, indica qué regalo te gustaría añadir.');
        return;
      }

      btnSuggestConfirm.disabled = true;
      btnSuggestConfirm.textContent = 'Guardando...';

      try {
        const payload = {
          nombre: title,
          descripcion: desc || 'Sugerencia añadida por un invitado 💡',
          reservado: true,
          max_reservas: 1,
          reservado_por: finalName,
          reservantes: [{ nombre: finalName }]
        };

        const { error } = await db.from('regalos').insert([payload]);

        if (error) throw error;

        closeSuggestModal();
        showToast('¡Tu regalo ha sido añadido y reservado! 🎁');
        await loadGifts();
      } catch (err) {
        console.error('Error al sugerir regalo:', err);
        alert('Ocurrió un error al guardar tu sugerencia: ' + (err.message || ''));
      } finally {
        btnSuggestConfirm.disabled = false;
        btnSuggestConfirm.textContent = 'Añadir y Reservar 🎁';
      }
    });
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
      if (!selectedGiftId) return;

      const item = regalosList.find(r => String(r.id) === String(selectedGiftId));
      if (!item) return;

      let name = claimerNameInput ? claimerNameInput.value.trim() : '';
      let msg = claimerMsgInput ? claimerMsgInput.value.trim() : '';
      let finalName = name !== '' ? name : 'Alguien muy especial';
      if (msg !== '') finalName += ` ("${msg}")`;

      const nuevosReservantes = [...item.reservantes, { nombre: finalName }];
      const estaCompleto = nuevosReservantes.length >= item.max_reservas;

      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Guardando...';

      try {
        const updatePayload = {
          reservado: estaCompleto,
          reservantes: nuevosReservantes,
          reservado_por: nuevosReservantes.map(r => r.nombre).join(', ')
        };

        const { error } = await db
          .from('regalos')
          .update(updatePayload)
          .eq('id', item.id);

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
