import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UserRole } from '../models/user.model';
import { SessionService } from '../services/session.service';

/**
 * Protege rutas por rol. La ruta declara los roles permitidos en `data: { roles: [...] }`.
 * Si el rol actual no está permitido, redirige al dashboard.
 */
export const roleGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] as UserRole[] | undefined) ?? [];
  if (roles.length === 0 || roles.includes(session.currentRole)) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
