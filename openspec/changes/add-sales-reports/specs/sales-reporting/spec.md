## ADDED Requirements

### Requirement: Resumen de ventas por periodo
El sistema SHALL calcular, a partir de las prendas vendidas (`status = SOLD`), el **total vendido** (suma de `sale_price`) y el **número de unidades** vendidas, agrupados por **día** y por **mes**, usando `sold_at` como fecha de la venta.

#### Scenario: Total y unidades del periodo
- **WHEN** el usuario abre Reportes con prendas vendidas registradas
- **THEN** el sistema muestra el total vendido en soles y la cantidad de unidades del periodo seleccionado

#### Scenario: Agrupación por día y por mes
- **WHEN** el usuario elige la vista por día o por mes
- **THEN** el sistema muestra una fila por día (o por mes) con su total vendido y unidades

#### Scenario: Sin ventas en el periodo
- **WHEN** no hay prendas vendidas en el periodo seleccionado
- **THEN** el sistema muestra el total en S/ 0.00, 0 unidades y un mensaje de "sin ventas"

### Requirement: Reporte de pérdidas por extravío
El sistema SHALL calcular el **número de prendas extraviadas** (`status = LOST`) en el periodo, usando `lost_at` como fecha, mostrado de forma separada de las ventas.

#### Scenario: Conteo de extravíos del periodo
- **WHEN** el usuario consulta el reporte de un periodo con prendas extraviadas
- **THEN** el sistema muestra la cantidad de prendas extraviadas de ese periodo

### Requirement: Filtros de rango de fecha y proveedor
El sistema SHALL permitir filtrar el reporte por un **rango de fechas** (desde/hasta) y, opcionalmente, por **proveedor**, aplicando ambos filtros a ventas y a pérdidas.

#### Scenario: Filtro por rango de fechas
- **WHEN** el usuario define una fecha desde y una fecha hasta
- **THEN** el reporte solo considera prendas vendidas/extraviadas dentro de ese rango (inclusive)

#### Scenario: Filtro por proveedor
- **WHEN** el usuario selecciona un proveedor
- **THEN** el reporte solo considera prendas de productos de ese proveedor

#### Scenario: Filtros combinados
- **WHEN** el usuario aplica rango de fechas y proveedor a la vez
- **THEN** el reporte considera solo las prendas que cumplen ambos criterios

### Requirement: Operación 100% local (offline-first)
El sistema SHALL generar todos los reportes consultando únicamente la base local (SQLite), sin requerir conexión a internet ni a Firestore.

#### Scenario: Reporte sin conexión
- **WHEN** el dispositivo no tiene internet
- **THEN** el reporte se calcula y muestra con los datos locales sin errores
