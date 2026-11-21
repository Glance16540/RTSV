// Couriers, a study of the nation's (studies.ts): decrees sent by messenger are the stronger (decrees.ts).
import { yamRides } from './ownstudies';
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

/** A messenger's decree's strength with couriers: the halved strength raised to this. */
export const COURIERS = { strength: 0.75 };
/** How strong a decree is by messenger for this nation: `messenger`, or COURIERS.strength once it has couriers. */
export const messengerStrength = (c: Campaign, f: number, messenger: number): number => (yamRides(c, f) ? 1 : hasStudy(c, f, 'couriers') ? Math.max(messenger, COURIERS.strength) : messenger); // the Mongols' Yam: full strength (ownstudies.ts)
