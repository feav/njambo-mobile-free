import {Component, OnInit} from '@angular/core';
import {ToastController} from '@ionic/angular';
import {CampaignApiService, CampaignLevel, CampaignState, PlayerExperience} from '../core/campaign-api.service';
import {GameBoardNavigationService} from '../core/game-board-navigation.service';
import {forkJoin} from 'rxjs';

interface World { name: string; levels: CampaignLevel[]; }

@Component({standalone:false,selector:'app-campaign',templateUrl:'./campaign.page.html',styleUrls:['./campaign.page.scss']})
export class CampaignPage implements OnInit {
    state?: CampaignState;
    experience?: PlayerExperience;
    worlds: World[] = [];
    loading = true;
    starting = false;
    selectedWorldIndex = 0;

    constructor(private api: CampaignApiService, private navigation: GameBoardNavigationService, private toast: ToastController) {}

    ngOnInit(){ this.reload(); }
    ionViewWillEnter(){ this.reload(); }

    reload(){
        this.loading = true;
        forkJoin({state:this.api.state(),experience:this.api.experience()}).subscribe({
            next: value => {
                this.state = value.state;
                this.experience = value.experience;
                this.worlds = this.groupByWorld(value.state.levels);
                this.loading = false;
            },
            error: () => { this.loading = false; }
        });
    }

    private groupByWorld(levels: CampaignLevel[]): World[] {
        const worlds: World[] = [];
        for (const level of levels) {
            let world = worlds.find(w => w.name === level.worldName);
            if (!world) { world = { name: level.worldName, levels: [] }; worlds.push(world); }
            world.levels.push(level);
        }
        return worlds;
    }

    get selectedWorld(){ return this.worlds[this.selectedWorldIndex]; }
    selectWorld(index:number){ this.selectedWorldIndex=index; }

    nodeX(index:number){
        const route=[68,62,54,43,36,47,56,51,44,52,59,49,41,54,47,58,50,64,40,48];
        const adjustments:Record<number,number>={
            1:50,3:55,7:65,8:45,10:65,13:45,15:65,21:65,22:55,28:65,30:35,
            32:65,34:45,35:55,38:45,40:55,41:45,47:65,48:55,51:50,53:65,
            55:35,56:45,57:65,59:45,63:45,65:65,66:55,68:55,69:55,70:35,
            72:65,73:55,76:50,79:65,80:45,81:45,83:65,86:65,89:45,93:55,
            96:35,97:55,98:55,99:55,
        };
        if (adjustments[index + 1] !== undefined) return adjustments[index + 1];
        return route[index%route.length];
    }
    nodeY(index:number){ return 78+index*112; }
    mapHeight(levelCount:number){ return Math.max(720,150+levelCount*112); }
    isCurrent(level:CampaignLevel,world:World){ return level.unlocked&&!level.completed&&!world.levels.some(item=>item.sequenceOrder<level.sequenceOrder&&!item.completed); }
    isMilestone(index:number){ return (index+1)%5===0; }
    completedCount(world:World){ return world.levels.filter(level=>level.completed).length; }
    difficultyLabel(level:CampaignLevel){ return level.tierName; }
    gameIcon(gameType:string){ return gameType==='UNO'?'color-palette':gameType==='COCHON_GRATTE'?'paw':gameType==='CHECK_GAMES'?'layers':'diamond'; }
    starSlots(level:CampaignLevel){ return Array.from({length:level.stars||0}); }
    gameXp(gameType?:string){ return this.experience?.games.find(game=>game.gameType===gameType)?.xp||0; }

    badgeUrl(level: CampaignLevel){ return level.hasBadge && level.unlocked ? this.api.badgeUrl(level.id) : undefined; }

    resumeInProgress(){
        if (!this.state?.inProgressGameId) return;
        void this.navigation.open(this.state.inProgressGameId);
    }

    play(level: CampaignLevel){
        if (!level.unlocked || this.starting) return;
        this.starting = true;
        this.api.start(level.id).subscribe({
            next: result => { this.starting = false; void this.navigation.open(result.gameId); },
            error: async error => {
                this.starting = false;
                const message = error?.error?.message || 'Impossible de lancer ce niveau pour le moment.';
                const t = await this.toast.create({ message, color: 'danger', duration: 2400, position: 'top' });
                await t.present();
            }
        });
    }

}
