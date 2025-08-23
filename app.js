// --- Config & estado ---
const CONFIG = { storageKey: 'obraInv_v1', version: 2 }; // v2: unidad -> marca

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

// Helpers (qs, qsa, uid, show/hide, etc.)
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const cap = (s)=>s ? s[0].toUpperCase()+s.slice(1) : s;

// --- Storage + migración ---
const Storage = {
  load(){ /* ... */ },
  save(){ /* ... */ },
  export(){ /* ... */ },
  import(file){ /* ... */ },
  migrate(data){ /* ... */ },
  defaults(){ /* ... */ }
};

// --- Validación ---
const Validate = {
  obraNombre(nombre, excludeId=null){ /* ... */ },
  item(data, obraId, excludeId=null){ /* ... */ }
};

// --- Render de UI ---
function renderObrasSelect(){ /* ... */ }
function renderBrandsSelect(){ /* ... */ }
function renderCounts(filtered){ /* ... */ }
function applyFilters(){ /* ... */ }
function renderTable(){ /* ... */ }

// --- Obras CRUD ---
function openObraModal(){ /* ... */ }
function closeObraModal(){ /* ... */ }
function createObra(nombre){ /* ... */ }
function updateObra(id,nombre){ /* ... */ }
function deleteObra(id){ /* ... */ }

// --- Items CRUD ---
function readItemForm(){ /* ... */ }
function resetItemForm(){ /* ... */ }
function saveNewItem(){ /* ... */ }
function saveEditedItem(){ /* ... */ }

// --- Notificaciones ---
function toast(type,msg){ /* ... */ }

// --- Listeners ---
function addEventListeners(){ /* ... */ }

// --- Init ---
function init(){ /* ... */ }
init();
