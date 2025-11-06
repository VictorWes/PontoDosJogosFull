import { Component, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LojaService } from '../../services/loja.service';

@Component({
  selector: 'app-login-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-view.component.html',
  styleUrl: './login-view.component.css'
})
export class LoginViewComponent {
  public lojaService = inject(LojaService);
  
  // Estado local para alternar entre Login e Registro
  public isRegister: WritableSignal<boolean> = signal(false);

  // Modelos de dados para Login
  public loginData = {
    email: 'victoradmin@pontodosjogos.com', // Valor inicial para agilizar testes
    password: '123'
  };

  // Modelos de dados para Registro (adicionando campo de nome)
  public registerData = {
    name: '',
    email: '',
    password: '',
    // Endereço seria necessário para o registro completo, mas simplificaremos por agora
  };

  constructor() {}

  public async onSubmit(): Promise<void> {
    this.lojaService.error.set(null); // Limpa erros anteriores
    
    if (this.isRegister()) {
        // Se estiver no modo registro, chame o método de registro (ainda em desenvolvimento)
        alert("Função de Registro ainda em implementação. Por favor, use um usuário existente.");
        // Lógica futura: await this.lojaService.register(this.registerData);
    } else {
        // Modo Login
        if (!this.loginData.email || !this.loginData.password) {
            this.lojaService.error.set('Email e senha são obrigatórios.');
            return;
        }
        await this.lojaService.login(this.loginData.email, this.loginData.password);
    }
  }

  public toggleView(): void {
    this.isRegister.update(current => !current);
    this.lojaService.error.set(null); // Limpa erros ao trocar de view
  }
}
