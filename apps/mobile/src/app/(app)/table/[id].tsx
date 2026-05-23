import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ClientMessage } from '@fun-poker/protocol';
import {
  colors,
  fontSize,
  fontWeight,
  seatPositions,
  spacing,
} from '@fun-poker/design';
import { authClient } from '@/lib/auth-client';
import { connectGameSocket, type GameSocket } from '@/lib/ws';
import { useGame } from '@/lib/game-store';
import { PlayingCard } from '@/components/card';
import { Seat } from '@/components/seat';
import { ActionBar } from '@/components/action-bar';

const DEFAULT_BUY_IN = 1000;

export default function Table() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tableId = id ?? 'main';
  const { data: session } = authClient.useSession();
  const meUserId = session?.user.id;

  const socketRef = useRef<GameSocket | null>(null);
  const apply = useGame((s) => s.apply);
  const setConnected = useGame((s) => s.setConnected);
  const reset = useGame((s) => s.reset);

  useEffect(() => {
    reset();
    const socket = connectGameSocket({
      onMessage: apply,
      onConnected: (connected) => {
        setConnected(connected);
        if (connected) {
          socket.send({
            type: 'join-table',
            tableId: tableId,
            buyIn: DEFAULT_BUY_IN,
          });
        }
      },
    });
    socketRef.current = socket;
    return () => {
      try {
        socket.send({ type: 'leave-table', tableId });
      } catch {
        // socket may already be closed
      }
      socket.close();
    };
  }, [apply, setConnected, reset, tableId]);

  const seats = useGame((s) => s.seats);
  const community = useGame((s) => s.community);
  const pots = useGame((s) => s.pots);
  const myHole = useGame((s) => s.myHole);
  const toActSeat = useGame((s) => s.toActSeat);
  const legalActions = useGame((s) => s.legalActions);
  const error = useGame((s) => s.error);
  const lastAwards = useGame((s) => s.lastAwards);

  // Measure the felt as it lays out so seat positions adapt to whatever
  // room the action bar / hero hole row leave on this device.
  const [felt, setFelt] = useState({ width: 0, height: 0 });

  // Rotate seats so the hero sits at the bottom-centre of the layout.
  const orderedSeats = useMemo(() => {
    const all = Object.values(seats).sort((a, b) => a.seat - b.seat);
    if (all.length === 0) return all;
    const heroIdx = all.findIndex((s) => s.userId === meUserId);
    if (heroIdx < 0) return all;
    return [...all.slice(heroIdx), ...all.slice(0, heroIdx)];
  }, [seats, meUserId]);

  const positions = useMemo(
    () =>
      orderedSeats.length === 0 || felt.width === 0
        ? []
        : seatPositions(orderedSeats.length, felt.width / felt.height),
    [orderedSeats.length, felt.width, felt.height],
  );

  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
  const itsMyTurn =
    toActSeat !== null &&
    meUserId !== undefined &&
    seats[toActSeat]?.userId === meUserId;

  function send(msg: ClientMessage) {
    socketRef.current?.send(msg);
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Pressable style={styles.leave} onPress={() => router.back()}>
            <Text style={styles.leaveText}>← Lobby</Text>
          </Pressable>
          <Pressable
            style={styles.shareBtn}
            onPress={() =>
              void Share.share({
                message: `Join my poker table — code ${tableId}`,
              })
            }>
            <Text style={styles.shareLabel}>SHARE CODE</Text>
            <Text style={styles.shareCode}>{tableId}</Text>
          </Pressable>
        </View>

        <View
          style={styles.felt}
          onLayout={(e) =>
            setFelt({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }>
          {totalPot > 0 && felt.height > 0 && (
            <View style={[styles.pot, { top: felt.height * 0.34 }]}>
              <Text style={styles.potLabel}>POT</Text>
              <Text style={styles.potValue}>{totalPot.toLocaleString()}</Text>
            </View>
          )}

          {community.length > 0 && felt.height > 0 && (
            <View
              style={[
                styles.community,
                { top: felt.height * 0.46, width: felt.width },
              ]}>
              {community.map((c, i) => (
                <View key={i} style={styles.communityCard}>
                  <PlayingCard card={c} width={44} />
                </View>
              ))}
            </View>
          )}

          {orderedSeats.map((seat, i) => {
            const pos = positions[i];
            if (!pos || felt.width === 0) return null;
            const isHero = seat.userId === meUserId;
            return (
              <View
                key={seat.seat}
                style={[
                  styles.seatWrap,
                  {
                    left: pos.x * felt.width - 48,
                    top: pos.y * felt.height - 28,
                  },
                ]}>
                <Seat
                  seat={seat}
                  isHero={isHero}
                  isToAct={toActSeat === seat.seat}
                />
              </View>
            );
          })}
        </View>

        {/* Hero's hole cards live above the action bar — bottom of screen. */}
        <View style={styles.heroHole}>
          {myHole.map((c, i) => (
            <View key={i} style={styles.heroCard}>
              <PlayingCard card={c} width={64} />
            </View>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {lastAwards.length > 0 && totalPot === 0 && (
          <Text style={styles.awardText}>
            {lastAwards
              .map(
                (a) =>
                  `Seat ${a.seat} +${a.amount.toLocaleString()}`,
              )
              .join('   ')}
          </Text>
        )}

        {itsMyTurn ? (
          <ActionBar legal={legalActions} onAction={send} />
        ) : (
          <View style={styles.waitingBar}>
            <Text style={styles.waitingText}>
              {toActSeat !== null && seats[toActSeat]
                ? `Waiting on ${seats[toActSeat]?.displayName}…`
                : Object.keys(seats).length < 2
                  ? 'Waiting for another player…'
                  : 'Next hand soon…'}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.table.feltEdge },
  safe: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  leave: {
    paddingVertical: spacing.xs,
  },
  leaveText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  shareBtn: {
    backgroundColor: colors.surface.raised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareLabel: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1,
  },
  shareCode: {
    color: colors.accent.gold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  felt: {
    flex: 1,
    backgroundColor: colors.table.felt,
    position: 'relative',
  },
  pot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  potLabel: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },
  potValue: {
    color: colors.accent.gold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  community: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  communityCard: {
    marginHorizontal: 2,
  },
  seatWrap: {
    position: 'absolute',
    alignItems: 'center',
    width: 96,
  },
  heroHole: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  heroCard: {
    marginHorizontal: spacing.xs,
  },
  errorText: {
    color: colors.action.raise,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  awardText: {
    color: colors.accent.gold,
    fontSize: fontSize.md,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  waitingBar: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  waitingText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
});
