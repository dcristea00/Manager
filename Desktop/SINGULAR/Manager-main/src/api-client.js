// Cliente API para consumir funciones de Netlify (Neon/Postgres)
data.obras.push(o); localStorage.setItem('obraInv_v1', JSON.stringify({ version: 2, ...data }));
return o;
},
async updateObra(id, nombre) {
if (online()) return obrasUpdate(id, nombre);
const data = Local.load();
const o = data.obras.find(x=>x.id===id); if (o) { o.nombre = nombre.trim(); localStorage.setItem('obraInv_v1', JSON.stringify({ version: 2, ...data })); }
return o;
},
async deleteObra(id) {
if (online()) return obrasDelete(id);
const data = Local.load();
data.obras = data.obras.filter(o=>o.id!==id);
data.items = data.items.filter(i=>i.obraId!==id);
localStorage.setItem('obraInv_v1', JSON.stringify({ version: 2, ...data }));
},
async listItems(obraId) {
if (online()) return itemsList(obraId);
const data = Local.load();
return data.items.filter(i=>i.obraId===obraId);
},
async createItem(item) {
if (online()) {
// map front → API
const payload = {
obra_id: item.obraId,
nombre: item.nombre,
categoria: item.categoria,
subtipo: item.subtipo || null,
cantidad: item.cantidad ?? 0,
marca: item.marca || null,
ubicacion: item.ubicacion || null,
observaciones: item.observaciones || null
};
return itemCreate(payload);
}
const data = Local.load();
data.items.push(item); localStorage.setItem('obraInv_v1', JSON.stringify({ version: 2, ...data }));
return item;
},
async updateItem(id, patch) {
if (online()) return itemUpdate(id, patch);
const data = Local.load();
const it = data.items.find(i=>i.id===id); if (it) Object.assign(it, patch);
localStorage.setItem('obraInv_v1', JSON.stringify({ version: 2, ...data }));
return it;
},
async deleteItem(id) {
if (online()) return itemDelete(id);
const data = Local.load();
data.items = data.items.filter(i=>i.id!==id);
localStorage.setItem('obraInv_v1', JSON.stringify({ version: 2, ...data }));
}
};
}