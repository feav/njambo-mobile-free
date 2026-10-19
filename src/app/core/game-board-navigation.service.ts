import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GameApiService } from './game-realtime/game-api.service';

@Injectable({providedIn:'root'})
export class GameBoardNavigationService {
  constructor(private api:GameApiService,private router:Router){}
  async open(gameId:string,replaceUrl=false,spectate=false){
    const metadata=await firstValueFrom(this.api.metadata(gameId));
    return this.router.navigate([metadata.boardRoute],{queryParams:{gameId,...(spectate?{spectate:'1'}:{})},replaceUrl});
  }
}
