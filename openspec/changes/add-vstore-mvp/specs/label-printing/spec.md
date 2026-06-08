## ADDED Requirements

### Requirement: Generación del PDF de etiquetas en hoja A4
El sistema SHALL generar un documento PDF tamaño A4 (210×297 mm) con un grid 5×8 que disponga hasta 40 stickers por hoja, renderizando para cada `TagCode` su código QR/barras (mínimo 20×20 mm) y los primeros 8 caracteres del `id` como texto legible debajo.

#### Scenario: Generar PDF de un lote de 40
- **WHEN** se solicita el PDF de un lote con 40 códigos
- **THEN** se produce un PDF A4 con un grid 5×8 que contiene los 40 stickers, cada uno con su QR/barras y los primeros 8 caracteres del id visibles

#### Scenario: Tipo de código del lote
- **WHEN** el lote es de tipo `BARCODE` en lugar de `QR`
- **THEN** cada sticker renderiza un código de barras en vez de un QR, manteniendo el layout del grid

#### Scenario: Generación sin conexión
- **WHEN** se genera el PDF sin conexión a internet
- **THEN** el PDF se produce localmente sin depender de servicios en la nube

### Requirement: Compartir/imprimir el PDF
El sistema SHALL permitir compartir el PDF generado mediante el diálogo nativo del sistema Android, de modo que el usuario pueda enviarlo a una impresora o a otra aplicación.

#### Scenario: Abrir diálogo de compartir
- **WHEN** el usuario solicita imprimir un lote ya generado
- **THEN** se abre el diálogo nativo de compartir del sistema con el PDF como adjunto

#### Scenario: Reimpresión de un lote existente
- **WHEN** el usuario solicita reimprimir un lote previamente generado
- **THEN** se regenera el PDF a partir de los códigos del lote y se ofrece nuevamente el diálogo de compartir
