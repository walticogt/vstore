import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

/**
 * PhotoPickerComponent — captura/seleccione hasta `max` fotos. En móvil abre la cámara
 * o galería; en escritorio, el selector de archivos. Cada foto se redimensiona y se
 * guarda como dataURL base64 LIVIANO (≈480px, referencial) para SQLite local y para que
 * sea ligero de sincronizar. El dueño conserva su foto original aparte. Two-way: [(photos)].
 */
@Component({
  selector: 'app-photo-picker',
  templateUrl: './photo-picker.component.html',
  styleUrls: ['./photo-picker.component.scss'],
  standalone: false,
})
export class PhotoPickerComponent {
  @Input() photos: string[] = [];
  @Output() photosChange = new EventEmitter<string[]>();
  @Input() max = 3;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  loading = false;

  /** Índices de los espacios fijos (0..max-1). */
  get slots(): number[] {
    return Array.from({ length: this.max }, (_, i) => i);
  }

  /** Estado de cada espacio: foto cargada, cargando, botón agregar, o vacío. */
  slotState(i: number): 'photo' | 'loading' | 'add' | 'empty' {
    if (this.photos[i]) {
      return 'photo';
    }
    if (i === this.photos.length) {
      return this.loading ? 'loading' : 'add';
    }
    return 'empty';
  }

  trigger(): void {
    this.fileInput.nativeElement.click();
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.loading = true;
      try {
        const dataUrl = await this.resize(file, 480, 0.55);
        const next = [...this.photos, dataUrl].slice(0, this.max);
        this.photos = next;
        this.photosChange.emit(next);
      } catch (err) {
        console.error('[PhotoPicker] Error procesando imagen:', err);
      } finally {
        this.loading = false;
      }
    }
    input.value = '';
  }

  remove(index: number): void {
    const next = this.photos.filter((_, i) => i !== index);
    this.photos = next;
    this.photosChange.emit(next);
  }

  /** Redimensiona la imagen a `maxSize` px (lado mayor) y la devuelve como JPEG base64. */
  private resize(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width >= height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo procesar la imagen.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
