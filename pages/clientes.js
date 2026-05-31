const ClientesPage = {
  async render() {
    UI.setPage(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Clientes</h1>
          <p class="page-subtitle">Prospectos y clientes activos</p>
        </div>
        <button class="btn btn-primary" onclick="ClientesPage.openForm()">+ Nuevo Cliente</button>
      </div>

      <div class="filters-bar">
        <input type="text" id="search-clientes" placeholder="Buscar por nombre o empresa..." 
          class="filter-input" oninput="ClientesPage.filtrar()" />
        <select id="filter-estado" class="filter-select" onchange="ClientesPage.filtrar()">
          <option value="">Todos los estados</option>
          <option value="Prospecto">Prospecto</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
        <select id="filter-origen" class="filter-select" onchange="ClientesPage.filtrar()">
          <option value="">Todos los orígenes</option>
          <option value="Referido">Referido</option>
          <option value="Redes sociales">Redes sociales</option>
          <option value="Web">Web</option>
          <option value="Llamada fría">Llamada fría</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <div id="clientes-grid" class="cards-grid">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    `);

    await this.cargarClientes();
  },

  clientes: [],

  async cargarClientes() {
    const { data, error } = await db
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { UI.toast('Error al cargar clientes', 'error'); return; }

    this.clientes = data || [];
    this.renderGrid(this.clientes);
  },

  filtrar() {
    const texto = document.getElementById('search-clientes').value.toLowerCase();
    const estado = document.getElementById('filter-estado').value;
    const origen = document.getElementById('filter-origen').value;

    const filtrados = this.clientes.filter(c => {
      const matchTexto = !texto ||
        c.nombre?.toLowerCase().includes(texto) ||
        c.empresa?.toLowerCase().includes(texto);
      const matchEstado = !estado || c.estado === estado;
      const matchOrigen = !origen || c.origen === origen;
      return matchTexto && matchEstado && matchOrigen;
    });

    this.renderGrid(filtrados);
  },

  renderGrid(lista) {
    const grid = document.getElementById('clientes-grid');
    if (!grid) return;

    if (!lista.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👤</div>
        <p>No hay clientes aún</p>
        <button class="btn btn-primary btn-sm" onclick="ClientesPage.openForm()">+ Agregar cliente</button>
      </div>`;
      return;
    }

    grid.innerHTML = lista.map(c => `
      <div class="client-card" onclick="ClientesPage.verDetalle('${c.id}')">
        <div class="client-card-header">
          <div class="client-avatar">${c.nombre.charAt(0).toUpperCase()}</div>
          <div class="client-info">
            <h3 class="client-name">${c.nombre}</h3>
            <p class="client-empresa">${c.empresa || '—'}</p>
          </div>
          <span class="badge ${this.badgeEstado(c.estado)}">${c.estado}</span>
        </div>
        <div class="client-card-body">
          ${c.telefono ? `<div class="client-detail"><span>📞</span> ${c.telefono}</div>` : ''}
          ${c.email    ? `<div class="client-detail"><span>✉️</span> ${c.email}</div>` : ''}
          ${c.zona     ? `<div class="client-detail"><span>📍</span> ${c.zona}</div>` : ''}
          ${c.origen   ? `<div class="client-detail"><span>🔗</span> ${c.origen}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  badgeEstado(estado) {
    return { 'Prospecto': 'badge-gold', 'Activo': 'badge-success', 'Inactivo': 'badge-muted' }[estado] || 'badge-muted';
  },

  openForm(cliente = null) {
    const editar = !!cliente;
    UI.openModal(`
      <form onsubmit="ClientesPage.guardar(event, ${editar ? `'${cliente.id}'` : 'null'})">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="nombre" required value="${cliente?.nombre || ''}" placeholder="Nombre completo" />
          </div>
          <div class="form-group">
            <label>Empresa</label>
            <input name="empresa" value="${cliente?.empresa || ''}" placeholder="Razón social" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input name="telefono" value="${cliente?.telefono || ''}" placeholder="+52 81 0000 0000" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input name="email" type="email" value="${cliente?.email || ''}" placeholder="correo@ejemplo.com" />
          </div>
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input name="direccion" value="${cliente?.direccion || ''}" placeholder="Calle, número, colonia" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Zona</label>
            <input name="zona" value="${cliente?.zona || ''}" placeholder="Ej. Monterrey Norte, CDMX" />
          </div>
          <div class="form-group">
            <label>Origen</label>
            <select name="origen">
              <option value="">— Seleccionar —</option>
              ${['Referido','Redes sociales','Web','Llamada fría','Otro'].map(o =>
                `<option ${cliente?.origen === o ? 'selected' : ''}>${o}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select name="estado">
            ${['Prospecto','Activo','Inactivo'].map(e =>
              `<option ${(cliente?.estado || 'Prospecto') === e ? 'selected' : ''}>${e}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea name="notas" placeholder="Información adicional...">${cliente?.notas || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editar ? 'Guardar cambios' : 'Crear cliente'}</button>
        </div>
      </form>
    `, editar ? 'Editar Cliente' : 'Nuevo Cliente');
  },

  async guardar(e, id = null) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      nombre:    form.nombre.value.trim(),
      empresa:   form.empresa.value.trim() || null,
      telefono:  form.telefono.value.trim() || null,
      email:     form.email.value.trim() || null,
      direccion: form.direccion.value.trim() || null,
      zona:      form.zona.value.trim() || null,
      origen:    form.origen.value || null,
      estado:    form.estado.value,
      notas:     form.notas.value.trim() || null,
    };

    let error;
    if (id) {
      ({ error } = await db.from('clientes').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('clientes').insert(payload));
    }

    if (error) { UI.toast('Error al guardar', 'error'); return; }

    UI.closeModal();
    UI.toast(id ? 'Cliente actualizado' : 'Cliente creado', 'success');
    await this.cargarClientes();
  },

  async verDetalle(id) {
    const cliente = this.clientes.find(c => c.id === id);
    if (!cliente) return;

    // Cargar proyectos del cliente
    const { data: proyectos } = await db
      .from('proyectos')
      .select('id, nombre, etapa, fecha_deadline, presupuesto_estimado')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false });

    const proyectosHtml = proyectos?.length
      ? proyectos.map(p => `
          <div class="detalle-proyecto" onclick="Router.navigate('proyectos'); setTimeout(()=>ProyectosPage.verDetalle('${p.id}'),300)">
            <span>${p.nombre}</span>
            <span class="badge ${ProyectosPage?.badgeEtapa?.(p.etapa) || 'badge-muted'}">${p.etapa}</span>
          </div>`).join('')
      : `<p class="text-muted">Sin proyectos aún</p>`;

    UI.openModal(`
      <div class="detalle-header">
        <div class="client-avatar large">${cliente.nombre.charAt(0).toUpperCase()}</div>
        <div>
          <h2>${cliente.nombre}</h2>
          <p class="text-muted">${cliente.empresa || ''}</p>
        </div>
      </div>

      <div class="detalle-grid">
        ${cliente.telefono  ? `<div class="detalle-item"><label>Teléfono</label><span>${cliente.telefono}</span></div>` : ''}
        ${cliente.email     ? `<div class="detalle-item"><label>Email</label><span>${cliente.email}</span></div>` : ''}
        ${cliente.direccion ? `<div class="detalle-item"><label>Dirección</label><span>${cliente.direccion}</span></div>` : ''}
        ${cliente.zona      ? `<div class="detalle-item"><label>Zona</label><span>${cliente.zona}</span></div>` : ''}
        ${cliente.origen    ? `<div class="detalle-item"><label>Origen</label><span>${cliente.origen}</span></div>` : ''}
        <div class="detalle-item"><label>Estado</label><span class="badge ${this.badgeEstado(cliente.estado)}">${cliente.estado}</span></div>
      </div>

      ${cliente.notas ? `<div class="detalle-notas"><label>Notas</label><p>${cliente.notas}</p></div>` : ''}

      <div class="detalle-section">
        <h4>Proyectos (${proyectos?.length || 0})</h4>
        <div class="detalle-proyectos-list">${proyectosHtml}</div>
      </div>

      <div class="form-actions">
        <button class="btn btn-danger btn-sm" onclick="ClientesPage.eliminar('${cliente.id}')">Eliminar</button>
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        <button class="btn btn-primary" onclick="UI.closeModal(); ClientesPage.openForm(ClientesPage.clientes.find(c=>c.id==='${cliente.id}'))">Editar</button>
      </div>
    `, cliente.nombre);
  },

  async eliminar(id) {
    if (!confirm('¿Eliminar este cliente? Sus proyectos quedarán sin cliente asignado.')) return;
    const { error } = await db.from('clientes').delete().eq('id', id);
    if (error) { UI.toast('Error al eliminar', 'error'); return; }
    UI.closeModal();
    UI.toast('Cliente eliminado', 'success');
    await this.cargarClientes();
  }
};