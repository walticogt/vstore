import { Injectable } from '@angular/core';

import { UserRole } from '../models/user.model';
import { UserService } from './user.service';

/** Usuario por defecto cuando no hay sesión iniciada. */
export const DEFAULT_USER = 'default';

/** Correo del dueño: queda como admin automáticamente. */
export const OWNER_EMAIL = 'walther.huanca@gmail.com';

const AUTH_KEY = 'vstore.auth';
const USER_KEY = 'vstore.user';
const ROLE_KEY = 'vstore.role';
const EMAIL_KEY = 'vstore.email';

/** Credenciales por defecto del MVP (local). El login local se trata como dueño/admin. */
const DEFAULT_CREDENTIALS: Record<string, string> = { admin: 'admin' };

/** Acciones gobernadas por rol. */
export type Permission =
  | 'generate'
  | 'scan'
  | 'inventory'
  | 'addPrenda'
  | 'sell'
  | 'markLost'
  | 'viewSold'
  | 'reports'
  | 'manageUsers'
  | 'catalog';

/** Permisos por rol. */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'generate',
    'scan',
    'inventory',
    'addPrenda',
    'sell',
    'markLost',
    'viewSold',
    'reports',
    'manageUsers',
    'catalog',
  ],
  registrador: ['generate', 'scan'],
  vendedor: ['inventory', 'scan', 'sell'],
  comprador: ['catalog'],
};

/**
 * SessionService — sesión, perfil (rol) y permisos. Login local (admin/admin → admin) y, a
 * futuro, Google (Gmail). Cachea el último usuario (email + rol) en localStorage para permitir
 * el ingreso sin internet (offline-first). El usuario actual etiqueta quién realiza acciones.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor(private readonly users: UserService) {}

  get isLoggedIn(): boolean {
    return localStorage.getItem(AUTH_KEY) === 'true';
  }

  get currentUser(): string {
    return localStorage.getItem(USER_KEY) || DEFAULT_USER;
  }

  get currentEmail(): string {
    return localStorage.getItem(EMAIL_KEY) || '';
  }

  /** Rol del usuario actual (cacheado; disponible sin internet). */
  get currentRole(): UserRole {
    return (localStorage.getItem(ROLE_KEY) as UserRole) || 'comprador';
  }

  /** True si el rol actual puede realizar la acción. */
  can(permission: Permission): boolean {
    return ROLE_PERMISSIONS[this.currentRole]?.includes(permission) ?? false;
  }

  /** Login local (admin/admin). El dueño/local se trata como admin. */
  login(email: string, password: string): boolean {
    const user = email.trim().toLowerCase();
    if (DEFAULT_CREDENTIALS[user] && DEFAULT_CREDENTIALS[user] === password) {
      this.setSession(user, OWNER_EMAIL, 'admin');
      return true;
    }
    return false;
  }

  /**
   * Establece la sesión de una cuenta Google: el dueño es admin; el resto, su rol asignado o
   * `comprador` por defecto. Persiste la cuenta y cachea email + rol. Devuelve el rol.
   */
  async establishGoogleSession(uid: string, email: string): Promise<UserRole> {
    const normalized = email.trim().toLowerCase();
    const isOwner = normalized === OWNER_EMAIL;
    const user = await this.users.ensureUser(uid, normalized, isOwner ? 'admin' : 'comprador');
    // Garantiza que el dueño siempre quede admin (aunque existiera con otro rol).
    if (isOwner && user.role !== 'admin') {
      await this.users.setRole(uid, 'admin');
      user.role = 'admin';
    }
    this.setSession(normalized, normalized, user.role);
    return user.role;
  }

  private setSession(user: string, email: string, role: UserRole): void {
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(USER_KEY, user);
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(ROLE_KEY, role);
  }

  /** Cierra la sesión. Conserva email+rol como "último usuario" (caché para reingreso offline). */
  logout(): void {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
