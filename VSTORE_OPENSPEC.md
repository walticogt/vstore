# VStore — OpenSpec v1.0
> Documento de especificación técnica completa para usar como contexto en VS Code (Copilot / Cursor).
> Propósito: guiar la codificación del MVP completo de la app VStore.

---

## 1. Visión general

**VStore** es una app móvil Android para tiendas de ropa (vestidos) que implementa un sistema de etiquetado inverso:
1. Se generan códigos QR/barras aleatorios y se imprimen en hoja A4 (40 stickers de ~2×2 cm en grid 5×8).
2. El sticker físico se pega al producto sin datos aún.
3. Al escanear el QR, el operador vincula el código a un producto real (nombre, precio, talla, color, proveedor, stock).
4. Desde ese momento el QR sirve para consultar stock, detalle y registrar ventas.
5. Todo funciona offline-first con SQLite local y se sincroniza a Firebase Firestore como backup/espejo.

**Stack tecnológico:**
- Framework: Ionic 7 + Angular 17 + TypeScript 5
- Runtime nativo: Capacitor 5 (Android)
- BD local: @capacitor-community/sqlite (SQLite offline-first)
- Nube: Firebase Firestore + Firebase Auth (plan Spark gratuito)
- SDK Angular/Firebase: AngularFire 7
- Generación QR: ngx-qrcode
- Escaneo QR/barras: @capacitor-mlkit/barcode-scanning
- PDF/impresión: jsPDF + html2canvas
- Identificadores: uuid v4 (librería `uuid`)

---

## 2. Estructura del proyecto

```
vstore/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/          # Interfaces TypeScript
│   │   │   ├── services/        # Lógica de negocio
│   │   │   └── guards/          # Auth guards (futuro)
│   │   ├── modules/
│   │   │   ├── generate/        # Módulo: Generar e imprimir QR
│   │   │   ├── link/            # Módulo: Vincular QR a producto
│   │   │   └── inventory/       # Módulo: Consulta de stock y detalle
│   │   ├── shared/
│   │   │   ├── components/      # Componentes reutilizables
│   │   │   └── pipes/           # Pipes personalizados
│   │   └── app.routes.ts
│   ├── environments/
│   │   ├── environment.ts       # Firebase config dev
│   │   └── environment.prod.ts
│   └── assets/
├── android/                     # Proyecto nativo Capacitor
├── capacitor.config.ts
├── firebase.json
└── package.json
```

---

## 3. Modelos de datos (TypeScript interfaces)

### 3.1 TagCode — el código QR/barras

```typescript
// src/app/core/models/tag-code.model.ts
export type TagStatus = 'PENDING' | 'ASSIGNED';

export interface TagCode {
  id: string;            // UUID v4 — identificador único (es el dato del QR)
  status: TagStatus;     // 'PENDING' = impreso sin producto | 'ASSIGNED' = vinculado
  createdAt: string;     // ISO 8601
  assignedAt?: string;   // ISO 8601, se llena al vincular
  productId?: string;    // FK → Product.id, null si PENDING
  printBatchId: string;  // ID del lote de impresión al que pertenece
  syncedAt?: string;     // Última sincronización a Firebase
}
```

### 3.2 PrintBatch — lote de impresión

```typescript
// src/app/core/models/print-batch.model.ts
export interface PrintBatch {
  id: string;            // UUID v4
  createdAt: string;     // ISO 8601
  quantity: number;      // Cantidad de stickers (default 40)
  layout: '5x8';         // Grid de impresión (extensible en el futuro)
  codeType: 'QR' | 'BARCODE';
  syncedAt?: string;
}
```

### 3.3 Product — producto vinculado

```typescript
// src/app/core/models/product.model.ts
export interface ProductVariant {
  color: string;         // Ej: 'Rojo', 'Azul'
  size: string;          // Ej: 'S', 'M', 'L', 'XL'
  stock: number;         // Unidades disponibles
}

export interface Product {
  id: string;            // UUID v4
  name: string;          // Nombre del vestido
  sku?: string;          // Código interno opcional
  price: number;         // Precio de venta (soles)
  costPrice?: number;    // Precio de costo
  supplier?: string;     // Proveedor
  category?: string;     // Categoría (futuro)
  variants: ProductVariant[];
  images?: string[];     // Paths locales o URLs Firebase Storage (futuro)
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}
```

