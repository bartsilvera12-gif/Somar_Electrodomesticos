/* =====================================================================
 *  SOMAR Admin — Eliminación de fondo con IA (100% en el navegador)
 *
 *  Usa @imgly/background-removal (ONNX Runtime Web, WASM/WebGPU). La imagen
 *  NUNCA se envía a un servidor: solo se descarga el modelo la primera vez
 *  (queda cacheado por el navegador). Carga LAZY: la librería + el modelo se
 *  bajan recién cuando se procesa la PRIMERA imagen.
 *
 *  API:
 *    await SOMAR_BG.removeImageBackground(file, { onProgress })
 *      -> { file: File(png transparente), previewUrl, originalFile }
 *    SOMAR_BG.isSupported()   -> boolean (features mínimas del navegador)
 *
 *  Falla de forma segura: si algo sale mal, lanza error y quien llama decide
 *  (en products.js: "Usar imagen original").
 * ===================================================================== */
(function () {
  var VERSION = '1.5.5';
  // Assets del modelo (wasm/onnx/resources). Mismo origen para módulo y assets.
  var PUBLIC_PATH = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@' + VERSION + '/dist/';
  var MAX_DIM = 1600;          // límite de tamaño del resultado (mantiene aspecto)
  var libPromise = null;       // import() dinámico, singleton (lazy)

  function isSupported() {
    return typeof createImageBitmap === 'function' &&
           typeof WebAssembly === 'object' &&
           typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
  }

  // Carga la librería una sola vez (lazy). Intenta esm.sh y cae a jsdelivr.
  function loadLib() {
    if (libPromise) return libPromise;
    libPromise = import('https://esm.sh/@imgly/background-removal@' + VERSION)
      .catch(function () { return import(PUBLIC_PATH + 'index.mjs'); })
      .then(function (mod) {
        var fn = mod.removeBackground || (mod.default && mod.default.removeBackground) || mod.default;
        if (typeof fn !== 'function') throw new Error('bg-removal: export no encontrado');
        return fn;
      });
    // Si falla la carga, permitir reintentar en la próxima llamada.
    libPromise.catch(function () { libPromise = null; });
    return libPromise;
  }

  // Reescala a MAX_DIM y re-encoda como PNG CONSERVANDO transparencia.
  async function optimizePng(blob) {
    var bmp = await createImageBitmap(blob);
    try {
      var scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
      var w = Math.max(1, Math.round(bmp.width * scale));
      var h = Math.max(1, Math.round(bmp.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);            // fondo transparente, NO blanco
      ctx.drawImage(bmp, 0, 0, w, h);
      var out = await new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
      return out || blob;
    } finally { if (bmp.close) bmp.close(); }
  }

  function safeName(file) {
    var base = (file && file.name ? file.name : 'imagen').replace(/\.[^.]+$/, '');
    base = base.replace(/[^a-z0-9\-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return (base || 'imagen') + '.png';
  }

  async function removeImageBackground(file, opts) {
    opts = opts || {};
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};

    onProgress({ phase: 'model', text: 'Preparando inteligencia artificial…', pct: null });
    var removeBackground = await loadLib();

    var resultBlob = await removeBackground(file, {
      publicPath: PUBLIC_PATH,
      output: { format: 'image/png' },
      progress: function (key, current, total) {
        var pct = (total && total > 0) ? Math.min(100, Math.round((current / total) * 100)) : null;
        if (/fetch|download|resourc|model|wasm|onnx/i.test(String(key))) {
          onProgress({ phase: 'model', pct: pct,
            text: pct != null ? ('Preparando IA · ' + pct + '%') : 'Preparando inteligencia artificial…' });
        } else {
          onProgress({ phase: 'compute', pct: pct, text: 'Eliminando fondo…' });
        }
      }
    });

    onProgress({ phase: 'optimize', text: 'Optimizando…', pct: null });
    var optimized = await optimizePng(resultBlob);
    var processedFile = new File([optimized], safeName(file), { type: 'image/png' });
    return { file: processedFile, previewUrl: URL.createObjectURL(processedFile), originalFile: file };
  }

  window.SOMAR_BG = {
    removeImageBackground: removeImageBackground,
    preload: loadLib,          // opcional: precargar manualmente
    isSupported: isSupported,
    MAX_DIM: MAX_DIM
  };
})();
