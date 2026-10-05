import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS, drawn from the same parcel mark as the favicon. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#17201d",
      }}
    >
      <svg width="132" height="132" viewBox="0 0 24 24">
        <defs>
          <pattern
            id="h"
            width="1.6"
            height="1.6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="0.7" height="1.6" fill="#f5c518" />
          </pattern>
        </defs>
        <path d="M3.5 7.2 13.8 2.8l6.9 6.1-2.4 11.4-12.6 1.2Z" fill="url(#h)" />
        <path
          d="M3.5 7.2 13.8 2.8l6.9 6.1-2.4 11.4-12.6 1.2Z"
          fill="none"
          stroke="#f1f3ef"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="11.6" cy="12.6" r="1.6" fill="#f1f3ef" />
      </svg>
    </div>,
    size,
  );
}
