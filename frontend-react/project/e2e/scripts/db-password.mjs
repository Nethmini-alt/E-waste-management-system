// Finds the local PostgreSQL password without anyone typing it into the tests:
//   1. E2E_DB_PASSWORD, if set (CI sets this);
//   2. otherwise the Password= in the backend's appsettings.Development.json
//      (gitignored — every member already has their own local copy);
//   3. otherwise appsettings.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../backend/EWasteManagement.API');

function passwordFrom(file) {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(apiDir, file), 'utf8'));
    const match = /Password=([^;]*)/i.exec(json?.ConnectionStrings?.DefaultConnection ?? '');
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function localDbPassword() {
  return process.env.E2E_DB_PASSWORD
    ?? passwordFrom('appsettings.Development.json')
    ?? passwordFrom('appsettings.json')
    ?? 'postgres';
}
