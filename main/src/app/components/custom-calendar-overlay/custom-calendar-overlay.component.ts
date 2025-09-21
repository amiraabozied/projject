import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ElementRef, Inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import moment from 'moment-hijri';
// Using native Date and HijriDate library only

export interface CalendarSelection {
  checkIn: Date | null;
  checkOut: Date | null;
  isComplete: boolean;
  calendarType: CalendarType;
}

export interface DateDifference {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

export type CalendarType = 'gregorian' | 'hijri';

interface CalendarDay {
  date: Date;
  hijriDate?: any;
  day: number;
  hijriDay?: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isCheckIn: boolean;
  isCheckOut: boolean;
  isInRange: boolean;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

function fromHijriToGregorian(year: number, month: number, day: number): Date {
  // Simple approximation for Hijri to Gregorian conversion
  // For more accuracy, you would use a proper library
  // This is a basic calculation: Hijri year ≈ Gregorian year - 579
  const approximateGregorianYear = year + 579;
  const approximateMonth = month; // Keep the same month for simplicity
  const approximateDay = Math.min(day, 28); // Ensure valid day

  try {
    return new Date(approximateGregorianYear, approximateMonth, approximateDay);
  } catch (error) {
    // Fallback to current date if calculation fails
    return new Date();
  }
}


interface MonthYear {
  month: number;
  year: number;
  hijriMonth?: number;
  hijriYear?: number;
}

@Component({
  selector: 'app-custom-calendar-overlay',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './custom-calendar-overlay.component.html',
  styleUrls: ['./custom-calendar-overlay.component.scss']
})
export class CustomCalendarOverlayComponent implements OnInit, OnDestroy {
  @Input() checkIn: Date | null = null;
  @Input() checkOut: Date | null = null;
  @Input() minDate: Date = new Date(new Date().setHours(0, 0, 0, 0));
  @Input() maxDate: Date = new Date(new Date().getFullYear() + 1, 11, 31);
  @Input() isVisible: boolean = false;
  @Input() isInlineMode: boolean = false;

  @Output() selectionChange = new EventEmitter<CalendarSelection>();
  @Output() close = new EventEmitter<void>();

  // Calendar state - ALWAYS START WITH GREGORIAN
  calendarType: CalendarType = 'gregorian'; // Always start with Gregorian
  leftCalendar: MonthYear = { month: 0, year: 0 };
  rightCalendar: MonthYear = { month: 0, year: 0 };

  // Internal flag to force Gregorian use (for data consistency)
  private forceGregorianInternal: boolean = false;

  // Selection state
  tempCheckIn: Date | null = null;
  tempCheckOut: Date | null = null;
  selectionStep: 'check-in' | 'check-out' = 'check-in';

  // Calendar data
  leftCalendarDays: CalendarDay[] = [];
  rightCalendarDays: CalendarDay[] = [];

  // Dropdown options
  gregorianMonths: string[] = [];
  hijriMonths: string[] = [];
  years: number[] = [];
  hijriYears: number[] = [];

  // Day names
  gregorianDayNames: string[] = [];
  hijriDayNames: string[] = [];

  // Language subscription
  private langChangeSubscription: Subscription = new Subscription();

  // RTL detection
  isRTL: boolean = false;

  constructor(
    private translate: TranslateService,
    private elementRef: ElementRef,
    @Inject(DOCUMENT) private document: Document
  ) {
    // FIXED: Always initialize with Gregorian calendar
    this.calendarType = 'gregorian';
    this.initializeCalendarData();
    this.detectRTL();
  }

  /**
   * Detect RTL direction from document or current language
   */
  private detectRTL(): void {
    // Check document direction first
    const dir = this.document.documentElement.dir || this.document.body.dir;
    if (dir) {
      this.isRTL = dir === 'rtl';
      return;
    }

    // Fall back to language detection
    const currentLang = this.translate.currentLang || this.translate.getDefaultLang();
    this.isRTL = currentLang === 'ar';
  }

