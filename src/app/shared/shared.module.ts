import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { CameraScannerComponent } from './components/camera-scanner/camera-scanner.component';
import { CodeImageComponent } from './components/code-image/code-image.component';
import { PhotoPickerComponent } from './components/photo-picker/photo-picker.component';

/**
 * SharedModule — componentes reutilizables entre módulos de funcionalidad.
 */
@NgModule({
  declarations: [CameraScannerComponent, CodeImageComponent, PhotoPickerComponent],
  imports: [CommonModule, IonicModule],
  exports: [CameraScannerComponent, CodeImageComponent, PhotoPickerComponent],
})
export class SharedModule {}
