import React from "react";
import Svg, { Path } from "react-native-svg";

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

export function BottomWave({ width = 420, height = 140, color = "#4F94B8" }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 420 140" fill="none">
      <Path
        d="M0 54c60 44 120 62 180 54 72-10 98-54 150-58 44-3 74 10 90 18v72H0V54Z"
        fill={color}
      />
    </Svg>
  );
}

