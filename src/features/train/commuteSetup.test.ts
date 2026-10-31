import { describe, expect, it } from 'vitest';
import { commuteSetup, lastCallGroup } from './commuteSetup';
import { verifiedVenues } from '../../data/venues';
import { PlanDraft } from '../../types';
import { groupLeaveBy } from '../travel/types';

describe('partial commute setup', () => {
  it('is usable with no plan', () => {
    expect(commuteSetup(null)).toEqual({venue:undefined,people:[],readyPeople:[],missingPeople:[]});
  });
  it('allows a ready traveller without waiting for everyone else', () => {
    const plan: PlanDraft={code:'ABC234',chosenVenue:verifiedVenues[0],participants:[
      {id:'ready',name:'Ready',origin:'Home',location:{label:'Home',latitude:1.3,longitude:103.8}},
      {id:'missing',name:'Missing',origin:''},
      {id:'ride',name:'Ride',origin:'',transportMode:'ride'},
    ]};
    const setup=commuteSetup(plan);
    expect(setup.venue?.id).toBe(verifiedVenues[0]!.id);
    expect(setup.readyPeople.map((person)=>person.id)).toEqual(['ready']);
    expect(setup.missingPeople.map((person)=>person.id)).toEqual(['missing']);
    expect(groupLeaveBy([],setup.people.map((person)=>person.id),15)).toBe(null);
  });
  it('builds the group roster from live party members and leaves ride-only friends off', () => {
    const plan: PlanDraft={code:'ABC234',participants:[
      {id:'ada',name:'Ada',origin:'',transportMode:'ride'},
      {id:'lex',name:'Lex',origin:'',transportMode:'either'},
      {id:'ada',name:'Ada duplicate',origin:''},
      {id:'gauge',name:'Gauge',origin:'',transportMode:'ride'},
      {id:'jun',name:'Jun',origin:'',transportMode:'train'},
    ],remote:{role:'guest',participantId:'ada',published:true}};
    expect(lastCallGroup(plan).map(person=>person.id)).toEqual(['ada','lex','jun']);
    const live=plan.participants.filter(person=>person.name!=='Lex'&&person.name!=='Ada duplicate');
    expect(lastCallGroup({...plan,participants:live,remote:{role:'guest',participantId:'jun',published:true}}).map(person=>person.name)).toEqual(['Jun']);
  });
  it('does not accept a prototype or unresolved venue', () => {
    expect(commuteSetup({code:'ABC234',participants:[],chosenVenue:{...verifiedVenues[0]!,source:'prototype'}}).venue).toBeUndefined();
    expect(commuteSetup({code:'ABC234',participants:[],chosenVenue:{...verifiedVenues[0]!,latitude:undefined}}).venue).toBeUndefined();
  });
});