  ngOnInit(): void {
    // Ensure minDate is set to today at minimum
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (this.minDate < today) {
      this.minDate = today;
    }

    this.initializeCalendars();
    this.updateCalendarDisplays();

    // Subscribe to language changes
    this.langChangeSubscription = this.translate.onLangChange.subscribe(() => {
      this.detectRTL(); // Update RTL detection on language change
      this.initializeCalendarData();
      this.updateHijriCalendarDates();
      this.updateCalendarDisplays();
    });

    // Emit initial calendar type to sync with parent
    this.emitSelection();
  }

  ngOnDestroy(): void {
    this.langChangeSubscription.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isVisible && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeOverlay();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isVisible) {
      this.closeOverlay();
    }
  }

  private initializeCalendarData(): void {
    const currentLang = this.translate.currentLang || 'ar';

    // Clear existing arrays to prevent accumulation
    this.years = [];
    this.hijriYears = [];

    if (currentLang === 'ar') {
      this.gregorianMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];

      this.hijriMonths = [
        'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الثانية',
        'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
      ];

      this.gregorianDayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
      this.hijriDayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    } else {
      this.gregorianMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      this.hijriMonths = [
        'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani', 'Jumada al-awwal', 'Jumada al-thani',
        'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
      ];

      this.gregorianDayNames = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      this.hijriDayNames = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }

    // Generate years
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 2; year++) {
      this.years.push(year);
    }

    // Generate Hijri years using approximation
    const currentGregorianYear = new Date().getFullYear();
    const approximateHijriYear = Math.floor(currentGregorianYear - 577.5); // Basic conversion: 2025 ≈ 1447

    console.log('Current Hijri year (approximated):', approximateHijriYear);

