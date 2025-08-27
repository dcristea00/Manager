// ========================================================
// INVOBRA - Frontend limpio (listeners únicos + router + categorías + export HTML)
// ========================================================

// ---------- Utils ----------
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');

function toast(type, msg){
  const box = qs('#alertContainer'); if(!box) return;
  box.textContent = msg;
  box.style.color = type==='error' ? '#ffb4b4' : '#b2f5bf';
  setTimeout(()=>{ box.textContent=''; }, 2500);
}

function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ---------- Estado ----------
const state = {
  obras: [],
  items: [], // de la obra seleccionada
  selectedObraId: '',
  editingItemId: '',
  filters: { categoria:'all', subtipo:'all', search:'' }
};
const BRANDS = new Set();

// ---------- API ----------
const API = {
  async obrasList(){ const r=await fetch('/.netlify/functions/obras'); if(!r.ok) throw new Error('Obras'); return r.json(); },
  async obraCreate(nombre){ const r=await fetch('/.netlify/functions/obras',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre})}); if(r.status===409){ throw new Error('Duplicado'); } if(!r.ok) throw new Error('Crear obra'); return r.json(); },
  async obraUpdate(id,nombre){ const r=await fetch(`/.netlify/functions/obras?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre})}); if(!r.ok) throw new Error('Actualizar obra'); return r.json(); },
  async obraDelete(id){ const r=await fetch(`/.netlify/functions/obras?id=${encodeURIComponent(id)}`,{method:'DELETE'}); if(!r.ok) throw new Error('Eliminar obra'); return true; },

  async itemsByObra(obraId){ const r=await fetch(`/.netlify/functions/items?obraId=${encodeURIComponent(obraId)}`); if(!r.ok) throw new Error('Items'); return r.json(); },
  async itemsAll(){ const r=await fetch('/.netlify/functions/items'); if(!r.ok) throw new Error('Items all'); return r.json(); },
  async itemCreate(payload){ const r=await fetch('/.netlify/functions/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('Crear item'); return r.json(); },
  async itemUpdate(id, payload){ const r=await fetch(`/.netlify/functions/items?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('Actualizar item'); return r.json(); },
  async itemDelete(id){ const r=await fetch(`/.netlify/functions/items?id=${encodeURIComponent(id)}`,{method:'DELETE'}); if(!r.ok) throw new Error('Eliminar item'); return true; },
};

// ---------- Inicialización ----------
window.addEventListener('DOMContentLoaded', init);

async function init(){
  bindListeners();
  await loadObras();
  const last = localStorage.getItem('obraId');
  if (last && state.obras.some(o=>o.id===last)) state.selectedObraId = last;
  renderObrasSelect();
  if (state.selectedObraId) await loadInventario();
  applyRoute();
}