---

## 4. Esquema SQLite

```sql
-- Ejecutado al inicializar la app (DatabaseService)

CREATE TABLE IF NOT EXISTS print_batch (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 40,
  layout TEXT NOT NULL DEFAULT '5x8',
  code_type TEXT NOT NULL DEFAULT 'QR',
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS tag_code (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  assigned_at TEXT,
  product_id TEXT,
  print_batch_id TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (product_id) REFERENCES product(id),
  FOREIGN KEY (print_batch_id) REFERENCES print_batch(id)
);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  price REAL NOT NULL,
  cost_price REAL,
  supplier TEXT,
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS product_variant (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  color TEXT,
  size TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
);
```

---

## 5. Servicios principales

### 5.1 DatabaseService

```typescript
// src/app/core/services/database.service.ts
// Responsabilidades:
// - Inicializar SQLite al arrancar la app
// - Ejecutar el schema SQL (sección 4)
// - Exponer métodos CRUD genéricos
// - Ser inyectado por todos los demás servicios

// Métodos requeridos:
initDatabase(): Promise<void>
query<T>(sql: string, params?: any[]): Promise<T[]>
execute(sql: string, params?: any[]): Promise<void>
```

### 5.2 TagService

```typescript
// src/app/core/services/tag.service.ts
// Responsabilidades:
// - Generar lotes de TagCodes (UUID v4)
// - Cambiar estado PENDING → ASSIGNED al vincular
// - Consultar tags por estado, por batch, por producto

generateBatch(quantity: number, codeType: 'QR' | 'BARCODE'): Promise<PrintBatch>
// Genera `quantity` TagCodes PENDING + un PrintBatch, guarda en SQLite

assignTag(tagId: string, productId: string): Promise<void>
// Cambia status a ASSIGNED, guarda assignedAt, guarda productId

getTagById(tagId: string): Promise<TagCode | null>
getPendingTags(): Promise<TagCode[]>
getBatchTags(batchId: string): Promise<TagCode[]>
```

### 5.3 ProductService

```typescript
// src/app/core/services/product.service.ts
// Responsabilidades:
// - CRUD completo de productos
// - Gestión de variantes (color/talla/stock)
// - Búsqueda por nombre, SKU, proveedor

createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>
updateProduct(id: string, data: Partial<Product>): Promise<void>
getProductById(id: string): Promise<Product | null>
getProductByTagId(tagId: string): Promise<Product | null>
searchProducts(query: string): Promise<Product[]>
updateVariantStock(variantId: string, delta: number): Promise<void>
```

### 5.4 PrintService

```typescript
// src/app/core/services/print.service.ts
// Responsabilidades:
// - Generar HTML del grid 5×8 de stickers (40 por hoja A4)
// - Convertir a PDF con jsPDF + html2canvas
// - Compartir PDF vía Capacitor Share API para imprimir

// Configuración del sticker (A4 = 210×297 mm, margen 5mm, gap 2mm)
// Sticker: ~38×35 mm → ancho QR mínimo 2×2 cm, texto código visible debajo

generatePdf(batch: PrintBatch, tags: TagCode[]): Promise<Blob>
sharePdf(pdfBlob: Blob, filename: string): Promise<void>
```

### 5.5 SyncService

```typescript
// src/app/core/services/sync.service.ts
// Responsabilidades:
// - Detectar conectividad (Network plugin de Capacitor)
// - Al recuperar red: subir todos los registros sin syncedAt a Firestore
// - Colecciones en Firestore: 'tags', 'products', 'batches'
// - Estrategia: last-write-wins por updatedAt

syncAll(): Promise<void>
syncTags(): Promise<void>
syncProducts(): Promise<void>
isSyncing$: Observable<boolean>
lastSyncAt$: Observable<string | null>
```

---

## 6. Módulos y páginas (MVP)

### 6.1 Módulo Generate (`/generate`)

