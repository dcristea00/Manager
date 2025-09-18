import { sql, json } from './_db.js';

function parseISODate(s){
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('start inválido');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try{
    const path = (event.path || '').toLowerCase();

    // GET /week?start=YYYY-MM-DD
    if (event.httpMethod === 'GET' && path.endsWith('/week')){
      const qs = event.queryStringParameters || {};
      const startStr = qs.start;
      if (!startStr) return json(400, { error: 'start requerido (YYYY-MM-DD)' });
      const start = parseISODate(startStr);
      const days = [...Array(7)].map((_,i)=>{
        const d = new Date(start); d.setUTCDate(d.getUTCDate()+i);
        return d.toISOString().slice(0,10);
      });

      const workers = await sql`SELECT id, full_name FROM workers WHERE is_active = true ORDER BY full_name`;
      const logs = await sql`
        SELECT id, worker_id, work_date::text as work_date, hours::text as hours, reason, project_id
        FROM work_logs
        WHERE work_date BETWEEN ${days[0]} AND ${days[6]}
      `;

      const byWorker = new Map(workers.map(w=>[w.id, { worker:w, total:0, days:Object.fromEntries(days.map(d=>[d,null]))}]));
      for (const l of logs){
        const w = byWorker.get(l.worker_id);
        if (w){
          w.days[l.work_date] = { id: l.id, hours: parseFloat(l.hours), reason: l.reason||null, project_id: l.project_id||null };
        }
      }
      for (const obj of byWorker.values()){
        obj.total = Object.values(obj.days).reduce((acc, v)=> acc + (v? v.hours : 0), 0);
      }

      return json(200, { days, workers: [...byWorker.values()] });
    }

    // POST /seed-week
    if (event.httpMethod === 'POST' && path.endsWith('/seed-week')){
      const { start } = JSON.parse(event.body || '{}');
      if (!start) return json(400, { error: 'start requerido' });
      const s = parseISODate(start);
      const dates = [...Array(7)].map((_,i)=>{
        const d = new Date(s); d.setUTCDate(d.getUTCDate()+i);
        return d.toISOString().slice(0,10);
      });
      const defaults = [10,10,10,10,10,5,0]; // Lu..Do

      const workers = await sql`SELECT id FROM workers WHERE is_active = true`;
      const inserts = [];
      for (const w of workers){
        for (let i=0;i<7;i++){
          inserts.push(sql`
            INSERT INTO work_logs (worker_id, work_date, hours)
            VALUES (${w.id}, ${dates[i]}, ${defaults[i]})
            ON CONFLICT (worker_id, work_date) DO NOTHING
          `);
        }
      }
      await Promise.all(inserts);
      return json(200, { created: true });
    }

    // PUT /log/:id
    if (event.httpMethod === 'PUT' && path.includes('/log/')){
      const id = path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      const hours = body.hours;
      const reason = body.reason || null;
      const project_id = body.project_id || null;
      if (hours == null || hours < 0 || hours > 24) return json(400, { error: 'hours 0..24' });
      await sql`
        UPDATE work_logs
        SET hours=${hours}, reason=${reason}, project_id=${project_id}, updated_at=now()
        WHERE id=${id}
      `;
      return json(200, { ok:true });
    }

    return json(404, { error: 'Not found' });
  }catch(err){
    return json(500, { error: err.message });
  }
}
