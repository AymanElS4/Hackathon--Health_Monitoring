import type { CheckRepository } from '../ports/check-repository.port';
import { SyncCheck } from '../../domain/sync-check';
import { toStoredCheck } from '../../domain/to-stored-check';

/**
 * One validation problem: where it is and what is wrong. Messages are fixed strings and never echo
 * input; Zod's default messages for `invalid_enum_value`, `unrecognized_keys` and `invalid_literal`
 * embed the received value or key, so `issueMessage` replaces them.
 */
export type IngestIssue = { path: (string | number)[]; message: string };

/** Issue codes whose Zod default message echoes received input, mapped to a fixed message. */
const ECHOING_MESSAGES: Partial<Record<string, string>> = {
  invalid_enum_value: 'value not allowed',
  unrecognized_keys: 'unknown field',
  invalid_literal: 'value not allowed',
};

/** Returns the fixed message for an issue, or Zod's own message for codes that do not echo input. */
function issueMessage(issue: { code: string; message: string }): string {
  return ECHOING_MESSAGES[issue.code] ?? issue.message;
}

/** Outcome of ingesting a check: created or duplicate with the stored id, or invalid with issues. */
export type IngestResult =
  | { status: 'created' | 'duplicate'; id: string }
  | { status: 'invalid'; issues: IngestIssue[] };

/**
 * Validates an untrusted `POST /api/v1/checks` body, maps it to the stored shape and saves it.
 * Repository errors propagate to the caller.
 */
export async function ingestCheck(repo: CheckRepository, body: unknown): Promise<IngestResult> {
  const parsed = SyncCheck.safeParse(body);
  if (!parsed.success) {
    return {
      status: 'invalid',
      issues: parsed.error.issues.map((issue) => ({ path: [...issue.path], message: issueMessage(issue) })),
    };
  }

  const { check, alert } = toStoredCheck(parsed.data);
  const saved = await repo.saveCheck(check, alert);
  return { status: saved.status, id: saved.id };
}
