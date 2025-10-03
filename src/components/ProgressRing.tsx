import { trafficLight } from '../utils/trafficLight';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({ percentage, size = 60, strokeWidth = 6, color }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const status = trafficLight(percentage);
  const ringColor = color || (
    status === 'red' ? 'var(--tl-red)' :
    status === 'amber' ? 'var(--tl-amber)' :
    status === 'green' ? 'var(--tl-green)' :
    'var(--tl-done)'
  );

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute text-sm font-semibold"
        style={{ color: ringColor }}
      >
        {percentage}%
      </span>
    </div>
  );
}
