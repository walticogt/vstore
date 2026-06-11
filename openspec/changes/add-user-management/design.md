## Context

La app usa Firebase (Firestore + Auth anónima ya configurada vía `@angular/fire`) y un `SessionService` con login local simple. El proyecto es offline-first sobre SQLite. Esta capability agrega autenticación con Google, un modelo de usuarios con roles, y adapta la app al rol. Decisiones tomadas: el **correo del dueño** (configurable) es admin automático; se **conservan** ambos logins (local + Google).

## Goals / Non-Goals

**Goals:**
- Login con Google (Gmail) + conservar login local.
- Roles admin/registrador/vendedor/comprador, con registro auto como comprador.
- Admin gestiona cuentas y asigna roles.
- Dashboard y permisos por rol (incluidas las restricciones de vendedor y el catálogo de comprador).
- Usuarios/roles sincronizados siempre y protegidos del borrado selectivo.

**Non-Goals:**
- Carrito de compra / checkout (futuro).
- Permisos finos por campo; basta con visibilidad/acción por rol.
- Recuperación de contraseña del login local (se mantiene como está).

## Decisions

- **Auth con Google vía Firebase Auth** (`signInWithPopup`/`GoogleAuthProvider` en web; flujo nativo con `@capacitor-firebase/authentication` o `signInWithRedirect` en dispositivo). El login local actual se conserva en paralelo.
- **Modelo de usuario**: tabla `app_user (id, email, role, created_at, synced_at)` donde `id` = uid de Firebase (o email normalizado para login local). Colección Firestore `users`. `role ∈ {admin, registrador, vendedor, comprador}`.
- **Asignación inicial de rol**: al primer login, si `email == OWNER_EMAIL` → `admin`; si no → `comprador`. `OWNER_EMAIL` se define en configuración (environment o settings). Login local: la cuenta local existente se trata como `admin` (dueño) — a confirmar.
- **SessionService extendido**: expone `currentRole` además del usuario. Tras el login (Google o local) carga/crea el `app_user` y publica el rol.
- **Guardas por rol**: nuevo `roleGuard(roles[])` que protege rutas (p. ej. gestión de usuarios solo `admin`, reportes `admin`). El `dashboard` arma sus tarjetas según `currentRole`.
- **Vendedor**: reutiliza el inventario/detalle existente, pero filtrando a prendas `ACTIVE` y ocultando por rol los botones de Agregar prenda, Extraviada y la sección de vendidas. Se hace con `*ngIf` sobre el rol (un helper `can('sell')`, `can('manage')`, etc.).
- **Comprador**: una vista de catálogo de solo lectura (lista de productos disponibles) sin acciones; puede reutilizar el listado de inventario en modo lectura.
- **Sincronización de usuarios**: `users` se baja/sube en cada `syncAll` y en la auto-subida, SIEMPRE (como los catálogos), nunca dentro del modal selectivo. El borrado selectivo (`deleteLocalCategories`) y sus flags de "ignorar" NO incluyen `app_user`. (Sí podría incluirse en "Borrar todo" / `resetEverything` — a confirmar.)
- **Reglas Firestore**: la colección `users` debe permitir lectura a usuarios autenticados y escritura controlada (idealmente solo el admin escribe roles; mínimo: cada usuario crea su propio doc como comprador). Las reglas actuales (comodín `if request.auth != null`) ya permiten el MVP; endurecer es iteración futura.

## Risks / Trade-offs

- [Auth de Google en Capacitor/Android requiere configuración extra (SHA-1, OAuth client)] → Documentar pasos; en web es directo con popup.
- [Seguridad de roles: con reglas comodín, un usuario podría auto-promoverse editando su doc] → MVP confía en la app; endurecer reglas Firestore (solo admin escribe `role`) en una iteración. Anotar como deuda.
- [Coexistencia login local + Google] → Mantener el local como admin/dueño evita ambigüedad de rol para esa cuenta.
- [Bootstrap del admin] → Resuelto: `OWNER_EMAIL` configurado se vuelve admin al entrar.

## Migration Plan

- Tabla `app_user` nueva (CREATE IF NOT EXISTS + alta en migraciones). Sin cambios a tablas existentes.
- Configurar Google como proveedor en Firebase Console y `OWNER_EMAIL` en el proyecto.
- Rollout incremental: primero auth+roles+sesión, luego dashboard por rol, luego gestión de usuarios, luego sync. Rollback = ocultar la pantalla de gestión y dejar el login actual.

## Open Questions

- **Correo del dueño**: ¿cuál es? (pendiente de proveer para configurarlo).
- ¿La cuenta de **login local** se considera siempre `admin`, o también se le asigna rol desde la gestión?
- ¿"Borrar todo" (`resetEverything`) debe borrar usuarios, o también protegerlos?
- ¿Endurecer reglas Firestore de `users` ahora o en iteración aparte?
