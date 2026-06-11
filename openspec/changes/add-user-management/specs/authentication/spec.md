## ADDED Requirements

### Requirement: Inicio de sesión con Google (Gmail)
El sistema SHALL permitir iniciar sesión con una cuenta de Google (Gmail) mediante Firebase Auth. Al autorizar la app por primera vez, la cuenta queda registrada automáticamente.

#### Scenario: Primer ingreso con Gmail
- **WHEN** un usuario inicia sesión con su cuenta Gmail por primera vez
- **THEN** el sistema crea su registro de usuario y abre la app con su sesión iniciada

#### Scenario: Ingreso recurrente con Gmail
- **WHEN** un usuario que ya se registró inicia sesión con Gmail
- **THEN** el sistema reconoce su cuenta y su perfil asignado, sin volver a crearlo

### Requirement: Conservar el inicio de sesión local
El sistema SHALL mantener el inicio de sesión local existente además del de Google, sin romper su comportamiento actual.

#### Scenario: Login local sigue disponible
- **WHEN** el usuario elige el inicio de sesión local
- **THEN** el sistema lo autentica como hasta ahora y abre la app

### Requirement: Rol por defecto al registrarse
El sistema SHALL asignar el perfil `comprador` por defecto a toda cuenta nueva, EXCEPTO al correo del dueño configurado, que SHALL quedar como `admin`.

#### Scenario: Cuenta nueva común
- **WHEN** un Gmail que no es el del dueño se registra por primera vez
- **THEN** el sistema le asigna el perfil `comprador`

#### Scenario: Correo del dueño
- **WHEN** el correo configurado como dueño inicia sesión
- **THEN** el sistema le asigna (o conserva) el perfil `admin`

### Requirement: La sesión transporta el rol del usuario
El sistema SHALL exponer en la sesión activa el rol del usuario autenticado, para que el resto de la app adapte navegación y permisos.

#### Scenario: Rol disponible tras login
- **WHEN** un usuario inicia sesión
- **THEN** la app conoce su rol actual y lo usa para mostrar su dashboard y permisos

### Requirement: Sesión offline con caché del último usuario
El sistema SHALL recordar en caché local al último usuario que inició sesión (identidad + rol) y SHALL permitir el ingreso a la app **sin conexión** usando esa caché, para que el usuario (p. ej. un vendedor) trabaje con los datos locales y sincronice al recuperar internet.

#### Scenario: Ingreso sin internet con el último usuario
- **WHEN** el dispositivo no tiene internet y el último usuario ya había iniciado sesión antes
- **THEN** el sistema le permite ingresar con su rol cacheado y operar sobre los datos locales

#### Scenario: Vender sin internet y sincronizar al reconectar
- **WHEN** un vendedor sin internet registra una venta
- **THEN** la venta se guarda localmente y se sincroniza automáticamente cuando vuelve la conexión
