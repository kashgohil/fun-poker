import { eq } from 'drizzle-orm';
import { db } from '../client';
import { chipLedger, wallet } from '../schema';

// Chips granted to a brand-new play-money account.
export const STARTING_CHIPS = 100_000;

// The chip bank. Every balance change goes through `adjust`, which is
// transactional and records a ledger entry — so chips can never be silently
// lost and every movement is auditable.
export const chipRepo = {
  async getBalance(userId: string): Promise<number> {
    const rows = await db
      .select({ balance: wallet.balance })
      .from(wallet)
      .where(eq(wallet.userId, userId))
      .limit(1);
    return rows[0]?.balance ?? 0;
  },

  // Creates the wallet with a starting balance if it does not exist yet.
  async ensureWallet(
    userId: string,
    starting: number = STARTING_CHIPS,
  ): Promise<void> {
    await db
      .insert(wallet)
      .values({ userId, balance: starting })
      .onConflictDoNothing();
  },

  // Atomically applies a signed chip delta and appends a ledger entry.
  // Throws if the change would drop the balance below zero.
  async adjust(
    userId: string,
    delta: number,
    reason: string,
  ): Promise<number> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({ balance: wallet.balance })
        .from(wallet)
        .where(eq(wallet.userId, userId))
        .limit(1)
        .for('update');

      const current = rows[0]?.balance ?? 0;
      const next = current + delta;
      if (next < 0) throw new Error('insufficient chip balance');

      if (rows[0]) {
        await tx
          .update(wallet)
          .set({ balance: next, updatedAt: new Date() })
          .where(eq(wallet.userId, userId));
      } else {
        await tx.insert(wallet).values({ userId, balance: next });
      }

      await tx
        .insert(chipLedger)
        .values({ userId, delta, balanceAfter: next, reason });
      return next;
    });
  },
};
