## ADDED Requirements

### Requirement: Escaneo de código y redirección por estado
El sistema SHALL activar la cámara para escanear un código QR/barras y, según el `TagCode` resuelto localmente, redirigir al usuario: si está `PENDING` al formulario de vinculación, si está `ASSIGNED` al detalle del producto, y si el código no existe SHALL mostrar un mensaje de error sin navegar.

#### Scenario: Escanear código PENDING
- **WHEN** el usuario escanea un código existente en estado `PENDING`
- **THEN** la aplicación navega al formulario de vinculación de producto para ese código

#### Scenario: Escanear código ASSIGNED
- **WHEN** el usuario escanea un código existente en estado `ASSIGNED`
- **THEN** la aplicación navega al detalle del producto vinculado a ese código

#### Scenario: Escanear código no reconocido
- **WHEN** el usuario escanea un código que no existe en la base local
- **THEN** la aplicación muestra el error "Código no reconocido" y no navega a ninguna pantalla

### Requirement: Vinculación de un código a un producto
El sistema SHALL vincular un `TagCode` en estado `PENDING` a un producto, transicionando su estado a `ASSIGNED`, registrando `assignedAt` (ISO 8601) y `productId`. Tras la vinculación el sistema SHALL navegar al detalle del producto.

#### Scenario: Vincular código pendiente
- **WHEN** el usuario completa el formulario y confirma la vinculación de un código `PENDING`
- **THEN** el `TagCode` pasa a `ASSIGNED`, se registra `assignedAt` y `productId`, y se navega al detalle del producto

#### Scenario: Intentar vincular un código ya asignado
- **WHEN** se intenta vincular un código que ya está en estado `ASSIGNED`
- **THEN** el sistema no crea una nueva vinculación y dirige al usuario al detalle del producto existente

### Requirement: Permiso de cámara
El sistema SHALL solicitar el permiso de cámara antes de iniciar el escaneo y SHALL informar al usuario cuando el permiso sea denegado, sin bloquear el resto de la aplicación.

#### Scenario: Permiso concedido
- **WHEN** el usuario concede el permiso de cámara
- **THEN** el escaneo se inicia y la cámara queda activa para leer códigos

#### Scenario: Permiso denegado
- **WHEN** el usuario deniega el permiso de cámara
- **THEN** el sistema informa que el permiso es necesario para escanear y no inicia la cámara
