## ADDED Requirements

### Requirement: Dashboard según el rol
El sistema SHALL mostrar un dashboard y opciones de navegación distintos según el rol del usuario autenticado.

#### Scenario: Cada rol ve su dashboard
- **WHEN** un usuario inicia sesión
- **THEN** el sistema muestra solo las secciones permitidas a su rol

### Requirement: Permisos del admin
El sistema SHALL permitir al `admin` acceder a todas las funciones, incluida la gestión de usuarios.

#### Scenario: Admin ve todo
- **WHEN** un admin entra
- **THEN** ve generación de QR, escaneo, inventario completo, reportes y gestión de usuarios

### Requirement: Permisos del registrador
El sistema SHALL permitir al `registrador` generar QR y escanear/vincular códigos, y SHALL ocultarle las demás secciones de gestión.

#### Scenario: Registrador limitado a generar y escanear
- **WHEN** un registrador entra
- **THEN** ve generar QR y escanear, y no ve gestión de usuarios ni reportes

### Requirement: Permisos del vendedor
El sistema SHALL permitir al `vendedor` ver el inventario con **solo prendas en stock disponible**, escanear y **vender**. El sistema SHALL ocultarle: agregar prenda, marcar extraviada y ver prendas vendidas.

#### Scenario: Vendedor entra directo al inventario disponible
- **WHEN** un vendedor inicia sesión
- **THEN** ve el inventario solo con prendas disponibles (sin vendidas ni extraviadas)

#### Scenario: Vendedor puede vender y escanear
- **WHEN** un vendedor abre una prenda disponible
- **THEN** puede escanear y usar el botón Vender

#### Scenario: Vendedor sin acciones restringidas
- **WHEN** un vendedor ve una prenda
- **THEN** no tiene la opción de agregar prenda ni de marcarla extraviada, ni ve las vendidas

### Requirement: Vista del comprador (catálogo de solo lectura)
El sistema SHALL mostrar al `comprador` una lista de inventario (catálogo) de solo lectura, **sin** carrito de compra.

#### Scenario: Comprador ve el catálogo
- **WHEN** un comprador inicia sesión
- **THEN** ve la lista de productos disponibles sin acciones de edición ni carrito
