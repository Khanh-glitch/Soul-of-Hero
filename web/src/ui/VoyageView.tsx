import { HOUR } from '../game/core';
import { evacSiteName, type EvacTrip } from '../game/humanworld';

/** Passage is shown from the sealed manifest, never from the last island tile. */
export function VoyageView({trip, at, onMenu}: {trip:EvacTrip; at:number; onMenu:()=>void}) {
  const wreck = !!trip.vessel?.stranded;
  const begin = trip.departAt ?? at, end = trip.arriveAt ?? at;
  const shownAt = wreck ? trip.phaseAt ?? at : at;
  const fraction = Math.max(0, Math.min(1, (shownAt-begin)/Math.max(1,end-begin)));
  const minutes = Math.ceil(Math.max(0,end-at)/(HOUR/60));
  const seat = trip.manifest?.find(p=>p.actorId==='player')?.seat;
  return <section aria-label="Sea passage" style={{position:'absolute',inset:0,display:'grid',placeContent:'center',textAlign:'center',background:'#102637',color:'#f1dfb6'}}>
    <small>EVACUATION SERVICE · {evacSiteName(trip.site)}</small>
    <h2>{wreck ? 'Stranded at sea' : 'Under way'}</h2>
    <svg viewBox="0 0 240 48" width="100%" height="64" aria-label="Voyage progress">
      <path d="M8 35H232" stroke="#588392" strokeDasharray="4 4" />
      <g transform={`translate(${10+fraction*200} 10)`} fill={wreck?'#b39081':'#eac581'}>
        <path d="M0 17h24l-5 6H5z M7 16V9h8v7z M17 16V2h2v14z"/>
      </g>
    </svg>
    <strong>{wreck ? trip.failureReason ?? 'Passage interrupted' : `Safe water in ${Math.floor(minutes/60)}h ${minutes%60}m`}</strong>
    <p>{seat!==undefined ? `Seat ${seat+1} · ` : ''}{trip.manifest?.length ?? 0}/{trip.capacity} aboard · Hull {trip.vessel?.hull ?? '—'}</p>
    <button className="btn" onClick={onMenu}>Run menu</button>
  </section>;
}
