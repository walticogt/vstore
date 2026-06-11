import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';

import { AppUser, ROLE_LABELS, UserRole } from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';

/**
 * UsersPage — gestión de cuentas y perfiles (capability: user-management). Solo admin
 * (protegida por roleGuard). Lista/busca cuentas y asigna su perfil.
 */
@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: false,
})
export class UsersPage {
  users: AppUser[] = [];
  query = '';
  readonly roles: UserRole[] = ['admin', 'registrador', 'vendedor', 'comprador'];
  readonly labels = ROLE_LABELS;

  constructor(
    private readonly userService: UserService,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.users = this.query.trim()
      ? await this.userService.search(this.query)
      : await this.userService.list();
  }

  onSearch(): void {
    void this.reload();
  }

  /** Cambia el perfil de una cuenta (radio de roles). */
  async changeRole(user: AppUser): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Asignar perfil',
      subHeader: user.email,
      inputs: this.roles.map((r) => ({
        type: 'radio' as const,
        label: this.labels[r],
        value: r,
        checked: r === user.role,
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (role: UserRole) => {
            if (role && role !== user.role) {
              void this.userService.setRole(user.id, role).then(() => {
                void this.reload();
                void this.toast(`Perfil de ${user.email}: ${this.labels[role]}.`);
              });
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 1800 });
    await toast.present();
  }
}
