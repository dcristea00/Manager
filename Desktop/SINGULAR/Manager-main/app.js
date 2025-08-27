/*
  app.js — Modo híbrido: intenta API (Netlify Functions) y cae a localStorage si falla.
  Reemplaza tu app.js actual por este. Mantiene IDs/clases existentes.
*/

// =========================
// Configuración / Estado
// =========================
const CONFIG = { storageKey: 'obraInv_v1', version: 2, apiBase: '/.netlify/functions' };

const BRANDS = new Set([
  'Hilti','Makita','Milwaukee','Bosch','DeWalt','Metabo','Festool','Stanley',
  'Ridgid','HiKOKI','Einhell','Black+Decker','Bellota','Sika','Bosch Professional'
]);

let state = {
  obras: [],
  items: [],
  selectedObraId: '',
  editingItemId: null,
  filters: { categoria: '', subtipo: '', search: '' }
};

// =========================
// Utilidades UI
// =========================
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const cap  = (s)=>s ? s[0].toUpperCase()+s.slice(1) : s;

function toast(type, msg){
  const container = qs('#alertContainer');
  const cls = type==='error' ? 'alert alert--error' : 'alert';
  container.innerHTML = `<div class="${cls}">${msg}</div>`;
  setTimeout(()=>{ container.innerHTML=''; }, 1600);
}

// =========================
// Persistencia local (copia/Offline)
// =========================
const Local = {
  load(){
    try{
      const raw = localStorage.getItem(CONFIG.storageKey);
      if(!raw) return this.defaults();
      const parsed = JSON.parse(raw);
      return migrate({ version: parsed.version||1, obras: parsed.obras||[], items: parsed.items||[] });
    }catch{ return this.defaults(); }
  },
  save(){
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({ version: CONFIG.version, obras: state.obras, items: state.items }));
  },
  defaults(){
    return {
      version: 2,
      obras: [
        { id: 'obra_001', nombre: 'Residencial Sur' },
        { id: 'obra_002', nombre: 'Edificio Comercial Norte' }
      ],
      items: [
        { id:'itm_001', obraId:'obra_001', nombre:'Taladro GSB 13', categoria:'herramienta', subtipo:'electrica', cantidad:3, marca:'Bosch', ubicacion:'Almacén 1 / B', observaciones:'Revisión mensual' },
        { id:'itm_002', obraId:'obra_001', nombre:'Cemento CEM II', categoria:'material', subtipo:'', cantidad:40, marca:'Sika', ubicacion:'Patio', observaciones:'' }
      ]
    };
  }
};

function migrate(data){
  if((data.version||1) < 2){
    data.items = data.items.map(it=>{ if(!it.marca && it.unidad){ it.marca = it.unidad; } delete it.unidad; return it; });
    data.version = 2;
  }
  return data;
}

// =========================
// Capa API (fetch a Netlify Functions)
// =========================
async function api(path, { method = 'GET', json } = {}) {
  const opts = { method, headers: {} };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  }
  // BUG FIX: antes no pasábamos 'opts' a fetch → siempre hacía GET sin body
  const res = await fetch(`${CONFIG.apiBase}${path}`, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && (data.error || data.message)) || 'API error');
  return data;
}

const API = {
  obrasList: () => api('/obras'),
  obrasCreate: (nombre) => api('/obras', {method:'POST', json:{nombre}}),
  obrasUpdate: (id, nombre) => api(`/obras?id=${encodeURIComponent(id)}`, {method:'PUT', json:{nombre}}),
  obrasDelete: (id) => api(`/obras?id=${encodeURIComponent(id)}`, {method:'DELETE'}),

  itemsList: (obraId) => api(`/items?obraId=${encodeURIComponent(obraId)}`),
  itemCreate: (payload) => api('/items', {method:'POST', json: payload}),
  itemUpdate: (id, patch) => api(`/items?id=${encodeURIComponent(id)}`, {method:'PUT', json: patch}),
  itemDelete: (id) => api(`/items?id=${encodeURIComponent(id)}`, {method:'DELETE'})
};

// Normaliza filas del servidor (snake_case -> camelCase)
function normalizeItem(row){
  if (!row) return row;
  return {
    id: row.id,
    obraId: row.obra_id,
    nombre: row.nombre,
    categoria: row.categoria,
    subtipo: row.subtipo || '',
    cantidad: Number.isFinite(row.cantidad) ? row.cantidad : (parseInt(row.cantidad,10) || 0),
    marca: row.marca || '',
    ubicacion: row.ubicacion || '',
    observaciones: row.observaciones || ''
  };
}

