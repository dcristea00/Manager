// /app.js
// Estado/Config y utilidades (idénticos a tu versión anterior)
const CONFIG = { storageKey: 'obraInv_v1', version: 2 };
const BRANDS = new Set(['Hilti','Makita','Milwaukee','Bosch','DeWalt','Metabo','Festool','Stanley','Ridgid','HiKOKI','Einhell','Black+Decker','Bellota','Sika','Bosch Professional']);
let state = { obras:[], items:[], selectedObraId:'', editingItemId:null, filters:{categoria:'',subtipo:'',search:''} };
const qs=(s,e=document)=>e.querySelector(s), qsa=(s,e=document)=>[...e.querySelectorAll(s)];
const uid=()=>crypto?.randomUUID?crypto.randomUUID():`id_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
const show=el=>el.classList.remove('hidden'), hide=el=>el.classList.add('hidden'), cap=s=>s?s[0].toUpperCase()+s.slice(1):s;

// Storage + migración (igual que antes)
const Storage={load(){try{const raw=localStorage.getItem(CONFIG.storageKey);if(raw){const p=JSON.parse(raw);return this.migrate({version:p.version||1,obras:p.obras||[],items:p.items||[]});}}catch(e){} return this.defaults();},
save(){localStorage.setItem(CONFIG.storageKey,JSON.stringify({version:CONFIG.version,obras:state.obras,items:state.items}))},
export(){const blob=new Blob([JSON.stringify({version:CONFIG.version,obras:state.obras,items:state.items},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`inventario-obras-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)},
async import(file){const txt=await file.text();const d=JSON.parse(txt);if(!d||!Array.isArray(d.obras)||!Array.isArray(d.items))throw new Error('Formato inválido');const m=this.migrate({version:d.version||1,obras:d.obras,items:d.items});state.obras=m.obras;state.items=m.items;if(!state.obras.find(o=>o.id===state.selectedObraId))state.selectedObraId='';this.save();},
migrate(d){if((d.version||1)<2){d.items=d.items.map(it=>{if(!it.marca&&it.unidad){it.marca=it.unidad;} delete it.unidad;return it;});d.version=2;} return d;},
defaults(){return{version:2,obras:[{id:'obra_001',nombre:'Residencial Sur'},{id:'obra_002',nombre:'Edificio Comercial Norte'}],
items:[{id:'itm_001',obraId:'obra_001',nombre:'Taladro GSB 13',categoria:'herramienta',subtipo:'electrica',cantidad:3,marca:'Bosch',ubicacion:'Almacén 1 / B',observaciones:'Revisión mensual'},
{id:'itm_002',obraId:'obra_001',nombre:'Cemento CEM II',categoria:'material',subtipo:'',cantidad:40,marca:'Sika',ubicacion:'Patio',observaciones:''}]}}};

// Validación
const Validate={obraNombre(n,ex=null){if(!n?.trim())return'El nombre es obligatorio';const dup=state.obras.some(o=>o.id!==ex&&o.nombre.trim().toLowerCase()===n.trim().toLowerCase());return dup?'Ya existe una obra con este nombre':''},
item(d,obraId,ex=null){const e={};if(!d.nombre?.trim())e.nombre='El nombre es obligatorio';const dup=state.items.some(it=>it.id!==ex&&it.obraId===obraId&&it.nombre.trim().toLowerCase()===d.nombre.trim().toLowerCase()&&it.categoria===d.categoria&&(it.subtipo||'')===(d.subtipo||'')&&(it.marca||'')===(d.marca||''));if(!e.nombre&&dup)e.nombre='Ya existe un ítem igual (nombre/categoría/subtipo/marca)';if(!d.categoria)e.categoria='La categoría es obligatoria';if(d.categoria==='herramienta'&&!d.subtipo)e.subtipo='El subtipo es obligatorio para herramientas';if(!d.marca?.trim())e.marca='La marca es obligatoria';return e}};

