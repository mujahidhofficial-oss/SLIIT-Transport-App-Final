import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { BrandColors } from "@/app/_theme/colors";

type Props = {
  width?: number;
  height?: number;
};

// Simple “city + rider” illustration to match the wireframe hero image.
export function WelcomeHero({ width = 280, height = 160 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 160" fill="none">
      {/* soft backdrop */}
      <Circle cx="210" cy="48" r="34" fill="#E9F3FA" />
      <Circle cx="64" cy="42" r="26" fill="#E9F3FA" />

      {/* buildings */}
      <Rect x="20" y="58" width="42" height="70" rx="8" fill="#DDEAF5" />
      <Rect x="68" y="44" width="54" height="84" rx="10" fill="#D2E4F2" />
      <Rect x="130" y="64" width="40" height="64" rx="8" fill="#DDEAF5" />
      <Rect x="176" y="52" width="64" height="76" rx="12" fill="#D2E4F2" />

      {/* rider + scooter */}
      <Circle cx="144" cy="56" r="10" fill={BrandColors.primary} opacity={0.25} />
      <Path
        d="M132 72c10-10 22-10 32 0l-8 26h-16l-8-26Z"
        fill={BrandColors.primary}
        opacity={0.18}
      />
      <Path
        d="M110 110h68"
        stroke={BrandColors.primary}
        strokeWidth="6"
        strokeLinecap="round"
        opacity={0.5}
      />
      <Circle cx="124" cy="118" r="10" fill={BrandColors.primary} opacity={0.8} />
      <Circle cx="186" cy="118" r="10" fill={BrandColors.primary} opacity={0.8} />
      <Path
        d="M150 90l18 18h18"
        stroke={BrandColors.primary}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
    </Svg>
  );
}

