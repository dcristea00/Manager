// ========================================================
// INVOBRA - Día/Noche + Inicio (fotos) + Inventario compacto + Categorías
// ========================================================

// ---------- Utils ----------
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');
function escapeHtml(s){ return String(s||'').replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]); }
function group(arr, fn){ return arr.reduce((m,x)=>{ const k=fn(x); (m[k]??=[]).push(x); return m; },{}); }
function downloadFile(name, mime, content){ const blob = new Blob([content],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function fmtDate(d=new Date()){ return d.toLocaleString('es-ES',{hour12:false}); }

function toast(type, msg){
  const box = qs('#alertContainer'); if(!box) return;
  box.textContent = msg;
  box.style.color = type==='error' ? '#ff8a8a' : '#b2f5bf';
  setTimeout(()=>{ box.textContent=''; }, 2500);
}

// ---------- Estado ----------
const state = {
  obras: [],
  items: [], // solo de obra seleccionada
  selectedObraId: localStorage.getItem('obraId') || '',
  editingItemId: '',
};
const BRANDS = new Set();
const obraImages = JSON.parse(localStorage.getItem('obraImages')||'{}');

// ---------- API ----------
const API = {
  async obrasList(){ const r=await fetch('/.netlify/functions/obras'); if(!r.ok) throw new Error('Obras'); return r.json(); },
  async obraCreate(nombre){ const r=await fetch('/.netlify/functions/obras',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre})}); if(r.status===409) throw new Error('Duplicado'); if(!r.ok) throw new Error('Crear obra'); return r.json(); },
  async obraUpdate(id,nombre){ const r=await fetch(`/.netlify/functions/obras?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre})}); if(!r.ok) throw new Error('Actualizar obra'); return r.json(); },
  async obraDelete(id){ const r=await fetch(`/.netlify/functions/obras?id=${encodeURIComponent(id)}`,{method:'DELETE'}); if(!r.ok) throw new Error('Eliminar obra'); return true; },
  async itemsByObra(obraId){ const r=await fetch(`/.netlify/functions/items?obraId=${encodeURIComponent(obraId)}`); if(!r.ok) throw new Error('Items'); return r.json(); },
  async itemsAll(){ const r=await fetch('/.netlify/functions/items'); if(!r.ok) throw new Error('Items all'); return r.json(); },
  async itemCreate(payload){ const r=await fetch('/.netlify/functions/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('Crear item'); return r.json(); },
  async itemUpdate(id, payload){ const r=await fetch(`/.netlify/functions/items?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('Actualizar item'); return r.json(); },
  async itemDelete(id){ const r=await fetch(`/.netlify/functions/items?id=${encodeURIComponent(id)}`,{method:'DELETE'}); if(!r.ok) throw new Error('Eliminar item'); return true; },
};

// ---------- Inicio ----------
window.addEventListener('DOMContentLoaded', init);
async function init(){
  applyTheme(localStorage.getItem('theme')||'dark');
  bindListeners();
  await loadObras();
  renderObrasSelect();
  if (state.selectedObraId) await loadInventario();
  applyRoute();
}

