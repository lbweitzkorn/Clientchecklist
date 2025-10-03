export async function getEventSourceHead(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/source-head`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch source head');
  return res.json() as Promise<{ date: string; sourceVersion: number; }>;
}

export async function updateEventDate(eventId: string, dateISO: string, clientMutationId?: string, force = false) {
  const res = await fetch(`/api/events/${eventId}/date`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ date: dateISO, clientMutationId, force }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true; sourceVersion: number }>;
}

export async function recalcTimeline(timelineId: string, opts?: { respectLocks?: boolean; distribution?: 'frontload'|'balanced'|'even' }) {
  const res = await fetch(`/api/timelines/${timelineId}/recalculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ respectLocks: true, distribution: 'frontload', ...opts }),
  });
  if (!res.ok) throw new Error('Failed to recalc');
  return res.json();
}
