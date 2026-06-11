/**
 * Utilidades de WhatsApp (capability: configuration). Normaliza el número y construye el
 * enlace wa.me, opcionalmente con un mensaje predefinido (editable por el usuario antes de enviar).
 */

/**
 * Normaliza un número para WhatsApp: deja solo dígitos y antepone el código de Perú (51)
 * a los celulares de 9 dígitos. Devuelve null si no hay número.
 */
export function normalizeWhatsApp(raw: string | undefined | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  // Celular peruano (9 dígitos, empieza en 9) → anteponer 51.
  if (digits.length === 9 && digits.startsWith('9')) {
    return `51${digits}`;
  }
  return digits;
}

/** Construye el enlace wa.me con mensaje opcional, o null si no hay número válido. */
export function whatsappUrl(raw: string | undefined | null, message?: string): string | null {
  const num = normalizeWhatsApp(raw);
  if (!num) {
    return null;
  }
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
