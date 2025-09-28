
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
  allItems: [], // todos los items para autocompletado y categorías
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
  state.allItems = await API.itemsAll(); // Cargar todos los items para autocompletado y categorías
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

  // Nueva obra modal
  qs('#obraModalForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = qs('#obraNameInp').value.trim();
    const mode = qs('#obraModal').dataset.mode;
    const id = qs('#obraModal').dataset.id;
    if(!name) return toast('error','Nombre requerido');
    try{
      if(mode==='new'){
        const obra = await API.obraCreate(name);
        state.obras.unshift(obra);
        state.selectedObraId = obra.id;
        localStorage.setItem('obraId',obra.id);
        await loadInventario();
      } else {
        await API.obraUpdate(id,name);
        const o = state.obras.find(o=>o.id===id); if(o) o.nombre=name;
      }
      renderObrasSelect();
      renderObraInfo();
      qs('#obraModal').close();
      toast('ok','Obra guardada');
    } catch(e){
      toast('error',e.message==='Duplicado'?'Nombre duplicado':e.message);
    }
  });
  qs('#obraModalDelBtn')?.addEventListener('click', async ()=>{
    const id = qs('#obraModal').dataset.id; if(!id) return;
    if(confirm('¿Eliminar esta obra y todo su inventario?')){
      await API.obraDelete(id);
      state.obras = state.obras.filter(o=>o.id!==id);
      if(state.selectedObraId===id){ state.selectedObraId=''; state.items=[]; }
      renderObrasSelect();
      renderObraInfo();
      renderTable();
      qs('#obraModal').close();
      toast('ok','Obra eliminada');
    }
  });

  // Item modal
  qs('#itemModalForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = qs('#itemNameInp').value.trim();
    const cat  = qs('#itemCatSel').value;
    const subt = qs('#itemSubSel').value;
    const brand= qs('#itemBrandInp').value.trim() || qs('#itemBrandSel').value;
    const qty  = parseInt(qs('#itemQtyInp').value)||1;
    const loc  = qs('#itemLocInp').value.trim();
    const obs  = qs('#itemObsInp').value.trim();
    if(!name || !cat || !brand) return toast('error','Campos requeridos');
    const payload = { nombre:name, categoria:cat, subtipo:subt, marca:brand, cantidad:qty, ubicacion:loc, observaciones:obs, obra_id:state.selectedObraId };
    try{
      const mode = qs('#itemModal').dataset.mode;
      if(mode==='new'){
        const item = await API.itemCreate(payload);
        state.items.unshift(item);
      } else {
        const id = qs('#itemModal').dataset.id;
        await API.itemUpdate(id, payload);
        const i = state.items.find(i=>i.id===id); if(i) Object.assign(i,payload);
      }
      renderTable();
      qs('#itemModal').close();
      toast('ok','Ítem guardado');
    } catch(e){ toast('error',e.message); }
  });
  qs('#itemModalDelBtn')?.addEventListener('click', async ()=>{
    const id = qs('#itemModal').dataset.id; if(!id) return;
    if(confirm('¿Eliminar este ítem?')){
      await API.itemDelete(id);
      state.items = state.items.filter(i=>i.id!==id);
      renderTable();
      qs('#itemModal').close();
      toast('ok','Ítem eliminado');
    }
  });

  // Filtros inventario
  qs('#invSearchInp')?.addEventListener('input', renderTable);
}

// ---------- Carga ----------
async function loadObras(){
  try{
    state.obras = await API.obrasList();
  } catch(e){ toast('error','Error cargando obras'); }
}
async function loadInventario(){
  if(!state.selectedObraId) return state.items=[];
  try{
    state.items = await API.itemsByObra(state.selectedObraId);
    renderTable();
  } catch(e){ toast('error','Error cargando inventario'); }
}

// ---------- Modales ----------
function openObraModal({mode='new', obra=null}={}){
  const dlg = qs('#obraModal'); if(!dlg) return;
  dlg.dataset.mode = mode;
  dlg.dataset.id = obra?.id||'';
  qs('#obraNameInp').value = obra?.nombre||'';
  qs('#obraModalDelBtn').style.display = (mode==='edit')?'inline-flex':'none';
  dlg.showModal();
}
function openItemModal({mode='new', item=null}={}){
  const dlg = qs('#itemModal'); if(!dlg) return;
  dlg.dataset.mode = mode;
  dlg.dataset.id = item?.id||'';
  qs('#itemNameInp').value = item?.nombre||'';
  qs('#itemCatSel').value = item?.categoria||'';
  qs('#itemSubSel').value = item?.subtipo||'';
  qs('#itemBrandSel').value = item?.marca||'new';
  qs('#itemBrandInp').value = (item?.marca && qs('#itemBrandSel').value==='new')?item.marca:'';
  qs('#itemQtyInp').value = item?.cantidad||1;
  qs('#itemLocInp').value = item?.ubicacion||'';
  qs('#itemObsInp').value = item?.observaciones||'';
  toggleBrandInp();
  toggleSubtipoInp();
  dlg.showModal();
}

