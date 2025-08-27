import { sql, json } from './_db.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  try {
    const qs = event.queryStringParameters || {};
    const id = qs.id || null;
    const obraId = qs.obraId || qs.obra_id || null;

    // GET
    if (event.httpMethod === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM items WHERE id=${id}`;
        return rows.length ? json(200, rows[0]) : json(404, { error: 'Not found' });
      }
      const rows = obraId
        ? await sql`SELECT * FROM items WHERE obra_id=${obraId} ORDER BY nombre`
        : await sql`SELECT * FROM items ORDER BY nombre`;
      return json(200, rows);
    }

    // POST  ->  cantidad por defecto = 1 (y nunca < 0)
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.obra_id) return json(400, { error: 'obra_id requerido' });
      if (!b.nombre?.trim()) return json(400, { error: 'nombre requerido' });

      let cantidad = Number(b.cantidad);
      if (!Number.isFinite(cantidad)) cantidad = 1;   // <- clave: default 1
      if (cantidad < 0) cantidad = 0;

      const [row] = await sql`
        INSERT INTO items (obra_id, nombre, categoria, subtipo, cantidad, marca, ubicacion, observaciones)
        VALUES (${b.obra_id}, ${b.nombre.trim()}, ${b.categoria || null}, ${b.subtipo || null}, ${cantidad},
                ${b.marca || null}, ${b.ubicacion || null}, ${b.observaciones || null})
        RETURNING *`;
      return json(201, row);
    }

    // PUT (parcial por COALESCE)
    if (event.httpMethod === 'PUT') {
      if (!id) return json(400, { error: 'id requerido' });
      const b = JSON.parse(event.body || '{}');

      const rows = await sql`
        UPDATE items SET
          nombre       = COALESCE(${b.nombre ?? null}, nombre),
          categoria    = COALESCE(${b.categoria ?? null}, categoria),
          subtipo      = COALESCE(${b.subtipo ?? null}, subtipo),
          cantidad     = COALESCE(${b.cantidad ?? null}, cantidad),
          marca        = COALESCE(${b.marca ?? null}, marca),
          ubicacion    = COALESCE(${b.ubicacion ?? null}, ubicacion),
          observaciones= COALESCE(${b.observaciones ?? null}, observaciones)
        WHERE id=${id}
        RETURNING *`;
      return rows.length ? json(200, rows[0]) : json(404, { error: 'Not found' });
    }

    // DELETE
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
