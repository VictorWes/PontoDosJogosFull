import { Routes } from '@angular/router';
import { LoginViewComponent } from './views/login-view/login-view.component';
import { HomeViewComponent } from './views/home-view/home-view.component';

export const routes: Routes = [
  { path: '', component: LoginViewComponent },
  { path: 'home', component: HomeViewComponent },
];
