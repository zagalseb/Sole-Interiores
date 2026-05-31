if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW registrado'))
      .catch(err => console.warn('SW error:', err));
  });
}

const DashboardPage = {

  render() {
    UI.setPage(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Resumen general</p>
        </div>
      </div>

      <div class="stat-cards" id="dash-stat-cards">
        ${[0,1,2,3].map(() => `<div class="stat-card"><div class="spinner" style="margin:auto"></div></div>`).join('')}
      </div>

      <div class="dashboard-section">
        <h3>Proyectos por etapa</h3>
        <div id="dash-etapas"><div class="loading"><div class="spinner"></div></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" id="dash-bottom-grid">
        <div class="dashboard-section">
          <h3>Tareas e instalaciones próximas</h3>
          <div id="dash-tareas"><div class="loading"><div class="spinner"></div></div></div>
        </div>
        <div class="dashboard-section">
          <h3>Últimos proyectos</h3>
          <div id="dash-proyectos"><div class="loading"><div class="spinner"></div></div></div>
        </div>
      </div>

      <div class="dashboard-section">
        <h3>Accesos rápidos</h3>
        <div class="quick-actions">
          <button class="btn btn-outline" onclick="ClientesPage.openForm()">+ Nuevo Cliente</button>
          <button class="btn btn-outline" onclick="ProveedoresPage.openForm()">+ Nuevo Proveedor</button>
          <button class="btn btn-primary" onclick="Router.navigate('proyectos'); setTimeout(()=>ProyectosPage.openForm(),300)">+ Nuevo Proyecto</button>
        </div>
      </div>
    `);

    this.cargarDatos();
  },

  async cargarDatos() {
    const hoy          = new Date().toISOString().split('T')[0];
    const fechaEn7Dias = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

    const [
      { data: clientes },
      { data: proyectos },
      { data: tareas },
      { data: instalaciones },
    ] = await Promise.all([
      db.from('clientes').select('id, estado'),
      db.from('proyectos').select(`
        id, nombre, etapa, presupuesto_estimado, moneda, fecha_deadline, created_at,
        clientes(nombre)
      `).order('created_at', { ascending: false }),
      db.from('tareas').select(`
        id, titulo, estado, fecha_limite,
        proyectos(id, nombre)
      `).neq('estado', 'Completada').order('fecha_limite', { ascending: true, nullsFirst: false }),
      db.from('instalaciones').select(`
        id, fecha, hora, estado,
        proyectos(id, nombre)
      `)
        .gte('fecha', hoy)
        .lte('fecha', fechaEn7Dias)
        .order('fecha', { ascending: true }),
    ]);

    this.llenarStatCards(clientes || [], proyectos || [], tareas || [], hoy);
    this.llenarEtapas(proyectos || []);
    this.llenarTareas(tareas || [], instalaciones || [], hoy);
    this.llenarProyectos(proyectos || []);
  },

  llenarStatCards(clientes, proyectos, tareas, hoy) {
    const activos    = clientes.filter(c => c.estado === 'Activo').length;
    const enCurso    = proyectos.filter(p => p.etapa === 'Proyecto activo').length;
    const pipeline   = proyectos
      .filter(p => p.etapa === 'Cotización enviada' || p.etapa === 'Proyecto activo')
      .reduce((sum, p) => sum + (p.presupuesto_estimado || 0), 0);
    const vencidas   = tareas.filter(t => t.fecha_limite && t.fecha_limite < hoy).length;

    const pipelineStr = pipeline.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

    document.getElementById('dash-stat-cards').innerHTML = `
      <div class="stat-card">
        <div class="stat-card-icon">👤</div>
        <div class="stat-card-value">${activos}</div>
        <div class="stat-card-label">Clientes activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">🚀</div>
        <div class="stat-card-value">${enCurso}</div>
        <div class="stat-card-label">Proyectos activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">💰</div>
        <div class="stat-card-value" style="font-size:22px">${pipelineStr}</div>
        <div class="stat-card-label">Pipeline estimado</div>
      </div>
      <div class="stat-card ${vencidas > 0 ? 'danger' : ''}">
        <div class="stat-card-icon">⚠️</div>
        <div class="stat-card-value">${vencidas}</div>
        <div class="stat-card-label">Tareas vencidas</div>
      </div>
    `;
  },

  llenarEtapas(proyectos) {
    const etapas = [
      { nombre: 'Cotización enviada',   color: 'var(--gold)' },
      { nombre: 'Proyecto activo',      color: 'var(--success)' },
      { nombre: 'Produciéndose',        color: '#2980b9' },
      { nombre: 'Pendiente a instalar', color: 'var(--warning)' },
      { nombre: 'En pausa',             color: 'var(--text-muted)' },
      { nombre: 'Cerrado ganado',       color: 'var(--success)' },
      { nombre: 'Cerrado perdido',      color: 'var(--danger)' },
    ];

    const conteos = etapas.map(e => ({
      ...e,
      count: proyectos.filter(p => p.etapa === e.nombre).length,
    }));

    const max = Math.max(...conteos.map(e => e.count), 1);

    document.getElementById('dash-etapas').innerHTML = conteos.map(e => `
      <div class="etapa-bar-row" style="cursor:pointer"
        onclick="Router.navigate('proyectos'); setTimeout(()=>{const s=document.getElementById('filter-etapa'); if(s){s.value='${e.nombre}'; ProyectosPage.filtrar();}},300)">
        <span class="etapa-bar-label">${e.nombre}</span>
        <div class="etapa-bar-track">
          <div class="etapa-bar-fill" style="width:${(e.count/max)*100}%;background:${e.color}"></div>
        </div>
        <span class="etapa-bar-count">${e.count}</span>
      </div>`).join('');
  },

  llenarTareas(tareas, instalaciones, hoy) {
    const fechaEn7Dias = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

    const tareasItems = tareas
      .filter(t => !t.fecha_limite || t.fecha_limite <= fechaEn7Dias)
      .map(t => ({ _tipo: 'tarea', _fecha: t.fecha_limite || '', ...t }));

    const instItems = instalaciones
      .map(i => ({ _tipo: 'instalacion', _fecha: i.fecha || '', ...i }));

    const items = [...tareasItems, ...instItems]
      .sort((a, b) => a._fecha.localeCompare(b._fecha));

    if (!items.length) {
      document.getElementById('dash-tareas').innerHTML = `<p class="text-muted">Sin tareas pendientes</p>`;
      return;
    }

    document.getElementById('dash-tareas').innerHTML = `
      <div class="dashboard-list">
        ${items.map(item => {
          if (item._tipo === 'tarea') {
            const vencida  = item.fecha_limite && item.fecha_limite < hoy;
            const fechaStr = item.fecha_limite ? ProyectosPage.formatFecha(item.fecha_limite) : '—';
            const proyId   = item.proyectos?.id;
            const proyNom  = item.proyectos?.nombre || '—';
            return `
              <div class="dashboard-list-item" onclick="Router.navigate('proyectos'); setTimeout(()=>ProyectosPage.verDetalle('${proyId}'),300)">
                <div class="dashboard-item-left">
                  <span class="dashboard-item-title ${vencida ? 'deadline-vencido' : ''}">${vencida ? '⚠️ ' : ''}${item.titulo}</span>
                  <span class="dashboard-item-sub">📁 ${proyNom}</span>
                </div>
                <div class="dashboard-item-right">
                  <span class="text-muted" style="font-size:12px">${fechaStr}</span>
                  <span class="badge ${vencida ? 'badge-danger' : 'badge-gold'}">${vencida ? 'Vencida' : 'Pendiente'}</span>
                </div>
              </div>`;
          } else {
            const fechaStr = item.fecha ? ProyectosPage.formatFecha(item.fecha) : '—';
            const proyId   = item.proyectos?.id;
            const proyNom  = item.proyectos?.nombre || '—';
            return `
              <div class="dashboard-list-item" onclick="Router.navigate('proyectos'); setTimeout(()=>ProyectosPage.verDetalle('${proyId}'),300)">
                <div class="dashboard-item-left">
                  <span class="dashboard-item-title">🔧 Instalación — ${proyNom}</span>
                  <span class="dashboard-item-sub">${item.hora ? `🕐 ${item.hora.slice(0,5)}` : 'Sin hora definida'}</span>
                </div>
                <div class="dashboard-item-right">
                  <span class="text-muted" style="font-size:12px">${fechaStr}</span>
                  <span class="badge badge-warning">Pendiente</span>
                </div>
              </div>`;
          }
        }).join('')}
      </div>`;
  },

  llenarProyectos(proyectos) {
    const recientes = proyectos.slice(0, 5);

    if (!recientes.length) {
      document.getElementById('dash-proyectos').innerHTML = `<p class="text-muted">Sin proyectos aún</p>`;
      return;
    }

    document.getElementById('dash-proyectos').innerHTML = `
      <div class="dashboard-list">
        ${recientes.map(p => {
          const moneda  = p.moneda || 'MXN';
          const monto   = p.presupuesto_estimado != null
            ? ProyectosPage.formatMonto(p.presupuesto_estimado, moneda)
            : '—';
          return `
            <div class="dashboard-list-item" onclick="Router.navigate('proyectos'); setTimeout(()=>ProyectosPage.verDetalle('${p.id}'),300)">
              <div class="dashboard-item-left">
                <span class="dashboard-item-title">${p.nombre}</span>
                <span class="dashboard-item-sub">${p.clientes?.nombre || '—'}</span>
              </div>
              <div class="dashboard-item-right">
                <span class="badge ${ProyectosPage.badgeEtapa(p.etapa)}">${p.etapa}</span>
                <span class="text-muted" style="font-size:12px">${monto}</span>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Router.init();
  OfflineSync.init();
});
