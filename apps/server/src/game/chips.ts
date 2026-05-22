// The chip bank, abstracted so the game loop does not depend directly on the
// database. Production uses the Postgres-backed `chipRepo` from @fun-poker/db;
// tests inject an in-memory fake. `chipRepo` already satisfies this shape.
export interface ChipService {
  getBalance(userId: string): Promise<number>;
  ensureWallet(userId: string): Promise<void>;
  // Applies a signed delta; throws if the balance would go negative.
  adjust(userId: string, delta: number, reason: string): Promise<number>;
}
