import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LinkFormPage } from './pages/link-form/link-form.page';
import { ScanPage } from './pages/scan/scan.page';

const routes: Routes = [
  { path: '', component: ScanPage },
  { path: 'form/:tagId', component: LinkFormPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LinkRoutingModule {}
