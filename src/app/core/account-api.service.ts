import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface AccountView { id: string; userId: string; availableBalance: number; reservedBalance: number; withdrawableBalance: number; currency: string; version: number; }
export interface AccountTransactionView { id: string; type: string; direction: 'CREDIT'|'DEBIT'; amount: number; balanceAfter: number; idempotencyKey: string; createdAt: string; }
export interface PaymentAccounts {paypalAccount:string|null;ibanAccount:string|null;mobileMoneyAccount:string|null;orangeMoneyAccount:string|null;minimumWithdrawalAmount:number;updatedAt?:string;}
export interface PaymentOptions { depositsEnabled:boolean; withdrawalsEnabled:boolean; plannedProvider:string; plannedMethods:PaymentMethod[];accounts:PaymentAccounts; }
export type PaymentMethod='PAYPAL'|'MOBILE_MONEY'|'ORANGE_MONEY'|'BANK_TRANSFER';
export interface PaymentRequestView { id:string;type:'DEPOSIT'|'WITHDRAWAL';method:PaymentMethod;status:'PENDING'|'APPROVED'|'REJECTED';amount:number;paypalEmail?:string;phoneNumber?:string;bankRib?:string;payerReference?:string;adminNote?:string;createdAt:string;processedAt?:string;paymentAccount?:string; }

@Injectable({providedIn:'root'})
export class AccountApiService {
  private readonly url=`${environment.apiBaseUrl}/api/accounts/me`;
  constructor(private http:HttpClient){}
  get(){return this.http.get<AccountView>(this.url);}
  transactions(){return this.http.get<AccountTransactionView[]>(`${this.url}/transactions`);}
  paymentOptions(){return this.http.get<PaymentOptions>(`${this.url}/payment-options`);}
  paymentRequests(){return this.http.get<PaymentRequestView[]>(`${this.url}/payment-requests`);}
  depositRequest(body:{amount:number;method:PaymentMethod;payerReference?:string}){return this.http.post<PaymentRequestView>(`${this.url}/deposit-requests`,body,{headers:{'Idempotency-Key':`deposit:${crypto.randomUUID()}`}});}
  withdrawalRequest(body:{amount:number;method:PaymentMethod;paypalEmail?:string;phoneNumber?:string;bankRib?:string}){return this.http.post<PaymentRequestView>(`${this.url}/withdrawal-requests`,body,{headers:{'Idempotency-Key':`withdrawal:${crypto.randomUUID()}`}});}
  refundRequest(body:{amount:number;method:PaymentMethod;paypalEmail?:string;phoneNumber?:string;bankRib?:string}){return this.withdrawalRequest(body);}
}
