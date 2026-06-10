## 1. Scaffolding del proyecto

- [x] 1.1 Crear el proyecto base: `ionic start vstore tabs --type=angular --capacitor`. **Nota:** el CLI generó stack más reciente que el spec — Angular 20 / Ionic 8 / Capacitor 8 (el doc asumía Ionic 7 / Angular 17 / Capacitor 5). Proyecto colocado en la raíz de `d:\Projects\VStore` junto a `openspec/`.
- [x] 1.2 Instalar dependencias: `uuid` (+ `@types/uuid` dev), `@capacitor-community/sqlite`, `@capacitor-mlkit/barcode-scanning`, `jspdf`, `html2canvas`, `firebase`, `@angular/fire`, `@capacitor/share`, `@capacitor/network`. **Sustitución:** `ngx-qrcode` (abandonado, no compila en Angular 20) → `angularx-qrcode@^20`. Plugins nativos alineados a Capacitor 8 (sqlite 8.1, mlkit 8.1).
- [x] 1.3 Configurar `capacitor.config.ts` con appId `com.vstore.app` (appName `VStore`).
- [x] 1.4 Crear estructura de carpetas `core/{models,services,guards}`, `modules/{generate,link,inventory}`, `shared/{components,pipes}`
- [x] 1.5 Crear los modelos: `tag-code.model.ts`, `print-batch.model.ts`, `product.model.ts`. **Ajuste:** `ProductVariant` ahora expone `id` y `productId` (necesario para `updateVariantStock`, ver Open Questions del design).
- [x] 1.6 Activar `strict: true` en `tsconfig.json` (ya venía activo por defecto en el scaffold; verificado).

## 2. Persistencia local (capability: local-persistence)

- [x] 2.1 Implementar `DatabaseService` con `@capacitor-community/sqlite` (`initDatabase`, `query<T>`, `execute`). Soporte web vía `jeep-sqlite` + `sql-wasm.wasm` en `src/assets` (script `copy:sql-wasm` + `postinstall`); en web persiste con `saveToStore`.
- [x] 2.2 Schema en `database.schema.ts` con `PRAGMA foreign_keys = ON`, `ON DELETE CASCADE` en `product_variant`, índices, y orden de creación padre→hijo. Ejecutado idempotente (`IF NOT EXISTS`) en `initDatabase()`.
- [x] 2.3 `jeep-sqlite` registrado en `main.ts` (solo web) e `initDatabase()` invocado en `AppComponent.ngOnInit()`.
- [x] 2.4 `SELECT 1` ejecutado al arranque y build verde (`npm run build`, 19s). *(Verificación runtime en navegador/dispositivo pendiente — requiere `ionic serve` o APK.)*

## 3. Generación de códigos (capability: tag-generation)

- [x] 3.1 `TagService.generateBatch(quantity, codeType)` con `uuid` v4: crea `PrintBatch` + N `TagCode` PENDING en una sola transacción (`executeSet` → un único `saveToStore` en web). Default 40; valida cantidad > 0.
- [x] 3.2 Consultas `getTagById`, `getPendingTags`, `getBatchTags` (+ extras `getBatchById`, `getAllBatches` para el módulo Generate). Mappers snake_case → modelo.
- [x] 3.3 Estado/marcas iniciales garantizados por el INSERT (status `PENDING`, `created_at`, sin `product_id`/`assigned_at`); unicidad por UUID v4 + PK. *(Verificación runtime de unicidad pendiente de navegador/dispositivo.)* También se implementó `assignTag` (PENDING→ASSIGNED idempotente) que pertenece a tag-linking.

## 4. Impresión de etiquetas (capability: label-printing)

