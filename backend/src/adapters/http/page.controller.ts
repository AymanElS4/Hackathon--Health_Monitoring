import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { MESSAGES_ES } from '../../config/messages.es';
import { PUBLIC_DIR } from '../../config/constants';

// The surgeon page. It holds no data: every data call goes to the guarded `/api/v1/surgeon/*` routes.
// Mounted outside the API prefix (see `configure-app.ts`).

export const PAGE_ROUTE = 'cirujano';

const PAGE_FILE = 'cirujano.html';
const HTML_TYPE = 'text/html; charset=utf-8';
const CSS_TYPE = 'text/css; charset=utf-8';
const JS_TYPE = 'text/javascript; charset=utf-8';
const TEXT_TYPE = 'text/plain; charset=utf-8';
const NOT_FOUND_BODY = 'Not Found';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const CACHE_CONTROL = 'no-store';

/** Headers sent with every page and asset response. */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; " +
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': CACHE_CONTROL,
};

type Asset = { contentType: string; load: () => string };

/** Whitelist of assets served under `/cirujano/assets/`. Any other name is a 404. */
const ASSETS: Record<string, Asset> = {
  'cirujano.css': { contentType: CSS_TYPE, load: () => readPublicFile('cirujano.css') },
  'cirujano.js': { contentType: JS_TYPE, load: () => readPublicFile('cirujano.js') },
  'messages.js': {
    contentType: JS_TYPE,
    load: () => `window.MESSAGES = ${JSON.stringify(MESSAGES_ES)};\n`,
  },
};

function readPublicFile(name: string): string {
  return fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8');
}

/** Serves the surgeon page and its whitelisted static assets, with the page security headers. */
@Controller(PAGE_ROUTE)
export class PageController {
  @Get()
  page(@Res() res: Response): void {
    send(res, HTTP_OK, HTML_TYPE, () => readPublicFile(PAGE_FILE));
  }

  @Get('assets/:name')
  asset(@Param('name') name: string, @Res() res: Response): void {
    // Lookup in the whitelist only: the name never reaches the file system.
    const asset = Object.prototype.hasOwnProperty.call(ASSETS, name) ? ASSETS[name] : undefined;
    if (asset === undefined) {
      send(res, HTTP_NOT_FOUND, TEXT_TYPE, () => NOT_FOUND_BODY);
      return;
    }
    send(res, HTTP_OK, asset.contentType, asset.load);
  }
}

function send(res: Response, status: number, contentType: string, body: () => string): void {
  res.status(status);
  res.set(SECURITY_HEADERS);
  res.set('Content-Type', contentType);
  res.send(body());
}
