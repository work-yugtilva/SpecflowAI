import React from "react";

type LogoMarkProps = {
  color?: string;
  size?: number;
  title?: string;
};

export default function LogoMark({
  color = "var(--orange)",
  size = 24,
  title = "SpecFlow",
}: LogoMarkProps) {
  return (
    <svg
      aria-label={title}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        height="20"
        rx="3"
        stroke={color}
        strokeWidth="2"
        width="20"
        x="2"
        y="2"
      />
      <rect fill={color} height="8" rx="1.5" width="8" x="8" y="8" />
    </svg>
  );
}
