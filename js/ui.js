const UI = {
  // Renderiza contenido en el contenedor principal
  setPage(html) {
    document.getElementById('page-container').innerHTML = html;
  },

  // Modal
  openModal(html, title = '') {
    document.getElementById('modal-content').innerHTML =
      `${title ? `<h2 class="modal-title">${title}</h2>` : ''}${html}`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-content').innerHTML = '';
  },

  // Toast
  toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast-show toast-${type}`;
    setTimeout(() => { t.className = ''; }, 3000);
  },

  // Loading
  loading(container = 'page-container') {
    document.getElementById(container).innerHTML =
      `<div class="loading"><div class="spinner"></div></div>`;
  }
};

// Cerrar modal
document.getElementById('modal-close').addEventListener('click', () => UI.closeModal());
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') UI.closeModal();
});