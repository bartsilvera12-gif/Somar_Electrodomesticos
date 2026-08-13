/* =====================================================================
 *  SOMAR Admin — Subida de archivos a Storage
 *
 *  POR QUÉ NO USAMOS sb.storage.upload() DIRECTO: el servicio de Storage
 *  de api.neura.com.py no devuelve headers CORS, así que el navegador
 *  bloquea el preflight y fetch falla con "Failed to fetch". Subimos
 *  entonces a /api/upload.php (mismo origen → CORS no aplica) y ese
 *  archivo reenvía a Storage desde el servidor.
 *
 *  La lectura de imágenes NO pasa por acá: los <img src> apuntan a
 *  /storage/v1/object/public/... y las etiquetas <img> no hacen CORS.
 *
 *  Devuelve { data, error } igual que supabase-js, para que los llamadores
 *  no cambien su manejo de errores.
 *
 *  SI NEURA ARREGLA EL CORS: poner PROXY_ENDPOINT en null y todo vuelve
 *  a ir directo a Storage, sin tocar nada más.
 * ===================================================================== */
(function () {
  var PROXY_ENDPOINT = '/api/upload.php';

  var cfg = window.SOMAR_CONFIG || {};
  var proxyMissing = false; // se marca en true si el hosting no tiene el proxy

  function bucket() { return cfg.STORAGE_BUCKET || 'somar-media'; }

  function sbClient() {
    return (window.SOMAR_AUTH && window.SOMAR_AUTH.client && window.SOMAR_AUTH.client()) || null;
  }

  async function accessToken() {
    var sb = sbClient();
    if (!sb) return '';
    var s = await sb.auth.getSession();
    return (s && s.data && s.data.session && s.data.session.access_token) || '';
  }

  function err(msg) { return { data: null, error: { message: msg } }; }

  // Lee la respuesta del proxy. Distingue "el proxy no está" de "el proxy
  // respondió un error", porque la acción a tomar es distinta.
  async function readProxy(res) {
    if (res.status === 404) { proxyMissing = true; return null; }
    var body = null;
    try { body = await res.json(); } catch (e) { /* respuesta no-JSON */ }
    if (!res.ok || !body || body.ok !== true) {
      var msg = (body && body.error) ||
        'El servidor respondió ' + res.status + ' al subir la imagen.';
      throw new Error(msg);
    }
    return body;
  }

  var API = {
    /**
     * Sube un archivo al bucket.
     * @param {string} path  ruta dentro del bucket (ej: 'products/12/foto.jpg')
     * @param {File}   file
     * @returns {Promise<{data, error}>}
     */
    upload: async function (path, file) {
      if (!file) return err('No se seleccionó ningún archivo.');

      var token = await accessToken();
      if (!token) return err('Tu sesión expiró. Volvé a iniciar sesión para subir imágenes.');

      if (PROXY_ENDPOINT && !proxyMissing) {
        try {
          var fd = new FormData();
          fd.append('action', 'upload');
          fd.append('path', path);
          fd.append('token', token);
          fd.append('file', file, file.name);

          var res = await fetch(PROXY_ENDPOINT, {
            method: 'POST',
            body: fd,
            headers: { 'Authorization': 'Bearer ' + token }
          });
          var body = await readProxy(res);
          if (body) return { data: { path: body.path || path }, error: null };
        } catch (e) {
          // Un TypeError acá es red/DNS del propio sitio, no CORS.
          if (e instanceof TypeError) {
            return err('No se pudo contactar al servidor del sitio para subir la imagen.');
          }
          return err(e.message || String(e));
        }
      }

      // Fallback: subida directa (solo funciona si Storage tiene CORS).
      var sb = sbClient();
      if (!sb) return err('Supabase no está inicializado.');
      var up = await sb.storage.from(bucket())
        .upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) return { data: null, error: up.error };
      return { data: { path: path }, error: null };
    },

    /**
     * Borra archivos del bucket. No es crítico: si falla, el llamador
     * sigue adelante y solo quedan archivos huérfanos.
     * @param {string[]} paths
     */
    remove: async function (paths) {
      if (!paths || !paths.length) return { data: null, error: null };

      var token = await accessToken();
      if (!token) return err('Sesión expirada.');

      if (PROXY_ENDPOINT && !proxyMissing) {
        try {
          var fd = new FormData();
          fd.append('action', 'delete');
          fd.append('paths', JSON.stringify(paths));
          fd.append('token', token);

          var res = await fetch(PROXY_ENDPOINT, {
            method: 'POST',
            body: fd,
            headers: { 'Authorization': 'Bearer ' + token }
          });
          var body = await readProxy(res);
          if (body) return { data: null, error: null };
        } catch (e) {
          return err(e.message || String(e));
        }
      }

      var sb = sbClient();
      if (!sb) return err('Supabase no está inicializado.');
      var rm = await sb.storage.from(bucket()).remove(paths);
      return { data: rm.data || null, error: rm.error || null };
    }
  };

  window.SOMAR_STORAGE = API;
})();
