import type { ReactNode } from 'react';

export function Icon({ name }: { name: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    health: <><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /><path d="M5 12h4l2-3 3 6 2-3h3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    guide: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22Z" /><path d="M4 5.5V22m4-15h8m-8 4h8" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    orbit: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-32 12 12)" /><circle cx="4" cy="17" r="1" fill="currentColor" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
    pulse: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    pressure: <><path d="M4 15a8 8 0 1 1 16 0v3H4Z" /><path d="m12 13 3-4m-9 9h12" /></>,
    oxygen: <><path d="M12 21s7-4.4 7-11a4 4 0 0 0-7-2.6A4 4 0 0 0 5 10c0 6.6 7 11 7 11Z" /><path d="M8 12h2l1-2 2 4 1-2h2" /></>,
    temperature: <><path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z" /><path d="M11 11v6" /></>,
    sleep: <><path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z" /><path d="M16 3v4m-2-2h4" /></>,
    flask: <><path d="M9 3h6m-5 0v6l-5.8 9.2A2 2 0 0 0 6.9 21h10.2a2 2 0 0 0 1.7-2.8L13 9V3" /><path d="M8 15h8" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    trend: <><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>{paths[name] ?? paths.spark}</svg>;
}
