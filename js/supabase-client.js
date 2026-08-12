/* =====================================================================
 *  SOMAR — Cliente Supabase (frontend público)
 *  Requiere que @supabase/supabase-js (UMD) esté cargado antes:
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *  Apunta EXPLÍCITAMENTE al schema del proyecto: somarelectrodomesticos.
 * ===================================================================== */
(function () {
  var cfg = window.SOMAR_CONFIG || {};
  var lib = window.supabase; // UMD global de supabase-js

  if (!lib || !lib.createClient) {
    console.warn('[SOMAR] supabase-js no está cargado. La web usará el fallback embebido.');
    window.SOMAR_SB = null;
    return;
  }
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.warn('[SOMAR] Falta configuración de Supabase (js/config.js).');
    window.SOMAR_SB = null;
    return;
  }

  // Cliente con el schema del proyecto por defecto (no public).
  window.SOMAR_SB = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    db: { schema: cfg.DB_SCHEMA || 'somarelectrodomesticos' },
    auth: { persistSession: true, autoRefreshToken: true },
    global: { headers: { 'x-client-info': 'somar-web' } }
  });

  // URL pública de un archivo en el bucket de medios.
  window.SOMAR_MEDIA_URL = function (path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path) || path.charAt(0) === '/') return path;
    // Recursos locales del repo: root-absolutos para que funcionen desde
    // cualquier subcarpeta (p. ej. /admin/productos/), no solo la home.
    if (path.indexOf('assets/') === 0) return '/' + path;
    var base = (cfg.SUPABASE_URL || '').replace(/\/$/, '');
    return base + '/storage/v1/object/public/' + (cfg.STORAGE_BUCKET || 'somar-media') + '/' + path;
  };
})();
