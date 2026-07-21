import SwiftUI
import UIKit

// MARK: - Kairo "Soft Focus" design tokens (binding: docs/design/ios-adaptation.md)
// Every color is a light/dark pair matching globals.css EXACTLY.

private func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { trait in
        let v = trait.userInterfaceStyle == .dark ? dark : light
        return UIColor(
            red: CGFloat((v >> 16) & 0xFF) / 255,
            green: CGFloat((v >> 8) & 0xFF) / 255,
            blue: CGFloat(v & 0xFF) / 255,
            alpha: 1
        )
    })
}

extension Color {
    // canvas + surfaces
    static let kCanvas = dyn(0xF7F4EE, 0x16131F)
    static let kSurface = dyn(0xFFFDF9, 0x1E1A2A)
    static let kSurfaceRaised = dyn(0xFFFFFF, 0x262133)
    static let kSurfaceSunken = dyn(0xEFEBE2, 0x110E18)
    static let kBorder = dyn(0xE5DFD2, 0x322C42)
    static let kBorderStrong = dyn(0xD3CBBA, 0x443D57)

    // ink
    static let kInk = dyn(0x241F31, 0xF0EDF7)
    static let kInkSoft = dyn(0x68617B, 0xA79FBC)
    static let kInkFaint = dyn(0x736C7C, 0x8B84A0)
    static let kInkInverse = dyn(0xFFFDF9, 0x241F31)

    // iris — primary
    static let kIris = dyn(0x5B4FD6, 0x8C81EA)
    static let kIrisDeep = dyn(0x4A3FC2, 0xA49BF0)
    static let kIrisSoft = dyn(0xEAE7FB, 0x322C52)
    static let kIrisGhost = dyn(0xF3F1FD, 0x262242)

    // now-line + semantic
    static let kNow = dyn(0xFF5C4D, 0xFF6F61)
    static let kNowInk = dyn(0xFFFFFF, 0xFFFFFF)
    static let kSuccess = dyn(0x23805C, 0x4CC593)
    static let kSuccessSoft = dyn(0xD9F0E4, 0x1D3A2E)
    static let kDanger = dyn(0xC93A3A, 0xF07D7D)
    static let kDangerSoft = dyn(0xFBDFDF, 0x3F2323)

    // category pastels — fill / ink pairs
    static let kCatPeach = dyn(0xFFD9C2, 0x4A2C1C)
    static let kCatPeachInk = dyn(0x954419, 0xFFB894)
    static let kCatButter = dyn(0xFFE9A6, 0x423714)
    static let kCatButterInk = dyn(0x7E6000, 0xF2D478)
    static let kCatMint = dyn(0xC8EDD6, 0x1C3A2B)
    static let kCatMintInk = dyn(0x1B7045, 0x86DCAE)
    static let kCatSky = dyn(0xC8E3FA, 0x1C3348)
    static let kCatSkyInk = dyn(0x1A6198, 0x8EC7F2)
    static let kCatLilac = dyn(0xE2DBFB, 0x2E2749)
    static let kCatLilacInk = dyn(0x5B48C9, 0xBAAEF5)
    static let kCatRose = dyn(0xFAD5E3, 0x452432)
    static let kCatRoseInk = dyn(0xA13260, 0xF2A0C0)
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
    static let display = "Bricolage Grotesque"
    static let body = "Onest"
    static let mono = "Spline Sans Mono"
}

extension Font {
    /// Bricolage bold — headings and hero numbers.
    static func kDisplay(_ size: CGFloat, relativeTo style: Font.TextStyle = .title2) -> Font {
        .custom(KairoFont.display, size: size, relativeTo: style).weight(.bold)
    }

    /// Onest — body copy.
    static func kBody(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(KairoFont.body, size: size, relativeTo: style).weight(weight)
    }

    /// Spline Sans Mono — timer digits and tabular numbers.
    static func kMono(_ size: CGFloat, weight: Font.Weight = .semibold, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(KairoFont.mono, size: size, relativeTo: style).weight(weight)
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
