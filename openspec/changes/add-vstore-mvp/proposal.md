## Why

VStore necesita un MVP funcional para tiendas de ropa que implemente un sistema de **etiquetado inverso**: imprimir códigos QR/barras aleatorios, pegarlos al producto físico sin datos, y vincularlos después a un producto real al escanear. Hoy el producto solo existe como documento de especificación (`VSTORE_OPENSPEC.md`); no hay capacidades formalizadas que definan el comportamiento esperado de generación, vinculación, inventario y sincronización. Este change formaliza ese comportamiento como specs verificables, base para implementar el MVP offline-first.

## What Changes

- Introducir la **generación de lotes** de códigos: crear un `PrintBatch` y N `TagCode` en estado `PENDING` (UUID v4), persistidos localmente sin conexión.
- Introducir la **impresión de etiquetas**: generar una hoja A4 con grid 5×8 (40 stickers) en PDF y compartirla al sistema Android para imprimir.
- Introducir el **escaneo y vinculación** de un código QR a un producto: redirigir según estado (`PENDING` → formulario de alta, `ASSIGNED` → detalle, inexistente → error) y transicionar el tag a `ASSIGNED`.
- Introducir la **gestión de productos**: CRUD de productos con variantes (color/talla/stock), búsqueda y resolución de producto por `tagId`.
- Introducir la **consulta de inventario**: listado paginado con búsqueda/filtro y detalle de stock por variante, incluyendo acceso directo por escaneo.
- Introducir la **persistencia local** offline-first sobre SQLite (schema completo, CRUD genérico, inicialización al arrancar).
- Introducir la **sincronización a la nube** unidireccional (SQLite → Firestore) de registros sin `syncedAt`, disparada al recuperar conectividad.

## Capabilities

### New Capabilities
- `local-persistence`: Inicialización de la base de datos SQLite offline-first, ejecución del schema y acceso CRUD genérico que consumen el resto de capacidades.
- `tag-generation`: Generación de lotes de impresión (`PrintBatch`) y de códigos `TagCode` en estado `PENDING`.
- `label-printing`: Generación del PDF A4 (grid 5×8 de 40 stickers) y su compartición/impresión.
- `tag-linking`: Escaneo de un código QR/barras y su vinculación a un producto, con redirección según estado del tag.
- `product-management`: CRUD de productos y sus variantes (color/talla/stock), búsqueda y resolución por `tagId`.
- `inventory-consultation`: Consulta de inventario (listado, búsqueda/filtro, detalle de stock por variante) y acceso por escaneo.
- `cloud-sync`: Sincronización unidireccional offline-first de registros locales a Firestore al recuperar la red.

### Modified Capabilities
<!-- No existen specs previas en openspec/specs/; todas las capacidades son nuevas. -->

## Impact

- **Proyecto (greenfield)**: scaffolding Ionic 7 + Angular 17 + Capacitor 5, estructura `core/{models,services,guards}`, `modules/{generate,link,inventory}`, `shared/`.
- **Dependencias nuevas**: `uuid` (+ `@types/uuid`), `ngx-qrcode`, `@capacitor-community/sqlite`, `@capacitor-mlkit/barcode-scanning`, `jspdf`, `html2canvas`, `firebase`, `@angular/fire`, `@capacitor/share`, `@capacitor/network`.
- **Servicios**: `DatabaseService`, `TagService`, `PrintService`, `ProductService`, `SyncService`.
- **Nativo Android**: permisos de cámara en `AndroidManifest.xml`, `capacitor.config.ts` con appId `com.vstore.app`.
- **Nube**: proyecto Firebase (Spark), colecciones `tags`, `batches`, `products`, `firestore.rules` (acceso autenticado), `environment.ts` con credenciales.
- **Restricciones MVP**: el módulo Generate funciona 100% offline; la sincronización es unidireccional (SQLite → Firestore); Reactive Forms; TypeScript estricto sin `any`.
