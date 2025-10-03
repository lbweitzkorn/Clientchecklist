export type TrafficStatus = 'red' | 'amber' | 'green' | 'done';

export function trafficLight(pct: number): TrafficStatus {
  if (pct >= 100) return 'done';
  if (pct >= 90)  return 'green';
  if (pct >= 50)  return 'amber';
  return 'red';
}

export function trafficLabel(s: TrafficStatus): string {
  switch (s) {
    case 'red':   return 'At risk';
    case 'amber': return 'In progress';
    case 'green': return 'On track';
    case 'done':  return 'Complete';
  }
}
