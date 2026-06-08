/**
 * Genera un SKU legible derivado del proveedor y el nombre del producto, con un
 * sufijo corto para garantizar unicidad. Ej: proveedor "Zara", nombre "Vestido largo",
 * sufijo "3F9A" → "ZAR-VES-3F9A".
 */
export function buildSku(name: string, supplier: string | undefined, suffix: string): string {
  const part = (value: string | undefined, fallback: string): string => {
    const clean = (value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3);
    return clean || fallback;
  };

  const sup = part(supplier, 'GEN');
  const nam = part(name, 'PRD');
  return `${sup}-${nam}-${suffix.toUpperCase()}`;
}
