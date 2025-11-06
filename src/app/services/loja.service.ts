import { computed, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// =====================================================================
// INTERFACES (Models) - Usamos interfaces para definir o contrato dos DTOs do Backend
// =====================================================================

export interface ProdutoResponse {
  id: number;
  nome: string;
  descricao: string;
  preco: number; 
  quantidadeEmEstoque: number;
  adicionando?: boolean; // Estado de UI
}

export interface ItemCarrinhoResponse {
  id: number;
  produtoId: number;
  nomeProduto: string;
  quantidade: number;
  precoUnitarioNaCompra: number;
  subtotal: number;
}

export interface CarrinhoResponse {
  id: number;
  status: string;
  dataCriacao: string;
  itens: ItemCarrinhoResponse[];
  totalCarrinho: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ItemCarrinhoRequest {
    produtoId: number;
    quantidade: number;
}

export type ViewType = 'login' | 'catalogo' | 'carrinho';


@Injectable({
  providedIn: 'root'
})
export class LojaService {
  private http = inject(HttpClient);

  // URL base para o seu Spring Boot (ajuste a porta se necessário)
  private API_BASE_URL = 'http://localhost:8080/api';

  // =====================================================================
  // ESTADO GLOBAL (SIGNALS - Angular 17+)
  // =====================================================================

  // Estado do Token JWT (lido do localStorage)
  private token: WritableSignal<string | null> = signal(localStorage.getItem('jwt_token'));

  // Controle de visualização
  public view: WritableSignal<ViewType> = signal(this.token() ? 'catalogo' : 'login');
  public loading: WritableSignal<boolean> = signal(false);
  public error: WritableSignal<string | null> = signal(null);

  // Dados da Aplicação
  public produtos: WritableSignal<ProdutoResponse[]> = signal([]);
  public carrinho: WritableSignal<CarrinhoResponse | null> = signal(null);

  // Campos Computados (derivados do estado principal)
  public autenticado = computed(() => !!this.token());
  public carrinhoItemCount = computed(() => 
    this.carrinho()?.itens.reduce((acc, item) => acc + item.quantidade, 0) || 0
  );

  constructor() {
    // Tenta carregar produtos e carrinho ao iniciar, se o token estiver salvo
    if (this.autenticado()) {
      this.loadProdutos();
      this.loadCarrinho();
    }
  }

  // =====================================================================
  // FUNÇÕES AUXILIARES (HEADERS)
  // =====================================================================

  private getAuthHeaders(): HttpHeaders {
    const token = this.token();
    if (!token) {
      // Isso é tratado pela lógica de segurança, mas é uma verificação de fallback
      throw new Error('Usuário não autenticado. Token JWT ausente.');
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Tratamento genérico de erros da API
  private handleApiError(err: any, defaultMsg: string): string {
    this.loading.set(false);
    let errorMessage = defaultMsg;
    // Tenta extrair a mensagem de erro do backend Spring
    if (err.error && typeof err.error === 'string') {
        errorMessage = err.error; 
    } else if (err.error && err.error.message) {
        errorMessage = err.error.message;
    } else if (err.status === 401 || err.status === 403) {
        errorMessage = "Sessão expirada ou acesso negado. Faça login novamente.";
        this.logout(); // Força o logout em caso de token inválido/expirado
    }
    this.error.set(errorMessage);
    return errorMessage;
  }

  // =====================================================================
  // FLUXO DE AUTENTICAÇÃO
  // =====================================================================

  public async login(email: string, password: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const request: LoginRequest = { email, password };
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.API_BASE_URL}/auth/login`, request)
      );

      this.token.set(response.token);
      localStorage.setItem('jwt_token', response.token);
      
      // Sucesso no login
      this.view.set('catalogo');
      await this.loadProdutos();
      await this.loadCarrinho(); // Tenta carregar o carrinho do usuário
      alert('Login realizado com sucesso!');

    } catch (e: any) {
      this.handleApiError(e, 'Falha no login. Verifique as credenciais.');
      this.token.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  public logout(): void {
    this.token.set(null);
    localStorage.removeItem('jwt_token');
    this.view.set('login');
    this.carrinho.set(null);
    this.produtos.set([]);
    this.error.set(null);
  }
  
  // =====================================================================
  // FLUXO DE DADOS
  // =====================================================================

  public async loadProdutos(): Promise<void> {
    if (!this.autenticado()) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      // Rotas GET não precisam do Content-Type no header se não houver body
      const headers = this.getAuthHeaders().delete('Content-Type'); 
      const produtosList = await firstValueFrom(
        this.http.get<ProdutoResponse[]>(`${this.API_BASE_URL}/produtos`, { headers: headers })
      );
      this.produtos.set(produtosList);
    } catch (e) {
      this.handleApiError(e, 'Erro ao carregar o catálogo de produtos.');
      this.produtos.set([]);
    } finally {
      this.loading.set(false);
    }
  }
  
  public async loadCarrinho(): Promise<void> {
    if (!this.autenticado()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const headers = this.getAuthHeaders().delete('Content-Type');
      const carrinhoData = await firstValueFrom(
        this.http.get<CarrinhoResponse>(`${this.API_BASE_URL}/carrinho`, { headers: headers })
      );
      this.carrinho.set(carrinhoData);
    } catch (e: any) {
       // Se o carrinho não for encontrado (404/403) ou erro no servidor
       if (e.status === 404) {
           // Inicializa o carrinho como vazio/novo para evitar erros de null
           this.carrinho.set({ id: 0, status: 'NOVO', dataCriacao: '', itens: [], totalCarrinho: 0 });
       } else {
           this.handleApiError(e, 'Erro ao carregar o carrinho.');
           this.carrinho.set(null);
       }
    } finally {
      this.loading.set(false);
    }
  }
  
  public async adicionarItem(produtoId: number, quantidade: number = 1): Promise<void> {
    if (!this.autenticado()) return;
    
    // Indica que a ação está em andamento na UI (melhora a UX)
    const produtoIndex = this.produtos().findIndex(p => p.id === produtoId);
    if (produtoIndex !== -1) {
        this.produtos.update(current => {
            current[produtoIndex].adicionando = true;
            return [...current];
        });
    }

    this.error.set(null);
    try {
      // DTO minimalista: envia apenas o ID e a quantidade
      const request: ItemCarrinhoRequest = { produtoId, quantidade }; 
      
      const headers = this.getAuthHeaders();
      const carrinhoAtualizado = await firstValueFrom(
        this.http.post<CarrinhoResponse>(`${this.API_BASE_URL}/carrinho/item`, request, { headers })
      );

      this.carrinho.set(carrinhoAtualizado);
      alert(`Produto ID ${produtoId} adicionado ao carrinho!`);

    } catch (e) {
      this.handleApiError(e, 'Falha ao adicionar item ao carrinho.');
    } finally {
        // Limpa o estado de UI
        if (produtoIndex !== -1) {
            this.produtos.update(current => {
                current[produtoIndex].adicionando = false;
                return [...current];
            });
        }
    }
  }
  
  public async removerItem(itemId: number): Promise<void> {
    if (!this.autenticado()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
        const headers = this.getAuthHeaders().delete('Content-Type');
        // DELETE /api/carrinho/item/{itemId}
        await firstValueFrom(
            this.http.delete(`${this.API_BASE_URL}/carrinho/item/${itemId}`, { headers })
        );
        // Recarrega o carrinho para refletir a remoção
        await this.loadCarrinho();
        alert('Item removido com sucesso!');

    } catch (e) {
        this.handleApiError(e, 'Falha ao remover item do carrinho.');
    } finally {
        this.loading.set(false);
    }
  }
  
  // Alterna as views
  public navigateTo(view: ViewType): void {
      this.view.set(view);
      this.error.set(null);
  }
}