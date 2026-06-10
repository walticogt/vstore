import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../../shared/shared.module';
import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryListPage } from './pages/inventory-list/inventory-list.page';
import { ProductDetailPage } from './pages/product-detail/product-detail.page';
import { ProductEditPage } from './pages/product-edit/product-edit.page';
import { RelinkPage } from './pages/relink/relink.page';
import { ScanLookupPage } from './pages/scan-lookup/scan-lookup.page';

@NgModule({
  declarations: [
    InventoryListPage,
    ProductDetailPage,
    ProductEditPage,
    ScanLookupPage,
    RelinkPage,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    InventoryRoutingModule,
  ],
})
export class InventoryModule {}
