/**
 * Modelos de usuarios y perfiles (capability: authentication / user-management).
 */

/** Perfiles de la app. */
export type UserRole = 'admin' | 'registrador' | 'vendedor' | 'comprador';

/** Orden y etiquetas legibles de los roles (para la UI de gestión). */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  registrador: 'Registrador',
  vendedor: 'Vendedor',
  comprador: 'Comprador',
};

/** Cuenta registrada y su perfil. */
export interface AppUser {
  id: string;          // uid de Firebase (o 'admin' para el login local)
  email: string;       // correo normalizado (minúsculas)
  role: UserRole;
  createdAt: string;   // ISO 8601
  syncedAt?: string;
}