// Render
function renderObrasSelect(){const sel=qs('#obraSelect');const prev=sel.value;sel.innerHTML=`<option value="">— Seleccionar Obra —</option>`+state.obras.map(o=>`<option value="${o.id}">${o.nombre}</option>`).join('');sel.value=state.selectedObraId||prev||'';qs('#deleteObraBtn').disabled=!sel.value;qs('#editObraBtn').disabled=!sel.value;}
function renderBrandsSelect(){const select=qs('#itemMarca');const opts=[...BRANDS].sort((a,b)=>a.localeCompare(b));select.innerHTML=`<option value="">— Seleccionar —</option>`+opts.map(b=>`<option value="${b}">${b}</option>`).join('')+`<option value="__new__">Añadir nueva…</option>`;select.value='';}
function renderCounts(f){qs('#totalCount').textContent=state.items.filter(i=>i.obraId===state.selectedObraId).length;qs('#visibleCount').textContent=f.length;}
function applyFilters(){const {categoria,subtipo,search}=state.filters;return state.items.filter(i=>i.obraId===state.selectedObraId).filter(i=>!categoria||i.categoria===categoria).filter(i=>categoria!=='herramienta'||!subtipo||(i.subtipo||'')===subtipo).filter(i=>!search||i.nombre.toLowerCase().includes(search.toLowerCase()));}
function renderTable(){const tbody=qs('#tableBody');if(!state.selectedObraId){tbody.innerHTML=`<tr><td colspan="8" class="table__empty">Selecciona una obra para ver el inventario</td></tr>`;renderCounts([]);return;}const f=applyFilters();if(f.length===0){tbody.innerHTML=`<tr><td colspan="8" class="table__empty">Sin resultados</td></tr>`;renderCounts(f);return;}tbody.innerHTML=f.map(it=>`<tr data-id="${it.id}"><td>${it.nombre}</td><td>${cap(it.categoria)}</td><td>${it.categoria==='herramienta'?(it.subtipo||'—'):'—'}</td><td><div class="actions"><button class="iconbtn" data-action="dec" title="Disminuir">−</button><strong>${it.cantidad||0}</strong><button class="iconbtn" data-action="inc" title="Aumentar">+</button></div></td><td>${it.marca||'—'}</td><td>${it.ubicacion||'—'}</td><td>${it.observaciones||'—'}</td><td class="actions"><button class="btn" data-action="edit">Editar</button><button class="btn btn--danger" data-action="delete">Eliminar</button></td></tr>`).join('');renderCounts(f);}

// Obras
const obraModal=qs('#obraModal');
function openObraModal({mode='create',obra=null}={}){qs('#obraModalTitle').textContent=mode==='edit'?'Editar Obra':'Nueva Obra';const submit=qs('#obraSubmitBtn');submit.textContent=mode==='edit'?'Guardar Cambios':'Crear Obra';const del=qs('#obraDeleteBtn');if(mode==='edit'){show(del);del.onclick=()=>{if(confirm('¿Eliminar esta obra y su inventario?')){deleteObra(obra.id);closeObraModal();}};}else{hide(del);del.onclick=null;}const nameInput=qs('#obraNombre');nameInput.value=obra?.nombre||'';nameInput.dataset.mode=mode;nameInput.dataset.id=obra?.id||'';hide(qs('#obraNombre-error'));obraModal.showModal();setTimeout(()=>nameInput.focus(),30);}
function closeObraModal(){obraModal.close();}
function createObra(nombre){const err=Validate.obraNombre(nombre);if(err){showError('#obraNombre-error',err);return null;}const obra={id:uid(),nombre:nombre.trim()};state.obras.push(obra);state.selectedObraId=obra.id;Storage.save();renderObrasSelect();renderTable();toast('success',`Obra «${obra.nombre}» creada`);return obra;}
function updateObra(id,nombre){const err=Validate.obraNombre(nombre,id);if(err){showError('#obraNombre-error',err);return null;}const obra=state.obras.find(o=>o.id===id);if(!obra)return null;obra.nombre=nombre.trim();Storage.save();renderObrasSelect();toast('success','Obra actualizada');return obra;}
function deleteObra(id){const obra=state.obras.find(o=>o.id===id);state.obras=state.obras.filter(o=>o.id!==id);state.items=state.items.filter(i=>i.obraId!==id);if(state.selectedObraId===id)state.selectedObraId='';Storage.save();renderObrasSelect();renderTable();toast('success',`Obra «${obra?.nombre||''}» eliminada`);}

