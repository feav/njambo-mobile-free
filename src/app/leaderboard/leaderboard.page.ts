import{Component,OnInit}from'@angular/core';import{SocialApiService,LeaderboardRow,MonthlyLeaderboardRow,RankRow}from'../core/social-api.service';import{AuthService}from'../core/auth.service';
type Tab='GLOBAL'|'MONTHLY_ELO'|'MONTHLY_GAMES';type Row=LeaderboardRow|MonthlyLeaderboardRow;
@Component({standalone:false,selector:'app-leaderboard',templateUrl:'./leaderboard.page.html',styleUrls:['./leaderboard.page.scss','./leaderboard-fixes.scss']})export class LeaderboardPage implements OnInit{
 rows:Row[]=[];me?:RankRow;loading=true;myUserId='';tab:Tab='GLOBAL';query='';readonly pageSize=50;page=1;private loadSequence=0;
 constructor(private social:SocialApiService,private auth:AuthService){}
 ngOnInit(){this.myUserId=this.auth.currentUser()?.id||'';this.social.myRating().subscribe(r=>this.me=r);this.load()}
 select(tab:Tab){if(this.tab===tab)return;this.tab=tab;this.query='';this.load()}
 load(){this.loading=true;this.page=1;const sequence=++this.loadSequence,done=(r:Row[])=>{if(sequence!==this.loadSequence)return;this.rows=r;this.loading=false},fail=()=>{if(sequence===this.loadSequence)this.loading=false};if(this.tab==='GLOBAL')this.social.leaderboard().subscribe({next:done,error:fail});else this.social.monthlyLeaderboard(this.tab==='MONTHLY_ELO'?'ELO':'GAMES').subscribe({next:done,error:fail})}
 get filtered(){const q=this.query.trim().toLocaleLowerCase('fr');return q?this.rows.filter(r=>r.username.toLocaleLowerCase('fr').includes(q)):this.rows}
 get totalPages(){return Math.max(1,Math.ceil(this.filtered.length/this.pageSize))}get pagedRows(){const start=(this.page-1)*this.pageSize;return this.filtered.slice(start,start+this.pageSize)}
 search(){this.page=1}goToPage(page:number){this.page=Math.min(Math.max(1,page),this.totalPages)}
 monthly(row:Row){return row as MonthlyLeaderboardRow}global(row:Row){return row as LeaderboardRow}value(row:Row){if(this.tab==='GLOBAL')return`${Number(row.rating)||0} ELO`;if(this.tab==='MONTHLY_ELO'){const elo=Number(this.monthly(row).monthlyElo)||0;return`${elo>=0?'+':''}${elo} ELO`;}const games=Number(this.monthly(row).monthlyGames)||0;return`${games} partie${games>1?'s':''}`}
}
