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

### Requirement: Vinculación de un código a una variante
El sistema SHALL vincular un `TagCode` en estado `PENDING` a una **variante específica** de un producto (color/talla), transicionando su estado a `ASSIGNED` y registrando `assignedAt` (ISO 8601), `assignedBy`, `productId` y `variantId`. Cada código identifica una sola variante; un producto puede tener varios códigos (uno por variante). La vinculación SHALL permitir crear un producto nuevo (con esa primera variante) o agregar la variante a un producto existente. Tras vincular, el sistema SHALL navegar al detalle del producto.

#### Scenario: Vincular código a una variante de producto nuevo
- **WHEN** el usuario crea un producto nuevo con una variante y confirma la vinculación de un código `PENDING`
- **THEN** se crea el producto con esa variante, el `TagCode` pasa a `ASSIGNED` con `productId` y `variantId`, y se navega al detalle del producto

#### Scenario: Vincular código a una variante de producto existente
- **WHEN** el usuario elige un producto existente, define una nueva variante y confirma la vinculación de un código `PENDING`
- **THEN** se agrega la variante al producto, el `TagCode` pasa a `ASSIGNED` con `productId` y `variantId`, y se navega al detalle del producto

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