// ---------- Listeners ----------
let __bound=false;
function bindListeners(){ if(__bound) return; __bound=true;
  // Tema
  qs('#themeToggleBtn')?.addEventListener('click', ()=>{
    const next = (document.documentElement.getAttribute('data-theme')==='light')?'dark':'light';
    applyTheme(next);
  });

  // Toolbar obras
  qs('#nuevaObraBtn')?.addEventListener('click', ()=> openObraModal());
  qs('#editObraBtn')?.addEventListener('click', ()=>{ const id=state.selectedObraId; if(!id) return; const obra=state.obras.find(o=>o.id===id); openObraModal({mode:'edit', obra}); });
  qs('#deleteObraBtn')?.addEventListener('click', async ()=>{ const id=state.selectedObraId; if(!id) return; if(confirm('¿Eliminar esta obra y todo su inventario?')){ await API.obraDelete(id); state.selectedObraId=''; state.items=[]; await loadObras(); renderObrasSelect(); renderObraInfo(); renderTable(); }});
  qs('#obraSelect')?.addEventListener('change', async (e)=>{ state.selectedObraId = e.target.value; localStorage.setItem('obraId', state.selectedObraId||''); renderObrasSelect(); await loadInventario(); renderObraInfo(); });

  // Modal obras
  const modal = qs('#obraModal');
  modal?.addEventListener('click', (e)=>{ if(e.target.classList?.contains('close-btn')) closeObraModal(); });
  modal?.addEventListener('cancel', (e)=>{ e.preventDefault(); closeObraModal(); });
  qs('#obraCancelBtn')?.addEventListener('click', closeObraModal);
  qs('#obraForm')?.addEventListener('submit', async (e)=>{ e.preventDefault(); await submitObraForm(); });

  // Form ítem (Añadir)
  qs('#itemForm')?.addEventListener('submit', async (e)=>{ e.preventDefault(); if(!state.selectedObraId){ toast('error','Selecciona una obra'); return; } await saveNewItem(); });
  qs('#itemCategoria')?.addEventListener('change', (e)=>{ const stg=qs('#subtipoGroup'); if(stg) stg.style.display = (e.target.value==='herramienta') ? 'block' : 'none'; });
  qs('#itemMarca')?.addEventListener('change', (e)=>{ const wrap=qs('#marcaNuevaWrap'); if(!wrap) return; if(e.target.value==='__new__'){ show(wrap); qs('#itemMarcaNueva')?.focus(); } else hide(wrap); });
  qs('#cancelBtn')?.addEventListener('click', resetItemForm);

  // Tabla inventario
  qs('#tableBody')?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const tr = btn.closest('tr'); const id = tr?.dataset.id; if(!id) return;
    const action = btn.dataset.action; const item = state.items.find(i=>i.id===id); if(!item) return;

    if(action==='delete'){
      if(!confirm('¿Eliminar ítem?')) return; await API.itemDelete(id); await loadInventario(); return;
    }
    if(action==='edit'){
      state.editingItemId = id; renderTable(); return;
    }
    if(action==='save'){
      const payload = collectRowEdits(tr, item);
      await API.itemUpdate(id, payload);
      // ¿se movió de obra?
      if(payload.obra_id && payload.obra_id !== state.selectedObraId){ toast('ok','Ítem movido a otra obra'); }
      state.editingItemId=''; await loadInventario(); return;
    }
    if(action==='cancel'){
      state.editingItemId=''; renderTable(); return;
    }
  });

  // Router
  window.addEventListener('hashchange', applyRoute);
}

function applyTheme(mode){
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  const use = qs('#themeIcon'); if(use) use.setAttribute('href', mode==='light' ? '#i-moon' : '#i-sun');
}

