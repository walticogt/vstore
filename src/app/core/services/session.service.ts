import { Injectable } from '@angular/core';

/** Usuario por defecto cuando no hay sesión iniciada. */
export const DEFAULT_USER = 'default';

const AUTH_KEY = 'vstore.auth';
const USER_KEY = 'vstore.user';

/** Credenciales por defecto del MVP (local). Reemplazable por Firebase Auth a futuro. */
const DEFAULT_CREDENTIALS: Record<string, string> = { admin: 'admin' };

/**
 * SessionService — sesión y autenticación local. Hoy valida contra credenciales por
 * defecto (admin/admin) persistidas en localStorage; queda listo para conectarse a
 * Firebase Auth. El usuario actual se usa para registrar quién realiza las acciones.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  get isLoggedIn(): boolean {
    return localStorage.getItem(AUTH_KEY) === 'true';
  }

  get currentUser(): string {
    return localStorage.getItem(USER_KEY) || DEFAULT_USER;
  }

  /** Valida credenciales (admin/admin por defecto). Devuelve true si el acceso es correcto. */
  login(email: string, password: string): boolean {
    const user = email.trim().toLowerCase();
    if (DEFAULT_CREDENTIALS[user] && DEFAULT_CREDENTIALS[user] === password) {
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(USER_KEY, user);
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
