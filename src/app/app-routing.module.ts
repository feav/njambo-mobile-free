import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { loginRedirectGuard } from './core/login-redirect.guard';
import { authRequiredGuard } from './core/auth-required.guard';

const routes: Routes = [
    {
        path: 'home', canActivate:[authRequiredGuard],
        loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
    },
    {
        path: 'login',
        canActivate: [loginRedirectGuard],
        loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
    },
    {
        path: 'register',
        loadChildren: () => import('./register/register.module').then(m => m.RegisterPageModule)
    },
    {
        path: 'profile', canActivate:[authRequiredGuard],
        loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule)
    },
    {
        path: 'settings', canActivate:[authRequiredGuard],
        loadChildren: () => import('./settings/settings.module').then(m => m.SettingsPageModule)
    },
    {path:'leaderboard',canActivate:[authRequiredGuard],loadChildren:()=>import('./leaderboard/leaderboard.module').then(m=>m.LeaderboardPageModule)},
    {path:'friends',canActivate:[authRequiredGuard],loadChildren:()=>import('./friends/friends.module').then(m=>m.FriendsPageModule)},
    {path:'guilds',canActivate:[authRequiredGuard],loadChildren:()=>import('./guilds/guilds.module').then(m=>m.GuildsPageModule)},
    {path:'referral',canActivate:[authRequiredGuard],loadChildren:()=>import('./referral/referral.module').then(m=>m.ReferralPageModule)},
    {path:'subscriptions',canActivate:[authRequiredGuard],loadChildren:()=>import('./subscriptions/subscriptions.module').then(m=>m.SubscriptionsPageModule)},
    {path:'championships',canActivate:[authRequiredGuard],loadChildren:()=>import('./championships/championships.module').then(m=>m.ChampionshipsPageModule)},
    {path:'challenges',canActivate:[authRequiredGuard],loadChildren:()=>import('./challenges/challenges.module').then(m=>m.ChallengesPageModule)},
    {path:'campaign',canActivate:[authRequiredGuard],loadChildren:()=>import('./campaign/campaign.module').then(m=>m.CampaignPageModule)},
    {path:'players',loadChildren:()=>import('./player-profile/player-profile.module').then(m=>m.PlayerProfilePageModule)},
    {
        path: 'forgot-password-step1',
        loadChildren: () => import('./forgot-password-step1/forgot-password-step1.module').then(m => m.ForgotPasswordStep1PageModule)
    },
    {
        path: 'forgot-password-step2',
        loadChildren: () => import('./forgot-password-step2/forgot-password-step2.module').then(m => m.ForgotPasswordStep2PageModule)
    },
    {
        path: 'game-board',
        loadChildren: () => import('./game-board/game-board.module').then(m => m.GameBoardPageModule)
    },
    {path:'games/tcheck',loadChildren:()=>import('./tcheck-game-board/tcheck-game-board.module').then(m=>m.TcheckGameBoardPageModule)},
    {path:'games/check-games',loadChildren:()=>import('./check-game-board/check-game-board.module').then(m=>m.CheckGameBoardPageModule)},
    {path:'games/uno',loadChildren:()=>import('./uno-game-board/uno-game-board.module').then(m=>m.UnoGameBoardPageModule)},
    {path:'games/cochon-gratte',loadChildren:()=>import('./cochon-game-board/cochon-game-board.module').then(m=>m.CochonGameBoardPageModule)},
    {path:'games/21-direct',loadChildren:()=>import('./tchia-direct-game-board/tchia-direct-game-board.module').then(m=>m.TchiaDirectGameBoardPageModule)},
    {path:'games/21-impot',loadChildren:()=>import('./tchia-direct-game-board/tchia-direct-game-board.module').then(m=>m.TchiaDirectGameBoardPageModule)},
    {path:'games/21-garame',loadChildren:()=>import('./garame-game-board/garame-game-board.module').then(m=>m.GarameGameBoardPageModule)},
    {
        path: 'game-replay',
        loadChildren: () => import('./game-replay/game-replay.module').then(m => m.GameReplayPageModule)
    },
    {
        path: 'search',
        loadChildren: () => import('./search/search.module').then(m => m.SearchPageModule)
    },
    {
        path: 'transactions', canActivate:[authRequiredGuard],
        loadChildren: () => import('./transactions/transactions.module').then(m => m.TransactionsPageModule)
    },
    {
        path: 'help',
        loadChildren: () => import('./help/help.module').then(m => m.HelpPageModule)
    },
    {
        path: 'rules',
        loadChildren: () => import('./rules/rules.module').then(m => m.RulesPageModule)
    },
    {
        path: 'new-table',
        loadChildren: () => import('./new-table/new-table.module').then(m => m.NewTablePageModule)
    },
    {
        path: 'filter-table',
        loadChildren: () => import('./filter-table/filter-table.module').then(m => m.FilterTablePageModule)
    },
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
    },
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
    ],
    exports: [RouterModule]
})
export class AppRoutingModule { }
