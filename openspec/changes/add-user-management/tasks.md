## 1. Modelo de usuario

- [ ] 1.1 Agregar tabla `app_user (id, email, role, created_at, synced_at)` al schema + migración (`CREATE TABLE IF NOT EXISTS`).
- [ ] 1.2 Modelo `AppUser` y tipo `UserRole` (`admin | registrador | vendedor | comprador`).
- [ ] 1.3 `UserService` (core/services): get/crear por email/uid, listar, buscar por correo, asignar rol.

## 2. Autenticación con Google + sesión con rol

- [ ] 2.1 Configurar Google provider en Firebase Auth (`@angular/fire/auth`); flujo web (popup/redirect) y nativo.
- [ ] 2.2 Botón "Iniciar con Google" en el login (conservando el login local).
- [ ] 2.3 Definir `OWNER_EMAIL` (config) y la lógica: primer login → `comprador`, salvo dueño → `admin`.
- [ ] 2.4 Extender `SessionService` para cargar/crear el `AppUser` y exponer `currentRole`.

## 3. Acceso por rol

- [ ] 3.1 `roleGuard(roles[])` para proteger rutas (gestión de usuarios y reportes solo admin).
- [ ] 3.2 Dashboard adaptado: armar tarjetas/accesos según `currentRole`.
- [ ] 3.3 Helper de permisos (`can('manage' | 'sell' | 'register' | 'viewSold' | 'addPrenda' | 'markLost')`) basado en el rol.

## 4. Restricciones por rol en inventario/venta

- [ ] 4.1 Vendedor: inventario y detalle muestran solo prendas `ACTIVE` (sin vendidas/extraviadas).
- [ ] 4.2 Vendedor: ocultar "Agregar prenda" y "Marcar extraviada"; mantener Escanear y Vender.
- [ ] 4.3 Comprador: vista de catálogo de solo lectura (lista de productos disponibles, sin acciones ni carrito).

## 5. Gestión de usuarios (admin)

- [ ] 5.1 Pantalla/ruta de gestión de usuarios (lista + búsqueda por correo), protegida por `roleGuard(['admin'])`.
- [ ] 5.2 Asignar perfil desde una lista (admin/registrador/vendedor/comprador) y guardar.
- [ ] 5.3 Enlace a gestión de usuarios desde el dashboard del admin.

## 6. Sincronización de usuarios

- [ ] 6.1 Subir/bajar la colección `users` en cada `syncAll` y en la auto-subida (siempre, como catálogos).
- [ ] 6.2 Excluir `app_user` del borrado selectivo "Eliminar del celular" (no se borran nunca ahí).
- [ ] 6.3 (Opcional) Endurecer reglas Firestore de `users` (solo admin escribe `role`).

## 7. Verificación

- [ ] 7.1 `npx tsc -p tsconfig.check.json` y `npm run build` exitosos.
- [ ] 7.2 Prueba manual por rol: login Google (comprador por defecto), dueño como admin, admin reasigna rol, y cada dashboard/permiso (vendedor sin extraviar/ver vendidas, comprador solo catálogo).