**Páginas:**
- `GenerateHomePage` — botón "Nuevo lote", selector QR vs Barras, input cantidad (default 40), botón Generar + Imprimir PDF.
- `BatchDetailPage` — lista de tags del lote con status badge (PENDING / ASSIGNED), botón re-imprimir.

**Flujo:**
1. Usuario pulsa "Generar lote".
2. `TagService.generateBatch(40, 'QR')` crea batch + 40 tags PENDING en SQLite.
3. `PrintService.generatePdf(batch, tags)` genera el PDF A4.
4. `PrintService.sharePdf(...)` abre el diálogo de compartir/imprimir del sistema Android.

---

### 6.2 Módulo Link (`/link`)

**Páginas:**
- `ScanPage` — activa cámara con `@capacitor-mlkit/barcode-scanning`, lee QR, busca en SQLite.
  - Si PENDING → navega a `LinkFormPage`.
  - Si ASSIGNED → navega a `ProductDetailPage` (consulta).
  - Si no existe → muestra error "Código no reconocido".
- `LinkFormPage` — formulario para crear/vincular producto:
  - Campos: Nombre*, Precio*, Talla, Color, Stock, Proveedor, Precio costo.
  - Botón "Vincular" llama `TagService.assignTag()` + `ProductService.createProduct()`.

---

### 6.3 Módulo Inventory (`/inventory`)

**Páginas:**
- `InventoryListPage` — lista paginada de productos con stock total, filtro por proveedor/color.
- `ProductDetailPage` — detalle completo: variantes por color/talla con stock, precio, proveedor. Botón "Editar".
- `ScanLookupPage` — escanear QR para ir directo al detalle (re-usa lógica de ScanPage).

---

## 7. Navegación (app.routes.ts)

```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'generate', pathMatch: 'full' },
  {
    path: 'generate',
    loadChildren: () => import('./modules/generate/generate.module').then(m => m.GenerateModule)
  },
  {
    path: 'link',
    loadChildren: () => import('./modules/link/link.module').then(m => m.LinkModule)
  },
  {
    path: 'inventory',
    loadChildren: () => import('./modules/inventory/inventory.module').then(m => m.InventoryModule)
  }
];
```

**Tab bar (IonTabs):**
- Tab 1: Generar (icono: qr-code)
- Tab 2: Vincular (icono: scan)
- Tab 3: Inventario (icono: cube)

---

## 8. Firebase Firestore — estructura de colecciones

```
firestore/
├── tags/
│   └── {tagId}/          # Documento = TagCode (mismos campos del modelo)
├── batches/
│   └── {batchId}/        # Documento = PrintBatch
└── products/
    └── {productId}/      # Documento = Product (variants como subcampo array)
```

