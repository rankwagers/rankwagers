import { ImageResponse } from "next/og";
import { siteBrand } from "@/lib/brand";

export const runtime = "edge";
export const alt = "RankWagers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const name = siteBrand();
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #0c4a6e 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: 48,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: -2,
            marginBottom: 16,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#94a3b8",
            maxWidth: 720,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          Daily goal-market predictions & trusted bookmaker reviews
        </div>
        <div
          style={{
            marginTop: 40,
            padding: "12px 28px",
            borderRadius: 999,
            background: "#22d3ee",
            color: "#0f172a",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          18+ · Play responsibly
        </div>
      </div>
    ),
    { ...size }
  );
}
