## ADDED Requirements

### Requirement: El admin lista y busca usuarios
El sistema SHALL permitir al `admin` ver la lista de cuentas registradas (correo y perfil actual) y buscarlas por correo.

#### Scenario: Ver lista de usuarios
- **WHEN** un admin abre la gestión de usuarios
- **THEN** el sistema muestra todas las cuentas registradas con su correo y perfil

#### Scenario: Buscar por correo
- **WHEN** el admin escribe parte de un correo en la búsqueda
- **THEN** el sistema filtra la lista a las cuentas que coinciden

#### Scenario: Solo admin accede a la gestión
- **WHEN** un usuario que no es admin intenta abrir la gestión de usuarios
- **THEN** el sistema le niega el acceso

### Requirement: El admin asigna perfiles
El sistema SHALL permitir al `admin` cambiar el perfil de cualquier cuenta a `admin`, `registrador`, `vendedor` o `comprador`.

#### Scenario: Cambiar perfil
- **WHEN** el admin selecciona una cuenta y elige un nuevo perfil
- **THEN** el sistema guarda el cambio y la cuenta usa ese perfil en su próximo (o actual) login

### Requirement: Usuarios y perfiles se sincronizan siempre
El sistema SHALL sincronizar las cuentas y sus perfiles en cada sincronización, sin pasar por el modal de selección por categoría (no requieren confirmación).

#### Scenario: Sincronización automática de usuarios
- **WHEN** se ejecuta una sincronización
- **THEN** las cuentas y perfiles se suben y bajan junto con el resto, sin preguntar

### Requirement: Los usuarios no se borran con "Eliminar del celular"
El sistema SHALL excluir las cuentas y perfiles del borrado local selectivo ("Eliminar del celular"), de modo que ese borrado nunca elimine usuarios.

#### Scenario: Borrado selectivo respeta usuarios
- **WHEN** el usuario usa "Eliminar del celular" para borrar categorías
- **THEN** las cuentas y perfiles permanecen intactos en el dispositivo
