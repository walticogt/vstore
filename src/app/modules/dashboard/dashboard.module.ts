import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { DashboardPage } from './dashboard.page';

@NgModule({
  declarations: [DashboardPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DashboardPage }]),
  ],
})
export class DashboardPageModule {}
