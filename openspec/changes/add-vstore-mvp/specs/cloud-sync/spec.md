## ADDED Requirements

### Requirement: Sincronización bidireccional con la nube
El sistema SHALL sincronizar en ambos sentidos con Firestore (colecciones `tags`, `batches`, `products`). En cada sincronización SHALL primero **descargar** de la nube los registros que no existan localmente o cuya versión sea más reciente (ver last-write-wins), y luego **subir** los registros locales que no tengan `syncedAt`, marcando `syncedAt` tras cada operación. El sistema SHALL NO eliminar registros en ningún sentido.

#### Scenario: Subir registros pendientes
- **WHEN** se ejecuta la sincronización y existen registros locales sin `syncedAt`
- **THEN** esos registros se suben a su colección correspondiente en Firestore y se marca `syncedAt`

#### Scenario: Sin registros pendientes
- **WHEN** se ejecuta la sincronización y todos los registros locales ya tienen `syncedAt`
- **THEN** no se realiza ninguna escritura nueva de subida en la nube

#### Scenario: Instalación nueva descarga los datos existentes
- **WHEN** se sincroniza en un dispositivo/instalación nueva con la base local vacía y existen datos en Firestore
- **THEN** esos registros se descargan e insertan en la base local (marcados como sincronizados), sin borrar nada de la nube

#### Scenario: La sincronización nunca borra
- **WHEN** la base local está vacía y se ejecuta la sincronización
- **THEN** no se elimina ningún registro de la nube

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
Cuando un registro exista en local y en la nube, el sistema SHALL resolver el conflicto con la estrategia last-write-wins según su marca de tiempo (`updatedAt` para productos; `assignedAt` o, en su defecto, `createdAt` para tags). Los lotes son inmutables: si ya existen localmente no se sobrescriben.

#### Scenario: Registro local más reciente
- **WHEN** un registro local tiene una marca de tiempo posterior a la de la nube
- **THEN** se conserva la versión local (no se sobrescribe al descargar) y se subirá a la nube en la fase de subida

#### Scenario: Registro de la nube más reciente
- **WHEN** un registro de la nube tiene una marca de tiempo posterior a la local
- **THEN** la versión de la nube sobrescribe la local al descargar
