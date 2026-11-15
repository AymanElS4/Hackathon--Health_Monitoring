import { useEffect, useState } from 'react';
import type { CheckinSnapshot } from '../application/use-cases/runCheckin';
import { advanceConversation, createConversationState, type ChatMessage } from './conversation';

/**
 * The chat transcript of the check-in (T080a). Each new runner snapshot is folded into the state
 * once; `advanceConversation` is idempotent, so a repeated effect (React StrictMode) adds nothing.
 */
export function useConversation(snapshot: CheckinSnapshot): readonly ChatMessage[] {
  const [state, setState] = useState(createConversationState);
  useEffect(() => {
    setState((previous) => advanceConversation(previous, snapshot));
  }, [snapshot]);
  return state.messages;
}
