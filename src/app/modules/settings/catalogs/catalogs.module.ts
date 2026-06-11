import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { CatalogsPage } from './catalogs.page';
import { SupplierEditPage } from './supplier-edit.page';

@NgModule({
  declarations: [CatalogsPage, SupplierEditPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([
      { path: '', component: CatalogsPage },
      { path: 'supplier/:id', component: SupplierEditPage },
    ]),
  ],
})
export class CatalogsPageModule {}