// Ítems
function readItemForm(){const cat=qs('#itemCategoria').value;const sel=qs('#itemMarca').value;const nueva=qs('#itemMarcaNueva').value.trim();const marca=(sel==='__new__')?nueva:sel;return{nombre:qs('#itemNombre').value,categoria:cat,subtipo:cat==='herramienta'?qs('#itemSubtipo').value:'',cantidad:0,marca,ubicacion:qs('#itemUbicacion').value,observaciones:qs('#itemObservaciones').value};}
function resetItemForm(){qs('#itemForm').reset();state.editingItemId=null;qs('#submitBtn').textContent='Agregar Ítem';qs('#formTitle').textContent='Agregar Ítem';hideErrors();renderBrandsSelect();hide(qs('#marcaNuevaWrap'));}
function showError(sel,msg){const el=qs(sel);el.textContent=msg;show(el);} function hideErrors(){qsa('.alert--error').forEach(hide);}
function saveNewItem(){const d=readItemForm();const e=Validate.item(d,state.selectedObraId);hideErrors();if(Object.keys(e).length){if(e.nombre)showError('#itemNombre-error',e.nombre);if(e.categoria)showError('#itemCategoria-error',e.categoria);if(e.subtipo)showError('#itemSubtipo-error',e.subtipo);if(e.marca)showError('#itemMarca-error',e.marca);toast('error','Revisa los campos obligatorios');return;} if(qs('#itemMarca').value==='__new__'&&d.marca){BRANDS.add(d.marca);} const it={id:uid(),obraId:state.selectedObraId,nombre:d.nombre.trim(),categoria:d.categoria,subtipo:d.categoria==='herramienta'?d.subtipo:'',cantidad:0,marca:d.marca.trim(),ubicacion:d.ubicacion?.trim()||'',observaciones:d.observaciones?.trim()||''};state.items.push(it);Storage.save();renderTable();resetItemForm();toast('success','Ítem agregado');}
function saveEditedItem(){const d=readItemForm();const e=Validate.item(d,state.selectedObraId,state.editingItemId);hideErrors();if(Object.keys(e).length){if(e.nombre)showError('#itemNombre-error',e.nombre);if(e.categoria)showError('#itemCategoria-error',e.categoria);if(e.subtipo)showError('#itemSubtipo-error',e.subtipo);if(e.marca)showError('#itemMarca-error',e.marca);toast('error','Revisa los campos obligatorios');return;} if(qs('#itemMarca').value==='__new__'&&d.marca){BRANDS.add(d.marca);} const it=state.items.find(i=>i.id===state.editingItemId);if(!it)return;Object.assign(it,{nombre:d.nombre.trim(),categoria:d.categoria,subtipo:d.categoria==='herramienta'?d.subtipo:'',marca:d.marca.trim(),ubicacion:d.ubicacion?.trim()||'',observaciones:d.observaciones?.trim()||''});Storage.save();renderTable();resetItemForm();toast('success','Ítem actualizado');}

// Toast
function toast(type,msg){const c=qs('#alertContainer');const cls=type==='error'?'alert alert--error':'alert';c.innerHTML=`<div class="${cls}">${msg}</div>`;setTimeout(()=>{c.innerHTML='';},1600);}

// NEW: toggle "Cómo usar"
function setupHowToToggle(){
  const btn = qs('#toggleHowToBtn');
  const panel = qs('#howTo');
  const openFromHash = location.hash === '#ayuda';
  if (openFromHash) { show(panel); btn.setAttribute('aria-expanded','true'); }
  btn.addEventListener('click', ()=>{
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) { show(panel); btn.setAttribute('aria-expanded','true'); }
    else { hide(panel); btn.setAttribute('aria-expanded','false'); }
  });
}

