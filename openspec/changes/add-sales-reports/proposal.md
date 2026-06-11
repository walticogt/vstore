## Why

Las prendas ya registran su ciclo de vida (vendida con precio y fecha, o extraviada), pero esa información no se puede consultar de forma agregada. La tienda necesita saber **cuánto vendió** (por día/mes), **cuántas unidades** y **cuánto perdió por extravíos** para tomar decisiones, sin depender de internet.

## What Changes

- Nueva **pantalla de Reportes de ventas** (accesible desde el dashboard/configuración).
- **Resumen de ventas**: total vendido (S/) y unidades, agrupado por **día** y por **mes**.
- **Pérdidas por extravío**: cantidad de prendas extraviadas en el periodo.
- **Filtros**: por **rango de fechas** y por **proveedor**.
- Nuevo servicio de consulta de reportes (lecturas agregadas sobre `product_variant`), 100% local (SQLite), sin cambios de esquema.

## Capabilities

### New Capabilities
- `sales-reporting`: consulta agregada de ventas y pérdidas a partir del estado de las prendas (vendidas/extraviadas), con agrupación temporal y filtros.

### Modified Capabilities
<!-- Ninguna: el ciclo de vida de la prenda (estado/precio/fecha) ya existe; este cambio solo lo consume para reportar. -->

## Impact

- **Código nuevo**: módulo/página de reportes (`src/app/modules/reports/`), un `ReportService` en `core/services/`, y una ruta (`/reports`) con enlace desde el dashboard.
- **Lectura** de `product_variant` (campos `status`, `sold_at`, `sale_price`, `lost_at`) y `product`/`supplier` (para filtrar por proveedor). Sin migraciones ni cambios de esquema.
- **Sin impacto en sincronización**: los reportes solo leen datos locales ya sincronizados.
- Respeta el modelo **offline-first**: todas las consultas corren sobre SQLite sin requerir red.
