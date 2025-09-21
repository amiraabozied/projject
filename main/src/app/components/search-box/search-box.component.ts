import { Component, EventEmitter, Output, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, ElementRef, ViewChild, Inject, ChangeDetectorRef } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule, MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { provideNativeDateAdapter, DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatDateRangeSelectionStrategy, DateRange, MAT_DATE_RANGE_SELECTION_STRATEGY } from '@angular/material/datepicker';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, BehaviorSubject, combineLatest, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith, map } from 'rxjs/operators';
// moment-hijri removed - using HijriDate library instead
import { CustomCalendarOverlayComponent, CalendarSelection, CalendarType } from '../custom-calendar-overlay/custom-calendar-overlay.component';
import { LocationSuggestion, LocationType } from './models/location-suggestion.model';
import * as HijriDateRaw from 'hijri-date';
const HijriDate: any = (HijriDateRaw as any).default || HijriDateRaw;

// Custom date range selection strategy for step-based selection
export class StepBasedDateRangeSelectionStrategy<D> implements MatDateRangeSelectionStrategy<D> {
  private _checkInDate: D | null = null;
  private _isSelectingCheckOut = false;

  constructor(private _dateAdapter: DateAdapter<D>) {}

  selectionFinished(date: D | null, currentRange: DateRange<D>): DateRange<D> {
    if (!this._checkInDate) {
      // First step: selecting check-in date
      this._checkInDate = date;
      this._isSelectingCheckOut = true;
      return new DateRange<D>(date, null);
    } else {
      // Second step: selecting check-out date
      if (date && this._dateAdapter.compareDate(date, this._checkInDate) >= 0) {
        const result = new DateRange<D>(this._checkInDate, date);
        this._reset();
        return result;
      } else {
        // If selected date is before check-in, reset and start over
        this._checkInDate = date;
        this._isSelectingCheckOut = true;
        return new DateRange<D>(date, null);
      }
    }
  }

  createPreview(activeDate: D | null, currentRange: DateRange<D>): DateRange<D> {
    if (this._checkInDate && activeDate) {
      // Show preview range from check-in to hovered date
      if (this._dateAdapter.compareDate(activeDate, this._checkInDate) >= 0) {
        return new DateRange<D>(this._checkInDate, activeDate);
      }
    }
    return currentRange;
  }

  private _reset(): void {
    this._checkInDate = null;
    this._isSelectingCheckOut = false;
  }

  // Public method to reset the strategy
  reset(): void {
    this._reset();
  }

  // Public method to check current step
  isSelectingCheckOut(): boolean {
    return this._isSelectingCheckOut;
  }

  // Public method to get check-in date
  getCheckInDate(): D | null {
    return this._checkInDate;
  }
}

interface Child {
  age: number;
}

interface BedType {
  type: string;
  quantity: number;
}

interface Room {
  adults: number;
  childrenCount: number;
  bedTypes: BedType[];
  children: Child[];
}

interface SearchFormData {
  splCode: string;
  checkIn: string;
  checkOut: string;
  rooms: Room[];
}

interface QuickFillOption {
  rooms: number;
  adults: number;
  children: number;
}

// Confirmation dialog data interface
interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatMenuModule,
    MatChipsModule,
    MatBadgeModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatAutocompleteModule,
    TranslateModule,
    CustomCalendarOverlayComponent
  ],
  providers: [
    provideNativeDateAdapter(),
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: StepBasedDateRangeSelectionStrategy,
      deps: [DateAdapter]
    }
  ],
  templateUrl: './search-box.component.html',
  styleUrl: './search-box.component.scss',
  animations: [
    // Almosafer-style popup animation
    trigger('almosaferSlideIn', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(-15px) scale(0.95)'
        }),
        animate('200ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({
          opacity: 1,
          transform: 'translateY(0) scale(1)'
        }))
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({
          opacity: 0,
          transform: 'translateY(-10px) scale(0.95)'
        }))
      ])
    ])
    // slideDown animation removed - using almosaferSlideIn for calendar too
  ]
})
export class SearchBoxComponent implements OnInit, OnDestroy, OnChanges {
  @Input() searchData: SearchFormData | null = null;
  @Output() searchFormSubmit = new EventEmitter<SearchFormData>();
  @ViewChild('guestTrigger', { static: false }) guestTrigger!: ElementRef;
  @ViewChild('guestPanel', { static: false }) guestPanel!: ElementRef;
  @ViewChild('dateField', { static: false }) dateField!: ElementRef;
  @ViewChild(MatAutocompleteTrigger) locTrigger!: MatAutocompleteTrigger;

  searchForm!: FormGroup;
  isGuestDropdownOpen = false;
  isGuestPanelOpen = false; // New property for floating panel
  showMoreBedOptions = false;
  showMoreOptions = false; // Toggle for expanded form
  selectedGuestOption = 'option1'; // Default selection

  // Store original form state for cancel functionality
  private originalFormState: any = null;

  // Date range picker properties
  minDate: Date;
  maxDate: Date;
  customHeader: any = null; // Will be set if needed

  // Step-based date selection state
  dateSelectionStep: 'check-in' | 'check-out' = 'check-in';
  selectedCheckInDate: Date | null = null;
  isDatePickerOpen = false;

  // Animation trigger for nights badge
  nightsAnimationTrigger = false;

  // Hijri calendar support
  showHijri = false;

  // Custom calendar overlay
  isCustomCalendarVisible = false;
  isInlineCalendarOpen = false;
  currentCalendarType: CalendarType = 'gregorian';
  
  // REMOVED: Duplicate properties - using getters instead

  // Language change subscription
  private langSub?: Subscription;
  private checkInSub?: Subscription;
  private checkOutSub?: Subscription;

  // Location autocomplete properties
  recentSuggestions: LocationSuggestion[] = [];
  popularSuggestions: LocationSuggestion[] = [];
  private seedLoaded = false;

  // IMPORTANT: reuse the existing control from the form
  get splCtrl() { return this.searchForm.get('splCode')!; }

  get query$() {
    return this.splCtrl?.valueChanges.pipe(
      startWith(this.splCtrl?.value ?? ''),
      debounceTime(200),
      distinctUntilChanged()
    ) || of('');
  }

  get suggestions$() {
    return this.query$.pipe(
      switchMap(q => this.fetchSuggestions(typeof q === 'string' ? q : ''))
    );
  }

  // Expose Math to template
  Math = Math;

  // Bed types configuration
  basicBedTypes = ['single', 'double'];
  advancedBedTypes = ['king', 'superKing', 'bunk', 'sofa', 'futon'];

  adultOptions = [1, 2, 3, 4, 5];
  childrenOptions = [0, 1, 2, 3, 4];
  ageOptions = Array.from({ length: 12 }, (_, i) => i); // 0-11

  // Quick fill options
  quickFillOptions: QuickFillOption[] = [
    { rooms: 1, adults: 2, children: 0 },
    { rooms: 1, adults: 1, children: 1 }
  ];

