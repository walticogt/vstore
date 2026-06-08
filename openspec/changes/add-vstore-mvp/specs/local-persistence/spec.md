## ADDED Requirements

### Requirement: Inicialización de la base de datos local
La aplicación SHALL inicializar una base de datos SQLite local al arrancar y ejecutar el schema completo (`print_batch`, `tag_code`, `product`, `product_variant`) de forma idempotente, de modo que las tablas existan antes de cualquier operación de las demás capacidades.

#### Scenario: Primer arranque sin base de datos
- **WHEN** la aplicación arranca por primera vez y no existe base de datos local
- **THEN** se crea la base de datos y se ejecutan todas las sentencias `CREATE TABLE IF NOT EXISTS` del schema sin error

#### Scenario: Arranque con base de datos existente
- **WHEN** la aplicación arranca y la base de datos local ya existe con su schema
- **THEN** la inicialización completa sin recrear ni borrar datos existentes

#### Scenario: Verificación de disponibilidad
- **WHEN** la inicialización finaliza correctamente
- **THEN** una consulta de prueba (`SELECT 1`) devuelve un resultado, confirmando que la base de datos está operativa

### Requirement: Acceso CRUD genérico offline
El servicio de base de datos SHALL exponer operaciones de consulta y ejecución parametrizadas (`query`, `execute`) que funcionen sin conexión a internet, y SHALL ser el único punto de acceso a SQLite para los demás servicios.

#### Scenario: Consulta parametrizada
- **WHEN** un servicio ejecuta `query` con una sentencia SELECT y parámetros
- **THEN** se devuelve el conjunto de filas tipado correspondiente sin requerir conexión a internet

#### Scenario: Escritura parametrizada
- **WHEN** un servicio ejecuta `execute` con una sentencia INSERT/UPDATE/DELETE y parámetros
- **THEN** la operación persiste localmente y queda disponible para consultas posteriores

#### Scenario: Integridad referencial de variantes
- **WHEN** se elimina un producto que tiene variantes asociadas
- **THEN** las variantes de ese producto se eliminan en cascada (`ON DELETE CASCADE`)