// =========================
// Proveedor híbrido (elige online y cae a local)
// =========================
const DB = {
  async listObras(){
    try { return await API.obrasList(); } catch { return Local.load().obras; }
  },
  async createObra(nombre){
    try { return await API.obrasCreate(nombre); }
    catch { const o={id:uid(), nombre:nombre.trim()}; const d=Local.load(); d.obras.push(o); localStorage.setItem(CONFIG.storageKey, JSON.stringify(d)); return o; }
  },
  async updateObra(id, nombre){
    try { return await API.obrasUpdate(id, nombre); }
    catch { const d=Local.load(); const o=d.obras.find(x=>x.id===id); if(o){o.nombre=nombre.trim(); localStorage.setItem(CONFIG.storageKey, JSON.stringify(d));} return o; }
  },
  async deleteObra(id){
    try { await API.obrasDelete(id); }
    catch { const d=Local.load(); d.obras = d.obras.filter(o=>o.id!==id); d.items = d.items.filter(i=>i.obraId!==id); localStorage.setItem(CONFIG.storageKey, JSON.stringify(d)); }
  },
  async listItems(obraId){
    try { const rows = await API.itemsList(obraId); return rows.map(normalizeItem); }
    catch { return Local.load().items.filter(i=>i.obraId===obraId); }
  },
  async createItem(it){
    try { return await API.itemCreate({
      obra_id: it.obraId, nombre: it.nombre, categoria: it.categoria, subtipo: it.subtipo||null,
      cantidad: it.cantidad ?? 1, marca: it.marca||null, ubicacion: it.ubicacion||null, observaciones: it.observaciones||null
    }); } 
    catch { const d=Local.load(); d.items.push(it); localStorage.setItem(CONFIG.storageKey, JSON.stringify(d)); return it; }
  },
  async updateItem(id, patch){
    try { return await API.itemUpdate(id, patch); } 
    catch { const d=Local.load(); const it=d.items.find(x=>x.id===id); if(it) Object.assign(it, patch); localStorage.setItem(CONFIG.storageKey, JSON.stringify(d)); return it; }
  },
  async deleteItem(id){
    try { await API.itemDelete(id); } 
    catch { const d=Local.load(); d.items = d.items.filter(i=>i.id!==id); localStorage.setItem(CONFIG.storageKey, JSON.stringify(d)); }
  }
};

