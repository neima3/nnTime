import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Social preview for every share of time.neima.me — the clay ◔ mark on the
 * Soft Focus paper canvas. Light-theme token values are copied in as
 * literals: this is a rendered asset (like the icons), not a component, and
 * satori can't read globals.css.
 *
 * Fonts are the site's own (Bricolage Grotesque / Onest) as WOFF next to
 * this file; the mark is a 340px PNG of the same cutout. ImageResponse's
 * ~500KB bundle cap is why the source stays small — do not swap in the
 * full illustration PNG.
 */
export const alt = "Kairo — time you can see";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANVAS = "#f7f4ee";
const SURFACE = "#fffdf9";
const BORDER = "#e5dfd2";
const INK = "#241f31";
const INK_SOFT = "#68617b";
const IRIS = "#5b4fd6";
const NOW = "#ff5c4d";

const OG_DIR = join(process.cwd(), "src/app/_og");

export default async function OpenGraphImage() {
  const [bricolage, onest, mark] = await Promise.all([
    readFile(join(OG_DIR, "bricolage-700.woff")),
    readFile(join(OG_DIR, "onest-500.woff")),
    readFile(join(OG_DIR, "mark.png")),
  ]);
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CANVAS,
          color: INK,
          fontFamily: "Onest",
          position: "relative",
        }}
      >
        {/* Ambient glows. Explicit 0%/70% stops — satori treats `closest-side`
            as a dark hole in the middle. Same RGB at both ends so the fade
            doesn't interpolate through black. */}
        <div
          style={{
            position: "absolute",
            left: -80,
            top: -160,
            width: 520,
            height: 520,
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(91,79,214,0.18) 0%, rgba(91,79,214,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -80,
            bottom: -180,
            width: 540,
            height: 540,
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(255,158,107,0.22) 0%, rgba(255,158,107,0) 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 24px 0 80px",
            width: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              alignSelf: "flex-start",
              padding: "10px 18px",
              borderRadius: 999,
              border: `1.5px solid ${BORDER}`,
              background: SURFACE,
              color: IRIS,
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: 999, background: NOW }} />
            Built for brains that plan differently
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              fontFamily: "Bricolage Grotesque",
              fontSize: 88,
              fontWeight: 700,
              letterSpacing: -2.5,
              lineHeight: 0.95,
            }}
          >
            <div style={{ display: "flex" }}>Time you can</div>
            <div style={{ display: "flex", color: IRIS }}>see.</div>
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 26,
              lineHeight: 1.4,
              color: INK_SOFT,
              width: 560,
            }}
          >
            A visual daily planner that makes time tangible. Gentle, colorful,
            impossible to lose track of.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 40,
              fontSize: 22,
              fontWeight: 500,
              color: INK_SOFT,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 10,
                background: IRIS,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.5" stroke={SURFACE} strokeWidth="2.4" />
                <path d="M12 12 L12 3.5 A8.5 8.5 0 0 1 20.5 12 Z" fill={SURFACE} />
              </svg>
            </div>
            time.neima.me
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 480,
            height: "100%",
            position: "relative",
          }}
        >
          {/* halo rings — the circle motif behind the hero card on the landing */}
          <div
            style={{
              position: "absolute",
              width: 440,
              height: 440,
              borderRadius: 999,
              border: `1.5px solid rgba(91,79,214,0.16)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 560,
              height: 560,
              borderRadius: 999,
              border: `1.5px solid rgba(91,79,214,0.09)`,
            }}
          />
          <img src={markSrc} width={340} height={328} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage Grotesque", data: bricolage, weight: 700, style: "normal" },
        { name: "Onest", data: onest, weight: 500, style: "normal" },
      ],
    },
  );
}
