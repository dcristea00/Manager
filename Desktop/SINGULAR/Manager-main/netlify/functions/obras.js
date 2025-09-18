import { sql, json } from './_db.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try {
    const qs = event.queryStringParameters || {};
    const id = qs.id || null;

    if (event.httpMethod === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM obras WHERE id=${id}`;
        return rows.length ? json(200, rows[0]) : json(404, { error: 'Not found' });
      }
      const rows = await sql`SELECT * FROM obras ORDER BY id DESC`;
      return json(200, rows);
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.nombre && !body.name) return json(400, { error: 'name requerido' });
      const name = body.nombre || body.name;
      const rows = await sql`INSERT INTO obras (nombre) VALUES (${name}) RETURNING *`;
      return json(201, rows[0]);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return json(400, { error: 'id requerido' });
      const body = JSON.parse(event.body || '{}');
      const name = body.nombre || body.name || null;
      if (!name) return json(400, { error: 'name requerido' });
      const rows = await sql`UPDATE obras SET nombre=${name} WHERE id=${id} RETURNING *`;
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