// ---------- Listeners (únicos) ----------
let __bound = false;
function bindListeners(){ if(__bound) return; __bound = true;
  // Obras header
  qs('#nuevaObraBtn')?.addEventListener('click', ()=> openObraModal());
  qs('#editObraBtn')?.addEventListener('click', ()=>{ const id=state.selectedObraId; if(!id) return; const obra=state.obras.find(o=>o.id===id); openObraModal({mode:'edit', obra}); });
  qs('#deleteObraBtn')?.addEventListener('click', async ()=>{ const id=state.selectedObraId; if(!id) return; if(confirm('¿Eliminar esta obra y todo su inventario?')){ await API.obraDelete(id); state.selectedObraId=''; state.items=[]; await loadObras(); renderObrasSelect(); renderTable(); }});
  qs('#obraSelect')?.addEventListener('change', async (e)=>{ state.selectedObraId = e.target.value; localStorage.setItem('obraId', state.selectedObraId||''); renderObrasSelect(); await loadInventario(); });

  // Modal obras
  const modal = qs('#obraModal');
  modal?.addEventListener('click', (e)=>{ if(e.target.classList?.contains('close-btn')) closeObraModal(); });
  modal?.addEventListener('cancel', (e)=>{ e.preventDefault(); closeObraModal(); });
  qs('#obraCancelBtn')?.addEventListener('click', closeObraModal);
  qs('#obraForm')?.addEventListener('submit', async (e)=>{ e.preventDefault(); await submitObraForm(); });

  // Form ítem (Home)
  qs('#itemForm')?.addEventListener('submit', async (e)=>{ e.preventDefault(); if(!state.selectedObraId){ toast('error','Selecciona una obra'); return; } await saveNewItem(); });
  qs('#itemCategoria')?.addEventListener('change', (e)=>{ const stg=qs('#subtipoGroup'); if(stg) stg.style.display = (e.target.value==='herramienta') ? 'block' : 'none'; });
  qs('#itemMarca')?.addEventListener('change', (e)=>{ const wrap=qs('#marcaNuevaWrap'); if(!wrap) return; if(e.target.value==='__new__'){ show(wrap); qs('#itemMarcaNueva')?.focus(); } else hide(wrap); });
  qs('#cancelBtn')?.addEventListener('click', resetItemForm);

  // Tabla inventario (delegación)
  qs('#tableBody')?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const tr = btn.closest('tr'); const id = tr?.dataset.id; if(!id) return;
    const action = btn.dataset.action; const item = state.items.find(i=>i.id===id); if(!item) return;
    if(action==='inc' || action==='dec'){
      item.cantidad = Math.max(0, (item.cantidad||0) + (action==='inc'?1:-1));
      await API.itemUpdate(id, { cantidad:item.cantidad });
      renderTable(); return;
    }
    if(action==='delete'){
      if(!confirm('¿Eliminar ítem?')) return; await API.itemDelete(id); await loadInventario(); return;
    }
    if(action==='edit'){
      // Edición inline simple: por ahora únicamente nombre/marca/observaciones
      const nuevo = prompt('Nuevo nombre', item.nombre); if(nuevo===null) return;
      await API.itemUpdate(id, { nombre:nuevo }); await loadInventario(); return;
    }
  });

  // Router
  window.addEventListener('hashchange', applyRoute);
}

