import type { ReactNode } from 'react';
import { Mic } from 'lucide-react';
import { t } from '../../../config/messages.es';

/** Vita's round avatar: the same Mic icon as the Vita button of the dock. */
function VitaAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex h-avatar w-avatar shrink-0 items-center justify-center rounded-full bg-primary text-card"
    >
      <Mic className="h-lg w-lg" />
    </span>
  );
}

/** A Vita row: avatar on the left, its content (a bubble or the verdict card) on the right. */
export function VitaRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-sm">
      <VitaAvatar />
      <div className="flex min-w-0 max-w-xl flex-col">{children}</div>
    </div>
  );
}

/** Vita's text bubble: white, on the left. */
export function VitaBubble({ text }: { text: string }) {
  return <p className="rounded-card bg-card px-lg py-md text-body text-ink shadow-ambient">{text}</p>;
}

export interface AnaBubbleProps {
  text: string;
  /** Dashed while the heard value waits for its confirmation; solid once confirmed. */
  live: boolean;
}

/** Ana's bubble on the right: primary with white text when confirmed, dashed while live (T080a). */
export function AnaBubble({ text, live }: AnaBubbleProps) {
  const style = live
    ? 'border-2 border-dashed border-primary bg-card text-ink'
    : 'bg-primary text-card shadow-primary';
  return (
    <div className="flex justify-end">
      <p className={`max-w-xl rounded-card px-lg py-md text-body ${style}`}>
        {live ? t('chat.partial', { text }) : text}
      </p>
    </div>
  );
}
