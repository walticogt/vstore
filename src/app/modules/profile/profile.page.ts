import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';

import { SessionService } from '../../core/services/session.service';

/**
 * ProfilePage — perfil del usuario y acceso. Por ahora muestra el usuario por
 * defecto; el login (Firebase Auth) se conectará aquí en una iteración futura.
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage {
  constructor(
    private readonly session: SessionService,
    private readonly toastCtrl: ToastController,
  ) {}

  get user(): string {
    return this.session.currentUser;
  }

  async login(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'El inicio de sesión se implementará próximamente.',
      duration: 2500,
    });
    await toast.present();
  }
}
