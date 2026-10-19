import { Component, OnInit } from '@angular/core';
import { MenuController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountApiService, AccountTransactionView, PaymentMethod, PaymentOptions, PaymentRequestView } from '../core/account-api.service';
import { AuthService } from '../core/auth.service';

type TransactionFilter = 'all' | 'deposit' | 'withdraw';

@Component({
    standalone: false,
    selector: 'app-transactions',
    templateUrl: './transactions.page.html',
    styleUrls: ['./transactions.page.scss'],
})
export class TransactionsPage implements OnInit {
    activeFilter: TransactionFilter = 'all';
    balance: number | null = null;
    reservedBalance: number | null = null;
    loading = true;
    loadFailed = false;
    username = '';
    avatarUrl = '/assets/images/avatars/armel.png';
    paymentMode: 'deposit'|'refund'|null = null;
    depositStep: 1|2|3 = 1;
    paymentMethod: PaymentMethod = 'PAYPAL';
    paymentAmount: number|null = null;
    paymentDestination = '';
    payerReference = '';
    paymentBusy = false;
    paymentRequests: PaymentRequestView[] = [];
    paymentOptions: PaymentOptions|null = null;
    readonly supportMessengerLink = 'https://m.me/1265920616601740';
    readonly supportWhatsappLink = 'https://wa.me/33646922921';

    transactionGroups: Array<{label:string;positive:string;negative:string;items:Array<{type:TransactionFilter;title:string;reference:string;time:string;amount:string}>}> = [];

    constructor(private router: Router, private route: ActivatedRoute, private menu: MenuController, private accounts: AccountApiService,
                private toast: ToastController, private auth: AuthService) {}

    ngOnInit() { this.auth.user$.subscribe(session=>{this.username=session?.user.username||'Joueur';this.avatarUrl=session?.user.avatarUrl||this.avatarUrl;});this.load(); }

    load() {
        this.loading = true;
        this.loadFailed = false;
        forkJoin({ account: this.accounts.get(), transactions: this.accounts.transactions(), requests:this.accounts.paymentRequests(),options:this.accounts.paymentOptions() }).subscribe({
            next: ({account, transactions,requests,options}) => { this.balance = account.availableBalance; this.reservedBalance = account.reservedBalance; this.transactionGroups = this.group(transactions);this.paymentRequests=requests;this.paymentOptions=options; this.loading = false; if(this.route.snapshot.queryParamMap.get('action')==='deposit')this.moneyAction('deposit'); },
            error: () => { this.loading = false; this.loadFailed = true; void this.showError('Impossible de charger le compte.'); }
        });
    }

    get filteredGroups() {
        if (this.activeFilter === 'all') return this.transactionGroups;

        return this.transactionGroups
            .map(group => ({ ...group, items: group.items.filter(item => item.type === this.activeFilter) }))
            .filter(group => group.items.length > 0);
    }

    get depositSubmitEnabled() { return this.paymentAmountValid && this.payerReference.trim().length>0; }
    get paymentAmountValid() {
        const amount = Number(this.paymentAmount);
        return Number.isFinite(amount) && amount > 0;
    }

