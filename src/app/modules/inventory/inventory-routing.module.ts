import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InventoryListPage } from './pages/inventory-list/inventory-list.page';
import { ProductDetailPage } from './pages/product-detail/product-detail.page';
import { ProductEditPage } from './pages/product-edit/product-edit.page';
import { RelinkPage } from './pages/relink/relink.page';
import { ScanLookupPage } from './pages/scan-lookup/scan-lookup.page';

const routes: Routes = [
  { path: '', component: InventoryListPage },
  { path: 'scan', component: ScanLookupPage },
  { path: 'product/:id', component: ProductDetailPage },
  { path: 'product/:id/edit', component: ProductEditPage },
  { path: 'product/:id/relink/:variantId', component: RelinkPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InventoryRoutingModule {}
