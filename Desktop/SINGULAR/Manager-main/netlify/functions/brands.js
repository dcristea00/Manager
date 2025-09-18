import { sql, json } from './_db.js';

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try{
    const qs = event.queryStringParameters || {};
    const q = (qs.q || '').trim().toLowerCase();
    const category = qs.category || null;
    let rows;
    if (category) {
      rows = await sql`
        SELECT id, name, category
        FROM construction_brands
        WHERE is_active = true AND (category = ${category} OR ${category} IS NULL)
        ORDER BY name
      `;
    } else {
      rows = await sql`
        SELECT id, name, category
        FROM construction_brands
        WHERE is_active = true
        ORDER BY name
      `;
    }
    if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q));
    return json(200, rows);
  }catch(err){
    return json(500, { error: err.message });
  }
}