    for (let year = approximateHijriYear - 1; year <= approximateHijriYear + 2; year++) {
      this.hijriYears.push(year);
    }
  }

  private initializeCalendars(): void {
    const today = new Date();

    if (this.checkIn) {
      this.tempCheckIn = new Date(this.checkIn);
      this.rightCalendar = {
        month: this.checkIn.getMonth(),
        year: this.checkIn.getFullYear()
      };
    } else {
      this.rightCalendar = {
        month: today.getMonth(),
        year: today.getFullYear()
      };
    }

    if (this.checkOut) {
      this.tempCheckOut = new Date(this.checkOut);
    }

    // Set appropriate selection step based on current state
    if (this.tempCheckIn && !this.tempCheckOut) {
      this.selectionStep = 'check-out';
    } else {
      this.selectionStep = 'check-in';
    }

    // Left calendar is always right + 1 month
    const rightDate = new Date(this.rightCalendar.year, this.rightCalendar.month, 1);
    const leftDate = new Date(rightDate.getFullYear(), rightDate.getMonth() + 1, 1);

    this.leftCalendar = {
      month: leftDate.getMonth(),
      year: leftDate.getFullYear()
    };

    // Set Hijri dates if needed
    if (this.calendarType === 'hijri') {
      this.updateHijriCalendarDates();
    }
  }

  private updateHijriCalendarDates(): void {
    try {
      // Use moment-hijri for reliable Hijri date conversion
      const rightDate = new Date(this.rightCalendar.year, this.rightCalendar.month, 1);
      const leftDate = new Date(this.leftCalendar.year, this.leftCalendar.month, 1);

      console.log('Converting Gregorian dates to Hijri:', {
        rightDate: rightDate.toISOString().split('T')[0],
        leftDate: leftDate.toISOString().split('T')[0]
      });

      // Simple approximation for Hijri date conversion
      const rightHijriYear = Math.floor(rightDate.getFullYear() - 577.5);
      const leftHijriYear = Math.floor(leftDate.getFullYear() - 577.5);

      this.rightCalendar.hijriMonth = rightDate.getMonth(); // Use same month as approximation
      this.rightCalendar.hijriYear = rightHijriYear;
      this.leftCalendar.hijriMonth = leftDate.getMonth(); // Use same month as approximation
      this.leftCalendar.hijriYear = leftHijriYear;

      console.log('Hijri conversion results:', {
        right: { month: this.rightCalendar.hijriMonth, year: this.rightCalendar.hijriYear },
        left: { month: this.leftCalendar.hijriMonth, year: this.leftCalendar.hijriYear }
      });
    } catch (error) {
      console.error('Error updating Hijri dates:', error);
    }
  }

  switchCalendarType(type: CalendarType, event?: Event): void {
    // Prevent event bubbling to avoid closing overlay
    if (event) {
      event.stopPropagation();
    }

    this.calendarType = type;
    if (type === 'hijri') {
      this.updateHijriCalendarDates();
    }
    this.updateCalendarDisplays();

    // Emit calendar type change to parent component
    this.emitSelection();
  }

  onMonthChange(calendar: 'left' | 'right', month: number, event?: Event): void {
    // Prevent event bubbling to avoid closing overlay
    if (event) {
      event.stopPropagation();
    }

    if (calendar === 'left') {
      this.leftCalendar.month = month;
    } else {
      this.rightCalendar.month = month;
    }

    if (this.calendarType === 'hijri') {
      this.updateHijriCalendarDates();
    }

    this.updateCalendarDisplays();
  }

  onYearChange(calendar: 'left' | 'right', year: number, event?: Event): void {
    // Prevent event bubbling to avoid closing overlay
    if (event) {
      event.stopPropagation();
    }

    if (calendar === 'left') {
      this.leftCalendar.year = year;
    } else {
      this.rightCalendar.year = year;
    }

    if (this.calendarType === 'hijri') {
      this.updateHijriCalendarDates();
    }

    this.updateCalendarDisplays();
  }

  onHijriMonthChange(calendar: 'left' | 'right', hijriMonth: number, event?: Event): void {
    // Prevent event bubbling to avoid closing overlay
    if (event) {
      event.stopPropagation();
    }

    try {
      if (calendar === 'left') {
        this.leftCalendar.hijriMonth = hijriMonth;
        const gregorianDate = fromHijriToGregorian(this.leftCalendar.hijriYear || 1445, hijriMonth, 1);
        this.leftCalendar.month = gregorianDate.getMonth();
        this.leftCalendar.year = gregorianDate.getFullYear();
      } else {
        this.rightCalendar.hijriMonth = hijriMonth;
        const gregorianDate = fromHijriToGregorian(this.rightCalendar.hijriYear || 1445, hijriMonth, 1);
        this.rightCalendar.month = gregorianDate.getMonth();
        this.rightCalendar.year = gregorianDate.getFullYear();
      }

      this.updateCalendarDisplays();
    } catch (error) {
      console.error('Error changing Hijri month:', error);
    }
  }

  onHijriYearChange(calendar: 'left' | 'right', hijriYear: number, event?: Event): void {
    // Prevent event bubbling to avoid closing overlay
    if (event) {
      event.stopPropagation();
    }

    try {
      if (calendar === 'left') {
        this.leftCalendar.hijriYear = hijriYear;
        const gregorianDate = fromHijriToGregorian(hijriYear, this.leftCalendar.hijriMonth || 1, 1);
        this.leftCalendar.month = gregorianDate.getMonth();
        this.leftCalendar.year = gregorianDate.getFullYear();
      } else {
        this.rightCalendar.hijriYear = hijriYear;
        const gregorianDate = fromHijriToGregorian(hijriYear, this.rightCalendar.hijriMonth || 1, 1);
        this.rightCalendar.month = gregorianDate.getMonth();
        this.rightCalendar.year = gregorianDate.getFullYear();
      }

      this.updateCalendarDisplays();
    } catch (error) {
      console.error('Error changing Hijri year:', error);
    }
  }

  private updateCalendarDisplays(): void {
    this.leftCalendarDays = this.generateCalendarDays('left');
    this.rightCalendarDays = this.generateCalendarDays('right');
  }

  private generateCalendarDays(calendar: 'left' | 'right'): CalendarDay[] {
    const calendarData = calendar === 'left' ? this.leftCalendar : this.rightCalendar;
    const days: CalendarDay[] = [];

    const firstDay = new Date(calendarData.year, calendarData.month, 1);
    const lastDay = new Date(calendarData.year, calendarData.month + 1, 0);

    // FIXED: Convert JavaScript week to Arabic week
    // JavaScript: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    // Arabic: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6

    const jsFirstDay = firstDay.getDay(); // JavaScript day number (0=Sunday, 6=Saturday)

    // Convert to Arabic positioning: (jsDay + 1) % 7
    // This maps: Sun(0)->1, Mon(1)->2, Tue(2)->3, Wed(3)->4, Thu(4)->5, Fri(5)->6, Sat(6)->0
    let startOfWeek = (jsFirstDay + 1) % 7;

    console.log('Week conversion:', {
      jsFirstDay: jsFirstDay,
      jsFirstDayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][jsFirstDay],
      arabicStartOfWeek: startOfWeek,
      arabicDayName: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][startOfWeek]
    });

    // Add previous month days to complete the first week
    const prevMonth = new Date(calendarData.year, calendarData.month - 1, 0);
    for (let i = startOfWeek - 1; i >= 0; i--) {
      const date = new Date(calendarData.year, calendarData.month - 1, prevMonth.getDate() - i);
      days.push(this.createCalendarDay(date, false));
    }

    // Add all current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(calendarData.year, calendarData.month, day);
      days.push(this.createCalendarDay(date, true));
    }

    // Calculate weeks needed to show all current month days
    const weeksNeeded = Math.ceil(days.length / 7);
    const totalDaysNeeded = Math.max(weeksNeeded * 7, 42); // Always show 6 weeks (42 days) to ensure all days are visible

    // Fill remaining days from next month
    let nextMonthDay = 1;
    while (days.length < totalDaysNeeded) {
      const date = new Date(calendarData.year, calendarData.month + 1, nextMonthDay);
      days.push(this.createCalendarDay(date, false));
      nextMonthDay++;
    }

    // Always return exactly 42 days (6 weeks) to ensure consistent layout
    return days.slice(0, 42);
  }

  private createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
    const dateToCompare = new Date(date);
    dateToCompare.setHours(0, 0, 0, 0); // Reset time for accurate comparison

    const isToday = dateToCompare.getTime() === today.getTime();
    const isDisabled = dateToCompare < this.minDate || dateToCompare > this.maxDate;

    let hijriDate: any = null;
    let hijriDay: number | undefined = undefined;

    // Always calculate Hijri date for consistency
    try {
      hijriDate = moment(date);
      hijriDay = hijriDate.iDate(); // Get Hijri day using moment-hijri

      // Debug log for the first day of month to see what's happening
      if (date.getDate() === 1) {
        console.log('Day 1 conversion:', {
          gregorian: date.toISOString().split('T')[0],
          hijriDay: hijriDay,
          hijriMonth: hijriDate.iMonth() + 1, // moment-hijri months are 0-based, add 1
          hijriYear: hijriDate.iYear()
        });
      }
    } catch (error) {
      console.error('Error creating Hijri date:', error);
      hijriDay = date.getDate(); // Fallback to Gregorian day
    }

    const isCheckIn = this.tempCheckIn && date.toDateString() === this.tempCheckIn.toDateString();
    const isCheckOut = this.tempCheckOut && date.toDateString() === this.tempCheckOut.toDateString();
    const isSelected = isCheckIn || isCheckOut;

    let isInRange = false;
    if (this.tempCheckIn && this.tempCheckOut) {
      isInRange = date > this.tempCheckIn && date < this.tempCheckOut;
    }

    return {
      date,
      hijriDate,
      day: date.getDate(),
      hijriDay,
      isCurrentMonth,
      isSelected: !!isSelected,
      isCheckIn: !!isCheckIn,
      isCheckOut: !!isCheckOut,
      isInRange,
      isRangeStart: !!isCheckIn,
      isRangeEnd: !!isCheckOut,
      isToday,
      isDisabled
    };
  }

  onDayClick(day: CalendarDay): void {
    if (day.isDisabled) return;

    if (this.selectionStep === 'check-in') {
      this.tempCheckIn = new Date(day.date);
      this.tempCheckOut = null;
      this.selectionStep = 'check-out';
    } else {
      if (this.tempCheckIn && day.date <= this.tempCheckIn) {
        // If selected date is before check-in, make it the new check-in
        this.tempCheckIn = new Date(day.date);
        this.tempCheckOut = null;
        this.selectionStep = 'check-out';
      } else {
        this.tempCheckOut = new Date(day.date);
        this.selectionStep = 'check-in';

        // Emit selection but don't auto-close
        this.emitSelection();
        // Remove auto-close - let user close manually
      }
    }

    this.updateCalendarDisplays();
  }

  private emitSelection(): void {
    const selection: CalendarSelection = {
      checkIn: this.tempCheckIn,
      checkOut: this.tempCheckOut,
      isComplete: !!(this.tempCheckIn && this.tempCheckOut),
      calendarType: 'gregorian' // FIXED: Always send gregorian type regardless of display
    };

    console.log('Emitting calendar selection:', {
      checkIn: this.tempCheckIn?.toISOString().split('T')[0],
      checkOut: this.tempCheckOut?.toISOString().split('T')[0],
      calendarType: 'gregorian',
      displayType: this.calendarType
    });

    this.selectionChange.emit(selection);
  }

  private formatHijriShort(date: Date): string {
  if (!date) return '';
  const lang = this.translate.currentLang || 'ar';

  // اسم اليوم بالميلادي
  const weekday = new Intl.DateTimeFormat(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { weekday: 'long' }
  ).format(date);

  // اليوم + الشهر هجري بدون السنة - use moment-hijri
  try {
    const hijriMoment = moment(date);
    const hijriDay = hijriMoment.iDate();
    const hijriMonth = hijriMoment.iMonth(); // 0-based month
    const hijriMonthName = this.hijriMonths[hijriMonth] || 'محرم';

    return lang === 'ar'
      ? `${weekday}، ${hijriDay} ${hijriMonthName}`
      : `${weekday}, ${hijriDay} ${hijriMonthName}`;
  } catch (error) {
    console.error('Error formatting Hijri date:', error);
    return weekday;
  }
}

