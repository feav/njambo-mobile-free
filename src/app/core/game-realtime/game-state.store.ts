import { Injectable, computed, signal } from '@angular/core'; import { GameStateDto, PrivateHandDto, VersionedGameEvent } from './game-realtime.models';
@Injectable({providedIn:'root'}) export class GameStateStore {
 readonly state=signal<GameStateDto|null>(null); readonly hand=signal<PrivateHandDto|null>(null); private readonly eventIds=new Set<string>();
 readonly remainingSeconds=computed(()=>{const d=this.state()?.currentTurnDeadline;if(!d)return 0;return Math.max(0,Math.ceil((Date.parse(d)-Date.now())/1000));});
 replace(state:GameStateDto){this.state.set(state);}
 apply(event:VersionedGameEvent):'APPLIED'|'DUPLICATE'|'RESYNC_REQUIRED'{if(this.eventIds.has(event.eventId))return'DUPLICATE';const current=this.state();if(current&&event.gameVersion>current.version+1)return'RESYNC_REQUIRED';if(current&&event.gameVersion<=current.version)return'DUPLICATE';this.eventIds.add(event.eventId);if(event.eventType==='GAME_STATE_UPDATED')this.state.set(event.payload as GameStateDto);if(event.eventType==='PRIVATE_HAND_UPDATED')this.hand.set(event.payload as PrivateHandDto);return'APPLIED';}
 clear(){this.state.set(null);this.hand.set(null);this.eventIds.clear();}
}
