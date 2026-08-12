/* =====================================================================
 *  SOMAR — Build de producción para Hostinger
 *  Copia solo los archivos que van al hosting a la carpeta dist/.
 *  Uso:  node build.mjs
 *  Luego subí el CONTENIDO de dist/ a public_html en Hostinger.
 * ===================================================================== */
import { rmSync, mkdirSync, cpSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');

// Archivos y carpetas que SÍ van al hosting (runtime del sitio + panel).
const INCLUDE = [
  'index.html',
  'support.js',
  'image-slot.js',
  'js',
  'assets',
  'admin',
  'politicadeprivacidad'
];

// Limpiar dist/ anterior
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

let copied = 0;
for (const item of INCLUDE) {
  const src = join(ROOT, item);
  if (!existsSync(src)) { console.warn('  (omitido, no existe) ' + item); continue; }
  cpSync(src, join(DIST, item), { recursive: true });
  copied++;
  console.log('  + ' + item);
}

// Tamaño total del dist
function dirSize(p) {
  let total = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const full = join(p, e.name);
    total += e.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}
const mb = (dirSize(DIST) / (1024 * 1024)).toFixed(2);

console.log('\n✅ Build listo en dist/ (' + copied + ' items, ' + mb + ' MB)');
console.log('   Subí el CONTENIDO de dist/ a public_html en Hostinger.');
