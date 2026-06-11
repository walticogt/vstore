## Context

El ciclo de vida de la prenda ya persiste en `product_variant` (`status` ACTIVE/SOLD/LOST, `sold_at`, `sale_price`, `lost_at`). No hay forma de consultarlo agregado. El proyecto es Ionic/Angular con SQLite local (`DatabaseService`) y es **offline-first**; los reportes deben calcularse en el dispositivo. Las fechas se guardan como ISO 8601 (`toISOString()`), lo que permite agrupar con las funciones de fecha de SQLite.

## Goals / Non-Goals

**Goals:**
- Resumen de ventas (total S/ + unidades) por día y por mes.
- Conteo de pérdidas por extravío en el periodo.
- Filtros por rango de fechas y por proveedor.
- 100% local, sin red.

**Non-Goals:**
- Exportar a Excel/PDF (posible iteración futura).
- Gráficas avanzadas; basta con tablas/tarjetas legibles.
- Reportes de inventario/stock (otra capability).
- Cambios de esquema o de sincronización.

## Decisions

- **Servicio nuevo `ReportService`** en `core/services/`, en vez de inflar `ProductService`. Hace consultas SQL agregadas vía `DatabaseService.query`. Alternativa descartada: calcular en memoria en el componente (más lento y mezcla lógica con UI).
- **Agrupación con funciones de fecha de SQLite** sobre las cadenas ISO:
  - Día: `substr(sold_at, 1, 10)` (YYYY-MM-DD).
  - Mes: `substr(sold_at, 1, 7)` (YYYY-MM).
  Se usa `substr` (no `strftime`) para no depender de que SQLite parsee la zona horaria del ISO; el prefijo de la cadena ISO ya es la fecha UTC estable. Alternativa: `date()/strftime` — se evita por el sufijo de zona.
- **Filtro de fechas** comparando el rango contra `sold_at`/`lost_at` por prefijo de fecha (`>= desde` y `<= hasta` con límites en YYYY-MM-DD), inclusive.
- **Filtro de proveedor** con `JOIN product ON product_variant.product_id = product.id` y `WHERE product.supplier_id = ?`. Los proveedores para el selector salen de `ConfigService.getSuppliers()`.
- **UI**: nueva página `modules/reports` (módulo lazy, ruta `/reports`), enlazada desde el **dashboard**. Controles: segmento Día/Mes, dos `ion-datetime` (desde/hasta), `ion-select` de proveedor (con opción "Todos"), tarjetas de resumen (total vendido, unidades, extraviadas) y una lista por periodo.
- **Sincronización**: ninguna. Los datos ya viajan en la sync de variantes; el reporte solo lee.

## Risks / Trade-offs

- [Zona horaria: agrupar por prefijo UTC puede desfasar ventas de la noche a otro día respecto a la hora local] → Aceptable para una tienda; documentar. Si molesta, se puede guardar/usar fecha local en una iteración.
- [Rendimiento con muchos registros] → Las consultas son agregadas en SQL (GROUP BY), eficientes incluso con miles de prendas; se evita traer filas a memoria.
- [`sale_price` nulo en datos viejos] → Las prendas vendidas siempre guardan `sale_price`; aun así el total usa `COALESCE(sale_price, 0)`.

## Migration Plan

- No requiere migración de datos ni de esquema (los campos ya existen). Solo se agrega código nuevo (servicio, página, ruta, enlace). Rollback = quitar la ruta/enlace.

## Open Questions

- ¿El rango de fechas por defecto debería ser "este mes" o "últimos 30 días"? (decisión menor, se resuelve en implementación con un default razonable: mes actual).
