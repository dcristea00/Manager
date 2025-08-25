import { sql, json } from './_db.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try {
    const id = event.queryStringParameters?.id || null;

    if (event.httpMethod === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM obras WHERE id = ${id}`;
        return rows.length ? json(200, rows[0]) : json(404, { error: 'Not found' });
      }
      const rows = await sql`SELECT * FROM obras ORDER BY nombre`;
      return json(200, rows);
    }

    if (event.httpMethod === 'POST') {
      const { nombre } = JSON.parse(event.body || '{}');
      if (!nombre?.trim()) return json(400, { error: 'nombre requerido' });
      const [row] = await sql`INSERT INTO obras (nombre) VALUES (${nombre.trim()}) RETURNING *`;
      return json(201, row);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return json(400, { error: 'id requerido' });
      const { nombre } = JSON.parse(event.body || '{}');
      if (!nombre?.trim()) return json(400, { error: 'nombre requerido' });
      const rows = await sql`UPDATE obras SET nombre=${nombre.trim()} WHERE id=${id} RETURNING *`;
      return rows.length ? json(200, rows[0]) : json(404, { error: 'Not found' });
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return json(400, { error: 'id requerido' });
      await sql`DELETE FROM obras WHERE id=${id}`;
      return json(204, {});
    }

    return json(405, { error: 'Método no soportado' });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
