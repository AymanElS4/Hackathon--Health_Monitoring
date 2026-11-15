import { useEffect, useId, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { SOON_TOOLTIP_MS } from '../../config/constants';
import { t } from '../../config/messages.es';

export interface SoonActionProps {
  /** `button` for a dock tab, `link` for a section link. Both are inert until their screen exists. */
  kind: 'button' | 'link';
  children: ReactNode;
  /** Classes of the interactive element. */
  className?: string;
  /** Classes of the wrapper that anchors the tooltip. */
  wrapperClassName?: string;
}

const WRAPPER = 'relative inline-flex';
const TOOLTIP =
  'absolute bottom-full left-1/2 mb-sm -translate-x-1/2 whitespace-nowrap rounded-card bg-ink px-md py-xs text-meta font-semibold text-card shadow-ambient';

/**
 * Disabled-looking action (FR-018). It never navigates. A tap, Enter or focus shows the
 * "Próximamente" tooltip (`role="tooltip"`, linked with `aria-describedby`) for `SOON_TOOLTIP_MS`.
 * At rest the tooltip is not rendered; the same text is also the `title` tooltip.
 */
export function SoonAction({ kind, children, className = '', wrapperClassName = WRAPPER }: SoonActionProps) {
  const tooltipId = useId();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(false), SOON_TOOLTIP_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  const show = () => setShown(true);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    show();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      show();
    }
  };

  const shared = {
    'aria-disabled': 'true' as const,
    'aria-describedby': shown ? tooltipId : undefined,
    title: t('nav.soon'),
    onClick,
    onFocus: show,
    onKeyDown,
    className: `${className} cursor-not-allowed text-ink-secondary`,
  };

  return (
    <span className={wrapperClassName}>
      {kind === 'button' ? (
        <button type="button" {...shared}>
          {children}
        </button>
      ) : (
        <span role="link" tabIndex={0} {...shared}>
          {children}
        </span>
      )}
      {shown && (
        <span role="tooltip" id={tooltipId} className={TOOLTIP}>
          {t('nav.soon')}
        </span>
      )}
    </span>
  );
}
