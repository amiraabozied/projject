import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { LanguageRedirectGuard } from './guards/language-redirect.guard';
import { MainComponent } from './layouts/main/main.component';

export const routes: Routes = [
  {
    path: 'home',
    component: MainComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      },
      // {
      //   path: 'home',
      //   component: Home,
      // },
    
     
    ]
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [LanguageRedirectGuard],
    component: BlankComponent
  },
  {
    path: ':lang',
    children: [
      {
        path: '',
        component: FullComponent,
        children: [
          {
            path: '',
            redirectTo: 'dashboards/dashboard1',
            pathMatch: 'full',
          },
          {
            path: 'starter',
            loadChildren: () =>
              import('./pages/pages.routes').then((m) => m.PagesRoutes),
          },
          {
            path: 'dashboards',
            loadChildren: () =>
              import('./pages/dashboards/dashboards.routes').then(
                (m) => m.DashboardsRoutes
              ),
          },
          {
            path: 'forms',
            loadChildren: () =>
              import('./pages/forms/forms.routes').then((m) => m.FormsRoutes),
          },
          {
            path: 'charts',
            loadChildren: () =>
              import('./pages/charts/charts.routes').then((m) => m.ChartsRoutes),
          },
          {
            path: 'apps',
            loadChildren: () =>
              import('./pages/apps/apps.routes').then((m) => m.AppsRoutes),
          },
          {
            path: 'widgets',
            loadChildren: () =>
              import('./pages/widgets/widgets.routes').then((m) => m.WidgetsRoutes),
          },
          {
            path: 'tables',
            loadChildren: () =>
              import('./pages/tables/tables.routes').then((m) => m.TablesRoutes),
          },
          {
            path: 'datatable',
            loadChildren: () =>
              import('./pages/datatable/datatable.routes').then(
                (m) => m.DatatablesRoutes
              ),
          },
          {
            path: 'theme-pages',
            loadChildren: () =>
              import('./pages/theme-pages/theme-pages.routes').then(
                (m) => m.ThemePagesRoutes
              ),
          },
          {
            path: 'ui-components',
            loadChildren: () =>
              import('./pages/ui-components/ui-components.routes').then(
                (m) => m.UiComponentsRoutes
              ),
          },
          {
            path: 'rooms-filter',
            loadComponent: () =>
              import('./pages/rooms-filter/rooms-filter.component').then(
                (m) => m.RoomsFilterComponent
              ),
          },
        ],
      },
      {
        path: '',
        component: BlankComponent,
        children: [
          {
            path: 'authentication',
            loadChildren: () =>
              import('./pages/authentication/authentication.routes').then(
                (m) => m.AuthenticationRoutes
              ),
          },
          {
            path: 'landingpage',
            loadChildren: () =>
              import('./pages/theme-pages/landingpage/landingpage.routes').then(
                (m) => m.LandingPageRoutes
              ),
          },
        ],
      },
      {
        path: '**',
        redirectTo: 'authentication/error',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
