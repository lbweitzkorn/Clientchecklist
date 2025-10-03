import { differenceInDays, isPast, isToday, parseISO } from 'date-fns';

export interface CountdownResult {
  days: number;
  isPast: boolean;
  isToday: boolean;
  formatted: string;
}

export function calculateCountdown(eventDateString: string | undefined): CountdownResult | null {
  if (!eventDateString) {
    return null;
  }

  try {
    const eventDate = parseISO(eventDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = differenceInDays(eventDate, today);
    const past = isPast(eventDate) && !isToday(eventDate);
    const today_flag = isToday(eventDate);

    let formatted = '';
    if (today_flag) {
      formatted = 'Today!';
    } else if (past) {
      formatted = `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
    } else {
      formatted = `${days} day${days !== 1 ? 's' : ''} until event`;
    }

    return {
      days,
      isPast: past,
      isToday: today_flag,
      formatted,
    };
  } catch (error) {
    console.error('Error calculating countdown:', error);
    return null;
  }
}
