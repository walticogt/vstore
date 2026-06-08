## ADDED Requirements

### Requirement: Listado de inventario
El sistema SHALL mostrar un listado paginado de productos con su stock total (suma de variantes), permitiendo buscar por nombre y filtrar por proveedor.

#### Scenario: Ver listado de productos
- **WHEN** el usuario abre el inventario
- **THEN** se muestra una lista paginada de productos, cada uno con su stock total

#### Scenario: Buscar por nombre
- **WHEN** el usuario escribe un término de búsqueda por nombre
- **THEN** el listado se filtra para mostrar solo los productos cuyo nombre coincide

#### Scenario: Filtrar por proveedor
- **WHEN** el usuario aplica un filtro por proveedor
- **THEN** el listado muestra solo los productos de ese proveedor

### Requirement: Detalle de producto
El sistema SHALL mostrar el detalle de un producto con sus variantes (color/talla) y el stock de cada una, su precio y proveedor, y SHALL ofrecer una acción para editar el producto/stock.

#### Scenario: Ver detalle de producto
- **WHEN** el usuario abre el detalle de un producto
- **THEN** se muestran sus variantes con stock por color/talla, su precio y su proveedor

#### Scenario: Acceder a edición desde el detalle
- **WHEN** el usuario pulsa "Editar" en el detalle
- **THEN** se abre la edición del producto y su stock

### Requirement: Acceso al detalle por escaneo
El sistema SHALL permitir escanear un código `ASSIGNED` para abrir directamente el detalle del producto vinculado.

#### Scenario: Escanear para consultar
- **WHEN** el usuario escanea un código vinculado a un producto
- **THEN** se abre directamente el detalle de ese producto

#### Scenario: Escanear un código pendiente desde inventario
- **WHEN** el usuario escanea un código en estado `PENDING` desde la consulta de inventario
- **THEN** el sistema informa que el código aún no está vinculado a un producto