- [x] 4.1 `PrintService.generatePdf(batch, tags)`: grid 5×8 (celda 38.4×34.1 mm, QR 20×20 mm, 8 chars del id en 7pt), paginación automática >40. **Desviación:** se dibuja directo con jsPDF (`addImage` + `text`) en vez de `html2canvas` → QR más nítido, posicionamiento exacto y evita el problema de `crypto` de html2canvas.
- [x] 4.2 Render de QR (`qrcode` → dataURL PNG 256px) y de BARCODE (`jsbarcode` CODE128 sobre canvas offscreen) según `codeType` del lote.
- [x] 4.3 `PrintService.sharePdf(blob, filename)`: nativo escribe a `Directory.Cache` (`@capacitor/filesystem`) y comparte con `@capacitor/share`; web dispara descarga directa. *(Nueva dep `@capacitor/filesystem`, necesaria para compartir archivos.)*
- [ ] 4.4 Probar generación y compartición del PDF en dispositivo Android real. *(Desbloqueado: APK ya compilado. Falta solo la verificación manual del usuario en su teléfono — el diálogo de compartir/imprimir nativo.)*

## 5. Módulo Generate (UI)

- [x] 5.1 `GenerateHomePage`: Reactive Form (selector QR/Barras, cantidad default 40, min 1/max 200), botón "Generar e imprimir" con loading/toast, y lista de lotes generados.
- [x] 5.2 `BatchDetailPage`: ruta `batch/:id`, tarjeta del lote con conteo vinculados/total, lista de tags con badge Pendiente/Vinculado y botón Reimprimir.
- [x] 5.3 Integrado con `TagService` + `PrintService`; routing/lazy loading del módulo Generate. **Extra:** tabs reescritos a Generar/Vincular/Inventario (iconos qr-code/scan/cube) y placeholders de Link/Inventory para mantener la app ejecutable (se reemplazan en grupos 6–7). Tabs de ejemplo (`tab1/2/3`, `explore-container`) eliminados.

## 6. Escaneo y vinculación (capabilities: tag-linking, product-management)

- [x] 6.1 Plataforma Android agregada (`@capacitor/android` + `cap add android`). `AndroidManifest.xml`: permiso `CAMERA` + `uses-feature` camera (no requerido) + meta-data `com.google.mlkit.vision.DEPENDENCIES=barcode_ui`. Permiso solicitado en runtime con `BarcodeScanner.requestPermissions()` antes de escanear.
- [x] 6.2 `ScanPage` con `@capacitor-mlkit/barcode-scanning` (cámara solo nativa) + **entrada manual y lista de pendientes** para probar en navegador. Redirección por estado: PENDING → LinkForm, ASSIGNED → ProductDetail, inexistente → toast "Código no reconocido".
- [x] 6.3 `ProductService` completo: `createProduct` (valida nombre/precio, variantes en transacción), `updateProduct`, `getProductById`, `getProductByTagId`, `searchProducts`, `updateVariantStock` (no baja de 0); extras `getAllProducts`, `getSuppliers`.
- [x] 6.4 `LinkFormPage` (Reactive Forms): Nombre*, Precio*, Proveedor, SKU, Precio costo + `FormArray` de variantes dinámicas (Color/Talla/Stock, agregar/quitar). Guard: solo vincula tags PENDING.
- [x] 6.5 Al guardar: `createProduct()` + `assignTag()` (PENDING→ASSIGNED) y navega a `/tabs/inventory/product/:id`.
- [ ] 6.6 Probar escaneo y vinculación en dispositivo físico. *(Desbloqueado: APK ya compilado. Falta solo la verificación manual del usuario con la cámara nativa de su teléfono — el emulador no tiene cámara real.)*

**Nota grupo 6:** se adelantó el **módulo Inventory real** (grupo 7: `InventoryListPage` + `ProductDetailPage` con ajuste de stock) porque es el destino de navegación tras escanear/vincular. Además se ajustó el PDF: la etiqueta de texto ahora va pegada justo debajo del código y el bloque se centra en la celda (feedback del usuario).

## 7. Módulo Inventory (capability: inventory-consultation)

