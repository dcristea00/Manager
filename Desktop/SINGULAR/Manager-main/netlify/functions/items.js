
// [ANCHOR: INVENTARIO_EDITAR_CAMBIO_OBRA_FIX]
import { sql, json } from './_db.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try {
    const qs = event.queryStringParameters || {};
    const id = qs.id || null;
    const obraId = qs.obraId || null;

    if (event.httpMethod === 'GET') {
      if (obraId) {
        const rows = await sql`SELECT * FROM items WHERE obra_id = ${obraId} ORDER BY id DESC`;
        return json(200, rows);
      } else {
        const rows = await sql`SELECT * FROM items ORDER BY id DESC`;
        return json(200, rows);
      }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { nombre, categoria, subtipo, marca, cantidad, ubicacion, observaciones, obra_id } = body;
      if (!nombre || !categoria || !marca || !obra_id) return json(400, { error: 'Campos requeridos' });
      const rows = await sql`
        INSERT INTO items (nombre, categoria, subtipo, marca, cantidad, ubicacion, observaciones, obra_id)
        VALUES (${nombre}, ${categoria}, ${subtipo}, ${marca}, ${cantidad}, ${ubicacion}, ${observaciones}, ${obra_id})
        RETURNING *
      `;
      return json(201, rows[0]);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return json(400, { error: 'id requerido' });
      const body = JSON.parse(event.body || '{}');
      const { nombre, categoria, subtipo, marca, cantidad, ubicacion, observaciones, obra_id } = body;
      const rows = await sql`
        UPDATE items SET
          nombre=${nombre}, categoria=${categoria}, subtipo=${subtipo}, marca=${marca},
          cantidad=${cantidad}, ubicacion=${ubicacion}, observaciones=${observaciones}, obra_id=${obra_id},
          updated_at=now()
        WHERE id=${id} RETURNING *
      `;
      return rows.length ? json(200, rows[0]) : json(404, { error: 'Not found' });
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return json(400, { error: 'id requerido' });
      await sql`DELETE FROM items WHERE id=${id}`;
      return json(204, {});
    }

    return json(405, { error: 'Método no soportado' });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
