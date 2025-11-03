// netlify/functions/obra_photos.js
// Serverless con migración automática a obra_id TEXT + defensas

import { sql, json } from './_db.js';

async function ensureTableAndMigrate() {
  // 1) Crear si no existe
  await sql`
    CREATE TABLE IF NOT EXISTS obra_photos (
      obra_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // 2) Ver tipo real de la columna por si viene de un despliegue viejo (BIGINT)
  const info = await sql`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_name='obra_photos' AND column_name='obra_id'
    LIMIT 1
  `;
  const type = info?.[0]?.data_type?.toLowerCase?.() || 'text';

  if (type !== 'text') {
    // Migrar a TEXT preservando datos
    await sql`ALTER TABLE obra_photos ALTER COLUMN obra_id TYPE TEXT USING obra_id::text`;
  }
}

const okHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: okHeaders, body: '' };
  }

  try {
    await ensureTableAndMigrate();

    const qs = event.queryStringParameters || {};
    const obra_id_q = (qs.obra_id || qs.obraId || '').trim();

    if (event.httpMethod === 'GET') {
      if (!obra_id_q) return json(400, { error: 'obra_id requerido' }, okHeaders);
      const rows = await sql`SELECT obra_id, data, updated_at FROM obra_photos WHERE obra_id=${obra_id_q}`;
      if (!rows.length) return json(404, { error: 'no-photo' }, okHeaders);
      return json(200, rows[0], okHeaders);
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return json(400, { error: 'JSON inválido' }, okHeaders);
      }
      const obra_id = String(body.obra_id || body.obraId || obra_id_q || '').trim();
      const data = String(body.data || body.dataURL || '').trim();

      if (!obra_id) return json(400, { error: 'obra_id requerido' }, okHeaders);
      if (!data) return json(400, { error: 'data (dataURL) requerido' }, okHeaders);

      // Defensa: tamaño (aprox) del dataURL (base64). 8 MB por defecto.
      const approxBytes = Math.floor((data.length * 3) / 4);
      if (approxBytes > 8 * 1024 * 1024) {
        return json(413, { error: 'Imagen demasiado grande (>8MB) tras redimensionar' }, okHeaders);
      }

      const rows = await sql`
        INSERT INTO obra_photos (obra_id, data, updated_at)
        VALUES (${obra_id}, ${data}, now())
        ON CONFLICT (obra_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()
        RETURNING obra_id, updated_at
      `;
      return json(200, { ok: true, obra_id: rows[0].obra_id, updated_at: rows[0].updated_at }, okHeaders);
    }

    if (event.httpMethod === 'DELETE') {
      if (!obra_id_q) return json(400, { error: 'obra_id requerido' }, okHeaders);
      await sql`DELETE FROM obra_photos WHERE obra_id=${obra_id_q}`;
      return { statusCode: 204, headers: okHeaders, body: '' };
    }

    return json(405, { error: 'Método no soportado' }, okHeaders);
  } catch (err) {
    // Log detallado (visible en Netlify → Functions → Logs)
    console.error('obra_photos error:', err);
    return json(500, { error: err.message || 'internal' }, okHeaders);
  }
}
