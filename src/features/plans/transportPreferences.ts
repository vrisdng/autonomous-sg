import { Participant } from '../../types';

export function participantsForTransport(participants: Participant[], transport: 'train' | 'ride') {
  return participants.filter((participant) => participant.transportMode === undefined || participant.transportMode === 'either' || participant.transportMode === transport);
}
