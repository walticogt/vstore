import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GenerateRoutingModule } from './generate-routing.module';
import { BatchDetailPage } from './pages/batch-detail/batch-detail.page';
import { GenerateHomePage } from './pages/generate-home/generate-home.page';

@NgModule({
  declarations: [GenerateHomePage, BatchDetailPage],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    GenerateRoutingModule,
  ],
})
export class GenerateModule {}
