import { Injectable, Injector } from '@angular/core';
import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

const AUTH_RETRY = new HttpContextToken<boolean>(() => false);

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private injector: Injector) {}
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const auth=this.injector.get(AuthService);const token=auth.accessToken();const authenticated=token?request.clone({setHeaders:{Authorization:`Bearer ${token}`}}):request;
    return next.handle(authenticated).pipe(catchError(error=>{
      const isAuthRoute=request.url.includes('/api/auth/');
      if(!(error instanceof HttpErrorResponse)||error.status!==401||isAuthRoute||request.context.get(AUTH_RETRY))return throwError(()=>error);
      const latestToken=auth.accessToken();
      if(token&&latestToken&&latestToken!==token){
        return next.handle(request.clone({setHeaders:{Authorization:`Bearer ${latestToken}`},context:request.context.set(AUTH_RETRY,true)}));
      }
      if(!auth.hasRefreshToken()){this.expireSession(auth);return throwError(()=>error);}
      return auth.refresh().pipe(catchError(refreshError=>{this.expireSession(auth);return throwError(()=>refreshError);}),switchMap(()=>{
        const refreshed=auth.accessToken();
        if(!refreshed){this.expireSession(auth);return throwError(()=>new Error('ACCESS_TOKEN_MISSING_AFTER_REFRESH'));}
        return next.handle(request.clone({setHeaders:{Authorization:`Bearer ${refreshed}`},context:request.context.set(AUTH_RETRY,true)}));
      }));
    }));
  }
  private expireSession(auth:AuthService){auth.logout();void this.injector.get(Router).navigate(['/login']);}
}