- [x] 7.1 `InventoryListPage`: stock total por producto, búsqueda por nombre/SKU/proveedor (`ion-searchbar` con debounce) y filtro por proveedor (`ion-select`). *(Adelantado en grupo 6.)*
- [x] 7.2 `ProductDetailPage`: variantes color/talla con stock, precio, proveedor; ajuste de stock inline +/- (`updateVariantStock`, con toast). **Botón "Editar"** (lápiz) → `ProductEditPage` (formulario reactivo de nombre/precio/proveedor/SKU/costo, `updateProduct`). *(Adelantado en grupo 6; edición agregada por pedido del usuario.)*
- [x] 7.3 `ScanLookupPage`: escanear/buscar un código → detalle directo; PENDING → aviso "aún no vinculado", inexistente → "no reconocido". Botón escanear en la cabecera del Inventario. *(Pedido del usuario.)*
- [x] 7.4 Tab bar (IonTabs): Generar (qr-code), Vincular (scan), Inventario (cube). *(Hecho en grupo 5.)*

**Mejoras adicionales (feedback del usuario):**
- **Editar producto** (`ProductEditPage`): formulario reactivo nombre/precio/proveedor/SKU/costo, botón lápiz en el detalle.
- **QR por variante** (cambio de modelo): el código (QR) ahora identifica una **variante específica** (color/talla), no el producto completo. `tag_code.variant_id` (+ migración); `assignTag(tagId, productId, variantId)`; `ProductService.addVariant`. `LinkFormPage` rehecho: vincula a UNA variante, en modo "producto nuevo" (crea producto + variante) o "producto existente" (agrega variante). `ProductDetailPage`: cada variante muestra su propio código y su botón "Re-vincular código"; ajuste de stock +/- por variante. `replaceTagForVariant` (re-vincular es por variante). Escanear un código lleva al detalle resaltando su variante. Sync incluye `variant_id`. *(Nota: los datos vinculados con el modelo anterior — tag→producto sin `variant_id` — no aparecen bajo una variante; conviene limpiar datos de prueba viejos.)*
- **SKU autogenerado**: en `LinkFormPage` (modo producto nuevo) el SKU ya no se teclea; se genera en vivo desde proveedor+nombre con sufijo único (`buildSku`, p.ej. `ZAR-VES-3F9A`) y se muestra como solo lectura.
- **Limpieza de warnings de consola**: `crypto` silenciado con `@angular-builders/custom-webpack` (`resolve.fallback: { crypto: false }`); `aria-hidden` mitigado quitando el foco en `NavigationStart`; warnings CommonJS (qrcode/jsbarcode/canvg) declarados en `allowedCommonJsDependencies`.
- **Auditoría de vinculación (usuario + fecha)**: `SessionService` con usuario por defecto `'default'` (listo para login del grupo 8). Columnas `product.created_by` y `tag_code.assigned_by` (con migración `ALTER TABLE` idempotente para BD existentes); `assignTag`/`createProduct` registran el usuario. La fecha/hora ya existía (`assigned_at`/`created_at`). Aún no se muestra en UI.
- **Re-vinculación / reemplazo de código**: nuevo estado `REPLACED`. Desde el detalle del producto, botón "Re-vincular a otro código" → `RelinkPage` (elige código PENDING por lista/manual/cámara, confirma). `TagService.replaceTag` marca el código ASSIGNED anterior como REPLACED y asigna el nuevo, en una transacción. Escanear un código REPLACED avisa que está anulado. El detalle muestra el código activo.

## 8. Sincronización (capability: cloud-sync)

