import { sql, json } from './_db.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  
  try {
    const qs = event.queryStringParameters || {};
    const id = qs.id || null;
    const obraId = qs.obraId || null;

    // GET - Obtener items
    if (event.httpMethod === 'GET') {
      if (obraId) {
        // Obtener items de una obra específica
        const rows = await sql`
          SELECT id, obra_id, nombre, categoria, subtipo, cantidad, marca, ubicacion, observaciones, created_at, updated_at
          FROM items 
          WHERE obra_id = ${obraId}
          ORDER BY nombre ASC
        `;
        return json(200, rows);
      } else {
        // Obtener todos los items (para sugerencias y categorías)
        const rows = await sql`
          SELECT id, obra_id, nombre, categoria, subtipo, cantidad, marca, ubicacion, observaciones, created_at, updated_at
          FROM items 
          ORDER BY nombre ASC
        `;
        return json(200, rows);
      }
    }

    // POST - Crear nuevo item
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { obra_id, nombre, categoria, subtipo, cantidad, marca, ubicacion, observaciones } = body;
      
      if (!obra_id || !nombre || !categoria) {
        return json(400, { error: 'obra_id, nombre y categoria son requeridos' });
      }

      const rows = await sql`
        INSERT INTO items (obra_id, nombre, categoria, subtipo, cantidad, marca, ubicacion, observaciones, created_at, updated_at)
        VALUES (${obra_id}, ${nombre}, ${categoria}, ${subtipo || null}, ${cantidad || 0}, ${marca || ''}, ${ubicacion || ''}, ${observaciones || ''}, NOW(), NOW())
        RETURNING *
      `;
      
      return json(201, rows[0]);
    }

    // PUT - Actualizar item existente
    if (event.httpMethod === 'PUT') {
      if (!id) return json(400, { error: 'id requerido' });
      
      const body = JSON.parse(event.body || '{}');
      const { obra_id, nombre, categoria, subtipo, cantidad, marca, ubicacion, observaciones } = body;

      // Construir la query de actualización dinámicamente
      const updateFields = [];
      const updateValues = [];

      if (obra_id !== undefined) {
        updateFields.push('obra_id');
        updateValues.push(obra_id);
      }
      if (nombre !== undefined) {
        updateFields.push('nombre');
        updateValues.push(nombre);
      }
      if (categoria !== undefined) {
        updateFields.push('categoria');
        updateValues.push(categoria);
      }
      if (subtipo !== undefined) {
        updateFields.push('subtipo');
        updateValues.push(subtipo || null);
      }
      if (cantidad !== undefined) {
        updateFields.push('cantidad');
        updateValues.push(cantidad || 0);
      }
      if (marca !== undefined) {
        updateFields.push('marca');
        updateValues.push(marca || '');
      }
      if (ubicacion !== undefined) {
        updateFields.push('ubicacion');
        updateValues.push(ubicacion || '');
      }
      if (observaciones !== undefined) {
        updateFields.push('observaciones');
        updateValues.push(observaciones || '');
      }

      // Siempre actualizar updated_at
      updateFields.push('updated_at');
      updateValues.push(sql`NOW()`);

      if (updateFields.length === 1) { // Solo updated_at
        return json(400, { error: 'No hay campos para actualizar' });
      }

      // Construir la query
      const setClause = updateFields.map((field, index) => {
        if (field === 'updated_at') return `${field} = NOW()`;
        return `${field} = $${index + 2}`; // +2 porque $1 será el id
      }).join(', ');

      const query = `UPDATE items SET ${setClause} WHERE id = $1 RETURNING *`;
      const params = [id, ...updateValues.filter((_, index) => updateFields[index] !== 'updated_at')];

      const rows = await sql(query, params);
      
      if (rows.length === 0) {
        return json(404, { error: 'Item no encontrado' });
      }

      return json(200, rows[0]);
    }

    // DELETE - Eliminar item
    if (event.httpMethod === 'DELETE') {
      if (!id) return json(400, { error: 'id requerido' });
      
      const rows = await sql`DELETE FROM items WHERE id = ${id} RETURNING id`;
      
      if (rows.length === 0) {
        return json(404, { error: 'Item no encontrado' });
      }
      
      return json(200, { success: true, deleted_id: rows[0].id });
    }

    return json(405, { error: 'Método no soportado' });
    
  } catch (err) {
    console.error('Error en items handler:', err);
    return json(500, { error: err.message || 'Error interno del servidor' });
  }
}