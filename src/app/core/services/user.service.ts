import { Injectable } from '@angular/core';

import { AppUser, UserRole } from '../models/user.model';
import { DatabaseService } from './database.service';

interface UserRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
  synced_at: string | null;
}

/**
 * UserService — cuentas y perfiles (capabilities: authentication, user-management). Persiste
 * en SQLite (`app_user`) y se sincroniza siempre. No se borra con los borrados locales.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  /** Devuelve la cuenta por id, o null. */
  async getById(id: string): Promise<AppUser | null> {
    const rows = await this.db.query<UserRow>('SELECT * FROM app_user WHERE id = ? LIMIT 1;', [id]);
    return rows.length ? this.map(rows[0]) : null;
  }

  /** Devuelve la cuenta por correo, o null. */
  async getByEmail(email: string): Promise<AppUser | null> {
    const rows = await this.db.query<UserRow>('SELECT * FROM app_user WHERE email = ? LIMIT 1;', [
      email.trim().toLowerCase(),
    ]);
    return rows.length ? this.map(rows[0]) : null;
  }

  /**
   * Asegura que exista la cuenta: si no existe la crea con `defaultRole`; si existe conserva
   * su rol asignado. Devuelve la cuenta resultante. (El owner se fuerza a admin aparte.)
   */
  async ensureUser(id: string, email: string, defaultRole: UserRole): Promise<AppUser> {
    const existing = await this.getById(id);
    if (existing) {
      return existing;
    }
    const user: AppUser = {
      id,
      email: email.trim().toLowerCase(),
      role: defaultRole,
      createdAt: new Date().toISOString(),
    };
    await this.db.execute(
      'INSERT INTO app_user (id, email, role, created_at) VALUES (?, ?, ?, ?);',
      [user.id, user.email, user.role, user.createdAt],
    );
    return user;
  }

  /** Asigna un rol a una cuenta (lo usa el admin). */
  async setRole(id: string, role: UserRole): Promise<void> {
    await this.db.execute('UPDATE app_user SET role = ?, synced_at = NULL WHERE id = ?;', [role, id]);
  }

  /** Lista todas las cuentas (admin). */
  async list(): Promise<AppUser[]> {
    const rows = await this.db.query<UserRow>('SELECT * FROM app_user ORDER BY email;');
    return rows.map((r) => this.map(r));
  }

  /** Busca cuentas por coincidencia parcial de correo (admin). */
  async search(query: string): Promise<AppUser[]> {
    const rows = await this.db.query<UserRow>(
      'SELECT * FROM app_user WHERE email LIKE ? ORDER BY email;',
      [`%${query.trim().toLowerCase()}%`],
    );
    return rows.map((r) => this.map(r));
  }

  private map(r: UserRow): AppUser {
    return {
      id: r.id,
      email: r.email,
      role: (r.role as UserRole) ?? 'comprador',
      createdAt: r.created_at,
      syncedAt: r.synced_at ?? undefined,
    };
  }
}
