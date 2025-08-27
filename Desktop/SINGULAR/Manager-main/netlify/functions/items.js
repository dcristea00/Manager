// netlify/functions/items.js
import { sql } from './_db.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  },
  body: JSON.stringify(data)
});

export async function handler(event) {
  const { httpMethod: method, queryStringParameters: qp = {} } = event;
  if (method === 'OPTIONS') return json(200, { ok: true });

  try {
    if (method === 'GET') {
      const obraId = qp.obraId || qp.obra_id || null;
      if (obraId) {
        const rows = await sql`
          select id, obra_id, nombre, categoria, subtipo, marca, ubicacion, observaciones, cantidad, created_at
          from items where obra_id = ${obraId} order by created_at desc`;
        return json(200, rows);
      }
      const rows = await sql`
        select id, obra_id, nombre, categoria, subtipo, marca, ubicacion, observaciones, cantidad, created_at
        from items order by created_at desc`;
      return json(200, rows);
    }

    if (method === 'POST') {
      const b = JSON.parse(event.body||'{}');
      const obraId = b.obraId || b.obra_id;
      if (!obraId || !b.nombre || !b.categoria || !b.marca) return json(400,{error:'faltan campos'});
      const subtipo = b.categoria === 'herramienta' ? (b.subtipo || null) : null;
      const cantidad = Math.max(0, parseInt(b.cantidad ?? 1, 10) || 0);
      const rows = await sql`
        insert into items (obra_id, nombre, categoria, subtipo, marca, ubicacion, observaciones, cantidad)
        values (${obraId}, ${b.nombre}, ${b.categoria}, ${subtipo}, ${b.marca}, ${b.ubicacion||''}, ${b.observaciones||''}, ${cantidad})
        returning id, obra_id, nombre, categoria, subtipo, marca, ubicacion, observaciones, cantidad, created_at`;
      return json(200, rows[0]);
    }

    if (method === 'PUT') {
      const id = qp.id; if(!id) return json(400,{error:'id requerido'});
      const b = JSON.parse(event.body||'{}');
      const fields = [];
      if (b.nombre != null)       fields.push(sql`nombre = ${b.nombre}`);
      if (b.categoria != null)    fields.push(sql`categoria = ${b.categoria}`);
      if (b.subtipo !== undefined)fields.push(sql`subtipo = ${b.subtipo || null}`);
      if (b.marca != null)        fields.push(sql`marca = ${b.marca}`);
      if (b.ubicacion != null)    fields.push(sql`ubicacion = ${b.ubicacion}`);
      if (b.observaciones != null)fields.push(sql`observaciones = ${b.observaciones}`);
      if (b.cantidad != null)     fields.push(sql`cantidad = ${Math.max(0, parseInt(b.cantidad,10)||0)}`);
      if (b.obra_id)              fields.push(sql`obra_id = ${b.obra_id}`); // permitir TRASPASO
      if (!fields.length) return json(400,{error:'sin cambios'});
      const q = sql`update items set ${sql.join(fields, sql`, `)} where id = ${id} returning *`;
      const rows = await q;
      return json(200, rows[0]||{});
    }

    if (method === 'DELETE') {
      const id = qp.id; if(!id) return json(400,{error:'id requerido'});
      await sql`delete from items where id = ${id}`;
      return json(200, { success:true });
    }

    return json(405, { error: 'method not allowed' });
  } catch (err) {
    return json(500, { error: String(err.message||err) });
  }
}