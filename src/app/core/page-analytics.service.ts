import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {NavigationEnd,Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {environment} from '../../environments/environment';
import {BUILD_INFO} from '../../generated/build-info';
import {AuthService} from './auth.service';

@Injectable({providedIn:'root'})
export class PageAnalyticsService{
  private readonly key='njambo.analytics.session';
  private readonly sessionId=this.session();
  private previousRoute?:string;
  private started=false;
  constructor(private router:Router,private http:HttpClient,private auth:AuthService){}
  start(){if(this.started)return;this.started=true;this.router.events.pipe(filter((event):event is NavigationEnd=>event instanceof NavigationEnd)).subscribe(event=>{
    const route=this.normalize(event.urlAfterRedirects);
    if(!route||route===this.previousRoute)return;
    const previousRoute=this.previousRoute;this.previousRoute=route;
    if(!this.auth.accessToken()||!this.auth.hasRefreshToken())return;
    this.http.post(`${environment.apiBaseUrl}/api/analytics/page-visits`,{sessionId:this.sessionId,route,previousRoute,platform:this.platform(),appVersion:BUILD_INFO.version,countryCode:this.browserCountry()}).subscribe({error:()=>undefined});
  });}
  private normalize(url:string){const path=url.split(/[?#]/,1)[0]||'/';return path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig,':id').replace(/\/\d+(?=\/|$)/g,'/:id').replace(/\/+/g,'/').slice(0,160);}
  private session(){try{const existing=sessionStorage.getItem(this.key);if(existing)return existing;const value=crypto.randomUUID();sessionStorage.setItem(this.key,value);return value;}catch{return crypto.randomUUID();}}
  private platform(){const agent=navigator.userAgent;return /iPhone|iPad|iPod/i.test(agent)?'ios':/Android/i.test(agent)?'android':'web';}
  private browserCountry(){for(const locale of navigator.languages?.length?navigator.languages:[navigator.language]){const match=locale.match(/[-_]([A-Za-z]{2})(?:$|[-_])/);if(match)return match[1].toUpperCase()}return undefined;}
}
