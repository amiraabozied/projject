export interface BedType {
  type: string;
  count: number;
  maxCount?: number;
}

export interface RoomConfiguration {
  room: number;
  adults: number;
  children: number[];
  beds: BedType[];
}

export interface GuestRoomSummary {
  totalRooms: number;
  totalAdults: number;
  totalChildren: number;
  rooms: RoomConfiguration[];
}

export interface BedTypeOption {
  id: string;
  name: string;
  icon: string;
  maxPerRoom: number;
  selected: boolean;
  count: number;
}

export const DEFAULT_BED_TYPES: BedTypeOption[] = [
  {
    id: 'single',
    name: 'سرير فردي',
    icon: 'single_bed',
    maxPerRoom: 4,
    selected: false,
    count: 0
  },
  {
    id: 'double',
    name: 'سرير مزدوج',
    icon: 'bed',
    maxPerRoom: 2,
    selected: false,
    count: 0
  },
  {
    id: 'queen',
    name: 'سرير كوين',
    icon: 'king_bed',
    maxPerRoom: 2,
    selected: false,
    count: 0
  },
  {
    id: 'king',
    name: 'سرير كينج',
    icon: 'king_bed',
    maxPerRoom: 1,
    selected: false,
    count: 0
  }
];

export const CHILD_AGES = Array.from({ length: 17 }, (_, i) => i + 1);

export const MAX_ROOMS = 4;
export const MAX_ADULTS_PER_ROOM = 6;
export const MAX_CHILDREN_PER_ROOM = 4;
export const MAX_BEDS_PER_ROOM = 4;
