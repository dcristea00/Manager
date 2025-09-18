// [ANCHOR: ITEM_TEMPLATE_ENDPOINTS]
import { sql, json } from './_db.js';

function normalizeName(str=''){
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .trim()
    .replace(/\s+/g,' ');
}

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try{
    const path = (event.path || '').toLowerCase();
    const qs = event.queryStringParameters || {};

    // GET /?name=
    if (event.httpMethod === 'GET' && !path.endsWith('/upsert')){
      const name = qs.name || '';
      const norm = normalizeName(name);
      if (!norm || norm.length < 2) return json(200, null);
      const rows = await sql`SELECT display_name, default_category, default_subtype FROM item_templates WHERE normalized_name=${norm}`;
      return json(200, rows[0] || null);
    }

    // POST /upsert { name, category, subtype }
    if (event.httpMethod === 'POST' && path.endsWith('/upsert')){
      const body = JSON.parse(event.body || '{}');
      const display = String(body.name || '').trim();
      const category = body.category || body.categoria || null;
      const subtype  = body.subtype  || body.subtipo  || null;
      const norm = normalizeName(display);
      if (!display || !category) return json(400, { error:'name y category son obligatorios' });
      const rows = await sql`
        INSERT INTO item_templates (normalized_name, display_name, default_category, default_subtype, usage_count, last_used_at)
        VALUES (${norm}, ${display}, ${category}, ${subtype}, 1, now())
        ON CONFLICT (normalized_name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          default_category = EXCLUDED.default_category,
          default_subtype = EXCLUDED.default_subtype,
          usage_count = item_templates.usage_count + 1,
          last_used_at = now()
        RETURNING id`;
      return json(200, { ok:true, id: rows[0]?.id || null });
    }

    return json(404, { error:'Not found' });
  }catch(err){
    return json(500, { error: err.message });
  }
}
