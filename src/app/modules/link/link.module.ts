import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { LinkRoutingModule } from './link-routing.module';
import { LinkFormPage } from './pages/link-form/link-form.page';
import { ScanPage } from './pages/scan/scan.page';

@NgModule({
  declarations: [ScanPage, LinkFormPage],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, LinkRoutingModule],
})
export class LinkModule {}
