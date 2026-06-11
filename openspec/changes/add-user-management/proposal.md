## Why

Hoy la app no distingue quién la usa: todos ven y pueden hacer lo mismo. Una tienda necesita **perfiles con permisos** (admin, registrador, vendedor, comprador) para que cada persona vea solo lo suyo, y un **admin** que gestione las cuentas. La autenticación debe ser simple y confiable: **iniciar con Gmail (Google)**.

## What Changes

- **Inicio de sesión con Google (Gmail)** además del login local actual (se conservan ambos).
- **Perfiles/roles**: `admin`, `registrador`, `vendedor`, `comprador`.
- **Registro automático**: cualquier Gmail que autorice la app queda registrado con perfil **comprador** por defecto. El **correo del dueño** (configurable) queda **admin** automáticamente.
- **Gestión de usuarios (admin)**: lista/búsqueda de cuentas (correos) y asignación de perfil desde una lista.
- **Dashboard adaptado al rol**: cada login muestra una pantalla y opciones distintas según su perfil.
- **Permisos por rol** (visibilidad y acciones):
  - **admin**: todo + gestión de usuarios.
  - **registrador**: generar QR y escanear/vincular.
  - **vendedor**: inventario solo con **stock disponible**, escanear y **vender**; **sin** agregar prenda, **sin** marcar extraviada, **sin** ver vendidas.
  - **comprador**: lista de inventario (catálogo) de solo lectura; **sin** carrito (por ahora).
- **Sincronización de usuarios/perfiles**: se sincronizan **siempre** (sin confirmación, fuera del modal selectivo) y **NO se borran** con "Eliminar del celular".

## Capabilities

### New Capabilities
- `authentication`: inicio de sesión con Google (Gmail) y local, sesión que transporta el rol, y asignación de rol por defecto (comprador / admin al dueño).
- `user-management`: el admin lista/busca cuentas y les asigna perfil; persistencia y sincronización protegida de usuarios/roles.
- `role-based-access`: el dashboard y la visibilidad de funciones/acciones se adaptan al rol (incluye las restricciones de vendedor y el catálogo de comprador).

### Modified Capabilities
<!-- Ninguna spec previa archivada en openspec/specs/. El ciclo de venta existente se reutiliza, no cambia su comportamiento. -->

## Impact

- **Auth**: integrar Google provider en Firebase Auth (`@angular/fire/auth`, ya presente). Configurar el proveedor Google en Firebase Console.
- **Datos**: nueva tabla `app_user` (email, role, …) + colección Firestore `users`. Sin tocar el esquema existente de producto/tags.
- **Sesión**: extender `SessionService` para exponer el rol del usuario actual.
- **Routing/guardas**: `authGuard` + nuevo guard por rol; el `dashboard` y los accesos cambian según el rol.
- **Sincronización**: `users` se baja/sube en cada `syncAll` (siempre), excluido del borrado selectivo "Eliminar del celular".
- **UI nueva**: pantalla de gestión de usuarios (admin) y, para comprador, una vista de catálogo de solo lectura.
- **Config**: definir el **correo del dueño** (admin inicial) — pendiente de proveer al implementar.
