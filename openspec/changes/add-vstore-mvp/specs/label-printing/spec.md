## ADDED Requirements

### Requirement: Generación del PDF de etiquetas en hoja A4
El sistema SHALL generar un documento PDF tamaño A4 (210×297 mm) cuyo grid depende del tipo de código del lote: **QR → 5×8 (40 por hoja)** y **Barras → 5×10 (50 por hoja)**. Para cada `TagCode` SHALL renderizar su código QR/barras y los primeros 8 caracteres del `id` como texto legible debajo. El sistema SHALL paginar automáticamente cuando la cantidad supere la capacidad de una hoja.

#### Scenario: Lote QR ocupa grid 5×8
- **WHEN** se solicita el PDF de un lote QR de 40 códigos
- **THEN** se produce un PDF A4 con grid 5×8 (40 stickers por hoja), cada uno con su QR y los primeros 8 caracteres del id

#### Scenario: Lote de barras ocupa grid 5×10
- **WHEN** se solicita el PDF de un lote de barras de 50 códigos
- **THEN** se produce un PDF A4 con grid 5×10 (50 stickers por hoja), cada uno con su código de barras y los primeros 8 caracteres del id

#### Scenario: Paginación por múltiples hojas
- **WHEN** se solicita el PDF de un lote de N hojas
- **THEN** el PDF contiene N páginas A4 con el grid correspondiente al tipo de código

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
