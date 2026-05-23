import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClientMessage, LegalAction } from '@fun-poker/protocol';
import { colors, fontSize, fontWeight, radii, spacing } from '@fun-poker/design';

type Props = {
  legal: LegalAction[];
  onAction: (msg: ClientMessage) => void;
};

// MVP: bet/raise fire at the minimum legal amount (no slider yet).
export function ActionBar({ legal, onAction }: Props) {
  const buttons = legal.map((option) => button(option, onAction));
  return <View style={styles.bar}>{buttons}</View>;
}

function button(
  option: LegalAction,
  onAction: (msg: ClientMessage) => void,
) {
  switch (option.kind) {
    case 'fold':
      return key('fold', 'Fold', colors.action.fold, () =>
        onAction({ type: 'fold' }),
      );
    case 'check':
      return key('check', 'Check', colors.action.check, () =>
        onAction({ type: 'check' }),
      );
    case 'call':
      return key(
        'call',
        `Call ${option.amount.toLocaleString()}`,
        colors.action.call,
        () => onAction({ type: 'call' }),
      );
    case 'bet':
      return key(
        'bet',
        `Bet ${option.min.toLocaleString()}`,
        colors.action.raise,
        () => onAction({ type: 'bet', amount: option.min }),
      );
    case 'raise':
      return key(
        'raise',
        `Raise to ${option.min.toLocaleString()}`,
        colors.action.raise,
        () => onAction({ type: 'raise', amount: option.min }),
      );
    case 'all-in':
      return key(
        'all-in',
        `All-in ${option.amount.toLocaleString()}`,
        colors.accent.gold,
        () => onAction({ type: 'all-in' }),
      );
  }
}

function key(
  k: string,
  label: string,
  color: string,
  onPress: () => void,
) {
  return (
    <Pressable
      key={k}
      style={[styles.btn, { backgroundColor: color }]}
      onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.table.feltEdge,
    flexWrap: 'wrap',
  },
  btn: {
    flexGrow: 1,
    flexBasis: 80,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  btnText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
