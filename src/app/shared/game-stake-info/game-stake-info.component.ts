import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { GameApiService } from '../../core/game-realtime/game-api.service';
import { AccountApiService } from '../../core/account-api.service';

@Component({standalone:true,selector:'app-game-stake-info',imports:[CommonModule,IonicModule],templateUrl:'./game-stake-info.component.html',styleUrls:['./game-stake-info.component.scss']})
export class GameStakeInfoComponent implements OnInit,OnChanges,OnDestroy{
  @Input()gameId='';
  stakeAmount=0;playerCount=0;balance:number|null=null;
  private timer?:number;

  constructor(private games:GameApiService,private accounts:AccountApiService){}

  get pot(){return this.stakeAmount*this.playerCount;}

  ngOnInit(){this.refresh();this.timer=window.setInterval(()=>this.refresh(),5000);}
  ngOnChanges(changes:SimpleChanges){if(changes['gameId'])this.refresh();}
  ngOnDestroy(){if(this.timer)window.clearInterval(this.timer);}

  private refresh(){
    if(!this.gameId)return;
    this.games.state(this.gameId).subscribe({next:state=>{this.stakeAmount=state.stakeAmount;this.playerCount=state.players.length;},error:()=>undefined});
    this.accounts.get().subscribe({next:account=>this.balance=account.availableBalance,error:()=>undefined});
  }
}
