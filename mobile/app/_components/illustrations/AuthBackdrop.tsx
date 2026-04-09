import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type Props = {
  width?: number;
  height?: number;
};

// Light “truck/city” style backdrop so auth screens feel like the wireframe (photo-like) without external assets.
export function AuthBackdrop({ width = 420, height = 520 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 420 520" fill="none">
      <Circle cx="330" cy="110" r="90" fill="rgba(255,255,255,0.18)" />
      <Circle cx="90" cy="160" r="70" fill="rgba(255,255,255,0.12)" />

      {/* buildings */}
      <Rect x="30" y="220" width="90" height="160" rx="16" fill="rgba(255,255,255,0.10)" />
      <Rect x="130" y="190" width="120" height="190" rx="18" fill="rgba(255,255,255,0.10)" />
      <Rect x="260" y="240" width="130" height="140" rx="18" fill="rgba(255,255,255,0.10)" />

      {/* road */}
      <Path d="M0 410c70-40 150-60 240-50 70 8 130 32 180 58v102H0V410Z" fill="rgba(255,255,255,0.14)" />
      <Path d="M70 448h70" stroke="rgba(255,255,255,0.24)" strokeWidth="8" strokeLinecap="round" />
      <Path d="M190 448h70" stroke="rgba(255,255,255,0.24)" strokeWidth="8" strokeLinecap="round" />
      <Path d="M310 448h70" stroke="rgba(255,255,255,0.24)" strokeWidth="8" strokeLinecap="round" />
    </Svg>
  );
}

