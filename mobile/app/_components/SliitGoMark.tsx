import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { BrandColors } from "@/app/_theme/colors";

type Props = {
  size?: number;
  color?: string;
};

export function SliitGoMark({ size = 44, color = BrandColors.primary }: Props) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      {/* Pin */}
      <Path
        d="M32 60c10-14.3 18-25.4 18-36C50 14.1 41.9 6 32 6S14 14.1 14 24c0 10.6 8 21.7 18 36Z"
        fill={color}
      />
      {/* Inner circle */}
      <Circle cx="32" cy="24" r="10" fill={BrandColors.white} opacity={0.95} />
      {/* Road */}
      <Path
        d="M30 18h4v5.6c0 .6.4 1 1 1h2.5v3H35c-2 0-3.5-1.6-3.5-3.6V18Z"
        fill={color}
        opacity={0.9}
      />
    </Svg>
  );
}