// ---------- Render ----------
function renderObrasSelect(){
  const sel = qs('#obraSelect');
  if(sel){
    sel.innerHTML = '<option value="">— Seleccionar —</option>' + state.obras.map(o=>`<option value="${o.id}" ${o.id===state.selectedObraId?'selected':''}>${escapeHtml(o.nombre)}</option>`).join('');
  }
  renderObraInfo();
}
function renderObraInfo(){
  const name = qs('#obraName');
  const obra = state.obras.find(o=>o.id===state.selectedObraId);
  if(name) name.textContent = obra?.nombre || 'Selecciona una obra';
  const btns = qsa('#editObraBtn, #deleteObraBtn');
  btns.forEach(b=> b.disabled = !state.selectedObraId);
}

// ---------- Inicio: Grid obras con fotos ----------
async function renderInicio(){
  const box = qs('#inicioGrid');
  if(!box) return;
  box.innerHTML = state.obras.map(o=>{
    const img = obraImages[o.id] || 'https://via.placeholder.com/300x200?text='+encodeURIComponent(o.nombre);
    return `
      <div class="card-obra" data-id="${o.id}">
        <img src="${img}" alt="${escapeHtml(o.nombre)}">
        <div class="meta">${escapeHtml(o.nombre)}</div>
        <input type="file" accept="image/*" class="hidden" onchange="uploadObraImg(event, '${o.id}')">
        <button class="btn ghost change i" onclick="qs('[data-id=${o.id}] input').click()">📷</button>
      </div>
    `;
  }).join('');
}
function uploadObraImg(e, id){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    obraImages[id] = ev.target.result;
    localStorage.setItem('obraImages',JSON.stringify(obraImages));
    renderInicio();
  };
  reader.readAsDataURL(file);
}

// ---------- Añadir: Form + Autocompletado ----------
function initAnadirView(){
  const catSel = qs('#itemCatSel');
  const subWrap = qs('#itemSubWrap');
  const brandSel = qs('#itemBrandSel');
  const brandInp = qs('#itemBrandInp');
  const nameInp = qs('#itemNameInp');

  catSel?.addEventListener('change', toggleSubtipoInp);
  brandSel?.addEventListener('change', toggleBrandInp);

  // Autocompletado para nombre
  const suggestions = [...new Set(state.allItems.map(i=>i.nombre))].sort();
  const datalist = document.createElement('datalist');
  datalist.id = 'itemSuggestions';
  datalist.innerHTML = suggestions.map(s=>`<option value="${escapeHtml(s)}">`).join('');
  nameInp.setAttribute('list','itemSuggestions');
  nameInp.after(datalist);

  nameInp.addEventListener('input', (e)=>{
    const val = e.target.value.trim().toLowerCase();
    if(val.length < 2) return;
    const match = state.allItems.find(i=>i.nombre.toLowerCase()===val);
    if(match){
      catSel.value = match.categoria || '';
      toggleSubtipoInp();
      qs('#itemSubSel').value = match.subtipo || '';
      brandSel.value = 'new';
      toggleBrandInp();
      brandInp.value = match.marca || '';
      // Resto vacío
      qs('#itemQtyInp').value = 1;
      qs('#itemLocInp').value = '';
      qs('#itemObsInp').value = '';
    }
  });

  function toggleSubtipoInp(){
    subWrap.style.display = (catSel.value === 'herramienta') ? 'block' : 'none';
  }
  function toggleBrandInp(){
    brandInp.style.display = (brandSel.value === 'new') ? 'block' : 'none';
  }
}

