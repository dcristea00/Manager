// /app.js — versión final

// ================== Helpers DOM ==================
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
const on = (el, ev, cb) => el && el.addEventListener(ev, cb, { passive: true });
const escapeHtml = (s) => (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

// ================== API endpoints ==================
const API = {
  obras: '/.netlify/functions/obras',
  items: '/.netlify/functions/items',
  photos: '/.netlify/functions/obra_photos',
};

async function apiGet(url, params) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await fetch(url + q, { cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiSend(url, method, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ================== APIs de dominio ==================
// Obras
const listObras = () => apiGet(API.obras);
const createObra = (data) => apiSend(API.obras, 'POST', data);
const updateObra = (id, data) => apiSend(API.obras, 'PUT', { id, ...data });
const deleteObra = (id) => apiSend(API.obras, 'DELETE', { id });

// Items
const listItems = (params = {}) => apiGet(API.items, params);
const createItem = (data) => apiSend(API.items, 'POST', data);
const updateItem = (id, data) => apiSend(API.items, 'PUT', { id, ...data });
const deleteItemApi = (id) => apiSend(API.items, 'DELETE', { id });

// Fotos de obra (DB)
// app.js — reemplaza SOLO este bloque PhotoAPI por el de abajo
const PhotoAPI = {
  async get(obraId) {
    const id = encodeURIComponent(String(obraId));
    const r = await fetch(`${API.photos}?obra_id=${id}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) {
      const t = await r.text().catch(()=>'');
      throw new Error(`GET foto ${id}: ${t || r.status}`);
    }
    return r.json();
  },
  async save(obraId, dataURL) {
    const body = { obra_id: String(obraId), data: dataURL };
    const r = await fetch(API.photos, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(()=>'');
      throw new Error(`SAVE foto ${obraId}: ${t || r.status}`);
    }
    return r.json();
  },
  async delete(obraId) {
    const id = encodeURIComponent(String(obraId));
    const r = await fetch(`${API.photos}?obra_id=${id}`, { method: 'DELETE' });
    if (!(r.ok || r.status === 204)) {
      const t = await r.text().catch(()=>'');
      throw new Error(`DELETE foto ${obraId}: ${t || r.status}`);
    }
    return true;
  },
};


// ================== Estado/UI refs ==================
const $ = {
  obraSelect: qs('#obraSelect'),
  nuevaObraBtn: qs('#nuevaObraBtn'),
  editObraBtn: qs('#editObraBtn'),
  deleteObraBtn: qs('#deleteObraBtn'),
  alert: qs('#alertContainer'),
  themeToggleBtn: qs('#themeToggleBtn'),
  themeIcon: qs('#themeIcon'),
  views: {
    inicio: qs('#view-inicio'),
    anadir: qs('#view-anadir'),
    inventario: qs('#view-inventario'),
    categorias: qs('#view-categorias'),
    precios: qs('#view-precios'),
    datos: qs('#view-datos'),
  },
  tabs: {
    inicio: qs('#nav-inicio'),
    anadir: qs('#nav-anadir'),
    inventario: qs('#nav-inventario'),
    categorias: qs('#nav-categorias'),
    precios: qs('#nav-precios'),
    datos: qs('#nav-datos'),
  },
  // INICIO
  inicioGrid: qs('#inicioGrid'),

  // AÑADIR
  itemForm: qs('#itemForm'),
  itemNombre: qs('#itemNombre'),
  itemCategoria: qs('#itemCategoria'),
  itemSubtipo: qs('#itemSubtipo'),
  itemMarca: qs('#itemMarca'),
  itemMarcaNueva: qs('#itemMarcaNueva'),
  marcaNuevaWrap: qs('#marcaNuevaWrap'),
  itemCantidad: qs('#itemCantidad'),
  itemUbicacion: qs('#itemUbicacion'),
  itemObservaciones: qs('#itemObservaciones'),

  // INVENTARIO
  obraInfo: qs('#obraInfo'),
  tableBody: qs('#tableBody'),
  visibleCount: qs('#visibleCount'),
  totalCount: qs('#totalCount'),

  // CATEGORÍAS
  catObra: qs('#catObra'),
  catCategoria: qs('#catCategoria'),
  catSubtipo: qs('#catSubtipo'),
  catMarca: qs('#catMarca'),
  catSummary: qs('#catSummary'),
  catResults: qs('#catResults'),

  // MODAL OBRAS
  obraModal: qs('#obraModal'),
  obraForm: qs('#obraForm'),
  obraModalTitle: qs('#obraModalTitle'),
  obraNombre: qs('#obraNombre'),
  obraNombreError: qs('#obraNombre-error'),
  obraDeleteBtn: qs('#obraDeleteBtn'),
  obraCancelBtn: qs('#obraCancelBtn'),
  obraSubmitBtn: qs('#obraSubmitBtn'),
};

const state = {
  obras: [],
  items: [],
  selectedObraId: localStorage.getItem('selectedObraId') || null,
  nameIndex: new Map(),
  brands: new Set(),
};

// ================== Router ==================
function ensureDefaultRoute() {
  if (!location.hash) location.hash = '#inicio';
}
function setActiveTab(hash) {
  Object.values($.tabs).forEach(a => a?.classList.remove('active'));
  const key = (hash || '#inicio').replace('#', '');
  $.tabs[key]?.classList.add('active');
}
function setActiveView(hash) {
  Object.values($.views).forEach(v => v?.classList.add('hidden'));
  const key = (hash || '#inicio').replace('#', '');
  $.views[key]?.classList.remove('hidden');
}
on(window, 'hashchange', () => {
  setActiveTab(location.hash);
  setActiveView(location.hash);
  if (location.hash === '#inventario') renderInventario();
  if (location.hash === '#inicio') renderInicio();
  if (location.hash === '#anadir') prepareAnadir();
  if (location.hash === '#categorias') renderCategorias();
  if (location.hash === '#datos') renderDatos();
});

// Ocultar “Precios”
function hidePrecios() {
  $.tabs.precios?.classList.add('hidden');
  $.views.precios?.classList.add('hidden');
}

// ================== Bootstrap ==================
async function bootstrap() {
  ensureDefaultRoute();
  hidePrecios();

  await refreshObras();
  await refreshItems();

  bindHeader();
  initThemeToggle();
  initAnadirAutocompletar();
  initCategoriasFilters();

  setActiveTab(location.hash);
  setActiveView(location.hash);

  if (location.hash === '#inventario') renderInventario();
  if (location.hash === '#inicio') renderInicio();
  if (location.hash === '#datos') renderDatos();
}

async function refreshObras() {
  state.obras = await listObras();
  fillObraSelect();
}
async function refreshItems() {
  state.items = await listItems();
  rebuildIndexes();
}

// ================== Header / Obras ==================
function fillObraSelect() {
  $.obraSelect.innerHTML = '';
  for (const o of state.obras) {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.nombre;
    $.obraSelect.appendChild(opt);
  }
  if (state.selectedObraId && state.obras.some(o => String(o.id) === String(state.selectedObraId))) {
    $.obraSelect.value = state.selectedObraId;
  } else if (state.obras[0]) {
    state.selectedObraId = String(state.obras[0].id);
    $.obraSelect.value = state.selectedObraId;
    localStorage.setItem('selectedObraId', state.selectedObraId);
  }
}
on($.obraSelect, 'change', () => {
  state.selectedObraId = $.obraSelect.value || null;
  localStorage.setItem('selectedObraId', state.selectedObraId || '');
  if (location.hash === '#inventario') renderInventario();
  if (location.hash === '#categorias') renderCategorias();
});

function bindHeader() {
  on($.nuevaObraBtn, 'click', () => openObraModal());
  on($.editObraBtn, 'click', () => {
    const o = currentObra();
    if (o) openObraModal(o);
  });
  on($.deleteObraBtn, 'click', async () => {
    const o = currentObra();
    if (!o) return;
    if (!confirm(`¿Eliminar la obra "${o.nombre}" y sus ítems?`)) return;
    try {
      await deleteObra(o.id);
      await refreshObras();
      await refreshItems();
      alertMsg('Obra eliminada.');
      renderInicio();
      if (location.hash === '#inventario') renderInventario();
      if (location.hash === '#categorias') renderCategorias();
      if (!state.obras.length) location.hash = '#inicio';
    } catch (e) {
      alertMsg('No se pudo eliminar la obra: ' + e.message, 'error');
    }
  });
}

function currentObra() {
  return state.obras.find(o => String(o.id) === String(state.selectedObraId)) || null;
}

function openObraModal(obra = null) {
  $.obraForm.reset();
  $.obraDeleteBtn.classList.toggle('hidden', !obra);
  $.obraModalTitle.textContent = obra ? 'Editar Obra' : 'Nueva Obra';
  $.obraNombre.value = obra?.nombre || '';
  $.obraNombreError.textContent = '';
  $.obraModal.showModal();

  const close = () => $.obraModal.close();
  qsa('.close-btn', $.obraModal).forEach(b => on(b, 'click', close));

  $.obraDeleteBtn.onclick = async () => {
    if (!obra) return;
    if (!confirm(`¿Eliminar "${obra.nombre}"?`)) return;
    try {
      await deleteObra(obra.id);
      await refreshObras();
      await refreshItems();
      close(); alertMsg('Obra eliminada.');
    } catch (e) { alertMsg('Error eliminando obra: ' + e.message, 'error'); }
  };

  $.obraForm.onsubmit = async (ev) => {
    ev.preventDefault();
    const nombre = $.obraNombre.value.trim();
    if (!nombre) { $.obraNombreError.textContent = 'Requerido'; return; }
    try {
      if (obra) await updateObra(obra.id, { nombre });
      else await createObra({ nombre });
      await refreshObras();
      close(); alertMsg('Obra guardada.');
    } catch (e) { alertMsg('Error guardando obra: ' + e.message, 'error'); }
  };
}

// ================== Inicio (fotos DB + quitar + resize) ==================
/*
async function renderInicio() {
  const grid = $.inicioGrid;
  if (!grid) return;
  grid.innerHTML = '';

  for (const obra of state.obras) {
    const card = document.createElement('div');
    card.className = 'card-obra';

    const img = document.createElement('img');
    img.alt = obra.nombre;
    img.src = placeholderFromName(obra.nombre);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = obra.nombre;

    const actions = document.createElement('div');
    actions.className = 'row';
    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn ghost change';
    changeBtn.title = 'Cambiar foto';
    changeBtn.innerHTML = `<svg class="i"><use href="#i-camera"/></svg>`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn danger ghost';
    removeBtn.title = 'Quitar foto';
    removeBtn.innerHTML = `<svg class="i"><use href="#i-trash"/></svg>`;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.style.display = 'none';

    changeBtn.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const dataURL = await resizeToMax(f, 1280); // reduce tamaño antes de guardar // why: ahorro de espacio/transferencia
        await PhotoAPI.save(obra.id, dataURL);
        img.src = dataURL;
        alertMsg('Foto actualizada.');
      } catch (e) {
        alertMsg('No se pudo guardar la foto: ' + e.message, 'error');
      }
    };

    removeBtn.onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm('¿Quitar foto de esta obra?')) return;
      try {
        await PhotoAPI.delete(obra.id);
        img.src = placeholderFromName(obra.nombre);
        alertMsg('Foto eliminada.');
      } catch (e) {
        alertMsg('No se pudo eliminar la foto: ' + e.message, 'error');
      }
    };

    actions.appendChild(changeBtn);
    actions.appendChild(removeBtn);

    card.onclick = (e) => {
      if (e.target.closest('.change') || e.target.closest('.btn')) return;
      state.selectedObraId = String(obra.id);
      localStorage.setItem('selectedObraId', state.selectedObraId);
      $.obraSelect.value = state.selectedObraId;
      location.hash = '#inventario';
    };

    card.append(img, actions, meta, file);
    grid.appendChild(card);

    // Hidratar con última foto desde DB
    try {
      const p = await PhotoAPI.get(obra.id);
      if (p?.data) img.src = p.data;
    } catch { // placeholder  }
  }
}
*/
// Reemplaza SOLO el bloque renderInicio() por este nuevo:

// -- renderInicio() robusto para ratón y táctil (no navega al pulsar cámara / quitar) --
async function renderInicio() {
  const grid = document.querySelector('#inicioGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let suppressNav = false; // evita navegación al abrir el selector/operar botones

  for (const obra of state.obras) {
    const card = document.createElement('div');
    card.className = 'card-obra';

    const img = document.createElement('img');
    img.alt = obra.nombre;
    img.src = placeholderFromName(obra.nombre);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = obra.nombre;

    const actions = document.createElement('div');
    actions.className = 'row';

    const changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.className = 'btn ghost change';
    changeBtn.title = 'Cambiar foto';
    changeBtn.innerHTML = `<svg class="i"><use href="#i-camera"/></svg>`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn danger ghost';
    removeBtn.title = 'Quitar foto';
    removeBtn.innerHTML = `<svg class="i"><use href="#i-trash"/></svg>`;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.style.display = 'none';

    // ===== Prevención de navegación en táctil/ratón =====
    const markSuppress = (e) => { suppressNav = true; e.stopPropagation(); };
    ['pointerdown','touchstart','mousedown'].forEach(ev => {
      changeBtn.addEventListener(ev, markSuppress, { passive: true });
      removeBtn.addEventListener(ev, markSuppress, { passive: true });
      file.addEventListener(ev, markSuppress, { passive: true });
    });

    // Abrir selector (no preventDefault; solo evitar burbujeo)
    changeBtn.addEventListener('click', (e) => { suppressNav = true; e.stopPropagation(); file.click(); });

    // Importantísimo: NO llamar preventDefault en el input file; en desktop lo bloquea
    file.addEventListener('click', (e) => { suppressNav = true; e.stopPropagation(); });

    file.addEventListener('change', async (e) => {
      e.stopPropagation();
      const f = file.files?.[0];
      if (!f) { // el usuario canceló; permitir navegación de nuevos clics
        setTimeout(() => { suppressNav = false; }, 0);
        return;
      }
      try {
        const dataURL = await resizeToMax(f, 1280);
        await PhotoAPI.save(String(obra.id), dataURL);
        img.src = dataURL;
        alertMsg('Foto actualizada.');
      } catch (err) {
        alertMsg('No se pudo guardar la foto: ' + err.message, 'error');
      } finally {
        file.value = '';
        // pequeña demora para evitar que el click fantasma de iOS dispare navegación
        setTimeout(() => { suppressNav = false; }, 300);
      }
    });

    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (!confirm('¿Quitar foto de esta obra?')) { suppressNav = false; return; }
        await PhotoAPI.delete(String(obra.id));
        img.src = placeholderFromName(obra.nombre);
        alertMsg('Foto eliminada.');
      } catch (err) {
        alertMsg('No se pudo eliminar la foto: ' + err.message, 'error');
      } finally {
        setTimeout(() => { suppressNav = false; }, 150);
      }
    });

    // Navegación SOLO si el clic no viene de controles
    card.addEventListener('click', (e) => {
      // si venimos de botones/inputs o está activo el suppression, NO navegamos
      const path = e.composedPath?.() || [];
      const hitControl = path.some(el =>
        el && el.nodeType === 1 && (
          el === changeBtn || el === removeBtn || el === file ||
          (el.classList && el.classList.contains('btn')) ||
          el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'LABEL'
        )
      );
      if (suppressNav || hitControl) return;

      state.selectedObraId = String(obra.id);
      localStorage.setItem('selectedObraId', state.selectedObraId);
      const sel = document.querySelector('#obraSelect');
      if (sel) sel.value = state.selectedObraId;
      location.hash = '#inventario';
    });

    actions.append(changeBtn, removeBtn);
    card.append(img, actions, meta, file);
    grid.appendChild(card);

    // Cargar foto desde DB (si existe)
    try {
      const p = await PhotoAPI.get(String(obra.id));
      if (p?.data) img.src = p.data;
    } catch { /* placeholder si falla */ }
  }
}



function placeholderFromName(name) {
  const initials = (name.match(/\b\p{L}/gu) || []).slice(0, 2).join('').toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#11324a'/><stop offset='100%' stop-color='#2a6f97'/></linearGradient></defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial' font-size='120' fill='#fff' opacity='.9'>${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function resizeToMax(file, maxSize = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fr = new FileReader();
    fr.onload = () => { img.src = fr.result; };
    fr.onerror = reject;
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // calidad 0.85; usa tipo original si es jpeg/png
      const isJpeg = /jpe?g/i.test(file.type);
      const mime = isJpeg ? 'image/jpeg' : 'image/png';
      const dataURL = c.toDataURL(mime, 0.85);
      resolve(dataURL);
    };
    img.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ================== Añadir (autocompletar inteligente) ==================
let nombreDatalist;
function initAnadirAutocompletar() {
  nombreDatalist = document.createElement('datalist');
  nombreDatalist.id = 'nombreSugerencias';
  document.body.appendChild(nombreDatalist);
  $.itemNombre?.setAttribute('list', 'nombreSugerencias');

  on($.itemNombre, 'input', () => {
    const v = $.itemNombre.value.trim().toLowerCase();
    const opts = [];
    if (v.length >= 1) {
      for (const name of state.nameIndex.keys()) {
        if (name.toLowerCase().startsWith(v)) opts.push(name);
        if (opts.length >= 20) break;
      }
    }
    nombreDatalist.innerHTML = opts.map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
  });

  on($.itemNombre, 'change', () => {
    const name = $.itemNombre.value.trim();
    const meta = state.nameIndex.get(name);
    if (meta) {
      $.itemCategoria.value = meta.categoria || '';
      $.itemSubtipo.value = meta.subtipo || '';
    }
  });

  on($.itemMarca, 'change', () => {
    const isNew = $.itemMarca.value === '__new__';
    $.marcaNuevaWrap.classList.toggle('hidden', !isNew);
  });

  $.itemForm?.addEventListener('submit', handleAddSubmit);
}

async function handleAddSubmit(ev) {
  ev.preventDefault();
  const obraId = state.selectedObraId;
  if (!obraId) return alertMsg('Selecciona una obra primero.', 'error');

  const nombre = $.itemNombre.value.trim();
  const categoria = $.itemCategoria.value;
  const subtipo = $.itemSubtipo.value || null;
  let marca = $.itemMarca.value;
  if (marca === '__new__') marca = $.itemMarcaNueva.value.trim();
  const cantidad = Number($.itemCantidad.value || 0);
  const ubicacion = $.itemUbicacion.value.trim() || null;
  const observaciones = $.itemObservaciones.value.trim() || null;

  if (!nombre || !categoria || !marca) return alertMsg('Nombre, categoría y marca son obligatorios.', 'error');

  try {
    await createItem({ obra_id: obraId, nombre, categoria, subtipo, marca, cantidad, ubicacion, observaciones });
    await refreshItems();
    $.itemForm.reset();
    $.marcaNuevaWrap.classList.add('hidden');
    alertMsg('Ítem agregado.');
    prepareAnadir();
    if (location.hash === '#inventario') renderInventario();
  } catch (e) {
    alertMsg('Error al agregar: ' + e.message, 'error');
  }
}

function prepareAnadir() {
  const marcas = new Set(state.items.map(i => i.marca).filter(Boolean));
  const sel = $.itemMarca;
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">—</option><option value="__new__">Nueva marca…</option>` +
    [...marcas].sort((a,b)=>a.localeCompare(b,'es')).map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

// Índices para autocompletar
function rebuildIndexes() {
  state.nameIndex.clear();
  state.brands = new Set();
  for (const it of state.items) {
    state.brands.add(it.marca);
    if (!state.nameIndex.has(it.nombre)) {
      state.nameIndex.set(it.nombre, { categoria: it.categoria || '', subtipo: it.subtipo || '', lastBrand: it.marca || '' });
    } else {
      state.nameIndex.get(it.nombre).lastBrand = it.marca || state.nameIndex.get(it.nombre).lastBrand;
    }
  }
}

// ================== Inventario ==================
function summarizeItems(items) {
  const totalRows = items.length;
  const totalUnits = items.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);
  const catSet = new Set(items.map(i => i.categoria).filter(Boolean));
  const subSet = new Set(items.map(i => i.subtipo).filter(Boolean));
  return { totalRows, totalUnits, cats: catSet.size, subs: subSet.size };
}

async function renderInventario() {
  const obra = currentObra();
  if (!obra) {
    $.obraInfo.innerHTML = '';
    $.tableBody.innerHTML = `<tr><td colspan="8" class="empty">Selecciona una obra…</td></tr>`;
    $.visibleCount.textContent = '0';
    $.totalCount.textContent = '0';
    return;
  }
  const items = state.items.filter(i => String(i.obra_id) === String(obra.id));
  const { totalRows, totalUnits, cats, subs } = summarizeItems(items);
  $.obraInfo.innerHTML = `
    <div class="row wrap">
      <strong>${escapeHtml(obra.nombre)}</strong>
      <div class="chips">
        <span class="chip">Ítems <strong>${totalRows}</strong></span>
        <span class="chip">Unidades <strong>${totalUnits}</strong></span>
        <span class="chip">Categorías <strong>${cats}</strong></span>
        <span class="chip">Subtipos <strong>${subs}</strong></span>
      </div>
    </div>
  `;
  $.tableBody.innerHTML = items.length
    ? items.map(rowHtml).join('')
    : `<tr><td colspan="8" class="empty">No hay ítems en esta obra.</td></tr>`;
  $.visibleCount.textContent = String(items.length);
  $.totalCount.textContent = String(items.length);

  qsa('button[data-edit-id]').forEach(btn => btn.onclick = () => openEditItem(btn.dataset.editId));
  qsa('button[data-del-id]').forEach(btn => btn.onclick = () => deleteItem(btn.dataset.delId));
}

function rowHtml(i) {
  return `<tr>
    <td>${escapeHtml(i.nombre || '')}</td>
    <td>${escapeHtml(i.categoria || '')}</td>
    <td>${escapeHtml(i.subtipo || '')}</td>
    <td>${Number(i.cantidad || 0)}</td>
    <td>${escapeHtml(i.marca || '')}</td>
    <td>${escapeHtml(i.ubicacion || '')}</td>
    <td>${escapeHtml(i.observaciones || '')}</td>
    <td class="row">
      <button class="btn square" title="Editar" data-edit-id="${i.id}"><svg class="i"><use href="#i-edit"/></svg></button>
      <button class="btn danger square" title="Eliminar" data-del-id="${i.id}"><svg class="i"><use href="#i-trash"/></svg></button>
    </td>
  </tr>`;
}

async function deleteItem(id) {
  if (!confirm('¿Eliminar este ítem?')) return;
  try {
    await deleteItemApi(id);
    await refreshItems();
    renderInventario();
    alertMsg('Ítem eliminado.');
  } catch (e) {
    alertMsg('Error eliminando: ' + e.message, 'error');
  }
}

function openEditItem(id) {
  const i = state.items.find(x => String(x.id) === String(id));
  if (!i) return;
  const nuevoNombre = prompt('Nombre', i.nombre);
  if (nuevoNombre === null) return;

  const obraOptions = state.obras.map(o => `${o.id}:${o.nombre}`).join('\n');
  const nuevaObraId = prompt(`Obra (id:nombre)\n${obraOptions}\n\nIntroduce ID de obra:`, String(i.obra_id));
  if (nuevaObraId === null) return;

  const nuevaCategoria = prompt('Categoría (herramienta/material)', i.categoria || '');
  if (nuevaCategoria === null) return;
  const nuevoSubtipo = prompt('Subtipo (eléctrica/manual/—)', i.subtipo || '') || null;
  const nuevaMarca = prompt('Marca', i.marca || '');
  if (nuevaMarca === null) return;
  const nuevaCantidad = Number(prompt('Cantidad', String(i.cantidad ?? 0)) || 0);
  const nuevaUbicacion = prompt('Ubicación', i.ubicacion || '') || null;
  const nuevasObs = prompt('Observaciones', i.observaciones || '') || null;

  doEditItem(id, {
    nombre: (nuevoNombre || '').trim(),
    obra_id: (nuevaObraId || '').trim(),
    categoria: (nuevaCategoria || '').trim(),
    subtipo: (nuevoSubtipo || '').trim() || null,
    marca: (nuevaMarca || '').trim(),
    cantidad: nuevaCantidad,
    ubicacion: nuevaUbicacion,
    observaciones: nuevasObs,
  });
}
async function doEditItem(id, payload) {
  try {
    await updateItem(id, payload);
    await refreshItems();
    renderInventario();
    alertMsg('Ítem actualizado.');
  } catch (e) {
    alertMsg('Error al actualizar: ' + e.message, 'error');
  }
}

// ================== Categorías ==================
function initCategoriasFilters() {
  ensureOption($.catCategoria, 'ambas', 'Ambas', true);
  ensureOption($.catSubtipo, 'ambas', 'Ambas', true);
  fillCatObra();
  on($.catObra, 'change', renderCategorias);
  on($.catCategoria, 'change', renderCategorias);
  on($.catSubtipo, 'change', renderCategorias);
  on($.catMarca, 'change', renderCategorias);
}
function ensureOption(select, value, label, asFirst = false) {
  if (!select) return;
  if ([...select.options].some(o => o.value === value)) return;
  const opt = document.createElement('option');
  opt.value = value; opt.textContent = label;
  if (asFirst && select.firstChild) select.insertBefore(opt, select.firstChild);
  else select.appendChild(opt);
}
function fillCatObra() {
  if (!$.catObra) return;
  $.catObra.innerHTML = `<option value="all">Todas</option>` +
    state.obras.map(o => `<option value="${o.id}">${escapeHtml(o.nombre)}</option>`).join('');
  fillCatMarcas();
}
function fillCatMarcas() {
  if (!$.catMarca) return;
  const marcas = [...new Set(state.items.map(i => i.marca).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  $.catMarca.innerHTML = `<option value="all">Todas</option>` + marcas.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
}
function renderCategorias() {
  if (!$.catResults) return;
  const obraVal = $.catObra.value;
  const catVal = $.catCategoria.value; // herramienta/material/ambas
  const subVal = $.catSubtipo.value;   // electrica/manual/ambas
  const marcaVal = $.catMarca.value;

  let items = state.items.slice();
  if (obraVal !== 'all') items = items.filter(i => String(i.obra_id) === String(obraVal));
  if (catVal !== 'ambas') items = items.filter(i => i.categoria === catVal);
  if (subVal !== 'ambas') items = items.filter(i => (i.subtipo || '') === (subVal === 'all' ? '' : subVal));
  if (marcaVal !== 'all') items = items.filter(i => i.marca === marcaVal);

  $.catSummary.textContent = `${items.length} ítems encontrados.`;

  const byCat = groupBy(items, i => i.categoria || '(sin cat)');
  const blocks = [];
  for (const [cat, arr1] of byCat) {
    const bySub = groupBy(arr1, i => i.subtipo || '(sin subtipo)');
    let inner = '';
    for (const [sub, arr2] of bySub) {
      const byBrand = groupBy(arr2, i => i.marca || '(sin marca)');
      let rows = '';
      for (const [brand, arr3] of byBrand) {
        const names = arr3.map(i => i.nombre).sort((a,b)=>a.localeCompare(b,'es'));
        rows += `<div class="card">
          <div class="row between"><strong>${escapeHtml(brand)}</strong><span class="chip">${arr3.length}</span></div>
          <div class="muted">${names.map(escapeHtml).join(', ')}</div>
        </div>`;
      }
      inner += `<div class="card"><div class="row between"><h3>${escapeHtml(sub)}</h3><span class="chip">${arr2.length}</span></div>${rows}</div>`;
    }
    blocks.push(`<div class="card"><h2 class="view-title">${escapeHtml(cat)}</h2>${inner}</div>`);
  }
  $.catResults.innerHTML = blocks.join('');
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return map;
}

// ================== Datos (PDF por obra) ==================
function renderDatos() {
  if (!$.views.datos) return;
  if (!qs('#datosControls', $.views.datos)) {
    const wrap = document.createElement('div');
    wrap.id = 'datosControls';
    wrap.className = 'row wrap';
    const sel = document.createElement('select');
    sel.id = 'datosObra';
    sel.innerHTML = state.obras.map(o => `<option value="${o.id}">${escapeHtml(o.nombre)}</option>`).join('');
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Descargar PDF';
    btn.onclick = () => descargarPDF(sel.value);
    wrap.append(sel, btn);
    $.views.datos.appendChild(wrap);
  } else {
    const sel = qs('#datosObra', $.views.datos);
    sel.innerHTML = state.obras.map(o => `<option value="${o.id}">${escapeHtml(o.nombre)}</option>`).join('');
  }
}

function descargarPDF(obraId) {
  const obra = state.obras.find(o => String(o.id) === String(obraId));
  const items = state.items
    .filter(i => String(i.obra_id) === String(obraId))
    .sort((a,b)=> (a.categoria||'').localeCompare(b.categoria||'','es') ||
                  (a.subtipo||'').localeCompare(b.subtipo||'','es') ||
                  (a.nombre||'').localeCompare(b.nombre||'','es'));
  const { totalRows, totalUnits, cats, subs } = summarizeItems(items);

  const html = `
<!doctype html><html lang="es"><head>
<meta charset="utf-8"><title>Inventario - ${escapeHtml(obra?.nombre||'Obra')}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;margin:24px;}
  h1{margin:0 0 10px;}
  .chips{display:flex;gap:8px;margin:4px 0 16px}
  .chip{border:1px solid #888;border-radius:999px;padding:2px 8px;font-size:12px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #bbb;padding:6px 8px;font-size:12px;vertical-align:top}
  thead th{background:#eef}
  @media print{button{display:none}}
</style></head><body>
  <h1>Inventario – ${escapeHtml(obra?.nombre||'')}</h1>
  <div class="chips">
    <span class="chip">Ítems ${totalRows}</span>
    <span class="chip">Unidades ${totalUnits}</span>
    <span class="chip">Categorías ${cats}</span>
    <span class="chip">Subtipos ${subs}</span>
  </div>
  <table>
    <thead><tr>
      <th>Nombre</th><th>Categoría</th><th>Subtipo</th><th>Cantidad</th>
      <th>Marca</th><th>Ubicación</th><th>Observaciones</th>
    </tr></thead>
    <tbody>
      ${items.map(i=>`<tr>
        <td>${escapeHtml(i.nombre||'')}</td>
        <td>${escapeHtml(i.categoria||'')}</td>
        <td>${escapeHtml(i.subtipo||'')}</td>
        <td>${Number(i.cantidad||0)}</td>
        <td>${escapeHtml(i.marca||'')}</td>
        <td>${escapeHtml(i.ubicacion||'')}</td>
        <td>${escapeHtml(i.observaciones||'')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <button onclick="print()">Imprimir / Guardar como PDF</button>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); w.focus(); }
  else { alertMsg('Permite ventanas emergentes para descargar el PDF.', 'error'); }
}

// ================== Tema / Alertas ==================
function initThemeToggle() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.dataset.theme = saved;
  updateThemeIcon();
  $.themeToggleBtn && ($.themeToggleBtn.onclick = () => {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'light' ? '' : 'light';
    if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
    localStorage.setItem('theme', document.documentElement.dataset.theme || '');
    updateThemeIcon();
  });
}
function updateThemeIcon() {
  const light = document.documentElement.dataset.theme === 'light';
  $.themeIcon?.setAttribute('href', light ? '#i-sun' : '#i-moon');
}
function alertMsg(msg, type = 'ok') {
  if (!$.alert) return;
  $.alert.textContent = msg;
  $.alert.style.color = type === 'error' ? 'tomato' : 'inherit';
  setTimeout(() => { $.alert.textContent = ''; }, 2500);
}

// ================== Start ==================
bootstrap().catch(e => alertMsg('Error inicial: ' + e.message, 'error'));
