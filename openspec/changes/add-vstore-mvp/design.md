## Context

VStore es un MVP greenfield: app móvil Android para tiendas de ropa con **etiquetado inverso** (imprimir QR aleatorios → pegar → vincular al escanear). El requisito transversal es **offline-first**: toda la operación de tienda (generar, imprimir, vincular, consultar) debe funcionar sin red, usando SQLite como fuente de verdad local; Firebase Firestore actúa como espejo/respaldo. El stack está fijado por `VSTORE_OPENSPEC.md`: Ionic 7 + Angular 17 + Capacitor 5 + TypeScript estricto.

Stakeholders: operadores de tienda (uso diario sin garantía de conexión) y el dueño (respaldo en la nube). El change formaliza el comportamiento como specs; la implementación se hará en un change/iteración posterior siguiendo `tasks.md`.

## Goals / Non-Goals

**Goals:**
- Definir capacidades verificables para generación, impresión, vinculación, productos, inventario, persistencia y sincronización.
- Garantizar que el módulo Generate y toda la operación local funcionen 100% offline.
- Establecer SQLite como fuente de verdad y Firestore como espejo unidireccional.

**Non-Goals:**
- Descarga de datos desde la nube (sync bidireccional) — fuera del MVP.
- Autenticación de usuarios en la app (los guards quedan para el futuro; las reglas de Firestore exigen `request.auth != null` pero el login no es parte del MVP funcional).
- Gestión de imágenes de producto en Firebase Storage.
- iOS (solo Android en el MVP).

## Decisions

- **SQLite (`@capacitor-community/sqlite`) como fuente de verdad local, no Firestore.** Alternativa considerada: Firestore con persistencia offline. Se descarta porque el requisito es operar sin conexión garantizada y con control total del schema relacional (variantes en tabla aparte con `ON DELETE CASCADE`); Firestore offline es clave-documento y no da integridad referencial.
- **UUID v4 como identificador y dato del QR.** El `id` del `TagCode` ES el contenido del código. Alternativa: secuencias incrementales. Se descarta por colisiones entre dispositivos sin coordinación central y por no ser aleatorios (requisito explícito: "códigos aleatorios").
- **PDF vía html2canvas + jsPDF, compartido con `@capacitor/share`.** Se renderiza HTML del grid 5×8 → canvas → PDF A4. Alternativa: librería de impresión nativa. Se descarta para mantener el control fino del layout del sticker (38×35 mm, QR 20×20 mm, 8 chars del id en 7pt) y reutilizar el render web.
- **Sincronización unidireccional SQLite → Firestore por campo `syncedAt`.** Se suben los registros con `syncedAt` nulo y se marca tras subir. Resolución de conflictos last-write-wins por `updatedAt`. Alternativa: bidireccional con merge. Se descarta por complejidad innecesaria en el MVP (un solo dispositivo de escritura esperado).
- **Disparo de sync por `@capacitor/network`.** Al recuperar red se ejecuta `syncAll()`. Estado reactivo (`isSyncing$`, `lastSyncAt$`) vía RxJS BehaviorSubject / Angular signals.
- **Lazy loading por módulo (`generate`, `link`, `inventory`).** Cada página con su `*.module.ts`. Reactive Forms en todos los formularios. TypeScript `strict: true`, sin `any`.

## Risks / Trade-offs

- [Render PDF con html2canvas en dispositivos de gama baja puede ser lento o perder nitidez del QR] → Mantener el QR a ≥20×20 mm y validar nitidez en dispositivo real; cachear el HTML del grid.
- [Sync unidireccional implica que cambios hechos directamente en Firestore se pierden] → Documentado como Non-Goal; Firestore es solo espejo en el MVP.
- [Reglas de Firestore exigen `request.auth != null` pero el MVP no implementa login] → Resolver en Open Questions antes de habilitar la sync real (auth anónima vs. login mínimo).
- [`product_variant` necesita `id` propio para `updateVariantStock`, no presente como tal en los modelos del documento] → El schema SQL ya define `product_variant.id`; los modelos TS deben exponer el `variantId` al consultar.
- [Códigos de barras (no QR) con UUID v4 completo pueden no caber legibles en 38×35 mm] → Validar densidad del barcode; considerar codificar solo parte del id o usar QR por defecto.

## Migration Plan

No aplica migración de datos (proyecto greenfield). Orden de implementación según `tasks.md`: scaffolding → persistencia → generación/impresión → escaneo → productos/vinculación → inventario → sincronización → pulido. Rollback: al ser greenfield, revertir es descartar el código del módulo correspondiente; SQLite local se puede recrear borrando la base.

## Open Questions

- Autenticación para la sincronización: ¿auth anónima de Firebase, login con email/clave, o relajar las reglas en MVP? (bloquea la sync real contra Firestore).
- ¿Se requiere reimpresión selectiva de stickers individuales o solo del lote completo?
- ¿El stock puede llegar a cero y bloquear ventas, o solo se consulta en este MVP (sin registro de ventas)? El documento menciona "registrar ventas" en la visión pero no hay capacidad de ventas en el alcance actual.