// =========================
// Validación
// =========================
const Validate = {
  obraNombre(nombre, excludeId=null){
    if(!nombre?.trim()) return 'El nombre es obligatorio';
    const dup = state.obras.some(o => o.id !== excludeId && o.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    return dup ? 'Ya existe una obra con este nombre' : '';
  },
  item(data, obraId, excludeId=null){
    const errors = {};
    if(!data.nombre?.trim()) errors.nombre = 'El nombre es obligatorio';
    const dup = state.items.some(it => it.id !== excludeId && it.obraId===obraId && it.nombre.trim().toLowerCase()===data.nombre.trim().toLowerCase() && it.categoria===data.categoria && (it.subtipo||'')===(data.subtipo||'') && (it.marca||'')===(data.marca||''));
    if(!errors.nombre && dup) errors.nombre = 'Ya existe un ítem igual (nombre/categoría/subtipo/marca)';
    if(!data.categoria) errors.categoria = 'La categoría es obligatoria';
    if(data.categoria==='herramienta' && !data.subtipo) errors.subtipo = 'El subtipo es obligatorio para herramientas';
    if(!data.marca?.trim()) errors.marca = 'La marca es obligatoria';
    return errors;
  }
};

// =========================
// Render
// =========================
function renderObrasSelect(){
  const sel = qs('#obraSelect');
  if(!sel) return; // safety
  const prev = sel.value;
  sel.innerHTML = `<option value="">— Seleccionar Obra —</option>` + (state.obras||[]).map(o=>`<option value="${o.id}">${o.nombre}</option>`).join('');
  sel.value = state.selectedObraId || prev || '';
  const delBtn = qs('#obraDeleteBtn'); if (delBtn) delBtn.disabled = !sel.value;
  const editBtn = qs('#editObraBtn'); if (editBtn) editBtn.disabled = !sel.value;
}
function renderBrandsSelect(){
  const select = qs('#itemMarca');
  const opts = [...BRANDS].sort((a,b)=>a.localeCompare(b));
  select.innerHTML = `<option value="">— Seleccionar —</option>` + opts.map(b=>`<option value="${b}">${b}</option>`).join('') + `<option value="__new__">Añadir nueva…</option>`;
  select.value = '';
}
function renderCounts(filtered){
  qs('#totalCount').textContent = state.items.filter(i => i.obraId === state.selectedObraId).length;
  qs('#visibleCount').textContent = filtered.length;
}
function applyFilters(){
  const {categoria, subtipo, search} = state.filters;
  return state.items.filter(i => i.obraId === state.selectedObraId)
    .filter(i => !categoria || i.categoria === categoria)
    .filter(i => categoria!=='herramienta' || !subtipo || (i.subtipo||'') === subtipo)
    .filter(i => !search || i.nombre.toLowerCase().includes(search.toLowerCase()));
}
function renderTable(){
  const tbody = qs('#tableBody');
  if(!state.selectedObraId){
    tbody.innerHTML = `<tr><td colspan="8" class="table__empty">Selecciona una obra para ver el inventario</td></tr>`;
    renderCounts([]); return;
  }
  const filtered = applyFilters();
  if(filtered.length === 0){
    tbody.innerHTML = `<tr><td colspan="8" class="table__empty">Sin resultados</td></tr>`;
    renderCounts(filtered); return;
  }
  tbody.innerHTML = filtered.map(it=>`
    <tr data-id="${it.id}">
      <td>${it.nombre}</td>
      <td>${cap(it.categoria)}</td>
      <td>${it.categoria==='herramienta' ? (it.subtipo || '—') : '—'}</td>
      <td>
        <div class="actions">
          <button class="iconbtn" data-action="dec" title="Disminuir">−</button>
          <strong>${it.cantidad||0}</strong>
          <button class="iconbtn" data-action="inc" title="Aumentar">+</button>
        </div>
      </td>
      <td>${it.marca || '—'}</td>
      <td>${it.ubicacion || '—'}</td>
      <td>${it.observaciones || '—'}</td>
      <td class="actions">
        <button class="btn" data-action="edit">Editar</button>
        <button class="btn btn--danger" data-action="delete">Eliminar</button>
      </td>
    </tr>
  `).join('');
  renderCounts(filtered);
}

// =========================
// Obras (modal + CRUD)
// =========================
const obraModal = qs('#obraModal');
function openObraModal({mode='create', obra=null}={}){
  qs('#obraModalTitle').textContent = mode==='edit' ? 'Editar Obra' : 'Nueva Obra';
  const submit = qs('#obraSubmitBtn'); submit.textContent = mode==='edit' ? 'Guardar Cambios' : 'Crear Obra';
  const del = qs('#obraDeleteBtn');
  if(mode==='edit'){
    show(del); del.onclick = async () => {
      if(confirm('¿Eliminar esta obra y su inventario?')){ await deleteObra(obra.id); closeObraModal(); }
    };
  } else { hide(del); del.onclick = null; }
  const nameInput = qs('#obraNombre');
  nameInput.value = obra?.nombre || '';
  nameInput.dataset.mode = mode;
  nameInput.dataset.id = obra?.id || '';
  hide(qs('#obraNombre-error'));
  obraModal.showModal(); setTimeout(()=>nameInput.focus(), 30);
}
function closeObraModal(){ obraModal.close(); }

async function createObra(nombre){
  const err = Validate.obraNombre(nombre);
  if(err){ showError('#obraNombre-error', err); return null; }
  const obra = await DB.createObra(nombre);
  // refrescar estado desde servidor si estamos online; si no, local
  state.obras = await DB.listObras(); state.selectedObraId = obra.id;
  Local.save(); renderObrasSelect(); renderTable(); toast('success', `Obra «${obra.nombre}» creada`);
  return obra;
}
async function updateObra(id, nombre){
  const err = Validate.obraNombre(nombre, id);
  if(err){ showError('#obraNombre-error', err); return null; }
  await DB.updateObra(id, nombre);
  state.obras = await DB.listObras();
  Local.save(); renderObrasSelect(); toast('success', 'Obra actualizada');
}
async function deleteObra(id){
  await DB.deleteObra(id);
  state.obras = await DB.listObras();
  state.items = state.items.filter(i=>i.obraId!==id);
  if(state.selectedObraId===id) state.selectedObraId='';
  Local.save(); renderObrasSelect(); renderTable(); toast('success','Obra eliminada');
}

// =========================
// Ítems (CRUD)
// =========================
function showError(sel, msg){ const el = qs(sel); el.textContent = msg; show(el); }
function hideErrors(){ qsa('.alert--error').forEach(hide); }

function readItemForm(){
  const cat = qs('#itemCategoria').value;
  const sel = qs('#itemMarca').value;
  const nueva = qs('#itemMarcaNueva').value.trim();
  const marca = (sel==='__new__') ? nueva : sel;
  return {
    nombre: qs('#itemNombre').value,
    categoria: cat,
    subtipo: cat==='herramienta' ? qs('#itemSubtipo').value : '',
    cantidad: 1,
    marca,
    ubicacion: qs('#itemUbicacion').value,
    observaciones: qs('#itemObservaciones').value
  };
}
function resetItemForm(){
  qs('#itemForm').reset();
  state.editingItemId = null;
  qs('#submitBtn').textContent = 'Agregar Ítem';
  qs('#formTitle').textContent = 'Agregar Ítem';
  hideErrors(); renderBrandsSelect(); hide(qs('#marcaNuevaWrap'));
}

async function saveNewItem(){
  const data = readItemForm();
  const errors = Validate.item(data, state.selectedObraId);
  hideErrors();
  if(Object.keys(errors).length){
    if(errors.nombre) showError('#itemNombre-error', errors.nombre);
    if(errors.categoria) showError('#itemCategoria-error', errors.categoria);
    if(errors.subtipo) showError('#itemSubtipo-error', errors.subtipo);
    if(errors.marca) showError('#itemMarca-error', errors.marca);
    toast('error','Revisa los campos obligatorios'); return;
  }
  if(qs('#itemMarca').value==='__new__' && data.marca){ BRANDS.add(data.marca); }
  const item = {
    id: uid(), obraId: state.selectedObraId, nombre: data.nombre.trim(), categoria: data.categoria,
    subtipo: data.categoria==='herramienta' ? data.subtipo : '', cantidad: 1, marca: data.marca?.trim()||'',
    ubicacion: data.ubicacion?.trim()||'', observaciones: data.observaciones?.trim()||''
  };
  await DB.createItem(item);
  state.items = await DB.listItems(state.selectedObraId);
  Local.save(); renderTable(); resetItemForm(); toast('success','Ítem agregado');
}

async function saveEditedItem(){
  const data = readItemForm();
  const errors = Validate.item(data, state.selectedObraId, state.editingItemId);
  hideErrors();
  if(Object.keys(errors).length){
    if(errors.nombre) showError('#itemNombre-error', errors.nombre);
    if(errors.categoria) showError('#itemCategoria-error', errors.categoria);
    if(errors.subtipo) showError('#itemSubtipo-error', errors.subtipo);
    if(errors.marca) showError('#itemMarca-error', errors.marca);
    toast('error','Revisa los campos obligatorios'); return;
  }
  if(qs('#itemMarca').value==='__new__' && data.marca){ BRANDS.add(data.marca); }
  await DB.updateItem(state.editingItemId, {
    nombre: data.nombre.trim(), categoria: data.categoria,
    subtipo: data.categoria==='herramienta' ? data.subtipo : null,
    marca: data.marca?.trim()||null, ubicacion: data.ubicacion?.trim()||null,
    observaciones: data.observaciones?.trim()||null
  });
  state.items = await DB.listItems(state.selectedObraId);
  Local.save(); renderTable(); resetItemForm(); toast('success','Ítem actualizado');
}
// =========================
// Listeners (versión corregida e idempotente)
// =========================
let __listenersBound = false; // evita doble binding global

// Reemplaza tu setupHowToToggle() por esta versión
function setupHowToToggle() {
  const btn = qs('#toggleHowToBtn');
  const panel = qs('#howTo');
  if (!btn || !panel) return;

  // estado inicial según si el panel está oculto
  btn.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));

  // evita doble binding si la función se invoca de nuevo
  if (btn.__handler) btn.removeEventListener('click', btn.__handler);

  btn.__handler = () => {
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
      // enfoque accesible al abrir
      const h = panel.querySelector('#como-usar');
      if (h && typeof h.focus === 'function') setTimeout(() => h.focus(), 0);
    } else {
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    }
  };

  btn.addEventListener('click', btn.__handler);

  // (opcional) cerrar con ESC cuando está visible
  if (!panel.__escHandler) {
    panel.__escHandler = (e) => {
      if (e.key === 'Escape' && !panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    };
    document.addEventListener('keydown', panel.__escHandler);
  }
}


