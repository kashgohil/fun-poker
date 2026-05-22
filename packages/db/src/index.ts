// Game code should depend on the repositories. `db` and `schema` are also
// exported, but only for Better Auth's Drizzle adapter.
export { db, type Database } from './client';
export * as schema from './schema';
export { profileRepo, type Profile } from './repositories/profile';
export { chipRepo, STARTING_CHIPS } from './repositories/chips';
