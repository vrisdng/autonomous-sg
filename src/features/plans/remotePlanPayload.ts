import { Participant } from '../../types';
import { normalizePlanCode } from './links';
import { parseLivePlaces } from '../meet/livePlaces';
import { Place } from '../../types';
import { validLocation } from '../travel/types';
import { googleReference } from '../meet/googlePlace';

export type RemotePlanPayload = {
  code: string;
  participants: Participant[];
  syncedParticipants?: Participant[];
  chosenVenueId?: string;
  chosenVenue?: Place;
  status?: 'planning' | 'closed';
  expiresAt?: string;
  meetupAt?: string;
  commuteAt?: string;
  revision?: number;
};

export type RpcPlan = {
  code?: unknown;
  participants?: unknown;
  chosen_venue_id?: unknown;
  chosen_venue?: unknown;
  chosen_venue_source_timestamp?: unknown;
  participant_id?: unknown;
  status?: unknown;
  expires_at?: unknown;
  meetup_at?: unknown;
  commute_at?: unknown;
  revision?: unknown;
};

export function parseRemotePlan(value: unknown): RemotePlanPayload {
  const row = value as RpcPlan | null;
  const code = typeof row?.code === 'string' ? normalizePlanCode(row.code) : '';
  const participants = Array.isArray(row?.participants) ? row.participants.filter(isParticipant).map((participant) => ({ ...participant, transportMode: participant.transportMode ?? 'either' as const })) : [];
  const chosenVenueId = typeof row?.chosen_venue_id === 'string' ? row.chosen_venue_id : undefined;
  const rawVenue = row?.chosen_venue as Place | undefined;
  const chosenVenue = rawVenue && ['verified', 'onemap'].includes(rawVenue.source) && typeof rawVenue.id === 'string' && validLocation({ label: rawVenue.name, latitude: rawVenue.latitude, longitude: rawVenue.longitude })
    ? rawVenue : googleReference(rawVenue) ?? googleReference(parseLivePlaces({ places: row?.chosen_venue ? [row.chosen_venue] : [], sourceTimestamp: row?.chosen_venue_source_timestamp })[0]);
  const status = row?.status === 'closed' ? 'closed' : row?.status === 'planning' ? 'planning' : undefined;
  const expiresAt = typeof row?.expires_at === 'string' ? row.expires_at : undefined;
  if (!code || participants.length < 1) throw new Error('This plan is unavailable or has expired.');
  const meetupAt=typeof row?.meetup_at === 'string' ? row.meetup_at : undefined;
  const commuteAt=typeof row?.commute_at === 'string' ? row.commute_at : undefined;
  const revision=typeof row?.revision === 'number' ? row.revision : undefined;
  return { code, participants, syncedParticipants: participants,
    ...(chosenVenueId?{chosenVenueId}:{}),...(chosenVenue ? { chosenVenue } : {}),...(status?{status}:{}),...(expiresAt?{expiresAt}:{}),
    ...(meetupAt?{meetupAt}:{}),...(commuteAt?{commuteAt}:{}),...(revision!==undefined?{revision}:{}) };
}

function isParticipant(value: unknown): value is Participant {
  if (!value || typeof value !== 'object') return false;
  const participant = value as Partial<Participant>;
  return typeof participant.id === 'string' && typeof participant.name === 'string' && typeof participant.origin === 'string'
    && (participant.transportMode === undefined || ['train', 'ride', 'either'].includes(participant.transportMode));
}
