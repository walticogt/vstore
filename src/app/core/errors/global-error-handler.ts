import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ToastController } from '@ionic/angular';

/**
 * Manejo global de errores no controlados (capability transversal del pulido MVP).
 * Registra el error en consola y muestra un toast discreto al usuario. Usa Injector
 * de forma diferida para evitar dependencias circulares en el arranque.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private lastToastAt = 0;

  constructor(private readonly injector: Injector) {}

  handleError(error: unknown): void {
    // Siempre deja traza en consola para depurar.
    console.error('[VStore] Error no controlado:', error);

    // Evita spam de toasts si se disparan muchos errores seguidos (máx. 1 cada 3s).
    const now = Date.now();
    if (now - this.lastToastAt < 3000) {
      return;
    }
    this.lastToastAt = now;

    const toastCtrl = this.injector.get(ToastController);
    void toastCtrl
      .create({
        message: 'Ocurrió un error inesperado.',
        color: 'danger',
        duration: 3000,
        position: 'bottom',
      })
      .then((toast) => toast.present());
  }
}
