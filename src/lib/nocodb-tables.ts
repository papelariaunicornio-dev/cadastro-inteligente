/**
 * NocoDB table ID constants.
 * Populated after running the setup script (src/lib/nocodb-setup.ts).
 *
 * To update: run `npx tsx src/lib/nocodb-setup.ts` and copy the IDs.
 */

export const TABLES = {
  NF_IMPORTS: 'mw9e6bx7f6mw19i',
  NF_ITEMS: 'm6q8qp6yojxn56k',
  PROCESSING_JOBS: 'mhizl7xqrtjy88x',
  PRODUCT_DRAFTS: 'mnuwgpalf4n2ilh',
  USER_SETTINGS: 'mr83q772x5x8y5n',
  USERS: 'mst66b0o5i2gc57',
} as const;

// Validate that tables are configured
export function validateTables(): void {
  const missing = Object.entries(TABLES)
    .filter(([, id]) => !id)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `NocoDB tables not configured: ${missing.join(', ')}.\n` +
      'Run: npx tsx src/lib/nocodb-setup.ts'
    );
  }
}
