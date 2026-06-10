import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

/**
 * CameraScannerComponent — escáner de QR/barras vía cámara del navegador (ZXing).
 * Lee del stream de video y emite el código al detectarlo. Se usa en web, donde el
 * plugin nativo ML Kit no está disponible.
 */
@Component({
  selector: 'app-camera-scanner',
  templateUrl: './camera-scanner.component.html',
  styleUrls: ['./camera-scanner.component.scss'],
  standalone: false,
})
export class CameraScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @Output() scanned = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  error = '';

  private readonly reader = new BrowserMultiFormatReader();
  private controls?: IScannerControls;

  async ngAfterViewInit(): Promise<void> {
    try {
      this.controls = await this.reader.decodeFromVideoDevice(
        undefined,
        this.videoRef.nativeElement,
        (result, _err, controls) => {
          if (result) {
            controls.stop();
            this.scanned.emit(result.getText());
          }
        },
      );
    } catch (err) {
      console.error('[CameraScanner] No se pudo iniciar la cámara:', err);
      this.error = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
    }
  }

  cancel(): void {
    this.controls?.stop();
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.controls?.stop();
  }
}
