/* =====================================================================
 *  SOMAR — Configuración pública de Supabase
 *  IMPORTANTE: Aquí SOLO va la ANON KEY (es pública por diseño; RLS
 *  protege los datos). NUNCA poner la SERVICE_ROLE_KEY en el frontend.
 * ===================================================================== */
window.SOMAR_CONFIG = {
  // URL del proyecto Supabase (API)
  SUPABASE_URL: 'https://api.neura.com.py',

  // ANON KEY pública (segura para el navegador)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0MTAxNDYxLCJleHAiOjE5MzE3ODE0NjF9.7_wAph8IolPMXtgfpezSwS5XR62IdD__qhqCywLDp3Q',

  // Schema exclusivo del proyecto (PostgREST debe exponerlo)
  DB_SCHEMA: 'somarelectrodomesticos',

  // Bucket de Storage para medios
  STORAGE_BUCKET: 'somar-media',

  // Fallback: si Supabase no está configurado/alcanzable, la web usa
  // los datos embebidos en index.html (para no romperse durante la
  // transición). Poner en false cuando la DB esté cargada y verificada.
  USE_EMBEDDED_FALLBACK: true
};
