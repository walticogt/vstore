import { Injectable } from '@angular/core';

/** Usuario por defecto mientras no exista autenticación (ver Open Questions del design). */
export const DEFAULT_USER = 'default';

/**
 * SessionService — usuario actual de la sesión. Hoy devuelve un usuario por defecto;
 * queda listo para conectarse a la autenticación (Firebase Auth) en el grupo 8.
 * Sirve para registrar quién realiza acciones como la vinculación de productos.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private user = DEFAULT_USER;

  get currentUser(): string {
    return this.user;
  }

  setCurrentUser(user: string | null | undefined): void {
    this.user = user?.trim() || DEFAULT_USER;
  }
}
