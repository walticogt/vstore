## 1. Modelo de usuario

- [x] 1.1 Agregar tabla `app_user (id, email, role, created_at, synced_at)` al schema + migración (`CREATE TABLE IF NOT EXISTS`).
- [x] 1.2 Modelo `AppUser` y tipo `UserRole` (`admin | registrador | vendedor | comprador`).
- [x] 1.3 `UserService` (core/services): get/crear por email/uid, listar, buscar por correo, asignar rol.

## 2. Autenticación con Google + sesión con rol

- [ ] 2.1 Configurar Google provider en Firebase Auth (`@angular/fire/auth`); flujo web (popup/redirect) y nativo.
- [ ] 2.2 Botón "Iniciar con Google" en el login (conservando el login local).
- [x] 2.3 Configurar `OWNER_EMAIL = walther.huanca@gmail.com` y la lógica: primer login → `comprador`, salvo dueño → `admin`. Login local → `admin`.
- [x] 2.4 Extender `SessionService` para cargar/crear el `AppUser` y exponer `currentRole`.
- [x] 2.5 Caché de sesión offline: guardar en localStorage el último usuario (email + rol) y permitir ingreso sin internet con ese rol; sincronizar al reconectar.

## 3. Acceso por rol

- [x] 3.1 `roleGuard(roles[])` para proteger rutas (gestión de usuarios y reportes solo admin).
- [x] 3.2 Dashboard adaptado: armar tarjetas/accesos según `currentRole`.
- [x] 3.3 Helper de permisos (`SessionService.can(...)`) basado en el rol.

## 4. Restricciones por rol en inventario/venta

- [x] 4.1 Vendedor: inventario y detalle muestran solo prendas `ACTIVE` (sin vendidas/extraviadas).
- [x] 4.2 Vendedor: ocultar "Agregar prenda" y "Marcar extraviada"; mantener Escanear y Vender.
- [x] 4.3 Comprador: vista de catálogo de solo lectura (lista de productos disponibles, sin acciones ni carrito).

## 5. Gestión de usuarios (admin)

- [x] 5.1 Pantalla/ruta de gestión de usuarios (lista + búsqueda por correo), protegida por `roleGuard(['admin'])`.
- [x] 5.2 Asignar perfil desde una lista (admin/registrador/vendedor/comprador) y guardar.
- [x] 5.3 Enlace a gestión de usuarios desde el dashboard del admin.

## 6. Sincronización de usuarios

- [x] 6.1 Subir/bajar la colección `users` en cada `syncAll` y en la auto-subida (siempre, como catálogos).
- [x] 6.2 Excluir `app_user` del borrado "Eliminar del celular" Y de "Borrar todo" (`resetEverything`): los usuarios nunca se borran.
- [ ] 6.3 Endurecer reglas Firestore de `users` (solo admin escribe `role`; cada usuario crea su doc como comprador).

## 7. Verificación

- [x] 7.1 `npx tsc -p tsconfig.check.json` y `npm run build` exitosos.
- [ ] 7.2 Prueba manual por rol: login Google (comprador por defecto), dueño como admin, admin reasigna rol, y cada dashboard/permiso (vendedor sin extraviar/ver vendidas, comprador solo catálogo).
