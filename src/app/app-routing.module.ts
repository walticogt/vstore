import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./modules/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardPageModule)
  },
  {
    path: 'sync',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/sync/sync.module').then(m => m.SyncPageModule)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/settings/settings.module').then(m => m.SettingsPageModule)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/profile/profile.module').then(m => m.ProfilePageModule)
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
