## ADDED Requirements

### Requirement: Generación de lotes de códigos
El sistema SHALL generar, a partir de una cantidad y un tipo de código (`QR` o `BARCODE`), un `PrintBatch` y exactamente esa cantidad de registros `TagCode`, todos persistidos localmente y vinculados al lote mediante `printBatchId`. La cantidad por defecto SHALL ser 40.

#### Scenario: Generar lote por defecto
- **WHEN** el usuario genera un lote sin especificar cantidad
- **THEN** se crea un `PrintBatch` y se crean 40 `TagCode` asociados a ese lote

#### Scenario: Generar lote con cantidad personalizada
- **WHEN** el usuario genera un lote indicando una cantidad N y un tipo de código
- **THEN** se crea un `PrintBatch` con esa cantidad y tipo, y se crean exactamente N `TagCode` asociados

#### Scenario: Operación 100% offline
- **WHEN** el usuario genera un lote sin conexión a internet
- **THEN** el lote y sus códigos se crean y persisten localmente sin ninguna llamada a la nube

### Requirement: Estado inicial y unicidad de los códigos
Cada `TagCode` generado SHALL tener un identificador único UUID v4 (que es el dato codificado en el QR/barras), estado inicial `PENDING`, una marca de tiempo `createdAt` en formato ISO 8601 y SHALL NO tener `productId` ni `assignedAt`.

#### Scenario: Códigos recién generados
- **WHEN** se genera un lote de códigos
- **THEN** cada `TagCode` tiene un `id` UUID v4 único, `status` igual a `PENDING`, `createdAt` poblado y `productId`/`assignedAt` vacíos

#### Scenario: Unicidad entre lotes
- **WHEN** se generan múltiples lotes a lo largo del tiempo
- **THEN** ningún `id` de `TagCode` se repite entre lotes

### Requirement: Consulta de códigos
El sistema SHALL permitir consultar un `TagCode` por su `id`, listar los códigos en estado `PENDING` y listar los códigos pertenecientes a un lote de impresión.

#### Scenario: Consultar código existente por id
- **WHEN** se consulta un `id` de código existente
- **THEN** se devuelve el `TagCode` correspondiente

#### Scenario: Consultar código inexistente
- **WHEN** se consulta un `id` que no existe
- **THEN** se devuelve un resultado vacío (null)

#### Scenario: Listar códigos de un lote
- **WHEN** se consultan los códigos de un `printBatchId`
- **THEN** se devuelven todos los `TagCode` asociados a ese lote
