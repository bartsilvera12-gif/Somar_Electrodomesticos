# SOMAR Electrodomésticos — Setup del CMS / Panel Admin

Este documento explica cómo poner en marcha el backend (Supabase) y el panel
administrador, manteniendo la web pública actual intacta.

> **Seguridad:** el frontend usa **solo la ANON KEY**. La `SERVICE_ROLE_KEY`
> **nunca** debe estar en el repo, en `index.html`, en `/admin` ni en ningún JS
> enviado al navegador. Si se expuso, **rotala** en Supabase.

---

## 0. Requisitos

- Proyecto Supabase (API en `https://api.neura.com.py`).
- Acceso al **SQL Editor** del Dashboard de Supabase (o la CLI de Supabase).

---

## 1. Configuración del frontend

Editar `js/config.js`:

```js
window.SOMAR_CONFIG = {
  SUPABASE_URL: 'https://api.neura.com.py',
  SUPABASE_ANON_KEY: '<TU_ANON_KEY_PUBLICA>',
  DB_SCHEMA: 'somarelectrodomestico',
  STORAGE_BUCKET: 'somar-media',
  USE_EMBEDDED_FALLBACK: true
};
```

`USE_EMBEDDED_FALLBACK: true` deja los datos embebidos de `index.html` como
respaldo mientras se carga la DB. Poner en `false` cuando esté todo cargado y
verificado (para tener una única fuente de verdad).

---

## 2. Ejecutar la migración

En **SQL Editor** de Supabase, pegar y ejecutar:

```
supabase/migrations/20260809_001_somarelectrodomestico.sql
```

Crea el schema `somarelectrodomestico`, todas las tablas, funciones
(`set_updated_at`, `is_admin`), triggers, RLS, grants y el bucket `somar-media`.

Con la CLI:

```bash
supabase db push
# o
psql "$DATABASE_URL" -f supabase/migrations/20260809_001_somarelectrodomestico.sql
```

---

## 3. Ejecutar el seed

Luego de la migración, ejecutar:

```
supabase/seed.sql
```

Reconstruye el contenido ACTUAL: 18 productos con features, especificaciones,
cuotas (overrides), imágenes, categorías, marcas, beneficios, pasos,
testimonios, stats, redes, banners y configuración del sitio. Es re-ejecutable.

---

## 4. Exponer el schema en PostgREST (IMPORTANTE)

PostgREST solo expone `public` por defecto. Hay que agregar el schema:

**Opción A — Dashboard:** Project Settings → **API** → *Exposed schemas* →
agregar `somarelectrodomestico` → guardar.

**Opción B — SQL:**
```sql
alter role authenticator set pgrst.db_schemas = 'public, somarelectrodomestico, storage';
notify pgrst, 'reload config';
```

El cliente JS ya apunta al schema (`db.schema = 'somarelectrodomestico'`).

---

## 5. Crear el primer administrador

Los usuarios se crean con **Supabase Auth** (no con SQL de contraseñas).

1. Dashboard → **Authentication → Users → Add user** (email + contraseña).
   No habilitar registro público.
2. Copiar el **UUID** del usuario creado.
3. Insertarlo en `admin_users`:

```sql
insert into somarelectrodomestico.admin_users (user_id, full_name, role, is_active)
values ('8f6a7243-b63b-47b6-8c3e-884b1beaf32b', 'Administrador SOMAR', 'superadmin', true);
```

> UUID del administrador: `8f6a7243-b63b-47b6-8c3e-884b1beaf32b`.
> Verificá que ese UUID exista en `auth.users` (creá el usuario primero).

Solo los usuarios en `admin_users` con `is_active = true` pueden entrar al panel
y escribir en la base (lo garantiza RLS vía `is_admin()`).

---

## 6. Storage

La migración crea el bucket público `somar-media` con políticas:
- **Lectura pública** de los objetos.
- **Escritura/borrado** solo para administradores (`is_admin()`).

Organización sugerida de paths:
```
products/{product-id}/{timestamp}-nombre.webp
categories/...
brands/...
site/...
social/...
```

Migrar las fotos actuales (`assets/prod-*.jpg`) al bucket es opcional: por ahora
`product_images.image_url` apunta a `assets/prod-N.jpg` (siguen funcionando).
Al subir nuevas desde el panel, se guardan en Storage y se actualiza la URL.

---

## 7. Entrar al panel

- Login: `/admin/login`
- Panel: `/admin`  (protegido: sesión válida + `admin_users.is_active = true`)

Sin sesión válida, `/admin` redirige a `/admin/login`.

---

## 8. Deploy en Vercel

El sitio es estático. Las rutas `/admin/login` y `/admin` funcionan como
carpetas con `index.html` (`admin/login/index.html`, `admin/index.html`), igual
que `/politicadeprivacidad`. No se requiere configuración especial de Vercel;
si se usa `vercel.json`, no romper el `index.html` raíz.

---

## Estado de implementación (por etapas)

- [x] **Etapa 2** — Schema + migración (tablas, RLS, funciones, triggers, storage)
- [x] **Etapa 4** — Seed con los 18 productos y todo el contenido actual
- [x] **Etapa 5** — Capa de datos (`js/config.js`, `supabase-client.js`, `data-service.js`)
- [ ] **Etapa 6** — Conectar el frontend público (leer desde Supabase con fallback)
- [ ] **Etapa 7** — Auth admin (`/admin/login`) y guard de `/admin`
- [ ] **Etapa 8+** — Layout admin, CRUD productos/categorías/marcas/contenido/config, uploads

> El diseño, animaciones, carrito, favoritos, filtros, cuotas y WhatsApp de la
> web pública se conservan tal cual.
