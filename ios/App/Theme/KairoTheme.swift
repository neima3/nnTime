import SwiftUI
import UIKit

// MARK: - Kairo "Soft Focus" design tokens (binding: docs/design/ios-adaptation.md)
// Every color is a light/dark pair matching globals.css EXACTLY.

private func rgb(_ v: UInt32) -> UIColor {
    UIColor(
        red: CGFloat((v >> 16) & 0xFF) / 255,
        green: CGFloat((v >> 8) & 0xFF) / 255,
        blue: CGFloat(v & 0xFF) / 255,
        alpha: 1
    )
}

/// A light/dark token, optionally with high-contrast variants (I1).
///
/// The high-contrast pair is resolved from the trait collection, so it follows
/// iOS "Increase Contrast" for free — and the in-app toggle works by setting
/// `traitOverrides.accessibilityContrast` on the window (see AppState), which
/// makes UIKit re-resolve every one of these colors. Hex values mirror the
/// `.high-contrast` blocks in src/app/globals.css exactly.
private func dyn(
    _ light: UInt32,
    _ dark: UInt32,
    hcLight: UInt32? = nil,
    hcDark: UInt32? = nil
) -> Color {
    Color(UIColor { trait in
        let isDark = trait.userInterfaceStyle == .dark
        if trait.accessibilityContrast == .high {
            if let v = isDark ? hcDark : hcLight { return rgb(v) }
        }
        return rgb(isDark ? dark : light)
    })
}

extension Color {
    // canvas + surfaces
    static let kCanvas = dyn(0xF7F4EE, 0x16131F, hcLight: 0xFFFDF7, hcDark: 0x0A0810)
    static let kSurface = dyn(0xFFFDF9, 0x1E1A2A, hcLight: 0xFFFEFB, hcDark: 0x14111D)
    static let kSurfaceRaised = dyn(0xFFFFFF, 0x262133, hcLight: 0xFFFEFC, hcDark: 0x1B1727)
    static let kSurfaceSunken = dyn(0xEFEBE2, 0x110E18, hcLight: 0xF2EEE5, hcDark: 0x060409)
    static let kBorder = dyn(0xE5DFD2, 0x322C42, hcLight: 0x8D8598, hcDark: 0x7D7591)
    static let kBorderStrong = dyn(0xD3CBBA, 0x443D57, hcLight: 0x4A4258, hcDark: 0xA9A1BD)

    // ink
    static let kInk = dyn(0x241F31, 0xF0EDF7, hcLight: 0x120E1C, hcDark: 0xFBF9FF)
    static let kInkSoft = dyn(0x68617B, 0xA79FBC, hcLight: 0x302941, hcDark: 0xD3CCE4)
    static let kInkFaint = dyn(0x736C7C, 0x8B84A0, hcLight: 0x3A3348, hcDark: 0xC2BBD4)
    static let kInkInverse = dyn(0xFFFDF9, 0x241F31)

    // iris — primary
    static let kIris = dyn(0x5B4FD6, 0x8C81EA, hcLight: 0x3D31B5, hcDark: 0xB3AAFF)
    static let kIrisDeep = dyn(0x4A3FC2, 0xA49BF0, hcLight: 0x2E2496, hcDark: 0xC9C2FF)
    static let kIrisSoft = dyn(0xEAE7FB, 0x322C52, hcLight: 0xE3DFFB, hcDark: 0x2E2757)
    static let kIrisGhost = dyn(0xF3F1FD, 0x262242, hcLight: 0xEEEBFD, hcDark: 0x241F45)

    // now-line + semantic
    static let kNow = dyn(0xFF5C4D, 0xFF6F61, hcLight: 0xB8241A, hcDark: 0xFF8A7D)
    static let kNowInk = dyn(0xFFFFFF, 0xFFFFFF)
    static let kSuccess = dyn(0x1E7354, 0x4CC593, hcLight: 0x10603F, hcDark: 0x79E0B0)
    static let kSuccessSoft = dyn(0xD9F0E4, 0x1D3A2E, hcLight: 0xCDEDDD, hcDark: 0x17402F)
    static let kDanger = dyn(0xC93A3A, 0xF07D7D, hcLight: 0xA3221F, hcDark: 0xFF9D9D)
    static let kDangerSoft = dyn(0xFBDFDF, 0x3F2323, hcLight: 0xF8D6D6, hcDark: 0x451F1F)

