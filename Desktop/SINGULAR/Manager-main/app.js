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
async function api(path, {method='GET', json}={}){
  const opts = { method, headers:{} };
  if(json!==undefined){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(json); }
  const res = await fetch(`${CONFIG.apiBase}${path}`);
  if(method!=='GET') return res.ok ? (res.status===204?null:res.json()) : Promise.reject(await res.json().catch(()=>({error:'API error'})));
  return res.ok ? res.json() : Promise.reject(await res.json().catch(()=>({error:'API error'})));
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

// =========================
// Proveedor híbrido (elige online y cae a local)
// =========================
const DB = {
  // WHY: Centralizamos aquí la decisión online/offline y mantenemos la UI intacta
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
    try { return await API.itemsList(obraId); } catch { return Local.load().items.filter(i=>i.obraId===obraId); }
  },
  async createItem(it){
    try { return await API.itemCreate({
      obra_id: it.obraId, nombre: it.nombre, categoria: it.categoria, subtipo: it.subtipo||null,
      cantidad: it.cantidad ?? 0, marca: it.marca||null, ubicacion: it.ubicacion||null, observaciones: it.observaciones||null
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
  const prev = sel.value;
  sel.innerHTML = `<option value="">— Seleccionar Obra —</option>` + state.obras.map(o=>`<option value="${o.id}">${o.nombre}</option>`).join('');
  sel.value = state.selectedObraId || prev || '';
  qs('#deleteObraBtn').disabled = !sel.value;
  qs('#editObraBtn').disabled = !sel.value;
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
    cantidad: 0,
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
    subtipo: data.categoria==='herramienta' ? data.subtipo : '', cantidad: 0, marca: data.marca?.trim()||'',
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
// Listeners
// =========================
function setupHowToToggle(){
  const btn = qs('#toggleHowToBtn');
  const panel = qs('#howTo');
  if(!btn || !panel) return;
  btn.setAttribute('aria-expanded','false');
  btn.addEventListener('click', ()=>{
    const hidden = panel.classList.contains('hidden');
    if(hidden){ show(panel); btn.setAttribute('aria-expanded','true'); }
    else { hide(panel); btn.setAttribute('aria-expanded','false'); }
  });
}

function addEventListeners(){
  setupHowToToggle();
  qs('#nuevaObraBtn').addEventListener('click', ()=> openObraModal());
  qs('#editObraBtn').addEventListener('click', ()=>{ const id=qs('#obraSelect').value; if(!id) return; const obra=state.obras.find(o=>o.id===id); openObraModal({mode:'edit', obra}); });
  qs('#deleteObraBtn').addEventListener('click', async ()=>{ const id=qs('#obraSelect').value; if(!id) return; if(confirm('¿Eliminar esta obra y todo su inventario?')) await deleteObra(id); });

  obraModal.addEventListener('click', (e)=>{ if(e.target.hasAttribute('data-close')) closeObraModal(); });
  obraModal.addEventListener('cancel', (e)=>{ e.preventDefault(); closeObraModal(); });
  qs('#obraForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const mode = qs('#obraNombre').dataset.mode || 'create';
    const id = qs('#obraNombre').dataset.id || '';
    const nombre = qs('#obraNombre').value;
    if(mode==='edit'){ await updateObra(id, nombre); closeObraModal(); }
    else { await createObra(nombre); closeObraModal(); }
  });

  qs('#obraSelect').addEventListener('change', async (e)=>{
    state.selectedObraId = e.target.value; renderObrasSelect();
    state.items = state.selectedObraId ? await DB.listItems(state.selectedObraId) : [];
    Local.save(); renderTable();
  });

  qs('#exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify({version:CONFIG.version, obras:state.obras, items:state.items}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `inventario-obras-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  qs('#importFile').addEventListener('change', async (e)=>{
    if(!e.target.files?.length) return;
    try{
      const txt = await e.target.files[0].text();
      const data = migrate(JSON.parse(txt));
      // subimos todo a la API si existe selección de obra después
      state.obras = data.obras; state.items = data.items; Local.save();
      toast('success','Importado localmente');
    }catch{ toast('error','Error al importar'); }
    e.target.value='';
  });

  qs('#itemCategoria').addEventListener('change', (e)=>{ qs('#subtipoGroup').style.display = (e.target.value==='herramienta') ? 'block' : 'none'; });
  qs('#itemMarca').addEventListener('change', (e)=>{ if(e.target.value==='__new__'){ show(qs('#marcaNuevaWrap')); qs('#itemMarcaNueva').focus(); } else { hide(qs('#marcaNuevaWrap')); } });

  qs('#itemForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); if(!state.selectedObraId){ toast('error','Selecciona una obra primero'); return; }
    if(state.editingItemId) await saveEditedItem(); else await saveNewItem();
  });
  qs('#cancelBtn').addEventListener('click', resetItemForm);

  qsa('input[name="categoria"]').forEach(r=>r.addEventListener('change',(e)=>{
    state.filters.categoria = e.target.value; renderTable();
    qs('#subtipoFilter').style.display = (state.filters.categoria==='herramienta') ? 'block' : 'none';
  }));
  qsa('input[name="subtipo"]').forEach(r=>r.addEventListener('change',(e)=>{ state.filters.subtipo = e.target.value; renderTable(); }));
  qs('#searchInput').addEventListener('input',(e)=>{ state.filters.search = e.target.value; renderTable(); });

  qs('#tableBody').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const tr = e.target.closest('tr'); const id = tr?.dataset.id; if(!id) return;
    const action = btn.dataset.action; const item = state.items.find(i=>i.id===id);
    if(action==='inc'){ item.cantidad = (item.cantidad||0) + 1; await DB.updateItem(id, { cantidad: item.cantidad }); renderTable(); }
    if(action==='dec'){ item.cantidad = Math.max(0, (item.cantidad||0) - 1); await DB.updateItem(id, { cantidad: item.cantidad }); renderTable(); }
    if(action==='delete'){ if(confirm('¿Eliminar ítem?')){ await DB.deleteItem(id); state.items = await DB.listItems(state.selectedObraId); renderTable(); } }
    if(action==='edit'){
      state.editingItemId = id;
      qs('#formTitle').textContent = 'Editar Ítem';
      qs('#submitBtn').textContent = 'Guardar Cambios';
      qs('#itemNombre').value = item.nombre;
      qs('#itemCategoria').value = item.categoria;
      qs('#subtipoGroup').style.display = (item.categoria==='herramienta') ? 'block' : 'none';
      qs('#itemSubtipo').value = item.subtipo || '';
      renderBrandsSelect();
      if(BRANDS.has(item.marca)){ qs('#itemMarca').value = item.marca; hide(qs('#marcaNuevaWrap')); }
      else if(item.marca){ qs('#itemMarca').value='__new__'; show(qs('#marcaNuevaWrap')); qs('#itemMarcaNueva').value=item.marca; }
      else { qs('#itemMarca').value=''; hide(qs('#marcaNuevaWrap')); }
      qs('#itemUbicacion').value = item.ubicacion || '';
      qs('#itemObservaciones').value = item.observaciones || '';
      window.scrollTo({top:0, behavior:'smooth'});
    }
  });
}

// =========================
// Init
// =========================
async function init(){
  try{
    state.obras = await DB.listObras();
  }catch{
    const data = Local.load(); state.obras = data.obras; state.items = data.items;
  }
  // sincroniza marcas del histórico
  state.items.forEach(it=>{ if(it.marca) BRANDS.add(it.marca); });
  renderObrasSelect(); renderBrandsSelect(); renderTable();
  qs('#subtipoFilter').style.display = (state.filters.categoria==='herramienta') ? 'block' : 'none';
  qs('#subtipoGroup').style.display = 'none';
  addEventListeners();
}
init();
