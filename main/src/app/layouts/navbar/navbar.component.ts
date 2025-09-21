import { Component, ViewEncapsulation, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CoreService } from 'src/app/services/core.service';
import { AppSettings } from 'src/app/config';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'navbar-app',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class NavbarComponent {
  public selectedLanguage: any;
  public languages: any[] = [
    { language: 'English', code: 'en', icon: '/assets/images/flag/icon-flag-en.svg' },
    { language: 'العربية', code: 'ar', icon: '/assets/images/flag/icon-flag-es.svg' },
  ];

  options = this.settings.getOptions();
  private htmlElement!: HTMLHtmlElement;

  constructor(
    private settings: CoreService,
    private translate: TranslateService,
    private router: Router
  ) {
    this.htmlElement = document.querySelector('html')!;

    // قراءة اللغة من ال URL إن وجدت، وإلا من الإعدادات
    const urlSegments = this.router.url.split('/').filter(Boolean);
    const initial = this.settings.getOptions();
    const urlLang = urlSegments.length > 0 ? urlSegments[0] : initial.language;
    const langCode = ['ar', 'en'].includes(urlLang) ? urlLang : 'en';

    this.settings.setOptions({ language: langCode, dir: langCode === 'ar' ? 'rtl' : 'ltr' });
    this.translate.setDefaultLang(langCode);
    this.translate.use(langCode);
    this.selectedLanguage = this.languages.find(l => l.code === langCode) || this.languages[0];

    // sync UI options when CoreService updates
    effect(() => {
      this.options = this.settings.getOptions();
      this.toggleDarkTheme(this.options);
    });
  }

  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    this.selectedLanguage = lang;

    if (lang.code === 'ar') {
      this.settings.setOptions({ language: lang.code, dir: 'rtl' }, true);
      this.options.dir = 'rtl';
    } else {
      this.settings.setOptions({ language: lang.code, dir: 'ltr' }, true);
      this.options.dir = 'ltr';
    }

    localStorage.setItem('preferred_language', lang.code);
    localStorage.setItem('app_settings', JSON.stringify({ ...this.options, language: lang.code, dir: this.options.dir }));

    // إصلاح التوجيه لتجنب صفحة الخطأ عند تغيير اللغة من النافبار
    const currentUrl = this.router.url;
    const urlSegments = currentUrl.split('/').filter(Boolean);
    
    // إذا كان المستخدم في صفحة /home، ابق فيها مع تغيير اللغة
    if (currentUrl === '/home' || currentUrl.includes('/home')) {
      // إذا كان في صفحة /home، ابق فيها ولا تغير الرابط
      // فقط حدث اللغة في localStorage والـ settings
      return;
    }
    
    // إذا كان في صفحة أخرى، غيّر اللغة مع الحفاظ على الصفحة
    if (urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])) {
      urlSegments[0] = lang.code;
    } else {
      urlSegments.unshift(lang.code);
    }
    const newUrl = '/' + urlSegments.join('/');
    this.router.navigateByUrl(newUrl);
  }

  resetToBrowserLanguage(): void {
    this.settings.resetPreferredLanguage();
    const browserLang = this.settings.getBrowserLanguage();
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';

    this.selectedLanguage = this.languages.find(l => l.code === lang) || this.languages[0];
    this.translate.use(lang);
    this.options.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // إذا كان في صفحة /home، ابق فيها
    const currentUrl = this.router.url;
    if (currentUrl === '/home' || currentUrl.includes('/home')) {
      return;
    }
    
    this.router.navigateByUrl('/' + lang);
  }

  setlightDark(theme: string) {
    // guard invalid theme values
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    // persist through CoreService (will also update localStorage when manual=true)
    this.settings.setOptions({ theme: nextTheme }, true);
    // apply immediately
    const current = this.settings.getOptions();
    this.options.theme = nextTheme; // تحديث محلي للثيم
    this.toggleDarkTheme(current);
  }

  private toggleDarkTheme(options: AppSettings) {
    if (!this.htmlElement) return;
    if (options.theme === 'dark') {
      this.htmlElement.classList.add('dark-theme');
      this.htmlElement.classList.remove('light-theme');
    } else {
      this.htmlElement.classList.remove('dark-theme');
      this.htmlElement.classList.add('light-theme');
    }
  }
}
