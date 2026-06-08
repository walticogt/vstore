import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BatchDetailPage } from './pages/batch-detail/batch-detail.page';
import { GenerateHomePage } from './pages/generate-home/generate-home.page';

const routes: Routes = [
  { path: '', component: GenerateHomePage },
  { path: 'batch/:id', component: BatchDetailPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GenerateRoutingModule {}
