import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Prevents an already authenticated user from returning to the login screen. */
export const loginRedirectGuard: CanActivateFn = (route:ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.accessToken() || !auth.hasRefreshToken()) return true;

  // The profile endpoint validates the access token. The auth interceptor will
  // transparently renew it once with the refresh token when necessary.
  return auth.reloadProfile().pipe(
    map(() => router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')))),
    catchError(() => of(true))
  );
};

function safeReturnUrl(value:string|null){return value?.startsWith('/')&&!value.startsWith('//')?value:'/home'}