function addEventListeners() {
  if (__listenersBound) return;      // ← clave: no registrar dos veces
  __listenersBound = true;

  setupHowToToggle();

  // ---- Obras: botones header ----
  const nuevaBtn = qs('#nuevaObraBtn');
  if (nuevaBtn) nuevaBtn.addEventListener('click', () => openObraModal());

  const editBtn = qs('#editObraBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    const id = qs('#obraSelect').value;
    if (!id) return;
    const obra = state.obras.find((o) => o.id === id);
    openObraModal({ mode: 'edit', obra });
  });

  const delHeaderBtn = qs('#obraDeleteBtn');
  if (delHeaderBtn) delHeaderBtn.addEventListener('click', async () => {
    const id = qs('#obraSelect').value;
    if (!id) return;
    if (confirm('¿Eliminar esta obra y todo su inventario?')) await deleteObra(id);
  });

  // ---- Modal de obras ----
  qsa('.close-btn').forEach((b) => b.addEventListener('click', closeObraModal));
  const obraCancel = qs('#obraCancelBtn');
  if (obraCancel) obraCancel.addEventListener('click', closeObraModal);

  const obraForm = qs('#obraForm');
  if (obraForm) obraForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    // soporte para dónde guardes el modo/id (input o form)
    const nombreEl = qs('#obraNombre');
    const mode = obraForm.dataset.mode || nombreEl?.dataset.mode || 'create';
    const id = obraForm.dataset.id || nombreEl?.dataset.id || '';
    const nombre = nombreEl.value;
    if (mode === 'edit') { await updateObra(id, nombre); closeObraModal(); }
    else { await createObra(nombre); closeObraModal(); }
  });

  // ---- Select de Obras ----
  const obraSelect = qs('#obraSelect');
  if (obraSelect) obraSelect.addEventListener('change', async (e) => {
    state.selectedObraId = e.target.value;
    renderObrasSelect();
    state.items = state.selectedObraId ? await DB.listItems(state.selectedObraId) : [];
    Local.save();
    renderTable();
  });

  // ---- Export / Import ----
  const exportBtn = qs('#exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const blob = new Blob(
      [JSON.stringify({ version: CONFIG.version, obras: state.obras, items: state.items }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-obras-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importFile = qs('#importFile');
  if (importFile) importFile.addEventListener('change', async (e) => {
    if (!e.target.files?.length) return;
    try {
      const txt = await e.target.files[0].text();
      const data = migrate(JSON.parse(txt));
      state.obras = data.obras;
      state.items = data.items;
      Local.save();
      toast('success', 'Importado localmente');
    } catch {
      toast('error', 'Error al importar');
    }
    e.target.value = '';
  });

  // ---- Form ítems ----
  const catSel = qs('#itemCategoria');
  if (catSel) catSel.addEventListener('change', (e) => {
    const stg = qs('#subtipoGroup');
    if (stg) stg.style.display = (e.target.value === 'herramienta') ? 'block' : 'none';
  });

  const marcaSel = qs('#itemMarca');
  if (marcaSel) marcaSel.addEventListener('change', (e) => {
    const wrap = qs('#marcaNuevaWrap');
    if (!wrap) return;
    if (e.target.value === '__new__') { show(wrap); const i = qs('#itemMarcaNueva'); if (i) i.focus(); }
    else { hide(wrap); }
  });

  // ÚNICO listener de submit del formulario de ítems (evita doble POST)
  const itemForm = qs('#itemForm');
  if (itemForm) itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.selectedObraId) { toast('error', 'Selecciona una obra primero'); return; }
    if (state.editingItemId) await saveEditedItem();
    else await saveNewItem();
  });

  const cancelBtn = qs('#cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', resetItemForm);

  // ---- Filtros / búsqueda ----
  qsa('input[name="categoria"]').forEach((r) => r.addEventListener('change', (e) => {
    state.filters.categoria = e.target.value;
    renderTable();
    const stf = qs('#subtipoFilter');
    if (stf) stf.style.display = (state.filters.categoria === 'herramienta') ? 'block' : 'none';
  }));

  qsa('input[name="subtipo"]').forEach((r) => r.addEventListener('change', (e) => {
    state.filters.subtipo = e.target.value;
    renderTable();
  }));

  const search = qs('#searchInput');
  if (search) search.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderTable();
  });

  // ---- Tabla (delegación única para + / - / editar / eliminar) ----
  const tbody = qs('#tableBody');
  if (tbody) tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const tr = btn.closest('tr');
    const id = tr?.dataset.id;
    if (!id) return;

    const action = btn.dataset.action;
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    if (action === 'inc' || action === 'dec') {
      // evita negativos y doble suma (solo hay un listener)
      item.cantidad = Math.max(0, (item.cantidad || 0) + (action === 'inc' ? 1 : -1));
      await DB.updateItem(id, { cantidad: item.cantidad });
      renderTable();
      return;
    }

    if (action === 'delete') {
      if (!confirm('¿Eliminar ítem?')) return;
      await DB.deleteItem(id);
      state.items = await DB.listItems(state.selectedObraId);
      renderTable();
      return;
    }

    if (action === 'edit') {
      state.editingItemId = id;
      qs('#formTitle').textContent = 'Editar Ítem';
      qs('#submitBtn').textContent = 'Guardar Cambios';
      qs('#itemNombre').value = item.nombre;

      const ic = qs('#itemCategoria'); if (ic) ic.value = item.categoria;
      const stg = qs('#subtipoGroup'); if (stg) stg.style.display = (item.categoria === 'herramienta') ? 'block' : 'none';
      const is = qs('#itemSubtipo'); if (is) is.value = item.subtipo || '';

      renderBrandsSelect();
      const ms = qs('#itemMarca'); const wrap = qs('#marcaNuevaWrap');
      if (ms) {
        if (BRANDS.has(item.marca)) { ms.value = item.marca; if (wrap) hide(wrap); }
        else if (item.marca) { ms.value = '__new__'; if (wrap) { show(wrap); const nm = qs('#itemMarcaNueva'); if (nm) nm.value = item.marca; } }
        else { ms.value = ''; if (wrap) hide(wrap); }
      }

      const iu = qs('#itemUbicacion'); if (iu) iu.value = item.ubicacion || '';
      const io = qs('#itemObservaciones'); if (io) io.value = item.observaciones || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

/* ===== Router simple por hash: #home | #inventario | #ayuda | #datos ===== */
(function setupRouter(){
  const views = {
    home: document.getElementById('view-home'),
    inventario: document.getElementById('view-inventario'),
    ayuda: document.getElementById('view-ayuda'),
    datos: document.getElementById('view-datos'),
  };
  const tabs = {
    home: document.getElementById('nav-home'),
    inventario: document.getElementById('nav-inventario'),
    ayuda: document.getElementById('nav-ayuda'),
    datos: document.getElementById('nav-datos'),
  };

  function showView(name){
    Object.values(views).forEach(v => v && v.classList.add('hidden'));
    Object.values(tabs).forEach(t => t && t.classList.remove('active'));
    (views[name]||views.home)?.classList.remove('hidden');
    (tabs[name]||tabs.home)?.classList.add('active');
  }
  function applyRoute(){ showView((location.hash.replace('#','')||'home')); }

  window.addEventListener('hashchange', applyRoute);
  document.addEventListener('DOMContentLoaded', applyRoute);

  // ⚠️ Eliminamos la auto-navegación al cambiar obra.
  // (Mantén tus listeners de obraSelect para cargar items, pero sin cambiar el hash)
})();


// =========================
// Módulo: Categorías + Export bonito (APPEND)
// =========================
const Cross = {
  allItems: null,
  obrasById: new Map(),
  brands: new Set(),
};

async function ensureCrossData() {
  // Map de obras (para nombrar en listados transversales)
  if (!state?.obras || state.obras.length === 0) {
    try {
      const r = await fetch('/.netlify/functions/obras');
      state.obras = await r.json();
    } catch {}
  }
  Cross.obrasById = new Map(state.obras.map(o => [o.id, o]));

  // Todos los ítems (si no los tenemos)
  if (!Cross.allItems) {
    const r = await fetch('/.netlify/functions/items');
    Cross.allItems = await r.json();
  }
  Cross.brands = new Set(Cross.allItems.map(i => i.marca).filter(Boolean));
}

function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function fmtDate(d=new Date()){return d.toLocaleString('es-ES',{hour12:false})}

function buildObraReportHTML(obra, items){
  const total = items.length;
  const sumCantidad = items.reduce((s,i)=>s+(i.cantidad||0),0);
  const byCat = group(items, i=>i.categoria);
  const bySub = group(items.filter(i=>i.categoria==='herramienta'), i=>i.subtipo||'—');
  const byMarca = group(items, i=>i.marca||'—');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>INVOBRA – ${obra.nombre}</title>
  <style>body{font:14px/1.45 system-ui,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a}
  h1,h2{margin:.2rem 0} .muted{color:#475569} .card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}
  table{width:100%;border-collapse:collapse} th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
  .chip{display:inline-block;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;margin-right:6px}
  </style>
  <h1>INVOBRA — Resumen de Obra</h1>
  <div class="muted">Obra: <b>${obra.nombre}</b> · Generado: ${fmtDate()}</div>
  <div class="grid">
    <div class="card"><h2>Totales</h2><div class="chip">Ítems: ${total}</div><div class="chip">Unidades: ${sumCantidad}</div></div>
    <div class="card"><h2>Categorías</h2>${Object.entries(byCat).map(([k,v])=>`<div>${k}: <b>${v.length}</b></div>`).join('')}</div>
    <div class="card"><h2>Subtipos</h2>${Object.entries(bySub).map(([k,v])=>`<div>${k}: <b>${v.length}</b></div>`).join('')||'—'}</div>
    <div class="card"><h2>Marcas</h2>${Object.entries(byMarca).slice(0,20).map(([k,v])=>`<div>${k}: <b>${v.length}</b></div>`).join('')}</div>
  </div>
  <div class="card">
    <h2>Detalle</h2>
    <table><thead><tr><th>Nombre</th><th>Categoría</th><th>Subtipo</th><th>Cantidad</th><th>Marca</th><th>Ubicación</th><th>Observaciones</th></tr></thead>
    <tbody>
      ${items.map(i=>`<tr><td>${esc(i.nombre)}</td><td>${i.categoria}</td><td>${i.subtipo||'—'}</td><td>${i.cantidad||0}</td><td>${esc(i.marca||'')}</td><td>${esc(i.ubicacion||'')}</td><td>${esc(i.observaciones||'')}</td></tr>`).join('')}
    </tbody></table>
  </div>`;
}

function buildCategoryReportHTML(cat, subtipo, marca, items, obrasById){
  const title = `Inventario por categoría: ${cat}${cat==='herramienta' && subtipo!=='all' ? ' · '+subtipo : ''}${marca!=='all' ? ' · Marca '+marca : ''}`;
  const list = items.map(i=>({
    obra: obrasById.get(i.obra_id)?.nombre || i.obra_id,
    nombre: i.nombre, categoria: i.categoria, subtipo: i.subtipo||'—', cantidad: i.cantidad||0, marca: i.marca||'—'
  }));
  const total = list.length, unidades = list.reduce((s,x)=>s+(x.cantidad||0),0);
  const porObra = group(list, x=>x.obra);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>INVOBRA – ${title}</title>
  <style>body{font:14px/1.5 system-ui,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a} h1{margin:.2rem 0}
  .muted{color:#475569} .card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}
  ul{margin:0;padding-left:1.1rem} li{margin:.2rem 0}
  </style>
  <h1>${esc(title)}</h1><div class="muted">Generado: ${fmtDate()}</div>
  <div class="card"><b>Resumen:</b> Ítems ${total} · Unidades ${unidades}</div>
  ${Object.entries(porObra).map(([obra, arr])=>`<div class="card"><h2>${esc(obra)}</h2><ul>${arr.map(r=>`<li>${esc(r.nombre)} — <b>${r.cantidad}</b> · ${r.categoria}${r.subtipo!=='—'?(' ('+r.subtipo+')'):''} · ${esc(r.marca)}</li>`).join('')}</ul></div>`).join('')}`;
}

function esc(s){return String(s||'').replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c])}
function group(arr, by){return arr.reduce((m,x)=>{const k=by(x); (m[k]||= []).push(x); return m},{})}

