// Location suggestion model for search/autocomplete
export type LocationType = 'city' | 'neighborhood' | 'airport' | 'landmark';

export interface LocationSuggestion {
  /** Unique id from API or cache */
  id: string;
  /** Localized display name shown in the UI (e.g., "Cairo") */
  name: string;
  /** Optional secondary line (e.g., "Cairo, Egypt" or district) */
  subText?: string;
  /** Entity kind used for icon/behavior */
  type: LocationType;
  // Optional metadata (keep optional to avoid breaking existing code)
  iataCode?: string;   // for airports
  countryCode?: string;
  lat?: number;
  lng?: number;
}
