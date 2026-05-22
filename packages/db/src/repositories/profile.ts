import { eq } from 'drizzle-orm';
import { db } from '../client';
import { user } from '../schema';

export type Profile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

// Read access to a player's profile. The `user` table is owned by Better
// Auth; this repository is the game code's read-only view of it.
export const profileRepo = {
  async findById(userId: string): Promise<Profile | null> {
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  },
};
