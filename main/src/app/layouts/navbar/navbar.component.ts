import { Component, EventEmitter, Output, ViewEncapsulation, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CoreService } from 'src/app/services/core.service';
import { AppSettings } from 'src/app/config';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'navbar-app',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class NavbarComponent {
  public selectedLanguage: any = {
    language: 'English',
    code: 'en',
    type: 'US',
    icon: '/assets/images/flag/icon-flag-en.svg',
  }; @Output() optionsChange = new EventEmitter<AppSettings>();
  public languages: any[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: '/assets/images/flag/icon-flag-en.svg',
    },
    {
      language: 'Español',
      code: 'es',
      icon: '/assets/images/flag/icon-flag-es.svg',
    },
    {
      language: 'Français',
      code: 'fr',
      icon: '/assets/images/flag/icon-flag-fr.svg',
    },
    {
      language: 'German',
      code: 'de',
      icon: '/assets/images/flag/icon-flag-de.svg',
    },
    {
      language: 'العربية',
      code: 'ar',
      icon: '/assets/images/flag/icon-flag-es.svg',
    },
  ];
  options = this.settings.getOptions();
  constructor(
    private settings: CoreService,
    private vsidenav: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService,
    private router: Router
  ) {
    // قراءة اللغة من route prefix
    const urlSegments = this.router.url.split('/').filter(Boolean);
    let langCode = urlSegments.length > 0 ? urlSegments[0] : this.settings.getOptions().language;
    // حفظ اللغة المختارة في localStorage
    this.settings.setOptions({ language: langCode, dir: langCode === 'ar' ? 'rtl' : 'ltr' });
    this.translate.setDefaultLang(langCode);
    this.translate.use(langCode);
    this.selectedLanguage = this.languages.find(l => l.code === langCode) || this.languages[0];
    console.log(this.settings.getOptions().dir);

    // مراقبة تغييرات options من CoreService
    effect(() => {
      this.options = this.settings.getOptions();
    });
  }



  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    this.selectedLanguage = lang;
    if (lang.code === 'ar') {
      this.settings.setOptions({ language: lang.code, dir: 'rtl' }, true);
      this.options.dir = 'rtl';
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      this.settings.setOptions({ language: lang.code, dir: 'ltr' }, true);
      this.options.dir = 'ltr';
      document.documentElement.setAttribute('dir', 'ltr');
    }
    // حفظ اللغة المفضلة (هذا سيحدث تلقائياً في CoreService)
    localStorage.setItem('preferred_language', lang.code);
    localStorage.setItem('app_settings', JSON.stringify({ ...this.options, language: lang.code, dir: this.options.dir }));

    // إضافة prefix للـ URL دائماً عند التغيير اليدوي
    const urlSegments = this.router.url.split('/').filter(Boolean);
    if (urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])) {
      urlSegments[0] = lang.code;
    } else {
      urlSegments.unshift(lang.code);
    }
    const newUrl = '/' + urlSegments.join('/');
    this.router.navigateByUrl(newUrl);
  }

  // دالة جديدة لإعادة تعيين preferred language
  resetToBrowserLanguage(): void {
    this.settings.resetPreferredLanguage();
    const browserLang = this.settings.getBrowserLanguage();
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';

    // تحديث اللغة المختارة
    this.selectedLanguage = this.languages.find(l => l.code === lang) || this.languages[0];
    this.translate.use(lang);

    // تحديث الاتجاه
    if (lang === 'ar') {
      this.options.dir = 'rtl';
    } else {
      this.options.dir = 'ltr';
    }

    // إعادة توجيه
    this.router.navigateByUrl('/' + lang);
  }



  private emitOptions() {
    this.optionsChange.emit(this.options);
  }

  setlightDark(theme: string) {
    this.options.theme = theme;
    this.emitOptions();
  }

}