// ---------- Obras ----------
async function loadObras(){ try{ state.obras = await API.obrasList(); }catch{ toast('error','No se pudieron cargar obras'); } }
function renderObrasSelect(){
  const sel = qs('#obraSelect'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar Obra —</option>` + state.obras.map(o=>`<option value="${o.id}" ${o.id===state.selectedObraId?'selected':''}>${escapeHtml(o.nombre)}</option>`).join('');
}

function openObraModal({mode='create', obra=null}={}){
  const m = qs('#obraModal'); const name = qs('#obraNombre'); const delBtn = qs('#obraDeleteBtn');
  name.value = obra?.nombre || ''; name.dataset.mode = mode; name.dataset.id = obra?.id || '';
  qs('#obraModalTitle').textContent = mode==='edit' ? 'Editar Obra' : 'Nueva Obra';
  if(mode==='edit'){ show(delBtn); delBtn.onclick = async ()=>{ if(confirm('¿Eliminar esta obra y su inventario?')){ await API.obraDelete(obra.id); closeObraModal(); await loadObras(); state.selectedObraId=''; renderObrasSelect(); state.items=[]; renderObraInfo(); renderTable(); } }; }
  else { hide(delBtn); delBtn.onclick=null; }
  m.showModal();
}
function closeObraModal(){ qs('#obraModal')?.close(); }
async function submitObraForm(){
  const nameEl = qs('#obraNombre'); const nombre = nameEl.value.trim(); if(!nombre){ qs('#obraNombre-error').textContent='Nombre requerido'; return; }
  const mode = nameEl.dataset.mode||'create'; const id = nameEl.dataset.id||'';
  try{
    if(mode==='edit'){ await API.obraUpdate(id, nombre); toast('ok','Obra actualizada'); }
    else { const o = await API.obraCreate(nombre); state.selectedObraId = o.id; localStorage.setItem('obraId', o.id); toast('ok','Obra creada'); }
    closeObraModal(); await loadObras(); renderObrasSelect(); await loadInventario(); renderObraInfo();
  }catch(e){ toast('error', e.message||'Error obra'); }
}

// ---------- Inventario ----------
async function loadInventario(){
  if(!state.selectedObraId){ state.items=[]; renderObraInfo(); renderTable(); return; }
  try{ state.items = await API.itemsByObra(state.selectedObraId); }catch{ state.items=[]; toast('error','No se pudo cargar inventario'); }
  BRANDS.clear(); state.items.forEach(i=>{ if(i.marca) BRANDS.add(i.marca); });
  renderBrandsSelect(); renderObraInfo(); renderTable();
}

function renderObraInfo(){
  const box = qs('#obraInfo'); if(!box) return;
  if(!state.selectedObraId){ box.innerHTML = '<div class="muted">Selecciona una obra para ver su resumen.</div>'; return; }
  const obra = state.obras.find(o=>o.id===state.selectedObraId); const items = state.items;
  const total = items.length; const unidades = items.reduce((s,i)=>s+(i.cantidad||0),0);
  const cats = Object.entries(group(items, i=>i.categoria)).map(([k,v])=>`${k}: ${v.length}`).join(' · ')||'—';
  const subs = Object.entries(group(items.filter(i=>i.categoria==='herramienta'), i=>i.subtipo||'—')).map(([k,v])=>`${k}: ${v.length}`).join(' · ')||'—';
  box.innerHTML = `
    <div class="row between"><h2 style="margin:0">${escapeHtml(obra?.nombre||'Obra')}</h2><div class="chips"><span class="chip">Ítems ${total}</span><span class="chip">Unid. ${unidades}</span></div></div>
    <div class="muted" style="margin-top:6px">Categorías: ${escapeHtml(cats)}<br/>Subtipos: ${escapeHtml(subs)}</div>
  `;
}

function renderBrandsSelect(){
  const sel = qs('#itemMarca'); if(!sel) return;
  const opts = ['<option value="">—</option><option value="__new__">Nueva marca…</option>']
    .concat([...BRANDS].sort().map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`));
  sel.innerHTML = opts.join('');
}

async function saveNewItem(){
  const cat = qs('#itemCategoria').value;
  const marcaSel = qs('#itemMarca').value;
  const payload = {
    obra_id: state.selectedObraId,
    nombre: qs('#itemNombre').value.trim(),
    categoria: cat,
    subtipo: cat==='herramienta' ? (qs('#itemSubtipo').value||null) : null,
    cantidad: Math.max(0, parseInt(qs('#itemCantidad').value,10) || 0),
    marca: (marcaSel==='__new__' ? (qs('#itemMarcaNueva').value.trim()) : marcaSel) || '',
    ubicacion: qs('#itemUbicacion').value.trim() || '',
    observaciones: qs('#itemObservaciones').value.trim() || ''
  };
  if(!payload.nombre || !payload.categoria || !payload.marca){ toast('error','Completa nombre, categoría y marca'); return; }
  try{ await API.itemCreate(payload); await loadInventario(); resetItemForm(); toast('ok','Ítem agregado'); }
  catch{ toast('error','No se pudo agregar'); }
}

