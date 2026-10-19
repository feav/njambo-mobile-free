import {Injectable} from '@angular/core';import {HttpClient} from '@angular/common/http';import {environment} from '../../environments/environment';
export interface ReferralUser{userId:string;username:string;createdAt:string;rewarded:boolean}
export interface ReferralView{eligible:boolean;eligibleUntil:string;activated:boolean;referrerUsername:string|null;reward:number|null;rewarded:boolean;referredUsers:ReferralUser[]}
@Injectable({providedIn:'root'})export class ReferralApiService{private url=`${environment.apiBaseUrl}/api/referrals`;constructor(private http:HttpClient){}view(){return this.http.get<ReferralView>(this.url)}activate(code:string){return this.http.post<ReferralView>(`${this.url}/activate`,{code})}}
