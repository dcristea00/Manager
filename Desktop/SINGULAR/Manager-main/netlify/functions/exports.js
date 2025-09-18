import { json } from './_db.js';

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try{
    const path = (event.path || '').toLowerCase();
    if (!path.endsWith('/pdf')) return json(404, { error: 'Not found' });
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no soportado' });

    const body = JSON.parse(event.body || '{}');
    const { pdfBase64, filename='export.pdf' } = body;
    if (!pdfBase64) return json(400, { error: 'pdfBase64 requerido' });

    // Echo (si prefieres, puedes almacenar o enviar a S3, etc.)
    return json(200, { filename, pdfBase64 });
  }catch(err){
    return json(500, { error: err.message });
  }
}