    // category pastels — fill / ink pairs. Fills stay (they are the colour-coding);
    // the ink is pushed to near-maximum contrast, as on the web.
    static let kCatPeach = dyn(0xFFD9C2, 0x4A2C1C)
    static let kCatPeachInk = dyn(0x954419, 0xFFB894, hcLight: 0x6D2F0E, hcDark: 0xFFD0B5)
    static let kCatButter = dyn(0xFFE9A6, 0x423714)
    static let kCatButterInk = dyn(0x7E6000, 0xF2D478, hcLight: 0x574200, hcDark: 0xFFE9A8)
    static let kCatMint = dyn(0xC8EDD6, 0x1C3A2B)
    static let kCatMintInk = dyn(0x1B7045, 0x86DCAE, hcLight: 0x0F5230, hcDark: 0xA8ECC9)
    static let kCatSky = dyn(0xC8E3FA, 0x1C3348)
    static let kCatSkyInk = dyn(0x1A6198, 0x8EC7F2, hcLight: 0x10456E, hcDark: 0xB3DAF7)
    static let kCatLilac = dyn(0xE2DBFB, 0x2E2749)
    static let kCatLilacInk = dyn(0x5B48C9, 0xBAAEF5, hcLight: 0x3D2CA8, hcDark: 0xD5CDFF)
    static let kCatRose = dyn(0xFAD5E3, 0x452432)
    static let kCatRoseInk = dyn(0xA13260, 0xF2A0C0, hcLight: 0x7A1F45, hcDark: 0xFFC2D8)
}

// MARK: - Category palette lookup

enum KairoCategory: String, CaseIterable {
    case peach, butter, mint, sky, lilac, rose

    var fill: Color {
        switch self {
        case .peach: .kCatPeach
        case .butter: .kCatButter
        case .mint: .kCatMint
        case .sky: .kCatSky
        case .lilac: .kCatLilac
        case .rose: .kCatRose
        }
    }

    var ink: Color {
        switch self {
        case .peach: .kCatPeachInk
        case .butter: .kCatButterInk
        case .mint: .kCatMintInk
        case .sky: .kCatSkyInk
        case .lilac: .kCatLilacInk
        case .rose: .kCatRoseInk
        }
    }
}

// MARK: - Typography (Bricolage Grotesque display · Onest body · Spline Sans Mono digits)
// Bundled variable fonts; every style rides UIFontMetrics so Dynamic Type scales.

enum KairoFont {
    static let displayFamily = "Bricolage Grotesque"
    static let bodyFamily = "Onest"
    static let mono = "Spline Sans Mono"
    /// Braille Institute face with deliberately disambiguated letterforms (I1).
    static let dyslexia = "Atkinson Hyperlegible"

    /// Computed so flipping the toggle restyles the app without a relaunch.
    /// The mono face is deliberately untouched: tabular time digits are already
    /// unambiguous, and swapping them would break the timeline's alignment.
    static var display: String { KairoPrefs.dyslexiaFont ? dyslexia : displayFamily }
    static var body: String { KairoPrefs.dyslexiaFont ? dyslexia : bodyFamily }

    /// "Larger text" (I1) — one comfortable step on top of Dynamic Type, matching
    /// `.larger-text body { zoom: 1.125 }` on the web.
    static var scale: CGFloat { KairoPrefs.largerText ? KairoPrefs.largerTextScale : 1 }
}

extension Font {
    /// Bricolage bold — headings and hero numbers.
    static func kDisplay(_ size: CGFloat, relativeTo style: Font.TextStyle = .title2) -> Font {
        .custom(KairoFont.display, size: size * KairoFont.scale, relativeTo: style).weight(.bold)
    }

    /// Onest — body copy.
    static func kBody(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(KairoFont.body, size: size * KairoFont.scale, relativeTo: style).weight(weight)
    }

    /// Spline Sans Mono — timer digits and tabular numbers.
    static func kMono(_ size: CGFloat, weight: Font.Weight = .semibold, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(KairoFont.mono, size: size * KairoFont.scale, relativeTo: style).weight(weight)
    }
}

// MARK: - Depth

extension View {
    /// Card shadow: y2 r8 @6% plum (approximated with the plum tint).
    func kCardShadow() -> some View {
        shadow(color: Color(red: 36 / 255, green: 31 / 255, blue: 49 / 255).opacity(0.06), radius: 8, x: 0, y: 2)
    }

    /// Float shadow: y6 r20 @12% plum.
    func kFloatShadow() -> some View {
        shadow(color: Color(red: 36 / 255, green: 31 / 255, blue: 49 / 255).opacity(0.12), radius: 20, x: 0, y: 6)
    }

    /// Resting card chrome: surface fill, 1pt border, radius 20.
    func kCard(radius: CGFloat = 20) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(Color.kSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .stroke(Color.kBorder, lineWidth: 1)
                )
        )
        .kCardShadow()
    }
}
