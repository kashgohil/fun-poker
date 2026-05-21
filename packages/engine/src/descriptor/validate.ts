import type { DeckSpec, Variant } from './variant';

// More than four wild cards turns the game chaotic rather than fun, so a
// variant descriptor with a larger wild count is rejected before play.
export const MAX_WILD_CARDS = 4;

// Total number of wild cards a variant's deck would contain. Jokers are the
// only wild cards, so this is simply the joker count.
export function countWildCards(deck: DeckSpec): number {
  return deck.jokers;
}

// Returns a list of descriptor problems; an empty list means the variant is OK.
export function validateVariant(variant: Variant): string[] {
  const errors: string[] = [];

  const wildCount = countWildCards(variant.deck);
  if (wildCount > MAX_WILD_CARDS) {
    errors.push(
      `variant "${variant.id}" has ${wildCount} wild cards; ` +
        `the maximum is ${MAX_WILD_CARDS}`,
    );
  }

  return errors;
}
