// ==========================
// netlify/functions/obra_photos.js
// ==========================
import { sql, json } from './_db.js';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS obra_photos (
      obra_id BIGINT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  try {
    await ensureTable();

    const qs = event.queryStringParameters || {};
    const obra_id = qs.obra_id || qs.obraId || null;

    if (event.httpMethod === 'GET') {
      if (!obra_id) return json(400, { error: 'obra_id requerido' });
      const rows = await sql`
        SELECT obra_id, data, updated_at
        FROM obra_photos WHERE obra_id=${obra_id}
      `;
      if (!rows.length) return json(404, { error: 'no-photo' });
      return json(200, rows[0], { 'Cache-Control': 'no-store' });
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const id = body.obra_id || body.obraId || obra_id;
      const data = body.data || body.dataURL || null;
      if (!id || !data) return json(400, { error: 'obra_id y data requeridos' });

      const rows = await sql`
        INSERT INTO obra_photos (obra_id, data, updated_at)
        VALUES (${id}, ${data}, now())
        ON CONFLICT (obra_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()
        RETURNING obra_id, updated_at
      `;
      return json(200, { ok: true, obra_id: rows[0].obra_id, updated_at: rows[0].updated_at });
    }

    if (event.httpMethod === 'DELETE') {
      if (!obra_id) return json(400, { error: 'obra_id requerido' });
      await sql`DELETE FROM obra_photos WHERE obra_id=${obra_id}`;
      return json(204, {});
    }

    return json(405, { error: 'Método no soportado' });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
