# Fix: subida de imágenes falla ("Failed to fetch") — CORS de Supabase Storage

**Para:** equipo de infraestructura de NEURA (quien administra `api.neura.com.py`)
**Proyecto:** SOMAR Electrodomésticos — panel admin (`https://somarelectropy.com/admin`)
**Fecha del diagnóstico:** 2026-08-12

---

## Resumen

Desde el panel admin, al **guardar un producto/categoría con imagen**, la subida a Supabase Storage
falla con **"Failed to fetch"**. El resto del sitio funciona (el REST/PostgREST responde bien y la web
carga datos en vivo). **El problema es exclusivamente CORS en el servicio de Storage.**

## Causa raíz (confirmada)

El cliente `supabase-js` sube el archivo con headers no-simples (`content-type: image/png`,
`x-upsert`, `cache-control`, `authorization`, `apikey`), lo que dispara un **preflight CORS (OPTIONS)**.
El endpoint de Storage responde el OPTIONS con **204 pero SIN los headers `Access-Control-Allow-*`**,
así que el navegador **bloquea** la petición real.

### Evidencia (reproducible desde el origen https://somarelectropy.com)

Preflight al endpoint de subida:

```
OPTIONS https://api.neura.com.py/storage/v1/object/somar-media/_test/x.png
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: authorization,apikey,content-type,x-upsert,cache-control

→ 204 No Content
   access-control-allow-origin:  (ausente)   ❌
   access-control-allow-headers: (ausente)   ❌
   access-control-allow-methods: (ausente)   ❌
```

- Un POST "simple" (content-type text/plain, sin x-upsert) SÍ llega y devuelve `403 row-level security`
  → el endpoint es alcanzable; el bloqueo es puramente del **preflight CORS**.
- El REST (`/rest/v1/...`) sí devuelve headers CORS correctos → la config CORS existe para REST pero
  **no cubre `/storage/v1/*`**.

## Qué hay que hacer

Hacer que **todas** las respuestas de `/storage/v1/*` (incluido el **OPTIONS**) devuelvan los headers CORS.
Elegir la opción según dónde esté la capa que ya agrega CORS al REST.

### Opción A — Kong (`kong.yml` del stack de Supabase self-hosted)

Asegurar que el plugin `cors` esté aplicado al **service de storage** (o globalmente). Ejemplo:

```yaml
plugins:
  - name: cors
    config:
      origins:
        - "https://somarelectropy.com"   # o "*" si se prefiere abrir
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - PATCH
        - OPTIONS
        - HEAD
      headers:
        - Accept
        - Authorization
        - Content-Type
        - apikey
        - x-client-info
        - x-upsert
        - cache-control
        - x-supabase-api-version
      exposed_headers:
        - Content-Range
        - Content-Length
      credentials: true
      max_age: 3600
      preflight_continue: false
```

> Importante: el mismo bloque `cors` que ya funciona para el service de REST debe aplicarse
> al service/route de **storage** (`storage-api`). Si está a nivel global, verificar que el route
> de storage no lo esté sobreescribiendo.

### Opción B — Reverse proxy (nginx / Caddy) delante de `api.neura.com.py`

Si hay un nginx/Caddy que enruta el dominio, agregar CORS para la ubicación de storage y **responder
el OPTIONS con 204** antes de pasar al upstream. Ejemplo nginx:

```nginx
location /storage/v1/ {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin  "https://somarelectropy.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD" always;
        add_header Access-Control-Allow-Headers "Authorization, apikey, Content-Type, x-client-info, x-upsert, cache-control, x-supabase-api-version" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Max-Age 3600 always;
        add_header Content-Length 0;
        return 204;
    }
    add_header Access-Control-Allow-Origin "https://somarelectropy.com" always;
    add_header Access-Control-Allow-Credentials "true" always;

    proxy_pass http://kong;   # o el upstream que corresponda
    # ...resto de la config de proxy...
}
```

## Segundo muro a verificar: RLS policy del bucket

Una vez arreglado el CORS, la subida pasará por RLS. Confirmar que exista una policy en
`storage.objects` que permita a los **admins autenticados** subir al bucket `somar-media`.
En la prueba anónima dio `new row violates row-level security policy` (esperable sin login),
pero conviene confirmar la policy para el rol autenticado. Ejemplo:

```sql
-- Lectura pública del bucket de medios
create policy "somar-media público lectura"
on storage.objects for select
using ( bucket_id = 'somar-media' );

-- Escritura para usuarios autenticados (ajustar a tu criterio de admin)
create policy "somar-media escritura autenticados"
on storage.objects for insert to authenticated
with check ( bucket_id = 'somar-media' );

create policy "somar-media update autenticados"
on storage.objects for update to authenticated
using ( bucket_id = 'somar-media' );

create policy "somar-media delete autenticados"
on storage.objects for delete to authenticated
using ( bucket_id = 'somar-media' );
```

Y verificar que el **bucket `somar-media` exista** (Storage → Buckets en Studio).

## Cómo verificar que quedó arreglado

```bash
curl -i -X OPTIONS 'https://api.neura.com.py/storage/v1/object/somar-media/test.png' \
  -H 'Origin: https://somarelectropy.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,apikey,content-type,x-upsert,cache-control'
```

Debe devolver **204** e incluir:
```
Access-Control-Allow-Origin: https://somarelectropy.com
Access-Control-Allow-Methods: ... POST ...
Access-Control-Allow-Headers: ... x-upsert, cache-control ...
```

Luego, desde el panel (logueado como admin), subir una imagen a un producto: debe guardar sin
"Failed to fetch".
