import { sql, json } from './_db.js';

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try{
    const path = (event.path || '').toLowerCase();
    const qs = event.queryStringParameters || {};

    // /pivot
    if (path.endsWith('/pivot')){
      const type = qs.type === 'material' ? 'material' : 'tool';
      const family = qs.family && qs.family !== 'todas' ? qs.family : null;

      // suppliers (columnas)
      const suppliers = await sql`SELECT id, name FROM suppliers ORDER BY name`;

      // items (filas)
      let items;
      if (type === 'tool'){
        items = await sql`
          SELECT id, name, family
          FROM tools
          WHERE 1=1 AND (${family} IS NULL OR family=${family})
          ORDER BY name
        `;
      } else {
        items = await sql`
          SELECT id, name, family
          FROM materials
          WHERE 1=1 AND (${family} IS NULL OR family=${family})
          ORDER BY name
        `;
      }

      // precios (celdas)
      const prices = await sql`
        SELECT supplier_id, item_type, item_id, price::text
        FROM supplier_prices
        WHERE item_type=${type}
      `;

      // construir pivote
      const matrix = items.map(it => {
        const row = { item_id: it.id, item_name: it.name, family: it.family };
        for (const s of suppliers) row['s_'+s.id] = null;
        return row;
      });
      const idxById = new Map(items.map((it,i)=>[it.id,i]));
      for (const p of prices){
        const i = idxById.get(p.item_id);
        if (i !== undefined){
          matrix[i]['s_'+p.supplier_id] = p.price;
        }
      }
      return json(200, { suppliers, items: matrix });
    }

    // /suppliers
    if (path.endsWith('/suppliers')){
      const rows = await sql`SELECT id, name FROM suppliers ORDER BY name`;
      return json(200, rows);
    }

    return json(404, { error: 'Not found' });
  }catch(err){
    return json(500, { error: err.message });
  }
}