function resetItemForm(){ ['itemNombre','itemCategoria','itemSubtipo','itemMarca','itemMarcaNueva','itemCantidad','itemUbicacion','itemObservaciones']
  .forEach(id=>{ const el=qs('#'+id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value= (id==='itemCantidad'?'1':''); }); hide(qs('#marcaNuevaWrap'));
}

function renderTable(){
  const tbody = qs('#tableBody'); const visEl = qs('#visibleCount'); const totEl = qs('#totalCount');
  if(!tbody) return;
  const total = state.items.length; let items = [...state.items];
  visEl && (visEl.textContent = String(items.length));
  totEl && (totEl.textContent = String(total));
  if(!state.selectedObraId){ tbody.innerHTML = '<tr><td colspan="8" class="empty">Selecciona una obra…</td></tr>'; return; }
  if(items.length===0){ tbody.innerHTML = '<tr><td colspan="8" class="empty">Sin resultados</td></tr>'; return; }
  tbody.innerHTML = items.map(i=> state.editingItemId===i.id ? rowEditHTML(i) : rowReadHTML(i) ).join('');
}

function rowReadHTML(i){
  return `<tr data-id="${i.id}">
    <td>${escapeHtml(i.nombre)}</td>
    <td>${i.categoria}</td>
    <td>${i.subtipo||'—'}</td>
    <td><strong>${i.cantidad||0}</strong></td>
    <td>${escapeHtml(i.marca||'')}</td>
    <td>${escapeHtml(i.ubicacion||'')}</td>
    <td>${escapeHtml(i.observaciones||'')}</td>
    <td><div class="row"><button class="btn" data-action="edit">Editar</button><button class="btn danger" data-action="delete">Eliminar</button></div></td>
  </tr>`;
}

function rowEditHTML(i){
  const obrasOpts = state.obras.map(o=>`<option value="${o.id}" ${o.id===i.obra_id?'selected':''}>${escapeHtml(o.nombre)}</option>`).join('');
  return `<tr data-id="${i.id}">
    <td><input value="${escapeHtml(i.nombre)}" data-f="nombre" /></td>
    <td>
      <select data-f="categoria">
        <option value="herramienta" ${i.categoria==='herramienta'?'selected':''}>herramienta</option>
        <option value="material" ${i.categoria==='material'?'selected':''}>material</option>
      </select>
    </td>
    <td>
      <select data-f="subtipo">
        <option value="" ${!i.subtipo?'selected':''}>—</option>
        <option value="electrica" ${i.subtipo==='electrica'?'selected':''}>electrica</option>
        <option value="manual" ${i.subtipo==='manual'?'selected':''}>manual</option>
      </select>
    </td>
    <td><input type="number" min="0" value="${i.cantidad||0}" data-f="cantidad" /></td>
    <td><input value="${escapeHtml(i.marca||'')}" data-f="marca" /></td>
    <td><input value="${escapeHtml(i.ubicacion||'')}" data-f="ubicacion" /></td>
    <td><input value="${escapeHtml(i.observaciones||'')}" data-f="observaciones" /></td>
    <td>
      <div class="row wrap">
        <select data-f="obra_id">${obrasOpts}</select>
        <button class="btn" data-action="save">Guardar</button>
        <button class="btn ghost" data-action="cancel">Cancelar</button>
      </div>
    </td>
  </tr>`;
}

function collectRowEdits(tr, original){
  const get = sel => tr.querySelector(sel);
  const cat = get('select[data-f="categoria"]').value;
  const payload = {
    nombre: get('input[data-f="nombre"]').value.trim(),
    categoria: cat,
    subtipo: cat==='herramienta' ? (get('select[data-f="subtipo"]').value||null) : null,
    cantidad: Math.max(0, parseInt(get('input[data-f="cantidad"]').value,10)||0),
    marca: get('input[data-f="marca"]').value.trim(),
    ubicacion: get('input[data-f="ubicacion"]').value.trim(),
    observaciones: get('input[data-f="observaciones"]').value.trim(),
  };
  const obraId = get('select[data-f="obra_id"]').value; if(obraId && obraId!==original.obra_id) payload.obra_id = obraId;
  return payload;
}

// ---------- Inicio (grid de obras) ----------
function renderInicio(){
  const grid = qs('#inicioGrid'); if(!grid) return;
  if(!state.obras.length){ grid.innerHTML='<div class="muted">No hay obras. Crea una con el botón "Nueva".</div>'; return; }
  grid.innerHTML = state.obras.map(o=>{
    const img = obraImages[o.id] || '';
    return `<div class="card-obra" data-obra="${o.id}">
      <img src="${img||'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 400 200\'><rect width=\'400\' height=\'200\' fill=\'%23cfe0f5\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%233d5a80\' font-family=\'Arial\' font-size=\'22\'>Sin foto</text></svg>'}" alt="${escapeHtml(o.nombre)}" />
      <button class="btn change" data-action="foto" title="Cambiar foto"><svg class="i"><use href="#i-camera"/></svg></button>
      <div class="meta">${escapeHtml(o.nombre)}</div>
      <input type="file" accept="image/*" class="hidden" />
    </div>`;
  }).join('');

  grid.onclick = (e)=>{
    const card = e.target.closest('.card-obra'); if(!card) return;
    const id = card.dataset.obra;
    const change = e.target.closest('[data-action="foto"]');
    if(change){
      const input = card.querySelector('input[type="file"]');
      input.onchange = async ()=>{
        const f = input.files?.[0]; if(!f) return;
        const fr = new FileReader(); fr.onload = ()=>{ obraImages[id]=fr.result; localStorage.setItem('obraImages', JSON.stringify(obraImages)); renderInicio(); };
        fr.readAsDataURL(f);
      };
      input.click();
      return;
    }
    // navegar a Añadir con obra seleccionada
    state.selectedObraId = id; localStorage.setItem('obraId', id); renderObrasSelect(); loadInventario(); location.hash = '#anadir';
  };
}

// ---------- Categorías ----------
// 1) Cargar datos transversales (todas las obras + todos los ítems)
const Cross = { allItems:null, obrasById:new Map(), brands:new Set() };

async function ensureCrossData(){
  if(!state.obras?.length){
    try { state.obras = await API.obrasList(); } catch {}
  }
  Cross.obrasById = new Map(state.obras.map(o => [o.id, o]));

  // Intento 1: endpoint de todos los ítems
  try {
    const arr = await API.itemsAll();
    if (!Array.isArray(arr)) throw new Error('bad payload');
    Cross.allItems = arr;
  } catch {
    // Fallback: juntar ítems obra por obra
    const packs = await Promise.all(
      state.obras.map(o => API.itemsByObra(o.id).catch(() => []))
    );
    Cross.allItems = packs.flat();
  }
  Cross.brands = new Set(Cross.allItems.map(i => i.marca).filter(Boolean));
}

// 2) Inicializar vista Categorías (con filtro de Obra)
async function initCategoriasView(){
  await ensureCrossData();

  const obraSel   = qs('#catObra');
  const catSel    = qs('#catCategoria');
  const subWrap   = qs('#catSubtipoWrap');
  const subSel    = qs('#catSubtipo');
  const marcaSel  = qs('#catMarca');

  // Poblar obras y marcas (globales)
  if (obraSel) {
    obraSel.innerHTML =
      '<option value="all">Todas</option>' +
      state.obras.map(o => `<option value="${o.id}">${escapeHtml(o.nombre)}</option>`).join('');
  }
  if (marcaSel) {
    marcaSel.innerHTML =
      '<option value="all">Todas</option>' +
      [...Cross.brands].sort().map(b => `<option>${escapeHtml(b)}</option>`).join('');
  }

  function toggleSubtipo(){
    subWrap.style.display = (catSel.value === 'herramienta') ? 'inline-block' : 'none';
  }

  function apply(){
    const obra  = obraSel?.value || 'all';
    const cat   = catSel.value;                         // herramienta | material
    const subt  = (cat === 'herramienta') ? subSel.value : 'all';  // all | electrica | manual
    const brand = marcaSel.value;                       // all | marca

    const filtered = Cross.allItems.filter(i =>
      (obra === 'all' || i.obra_id === obra) &&
      i.categoria === cat &&
      (cat !== 'herramienta' || subt === 'all' || i.subtipo === subt) &&
      (brand === 'all' || i.marca === brand)
    );
    renderCatResults(filtered, { obra, cat, subt, brand });
  }

  catSel.onchange    = () => { toggleSubtipo(); apply(); };
  subSel.onchange    = apply;
  marcaSel.onchange  = apply;
  obraSel.onchange   = apply;

  toggleSubtipo();
  apply();
}

// 3) Render compacto de resultados (totales por obra)
function renderCatResults(items, { obra, cat, subt, brand }){
  const box = qs('#catResults');
  const sum = qs('#catSummary');

  const totalItems  = items.length;
  const totalUnits  = items.reduce((s, i) => s + (i.cantidad || 0), 0);
  sum.textContent = `Ítems: ${totalItems} · Unidades: ${totalUnits}`;

  // Agrupar por obra (si 'obra' = all); si está fijada una obra, solo esa card
  let groups;
  if (obra === 'all') {
    groups = Object.entries(items.reduce((m, i) => {
      const key = Cross.obrasById.get(i.obra_id)?.nombre || i.obra_id;
      (m[key] ??= []).push(i);
      return m;
    }, {}));
  } else {
    const name = Cross.obrasById.get(obra)?.nombre || obra;
    groups = [[name, items]];
  }

  // Utilidades de conteo
  const count = (arr, fn) => arr.reduce((m, x) => { const k = fn(x) || '—'; m[k] = (m[k]||0) + 1; return m; }, {});
  const sumUn = (arr, fn) => arr.reduce((m, x) => { const k = fn(x) || '—'; m[k] = (m[k]||0) + (x.cantidad||0); return m; }, {});

  const html = groups.map(([obraNombre, arr]) => {
    const itemsN   = arr.length;
    const unitsN   = arr.reduce((s, i) => s + (i.cantidad || 0), 0);

    // Desglose según filtros actuales (compacto, sólo números)
    let extra = '';
    if (cat === 'herramienta' && subt === 'all') {
      const bySubItems = count(arr, i => i.subtipo);
      const bySubUnits = sumUn(arr, i => i.subtipo);
      const e  = bySubItems['electrica'] || 0,  em = bySubUnits['electrica'] || 0;
      const m  = bySubItems['manual']    || 0,  mm = bySubUnits['manual']    || 0;
      extra = `<div class="muted">Subtipos: Eléctrica ${e} (${em}) · Manual ${m} (${mm})</div>`;
    }

    if (brand === 'all') {
      const byBrand = count(arr, i => i.marca);
      // Top 6 marcas (solo número de ítems, para mantenerlo breve)
      const top = Object.entries(byBrand)
        .sort((a,b)=>b[1]-a[1]).slice(0,6)
        .map(([k,v])=>`${escapeHtml(k)} ${v}`).join(' · ');
      if (top) extra += `<div class="muted">Marcas: ${top}</div>`;
    } else {
      const brandItems = arr.filter(i => i.marca === brand);
      const brandUnits = brandItems.reduce((s,i)=>s+(i.cantidad||0),0);
      extra += `<div class="muted">Marca ${escapeHtml(brand)}: ${brandItems.length} (${brandUnits})</div>`;
    }

    return `
      <div class="card">
        <div class="row between">
          <h3 style="margin:0">${escapeHtml(obraNombre)}</h3>
          <div class="chips">
            <span class="chip">Ítems ${itemsN}</span>
            <span class="chip">Unid. ${unitsN}</span>
          </div>
        </div>
        ${extra}
      </div>
    `;
  }).join('') || '<div class="muted">Sin resultados</div>';

  box.innerHTML = html;
}


// ---------- Router ----------
function showView(name){
  const views = { inicio:'#view-inicio', anadir:'#view-anadir', inventario:'#view-inventario', categorias:'#view-categorias', precios:'#view-precios', datos:'#view-datos' };
  Object.values(views).forEach(sel=> hide(qs(sel)) );
  show(qs(views[name]||'#view-inicio'));
  qsa('.tab').forEach(t=>t.classList.remove('active')); qs('#nav-'+name)?.classList.add('active');
  // Ocultar toolbar obra en vistas que no la usan
  const hideTb = (name==='inicio' || name==='categorias' || name==='precios' || name==='datos');
  document.body.classList.toggle('hide-toolbar', hideTb);
}
async function applyRoute(){ const name = (location.hash.replace('#','')||'inicio'); showView(name); if(name==='inicio') renderInicio(); if(name==='anadir'){} if(name==='inventario'){} if(name==='categorias') await initCategoriasView(); }