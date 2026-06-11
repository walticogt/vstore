import { Component, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { SessionService } from '../../core/services/session.service';

/**
 * LoginPage — acceso a la app: login local (admin / admin) o "Iniciar con Google" (Gmail).
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
  loadingGoogle = false;

  constructor(
    private readonly session: SessionService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly auth: Auth,
    private readonly injector: EnvironmentInjector,
  ) {}

  async ingresar(): Promise<void> {
    if (this.session.login(this.email, this.password)) {
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } else {
      await this.showToast('Credenciales incorrectas. Prueba admin / admin.');
    }
  }

  /** Inicia sesión con Google (Gmail). Crea/recupera la cuenta y aplica su perfil. */
  async loginGoogle(): Promise<void> {
    if (this.loadingGoogle) {
      return;
    }
    this.loadingGoogle = true;
    try {
      const cred = await runInInjectionContext(this.injector, () =>
        signInWithPopup(this.auth, new GoogleAuthProvider()),
      );
      const email = cred.user.email ?? '';
      if (!email) {
        await this.showToast('La cuenta de Google no tiene correo.');
        return;
      }
      await this.session.establishGoogleSession(cred.user.uid, email);
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch (err) {
      console.error('[Login] Error con Google:', err);
      await this.showToast('No se pudo iniciar con Google. Verifica que esté habilitado en Firebase.');
    } finally {
      this.loadingGoogle = false;
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