- [x] 8.1 Proyecto Firebase `vstore-2026` (plan Spark) creado; `firebaseConfig` en `environment.ts`/`environment.prod.ts` (config pública de cliente).
- [x] 8.2 AngularFire inicializado en `AppModule` (`provideFirebaseApp`/`provideFirestore`/`provideAuth`). Auth anónima en `SyncService.ensureAuth` (no bloquea la sync si está deshabilitada y las reglas lo permiten).
- [x] 8.3 `SyncService`: `@capacitor/network` (auto-sync al arrancar y al reconectar). **Bidireccional** (feedback del usuario): primero **baja** de Firestore lo que falte o sea más nuevo (last-write-wins por `updatedAt` en productos, `assignedAt`/`createdAt` en tags; lotes inmutables) — así una instalación nueva recibe los datos existentes — y luego **sube** lo local sin `synced_at`. Productos con variantes embebidas. Nunca borra. Guard anti-concurrencia.
- [x] 8.4 `isSyncing$` y `lastSyncAt$` expuestos; botón nube + spinner en la cabecera de Generar e indicador "Última sincronización".
- [x] 8.5 `firestore.rules` (acceso autenticado) **publicado y verificado en vivo ✅**: reglas cerradas a `if request.auth != null`, **Auth Anónima habilitada**, y round-trip SQLite → Firestore confirmado ("Sincronización completada", sin `permission denied`). Sube `batches`/`tags`/`products`. **Grupo 8 cerrado y seguro.**

## 9. Pulido MVP

- [x] 9.1 Manejo global de errores: `GlobalErrorHandler` (provider `ErrorHandler`) que loguea y muestra un toast discreto (con anti-spam de 3s). *(ErrorHandler en vez de interceptor HTTP: no hay HTTP propio; Firebase maneja el suyo.)*
- [x] 9.2 Spinners/toasts en operaciones clave (generar, vincular, reemplazar, sincronizar) + toast de confirmación al ajustar stock.
- [x] 9.3 Icono + splash screen generados con `@capacitor/assets` desde el logo **Valery** (`assets/logo.png`, fondo lavanda `#EDE6F7` claro / `#2B213A` oscuro): 87 assets Android (icono adaptativo + splash todas las densidades, claro/oscuro) + 14 iconos PWA. Favicon web actualizado (`icon-192.webp`) y título/`theme-color` en `index.html`. *(El icono/splash nativo se verá al compilar el APK.)*
- [x] 9.4 APK debug compilado: `app-debug.apk` (51.7 MB) en `android/app/build/outputs/apk/debug/` vía `gradlew assembleDebug`. **Nota:** Android Studio "Generate APKs" falló por `checkDebugDuplicateClasses` debido a corrupción del caché de Gradle por builds concurrentes (terminal + Android Studio a la vez); tras detener daemons, `gradlew assembleDebug` desde terminal compila sin problema (no construye el variant androidTest, que era el del check duplicado).

**Mejora adicional (feedback del usuario) — escaneo con cámara en el navegador:**
- `CameraScannerComponent` (en `SharedModule`) con **ZXing** (`@zxing/browser`): lee QR/barras del stream de cámara del navegador y emite el código, sin teclear. La cámara web requiere permiso del navegador **una sola vez** (luego escanea solo).
- Integrado en **ScanPage** (Vincular), **ScanLookupPage** y **RelinkPage**: en nativo usan ML Kit; en web usan el escáner ZXing; la entrada manual queda como respaldo. Detección de cámara web vía `navigator.mediaDevices.getUserMedia`.

## 10. Validación

- [x] 10.1 Generación de lote (40 tags PENDING + batch) y PDF A4 grid 5×8 verificada en navegador y en APK Android.
- [x] 10.2 Flujo de escaneo verificado (web/manual + autofiltro): PENDING → vincular, ASSIGNED → detalle, REPLACED/inexistente → aviso. *(Cámara nativa ML Kit pendiente de prueba en teléfono físico — el emulador no tiene cámara real.)*
- [x] 10.3 CRUD de productos y ajuste de stock por variante verificado.
- [x] 10.4 Operación 100% offline (generar, vincular, inventario) verificada.
- [x] 10.5 Sincronización verificada en vivo: round-trip SQLite ⇄ Firestore confirmado en consola Firebase **y bajada a instalación nueva** (emulador vacío se llenó desde la nube).