// ============ Vista CATEGORÍAS ============
async function initCategoriasView(){
  await ensureCrossData();
  // Selects
  const catSel = document.getElementById('catCategoria');
  const subWrap = document.getElementById('catSubtipoWrap');
  const subSel = document.getElementById('catSubtipo');
  const marcaSel = document.getElementById('catMarca');

  // Poblar marcas globales
  marcaSel.innerHTML = '<option value="all">Todas</option>' + [...Cross.brands].sort().map(b=>`<option>${esc(b)}</option>`).join('');

  function toggleSub(){ subWrap.style.display = (catSel.value==='herramienta') ? 'inline-block' : 'none'; }
  toggleSub();

  function apply(){
    const cat = catSel.value;
    const subt = (cat==='herramienta') ? subSel.value : 'all';
    const brand = marcaSel.value;
    const filtered = Cross.allItems.filter(i => (
      i.categoria===cat &&
      (cat!=='herramienta' || subt==='all' || i.subtipo===subt) &&
      (brand==='all' || i.marca===brand)
    ));
    renderCatResults(filtered);
  }

  catSel.onchange = ()=>{ toggleSub(); apply(); };
  subSel.onchange = apply; marcaSel.onchange = apply;
  apply();
}

function renderCatResults(items){
  const box = document.getElementById('catResults');
  const sum = document.getElementById('catSummary');
  const obrasById = Cross.obrasById;
  const total = items.length, unidades = items.reduce((s,i)=>s+(i.cantidad||0),0);
  sum.textContent = `Ítems: ${total} · Unidades: ${unidades}`;
  if (!items.length){ box.innerHTML = '<div class="muted">Sin resultados</div>'; return; }
  const byObra = group(items, i=>obrasById.get(i.obra_id)?.nombre || i.obra_id);
  box.innerHTML = Object.entries(byObra).map(([obra, arr])=>`
    <div class="card">
      <h3 style="margin:0 0 6px">${esc(obra)}</h3>
      <ul style="margin:0;padding-left:1.1rem">
        ${arr.map(i=>`<li>${esc(i.nombre)} — <b>${i.cantidad||0}</b> · ${i.categoria}${i.subtipo?(' ('+i.subtipo+')'):''} · ${esc(i.marca||'')}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

// ============ Descargas (Datos) ============
async function initDescargas(){
  await ensureCrossData();
  const obra = state.obras.find(o=>o.id===state.selectedObraId);
  const downCat = document.getElementById('downCategoria');
  const downSubWrap = document.getElementById('downSubtipoWrap');
  const downSub = document.getElementById('downSubtipo');
  const downMarca = document.getElementById('downMarca');
  const brands = [...Cross.brands].sort();
  downMarca.innerHTML = '<option value="all">Todas</option>' + brands.map(b=>`<option>${esc(b)}</option>`).join('');
  function toggle(){ downSubWrap.style.display = (downCat.value==='herramienta') ? 'inline-block' : 'none'; }
  downCat.onchange = ()=>{ toggle(); };
  toggle();

  // Descargar reporte de la obra seleccionada
  const btnObra = document.getElementById('downloadObraBtn');
  if (btnObra) btnObra.onclick = async ()=>{
    if (!state.selectedObraId) { toast?.('error','Selecciona una obra'); return; }
    const items = await DB.listItems(state.selectedObraId);
    const html = buildObraReportHTML(obra||{nombre: state.selectedObraId}, items);
    downloadFile(`invobra-${(obra?.nombre||'obra')}.html`, 'text/html;charset=utf-8', html);
  };

  // Descargar reporte por categoría
  const btnCat = document.getElementById('downloadCatBtn');
  if (btnCat) btnCat.onclick = ()=>{
    const cat = downCat.value; const subt = (cat==='herramienta') ? downSub.value : 'all'; const brand = downMarca.value;
    const items = Cross.allItems.filter(i => (
      i.categoria===cat &&
      (cat!=='herramienta' || subt==='all' || i.subtipo===subt) &&
      (brand==='all' || i.marca===brand)
    ));
    const html = buildCategoryReportHTML(cat, subt, brand, items, Cross.obrasById);
    const name = `invobra-${cat}${cat==='herramienta'&&subt!=='all'?('-'+subt):''}${brand!=='all'?('-'+brand):''}.html`;
    downloadFile(name, 'text/html;charset=utf-8', html);
  };
}

// ============ Router: añade vista categorías y evita duplicados ============
(function enhanceRouter(){
  const views = {
    home: document.getElementById('view-home'),
    inventario: document.getElementById('view-inventario'),
    categorias: document.getElementById('view-categorias'),
    ayuda: document.getElementById('view-ayuda'),
    datos: document.getElementById('view-datos'),
  };
  const tabs = {
    home: document.getElementById('nav-home'),
    inventario: document.getElementById('nav-inventario'),
    categorias: document.getElementById('nav-categorias'),
    ayuda: document.getElementById('nav-ayuda'),
    datos: document.getElementById('nav-datos'),
  };
  function showView(name){
    Object.values(views).forEach(v=>v&&v.classList.add('hidden'));
    Object.values(tabs).forEach(t=>t&&t.classList.remove('active'));
    (views[name]||views.home)?.classList.remove('hidden');
    (tabs[name]||tabs.home)?.classList.add('active');
  }
  async function applyRoute(){
    const name = (location.hash.replace('#','')||'home');
    showView(name);
    if (name==='categorias') await initCategoriasView();
    if (name==='datos') await initDescargas();
  }
  window.addEventListener('hashchange', applyRoute);
  document.addEventListener('DOMContentLoaded', applyRoute);
})();



// =========================
// Init
// =========================
async function init(){
  try {
    state.obras = await DB.listObras();
  } catch {
    const data = Local.load(); state.obras = data.obras; state.items = data.items;
  }
  // Autocargar items si hay una obra seleccionada previamente
  const sel = qs('#obraSelect');
  state.selectedObraId = sel ? (sel.value || state.selectedObraId || (state.obras[0]?.id || '')) : (state.selectedObraId || state.obras[0]?.id || '');
  if (state.selectedObraId) {
    try { state.items = await DB.listItems(state.selectedObraId); } catch { /* offline */ }
  }
  // construir set de marcas desde items existentes
  state.items.forEach(it=>{ if(it.marca) BRANDS.add(it.marca); });
  renderObrasSelect(); renderBrandsSelect(); renderTable();
  const stf = qs('#subtipoFilter'); if (stf) stf.style.display = (state.filters.categoria==='herramienta') ? 'block' : 'none';
  const stg = qs('#subtipoGroup'); if (stg) stg.style.display = 'none';
  addEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
