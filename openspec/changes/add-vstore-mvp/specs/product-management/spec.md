## ADDED Requirements

### Requirement: Creación de productos con variantes
El sistema SHALL crear productos con al menos nombre y precio, generando `id` UUID v4 y marcas `createdAt`/`updatedAt` (ISO 8601), y SHALL permitir asociar una o más variantes (color, talla, stock) a cada producto.

#### Scenario: Crear producto con campos obligatorios
- **WHEN** el usuario crea un producto indicando nombre y precio
- **THEN** se persiste un producto con `id` UUID v4, `createdAt` y `updatedAt` poblados

#### Scenario: Crear producto con variantes
- **WHEN** el usuario crea un producto con una o más variantes de color/talla/stock
- **THEN** cada variante se persiste asociada al producto mediante su `productId`

#### Scenario: Crear producto sin campos obligatorios
- **WHEN** el usuario intenta crear un producto sin nombre o sin precio
- **THEN** el sistema rechaza la creación e informa que nombre y precio son obligatorios

### Requirement: Actualización de productos y stock
El sistema SHALL permitir actualizar los datos de un producto y ajustar el stock de una variante mediante un delta (positivo o negativo), actualizando `updatedAt` en cada modificación.

#### Scenario: Actualizar datos del producto
- **WHEN** el usuario edita campos de un producto existente
- **THEN** los cambios se persisten y `updatedAt` se actualiza a la fecha/hora actual

#### Scenario: Incrementar stock de una variante
- **WHEN** se aplica un delta positivo al stock de una variante
- **THEN** el stock de esa variante aumenta en esa cantidad

#### Scenario: Decrementar stock de una variante
- **WHEN** se aplica un delta negativo al stock de una variante
- **THEN** el stock de esa variante disminuye en esa cantidad sin quedar por debajo de cero

### Requirement: Consulta y búsqueda de productos
El sistema SHALL permitir consultar un producto por su `id`, resolver el producto vinculado a un `tagId`, y buscar productos por texto (nombre, SKU o proveedor).

#### Scenario: Consultar producto por id
- **WHEN** se consulta un `id` de producto existente
- **THEN** se devuelve el producto con sus variantes

#### Scenario: Resolver producto por tagId
- **WHEN** se consulta el producto vinculado a un `tagId` en estado `ASSIGNED`
- **THEN** se devuelve el producto asociado a ese código

#### Scenario: Búsqueda por texto
- **WHEN** el usuario busca por un término que coincide con nombre, SKU o proveedor
- **THEN** se devuelven los productos que coinciden con ese término

#### Scenario: Búsqueda sin coincidencias
- **WHEN** el usuario busca por un término sin coincidencias
- **THEN** se devuelve una lista vacía
