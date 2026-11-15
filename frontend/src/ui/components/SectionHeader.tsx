export interface SectionHeaderProps {
  title: string;
  /** Optional secondary line; not rendered when absent. */
  subtitle?: string;
}

/** Title of a screen section with an optional subtitle. */
export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <header className="flex flex-col gap-xs">
      <h2 className="text-title font-semibold text-ink">{title}</h2>
      {subtitle !== undefined && <p className="text-small text-ink-secondary">{subtitle}</p>}
    </header>
  );
}
