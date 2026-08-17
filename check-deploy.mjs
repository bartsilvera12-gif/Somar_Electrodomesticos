/* =====================================================================
 *  SOMAR — Verificar que el hosting tenga el build actual
 *
 *  POR QUÉ EXISTE: el extractor de ZIP de Hostinger puede no sobrescribir
 *  carpetas que ya existen. El síntoma es feo: el panel queda mezclado
 *  (api/ nuevo, admin/ viejo) y las subidas de imágenes fallan con un
 *  error de CORS que no dice nada del deploy.
 *
 *  Uso:  node check-deploy.mjs [https://somarelectropy.com]
 *  Compara el tamaño de cada .html/.js de dist/ contra el que sirve el
 *  hosting. Los .php solo se comprueban que respondan (el servidor los
 *  ejecuta, así que el tamaño no coincide nunca).
 * ===================================================================== */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const BASE = (process.argv[2] || 'https://somarelectropy.com').replace(/\/+$/, '');

// Solo el código. assets/ son megas de imágenes y no cambian el comportamiento.
const CHECK_EXT = ['.html', '.js', '.php'];
const SKIP_DIRS = new Set(['assets']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), out);
    } else if (CHECK_EXT.some((x) => e.name.endsWith(x))) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

const files = walk(DIST);
if (!files.length) {
  console.error('No hay dist/. Corré primero:  node build.mjs');
  process.exit(1);
}

console.log('Comparando ' + files.length + ' archivos contra ' + BASE + '\n');

// Hostinger no siempre devuelve 404: para una ruta que no existe sirve la
// portada con status 200. Guardamos su tamaño para reconocer ese caso, que
// si no pasa desapercibido (ej: /politicadeprivacidad/ mostrando el home).
let homeSize = -1;
try {
  homeSize = Buffer.byteLength(await (await fetch(BASE + '/')).text());
} catch { /* si no responde el home, el resto igual se compara */ }

const stale = [];
const missing = [];
let ok = 0;

for (const abs of files) {
  const rel = relative(DIST, abs).split('\\').join('/');
  const url = BASE + '/' + rel;
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    missing.push([rel, 'sin respuesta (' + e.message + ')']);
    continue;
  }

  if (res.status === 404) { missing.push([rel, '404 — no está en el hosting']); continue; }

  // Los .php los ejecuta el servidor: comparar tamaño no tiene sentido.
  if (rel.endsWith('.php')) {
    if (res.status >= 500) missing.push([rel, 'error ' + res.status + ' del servidor']);
    else ok++;
    continue;
  }

  if (!res.ok) { missing.push([rel, 'respondió ' + res.status]); continue; }

  const remote = Buffer.byteLength(await res.text());
  const local = statSync(abs).size;
  if (remote === local) { ok++; continue; }
  if (remote === homeSize && rel !== 'index.html') {
    missing.push([rel, 'el servidor devuelve la portada: la página no está']);
    continue;
  }
  stale.push([rel, 'servidor ' + remote + ' B ≠ build ' + local + ' B']);
}

for (const [f, why] of missing) console.log('  FALTA    ' + f + '  (' + why + ')');
for (const [f, why] of stale) console.log('  VIEJO    ' + f + '  (' + why + ')');

console.log('\n' + ok + ' al día, ' + stale.length + ' desactualizados, ' + missing.length + ' faltantes');

if (stale.length || missing.length) {
  const carpetas = [...new Set([...stale, ...missing].map(([f]) => f.split('/')[0]))];
  console.log('\nCarpetas a resubir: ' + carpetas.join(', '));
  console.log('En Hostinger, renombrá esas carpetas en public_html antes de extraer');
  console.log('el ZIP: el extractor no sobrescribe lo que ya existe.');
  process.exit(1);
}
console.log('El hosting está al día.');
