const Router = {
  currentPage: null,

  init() {
    window.addEventListener('hashchange', () => this.resolve());
    document.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.dataset.page;
        window.location.hash = page;
      });
    });
    this.resolve();
  },

  resolve() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash);
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    const pages = { dashboard: DashboardPage, clientes: ClientesPage, proveedores: ProveedoresPage, proyectos: ProyectosPage };
    const PageModule = pages[page];
    if (PageModule) PageModule.render();
  }
};