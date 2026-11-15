import { Injectable } from '@nestjs/common';
import type { Clock } from '../../application/ports/clock.port';

/** Clock backed by the host system time. */
@Injectable()
export class SystemClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
