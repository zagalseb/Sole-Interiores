const OfflineSync = {
  QUEUE_KEY: 'sole_offline_queue',

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  enqueue(tabla, operacion, payload) {
    const queue = this.getQueue();
    queue.push({ id: Date.now(), tabla, operacion, payload, timestamp: new Date().toISOString() });
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  },

  dequeue(id) {
    const queue = this.getQueue().filter(item => item.id !== id);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  },

  async processQueue() {
    const queue = this.getQueue();
    if (!queue.length) return;

    let syncedClientes = false;

    for (const item of queue) {
      try {
        let error;
        if (item.operacion === 'insert') {
          ({ error } = await db.from(item.tabla).insert(item.payload));
        }
        if (!error) {
          this.dequeue(item.id);
          if (item.tabla === 'clientes') syncedClientes = true;
        }
      } catch (e) {
        // Dejar en cola para reintentar
      }
    }

    if (syncedClientes && typeof ClientesPage !== 'undefined') {
      await ClientesPage.cargarClientes();
    }
  },

  init() {
    window.addEventListener('online', () => {
      this.showBanner(false);
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.showBanner(true);
    });

    if (!navigator.onLine) {
      this.showBanner(true);
    } else if (this.getQueue().length > 0) {
      this.processQueue();
    }
  },

  showBanner(offline) {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    if (offline) {
      banner.classList.add('visible');
      document.body.classList.add('offline');
    } else {
      banner.classList.remove('visible');
      document.body.classList.remove('offline');
      if (this.getQueue().length > 0 && typeof UI !== 'undefined') {
        UI.toast('Sincronizando cambios pendientes...', 'info');
      }
    }
  },

  isOnline() {
    return navigator.onLine;
  },

  getPendingCount() {
    return this.getQueue().length;
  },
};