getHijriAriaLabel(date: Date): string {
  return this.formatHijriShort(date);
}


  closeOverlay(): void {
    this.close.emit();
  }

  onContainerClick(event: Event): void {
    // Prevent clicks inside the container from bubbling to backdrop
    event.stopPropagation();
  }

  getDayNames(): string[] {
    const currentLang = this.translate.currentLang || 'ar';

    // Return weekday names based on current language, regardless of calendar type
    if (currentLang === 'ar') {
      return ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    } else {
      return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }
  }

  getMonthNames(): string[] {
    return this.calendarType === 'hijri' ? this.hijriMonths : this.gregorianMonths;
  }

  getYears(): number[] {
    return this.calendarType === 'hijri' ? this.hijriYears : this.years;
  }

  getCurrentMonth(calendar: 'left' | 'right'): number {
    const calendarData = calendar === 'left' ? this.leftCalendar : this.rightCalendar;
    return this.calendarType === 'hijri' ? (calendarData.hijriMonth || 0) : calendarData.month;
  }

  getCurrentYear(calendar: 'left' | 'right'): number {
    const calendarData = calendar === 'left' ? this.leftCalendar : this.rightCalendar;
    return this.calendarType === 'hijri' ? (calendarData.hijriYear || 1446) : calendarData.year; // Updated default year
  }

  getDateDifference(): DateDifference {
    if (!this.tempCheckIn || !this.tempCheckOut) {
      return { years: 0, months: 0, days: 0, totalDays: 0 };
    }

    const startDate = new Date(this.tempCheckIn);
    const endDate = new Date(this.tempCheckOut);

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    if (days < 0) {
      months--;
      const daysInPrevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
      days += daysInPrevMonth;
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months, days, totalDays };
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  getMonthYearLabel(calendar: 'left' | 'right'): string {
    const calendarData = calendar === 'left' ? this.leftCalendar : this.rightCalendar;
    const monthNames = this.getMonthNames();

    if (this.calendarType === 'hijri') {
      // Make sure we have updated Hijri dates
      this.updateHijriCalendarDates();

      const hijriMonth = calendarData.hijriMonth || 0;
      const hijriYear = calendarData.hijriYear || 1446; // Updated default year
      const monthNumber = this.getMonthNumber(calendar);

      // Debug log to see what we're getting
      console.log('Hijri month label:', {
        hijriMonth,
        hijriYear,
        monthNumber,
        monthName: monthNames[hijriMonth]
      });

      // Format: محرم (01) 1446
      return `${monthNames[hijriMonth]} (${monthNumber}) ${hijriYear}`;
    } else {
      const month = calendarData.month;
      const year = calendarData.year;
      const monthNumber = this.getMonthNumber(calendar);
      // Format: August (08) 2025
      return `${monthNames[month]} (${monthNumber}) ${year}`;
    }
  }

  getMonthNumber(calendar: 'left' | 'right'): string {
    const calendarData = calendar === 'left' ? this.leftCalendar : this.rightCalendar;
    let monthIndex: number;

    if (this.calendarType === 'hijri') {
      monthIndex = (calendarData.hijriMonth || 0) + 1;
    } else {
      monthIndex = calendarData.month + 1;
    }

    return monthIndex.toString().padStart(2, '0');
  }

  navigate(direction: 'prev' | 'next', event?: Event): void {
    // Prevent event bubbling to avoid closing overlay
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const step = direction === 'next' ? 2 : -2;

    if (this.calendarType === 'hijri') {
      // Navigate Hijri months by 2
      let rightHijriMonth = (this.rightCalendar.hijriMonth || 0) + step;
      let rightHijriYear = this.rightCalendar.hijriYear || 1445;

      // Handle year rollover for Hijri
      while (rightHijriMonth > 11) {
        rightHijriMonth -= 12;
        rightHijriYear++;
      }
      while (rightHijriMonth < 0) {
        rightHijriMonth += 12;
        rightHijriYear--;
      }

      // Left calendar is right + 1 month
      let leftHijriMonth = rightHijriMonth + 1;
      let leftHijriYear = rightHijriYear;

      if (leftHijriMonth > 11) {
        leftHijriMonth = 0;
        leftHijriYear++;
      }

      this.rightCalendar.hijriMonth = rightHijriMonth;
      this.rightCalendar.hijriYear = rightHijriYear;
      this.leftCalendar.hijriMonth = leftHijriMonth;
      this.leftCalendar.hijriYear = leftHijriYear;

      // Update Gregorian equivalents
      try {
        const rightGregorian = fromHijriToGregorian(rightHijriYear, rightHijriMonth, 1);
        this.rightCalendar.month = rightGregorian.getMonth();
        this.rightCalendar.year = rightGregorian.getFullYear();

        const leftGregorian = fromHijriToGregorian(leftHijriYear, leftHijriMonth, 1);
        this.leftCalendar.month = leftGregorian.getMonth();
        this.leftCalendar.year = leftGregorian.getFullYear();
      } catch (error) {
        console.error('Error updating Gregorian dates during navigation:', error);
      }
    } else {
      // Navigate Gregorian months by 2
      let rightMonth = this.rightCalendar.month + step;
      let rightYear = this.rightCalendar.year;

      // Handle year rollover for Gregorian
      while (rightMonth > 11) {
        rightMonth -= 12;
        rightYear++;
      }
      while (rightMonth < 0) {
        rightMonth += 12;
        rightYear--;
      }

      // Left calendar is right + 1 month
      let leftMonth = rightMonth + 1;
      let leftYear = rightYear;

      if (leftMonth > 11) {
        leftMonth = 0;
        leftYear++;
      }

      this.rightCalendar.month = rightMonth;
      this.rightCalendar.year = rightYear;
      this.leftCalendar.month = leftMonth;
      this.leftCalendar.year = leftYear;
    }

    this.updateHijriCalendarDates();
    this.updateCalendarDisplays();
  }
}
