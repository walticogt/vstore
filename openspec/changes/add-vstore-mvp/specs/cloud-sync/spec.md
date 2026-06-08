## ADDED Requirements

### Requirement: Sincronización unidireccional a la nube
El sistema SHALL sincronizar de forma unidireccional (SQLite → Firestore) los registros locales de tags, lotes y productos que no tengan `syncedAt`, subiéndolos a las colecciones `tags`, `batches` y `products` respectivamente, y marcando `syncedAt` tras subir cada registro correctamente. En el MVP el sistema SHALL NO descargar datos desde la nube.

#### Scenario: Subir registros pendientes
- **WHEN** se ejecuta la sincronización y existen registros locales sin `syncedAt`
- **THEN** esos registros se suben a su colección correspondiente en Firestore y se marca `syncedAt`

#### Scenario: Sin registros pendientes
- **WHEN** se ejecuta la sincronización y todos los registros locales ya tienen `syncedAt`
- **THEN** no se realiza ninguna escritura en la nube

#### Scenario: No hay descarga desde la nube
- **WHEN** existen datos en Firestore que no están en local
- **THEN** la sincronización del MVP no los descarga ni modifica el estado local

### Requirement: Disparo por conectividad y estado de sincronización
El sistema SHALL detectar la conectividad de red e iniciar la sincronización al recuperar la conexión, y SHALL exponer el estado de sincronización en curso y la fecha de la última sincronización para mostrarlos en la interfaz.

#### Scenario: Recuperar conexión
- **WHEN** el dispositivo recupera la conexión a internet
- **THEN** se inicia automáticamente la sincronización de los registros pendientes

#### Scenario: Sin conexión
- **WHEN** el dispositivo no tiene conexión a internet
- **THEN** la sincronización no se ejecuta y los registros permanecen pendientes hasta recuperar la red

#### Scenario: Indicador de estado
- **WHEN** la sincronización está en curso o ha finalizado
- **THEN** la interfaz refleja el estado "sincronizando" y la fecha de la última sincronización exitosa

### Requirement: Resolución de conflictos last-write-wins
Cuando un registro exista en local y en la nube, el sistema SHALL resolver el conflicto con la estrategia last-write-wins según `updatedAt`.

#### Scenario: Registro local más reciente
- **WHEN** un registro local tiene un `updatedAt` posterior al de la nube
- **THEN** la versión local sobrescribe la versión de la nube al sincronizar