// ---------- Obras ----------
async function loadObras(){ try{ state.obras = await API.obrasList(); }catch{ toast('error','No se pudieron cargar obras'); } }
function renderObrasSelect(){
  const sel = qs('#obraSelect'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar Obra —</option>` +
    state.obras.map(o=>`<option value="${o.id}" ${o.id===state.selectedObraId?'selected':''}>${escapeHtml(o.nombre)}</option>`).join('');
}

function openObraModal({mode='create', obra=null}={}){
  const m = qs('#obraModal'); const name = qs('#obraNombre'); const delBtn = qs('#obraDeleteBtn');
  name.value = obra?.nombre || ''; name.dataset.mode = mode; name.dataset.id = obra?.id || '';
  qs('#obraModalTitle').textContent = mode==='edit' ? 'Editar Obra' : 'Nueva Obra';
  if(mode==='edit'){ show(delBtn); delBtn.onclick = async ()=>{ if(confirm('¿Eliminar esta obra y su inventario?')){ await API.obraDelete(obra.id); closeObraModal(); await loadObras(); state.selectedObraId=''; renderObrasSelect(); state.items=[]; renderTable(); } }; }
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
    closeObraModal(); await loadObras(); renderObrasSelect(); await loadInventario();
  }catch(e){ toast('error', e.message||'Error obra'); }
}

// ---------- Ítems ----------
async function loadInventario(){
  if(!state.selectedObraId){ state.items=[]; renderTable(); return; }
  try{ state.items = await API.itemsByObra(state.selectedObraId); }catch{ state.items=[]; toast('error','No se pudo cargar inventario'); }
  // marcas
  BRANDS.clear(); state.items.forEach(i=>{ if(i.marca) BRANDS.add(i.marca); });
  renderBrandsSelect(); renderTable();
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
  const marcaNueva = qs('#itemMarcaNueva').value.trim();
  const payload = {
    obra_id: state.selectedObraId,
    nombre: qs('#itemNombre').value.trim(),
    categoria: cat,
    subtipo: cat==='herramienta' ? (qs('#itemSubtipo').value||null) : null,
    cantidad: 1,
    marca: (marcaSel==='__new__' ? marcaNueva : marcaSel) || '',
    ubicacion: qs('#itemUbicacion').value.trim() || '',
    observaciones: qs('#itemObservaciones').value.trim() || ''
  };
  if(!payload.nombre || !payload.categoria || !payload.marca){ toast('error','Completa nombre, categoría y marca'); return; }
  try{ await API.itemCreate(payload); await loadInventario(); resetItemForm(); toast('ok','Ítem agregado'); }
  catch{ toast('error','No se pudo agregar'); }
}

function resetItemForm(){ ['itemNombre','itemCategoria','itemSubtipo','itemMarca','itemMarcaNueva','itemUbicacion','itemObservaciones']
  .forEach(id=>{ const el=qs('#'+id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; }); hide(qs('#marcaNuevaWrap'));
}

function renderTable(){
  const tbody = qs('#tableBody'); const visEl = qs('#visibleCount'); const totEl = qs('#totalCount');
  if(!tbody) return;
  const total = state.items.length; let items = [...state.items];
  // (si en el futuro reactivas filtros, aplicar aquí)
  visEl && (visEl.textContent = String(items.length));
  totEl && (totEl.textContent = String(total));
  if(!state.selectedObraId){ tbody.innerHTML = '<tr><td colspan="8" class="empty">Selecciona una obra…</td></tr>'; return; }
  if(items.length===0){ tbody.innerHTML = '<tr><td colspan="8" class="empty">Sin resultados</td></tr>'; return; }
  tbody.innerHTML = items.map(i=>`
    <tr data-id="${i.id}">
      <td>${escapeHtml(i.nombre)}</td>
      <td>${i.categoria}</td>
      <td>${i.subtipo||'—'}</td>
      <td>
        <div class="row">
          <button class="btn" data-action="dec">−</button>
          <strong>${i.cantidad||0}</strong>
          <button class="btn" data-action="inc">+</button>
        </div>
      </td>
      <td>${escapeHtml(i.marca||'')}</td>
      <td>${escapeHtml(i.ubicacion||'')}</td>
      <td>${escapeHtml(i.observaciones||'')}</td>
      <td>
        <div class="row">
          <button class="btn" data-action="edit">Editar</button>
          <button class="btn danger" data-action="delete">Eliminar</button>
        </div>
      </td>
    </tr>`).join('');
}

// ---------- Export bonito + Categorías ----------
const Cross = { allItems:null, obrasById:new Map(), brands:new Set() };
async function ensureCrossData(){
  if(!state.obras?.length){ try{ state.obras = await API.obrasList(); }catch{} }
  Cross.obrasById = new Map(state.obras.map(o=>[o.id,o]));
  if(!Cross.allItems){ try{ Cross.allItems = await API.itemsAll(); }catch{ Cross.allItems = []; } }
  Cross.brands = new Set(Cross.allItems.map(i=>i.marca).filter(Boolean));
}

function downloadFile(name, mime, content){ const blob = new Blob([content],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function esc(s){return String(s||'').replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c])}
function group(arr, fn){ return arr.reduce((m,x)=>{ const k=fn(x); (m[k]??=[]).push(x); return m; },{}); }
function fmtDate(d=new Date()){ return d.toLocaleString('es-ES',{hour12:false}); }

function buildObraReportHTML(obra, items){
  const total = items.length; const unidades = items.reduce((s,i)=>s+(i.cantidad||0),0);
  const byCat = group(items,i=>i.categoria); const bySub = group(items.filter(i=>i.categoria==='herramienta'), i=>i.subtipo||'—'); const byMarca = group(items,i=>i.marca||'—');
  return `<!doctype html><html lang=es><meta charset=utf-8><title>INVOBRA – ${esc(obra.nombre)}</title>
  <style>body{font:14px/1.5 system-ui,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a}h1,h2{margin:.2rem 0}.muted{color:#475569}.card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.chip{display:inline-block;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;margin-right:6px}</style>
  <h1>INVOBRA — ${esc(obra.nombre)}</h1><div class=muted>Generado: ${fmtDate()}</div>
  <div class=grid>
    <div class=card><h2>Totales</h2><div class=chip>Ítems: ${total}</div><div class=chip>Unidades: ${unidades}</div></div>
    <div class=card><h2>Categorías</h2>${Object.entries(byCat).map(([k,v])=>`<div>${k}: <b>${v.length}</b></div>`).join('')}</div>
    <div class=card><h2>Subtipos</h2>${Object.entries(bySub).map(([k,v])=>`<div>${k}: <b>${v.length}</b></div>`).join('')||'—'}</div>
    <div class=card><h2>Marcas</h2>${Object.entries(byMarca).slice(0,20).map(([k,v])=>`<div>${esc(k)}: <b>${v.length}</b></div>`).join('')}</div>
  </div>
  <div class=card><h2>Detalle</h2><table><thead><tr><th>Nombre</th><th>Categoría</th><th>Subtipo</th><th>Cantidad</th><th>Marca</th><th>Ubicación</th><th>Observaciones</th></tr></thead><tbody>
  ${items.map(i=>`<tr><td>${esc(i.nombre)}</td><td>${i.categoria}</td><td>${i.subtipo||'—'}</td><td>${i.cantidad||0}</td><td>${esc(i.marca||'')}</td><td>${esc(i.ubicacion||'')}</td><td>${esc(i.observaciones||'')}</td></tr>`).join('')}</tbody></table></div>`;
}

function buildCategoryReportHTML(cat, subtipo, marca, items, obrasById){
  const title = `Categoría: ${cat}${cat==='herramienta'&&subtipo!=='all'?' · '+subtipo:''}${marca!=='all'?' · Marca '+marca:''}`;
  const list = items.map(i=>({obra: obrasById.get(i.obra_id)?.nombre || i.obra_id, nombre:i.nombre, categoria:i.categoria, subtipo:i.subtipo||'—', cantidad:i.cantidad||0, marca:i.marca||'—'}));
  const total=list.length, unidades=list.reduce((s,x)=>s+(x.cantidad||0),0); const porObra=group(list,x=>x.obra);
  return `<!doctype html><html lang=es><meta charset=utf-8><title>INVOBRA – ${esc(title)}</title>
  <style>body{font:14px/1.5 system-ui,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a}.muted{color:#475569}.card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}ul{margin:0;padding-left:1.1rem}li{margin:.2rem 0}</style>
  <h1>${esc(title)}</h1><div class=muted>Generado: ${fmtDate()}</div>
  <div class=card><b>Resumen:</b> Ítems ${total} · Unidades ${unidades}</div>
  ${Object.entries(porObra).map(([obra,arr])=>`<div class=card><h2>${esc(obra)}</h2><ul>${arr.map(r=>`<li>${esc(r.nombre)} — <b>${r.cantidad}</b> · ${r.categoria}${r.subtipo!=='—'?(' ('+r.subtipo+')'):''} · ${esc(r.marca)}</li>`).join('')}</ul></div>`).join('')}`;
}

// ---------- Categorías view ----------
async function initCategoriasView(){
  await ensureCrossData();
  const catSel = qs('#catCategoria'); const subWrap = qs('#catSubtipoWrap'); const subSel = qs('#catSubtipo'); const marcaSel = qs('#catMarca');
  // marcas globales
  marcaSel.innerHTML = '<option value="all">Todas</option>' + [...Cross.brands].sort().map(b=>`<option>${esc(b)}</option>`).join('');
  function toggle(){ subWrap.style.display = (catSel.value==='herramienta') ? 'inline-block' : 'none'; }
  function apply(){ const cat=catSel.value; const subt=(cat==='herramienta')?subSel.value:'all'; const brand=marcaSel.value; const filtered = Cross.allItems.filter(i=> i.categoria===cat && (cat!=='herramienta'||subt==='all'||i.subtipo===subt) && (brand==='all'||i.marca===brand) ); renderCatResults(filtered); }
  catSel.onchange=()=>{ toggle(); apply(); }; subSel.onchange=apply; marcaSel.onchange=apply; toggle(); apply();
}

function renderCatResults(items){
  const box = qs('#catResults'); const sum=qs('#catSummary'); const byId = Cross.obrasById; const total=items.length, unidades=items.reduce((s,i)=>s+(i.cantidad||0),0);
  sum.textContent = `Ítems: ${total} · Unidades: ${unidades}`;
  if(!items.length){ box.innerHTML = '<div class="muted">Sin resultados</div>'; return; }
  const byObra = group(items, i=> byId.get(i.obra_id)?.nombre || i.obra_id);
  box.innerHTML = Object.entries(byObra).map(([obra, arr])=>`<div class="card"><h3 style="margin:0 0 6px">${esc(obra)}</h3><ul style="margin:0;padding-left:1.1rem">${arr.map(i=>`<li>${esc(i.nombre)} — <b>${i.cantidad||0}</b> · ${i.categoria}${i.subtipo?(' ('+i.subtipo+')'):''} · ${esc(i.marca||'')}</li>`).join('')}</ul></div>`).join('');
}

// ---------- Datos/Descargas ----------
async function initDescargas(){
  await ensureCrossData();
  const downCat = qs('#downCategoria'); const downSubWrap = qs('#downSubtipoWrap'); const downSub = qs('#downSubtipo'); const downMarca = qs('#downMarca');
  downMarca.innerHTML = '<option value="all">Todas</option>' + [...Cross.brands].sort().map(b=>`<option>${esc(b)}</option>`).join('');
  function toggle(){ downSubWrap.style.display = (downCat.value==='herramienta') ? 'inline-block' : 'none'; }
  downCat.onchange = toggle; toggle();

  qs('#downloadObraBtn')?.addEventListener('click', async ()=>{
    if(!state.selectedObraId){ toast('error','Selecciona una obra'); return; }
    const obra = state.obras.find(o=>o.id===state.selectedObraId)||{id:state.selectedObraId,nombre:state.selectedObraId};
    const items = await API.itemsByObra(state.selectedObraId);
    const html = buildObraReportHTML(obra, items);
    downloadFile(`invobra-${obra.nombre}.html`, 'text/html;charset=utf-8', html);
  });

  qs('#downloadCatBtn')?.addEventListener('click', ()=>{
    const cat = downCat.value; const subt = (cat==='herramienta')?downSub.value:'all'; const brand = downMarca.value;
    const items = Cross.allItems.filter(i=> i.categoria===cat && (cat!=='herramienta'||subt==='all'||i.subtipo===subt) && (brand==='all'||i.marca===brand) );
    const html = buildCategoryReportHTML(cat, subt, brand, items, Cross.obrasById);
    const name = `invobra-${cat}${cat==='herramienta'&&subt!=='all'?('-'+subt):''}${brand!=='all'?('-'+brand):''}.html`;
    downloadFile(name, 'text/html;charset=utf-8', html);
  });
}

// ---------- Router ----------
function showView(name){
  const views = { home:'#view-home', inventario:'#view-inventario', categorias:'#view-categorias', ayuda:'#view-ayuda', datos:'#view-datos' };
  Object.values(views).forEach(sel=> hide(qs(sel)) );
  show(qs(views[name]||'#view-home'));
  qsa('.tab').forEach(t=>t.classList.remove('active')); qs('#nav-'+name)?.classList.add('active');
}
function applyRoute(){ const name = (location.hash.replace('#','')||'home'); showView(name); if(name==='categorias') initCategoriasView(); if(name==='datos') initDescargas(); }

// ---------- Helpers ----------
function escapeHtml(s){ return String(s||'').replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]); }