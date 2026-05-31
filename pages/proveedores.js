const ProveedoresPage = {
  async render() {
    UI.setPage(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Proveedores</h1>
          <p class="page-subtitle">Servicios y contactos externos</p>
        </div>
        <button class="btn btn-primary" onclick="ProveedoresPage.openForm()">+ Nuevo Proveedor</button>
      </div>

      <div class="filters-bar">
        <input type="text" id="search-proveedores" placeholder="Buscar por nombre, empresa o servicio..."
          class="filter-input" oninput="ProveedoresPage.filtrar()" />
      </div>

      <div id="proveedores-grid" class="cards-grid">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    `);

    await this.cargarProveedores();
  },

  proveedores: [],

  async cargarProveedores() {
    const { data, error } = await db
      .from('proveedores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { UI.toast('Error al cargar proveedores', 'error'); return; }

    this.proveedores = data || [];
    this.renderGrid(this.proveedores);
  },

  filtrar() {
    const texto = document.getElementById('search-proveedores').value.toLowerCase();

    const filtrados = this.proveedores.filter(p =>
      !texto ||
      p.nombre?.toLowerCase().includes(texto) ||
      p.empresa?.toLowerCase().includes(texto) ||
      p.servicio?.toLowerCase().includes(texto)
    );

    this.renderGrid(filtrados);
  },

  renderGrid(lista) {
    const grid = document.getElementById('proveedores-grid');
    if (!grid) return;

    if (!lista.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🏢</div>
        <p>No hay proveedores aún</p>
        <button class="btn btn-primary btn-sm" onclick="ProveedoresPage.openForm()">+ Agregar proveedor</button>
      </div>`;
      return;
    }

    grid.innerHTML = lista.map(p => `
      <div class="client-card" onclick="ProveedoresPage.verDetalle('${p.id}')">
        <div class="client-card-header">
          <div class="client-avatar">${p.nombre.charAt(0).toUpperCase()}</div>
          <div class="client-info">
            <h3 class="client-name">${p.nombre}</h3>
            <p class="client-empresa">${p.empresa || '—'}</p>
          </div>
          ${p.servicio ? `<span class="badge badge-gold">${p.servicio}</span>` : ''}
        </div>
        <div class="client-card-body">
          ${p.telefono ? `<div class="client-detail"><span>📞</span> ${p.telefono}</div>` : ''}
          ${p.email    ? `<div class="client-detail"><span>✉️</span> ${p.email}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  openForm(proveedor = null) {
    const editar = !!proveedor;
    UI.openModal(`
      <form onsubmit="ProveedoresPage.guardar(event, ${editar ? `'${proveedor.id}'` : 'null'})">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="nombre" required value="${proveedor?.nombre || ''}" placeholder="Nombre completo" />
          </div>
          <div class="form-group">
            <label>Empresa</label>
            <input name="empresa" value="${proveedor?.empresa || ''}" placeholder="Razón social" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input name="telefono" value="${proveedor?.telefono || ''}" placeholder="+52 81 0000 0000" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input name="email" type="email" value="${proveedor?.email || ''}" placeholder="correo@ejemplo.com" />
          </div>
        </div>
        <div class="form-group">
          <label>Servicio</label>
          <input name="servicio" value="${proveedor?.servicio || ''}" placeholder="Ej. Fotografía, Carpintería, Logística" />
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea name="notas" placeholder="Información adicional...">${proveedor?.notas || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editar ? 'Guardar cambios' : 'Crear proveedor'}</button>
        </div>
      </form>
    `, editar ? 'Editar Proveedor' : 'Nuevo Proveedor');
  },

  async guardar(e, id = null) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      nombre:   form.nombre.value.trim(),
      empresa:  form.empresa.value.trim() || null,
      telefono: form.telefono.value.trim() || null,
      email:    form.email.value.trim() || null,
      servicio: form.servicio.value.trim() || null,
      notas:    form.notas.value.trim() || null,
    };

    let error;
    if (id) {
      ({ error } = await db.from('proveedores').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('proveedores').insert(payload));
    }

    if (error) { UI.toast('Error al guardar', 'error'); return; }

    UI.closeModal();
    UI.toast(id ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
    await this.cargarProveedores();
  },

  async verDetalle(id) {
    const proveedor = this.proveedores.find(p => p.id === id);
    if (!proveedor) return;

    UI.openModal(`
      <div class="detalle-header">
        <div class="client-avatar large">${proveedor.nombre.charAt(0).toUpperCase()}</div>
        <div>
          <h2>${proveedor.nombre}</h2>
          <p class="text-muted">${proveedor.empresa || ''}</p>
        </div>
      </div>

      <div class="detalle-grid">
        ${proveedor.telefono ? `<div class="detalle-item"><label>Teléfono</label><span>${proveedor.telefono}</span></div>` : ''}
        ${proveedor.email    ? `<div class="detalle-item"><label>Email</label><span>${proveedor.email}</span></div>` : ''}
        ${proveedor.servicio ? `<div class="detalle-item"><label>Servicio</label><span class="badge badge-gold">${proveedor.servicio}</span></div>` : ''}
      </div>

      ${proveedor.notas ? `<div class="detalle-notas"><label>Notas</label><p>${proveedor.notas}</p></div>` : ''}

      <div class="form-actions">
        <button class="btn btn-danger btn-sm" onclick="ProveedoresPage.eliminar('${proveedor.id}')">Eliminar</button>
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        <button class="btn btn-primary" onclick="UI.closeModal(); ProveedoresPage.openForm(ProveedoresPage.proveedores.find(p=>p.id==='${proveedor.id}'))">Editar</button>
      </div>
    `, proveedor.nombre);
  },

  async eliminar(id) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    const { error } = await db.from('proveedores').delete().eq('id', id);
    if (error) { UI.toast('Error al eliminar', 'error'); return; }
    UI.closeModal();
    UI.toast('Proveedor eliminado', 'success');
    await this.cargarProveedores();
  }
};
