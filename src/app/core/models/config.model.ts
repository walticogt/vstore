/**
 * Modelos de configuración (capability: configuration). Catálogos editables que alimentan
 * el formulario de vinculación: colores (paleta), tallas (radios) y proveedores.
 */

/** Color de la paleta: nombre + hex para pintar el círculo. */
export interface Color {
  id: string;
  name: string;        // p. ej. "Rojo"
  hex: string;         // p. ej. "#E53935"
  sortOrder: number;
  syncedAt?: string;
}

/** Talla seleccionable (S/M/L, 3/4/5, …). */
export interface Size {
  id: string;
  label: string;       // p. ej. "M" o "38"
  sortOrder: number;
  syncedAt?: string;
}

/** Proveedor con datos de contacto (para WhatsApp y dirección). */
export interface Supplier {
  id: string;
  name: string;
  whatsapp?: string;   // número en formato internacional sin símbolos, p. ej. "51987654321"
  address?: string;
  syncedAt?: string;
}
