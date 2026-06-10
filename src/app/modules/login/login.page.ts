import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { SessionService } from '../../core/services/session.service';

/**
 * LoginPage — acceso a la app. Credenciales por defecto: admin / admin.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  email = '';
  password = '';
  showPassword = false;

  constructor(
    private readonly session: SessionService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
  ) {}

  async ingresar(): Promise<void> {
    if (this.session.login(this.email, this.password)) {
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } else {
      await this.showToast('Credenciales incorrectas. Prueba admin / admin.');
    }
  }

  async forgotPassword(): Promise<void> {
    await this.showToast('Recuperación de contraseña próximamente. Usa admin / admin.');
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color: 'danger', duration: 2500 });
    await toast.present();
  }
}
