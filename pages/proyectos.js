const ProyectosPage = {
  proyectos: [],
  _clientes: [],
  _proveedores: [],
  _proyectoEnEdicion: null,
  _formDraft: null,
  _instalacionesDetalle: [],

  async render() {
    UI.setPage(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Proyectos</h1>
          <p class="page-subtitle">Todos los proyectos y cotizaciones</p>
        </div>
        <button class="btn btn-primary" onclick="ProyectosPage.openForm()">+ Nuevo Proyecto</button>
      </div>

      <div class="filters-bar">
        <input type="text" id="search-proyectos" placeholder="Buscar por nombre o cliente..."
          class="filter-input" oninput="ProyectosPage.filtrar()" />
        <select id="filter-etapa" class="filter-select" onchange="ProyectosPage.filtrar()">
          <option value="">Todas las etapas</option>
          ${['Cotización enviada','Proyecto activo','Produciéndose','Pendiente a instalar','En pausa','Cerrado ganado','Cerrado perdido']
            .map(e => `<option value="${e}">${e}</option>`).join('')}
        </select>
      </div>

      <div id="proyectos-lista">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    `);

    await this.cargarProyectos();
  },

  async cargarProyectos() {
    const { data, error } = await db
      .from('proyectos')
      .select(`
        *,
        clientes(id, nombre, empresa, zona),
        proyecto_proveedores(proveedor_id, costo, proveedores(id, nombre, servicio))
      `)
      .order('created_at', { ascending: false });

    if (error) { UI.toast('Error al cargar proyectos', 'error'); return; }
    this.proyectos = data || [];
    this.renderLista(this.proyectos);
  },

  filtrar() {
    const texto = document.getElementById('search-proyectos').value.toLowerCase();
    const etapa  = document.getElementById('filter-etapa').value;

    const filtrados = this.proyectos.filter(p => {
      const matchTexto = !texto ||
        p.nombre?.toLowerCase().includes(texto) ||
        p.clientes?.nombre?.toLowerCase().includes(texto) ||
        p.clientes?.empresa?.toLowerCase().includes(texto);
      const matchEtapa = !etapa || p.etapa === etapa;
      return matchTexto && matchEtapa;
    });

    this.renderLista(filtrados);
  },

  renderLista(lista) {
    const cont = document.getElementById('proyectos-lista');
    if (!cont) return;

    if (!lista.length) {
      cont.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📁</div>
        <p>No hay proyectos aún</p>
        <button class="btn btn-primary btn-sm" onclick="ProyectosPage.openForm()">+ Nuevo proyecto</button>
      </div>`;
      return;
    }

    const hoy = new Date().toISOString().split('T')[0];

    cont.innerHTML = lista.map(p => {
      const proveedores = p.proyecto_proveedores?.map(pp => pp.proveedores).filter(Boolean) || [];
      const vencido = p.fecha_deadline && p.fecha_deadline < hoy;
      const moneda  = p.moneda || 'MXN';

      return `
        <div class="proyecto-item" onclick="ProyectosPage.verDetalle('${p.id}')">
          <div class="proyecto-item-header">
            <span class="proyecto-titulo">${p.nombre}</span>
            <span class="badge ${this.badgeEtapa(p.etapa)}">${p.etapa}</span>
          </div>
          <div class="proyecto-meta">
            ${p.clientes ? `<span>👤 ${p.clientes.nombre}${p.clientes.empresa ? ` · ${p.clientes.empresa}` : ''}</span>` : ''}
            ${p.clientes?.zona ? `<span>📍 ${p.clientes.zona}</span>` : ''}
            ${p.presupuesto_estimado != null ? `<span>💰 ${this.formatMonto(p.presupuesto_estimado, moneda)}</span>` : ''}
            ${p.fecha_deadline ? `<span class="${vencido ? 'deadline-vencido' : ''}">${vencido ? '⚠️ ' : '📅 '}${this.formatFecha(p.fecha_deadline)}</span>` : ''}
          </div>
          ${proveedores.length ? `
            <div class="proyecto-proveedores">
              ${proveedores.map(pv => `<span class="proveedor-chip">${pv.nombre}${pv.servicio ? ` · ${pv.servicio}` : ''}</span>`).join('')}
            </div>` : ''}
        </div>`;
    }).join('');
  },

  // ── Selectores ──────────────────────────────────────────────────────────────

  async _cargarSelectores() {
    const [{ data: clientes }, { data: proveedores }] = await Promise.all([
      db.from('clientes').select('id, nombre, empresa').order('nombre'),
      db.from('proveedores').select('id, nombre, servicio').order('nombre'),
    ]);
    this._clientes    = clientes    || [];
    this._proveedores = proveedores || [];
  },

  // ── Formulario principal ─────────────────────────────────────────────────────

  async openForm(proyecto = null, draft = null) {
    this._proyectoEnEdicion = proyecto;
    await this._cargarSelectores();

    const d = draft || {};
    const v = campo => d[campo] !== undefined ? d[campo] : (proyecto?.[campo] ?? '');

    const clienteId  = d.cliente_id !== undefined ? d.cliente_id : (proyecto?.cliente_id || '');
    const etapa      = d.etapa  || proyecto?.etapa  || 'Cotización enviada';
    const moneda     = d.moneda || proyecto?.moneda || 'MXN';
    const provIds    = d.proveedores_ids || (proyecto?.proyecto_proveedores?.map(pp => pp.proveedor_id) || []);
    const costosDraft = d.costos_proveedores || {};

    const etapas  = ['Cotización enviada','Proyecto activo','Produciéndose','Pendiente a instalar','En pausa','Cerrado ganado','Cerrado perdido'];
    const monedas = ['MXN','USD','EUR'];

    UI.openModal(`
      <form onsubmit="ProyectosPage.guardar(event, ${proyecto ? `'${proyecto.id}'` : 'null'})">

        <div class="form-group">
          <label>Nombre del proyecto *</label>
          <input name="nombre" required value="${v('nombre')}" placeholder="Nombre del proyecto" />
        </div>

        <div class="form-group">
          <div class="form-group-header">
            <label>Cliente</label>
            <button type="button" class="btn btn-outline btn-sm" onclick="ProyectosPage.abrirFormClienteRapido()">+ Cliente nuevo</button>
          </div>
          <select name="cliente_id">
            <option value="">— Sin cliente —</option>
            ${this._clientes.map(c =>
              `<option value="${c.id}" ${clienteId === c.id ? 'selected' : ''}>${c.nombre}${c.empresa ? ` · ${c.empresa}` : ''}</option>`
            ).join('')}
          </select>
        </div>

        <div class="form-group">
          <div class="form-group-header">
            <label>Proveedores</label>
            <button type="button" class="btn btn-outline btn-sm" onclick="ProyectosPage.abrirFormProveedorRapido()">+ Proveedor nuevo</button>
          </div>
          <div class="checkboxes-list">
            ${this._proveedores.length
              ? this._proveedores.map(pv => {
                  const costoExistente = costosDraft[pv.id] !== undefined
                    ? costosDraft[pv.id]
                    : (proyecto?.proyecto_proveedores?.find(pp => pp.proveedor_id === pv.id)?.costo ?? '');
                  return `
                    <label class="checkbox-item">
                      <input type="checkbox" name="proveedor" value="${pv.id}" ${provIds.includes(pv.id) ? 'checked' : ''} />
                      <span>${pv.nombre}${pv.servicio ? ` · ${pv.servicio}` : ''}</span>
                      <input type="number" name="costo_prov_${pv.id}" value="${costoExistente}"
                        placeholder="Costo" class="input-costo-prov" step="0.01" min="0" />
                    </label>`;
                }).join('')
              : '<p class="text-muted" style="font-size:13px;padding:8px">Sin proveedores registrados</p>'
            }
          </div>
        </div>

        <div class="form-group">
          <label>Etapa</label>
          <select name="etapa">
            ${etapas.map(e => `<option ${etapa === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>Descripción</label>
          <textarea name="descripcion" placeholder="Descripción general del proyecto...">${v('descripcion')}</textarea>
        </div>

        <div class="form-group">
          <label>Detalles / Especificaciones</label>
          <textarea name="detalles" placeholder="Cantidades, materiales, especificaciones técnicas...">${v('detalles')}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Presupuesto estimado</label>
            <input name="presupuesto_estimado" type="number" step="0.01" min="0" value="${v('presupuesto_estimado')}" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Presupuesto real</label>
            <input name="presupuesto_real" type="number" step="0.01" min="0" value="${v('presupuesto_real')}" placeholder="0.00" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Anticipo recibido</label>
            <input name="anticipo" type="number" step="0.01" min="0" value="${v('anticipo')}" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Moneda</label>
            <select name="moneda">
              ${monedas.map(m => `<option ${moneda === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Fecha inicio</label>
            <input name="fecha_inicio" type="date" value="${v('fecha_inicio')}" />
          </div>
          <div class="form-group">
            <label>Fecha deadline</label>
            <input name="fecha_deadline" type="date" value="${v('fecha_deadline')}" />
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${proyecto ? 'Guardar cambios' : 'Crear proyecto'}</button>
        </div>
      </form>
    `, proyecto ? 'Editar Proyecto' : 'Nuevo Proyecto');

    document.getElementById('modal-box')?.classList.add('modal-wide');
  },

  _leerDraft() {
    const form = document.querySelector('#modal-box form');
    if (!form) return null;
    return {
      nombre:               form.nombre?.value               || '',
      cliente_id:           form.cliente_id?.value           || '',
      etapa:                form.etapa?.value                || '',
      descripcion:          form.descripcion?.value          || '',
      detalles:             form.detalles?.value             || '',
      presupuesto_estimado: form.presupuesto_estimado?.value || '',
      presupuesto_real:     form.presupuesto_real?.value     || '',
      anticipo:             form.anticipo?.value             || '',
      moneda:               form.moneda?.value               || 'MXN',
      fecha_inicio:         form.fecha_inicio?.value         || '',
      fecha_deadline:       form.fecha_deadline?.value       || '',
      proveedores_ids:      Array.from(document.querySelectorAll('input[name="proveedor"]:checked')).map(cb => cb.value),
      costos_proveedores:   Object.fromEntries(
        Array.from(document.querySelectorAll('input[name^="costo_prov_"]'))
          .map(inp => [inp.name.replace('costo_prov_', ''), inp.value])
          .filter(([, v]) => v !== '')
      ),
    };
  },

  // ── Creación rápida: cliente ─────────────────────────────────────────────────

  abrirFormClienteRapido() {
    this._formDraft = this._leerDraft();
    UI.openModal(`
      <form onsubmit="ProyectosPage.guardarClienteRapido(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="nombre" required placeholder="Nombre completo" />
          </div>
          <div class="form-group">
            <label>Empresa</label>
            <input name="empresa" placeholder="Razón social" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input name="telefono" placeholder="+52 81 0000 0000" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input name="email" type="email" placeholder="correo@ejemplo.com" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline"
            onclick="ProyectosPage.openForm(ProyectosPage._proyectoEnEdicion, ProyectosPage._formDraft)">Volver</button>
          <button type="submit" class="btn btn-primary">Crear y seleccionar</button>
        </div>
      </form>
    `, 'Nuevo Cliente');
  },

  async guardarClienteRapido(e) {
    e.preventDefault();
    const form = e.target;
    const { data, error } = await db.from('clientes').insert({
      nombre:   form.nombre.value.trim(),
      empresa:  form.empresa.value.trim()  || null,
      telefono: form.telefono.value.trim() || null,
      email:    form.email.value.trim()    || null,
      estado:   'Prospecto',
    }).select().single();

    if (error) { UI.toast('Error al crear cliente', 'error'); return; }
    UI.toast('Cliente creado', 'success');
    if (this._formDraft) this._formDraft.cliente_id = data.id;
    await this.openForm(this._proyectoEnEdicion, this._formDraft);
  },

  // ── Creación rápida: proveedor ───────────────────────────────────────────────

  abrirFormProveedorRapido() {
    this._formDraft = this._leerDraft();
    UI.openModal(`
      <form onsubmit="ProyectosPage.guardarProveedorRapido(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="nombre" required placeholder="Nombre completo" />
          </div>
          <div class="form-group">
            <label>Empresa</label>
            <input name="empresa" placeholder="Razón social" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input name="telefono" placeholder="+52 81 0000 0000" />
          </div>
          <div class="form-group">
            <label>Servicio</label>
            <input name="servicio" placeholder="Ej. Fotografía, Carpintería" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline"
            onclick="ProyectosPage.openForm(ProyectosPage._proyectoEnEdicion, ProyectosPage._formDraft)">Volver</button>
          <button type="submit" class="btn btn-primary">Crear y seleccionar</button>
        </div>
      </form>
    `, 'Nuevo Proveedor');
  },

  async guardarProveedorRapido(e) {
    e.preventDefault();
    const form = e.target;
    const { data, error } = await db.from('proveedores').insert({
      nombre:   form.nombre.value.trim(),
      empresa:  form.empresa.value.trim()  || null,
      telefono: form.telefono.value.trim() || null,
      servicio: form.servicio.value.trim() || null,
    }).select().single();

    if (error) { UI.toast('Error al crear proveedor', 'error'); return; }
    UI.toast('Proveedor creado', 'success');
    if (this._formDraft) {
      this._formDraft.proveedores_ids = [...(this._formDraft.proveedores_ids || []), data.id];
    }
    await this.openForm(this._proyectoEnEdicion, this._formDraft);
  },

  // ── Guardar proyecto ─────────────────────────────────────────────────────────

  async guardar(e, id = null) {
    e.preventDefault();
    const form = e.target;

    const provIds = Array.from(form.querySelectorAll('input[name="proveedor"]:checked')).map(cb => cb.value);

    const costoTotal = provIds.reduce((sum, pid) => {
      const val = form.querySelector(`input[name="costo_prov_${pid}"]`)?.value;
      return sum + (val ? Number(val) : 0);
    }, 0);

    const payload = {
      nombre:               form.nombre.value.trim(),
      cliente_id:           form.cliente_id.value           || null,
      etapa:                form.etapa.value,
      descripcion:          form.descripcion.value.trim()   || null,
      detalles:             form.detalles.value.trim()      || null,
      presupuesto_estimado: form.presupuesto_estimado.value ? Number(form.presupuesto_estimado.value) : null,
      presupuesto_real:     form.presupuesto_real.value     ? Number(form.presupuesto_real.value)     : null,
      anticipo:             form.anticipo.value             ? Number(form.anticipo.value)             : null,
      costo_proveedores:    costoTotal || null,
      moneda:               form.moneda.value,
      fecha_inicio:         form.fecha_inicio.value         || null,
      fecha_deadline:       form.fecha_deadline.value       || null,
    };

    let proyectoId = id;
    let error;

    if (id) {
      ({ error } = await db.from('proyectos').update(payload).eq('id', id));
    } else {
      const { data, error: err } = await db.from('proyectos').insert(payload).select().single();
      error = err;
      if (data) proyectoId = data.id;
    }

    if (error) { UI.toast('Error al guardar', 'error'); return; }

    await db.from('proyecto_proveedores').delete().eq('proyecto_id', proyectoId);
    if (provIds.length) {
      await db.from('proyecto_proveedores').insert(
        provIds.map(pid => ({
          proyecto_id:  proyectoId,
          proveedor_id: pid,
          costo: form.querySelector(`input[name="costo_prov_${pid}"]`)?.value
            ? Number(form.querySelector(`input[name="costo_prov_${pid}"]`).value)
            : null,
        }))
      );
    }

    UI.closeModal();
    UI.toast(id ? 'Proyecto actualizado' : 'Proyecto creado', 'success');
    await this.cargarProyectos();
  },

  // ── Detalle ──────────────────────────────────────────────────────────────────

  async verDetalle(id) {
    const proyecto = this.proyectos.find(p => p.id === id);
    if (!proyecto) return;

    const [{ data: tareas }, { data: notas }, { data: visitas }, { data: instalaciones }] = await Promise.all([
      db.from('tareas').select('*').eq('proyecto_id', id).order('created_at', { ascending: true }),
      db.from('notas').select('*').eq('proyecto_id', id).order('created_at', { ascending: false }),
      db.from('visitas').select('*').eq('proyecto_id', id).order('fecha', { ascending: false }),
      db.from('instalaciones')
        .select('*, instalacion_proveedores(proveedor_id, proveedores(id, nombre))')
        .eq('proyecto_id', id)
        .order('fecha', { ascending: true }),
    ]);

    this._instalacionesDetalle = instalaciones || [];

    const proveedoresConCosto = proyecto.proyecto_proveedores?.map(pp => ({
      ...pp.proveedores,
      costo: pp.costo,
    })).filter(Boolean) || [];

    const moneda  = proyecto.moneda || 'MXN';
    const hoy     = new Date().toISOString().split('T')[0];
    const vencido = proyecto.fecha_deadline && proyecto.fecha_deadline < hoy;

    const etapas = ['Cotización enviada','Proyecto activo','Produciéndose','Pendiente a instalar','En pausa','Cerrado ganado','Cerrado perdido'];

    // Financiero
    const presEst  = proyecto.presupuesto_estimado;
    const presReal = proyecto.presupuesto_real;
    const anticipo = proyecto.anticipo;

    const costosPvSum = proveedoresConCosto.some(pv => pv.costo != null)
      ? proveedoresConCosto.reduce((sum, pv) => sum + (pv.costo || 0), 0)
      : null;

    const diff     = presEst != null && presReal != null ? presReal - presEst : null;
    const saldo    = presReal != null && anticipo  != null ? presReal - anticipo : null;
    const ganancia = presReal != null && costosPvSum != null && presReal !== 0
      ? ((presReal - costosPvSum) / presReal) * 100
      : null;

    const tieneFinanciero = presEst != null || presReal != null || anticipo != null || costosPvSum != null;

    const financieroHtml = `
      <div class="financiero-grid">
        ${presEst       != null ? `<div class="financiero-item"><label>Presupuesto estimado</label><span>${this.formatMonto(presEst, moneda)}</span></div>` : ''}
        ${presReal      != null ? `<div class="financiero-item"><label>Presupuesto real</label><span>${this.formatMonto(presReal, moneda)}</span></div>` : ''}
        ${anticipo      != null ? `<div class="financiero-item"><label>Anticipo recibido</label><span>${this.formatMonto(anticipo, moneda)}</span></div>` : ''}
        ${saldo         != null ? `<div class="financiero-item"><label>Saldo pendiente</label><span style="color:${saldo > 0 ? 'var(--danger)' : 'var(--success)'}">${this.formatMonto(saldo, moneda)}</span></div>` : ''}
        ${costosPvSum   != null ? `<div class="financiero-item"><label>Costo de proveedores</label><span>${this.formatMonto(costosPvSum, moneda)}</span></div>` : ''}
        ${ganancia      != null ? `<div class="financiero-item"><label>% de ganancia</label><span style="color:${ganancia >= 0 ? 'var(--success)' : 'var(--danger)'}">${ganancia.toFixed(1)}%</span></div>` : ''}
        ${diff          != null ? `<div class="financiero-item full"><label>Diferencia estimado vs real</label><span style="color:${diff > 0 ? 'var(--danger)' : 'var(--success)'}">${diff > 0 ? '+' : ''}${this.formatMonto(diff, moneda)}</span></div>` : ''}
      </div>`;

    // Visitas
    const visitasHtml = visitas?.length
      ? `<div class="visitas-list">${visitas.map(v => `
          <div class="visita-item">
            <span class="visita-fecha">${this.formatFecha(v.fecha)}</span>
            ${v.notas ? `<span class="visita-notas">${v.notas}</span>` : '<span class="visita-notas text-muted">—</span>'}
            <button class="visita-delete" onclick="ProyectosPage.eliminarVisita('${v.id}','${id}')">×</button>
          </div>`).join('')}</div>`
      : `<p class="text-muted">Sin visitas registradas</p>`;

    // Instalaciones
    const instalacionesHtml = this._instalacionesDetalle.length
      ? `<div class="instalaciones-list">${this._instalacionesDetalle.map(inst => {
          const instProvs = inst.instalacion_proveedores?.map(ip => ip.proveedores).filter(Boolean) || [];
          return `
            <div class="instalacion-item">
              <div class="instalacion-header">
                <span class="visita-fecha">${this.formatFecha(inst.fecha)}</span>
                ${inst.hora ? `<span class="text-muted" style="font-size:13px">🕐 ${inst.hora.slice(0,5)}</span>` : ''}
                <span class="badge ${this.badgeInstalacion(inst.estado)}">${inst.estado}</span>
                <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
                  <button class="visita-delete" title="Editar" onclick="ProyectosPage.editarInstalacion('${inst.id}','${id}')">✏️</button>
                  <button class="visita-delete" onclick="ProyectosPage.eliminarInstalacion('${inst.id}','${id}')">×</button>
                </div>
              </div>
              ${instProvs.length ? `
                <div class="instalacion-proveedores">
                  ${instProvs.map(pv => `<span class="proveedor-chip" style="font-size:11px;padding:2px 8px">${pv.nombre}</span>`).join('')}
                </div>` : ''}
              ${inst.notas ? `<p class="instalacion-notas">${inst.notas}</p>` : ''}
            </div>`}).join('')}</div>`
      : `<p class="text-muted">Sin instalaciones</p>`;

    // Tareas
    const tareasHtml = tareas?.length
      ? `<div class="tareas-list">${tareas.map(t => `
          <div class="tarea-item">
            <input type="checkbox" class="tarea-check" ${t.estado === 'Completada' ? 'checked' : ''}
              onchange="ProyectosPage.toggleTarea('${t.id}','${t.estado}','${id}')" />
            <span class="${t.estado === 'Completada' ? 'tarea-completada' : ''}" style="flex:1">${t.titulo}</span>
            ${t.fecha_limite ? `<span class="text-muted" style="font-size:12px">${this.formatFecha(t.fecha_limite)}</span>` : ''}
            <button type="button"
              style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:0 4px"
              onclick="ProyectosPage.eliminarTarea('${t.id}','${id}')">×</button>
          </div>`).join('')}</div>`
      : `<p class="text-muted">Sin tareas</p>`;

    // Notas
    const notasHtml = notas?.length
      ? notas.map(n => `
          <div class="nota-item">
            <p>${n.contenido}</p>
            <p class="nota-fecha">${new Date(n.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
          </div>`).join('')
      : `<p class="text-muted">Sin notas</p>`;

    UI.openModal(`
      <div class="detalle-header" style="flex-wrap:wrap;gap:10px;align-items:flex-start">
        <div style="flex:1;min-width:180px">
          <h2 style="margin-bottom:10px">${proyecto.nombre}</h2>
          <select class="filter-select" style="font-size:13px;width:100%"
            onchange="ProyectosPage.cambiarEtapa('${id}', this.value)">
            ${etapas.map(e => `<option ${proyecto.etapa === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <span class="badge ${this.badgeEtapa(proyecto.etapa)}" id="badge-etapa-detalle">${proyecto.etapa}</span>
      </div>

      <div class="detalle-grid" style="margin-top:16px">
        ${proyecto.clientes ? `<div class="detalle-item"><label>Cliente</label><span>${proyecto.clientes.nombre}${proyecto.clientes.empresa ? ` · ${proyecto.clientes.empresa}` : ''}</span></div>` : ''}
        ${proyecto.clientes?.zona ? `<div class="detalle-item"><label>Zona</label><span>${proyecto.clientes.zona}</span></div>` : ''}
        ${proyecto.fecha_inicio   ? `<div class="detalle-item"><label>Inicio</label><span>${this.formatFecha(proyecto.fecha_inicio)}</span></div>` : ''}
        ${proyecto.fecha_deadline ? `<div class="detalle-item"><label>Deadline</label><span class="${vencido ? 'deadline-vencido' : ''}">${vencido ? '⚠️ ' : ''}${this.formatFecha(proyecto.fecha_deadline)}</span></div>` : ''}
      </div>

      ${tieneFinanciero ? `
        <div style="margin-bottom:16px">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:8px">Financiero</p>
          ${financieroHtml}
        </div>` : ''}

      ${proveedoresConCosto.length ? `
        <div style="margin-bottom:16px">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:6px">Proveedores</p>
          <div class="proyecto-proveedores">
            ${proveedoresConCosto.map(pv => `
              <span class="proveedor-chip">${pv.nombre}${pv.servicio ? ` · ${pv.servicio}` : ''}${pv.costo != null ? ` — ${this.formatMonto(pv.costo, moneda)}` : ''}</span>`).join('')}
          </div>
        </div>` : ''}

      ${proyecto.descripcion ? `<div class="detalle-notas" style="margin-bottom:12px"><label>Descripción</label><p>${proyecto.descripcion}</p></div>` : ''}
      ${proyecto.detalles    ? `<div class="detalle-notas" style="margin-bottom:12px"><label>Detalles</label><p>${proyecto.detalles}</p></div>`       : ''}

      <div class="detalle-section" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4>Instalaciones (${this._instalacionesDetalle.length})</h4>
          <button class="btn btn-outline btn-sm" onclick="ProyectosPage.abrirFormInstalacion('${id}')">+ Instalación</button>
        </div>
        ${instalacionesHtml}
      </div>

      <div class="detalle-section" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4>Visitas (${visitas?.length || 0})</h4>
          <button class="btn btn-outline btn-sm" onclick="ProyectosPage.abrirFormVisita('${id}')">+ Visita</button>
        </div>
        ${visitasHtml}
      </div>

      <div class="detalle-section" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4>Tareas (${tareas?.length || 0})</h4>
          <button class="btn btn-outline btn-sm" onclick="ProyectosPage.abrirFormTarea('${id}')">+ Tarea</button>
        </div>
        ${tareasHtml}
      </div>

      <div class="detalle-section">
        <h4 style="margin-bottom:10px">Notas (${notas?.length || 0})</h4>
        <div class="notas-list">${notasHtml}</div>
        <div class="nota-form">
          <textarea id="nota-input" placeholder="Escribe una nota..."></textarea>
          <button class="btn btn-primary btn-sm" onclick="ProyectosPage.guardarNota('${id}')">Guardar nota</button>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-danger btn-sm" onclick="ProyectosPage.eliminar('${id}')">Eliminar</button>
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        <button class="btn btn-primary" onclick="UI.closeModal(); ProyectosPage.openForm(ProyectosPage.proyectos.find(p=>p.id==='${id}'))">Editar</button>
      </div>
    `, proyecto.nombre);
  },

  async cambiarEtapa(id, etapa) {
    const { error } = await db.from('proyectos').update({ etapa }).eq('id', id);
    if (error) { UI.toast('Error al actualizar etapa', 'error'); return; }
    const p = this.proyectos.find(p => p.id === id);
    if (p) p.etapa = etapa;
    const badge = document.getElementById('badge-etapa-detalle');
    if (badge) { badge.className = `badge ${this.badgeEtapa(etapa)}`; badge.textContent = etapa; }
    UI.toast('Etapa actualizada', 'success');
    this.renderLista(this.proyectos);
  },

  // ── Instalaciones ────────────────────────────────────────────────────────────

  _buildFormInstalacion(proyectoId, instalacion = null) {
    const hoy = new Date().toISOString().split('T')[0];
    const proyecto = this.proyectos.find(p => p.id === proyectoId);
    const proveedores = proyecto?.proyecto_proveedores?.map(pp => pp.proveedores).filter(Boolean) || [];
    const instProvIds = instalacion?.instalacion_proveedores?.map(ip => ip.proveedor_id) || [];
    const estados = ['Pendiente a confirmar', 'Confirmada', 'Por completar', 'Terminada'];
    const estadoActual = instalacion?.estado || 'Pendiente a confirmar';
    const esEdicion = !!instalacion;

    return `
      <form onsubmit="ProyectosPage.guardarInstalacion(event, '${proyectoId}', ${esEdicion ? `'${instalacion.id}'` : 'null'})">
        <div class="form-row">
          <div class="form-group">
            <label>Fecha *</label>
            <input name="fecha" type="date" required value="${instalacion?.fecha || hoy}" />
          </div>
          <div class="form-group">
            <label>Hora</label>
            <input name="hora" type="time" value="${instalacion?.hora?.slice(0,5) || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select name="estado">
            ${estados.map(e => `<option ${estadoActual === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        ${proveedores.length ? `
          <div class="form-group">
            <label>Proveedores asignados</label>
            <div class="checkboxes-list">
              ${proveedores.map(pv => `
                <label class="checkbox-item">
                  <input type="checkbox" name="inst_proveedor" value="${pv.id}" ${instProvIds.includes(pv.id) ? 'checked' : ''} />
                  <span>${pv.nombre}${pv.servicio ? ` · ${pv.servicio}` : ''}</span>
                </label>`).join('')}
            </div>
          </div>` : ''}
        <div class="form-group">
          <label>Notas</label>
          <textarea name="notas" placeholder="Observaciones de la instalación...">${instalacion?.notas || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline"
            onclick="ProyectosPage.verDetalle('${proyectoId}')">Volver</button>
          <button type="submit" class="btn btn-primary">${esEdicion ? 'Guardar cambios' : 'Registrar instalación'}</button>
        </div>
      </form>`;
  },

  abrirFormInstalacion(proyectoId) {
    UI.openModal(this._buildFormInstalacion(proyectoId), 'Nueva Instalación');
  },

  editarInstalacion(instalacionId, proyectoId) {
    const instalacion = this._instalacionesDetalle.find(i => i.id === instalacionId);
    if (!instalacion) return;
    UI.openModal(this._buildFormInstalacion(proyectoId, instalacion), 'Editar Instalación');
  },

  async guardarInstalacion(e, proyectoId, instalacionId = null) {
    e.preventDefault();
    const form = e.target;

    const payload = {
      proyecto_id: proyectoId,
      fecha:       form.fecha.value,
      hora:        form.hora.value || null,
      estado:      form.estado.value,
      notas:       form.notas.value.trim() || null,
    };

    let instalId = instalacionId;
    let error;

    if (instalacionId) {
      ({ error } = await db.from('instalaciones').update(payload).eq('id', instalacionId));
    } else {
      const { data, error: err } = await db.from('instalaciones').insert(payload).select().single();
      error = err;
      if (data) instalId = data.id;
    }

    if (error) { UI.toast('Error al guardar instalación', 'error'); return; }

    const provIds = Array.from(form.querySelectorAll('input[name="inst_proveedor"]:checked')).map(cb => cb.value);
    await db.from('instalacion_proveedores').delete().eq('instalacion_id', instalId);
    if (provIds.length) {
      await db.from('instalacion_proveedores').insert(
        provIds.map(pid => ({ instalacion_id: instalId, proveedor_id: pid }))
      );
    }

    UI.toast(instalacionId ? 'Instalación actualizada' : 'Instalación registrada', 'success');
    await this.verDetalle(proyectoId);
  },

  async eliminarInstalacion(instalacionId, proyectoId) {
    if (!confirm('¿Eliminar esta instalación?')) return;
    await db.from('instalacion_proveedores').delete().eq('instalacion_id', instalacionId);
    const { error } = await db.from('instalaciones').delete().eq('id', instalacionId);
    if (error) { UI.toast('Error al eliminar', 'error'); return; }
    await this.verDetalle(proyectoId);
  },

  // ── Visitas ──────────────────────────────────────────────────────────────────

  abrirFormVisita(proyectoId) {
    const hoy = new Date().toISOString().split('T')[0];
    UI.openModal(`
      <form onsubmit="ProyectosPage.guardarVisita(event, '${proyectoId}')">
        <div class="form-group">
          <label>Fecha *</label>
          <input name="fecha" type="date" required value="${hoy}" />
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea name="notas" placeholder="Observaciones de la visita..."></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline"
            onclick="ProyectosPage.verDetalle('${proyectoId}')">Volver</button>
          <button type="submit" class="btn btn-primary">Registrar visita</button>
        </div>
      </form>
    `, 'Nueva Visita');
  },

  async guardarVisita(e, proyectoId) {
    e.preventDefault();
    const form = e.target;
    const { error } = await db.from('visitas').insert({
      proyecto_id: proyectoId,
      fecha:       form.fecha.value,
      notas:       form.notas.value.trim() || null,
    });
    if (error) { UI.toast('Error al registrar visita', 'error'); return; }
    UI.toast('Visita registrada', 'success');
    await this.verDetalle(proyectoId);
  },

  async eliminarVisita(visitaId, proyectoId) {
    if (!confirm('¿Eliminar esta visita?')) return;
    const { error } = await db.from('visitas').delete().eq('id', visitaId);
    if (error) { UI.toast('Error al eliminar', 'error'); return; }
    await this.verDetalle(proyectoId);
  },

  // ── Tareas ───────────────────────────────────────────────────────────────────

  abrirFormTarea(proyectoId) {
    UI.openModal(`
      <form onsubmit="ProyectosPage.guardarTarea(event, '${proyectoId}')">
        <div class="form-group">
          <label>Título *</label>
          <input name="titulo" required placeholder="Descripción de la tarea" />
        </div>
        <div class="form-group">
          <label>Fecha límite</label>
          <input name="fecha_limite" type="date" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline"
            onclick="ProyectosPage.verDetalle('${proyectoId}')">Volver</button>
          <button type="submit" class="btn btn-primary">Agregar tarea</button>
        </div>
      </form>
    `, 'Nueva Tarea');
  },

  async guardarTarea(e, proyectoId) {
    e.preventDefault();
    const form = e.target;
    const { error } = await db.from('tareas').insert({
      proyecto_id:  proyectoId,
      titulo:       form.titulo.value.trim(),
      estado:       'Pendiente',
      fecha_limite: form.fecha_limite.value || null,
    });
    if (error) { UI.toast('Error al crear tarea', 'error'); return; }
    UI.toast('Tarea agregada', 'success');
    await this.verDetalle(proyectoId);
  },

  async toggleTarea(tareaId, estadoActual, proyectoId) {
    const nuevoEstado = estadoActual === 'Completada' ? 'Pendiente' : 'Completada';
    const { error } = await db.from('tareas').update({ estado: nuevoEstado }).eq('id', tareaId);
    if (error) { UI.toast('Error al actualizar', 'error'); return; }
    await this.verDetalle(proyectoId);
  },

  async eliminarTarea(tareaId, proyectoId) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const { error } = await db.from('tareas').delete().eq('id', tareaId);
    if (error) { UI.toast('Error al eliminar', 'error'); return; }
    await this.verDetalle(proyectoId);
  },

  // ── Notas ────────────────────────────────────────────────────────────────────

  async guardarNota(proyectoId) {
    const input    = document.getElementById('nota-input');
    const contenido = input?.value.trim();
    if (!contenido) return;
    const { error } = await db.from('notas').insert({ proyecto_id: proyectoId, contenido });
    if (error) { UI.toast('Error al guardar nota', 'error'); return; }
    UI.toast('Nota guardada', 'success');
    await this.verDetalle(proyectoId);
  },

  // ── Eliminar proyecto ────────────────────────────────────────────────────────

  async eliminar(id) {
    if (!confirm('¿Eliminar este proyecto? Se eliminarán también sus tareas, notas, visitas e instalaciones.')) return;
    await Promise.all([
      db.from('tareas').delete().eq('proyecto_id', id),
      db.from('notas').delete().eq('proyecto_id', id),
      db.from('visitas').delete().eq('proyecto_id', id),
      db.from('instalaciones').delete().eq('proyecto_id', id),
      db.from('proyecto_proveedores').delete().eq('proyecto_id', id),
    ]);
    const { error } = await db.from('proyectos').delete().eq('id', id);
    if (error) { UI.toast('Error al eliminar', 'error'); return; }
    UI.closeModal();
    UI.toast('Proyecto eliminado', 'success');
    await this.cargarProyectos();
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────

  badgeEtapa(etapa) {
    return {
      'Cotización enviada':   'badge-gold',
      'Proyecto activo':      'badge-success',
      'Produciéndose':        'badge-info',
      'Pendiente a instalar': 'badge-warning',
      'En pausa':             'badge-muted',
      'Cerrado ganado':       'badge-success',
      'Cerrado perdido':      'badge-danger',
    }[etapa] || 'badge-muted';
  },

  badgeInstalacion(estado) {
    return {
      'Pendiente a confirmar': 'badge-warning',
      'Confirmada':            'badge-info',
      'Por completar':         'badge-gold',
      'Terminada':             'badge-success',
    }[estado] || 'badge-muted';
  },

  formatFecha(fecha) {
    if (!fecha) return '—';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  },

  formatMonto(monto, moneda = 'MXN') {
    if (monto == null) return '—';
    return Number(monto).toLocaleString('es-MX', { style: 'currency', currency: moneda });
  },
};