**Reglas de seguridad (firestore.rules) — MVP:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 9. Variables de entorno

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'TU_API_KEY',
    authDomain: 'vstore.firebaseapp.com',
    projectId: 'vstore',
    storageBucket: 'vstore.appspot.com',
    messagingSenderId: 'TU_SENDER_ID',
    appId: 'TU_APP_ID'
  }
};
```

---

## 10. Plan de tareas MVP (orden de implementación)

### TAREA 1 — Scaffolding del proyecto
- [ ] `ionic start vstore tabs --type=angular --capacitor`
- [ ] Instalar dependencias: `uuid`, `ngx-qrcode`, `@capacitor-community/sqlite`, `@capacitor-mlkit/barcode-scanning`, `jspdf`, `html2canvas`, `firebase`, `@angular/fire`
- [ ] Configurar `capacitor.config.ts` con appId `com.vstore.app`
- [ ] Crear estructura de carpetas `core/models`, `core/services`, `modules/`
- [ ] Crear los 4 archivos de modelos (sección 3)

### TAREA 2 — DatabaseService + Schema
- [ ] Implementar `DatabaseService` con `@capacitor-community/sqlite`
- [ ] Ejecutar schema SQL completo (sección 4) en `initDatabase()`
- [ ] Llamar `initDatabase()` en `app.component.ts` al arrancar
- [ ] Probar con un `query('SELECT 1')` que devuelva resultado

### TAREA 3 — TagService + PrintService
- [ ] Implementar `TagService.generateBatch()` usando `uuid` y `DatabaseService`
- [ ] Implementar `PrintService.generatePdf()`: generar HTML del grid 5×8, usar html2canvas + jsPDF
- [ ] Layout del sticker: 38×35mm, QR 20×20mm centrado, código UUID (primeros 8 chars) debajo en 7pt
- [ ] Implementar `PrintService.sharePdf()` con `@capacitor/share`
- [ ] Probar generación y compartición del PDF en dispositivo Android real

### TAREA 4 — Módulo Generate (UI)
- [ ] Crear `GenerateHomePage`: selector tipo (QR/Barras), input cantidad, botón "Generar e Imprimir"
- [ ] Crear `BatchDetailPage`: lista de tags con badge PENDING/ASSIGNED
- [ ] Integrar con `TagService` y `PrintService`
- [ ] Routing del módulo

### TAREA 5 — Escaneo QR (ScanPage)
- [ ] Configurar permisos de cámara en `AndroidManifest.xml`
- [ ] Implementar `ScanPage` con `@capacitor-mlkit/barcode-scanning`
- [ ] Lógica de redirección: PENDING → LinkForm | ASSIGNED → ProductDetail | no existe → toast error
- [ ] Probar escaneo en dispositivo físico

### TAREA 6 — ProductService + LinkFormPage
- [ ] Implementar `ProductService` completo (CRUD + variantes)
- [ ] Crear `LinkFormPage`: formulario reactivo Angular, campos del producto, variantes dinámicas (agregar color/talla)
- [ ] Al guardar: `ProductService.createProduct()` + `TagService.assignTag()`
- [ ] Navegar a `ProductDetailPage` tras vincular

### TAREA 7 — Módulo Inventory (UI)
- [ ] Crear `InventoryListPage` con lista paginada, búsqueda por nombre
- [ ] Crear `ProductDetailPage` con variantes en tabla, botón editar stock
- [ ] Crear `ScanLookupPage` (re-usa componente de escaneo)
- [ ] Integrar filtros básicos (por proveedor)

### TAREA 8 — SyncService + Firebase
- [ ] Configurar Firebase project + `environment.ts`
- [ ] Inicializar AngularFire en `app.module.ts`
- [ ] Implementar `SyncService`: detectar red, subir registros sin `syncedAt`
- [ ] Botón "Sincronizar" en menú principal + indicador de estado
- [ ] Probar round-trip: crear producto en SQLite → sincronizar → verificar en Firestore console

### TAREA 9 — Pulido MVP
- [ ] Manejo global de errores (interceptor Angular)
- [ ] Loading spinners en operaciones async
- [ ] Toasts de confirmación en acciones clave
- [ ] Icono + splash screen de la app (Capacitor Assets)
- [ ] Build APK debug: `ionic capacitor build android`

---

## 11. Comandos de referencia rápida

```bash
# Crear proyecto
ionic start vstore tabs --type=angular --capacitor

# Instalar dependencias
npm install uuid ngx-qrcode jspdf html2canvas
npm install @capacitor-community/sqlite
npm install @capacitor-mlkit/barcode-scanning
npm install firebase @angular/fire

# Tipos para uuid
npm install --save-dev @types/uuid

# Sync nativo Android
npx cap sync android

# Abrir Android Studio
npx cap open android

# Build APK debug
ionic capacitor build android --no-open
```

---

## 12. Notas para el asistente de IA (Copilot / Cursor)

- Siempre usar **TypeScript estricto** (`strict: true` en tsconfig).
- Los servicios son **`providedIn: 'root'`** y usan **Angular signals** o **RxJS BehaviorSubject** para estado reactivo.
- Toda operación de BD es **async/await**, nunca callbacks.
- El módulo `Generate` debe funcionar **100% offline** — ninguna llamada a Firebase.
- La sincronización Firebase es **unidireccional en MVP**: SQLite → Firestore (no se bajan datos de la nube aún).
- Los formularios usan **Reactive Forms** de Angular, no template-driven.
- Nomenclatura: archivos en `kebab-case`, clases en `PascalCase`, variables en `camelCase`.
- Cada página tiene su propio `*.module.ts` para lazy loading.
- No usar `any` — tipar todo correctamente.
