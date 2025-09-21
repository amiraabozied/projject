import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';

import { SearchBoxComponent } from '../../components/search-box/search-box.component';
import { CoreService } from '../../services/core.service';

interface SearchFormData {
  splCode: string;
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    adults: number;
    childrenCount: number;
    bedTypes: Array<{ type: string; quantity: number }>;
    children: Array<{ age: number }>;
  }>;
}

interface FilterOption {
  id: string;
  label: string;
  checked: boolean;
  count?: number;
}

interface PriceRange {
  min: number;
  max: number;
}

interface Filters {
  priceRange: PriceRange;
  propertyTypes: FilterOption[];
  popularFilters: FilterOption[];
  availableHotels: boolean;
  starRatings: FilterOption[];
  guestRatings: FilterOption[];
  districts: FilterOption[];
  amenities: FilterOption[];
}

@Component({
  selector: 'app-rooms-filter',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatIconModule,
    MatSidenavModule,
    MatSliderModule,
    MatCheckboxModule,
    MatButtonModule,
    MatExpansionModule,
    MatChipsModule,
    MatButtonToggleModule,
    SearchBoxComponent
  ],
  templateUrl: './rooms-filter.component.html',
  styleUrl: './rooms-filter.component.scss'
})
export class RoomsFilterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Search state
  searchData: SearchFormData | null = null;
  isLoading = false;

  // Theme and language properties
  isRTL = false;
  isLTR = true;
  currentTheme = 'light';

  // Sidebar state
  isSidebarOpen = true;
  isMobile = false;

  // Filter state
  filters: Filters = {
    priceRange: { min: 0, max: 1000 },
    propertyTypes: [],
    popularFilters: [],
    availableHotels: false,
    starRatings: [],
    guestRatings: [],
    districts: [],
    amenities: []
  };

  // Price range values
  priceMin = 0;
  priceMax = 1000;
  selectedPriceMin = 0;
  selectedPriceMax = 1000;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private coreService: CoreService
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
    this.initializeFilters();
    this.loadSearchFromQueryParams();
    this.checkScreenSize();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    // Get initial options from core service
    const options = this.coreService.getOptions();
    this.updateThemeAndLanguage(options);

    // Watch for changes in core service using effect or manual subscription
    // Since signals don't have subscribe method, we'll use effect in a different way
    // For now, we'll just get the initial state and update manually when needed
  }

  private updateThemeAndLanguage(options: any): void {
    this.isRTL = options.dir === 'rtl';
    this.isLTR = options.dir === 'ltr';
    this.currentTheme = options.theme;

    // Update translate service language
    if (this.translate.currentLang !== options.language) {
      this.translate.use(options.language);
    }
  }

  private loadSearchFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (Object.keys(params).length > 0) {
          this.parseQueryParams(params);
        }
      });
  }

  private parseQueryParams(params: any): void {
    try {
      // Parse search parameters from query string
      const searchData: SearchFormData = {
        splCode: params['location'] || '',
        checkIn: params['checkIn'] || '',
        checkOut: params['checkOut'] || '',
        rooms: []
      };

      // Parse rooms data if available
      if (params['rooms']) {
        try {
          searchData.rooms = JSON.parse(decodeURIComponent(params['rooms']));
        } catch (e) {
          console.warn('Failed to parse rooms data from query params:', e);
          // Set default room if parsing fails
          searchData.rooms = [{
            adults: parseInt(params['adults']) || 2,
            childrenCount: parseInt(params['children']) || 0,
            bedTypes: [],
            children: []
          }];
        }
      } else {
        // Create default room from individual parameters
        searchData.rooms = [{
          adults: parseInt(params['adults']) || 2,
          childrenCount: parseInt(params['children']) || 0,
          bedTypes: [],
          children: []
        }];
      }

      this.searchData = searchData;

      // If we have search data, trigger a search
      if (this.hasValidSearchData(searchData)) {
        this.performSearch(searchData);
      }
    } catch (error) {
      console.error('Error parsing query parameters:', error);
    }
  }

  private hasValidSearchData(data: SearchFormData): boolean {
    return !!(data.splCode && data.checkIn && data.checkOut && data.rooms.length > 0);
  }

  onSearchSubmit(searchData: SearchFormData): void {
    // Update URL with new search parameters
    this.updateUrlWithSearchData(searchData);

    // Perform the search
    this.performSearch(searchData);
  }

  private updateUrlWithSearchData(searchData: SearchFormData): void {
    const queryParams: any = {
      location: searchData.splCode,
      checkIn: searchData.checkIn,
      checkOut: searchData.checkOut,
      rooms: encodeURIComponent(JSON.stringify(searchData.rooms))
    };

    // Add individual parameters for backward compatibility
    if (searchData.rooms.length > 0) {
      const firstRoom = searchData.rooms[0];
      queryParams.adults = firstRoom.adults;
      queryParams.children = firstRoom.childrenCount;
    }

    // Update URL without reloading the page
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace'
    });
  }

  private performSearch(searchData: SearchFormData): void {
    this.isLoading = true;
    this.searchData = searchData;

    // Simulate search API call
    // In a real application, you would call your search service here
    setTimeout(() => {
      this.isLoading = false;
      console.log('Search performed with data:', searchData);

      // Here you would typically:
      // 1. Call your search API
      // 2. Update the results
      // 3. Handle any errors
    }, 1000);
  }

  // Helper method to get search summary for display
  getSearchSummary(): string {
    if (!this.searchData) return '';

    const { rooms } = this.searchData;
    const totalAdults = rooms.reduce((sum, room) => sum + room.adults, 0);
    const totalChildren = rooms.reduce((sum, room) => sum + room.childrenCount, 0);

    const params = {
      rooms: rooms.length,
      adults: totalAdults,
      children: totalChildren
    };

    if (totalAdults === 1 && totalChildren === 1) {
      return this.translate.instant('search.guestSummarySingle', params);
    }
    return this.translate.instant('search.guestSummary', params);
  }

  // Helper method to format date range
  getDateRangeSummary(): string {
    if (!this.searchData?.checkIn || !this.searchData?.checkOut) return '';

    const checkIn = new Date(this.searchData.checkIn);
    const checkOut = new Date(this.searchData.checkOut);

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    const locale = this.isRTL ? 'ar' : 'en';
    const checkInStr = checkIn.toLocaleDateString(locale, options);
    const checkOutStr = checkOut.toLocaleDateString(locale, options);

    // Calculate nights
    const timeDiff = checkOut.getTime() - checkIn.getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));

    const nightsText = nights === 1
      ? this.translate.instant('search.night')
      : this.translate.instant('search.nights');

    return `${checkInStr} - ${checkOutStr} · ${nights} ${nightsText}`;
  }

  // Filter initialization and management methods
  private initializeFilters(): void {
    this.filters = {
      priceRange: { min: 0, max: 1000 },
      propertyTypes: [
        { id: 'hotel', label: 'filters.propertyTypes.hotel', checked: false, count: 245 },
        { id: 'apartment', label: 'filters.propertyTypes.apartment', checked: false, count: 89 },
        { id: 'resort', label: 'filters.propertyTypes.resort', checked: false, count: 34 },
        { id: 'villa', label: 'filters.propertyTypes.villa', checked: false, count: 67 },
        { id: 'guesthouse', label: 'filters.propertyTypes.guesthouse', checked: false, count: 23 }
      ],
      popularFilters: [
        { id: 'freeCancellation', label: 'filters.popular.freeCancellation', checked: false, count: 156 },
        { id: 'bedBreakfast', label: 'filters.popular.bedBreakfast', checked: false, count: 78 },
        { id: 'freeWifi', label: 'filters.popular.freeWifi', checked: false, count: 234 },
        { id: 'pool', label: 'filters.popular.pool', checked: false, count: 45 },
        { id: 'parking', label: 'filters.popular.parking', checked: false, count: 123 }
      ],
      availableHotels: false,
      starRatings: [
        { id: '5star', label: '5', checked: false, count: 12 },
        { id: '4star', label: '4', checked: false, count: 45 },
        { id: '3star', label: '3', checked: false, count: 89 },
        { id: '2star', label: '2', checked: false, count: 67 },
        { id: '1star', label: '1', checked: false, count: 23 }
      ],
      guestRatings: [
        { id: 'excellent', label: 'filters.guestRating.excellent', checked: false, count: 34 },
        { id: 'veryGood', label: 'filters.guestRating.veryGood', checked: false, count: 78 },
        { id: 'good', label: 'filters.guestRating.good', checked: false, count: 123 },
        { id: 'fair', label: 'filters.guestRating.fair', checked: false, count: 45 }
      ],
      districts: [
        { id: 'downtown', label: 'filters.districts.downtown', checked: false, count: 89 },
        { id: 'oldCity', label: 'filters.districts.oldCity', checked: false, count: 56 },
        { id: 'beachfront', label: 'filters.districts.beachfront', checked: false, count: 34 },
        { id: 'airport', label: 'filters.districts.airport', checked: false, count: 23 },
        { id: 'businessDistrict', label: 'filters.districts.businessDistrict', checked: false, count: 67 }
      ],
      amenities: [
        { id: 'wifi', label: 'filters.amenities.wifi', checked: false, count: 234 },
        { id: 'parking', label: 'filters.amenities.parking', checked: false, count: 123 },
        { id: 'pool', label: 'filters.amenities.pool', checked: false, count: 45 },
        { id: 'gym', label: 'filters.amenities.gym', checked: false, count: 67 },
        { id: 'spa', label: 'filters.amenities.spa', checked: false, count: 23 },
        { id: 'restaurant', label: 'filters.amenities.restaurant', checked: false, count: 156 },
        { id: 'roomService', label: 'filters.amenities.roomService', checked: false, count: 89 },
        { id: 'airConditioning', label: 'filters.amenities.airConditioning', checked: false, count: 198 }
      ]
    };

    // Set initial price range
    this.selectedPriceMin = this.filters.priceRange.min;
    this.selectedPriceMax = this.filters.priceRange.max;
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
    this.isSidebarOpen = !this.isMobile;
  }

  // Filter event handlers
  onPriceRangeChange(): void {
    this.filters.priceRange.min = this.selectedPriceMin;
    this.filters.priceRange.max = this.selectedPriceMax;
    this.updateFiltersInUrl();
  }

  onFilterOptionChange(category: keyof Filters, optionId: string): void {
    const filterArray = this.filters[category] as FilterOption[];
    if (filterArray) {
      const option = filterArray.find(opt => opt.id === optionId);
      if (option) {
        option.checked = !option.checked;
        this.updateFiltersInUrl();
      }
    }
  }

  onAvailableHotelsChange(): void {
    this.filters.availableHotels = !this.filters.availableHotels;
    this.updateFiltersInUrl();
  }

  // Sidebar management
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  // Clear filters
  clearAllFilters(): void {
    this.initializeFilters();
    this.updateFiltersInUrl();
  }

  clearFilterCategory(category: keyof Filters): void {
    if (category === 'priceRange') {
      this.selectedPriceMin = 0;
      this.selectedPriceMax = 1000;
      this.filters.priceRange = { min: 0, max: 1000 };
    } else if (category === 'availableHotels') {
      this.filters.availableHotels = false;
    } else {
      const filterArray = this.filters[category] as FilterOption[];
      if (filterArray) {
        filterArray.forEach(option => option.checked = false);
      }
    }
    this.updateFiltersInUrl();
  }

  // Get active filters count
  getActiveFiltersCount(): number {
    let count = 0;

    // Check price range
    if (this.selectedPriceMin > 0 || this.selectedPriceMax < 1000) {
      count++;
    }

    // Check available hotels
    if (this.filters.availableHotels) {
      count++;
    }

    // Check other filter categories
    Object.keys(this.filters).forEach(key => {
      if (key !== 'priceRange' && key !== 'availableHotels') {
        const filterArray = this.filters[key as keyof Filters] as FilterOption[];
        if (filterArray) {
          count += filterArray.filter(option => option.checked).length;
        }
      }
    });

    return count;
  }

  // Update URL with current filters
  private updateFiltersInUrl(): void {
    const currentParams = { ...this.route.snapshot.queryParams };

    // Add filter parameters
    const activeFilters: any = {};

    // Price range
    if (this.selectedPriceMin > 0 || this.selectedPriceMax < 1000) {
      activeFilters.priceMin = this.selectedPriceMin;
      activeFilters.priceMax = this.selectedPriceMax;
    }

    // Available hotels
    if (this.filters.availableHotels) {
      activeFilters.availableOnly = 'true';
    }

    // Other filters
    Object.keys(this.filters).forEach(key => {
      if (key !== 'priceRange' && key !== 'availableHotels') {
        const filterArray = this.filters[key as keyof Filters] as FilterOption[];
        if (filterArray) {
          const checkedOptions = filterArray.filter(option => option.checked).map(option => option.id);
          if (checkedOptions.length > 0) {
            activeFilters[key] = checkedOptions.join(',');
          }
        }
      }
    });

    // Merge with existing search params
    const queryParams = { ...currentParams, ...activeFilters };

    // Remove empty parameters
    Object.keys(queryParams).forEach(key => {
      if (!queryParams[key] || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    // Update URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace'
    });
  }

  // Window resize handler
  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkScreenSize();
  }
}
