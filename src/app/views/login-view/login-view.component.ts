import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-login-view',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent],
  templateUrl: './login-view.component.html',
  styleUrls: ['./login-view.component.css']
})
export class LoginViewComponent {
  email: string = '';
  password: string = '';

  onLogin() {
    if (this.email && this.password) {
      console.log('Login:', {
        email: this.email,
        password: this.password
      });
      // Aqui você pode adicionar a lógica de autenticação
    }
  }
}
