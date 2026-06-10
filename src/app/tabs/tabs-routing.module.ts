import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'generate',
        loadChildren: () =>
          import('../modules/generate/generate.module').then((m) => m.GenerateModule),
      },
      {
        path: 'link',
        loadChildren: () => import('../modules/link/link.module').then((m) => m.LinkModule),
      },
      {
        path: 'inventory',
        loadChildren: () =>
          import('../modules/inventory/inventory.module').then((m) => m.InventoryModule),
      },
      {
        path: '',
        redirectTo: 'generate',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
