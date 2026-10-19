import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, from, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser { id: string; username: string; email: string; userType: 'HUMAN' | 'AUTOMATIC'; status: string; emailVerified?: boolean; avatarUrl?: string; cardTheme?: 'normal'|'gold'; phoneNumber?: string; sex?: 'HOMME'|'FEMME'|'NON_DECLARE'; birthdate?: string; createdAt?: string; }
export interface AuthResponse { tokens: { accessToken: string; refreshToken: string; expiresIn: number }; user: AuthUser; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly key = 'fafap.auth';
  private readonly current = new BehaviorSubject<AuthResponse | null>(this.restore());
  private refreshInFlight?: Observable<AuthResponse>;
  readonly user$ = this.current.asObservable();
  constructor(private http: HttpClient) { if (this.current.value?.tokens?.accessToken) this.reloadProfile().subscribe({ error: () => undefined }); }
  register(username: string, email: string, password: string) { return this.save(this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/register`, { username, email, password })); }
  guestJoin(email: string) { return this.save(this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/guest`, { email })); }
  signupBonus() { return this.http.get<number>(`${environment.apiBaseUrl}/api/promotions/signup-bonus`); }
  login(login: string, password: string) { return this.save(this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/login`, { login, password })); }
  forgotPassword(email:string){return this.http.post<{message:string}>(`${environment.apiBaseUrl}/api/auth/forgot-password`,{email});}
  resetPassword(email:string,code:string,password:string,confirmPassword:string){return this.http.post<{message:string}>(`${environment.apiBaseUrl}/api/auth/reset-password`,{email,code,password,confirmPassword});}
  googleLogin(credential: string) { return this.save(this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/google`, { credential })); }
  resendVerification(email: string) { return this.http.post<{message:string}>(`${environment.apiBaseUrl}/api/auth/resend-verification`, { email }); }
  refresh(): Observable<AuthResponse> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const refreshToken = this.current.value?.tokens?.refreshToken;
    if (!refreshToken) return throwError(() => new Error('REFRESH_TOKEN_MISSING'));
    this.refreshInFlight = this.save(this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/refresh`, { refreshToken })).pipe(
      finalize(() => this.refreshInFlight = undefined),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.refreshInFlight;
  }
  accessToken() { return this.current.value?.tokens.accessToken ?? null; }
  hasRefreshToken() { return Boolean(this.current.value?.tokens?.refreshToken); }
  currentUser() { return this.current.value?.user ?? null; }
  updateProfile(username: string, email: string, phoneNumber: string, sex: string, birthdate?: string) { return this.http.patch<AuthUser>(`${environment.apiBaseUrl}/api/users/me`, { username, email, phoneNumber: phoneNumber || null, sex: sex || null, birthdate: birthdate || null }).pipe(tap(user => this.storeUser(user))); }
  updateCardTheme(cardTheme:'normal'|'gold') { return this.http.patch<AuthUser>(`${environment.apiBaseUrl}/api/users/me/card-theme`, {cardTheme}).pipe(tap(user => this.storeUser(user))); }
  generateAvatar(photo: File, quality: 'LOW'|'MEDIUM'|'HIGH' = 'LOW') {
    return from(this.optimizeAvatarPhoto(photo)).pipe(
      // Renew before creating FormData: some mobile WebViews lose multipart
      // content when it is kept alive across an asynchronous token refresh.
      switchMap(optimized => this.refresh().pipe(
        switchMap(() => {
          const body = new FormData();
          body.append('photo', optimized, optimized.name);
          const requestId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
          return this.http.post<AuthUser>(`${environment.apiBaseUrl}/api/users/me/avatar?quality=${quality}`, body, {headers:{'Idempotency-Key':`avatar:${this.currentUser()?.id}:${requestId}`}});
        })
      )),
      tap(user => this.storeUser(user))
    );
  }
  reloadProfile() { return this.http.get<AuthUser>(`${environment.apiBaseUrl}/api/users/me`).pipe(tap(user => this.storeUser(user))); }
  logout() { localStorage.removeItem(this.key); this.current.next(null); }
  private save(source: Observable<AuthResponse>): Observable<AuthResponse> { return source.pipe(tap(v => { this.syncCardTheme(v.user);localStorage.setItem(this.key, JSON.stringify(v)); this.current.next(v); })); }
  private storeUser(user: AuthUser) { const value=this.current.value;this.syncCardTheme(user); if(value){const updated={...value,user};localStorage.setItem(this.key,JSON.stringify(updated));this.current.next(updated);} }
  private syncCardTheme(user:AuthUser){if(user.cardTheme==='normal'||user.cardTheme==='gold')localStorage.setItem('fafap.card.theme',user.cardTheme);}
  private optimizeAvatarPhoto(photo: File): Promise<File> {
    const maxDimension = 1024;
    const maxBytes = 800 * 1024;
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(photo);
      const image = new Image();
      image.onload = async () => {
        try {
          let width = image.naturalWidth;
          let height = image.naturalHeight;
          const scale = Math.min(1, maxDimension / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          let result: Blob | null = null;
          for (let attempt = 0; attempt < 6; attempt++) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('AVATAR_IMAGE_PROCESSING_UNAVAILABLE');
            context.drawImage(image, 0, 0, width, height);
            const quality = Math.max(0.5, 0.82 - attempt * 0.07);
            result = await new Promise<Blob | null>(done => canvas.toBlob(done, 'image/jpeg', quality));
            if (!result) throw new Error('AVATAR_IMAGE_PROCESSING_FAILED');
            if (result.size <= maxBytes) break;
            width = Math.max(320, Math.round(width * 0.85));
            height = Math.max(320, Math.round(height * 0.85));
          }
          if (!result || result.size > maxBytes) throw new Error('AVATAR_IMAGE_TOO_LARGE_AFTER_COMPRESSION');
          resolve(new File([result], 'avatar-upload.jpg', {type:'image/jpeg', lastModified:Date.now()}));
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('AVATAR_IMAGE_INVALID'));
      };
      image.src = objectUrl;
    });
  }
  private restore(): AuthResponse | null {
    try {
      const value = JSON.parse(localStorage.getItem(this.key) || 'null') as AuthResponse | null;
      if (!value?.tokens?.accessToken || !value.tokens.refreshToken || !value.user?.id) {
        localStorage.removeItem(this.key);
        return null;
      }
      return value;
    } catch {
      localStorage.removeItem(this.key);
      return null;
    }
  }
}
