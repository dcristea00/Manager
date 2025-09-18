// [ANCHOR: INVENTARIO_EDITAR_CAMBIO_OBRA_FIX]
import { sql, json } from './_db.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try {
    const qs = event.queryStringParameters || {};
    const id = qs.id || null;

    if (event.httpMethod === 'PUT') {
      if (!id) return json(400, { error: 'id requerido' });
      const body = JSON.parse(event.body || '{}');
      const project_id = body.project_id || body.obra_id || body.obraId || null;
      if (!project_id) return json(400, { error: 'project_id requerido' });

      // Intentamos actualizar en items, luego tools, luego materials
      const res1 = await sql`
        UPDATE items SET project_id=${project_id}, updated_at=now()
        WHERE id=${id} RETURNING id
      `;
      if (res1.length) return json(200, { ok: true, table: 'items' });

      const res2 = await sql`
        UPDATE tools SET project_id=${project_id}, updated_at=now()
        WHERE id=${id} RETURNING id
      `;
      if (res2.length) return json(200, { ok: true, table: 'tools' });

      const res3 = await sql`
        UPDATE materials SET project_id=${project_id}, updated_at=now()
        WHERE id=${id} RETURNING id
      `;
      if (res3.length) return json(200, { ok: true, table: 'materials' });

      return json(404, { error: 'Ítem no encontrado' });
    }

    if (event.httpMethod === 'GET') {
      const tipo = qs.tipo || null;
      try {
        if (!tipo) {
          const rows = await sql`SELECT * FROM items`;
          return json(200, rows);
        } else if (tipo === 'tool') {
          const rows = await sql`SELECT * FROM tools`;
          return json(200, rows);
        } else if (tipo === 'material') {
          const rows = await sql`SELECT * FROM materials`;
          return json(200, rows);
        }
      } catch (e) {
        return json(200, []); // si no existe la tabla, devolvemos vacío
      }
    }

    return json(405, { error: 'Método no soportado' });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