    setFilter(filter: TransactionFilter) { this.activeFilter = filter; }
    trackPaymentRequest(_index:number,request:PaymentRequestView){return request.id;}
    trackTransactionGroup(_index:number,group:{label:string}){return group.label;}
    trackTransaction(_index:number,transaction:{reference:string}){return transaction.reference;}
    trackPaymentMethod(_index:number,method:PaymentMethod){return method;}
    moneyAction(kind: 'deposit'|'refund') {this.paymentMode=kind;this.depositStep=1;this.paymentMethod=this.availableMethods(kind)[0]||'PAYPAL';this.paymentAmount=null;this.paymentDestination='';this.payerReference='';}
    closePayment(){if(!this.paymentBusy)this.paymentMode=null;}
    selectMethod(method:PaymentMethod){this.paymentMethod=method;this.paymentDestination='';if(this.paymentMode==='deposit')this.depositStep=3;}
    nextDepositStep(){if(!this.paymentAmountValid){void this.showError('Saisissez un montant valide.');return;}this.depositStep=2;}
    backDepositStep(){this.depositStep=(this.depositStep>1?this.depositStep-1:1) as 1|2|3;}
    ussdCode(){const accounts=this.paymentOptions?.accounts;const numero=this.paymentMethod==='MOBILE_MONEY'?accounts?.mobileMoneyAccount:accounts?.orangeMoneyAccount;if(!numero)return'';const prefix=this.paymentMethod==='MOBILE_MONEY'?'126':'150';const montant=Math.trunc(Number(this.paymentAmount)||0);return`*${prefix}*1*1*${numero}*${montant}#`;}
    ussdDialLink(){const code=this.ussdCode();return code?`tel:${code.replace('#','%23')}`:'';}
    get refundSubmitEnabled() { return this.paymentAmountValid && this.paymentDestination.trim().length > 0; }
    submitPayment(){const amount=Number(this.paymentAmount);const mode=this.paymentMode;if(!Number.isFinite(amount)||amount<=0){void this.showError('Saisissez un montant valide.');return;}if(mode==='deposit'&&!this.payerReference.trim()){void this.showError('Ajoutez la référence du transfert.');return;}if(mode==='refund'&&!this.paymentDestination.trim()){void this.showError('Renseignez les coordonnées de réception.');return;}this.paymentBusy=true;const request=mode==='refund'?this.accounts.refundRequest({amount,method:this.paymentMethod,...(this.paymentMethod==='PAYPAL'?{paypalEmail:this.paymentDestination}:this.paymentMethod==='MOBILE_MONEY'||this.paymentMethod==='ORANGE_MONEY'?{phoneNumber:this.paymentDestination}:{bankRib:this.paymentDestination})}):this.accounts.depositRequest({amount,method:this.paymentMethod,payerReference:this.payerReference||undefined});request.subscribe({next:async()=>{this.paymentBusy=false;this.paymentMode=null;this.load();const toast=await this.toast.create({message:mode==='refund'?'Demande de remboursement envoyée pour validation.':'Demande de jetons enregistrée.',duration:3500,color:'success',position:'top'});await toast.present();},error:error=>{this.paymentBusy=false;void this.showError(error?.error?.message||'Impossible d’enregistrer la demande.');}});}
    availableMethods(_mode=this.paymentMode){return this.paymentOptions?.plannedMethods||[];}
    paymentAccount(){const accounts=this.paymentOptions?.accounts;if(!accounts)return'';return this.paymentMethod==='PAYPAL'?accounts.paypalAccount||'':this.paymentMethod==='BANK_TRANSFER'?accounts.ibanAccount||'':this.paymentMethod==='MOBILE_MONEY'?accounts.mobileMoneyAccount||'':accounts.orangeMoneyAccount||'';}
    methodLabel(method:PaymentMethod){return method==='PAYPAL'?'PayPal':method==='ORANGE_MONEY'?'Orange Money':method==='MOBILE_MONEY'?'Mobile Money':'IBAN';}
    destinationLabel(){return this.paymentMethod==='PAYPAL'?'Adresse PayPal':this.paymentMethod==='BANK_TRANSFER'?'RIB / IBAN':'Numéro de téléphone';}
    destinationPlaceholder(){return this.paymentMethod==='PAYPAL'?'nom@email.com':this.paymentMethod==='BANK_TRANSFER'?'RIB ou IBAN':'+237…';}
    goToHomePage() { this.router.navigate(['/home']); }
    goToProfilePage() { this.router.navigate(['/profile']); }
    goToGamePage() { this.router.navigate(['/search']); }
    openMenu() { this.menu.open('main-menu'); }
    private group(transactions: AccountTransactionView[]) {
        const groups = new Map<string, ReturnType<TransactionsPage['makeGroup']>>();
        for (const tx of transactions) { const date=new Date(tx.createdAt); const key=date.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); if(!groups.has(key))groups.set(key,this.makeGroup(key)); const group=groups.get(key)!; const credit=tx.direction==='CREDIT'; const amount=Number(tx.amount).toLocaleString('fr-FR'); group.items.push({type:credit?'deposit':'withdraw',title:this.title(tx.type),reference:`Réf. ${tx.id.slice(0,8).toUpperCase()}`,time:date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),amount}); group[credit?'positive':'negative']=amount; }
        return [...groups.values()];
    }
    private makeGroup(label:string){return {label,positive:'',negative:'',items:[] as Array<{type:TransactionFilter;title:string;reference:string;time:string;amount:string}>};}
    private title(type:string){return ({DEPOSIT:'Jetons ajoutés',WITHDRAWAL:'Mouvement de jetons',GAME_WIN:'Jetons gagnés',GAME_LOSS:'Jetons utilisés',GAME_REFUND:'Jetons rendus',GAME_CANCELLATION_REFUND:'Jetons rendus',GAME_STAKE_RESERVATION:'Jetons engagés',GAME_STAKE_DEBIT:'Jetons utilisés'} as Record<string,string>)[type]||type.replaceAll('_',' ');}
    private async showError(message:string){const toast=await this.toast.create({message,duration:2500,color:'danger',position:'top'});await toast.present();}
}
