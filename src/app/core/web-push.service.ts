import{Injectable}from'@angular/core';import{HttpClient}from'@angular/common/http';import{SwPush}from'@angular/service-worker';import{firstValueFrom}from'rxjs';import{environment}from'../../environments/environment';
@Injectable({providedIn:'root'})export class WebPushService{private base=`${environment.apiBaseUrl}/api/push`;constructor(private swPush:SwPush,private http:HttpClient){}
async enabled(){if(!this.swPush.isEnabled)return false;return!!(await firstValueFrom(this.swPush.subscription));}
get available(){return this.swPush.isEnabled&&'Notification'in window;}
get permission(){return this.available?Notification.permission:'denied';}
async setEnabled(enabled:boolean){if(enabled)await this.subscribe();else await this.unsubscribe();localStorage.setItem('fafap.notifications.enabled',String(enabled));}
private async subscribe(){if(!this.swPush.isEnabled)throw new Error('Les notifications push ne sont pas disponibles sur ce navigateur.');let subscription=await firstValueFrom(this.swPush.subscription);if(!subscription){const config=await firstValueFrom(this.http.get<{publicKey:string}>(`${this.base}/public-key`));subscription=await this.swPush.requestSubscription({serverPublicKey:config.publicKey});}await firstValueFrom(this.http.post(`${this.base}/subscriptions`,subscription.toJSON()));}
private async unsubscribe(){const subscription=await firstValueFrom(this.swPush.subscription);if(!subscription)return;await firstValueFrom(this.http.request('DELETE',`${this.base}/subscriptions`,{body:{endpoint:subscription.endpoint}})).catch(()=>undefined);await subscription.unsubscribe();}
}
