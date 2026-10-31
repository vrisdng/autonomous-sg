export type Tab = 'home' | 'meet' | 'split' | 'ride' | 'train';

export type Participant = {
  id: string;
  name: string;
  origin: string;
  transportMode?: TransportMode;
  location?: GeoLocation;
};

export type GeoLocation = { label: string; latitude: number; longitude: number };

export type TransportMode = 'train' | 'ride' | 'either';

export type PlanDraft = {
  code: string;
  participants: Participant[];
  chosenVenueId?: string;
  chosenVenue?: Place;
  status?: 'planning' | 'closed';
  expiresAt?: string;
  meetupAt?: string;
  commuteAt?: string;
  revision?: number;
  pendingSync?: boolean;
  syncedParticipants?: Participant[];
  remote?: {
    role: 'host' | 'guest';
    hostToken?: string;
    guestToken?: string;
    participantId?: string;
    published?: boolean;
  };
};

export type Place = {
  priceLabel?: string;
  photos?: {name:string;authorAttributions?:{displayName:string;uri?:string}[]}[];
  rating?: number;
  reviewCount?: number;
  regularHours?: { weekdayDescriptions?: string[]; periods?: any[] };
  currentHours?: { weekdayDescriptions?: string[]; periods?: any[] };
  businessStatus?: string;
  attributions?: { provider: string; uri?: string }[];
  id: string;
  name: string;
  area: string;
  nearestStation: string;
  detail: string;
  openUntil: string;
  tags: string[];
  point: { x: number; y: number };
  address?: string;
  isOpenNow?: boolean;
  providerPlaceId?: string;
  latitude?: number;
  longitude?: number;
  source: 'prototype' | 'google_places' | 'verified' | 'onemap';
  sourceTimestamp?: string;
  sourceUrl?: string;
  geocodeQuery?: string;
};
