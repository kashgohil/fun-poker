import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '@fun-poker/design';

type Props = { size: number };

// Fun Poker logo — a gold poker chip with a single spade centred on
// felt-green. Built as pure SVG so it crisps at any size.
export function Logo({ size }: Props) {
  const notchAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Outer gold ring */}
      <Circle
        cx={50}
        cy={50}
        r={48}
        fill={colors.accent.gold}
        stroke={colors.table.feltEdge}
        strokeWidth={1.5}
      />
      {/* Eight dark notches around the rim — classic chip styling */}
      {notchAngles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 50 + Math.cos(rad) * 44;
        const cy = 50 + Math.sin(rad) * 44;
        return (
          <Circle
            key={deg}
            cx={cx}
            cy={cy}
            r={4}
            fill={colors.surface.raised}
          />
        );
      })}
      {/* Inner felt disc */}
      <Circle
        cx={50}
        cy={50}
        r={34}
        fill={colors.table.felt}
        stroke={colors.table.feltEdge}
        strokeWidth={1}
      />
      {/* Centred spade */}
      <SvgText
        x={50}
        y={70}
        fontSize={48}
        fontWeight="700"
        fill={colors.accent.gold}
        textAnchor="middle">
        ♠
      </SvgText>
    </Svg>
  );
}
