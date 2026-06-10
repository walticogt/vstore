import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '../services/session.service';

/** Protege rutas que requieren sesión iniciada; redirige a /login si no hay sesión. */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isLoggedIn ? true : router.createUrlTree(['/login']);
};
