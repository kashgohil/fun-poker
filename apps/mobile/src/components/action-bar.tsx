import { useEffect, useState } from 'react';
import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClientMessage, LegalAction } from '@fun-poker/protocol';
import { colors, fontSize, fontWeight, radii, spacing } from '@fun-poker/design';

type Props = {
  legal: LegalAction[];
  onAction: (msg: ClientMessage) => void;
};

function isKind<K extends LegalAction['kind']>(k: K) {
  return (o: LegalAction): o is Extract<LegalAction, { kind: K }> =>
    o.kind === k;
}

export function ActionBar({ legal, onAction }: Props) {
  const fold = legal.find(isKind('fold'));
  const check = legal.find(isKind('check'));
  const call = legal.find(isKind('call'));
  const bet = legal.find(isKind('bet'));
  const raise = legal.find(isKind('raise'));
  const allin = legal.find(isKind('all-in'));
  // Only one of bet/raise can be legal at any given moment.
  const sizing = bet ?? raise;

  // Slider amount — reset to the minimum whenever the legal range changes.
  const sizingMin = sizing?.min ?? 0;
  const sizingMax = sizing?.max ?? 0;
  const [amount, setAmount] = useState(sizingMin);
  useEffect(() => {
    setAmount(sizingMin);
  }, [sizingMin, sizingMax]);

  function confirmSizing() {
    if (!sizing) return;
    const safe = Math.round(Math.max(sizing.min, Math.min(sizing.max, amount)));
    onAction(
      sizing.kind === 'bet'
        ? { type: 'bet', amount: safe }
        : { type: 'raise', amount: safe },
    );
  }

  return (
    <View style={styles.bar}>
      {sizing && (
        <View style={styles.sliderRow}>
          <Text style={styles.amount}>{Math.round(amount).toLocaleString()}</Text>
          <Slider
            style={styles.slider}
            minimumValue={sizing.min}
            maximumValue={sizing.max}
            value={amount}
            step={1}
            onValueChange={setAmount}
            minimumTrackTintColor={colors.accent.gold}
            maximumTrackTintColor={colors.surface.raised}
            thumbTintColor={colors.accent.gold}
          />
          <View style={styles.presetRow}>
            <Preset label="Min" onPress={() => setAmount(sizing.min)} />
            <Preset
              label="½"
              onPress={() =>
                setAmount(
                  Math.round((sizing.min + sizing.max) / 2),
                )
              }
            />
            <Preset label="Max" onPress={() => setAmount(sizing.max)} />
          </View>
        </View>
      )}

      <View style={styles.buttons}>
        {fold && (
          <Btn
            label="Fold"
            color={colors.action.fold}
            onPress={() => onAction({ type: 'fold' })}
          />
        )}
        {check && (
          <Btn
            label="Check"
            color={colors.action.check}
            onPress={() => onAction({ type: 'check' })}
          />
        )}
        {call && (
          <Btn
            label={`Call ${call.amount.toLocaleString()}`}
            color={colors.action.call}
            onPress={() => onAction({ type: 'call' })}
          />
        )}
        {sizing && (
          <Btn
            label={
              sizing.kind === 'bet'
                ? `Bet ${Math.round(amount).toLocaleString()}`
                : `Raise to ${Math.round(amount).toLocaleString()}`
            }
            color={colors.action.raise}
            onPress={confirmSizing}
          />
        )}
        {allin && (
          <Btn
            label={`All-in ${allin.amount.toLocaleString()}`}
            color={colors.accent.gold}
            onPress={() => onAction({ type: 'all-in' })}
          />
        )}
      </View>
    </View>
  );
}

function Btn({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.btn, { backgroundColor: color }]}
      onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.preset} onPress={onPress}>
      <Text style={styles.presetText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.table.feltEdge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  sliderRow: {
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  amount: {
    color: colors.accent.gold,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 32,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.surface.raised,
  },
  presetText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
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
