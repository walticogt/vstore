## 1. Servicio de reportes

- [x] 1.1 Crear `core/services/report.service.ts` con tipos de salida (resumen de ventas, fila por periodo, resumen de pérdidas).
- [x] 1.2 Implementar consulta de resumen total: total vendido (`SUM(COALESCE(sale_price,0))`) y unidades (`COUNT`) para `status = 'SOLD'`, con filtros de rango de fecha (`sold_at`) y proveedor (JOIN `product`).
- [x] 1.3 Implementar agrupación por día (`substr(sold_at,1,10)`) y por mes (`substr(sold_at,1,7)`), devolviendo filas ordenadas por periodo desc.
- [x] 1.4 Implementar conteo de extravíos: `COUNT` de `status = 'LOST'` por `lost_at` con los mismos filtros.
- [x] 1.5 Verificar que todas las consultas corren solo sobre SQLite (sin red).

## 2. Página de reportes (UI)

- [x] 2.1 Crear módulo lazy `modules/reports` (page + module + ruta `/reports` en `app-routing.module.ts`, protegida por `authGuard`).
- [x] 2.2 Controles de filtro: segmento Día/Mes, `ion-input type=date` desde/hasta (default: mes actual), `ion-select` de proveedor (de `ConfigService.getSuppliers()`, con opción "Todos").
- [x] 2.3 Tarjetas de resumen: total vendido (S/), unidades vendidas y prendas extraviadas del periodo/filtros.
- [x] 2.4 Lista por periodo (día o mes) con total y unidades; estado vacío "sin ventas" cuando no hay datos.
- [x] 2.5 Recalcular el reporte al cambiar cualquier filtro.

## 3. Acceso

- [x] 3.1 Agregar enlace a Reportes desde el dashboard.

## 4. Verificación

- [x] 4.1 `npx tsc -p tsconfig.check.json` sin errores y `npm run build` exitoso (plantillas + módulo lazy).
- [ ] 4.2 Prueba manual: registrar una venta y un extravío, abrir Reportes y validar totales, agrupación, filtros por fecha y por proveedor, y comportamiento sin conexión.
