import {inject} from '@angular/core';
import {CanActivateFn,Router} from '@angular/router';
import {AuthService} from './auth.service';

/** Blocks private pages before they can start protected API calls. */
export const authRequiredGuard:CanActivateFn=()=>{
  const auth=inject(AuthService);
  if(auth.accessToken()&&auth.hasRefreshToken())return true;
  return inject(Router).createUrlTree(['/login']);
};
