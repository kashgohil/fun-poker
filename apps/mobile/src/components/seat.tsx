import { StyleSheet, Text, View } from 'react-native';
import type { SeatState } from '@fun-poker/protocol';
import { colors, fontSize, fontWeight, radii, spacing } from '@fun-poker/design';

type Props = {
  seat: SeatState;
  isHero: boolean;
  isToAct: boolean;
};

export function Seat({ seat, isHero, isToAct }: Props) {
  const folded = seat.status === 'folded';
  return (
    <View
      style={[
        styles.box,
        isHero && styles.heroBox,
        isToAct && styles.toActBox,
        folded && styles.foldedBox,
      ]}>
      <Text style={styles.name} numberOfLines={1}>
        {seat.displayName}
        {seat.hasButton ? '  ●' : ''}
      </Text>
      <Text style={styles.stack}>{seat.stack.toLocaleString()}</Text>
      {seat.currentBet > 0 && (
        <Text style={styles.bet}>{seat.currentBet.toLocaleString()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface.raised,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 96,
    alignItems: 'center',
  },
  heroBox: {
    borderColor: colors.accent.info,
  },
  toActBox: {
    borderColor: colors.accent.gold,
  },
  foldedBox: {
    opacity: 0.4,
  },
  name: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  stack: {
    color: colors.accent.gold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  bet: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
