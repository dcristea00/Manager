export async function handler() {
    return { statusCode: 200, body: JSON.stringify({ ok: true, env: !!process.env.NETLIFY_DATABASE_URL }) };
  }
  