// ---------- Inventario: Tabla + Resumen dinámico ----------
function renderTable(){
  const box = qs('#invTable');
  const sum = qs('#invSummary');
  const search = (qs('#invSearchInp')?.value||'').trim().toLowerCase();

  const filtered = state.items.filter(i=> !search || i.nombre.toLowerCase().includes(search) || i.marca.toLowerCase().includes(search) || i.observaciones.toLowerCase().includes(search) );

  // Resumen dinámico
  const totalItems = state.items.length;
  const visibleItems = filtered.length;
  const totalUnits = state.items.reduce((s,i)=>s+(i.cantidad||0),0);
  const cats = new Set(state.items.map(i=>i.categoria));
  const subts = new Set(state.items.filter(i=>i.categoria==='herramienta').map(i=>i.subtipo));
  sum.textContent = `Visibles ${visibleItems} · Total ${totalItems} · Unidades ${totalUnits} · Categorías ${cats.size} · Subtipos ${subts.size}`;

  const html = filtered.map(i=>`
    <tr>
      <td>${escapeHtml(i.nombre)}</td>
      <td>${escapeHtml(i.categoria)}</td>
      <td>${escapeHtml(i.subtipo||'—')}</td>
      <td>${i.cantidad||1}</td>
      <td>${escapeHtml(i.marca)}</td>
      <td>${escapeHtml(i.ubicacion||'—')}</td>
      <td>${escapeHtml(i.observaciones||'—')}</td>
      <td><button class="btn ghost i" onclick="openItemModal({mode:'edit',item:${JSON.stringify(i)}})">✏️</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="empty">Sin ítems</td></tr>';

  box.innerHTML = html;
}

// ---------- Categorías: Filtros + Resultados con nombres ----------
const Cross = { allItems: [], obrasById: new Map(), brands: new Set() };

async function initCategoriasView(){
  Cross.allItems = state.allItems; // Usar allItems cargados
  Cross.obrasById = new Map(state.obras.map(o=>[o.id,o]));
  Cross.brands = new Set(Cross.allItems.map(i=>i.marca).filter(Boolean));

  const catSel   = qs('#catSel');
  const subSel   = qs('#subSel');
  const subWrap  = qs('#subWrap');
  const marcaSel = qs('#marcaSel');
  const obraSel  = qs('#obraSel');

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
    subWrap.style.display = (catSel.value === 'herramienta' || catSel.value === 'ambas') ? 'inline-block' : 'none';
  }

  function apply(){
    const obra  = obraSel?.value || 'all';
    const cat   = catSel.value;                         // ambas | herramienta | material
    const subt  = subSel.value;                         // ambas | all | electrica | manual
    const brand = marcaSel.value;                       // all | marca

    const filtered = Cross.allItems.filter(i =>
      (obra === 'all' || i.obra_id === obra) &&
      (cat === 'ambas' || i.categoria === cat) &&
      (subt === 'ambas' || subt === 'all' || i.subtipo === subt) &&
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

// Render compacto de resultados (totales por obra + nombres de ítems)
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
    if ((cat === 'herramienta' || cat === 'ambas') && (subt === 'ambas' || subt === 'all')) {
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

    // Añadir lista de nombres de ítems
    const itemNames = arr.map(i => escapeHtml(i.nombre)).sort().join(', ');
    extra += `<div class="muted">Ítems: ${itemNames || 'Ninguno'}</div>`;

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

// ---------- Datos: Descargar PDF ----------
function initDatosView(){
  const box = qs('#datosActions');
  box.innerHTML = `
    <button class="btn primary" id="downloadPdfBtn">Descargar PDF de Inventario</button>
  `;
  qs('#downloadPdfBtn').addEventListener('click', generatePdf);
}

async function generatePdf(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Inventario por Obra', 20, 20);
  let y = 30;

  for(const obra of state.obras){
    const items = await API.itemsByObra(obra.id);
    if(!items.length) continue;
    doc.setFontSize(14);
    doc.text(obra.nombre, 20, y);
    y += 10;
    doc.setFontSize(10);
    items.sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(i=>{
      doc.text(`${i.nombre} (${i.categoria}${i.subtipo?`/${i.subtipo}`:''}) - Cant: ${i.cantidad} - Marca: ${i.marca}`, 30, y);
      y += 8;
      if(y > 270){ doc.addPage(); y=20; }
    });
    y += 10;
  }

  doc.save(`inventario_${fmtDate().replace(/[\s:\/]/g,'-')}.pdf`);
}

// ---------- Router ----------
function showView(name){
  const views = { inicio:'#view-inicio', anadir:'#view-anadir', inventario:'#view-inventario', categorias:'#view-categorias', datos:'#view-datos' };
  Object.values(views).forEach(sel=> hide(qs(sel)) );
  show(qs(views[name]||'#view-inicio'));
  qsa('.tab').forEach(t=>t.classList.remove('active')); qs('#nav-'+name)?.classList.add('active');
  // Ocultar toolbar obra en vistas que no la usan
  const hideTb = (name==='inicio' || name==='categorias' || name==='datos');
  document.body.classList.toggle('hide-toolbar', hideTb);
}
async function applyRoute(){ 
  const name = (location.hash.replace('#','')||'inicio'); 
  showView(name); 
  if(name==='inicio') renderInicio(); 
  if(name==='anadir') initAnadirView();
  if(name==='inventario') renderTable();
  if(name==='categorias') await initCategoriasView(); 
  if(name==='datos') initDatosView();
}

// Cargar jsPDF para PDF (CDN en index.html)