// Listeners
function addEventListeners(){
  setupHowToToggle();
  qs('#nuevaObraBtn').addEventListener('click', ()=> openObraModal());
  qs('#editObraBtn').addEventListener('click', ()=>{const id=qs('#obraSelect').value;if(!id)return;const obra=state.obras.find(o=>o.id===id);openObraModal({mode:'edit',obra});});
  qs('#deleteObraBtn').addEventListener('click', ()=>{const id=qs('#obraSelect').value;if(!id)return;if(confirm('¿Eliminar esta obra y todo su inventario?')) deleteObra(id);});
  const obraModal=qs('#obraModal'); obraModal.addEventListener('click',e=>{if(e.target.hasAttribute('data-close')) obraModal.close();}); obraModal.addEventListener('cancel',e=>{e.preventDefault();obraModal.close();});
  qs('#obraForm').addEventListener('submit',e=>{e.preventDefault();const mode=qs('#obraNombre').dataset.mode||'create';const id=qs('#obraNombre').dataset.id||'';const nombre=qs('#obraNombre').value;if(mode==='edit'){updateObra(id,nombre)&&obraModal.close();}else{createObra(nombre)&&obraModal.close();}});
  qs('#obraSelect').addEventListener('change',e=>{state.selectedObraId=e.target.value;Storage.save();renderObrasSelect();renderTable();});
  qs('#exportBtn').addEventListener('click',()=>Storage.export());
  qs('#importFile').addEventListener('change',async e=>{if(!e.target.files?.length)return;try{await Storage.import(e.target.files[0]);renderObrasSelect();renderBrandsSelect();renderTable();toast('success','Datos importados');}catch(err){toast('error',err.message||'Error al importar');}e.target.value='';});
  qs('#itemCategoria').addEventListener('change',e=>{qs('#subtipoGroup').style.display=(e.target.value==='herramienta')?'block':'none';});
  qs('#itemMarca').addEventListener('change',e=>{if(e.target.value==='__new__'){show(qs('#marcaNuevaWrap'));qs('#itemMarcaNueva').focus();}else{hide(qs('#marcaNuevaWrap'));}});
  qs('#itemForm').addEventListener('submit',e=>{e.preventDefault();if(!state.selectedObraId){toast('error','Selecciona una obra primero');return;} if(state.editingItemId) saveEditedItem(); else saveNewItem();});
  qs('#cancelBtn').addEventListener('click',resetItemForm);
  qsa('input[name="categoria"]').forEach(r=>r.addEventListener('change',e=>{state.filters.categoria=e.target.value;renderTable();qs('#subtipoFilter').style.display=(state.filters.categoria==='herramienta')?'block':'none';}));
  qsa('input[name="subtipo"]').forEach(r=>r.addEventListener('change',e=>{state.filters.subtipo=e.target.value;renderTable();}));
  qs('#searchInput').addEventListener('input',e=>{state.filters.search=e.target.value;renderTable();});
  qs('#tableBody').addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const tr=e.target.closest('tr');const id=tr?.dataset.id;if(!id)return;const action=btn.dataset.action;const item=state.items.find(i=>i.id===id);if(action==='inc'){item.cantidad=(item.cantidad||0)+1;Storage.save();renderTable();}if(action==='dec'){item.cantidad=Math.max(0,(item.cantidad||0)-1);Storage.save();renderTable();}if(action==='delete'){if(confirm('¿Eliminar ítem?')){state.items=state.items.filter(i=>i.id!==id);Storage.save();renderTable();}}if(action==='edit'){state.editingItemId=id;qs('#formTitle').textContent='Editar Ítem';qs('#submitBtn').textContent='Guardar Cambios';qs('#itemNombre').value=item.nombre;qs('#itemCategoria').value=item.categoria;qs('#subtipoGroup').style.display=(item.categoria==='herramienta')?'block':'none';qs('#itemSubtipo').value=item.subtipo||'';renderBrandsSelect();if(BRANDS.has(item.marca)){qs('#itemMarca').value=item.marca;hide(qs('#marcaNuevaWrap'));}else if(item.marca){qs('#itemMarca').value='__new__';show(qs('#marcaNuevaWrap'));qs('#itemMarcaNueva').value=item.marca;}else{qs('#itemMarca').value='';hide(qs('#marcaNuevaWrap'));}qs('#itemUbicacion').value=item.ubicacion||'';qs('#itemObservaciones').value=item.observaciones||'';window.scrollTo({top:0,behavior:'smooth'});}});
}

// Init
function init(){const data=Storage.load();state.obras=data.obras;state.items=data.items;state.items.forEach(it=>{if(it.marca)BRANDS.add(it.marca);});renderObrasSelect();renderBrandsSelect();renderTable();qs('#subtipoFilter').style.display=(state.filters.categoria==='herramienta')?'block':'none';qs('#subtipoGroup').style.display='none';addEventListeners();}
init();