  constructor(
    private fb: FormBuilder,
    private translate: TranslateService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DATE_RANGE_SELECTION_STRATEGY) private dateRangeStrategy: StepBasedDateRangeSelectionStrategy<Date>
  ) {
    // Initialize date range constraints
    this.minDate = new Date(); // Today
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 1); // One year from today
  }

  ngOnInit(): void {
    // Form initialization handled in initializeForm()
    console.log('ngOnInit - Starting initialization');
    this.initializeForm();

    // Subscribe to form value changes for logging
    this.checkInSub = this.searchForm.get('checkIn')?.valueChanges.subscribe(value => {
      if (value) {
        console.log('checkIn updated:', new Date(value));
      }
    });
    
    this.checkOutSub = this.searchForm.get('checkOut')?.valueChanges.subscribe(value => {
      if (value) {
        console.log('checkOut updated:', new Date(value));
      }
    });

    // Subscribe to language changes for date formatting updates
    this.langSub = this.translate.onLangChange.subscribe(() => {
      // No manual mutation needed; bindings will re-evaluate
      // Update form validation to refresh error messages
      this.searchForm.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchData'] && changes['searchData'].currentValue && this.searchForm) {
      this.populateFormWithSearchData(changes['searchData'].currentValue);
    }
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.checkInSub?.unsubscribe();
    this.checkOutSub?.unsubscribe();
  }

  initializeForm(): void {
    // Set default dates
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Use input data if available, otherwise use defaults
    const defaultData = this.searchData || {
      splCode: '',
      checkIn: today.toISOString(),
      checkOut: tomorrow.toISOString(),
      rooms: [{
        adults: 2,
        childrenCount: 0,
        bedTypes: [],
        children: []
      }]
    };

    this.searchForm = this.fb.group({
      splCode: [defaultData.splCode, [Validators.required, Validators.minLength(3)]],
      checkIn: [new Date(defaultData.checkIn), Validators.required],
      checkOut: [new Date(defaultData.checkOut), Validators.required],
      rooms: this.fb.array(defaultData.rooms.map(room => this.createRoomFormGroupFromData(room)))
    });
    
    // Form values are set above, getters will access them
    console.log('initializeForm - Set dates:', { 
      checkIn: new Date(defaultData.checkIn).toISOString().split('T')[0], 
      checkOut: new Date(defaultData.checkOut).toISOString().split('T')[0] 
    });
  }

  private createRoomFormGroup(): FormGroup {
    return this.fb.group({
      adults: [2, [Validators.required, Validators.min(1), Validators.max(5)]],
      childrenCount: [0, [Validators.required, Validators.min(0), Validators.max(4)]],
      bedTypes: this.fb.array([]),
      children: this.fb.array([])
    });
  }

  private createRoomFormGroupFromData(roomData: any): FormGroup {
    const roomGroup = this.fb.group({
      adults: [roomData.adults || 2, [Validators.required, Validators.min(1), Validators.max(5)]],
      childrenCount: [roomData.childrenCount || 0, [Validators.required, Validators.min(0), Validators.max(4)]],
      bedTypes: this.fb.array((roomData.bedTypes || []).map((bed: any) => this.createBedTypeFormGroup(bed.type, bed.quantity))),
      children: this.fb.array((roomData.children || []).map((child: any) => this.createChildFormGroupFromData(child)))
    });

    return roomGroup;
  }

  private createChildFormGroupFromData(childData: any): FormGroup {
    return this.fb.group({
      age: [childData.age || 0, [Validators.required, Validators.min(0), Validators.max(11)]]
    });
  }

  private populateFormWithSearchData(searchData: SearchFormData): void {
    if (!this.searchForm) return;

    // Update basic fields
    this.searchForm.patchValue({
      splCode: searchData.splCode,
      checkIn: new Date(searchData.checkIn),
      checkOut: new Date(searchData.checkOut)
    });

    // Clear existing rooms
    const roomsArray = this.rooms;
    while (roomsArray.length !== 0) {
      roomsArray.removeAt(0);
    }

    // Add rooms from search data
    searchData.rooms.forEach(roomData => {
      roomsArray.push(this.createRoomFormGroupFromData(roomData));
    });
  }

  private createChildFormGroup(): FormGroup {
    return this.fb.group({
      age: [0, [Validators.required, Validators.min(0), Validators.max(11)]]
    });
  }

  private createBedTypeFormGroup(type: string, quantity: number = 1): FormGroup {
    return this.fb.group({
      type: [type, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]]
    });
  }

  get rooms(): FormArray {
    return this.searchForm.get('rooms') as FormArray;
  }

  getRoomChildren(roomIndex: number): FormArray {
    return this.rooms.at(roomIndex).get('children') as FormArray;
  }

  getRoomBedTypes(roomIndex: number): FormArray {
    return this.rooms.at(roomIndex).get('bedTypes') as FormArray;
  }

  // Guest summary calculation
  getTotalGuests(): { rooms: number; adults: number; children: number } {
    const rooms = this.rooms.value;
    return {
      rooms: rooms.length,
      adults: rooms.reduce((sum: number, room: any) => sum + room.adults, 0),
      children: rooms.reduce((sum: number, room: any) => sum + room.childrenCount, 0)
    };
  }

  getGuestSummaryText(): string {
    const totals = this.getTotalGuests();
    const currentLang = this.translate.currentLang || 'ar';

    if (currentLang === 'ar') {
      // Use the same Arabic localization logic as getGuestSummary
      const roomText = this.getArabicRoomText(totals.rooms);
      const adultText = this.getArabicAdultText(totals.adults);
      const childText = this.getArabicChildText(totals.children);

      // Always show all counts including zeros in Arabic
      return `${totals.rooms} ${roomText}، ${totals.adults} ${adultText}، ${totals.children} ${childText}`;
    } else {
      // English fallback using translation keys
      const params = {
        rooms: totals.rooms,
        adults: totals.adults,
        children: totals.children
      };

      if (totals.adults === 1 && totals.children === 1) {
        return this.translate.instant('search.guestSummarySingle', params);
      }
      return this.translate.instant('search.guestSummary', params);
    }
  }

  // Room management
  addRoom(): void {
    if (this.rooms.length < 4) {
      this.rooms.push(this.createRoomFormGroup());
    }
  }

  removeRoom(index: number): void {
    if (this.rooms.length > 1) {
      this.showRoomDeletionConfirmation(index);
    } else {
      // Show message that at least one room is required
      const currentLang = this.translate.currentLang || 'ar';
      const message = currentLang === 'ar'
        ? 'يجب أن تحتوي على غرفة واحدة على الأقل'
        : 'At least one room is required';

      this.snackBar.open(message, '', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: 'warning-snackbar'
      });
    }
  }

  // Check if room can be deleted
  canDeleteRoom(): boolean {
    return this.rooms.length > 1;
  }

  // Show confirmation dialog before removing room
  private showRoomDeletionConfirmation(index: number): void {
    const currentLang = this.translate.currentLang || 'ar';

    const dialogData = {
      title: currentLang === 'ar' ? 'تأكيد حذف الغرفة' : 'Confirm Room Deletion',
      message: currentLang === 'ar'
        ? 'هل أنت متأكد أنك تريد حذف هذه الغرفة؟'
        : 'Are you sure you want to delete this room?',
      confirmText: currentLang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      cancelText: currentLang === 'ar' ? 'تراجع' : 'Cancel',
      roomNumber: index + 1
    };

    const dialogRef = this.dialog.open(RoomDeletionConfirmationDialog, {
      width: '400px',
      data: dialogData,
      disableClose: true,
      panelClass: 'confirmation-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.confirmRoomDeletion(index);
      }
    });
  }

  // Actually remove the room after confirmation
  private confirmRoomDeletion(index: number): void {
    if (this.rooms.length > 1) {
      // Add a small delay for better UX
      setTimeout(() => {
        this.rooms.removeAt(index);

        // Show success message
        const currentLang = this.translate.currentLang || 'ar';
        const message = currentLang === 'ar'
          ? `تم حذف الغرفة ${index + 1} بنجاح`
          : `Room ${index + 1} deleted successfully`;

        this.snackBar.open(message, '', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: 'success-snackbar'
        });
      }, 200);
    }
  }

  // Children management
  onChildrenCountChange(roomIndex: number): void {
    const room = this.rooms.at(roomIndex);
    const childrenCount = room.get('childrenCount')?.value || 0;
    const childrenArray = this.getRoomChildren(roomIndex);

    // Clear existing children
    while (childrenArray.length !== 0) {
      childrenArray.removeAt(0);
    }

    // Add new children based on count
    for (let i = 0; i < childrenCount; i++) {
      childrenArray.push(this.createChildFormGroup());
    }
  }

  // Bed type management
  getAllBedTypes(): string[] {
    return [...this.basicBedTypes, ...this.advancedBedTypes];
  }

  getVisibleBedTypes(): string[] {
    return this.showMoreBedOptions
      ? this.getAllBedTypes()
      : this.basicBedTypes;
  }

  toggleMoreBedOptions(): void {
    this.showMoreBedOptions = !this.showMoreBedOptions;
  }

  isBedTypeSelected(roomIndex: number, bedType: string): boolean {
    const bedTypes = this.getRoomBedTypes(roomIndex);
    return bedTypes.value.some((bed: any) => bed.type === bedType);
  }

  toggleBedType(roomIndex: number, bedType: string): void {
    const bedTypesArray = this.getRoomBedTypes(roomIndex);
    const existingIndex = bedTypesArray.value.findIndex((bed: any) => bed.type === bedType);

    if (existingIndex >= 0) {
      // Remove bed type
      bedTypesArray.removeAt(existingIndex);
    } else {
      // Add bed type (check max limit)
      const room = this.rooms.at(roomIndex);
      const maxBeds = room.get('adults')?.value + room.get('childrenCount')?.value;
      const currentBeds = bedTypesArray.value.reduce((sum: number, bed: any) => sum + bed.quantity, 0);

      if (currentBeds < maxBeds) {
        bedTypesArray.push(this.createBedTypeFormGroup(bedType));
      }
    }
  }

  getBedTypeQuantity(roomIndex: number, bedType: string): number {
    const bedTypes = this.getRoomBedTypes(roomIndex);
    const bed = bedTypes.value.find((bed: any) => bed.type === bedType);
    return bed ? bed.quantity : 0;
  }

  updateBedTypeQuantity(roomIndex: number, bedType: string, quantity: number): void {
    const bedTypesArray = this.getRoomBedTypes(roomIndex);
    const bedIndex = bedTypesArray.value.findIndex((bed: any) => bed.type === bedType);

    if (bedIndex >= 0 && quantity > 0) {
      bedTypesArray.at(bedIndex).get('quantity')?.setValue(quantity);
    }
  }

  getMaxBedsForRoom(roomIndex: number): number {
    const room = this.rooms.at(roomIndex);
    return room.get('adults')?.value + room.get('childrenCount')?.value;
  }

  getCurrentBedsCount(roomIndex: number): number {
    const bedTypes = this.getRoomBedTypes(roomIndex);
    return bedTypes.value.reduce((sum: number, bed: any) => sum + bed.quantity, 0);
  }

  // Helper methods for counter controls
  incrementAdults(roomIndex: number): void {
    const room = this.rooms.at(roomIndex);
    const currentValue = room.get('adults')?.value || 1;
    if (currentValue < 5) {
      room.get('adults')?.setValue(currentValue + 1);
    }
  }

  decrementAdults(roomIndex: number): void {
    const room = this.rooms.at(roomIndex);
    const currentValue = room.get('adults')?.value || 1;
    if (currentValue > 1) {
      room.get('adults')?.setValue(currentValue - 1);
    }
  }

  incrementChildren(roomIndex: number): void {
    const room = this.rooms.at(roomIndex);
    const currentValue = room.get('childrenCount')?.value || 0;
    if (currentValue < 4) {
      room.get('childrenCount')?.setValue(currentValue + 1);
      this.onChildrenCountChange(roomIndex);
    }
  }

  decrementChildren(roomIndex: number): void {
    const room = this.rooms.at(roomIndex);
    const currentValue = room.get('childrenCount')?.value || 0;
    if (currentValue > 0) {
      room.get('childrenCount')?.setValue(currentValue - 1);
      this.onChildrenCountChange(roomIndex);
    }
  }

  // Quick fill functionality
  applyQuickFill(option: QuickFillOption): void {
    // Clear existing rooms
    while (this.rooms.length > 0) {
      this.rooms.removeAt(0);
    }

    // Add rooms based on quick fill option
    for (let i = 0; i < option.rooms; i++) {
      const roomGroup = this.createRoomFormGroup();
      roomGroup.get('adults')?.setValue(option.adults);
      roomGroup.get('childrenCount')?.setValue(option.children);

      // Add children if needed
      if (option.children > 0) {
        const childrenArray = roomGroup.get('children') as FormArray;
        for (let j = 0; j < option.children; j++) {
          childrenArray.push(this.createChildFormGroup());
        }
      }

      this.rooms.push(roomGroup);
    }

    this.closeGuestDropdown();
  }

  // Dropdown management
  toggleGuestDropdown(): void {
    this.isGuestDropdownOpen = !this.isGuestDropdownOpen;
  }

  closeGuestDropdown(): void {
    this.isGuestDropdownOpen = false;
    this.showMoreOptions = false; // Reset more options when closing
  }

  // More Options toggle
  toggleMoreOptions(): void {
    this.showMoreOptions = !this.showMoreOptions;
  }

  // Handle mat-select option changes
  onGuestOptionChange(event: any): void {
    const selectedValue = event.value;

    if (selectedValue === 'option1') {
      // Apply quick fill option 1: 1 Room, 2 Adults, 0 Children
      this.applyQuickFill({ rooms: 1, adults: 2, children: 0 });
      this.showMoreOptions = false;
    } else if (selectedValue === 'option2') {
      // Apply quick fill option 2: 1 Room, 1 Adult, 1 Child
      this.applyQuickFill({ rooms: 1, adults: 1, children: 1 });
      this.showMoreOptions = false;
    } else if (selectedValue === 'more-options') {
      // Show the expanded form
      this.showMoreOptions = true;
    }

    this.selectedGuestOption = selectedValue;
  }

  // Cancel more options and revert to previous selection
  cancelMoreOptions(): void {
    this.showMoreOptions = false;
    // Revert to the last valid quick option
    if (this.isQuickOption1Active()) {
      this.selectedGuestOption = 'option1';
    } else if (this.isQuickOption2Active()) {
      this.selectedGuestOption = 'option2';
    } else {
      this.selectedGuestOption = 'option1'; // Default fallback
      this.applyQuickFill({ rooms: 1, adults: 2, children: 0 });
    }
  }

  // Apply more options and keep the form state
  applyMoreOptions(): void {
    this.showMoreOptions = false;
    // Keep the current form state as is
  }

  // Helper methods to check current form state
  private isQuickOption1Active(): boolean {
    const rooms = this.rooms.value;
    return rooms.length === 1 &&
           rooms[0].adults === 2 &&
           rooms[0].childrenCount === 0;
  }

  private isQuickOption2Active(): boolean {
    const rooms = this.rooms.value;
    return rooms.length === 1 &&
           rooms[0].adults === 1 &&
           rooms[0].childrenCount === 1;
  }

  // Get display text for the selected guest option
  getSelectedOptionDisplayText(): string {
    switch (this.selectedGuestOption) {
      case 'option1':
        return this.translate.instant('search.quickOption1');
      case 'option2':
        return this.translate.instant('search.quickOption2');
      case 'more-options':
        return this.getGuestSummaryText();
      default:
        return this.translate.instant('search.quickOption1');
    }
  }

  // Quick fill with automatic dropdown close
  applyQuickFillAndClose(option: QuickFillOption): void {
    this.applyQuickFill(option);
    this.closeGuestDropdown();
  }

  // Check if form is in simple mode (only quick fill used)
  isSimpleMode(): boolean {
    const rooms = this.rooms.value;
    return rooms.length === 1 &&
           rooms[0].bedTypes.length === 0 &&
           !this.showMoreOptions;
  }

  // Form submission
  onSubmit(): void {
    if (this.searchForm.valid) {
      const formValue = this.searchForm.value;

      // Format dates to YYYY-MM-DD
      const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
      };

      const searchData: SearchFormData = {
        splCode: formValue.splCode,
        checkIn: formatDate(new Date(formValue.checkIn)),
        checkOut: formatDate(new Date(formValue.checkOut)),
        rooms: formValue.rooms.map((room: any) => ({
          adults: room.adults,
          childrenCount: room.childrenCount,
          bedTypes: room.bedTypes || [],
          children: room.children || []
        }))
      };

      // Calculate total guests and rooms for query params
      const totalAdults = searchData.rooms.reduce((sum, room) => sum + room.adults, 0);
      const totalChildren = searchData.rooms.reduce((sum, room) => sum + room.childrenCount, 0);
      const totalGuests = totalAdults + totalChildren;
      const totalRooms = searchData.rooms.length;

      // Navigate to rooms-filter route with query parameters
      this.router.navigate(['/rooms-filter'], {
        queryParams: {
          location: searchData.splCode,
          checkin: searchData.checkIn,
          checkout: searchData.checkOut,
          guests: totalGuests,
          rooms: totalRooms,
          adults: totalAdults,
          children: totalChildren,
          roomsData: encodeURIComponent(JSON.stringify(searchData.rooms))
        }
      });

      // Also emit the event for any parent components that might need it
      this.searchFormSubmit.emit(searchData);
    } else {
      this.markFormGroupTouched(this.searchForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          }
        });
      }
    });
  }

  // Helper method to get error messages
  getErrorMessage(controlName: string, roomIndex?: number, childIndex?: number): string {
    let control;

    if (roomIndex !== undefined && childIndex !== undefined) {
      control = this.getRoomChildren(roomIndex).at(childIndex).get('age');
    } else if (roomIndex !== undefined) {
      control = this.rooms.at(roomIndex).get(controlName);
    } else {
      control = this.searchForm.get(controlName);
    }

    if (control?.hasError('required')) {
      return `${controlName} is required`;
    }
    if (control?.hasError('minlength')) {
      return `${controlName} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
    }
    if (control?.hasError('min')) {
      return `${controlName} must be at least ${control.errors?.['min'].min}`;
    }
    if (control?.hasError('max')) {
      return `${controlName} must be at most ${control.errors?.['max'].max}`;
    }

    return '';
  }

  resetForm(): void {
    this.searchForm.reset();
    this.initializeForm();
    this.closeGuestDropdown();
    this.showMoreBedOptions = false;
  }

  // Floating panel methods - Toggle functionality
  openGuestPanel(): void {
    if (this.isGuestPanelOpen) {
      // If panel is open, close it
      this.closeGuestPanel();
    } else {
      // If panel is closed, open it
      this.storeOriginalFormState();
      this.isGuestPanelOpen = true;
      this.showMoreOptions = true; // Always show the full form in the panel
    }
  }

  closeGuestPanel(): void {
    this.isGuestPanelOpen = false;
    this.showMoreOptions = false;
  }

  // Get guest summary for the trigger button
  getGuestSummary(): string {
    const rooms = this.rooms.value;
    const totalRooms = rooms.length;
    const totalAdults = rooms.reduce((sum: number, room: any) => sum + room.adults, 0);
    const totalChildren = rooms.reduce((sum: number, room: any) => sum + room.childrenCount, 0);

    // Check current language
    const currentLang = this.translate.currentLang || 'ar';

    if (currentLang === 'ar') {
      // Arabic localization with proper pluralization
      const roomText = this.getArabicRoomText(totalRooms);
      const adultText = this.getArabicAdultText(totalAdults);
      const childText = this.getArabicChildText(totalChildren);

      // Always show all counts including zeros in Arabic
      return `${totalRooms} ${roomText}، ${totalAdults} ${adultText}، ${totalChildren} ${childText}`;
    } else {
      // English fallback
      if (totalRooms === 1 && totalAdults === 2 && totalChildren === 0) {
        return this.translate.instant('search.quickOption1');
      } else if (totalRooms === 1 && totalAdults === 1 && totalChildren === 1) {
        return this.translate.instant('search.quickOption2');
      } else {
        const roomText = totalRooms === 1 ? 'room' : 'rooms';
        const adultText = totalAdults === 1 ? 'adult' : 'adults';
        const childText = totalChildren === 1 ? 'child' : 'children';

        return `${totalRooms} ${roomText}, ${totalAdults} ${adultText}, ${totalChildren} ${childText}`;
      }
    }
  }

  // Arabic pluralization helper methods
  private getArabicRoomText(count: number): string {
    if (count === 0) {
      return 'غرف'; // No rooms (plural)
    } else if (count === 1) {
      return 'غرفة'; // One room (singular)
    } else if (count === 2) {
      return 'غرفتان'; // Two rooms (dual)
    } else if (count >= 3 && count <= 10) {
      return 'غرف'; // 3-10 rooms (plural)
    } else {
      return 'غرفة'; // 11+ rooms (singular form used with large numbers)
    }
  }

  private getArabicAdultText(count: number): string {
    if (count === 0) {
      return 'بالغين'; // No adults (plural)
    } else if (count === 1) {
      return 'بالغ'; // One adult (singular)
    } else if (count === 2) {
      return 'بالغان'; // Two adults (dual)
    } else if (count >= 3 && count <= 10) {
      return 'بالغين'; // 3-10 adults (plural)
    } else {
      return 'بالغ'; // 11+ adults (singular form used with large numbers)
    }
  }

  private getArabicChildText(count: number): string {
    if (count === 0) {
      return 'أطفال'; // No children (plural)
    } else if (count === 1) {
      return 'طفل'; // One child (singular)
    } else if (count === 2) {
      return 'طفلان'; // Two children (dual)
    } else if (count >= 3 && count <= 10) {
      return 'أطفال'; // 3-10 children (plural)
    } else {
      return 'طفل'; // 11+ children (singular form used with large numbers)
    }
  }

  // Get localized room title
  getRoomTitle(roomIndex: number): string {
    const currentLang = this.translate.currentLang || 'ar';
    const roomNumber = roomIndex + 1;

    if (currentLang === 'ar') {
      return `الغرفة ${roomNumber}`;
    } else {
      return this.translate.instant('search.rooms') + ' ' + roomNumber;
    }
  }

  // Date range picker event handlers
  onDateRangePickerOpened(): void {
    this.isDatePickerOpen = true;
    this.updateDateSelectionStep();

    // Inject Hijri dates after calendar is rendered
    setTimeout(() => {
      this.injectHijriDates();
      this.setupCalendarNavigationListener();
    }, 100);
  }

  private setupCalendarNavigationListener(): void {
    // Listen for calendar navigation changes
    const observer = new MutationObserver(() => {
      if (this.showHijri && this.isDatePickerOpen) {
        setTimeout(() => {
          this.injectHijriDates();
        }, 50);
      }
    });

    // Observe changes in the calendar
    const calendar = document.querySelector('.mat-calendar');
    if (calendar) {
      observer.observe(calendar, {
        childList: true,
        subtree: true,
        attributes: false
      });

      // Store observer to disconnect later
      (this as any)._calendarObserver = observer;
    }
  }

  onDateRangePickerClosed(): void {
    this.isDatePickerOpen = false;

    // Disconnect calendar observer
    if ((this as any)._calendarObserver) {
      (this as any)._calendarObserver.disconnect();
      (this as any)._calendarObserver = null;
    }

    const checkInDate = this.searchForm.get('checkIn')?.value;
    const checkOutDate = this.searchForm.get('checkOut')?.value;

    // If both dates are selected, we're done
    if (checkInDate && checkOutDate) {
      this.dateSelectionStep = 'check-in'; // Reset for next time
      this.selectedCheckInDate = null;
      this.dateRangeStrategy.reset();
      this.triggerNightsAnimation();
      return;
    }

    // If only check-in is selected, keep the picker in check-out mode
    if (checkInDate && !checkOutDate) {
      this.selectedCheckInDate = new Date(checkInDate);
      this.dateSelectionStep = 'check-out';

      // Auto-set check-out to next day as default
      const nextDay = new Date(checkInDate);
      nextDay.setDate(nextDay.getDate() + 1);
      this.searchForm.patchValue({ checkOut: nextDay });
      this.triggerNightsAnimation();
    }
  }

  onDateRangeSelectionChange(): void {
    this.updateDateSelectionStep();
  }

  private updateDateSelectionStep(): void {
    const checkInDate = this.searchForm.get('checkIn')?.value;
    const checkOutDate = this.searchForm.get('checkOut')?.value;

    if (!checkInDate) {
      this.dateSelectionStep = 'check-in';
      this.selectedCheckInDate = null;
    } else if (!checkOutDate) {
      this.dateSelectionStep = 'check-out';
      this.selectedCheckInDate = new Date(checkInDate);
    } else {
      this.dateSelectionStep = 'check-in'; // Both selected, ready for next selection
      this.selectedCheckInDate = null;
    }
  }

  // Get current step label for UI
  getCurrentStepLabel(): string {
    const currentLang = this.translate.currentLang || 'ar';

    if (currentLang === 'ar') {
      return this.dateSelectionStep === 'check-in'
        ? 'اختر تاريخ الوصول'
        : 'اختر تاريخ المغادرة';
    } else {
      return this.dateSelectionStep === 'check-in'
        ? 'Select Check-in Date'
        : 'Select Check-out Date';
    }
  }

  // Reset date selection
  resetDateSelection(): void {
    this.dateSelectionStep = 'check-in';
    this.selectedCheckInDate = null;
    this.dateRangeStrategy.reset();
    this.searchForm.patchValue({
      checkIn: null,
      checkOut: null
    });
    // Reset nights animation
    this.nightsAnimationTrigger = false;
  }

  // Handle keyboard shortcuts for date picker
  onDatePickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.resetDateSelection();
    } else if (event.key === 'Enter' && this.dateSelectionStep === 'check-out') {
      // Auto-select tomorrow as check-out if only check-in is selected
      const checkInDate = this.searchForm.get('checkIn')?.value;
      if (checkInDate && !this.searchForm.get('checkOut')?.value) {
        const tomorrow = new Date(checkInDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.searchForm.patchValue({ checkOut: tomorrow });
      }
    }
  }

  // Check if date is selectable (not before check-in when selecting check-out)
  isDateSelectable(date: Date): boolean {
    if (this.dateSelectionStep === 'check-out' && this.selectedCheckInDate) {
      return date >= this.selectedCheckInDate;
    }
    return date >= this.minDate;
  }

  // Date range validation
  validateDateRange(): boolean {
    const checkInDate = this.searchForm.get('checkIn')?.value;
    const checkOutDate = this.searchForm.get('checkOut')?.value;

    if (!checkInDate || !checkOutDate) {
      return false;
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Check-out must be after check-in
    return checkOut > checkIn;
  }

  // Get number of nights
  getNumberOfNights(): number {
    const checkInDate = this.searchForm.get('checkIn')?.value;
    const checkOutDate = this.searchForm.get('checkOut')?.value;

    if (!checkInDate || !checkOutDate) {
      return 0;
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const timeDiff = checkOut.getTime() - checkIn.getTime();

    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  // Format date range display
  getFormattedDateRange(): string {
    const checkInDate = this.searchForm.get('checkIn')?.value;
    const checkOutDate = this.searchForm.get('checkOut')?.value;
    const currentLang = this.translate.currentLang || 'ar';

    if (!checkInDate && !checkOutDate) {
      return currentLang === 'ar' ? 'اختر التواريخ' : 'Select Dates';
    }

    const formatDate = (date: Date): string => {
      if (currentLang === 'ar') {
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      } else {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    };

    if (checkInDate && !checkOutDate) {
      return currentLang === 'ar'
        ? `${formatDate(new Date(checkInDate))} - اختر تاريخ المغادرة`
        : `${formatDate(new Date(checkInDate))} - Select Check-out`;
    }

    if (checkInDate && checkOutDate) {
      const checkIn = formatDate(new Date(checkInDate));
      const checkOut = formatDate(new Date(checkOutDate));
      return `${checkIn} - ${checkOut}`;
    }

    return '';
  }

  // Get nights text with proper pluralization for all languages
  getNightsText(): string {
    const nights = this.getNumberOfNights();
    const currentLang = this.translate.currentLang || 'ar';

    if (nights === 0) return '';

    switch (currentLang) {
      case 'ar':
        if (nights === 1) {
          return 'ليلة واحدة';
        } else if (nights === 2) {
          return 'ليلتان';
        } else if (nights >= 3 && nights <= 10) {
          return `${nights} ليالي`;
        } else {
          return `${nights} ليلة`;
        }

      case 'en':
        return nights === 1 ? '1 night' : `${nights} nights`;

      case 'fr':
        return nights === 1 ? '1 nuit' : `${nights} nuits`;

      case 'es':
        return nights === 1 ? '1 noche' : `${nights} noches`;

      case 'de':
        return nights === 1 ? '1 Nacht' : `${nights} Nächte`;

      default:
        return nights === 1 ? '1 night' : `${nights} nights`;
    }
  }

  // Trigger animation for nights badge
  private triggerNightsAnimation(): void {
    if (this.validateDateRange() && this.getNumberOfNights() > 0) {
      this.nightsAnimationTrigger = true;
      setTimeout(() => {
        this.nightsAnimationTrigger = false;
      }, 300);
    }
  }

  // Apply changes and close panel
  applyGuestConfiguration(): void {
    this.closeGuestPanel();
  }

  // Store the original form state for cancel functionality
  private storeOriginalFormState(): void {
    try {
      // Deep clone the current form state
      this.originalFormState = JSON.parse(JSON.stringify(this.searchForm.value));

      // Ensure we have a valid rooms array
      if (!this.originalFormState.rooms || !Array.isArray(this.originalFormState.rooms)) {
        this.originalFormState.rooms = [];
      }

      // If no rooms exist, create a default room
      if (this.originalFormState.rooms.length === 0) {
        this.originalFormState.rooms.push({
          adults: 1,
          childrenCount: 0,
          children: [],
          bedTypes: []
        });
      }

      console.log('Original form state stored:', this.originalFormState);
    } catch (error) {
      console.error('Error storing original form state:', error);
      // Create a safe default state
      this.originalFormState = {
        rooms: [{
          adults: 1,
          childrenCount: 0,
          children: [],
          bedTypes: []
        }],
        splCode: '',
        checkIn: null,
        checkOut: null
      };
    }
  }

  // Restore the original form state
  private restoreOriginalFormState(): void {
    try {
      if (this.originalFormState && this.originalFormState.rooms) {
        // Clear the current rooms FormArray safely
        while (this.rooms.length !== 0) {
          this.rooms.removeAt(0);
        }

        // Rebuild the form with original data
        this.originalFormState.rooms.forEach((roomData: any) => {
          const roomGroup = this.createRoomFormGroup();

          // Safely patch room data
          if (roomData) {
            roomGroup.patchValue({
              adults: roomData.adults || 1,
              childrenCount: roomData.childrenCount || 0,
              bedTypes: roomData.bedTypes || []
            });

            // Handle children array safely
            const childrenArray = roomGroup.get('children') as FormArray;
            while (childrenArray.length !== 0) {
              childrenArray.removeAt(0);
            }

            if (roomData.children && Array.isArray(roomData.children) && roomData.children.length > 0) {
              roomData.children.forEach((child: any) => {
                if (child && typeof child.age !== 'undefined') {
                  childrenArray.push(this.fb.group({
                    age: [child.age, [Validators.required, Validators.min(0), Validators.max(11)]]
                  }));
                }
              });
            }
          }

          this.rooms.push(roomGroup);
        });

        // Update other form fields safely
        if (this.originalFormState.splCode !== undefined) {
          this.searchForm.patchValue({
            splCode: this.originalFormState.splCode
          });
        }
        if (this.originalFormState.checkIn) {
          this.searchForm.patchValue({
            checkIn: this.originalFormState.checkIn
          });
        }
        if (this.originalFormState.checkOut) {
          this.searchForm.patchValue({
            checkOut: this.originalFormState.checkOut
          });
        }

        // Show success message
        this.snackBar.open(
          'تمت إعادة التعديلات إلى الوضع السابق',
          'إغلاق',
          {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['success-snackbar']
          }
        );
      } else {
        // If no original state or invalid state, just close
        this.snackBar.open(
          'تم إغلاق النافذة',
          'إغلاق',
          {
            duration: 1500,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['info-snackbar']
          }
        );
      }

      // Close the panel after a brief delay
      setTimeout(() => {
        this.closeGuestPanel();
      }, 150);

    } catch (error) {
      console.error('Error restoring form state:', error);

      // Show error message and close panel
      this.snackBar.open(
        'حدث خطأ أثناء استعادة البيانات. تم إغلاق النافذة.',
        'إغلاق',
        {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['error-snackbar']
        }
      );

      // Close the panel
      setTimeout(() => {
        this.closeGuestPanel();
      }, 150);
    }
  }

  // Cancel changes and close popup (Almosafer behavior)
  cancelGuestConfiguration(): void {
    // Restore original form state
    this.restoreOriginalFormState();
    // Close the popup
    this.closeGuestPanel();
  }

  // Combined click outside handler for popup and calendar
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Handle guest panel close
    if (this.isGuestPanelOpen) {
      const target = event.target as HTMLElement;
      const guestField = target.closest('.guest-field');
      const popup = target.closest('.almosafer-guest-popup');

      // Close if clicked outside both guest field and popup
      if (!guestField && !popup) {
        this.closeGuestPanel();
      }
    }

    // Handle calendar close
    if (this.isInlineCalendarOpen) {
      const target = event.target as HTMLElement;
      const dateFieldElement = this.dateField?.nativeElement;
      const calendarElement = document.querySelector('.inline-calendar-container');

      // Close calendar if click is outside both the date field and calendar
      if (dateFieldElement && calendarElement &&
          !dateFieldElement.contains(target) &&
          !calendarElement.contains(target)) {
        this.closeInlineCalendar();
      }
    }
  }

  // ESC key to close popup
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isGuestPanelOpen) {
      this.closeGuestPanel();
    }
  }

  // Get current language for icon positioning
  // get isRTL(): boolean {
  //   return this.translate.currentLang === 'ar';
  // }

  // get isLTR(): boolean {
  //   return this.translate.currentLang === 'en';
  // }

  // Hijri calendar methods
  toggleHijriDisplay(): void {
    this.showHijri = !this.showHijri;
    // Re-inject Hijri dates when toggle changes
    setTimeout(() => {
      this.injectHijriDates();
    }, 50);
  }

  private injectHijriDates(): void {
    if (!this.showHijri) {
      // Remove existing Hijri dates
      const hijriElements = document.querySelectorAll('.hijri-date');
      hijriElements.forEach(el => el.remove());

      // Remove hijri-enabled class
      const cells = document.querySelectorAll('.mat-calendar-body-cell');
      cells.forEach(cell => cell.classList.remove('hijri-enabled'));
      return;
    }

    // Find all calendar cells
    const calendarCells = document.querySelectorAll('.mat-calendar-body-cell:not(.mat-calendar-body-disabled)');

    calendarCells.forEach((cell: Element) => {
      const cellElement = cell as HTMLElement;
      const cellContent = cellElement.querySelector('.mat-calendar-body-cell-content');

      if (cellContent && !cellContent.querySelector('.hijri-date')) {
        // Get the date from the cell
        const dateText = cellContent.textContent?.trim();
        if (dateText && !isNaN(Number(dateText))) {
          // Calculate the full date based on the current calendar view
          const currentDate = this.calculateDateFromCell(cellElement, Number(dateText));
          if (currentDate) {
            const hijriDateText = this.getHijriDate(currentDate);

            if (hijriDateText) {
              // Add hijri-enabled class to cell
              cellElement.classList.add('hijri-enabled');

              // Create Hijri date element
              const hijriElement = document.createElement('div');
              hijriElement.className = 'hijri-date';
              hijriElement.textContent = hijriDateText;
              hijriElement.style.fontSize = '10px';
              hijriElement.style.color = 'var(--mat-sys-on-surface-variant, #666)';
              hijriElement.style.lineHeight = '1';
              hijriElement.style.marginTop = '2px';
              hijriElement.style.whiteSpace = 'nowrap';
              hijriElement.style.overflow = 'hidden';
              hijriElement.style.textOverflow = 'ellipsis';
              hijriElement.style.maxWidth = '100%';

              // Modify cell content to flex column
              const contentElement = cellContent as HTMLElement;
              contentElement.style.display = 'flex';
              contentElement.style.flexDirection = 'column';
              contentElement.style.alignItems = 'center';
              contentElement.style.justifyContent = 'center';
              contentElement.style.height = '100%';
              contentElement.style.padding = '2px';

              // Append Hijri date
              contentElement.appendChild(hijriElement);
            }
          }
        }
      }
    });
  }

  private calculateDateFromCell(cellElement: HTMLElement, dayNumber: number): Date | null {
    try {
      // Find the calendar header to get current month/year
      const calendarHeader = document.querySelector('.mat-calendar-period-button');
      if (!calendarHeader) return null;

      const headerText = calendarHeader.textContent?.trim();
      if (!headerText) return null;

      // Parse the header text to get month and year
      // This is a simplified approach - you might need to adjust based on your locale
      const currentLang = this.translate.currentLang || 'ar';

      if (currentLang === 'ar') {
        // Arabic format parsing
        const parts = headerText.split(' ');
        if (parts.length >= 2) {
          const year = parseInt(parts[parts.length - 1]);
          const monthName = parts[parts.length - 2];
          const monthIndex = this.getArabicMonthIndex(monthName);

          if (!isNaN(year) && monthIndex !== -1) {
            return new Date(year, monthIndex, dayNumber);
          }
        }
      } else {
        // English format parsing
        const parts = headerText.split(' ');
        if (parts.length >= 2) {
          const year = parseInt(parts[parts.length - 1]);
          const monthName = parts[0];
          const monthIndex = this.getEnglishMonthIndex(monthName);

          if (!isNaN(year) && monthIndex !== -1) {
            return new Date(year, monthIndex, dayNumber);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error calculating date from cell:', error);
      return null;
    }
  }

  private getArabicMonthIndex(monthName: string): number {
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return arabicMonths.indexOf(monthName);
  }

  private getEnglishMonthIndex(monthName: string): number {
    const englishMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return englishMonths.indexOf(monthName);
  }

  getHijriDate(gregorianDate: Date): string {
    try {
      const hijriDate = new HijriDate.HijriDate(gregorianDate);
      const currentLang = this.translate.currentLang || 'ar';

      if (currentLang === 'ar') {
        return `${hijriDate.getDate()} ${this.getArabicHijriMonth(hijriDate.getMonth())}`;
      } else {
        return `${hijriDate.getDate()} ${this.getEnglishHijriMonth(hijriDate.getMonth())}`;
      }
    } catch (error) {
      console.error('Error converting to Hijri date:', error);
      return '';
    }
  }

  private getArabicHijriMonth(monthIndex: number): string {
    const arabicMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الثانية',
      'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    return arabicMonths[monthIndex] || '';
  }

  private getEnglishHijriMonth(monthIndex: number): string {
    const englishMonths = [
      'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani', 'Jumada al-awwal', 'Jumada al-thani',
      'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
    ];
    return englishMonths[monthIndex] || '';
  }

  // Custom date input methods for Almosafer-style UI
  get isRTL(): boolean {
    return this.translate.currentLang === 'ar';
  }

  get isLTR(): boolean {
    return this.translate.currentLang !== 'ar';
  }

  get checkIn(): Date | null {
    return this.searchForm.get('checkIn')?.value || null;
  }

  get checkOut(): Date | null {
    return this.searchForm.get('checkOut')?.value || null;
  }

  get placeholder(): string {
    const currentLang = this.translate.currentLang || 'ar';
    return currentLang === 'ar' ? 'اختر التواريخ' : 'Select Dates';
  }

  // FIXED: Always format as Gregorian date with proper language localization
  private fmt(date: Date, lang: string): string {
    if (!date) return '';

    try {
      // Always use Gregorian calendar, but with proper language localization
      if (lang === 'ar') {
        // Arabic: الاثنين 11 أغسطس 2025 (full Arabic Gregorian date)
        try {
          return new Intl.DateTimeFormat('ar-EG', {
            weekday: 'long',
            day: 'numeric', 
            month: 'long',
            year: 'numeric',
            calendar: 'gregory' // Force Gregorian calendar
          }).format(date);
        } catch (error) {
          // Fallback if calendar option not supported
          return new Intl.DateTimeFormat('ar-EG', {
            weekday: 'long',
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
          }).format(date);
        }
      } else {
        // English: Mon 11 August 2025
        try {
          return new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            calendar: 'gregory' // Force Gregorian calendar
          }).format(date);
        } catch (error) {
          // Fallback if calendar option not supported
          return new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(date);
        }
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      // Ultimate fallback
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB');
    }
  }

  /**
   * Format Hijri date with proper weekday and localization
   * @param date - The date to format
   * @param lang - Language code ('ar' or 'en')
   * @returns Formatted Hijri date string with weekday
   */
  private formatHijriDate(date: Date, lang: string): string {
    if (!date) return '';

    try {
      // Use native JavaScript for weekday
      const weekday = new Intl.DateTimeFormat(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { weekday: 'long' }
      ).format(date);

      // Use HijriDate library for Hijri conversion
      try {
        const hijri = new HijriDate(date);
        const hijriMonth = lang === 'ar' ? 
          this.getArabicHijriMonth(hijri.getMonth() - 1) : 
          this.getEnglishHijriMonth(hijri.getMonth() - 1);
        
        const hijriDay = hijri.getDate();

        if (lang === 'ar') {
          return `${weekday}، ${hijriDay} ${hijriMonth}`;
        } else {
          return `${weekday}, ${hijriDay} ${hijriMonth}`;
        }
      } catch (hijriError) {
        console.warn('HijriDate conversion failed, using Gregorian:', hijriError);
        // Fallback: use Gregorian formatting
        return this.fmt(date, lang);
      }
    } catch (error) {
      console.error('Error formatting Hijri date:', error);
      // Ultimate fallback: format as Gregorian
      return this.fmt(date, lang);
    }
  }

  formatCheckIn(): string {
    const checkInDate = this.checkIn; // Uses getter
    if (!checkInDate) return '';
    
    const lang = this.translate?.currentLang || 'ar';
    console.log('formatCheckIn called:', { checkInDate: checkInDate.toISOString(), lang });
    return this.fmt(checkInDate, lang); // FIXED: Always Gregorian, just format by language
  }

  formatCheckOut(): string {
    const checkOutDate = this.checkOut; // Uses getter
    if (!checkOutDate) return '';
    
    const lang = this.translate?.currentLang || 'ar';
    console.log('formatCheckOut called:', { checkOutDate: checkOutDate.toISOString(), lang });
    return this.fmt(checkOutDate, lang); // FIXED: Always Gregorian, just format by language
  }

  getFormattedDayDate(date: Date | null): string {
    if (!date) return '';

    const currentLang = this.translate.currentLang || 'ar';

    // FIXED: Always use Gregorian formatting with explicit calendar
    if (currentLang === 'ar') {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        calendar: 'gregory' // Force Gregorian calendar
      };
      return date.toLocaleDateString('ar-EG', options);
    } else {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        calendar: 'gregory' // Force Gregorian calendar
      };
      return date.toLocaleDateString('en-GB', options);
    }
  }

  getHijriFormattedDate(date: Date | null): string {
    if (!date) return '';

    const currentLang = this.translate.currentLang || 'ar';
    return this.formatHijriDate(date, currentLang);
  }

  getHijriString(date: Date | null): string {
    if (!date) return '';

    // Only show secondary Hijri display when in Gregorian mode
    if (this.currentCalendarType === 'hijri') {
      return '';
    }

    const currentLang = this.translate.currentLang || 'ar';

    // Show Hijri string in current language
    return this.formatHijriDate(date, currentLang);
  }

  openDatePicker(): void {
    // Toggle the inline calendar - CSS handles positioning like guest popup
    this.isInlineCalendarOpen = !this.isInlineCalendarOpen;
    this.isCustomCalendarVisible = false; // Ensure overlay is closed
    
    // No need for calculateCalendarPosition() - CSS handles everything
  }

  private calculateCalendarPosition(): void {
    // DISABLED: CSS handles positioning now - like guest popup
    // No manual positioning needed - everything is handled by absolute positioning in CSS
    return;
    
    /* COMMENTED OUT - OLD LOGIC THAT CAUSED POSITIONING ISSUES
    if (!this.dateField?.nativeElement) return;

    const dateFieldElement = this.dateField.nativeElement;
    const calendarElement = document.querySelector('.inline-calendar-container') as HTMLElement;

    if (!calendarElement) return;

    // Get date field position relative to viewport
    const fieldRect = dateFieldElement.getBoundingClientRect();

    // Calculate position - center horizontally, position below field
    const topPosition = fieldRect.bottom + 8; // 8px margin below field
    const leftPosition = '50%'; // Center horizontally
    const transform = 'translateX(-50%)'; // Center alignment

    // Apply positioning with smooth transition
    calendarElement.style.position = 'fixed';
    calendarElement.style.top = `${topPosition}px`;
    calendarElement.style.left = leftPosition;
    calendarElement.style.transform = transform;
    calendarElement.style.zIndex = '1100';
    calendarElement.style.maxWidth = 'none';
    calendarElement.style.maxHeight = 'none';
    calendarElement.style.overflow = 'visible';

    // Ensure calendar is visible and properly sized
    calendarElement.style.visibility = 'visible';

    // Add show class for animation
    const wrapperElement = calendarElement.querySelector('.inline-calendar-wrapper') as HTMLElement;
    if (wrapperElement) {
      setTimeout(() => {
        wrapperElement.classList.add('show');
      }, 10); // Small delay to ensure DOM is ready
    }

    // Handle edge cases for small screens
    const viewportWidth = window.innerWidth;
    if (viewportWidth < 768) {
      calendarElement.style.maxWidth = '95vw';
    }
    */
  }

  onCustomCalendarSelectionChange(selection: CalendarSelection): void {
    // FIXED: Always keep Gregorian as the internal calendar type
    // Display language can be different but storage is always Gregorian
    // this.currentCalendarType = selection.calendarType; // REMOVED - don't change internal calendar type

    // FIXED: Update form controls (getters will access them)
    if (selection.checkIn) {
      this.searchForm.patchValue({
        checkIn: selection.checkIn
      });
    }

    if (selection.checkOut) {
      this.searchForm.patchValue({
        checkOut: selection.checkOut
      });
    }

    // Update selected dates for validation
    this.selectedCheckInDate = selection.checkIn;

    // Trigger form validation
    this.searchForm.markAsTouched();
    this.searchForm.updateValueAndValidity();
    
    // Force change detection to update the display
    console.log('Updated dates (always Gregorian internally):', { 
      checkIn: this.checkIn?.toISOString().split('T')[0], 
      checkOut: this.checkOut?.toISOString().split('T')[0], 
      internalCalendarType: this.currentCalendarType, // Always 'gregorian'
      displayLanguage: this.translate.currentLang 
    });
  }

  onCustomCalendarClose(): void {
    this.isCustomCalendarVisible = false;
    this.isInlineCalendarOpen = false;
  }

  closeInlineCalendar(): void {
    // Simple close - Angular animation handles the rest
    this.isInlineCalendarOpen = false;
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(): void {
    // DISABLED: CSS handles positioning now - no need for manual recalculation
    // CSS absolute positioning automatically adjusts
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll(): void {
    // DISABLED: CSS handles positioning now - no need for manual recalculation
    // CSS absolute positioning automatically adjusts
  }



  getSearchButtonLabel(): string {
    const currentLang = this.translate.currentLang || 'ar';
    return currentLang === 'ar' ? 'يلا نحجز' : "Let's Book";
  }

  // Calendar cell class function for custom styling
  dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    // Add custom classes for calendar cells if needed
    if (view === 'month') {
      return this.showHijri ? 'hijri-enabled' : '';
    }
    return '';
  };

  // Location autocomplete methods
  openLocationPanel() {
    if (!this.seedLoaded) {
      this.loadDefaults();
      this.seedLoaded = true;
    }
    // Ensure the input has focus, then open the panel
    Promise.resolve().then(() => {
      if (this.locTrigger && !this.locTrigger.panelOpen) {
        this.locTrigger.openPanel();
      }
    });
  }

  displaySuggestion = (s?: LocationSuggestion) => s ? s.name : '';

  private loadDefaults() {
    // replace with service calls if they exist
    this.recentSuggestions = []; // this.locationService?.getRecent?.() ?? [];
    this.popularSuggestions = [
      { id:'cai', name:'Cairo', subText:'Egypt', type:'city' },
      { id:'cai-air', name:'Cairo International Airport (CAI)', subText:'Egypt', type:'airport' },
    ];
  }

  private fetchSuggestions(q: string) {
    if (!q?.trim()) {
      // show merged defaults on focus
      return of([...this.recentSuggestions, ...this.popularSuggestions]);
    }
    // live search (fallback to empty array if no API)
    return of([]); // this.locationService?.search(q) ?? of([]);
  }

  onLocationSelected(s: LocationSuggestion) {
    // keep the same value shape your form expects (string or object)
    this.splCtrl.setValue(s.name);
  }

  getSplCodeError(): string {
    const control = this.searchForm.get('splCode');
    if (!control) return '';
    const field = this.translate.instant('search.locationPlaceholder');
    const err = control.errors || {};
    if (err['required'])   return this.translate.instant('errors.required',  { field });
    if (err['minlength'])  return this.translate.instant('errors.minlength', { field, requiredLength: err['minlength'].requiredLength });
    return '';
  }
}

// Confirmation Dialog Component
@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  template: `
    <div class="confirmation-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <p>{{ data.message }}</p>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions">
        <button mat-button
                class="cancel-dialog-btn"
                (click)="onCancel()">
          {{ data.cancelText }}
        </button>
        <button mat-raised-button
                class="confirm-dialog-btn"
                color="warn"
                (click)="onConfirm()">
          {{ data.confirmText }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirmation-dialog {
      padding: 0;

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 24px 16px 24px;
        border-bottom: 1px solid #e0e0e0;

        .warning-icon {
          color: #ff9800;
          font-size: 24px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }
      }

      .dialog-content {
        padding: 20px 24px;

        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #666;
        }
      }

      .dialog-actions {
        padding: 16px 24px 24px 24px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid #e0e0e0;

        .cancel-dialog-btn {
          color: #666;
          border: 1px solid #e0e0e0;

          &:hover {
            background: #f5f5f5;
            border-color: #ccc;
          }
        }

        .confirm-dialog-btn {
          background: #f44336 !important;
          color: white !important;
          font-weight: 600;

          &:hover {
            background: #d32f2f !important;
          }
        }
      }
    }

    // Dark theme support
    :host-context(.dark-theme) {
      .confirmation-dialog {
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);

        .dialog-header {
          border-bottom-color: var(--mat-sys-outline);

          h2 {
            color: var(--mat-sys-on-surface);
          }
        }

        .dialog-content p {
          color: var(--mat-sys-on-surface-variant);
        }

        .dialog-actions {
          border-top-color: var(--mat-sys-outline);

          .cancel-dialog-btn {
            color: var(--mat-sys-on-surface-variant);
            border-color: var(--mat-sys-outline);

            &:hover {
              background: var(--mat-sys-surface-container-high);
              border-color: var(--mat-sys-outline-variant);
            }
          }
        }
      }
    }
  `]
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

// Room Deletion Confirmation Dialog Component
@Component({
  selector: 'app-room-deletion-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  template: `
    <div class="room-deletion-dialog">
      <div class="dialog-header">
        <mat-icon class="delete-icon">delete_outline</mat-icon>
        <h2>{{ data.title }}</h2>
      </div>

      <div class="dialog-content">
        <p>{{ data.message }}</p>
        <div class="room-info">
          <mat-icon>hotel</mat-icon>
          <span>{{ 'search.rooms' | translate }} {{ data.roomNumber }}</span>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button
                class="cancel-dialog-btn"
                (click)="onCancel()">
          {{ data.cancelText }}
        </button>
        <button mat-raised-button
                class="delete-dialog-btn"
                (click)="onConfirm()">
          <mat-icon>delete</mat-icon>
          {{ data.confirmText }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .room-deletion-dialog {
      min-width: 350px;
      max-width: 450px;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 24px 16px 24px;
        border-bottom: 1px solid #e0e0e0;

        .delete-icon {
          color: #f44336;
          font-size: 24px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }
      }

      .dialog-content {
        padding: 20px 24px;

        p {
          margin: 0 0 16px 0;
          font-size: 14px;
          line-height: 1.5;
          color: #666;
        }

        .room-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(244, 67, 54, 0.1);
          border-radius: 8px;
          border-left: 4px solid #f44336;

          mat-icon {
            color: #f44336;
            font-size: 20px;
          }

          span {
            font-weight: 600;
            color: #f44336;
          }
        }
      }

      .dialog-actions {
        padding: 16px 24px 24px 24px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid #e0e0e0;

        .cancel-dialog-btn {
          color: #666;
          border: 1px solid #e0e0e0;

          &:hover {
            background: #f5f5f5;
            border-color: #ccc;
          }
        }

        .delete-dialog-btn {
          background: #f44336 !important;
          color: white !important;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;

          &:hover {
            background: #d32f2f !important;
          }

          mat-icon {
            font-size: 18px;
          }
        }
      }
    }

    // RTL support
    :host-context([dir="rtl"]) {
      .room-deletion-dialog {
        .room-info {
          border-left: none;
          border-right: 4px solid #f44336;
        }
      }
    }

    // Dark theme support
    :host-context(.dark-theme) {
      .room-deletion-dialog {
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);

        .dialog-header {
          border-bottom-color: var(--mat-sys-outline);

          h2 {
            color: var(--mat-sys-on-surface);
          }
        }

        .dialog-content {
          p {
            color: var(--mat-sys-on-surface-variant);
          }

          .room-info {
            background: rgba(244, 67, 54, 0.2);
          }
        }

        .dialog-actions {
          border-top-color: var(--mat-sys-outline);

          .cancel-dialog-btn {
            color: var(--mat-sys-on-surface-variant);
            border-color: var(--mat-sys-outline);

            &:hover {
              background: var(--mat-sys-surface-container-high);
              border-color: var(--mat-sys-outline-variant);
            }
          }
        }
      }
    }
  `]
})
export class RoomDeletionConfirmationDialog {
  constructor(
    public dialogRef: MatDialogRef<RoomDeletionConfirmationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
