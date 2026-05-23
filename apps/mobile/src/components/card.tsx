import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { Card } from '@fun-poker/protocol';
import {
  cardSpec,
  colors,
  jokerSpec,
  rankLabel,
  suits,
} from '@fun-poker/design';

type Props = {
  card?: Card;
  width: number;
  faceDown?: boolean;
};

export function PlayingCard({ card, width, faceDown }: Props) {
  const height = width / cardSpec.aspectRatio;
  if (faceDown || !card) return <CardBack width={width} height={height} />;
  if (card.kind === 'joker') return <JokerCard width={width} height={height} />;

  const suit = suits[card.suit];
  const rank = rankLabel[card.rank];
  const radius = width * 0.12;
  return (
    <Svg width={width} height={height}>
      <Rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={radius}
        ry={radius}
        fill={colors.card.face}
        stroke={colors.card.border}
        strokeWidth={1}
      />
      <SvgText
        x={width * 0.12}
        y={height * 0.28}
        fontSize={height * cardSpec.cornerRankSize}
        fontWeight="700"
        fill={suit.color}>
        {rank}
      </SvgText>
      <SvgText
        x={width * 0.12}
        y={height * 0.46}
        fontSize={height * cardSpec.cornerSuitSize}
        fill={suit.color}>
        {suit.symbol}
      </SvgText>
      <SvgText
        x={width * 0.5}
        y={height * 0.78}
        fontSize={height * cardSpec.centerSuitSize}
        fill={suit.color}
        textAnchor="middle">
        {suit.symbol}
      </SvgText>
    </Svg>
  );
}

function CardBack({ width, height }: { width: number; height: number }) {
  const radius = width * 0.12;
  return (
    <Svg width={width} height={height}>
      <Rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={radius}
        ry={radius}
        fill={colors.card.back}
        stroke={colors.card.border}
        strokeWidth={1}
      />
      <Rect
        x={width * 0.18}
        y={height * 0.14}
        width={width * 0.64}
        height={height * 0.72}
        rx={radius * 0.5}
        fill={colors.accent.gold}
        opacity={0.18}
      />
    </Svg>
  );
}

function JokerCard({ width, height }: { width: number; height: number }) {
  const radius = width * 0.12;
  return (
    <Svg width={width} height={height}>
      <Rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={radius}
        ry={radius}
        fill={colors.card.face}
        stroke={colors.card.border}
        strokeWidth={1}
      />
      <SvgText
        x={width * 0.5}
        y={height * 0.62}
        fontSize={height * 0.5}
        fill={jokerSpec.color}
        textAnchor="middle">
        {jokerSpec.symbol}
      </SvgText>
      <SvgText
        x={width * 0.5}
        y={height * 0.9}
        fontSize={height * 0.12}
        fontWeight="700"
        fill={jokerSpec.color}
        textAnchor="middle">
        {jokerSpec.label}
      </SvgText>
    </Svg>
  );
}
