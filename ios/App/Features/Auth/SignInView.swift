import GoogleSignInSwift
import SwiftUI

struct SignInView: View {
    @Environment(AppState.self) private var app
    @Environment(\.colorScheme) private var colorScheme

    var externalError: String?

    @State private var model = SignInPresentationModel()
    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var appleChallenge: NativeAppleChallenge?
    @State private var preparingApple = false
    @State private var applePreparationFailed = false

    enum Mode {
        case signIn
        case signUp
    }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    brand
                    formCard
                    modeButton
                }
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .task { await loadProviders() }
    }

    private var brand: some View {
        VStack(spacing: 10) {
            KairoMark(size: 52)
            Text("Kairo")
                .font(.kDisplay(24, relativeTo: .title))
                .foregroundStyle(Color.kInk)
        }
        .padding(.top, 42)
        .padding(.bottom, 24)
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text(
                    mode == .signIn
                        ? "Welcome back"
                        : "Create your planner"
                )
                .font(.kDisplay(26, relativeTo: .title))
                .foregroundStyle(Color.kInk)
                Text(
                    mode == .signIn
                        ? "Sign in to pick up where you left off."
                        : "A gentle, visual day — ready in a moment."
                )
                .font(.kBody(15))
                .foregroundStyle(Color.kInkSoft)
            }

            VStack(spacing: 14) {
                if mode == .signUp {
                    field(
                        "Name",
                        text: $name,
                        placeholder: "What should we call you?"
                    )
                }
                field(
                    "Email",
                    text: $email,
                    placeholder: "you@example.com"
                )
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                secureField(
                    "Password",
                    text: $password,
                    placeholder:
                        mode == .signUp
                            ? "At least 8 characters"
                            : "Your password"
                )
            }

            feedback
            passwordButton

            if model.showsApple || model.showsGoogle
                || model.showsMagicLink
            {
                providerDivider
                providerControls
            }
        }
        .padding(24)
        .kCard(radius: 28)
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var feedback: some View {
        if model.status == .loading(.apple)
            || model.status == .loading(.google)
        {
            HStack(spacing: 10) {
                ProgressView().tint(.kIris)
                Text(
                    model.status == .loading(.google)
                        ? "Signing in securely with Google…"
                        : "Signing in securely with Apple…"
                )
                    .font(.kBody(13.5, weight: .medium))
                    .foregroundStyle(Color.kInkSoft)
            }
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 46)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.kIrisGhost)
            )
            .accessibilityElement(children: .combine)
        } else if model.status == .signedIn {
            feedbackCard(
                icon: "checkmark.shield.fill",
                title: "Planner secured",
                message: "Opening your day with your private planner ready.",
                color: .kSuccess,
                background: .kSuccessSoft
            )
        } else if case let .magicLinkSent(address) = model.status {
            feedbackCard(
                icon: "envelope.badge",
                title: "Check your email",
                message:
                    "We sent a secure sign-in link to \(address). You can close this screen after opening it.",
                color: .kSuccess,
                background: .kSuccessSoft
            )
        } else if let message = model.errorMessage ?? externalError {
            feedbackCard(
                icon: "exclamationmark.circle.fill",
                title:
                    model.status == .duplicateAccount
                        ? "Use your existing sign-in"
                        : "Couldn’t sign in",
                message: message,
                color: .kDanger,
                background: .kDangerSoft
            )
        }
    }

    private func feedbackCard(
        icon: String,
        title: String,
        message: String,
        color: Color,
        background: Color
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.kBody(13.5, weight: .semibold))
                    .foregroundStyle(Color.kInk)
                Text(message)
                    .font(.kBody(12.5))
                    .foregroundStyle(Color.kInkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(background)
        )
        .accessibilityElement(children: .combine)
    }

    private var passwordButton: some View {
        Button {
            Task { await submitPassword() }
        } label: {
            HStack(spacing: 8) {
                if model.status == .loading(.password) {
                    ProgressView().tint(.kInkInverse)
                } else {
                    Text(
                        mode == .signIn
                            ? "Sign in"
                            : "Create planner"
                    )
                    .font(.kBody(16, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 14, weight: .bold))
                }
            }
            .foregroundStyle(Color.kInkInverse)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .fill(Color.kIris)
            )
        }
        .buttonStyle(.plain)
        .disabled(
            model.isBusy || email.isEmpty || password.isEmpty
        )
        .opacity(
            model.isBusy || email.isEmpty || password.isEmpty
                ? 0.62
                : 1
        )
        .kFloatShadow()
        .accessibilityHint(
            mode == .signIn
                ? "Signs in with the email and password above."
                : "Creates your planner with the details above."
        )
    }

    private var providerDivider: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(Color.kBorder)
                .frame(height: 1)
            Text("or continue securely")
                .font(.kBody(11.5, weight: .semibold))
                .foregroundStyle(Color.kInkFaint)
                .textCase(.uppercase)
                .fixedSize()
            Rectangle()
                .fill(Color.kBorder)
                .frame(height: 1)
        }
        .accessibilityHidden(true)
    }

    private var providerControls: some View {
        VStack(spacing: 11) {
            if model.showsGoogle {
                googleControl
            }
            if model.showsApple {
                appleControl
            }
            if model.showsMagicLink {
                Button {
                    Task { await sendMagicLink() }
                } label: {
                    HStack(spacing: 9) {
                        if model.status == .loading(.magicLink) {
                            ProgressView().tint(.kIris)
                        } else {
                            Image(systemName: "envelope")
                                .font(.system(size: 15, weight: .semibold))
                            Text("Email me a sign-in link")
                                .font(.kBody(15, weight: .semibold))
                        }
                    }
                    .foregroundStyle(Color.kIris)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 50)
                    .background(
                        RoundedRectangle(
                            cornerRadius: 15,
                            style: .continuous
                        )
                        .fill(Color.kSurface)
                        .overlay(
                            RoundedRectangle(
                                cornerRadius: 15,
                                style: .continuous
                            )
                            .stroke(Color.kBorderStrong, lineWidth: 1)
                        )
                    )
                }
                .buttonStyle(.plain)
                .disabled(model.isBusy || email.isEmpty)
                .opacity(model.isBusy || email.isEmpty ? 0.58 : 1)
                .accessibilityHint(
                    "Sends a one-time link to the email above. It does not sign you in until you open the link."
                )
            }
        }
    }

    private var googleControl: some View {
        GoogleSignInButton(
            scheme: colorScheme == .dark ? .dark : .light,
            style: .wide,
            state: model.isBusy ? .disabled : .normal
        ) {
            Task { await signInWithGoogle() }
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 52)
        .contentShape(Rectangle())
        .disabled(model.isBusy)
        .accessibilityLabel("Sign in with Google")
        .accessibilityHint(
            "Uses Google to sign in, then opens your private Kairo planner."
        )
        .accessibilityIdentifier("auth.google.sign-in")
        .id(colorScheme)
    }

    @ViewBuilder
    private var appleControl: some View {
        if let appleChallenge {
            AppleSignInControl(
                purpose: .signIn,
                challenge: appleChallenge,
                disabled: model.isBusy,
                completion: finishAppleSignIn
            )
        } else if preparingApple {
            HStack(spacing: 9) {
                ProgressView().tint(.kInkSoft)
                Text("Preparing Apple sign-in…")
                    .font(.kBody(14, weight: .medium))
                    .foregroundStyle(Color.kInkSoft)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.kSurfaceSunken)
            )
            .accessibilityElement(children: .combine)
        } else if applePreparationFailed {
            Button {
                Task { await prepareApple() }
            } label: {
                Label(
                    "Retry Apple sign-in",
                    systemImage: "arrow.clockwise"
                )
                .font(.kBody(14.5, weight: .semibold))
                .foregroundStyle(Color.kInk)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(
                    RoundedRectangle(
                        cornerRadius: 14,
                        style: .continuous
                    )
                    .fill(Color.kSurfaceSunken)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var modeButton: some View {
        Button {
            withAnimation(
                .spring(response: 0.35, dampingFraction: 0.8)
            ) {
                mode = mode == .signIn ? .signUp : .signIn
                model.resetFeedback()
            }
        } label: {
            Text(
                mode == .signIn
                    ? "New to Kairo? **Create one**"
                    : "Already have a planner? **Sign in**"
            )
            .font(.kBody(14))
            .foregroundStyle(Color.kInkSoft)
            .frame(minHeight: 44)
        }
        .disabled(model.isBusy)
        .padding(.top, 10)
    }

    private func field(
        _ label: String,
        text: Binding<String>,
        placeholder: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.kBody(13, weight: .semibold))
                .foregroundStyle(Color.kInkSoft)
            TextField(placeholder, text: text)
                .font(.kBody(15))
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                .background(
                    RoundedRectangle(
                        cornerRadius: 13,
                        style: .continuous
                    )
                    .fill(Color.kSurfaceSunken)
                )
        }
    }

    private func secureField(
        _ label: String,
        text: Binding<String>,
        placeholder: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.kBody(13, weight: .semibold))
                .foregroundStyle(Color.kInkSoft)
            SecureField(placeholder, text: text)
                .font(.kBody(15))
                .textContentType(.password)
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                .background(
                    RoundedRectangle(
                        cornerRadius: 13,
                        style: .continuous
                    )
                    .fill(Color.kSurfaceSunken)
                )
        }
    }

    @MainActor
    private func loadProviders() async {
#if DEBUG
        if installAuthFixture() {
            return
        }
#endif
        await model.loadCapabilities {
            try await KairoAPI.shared.authCapabilities()
        }
        if model.showsApple {
            await prepareApple()
        }
    }

#if DEBUG
    @MainActor
    private func installAuthFixture() -> Bool {
        let arguments = ProcessInfo.processInfo.arguments
        guard
            let capabilityIndex = arguments.firstIndex(
                of: "-kairoAuthCapabilitiesFixture"
            ),
            arguments.indices.contains(capabilityIndex + 1)
        else {
            return false
        }
        let capability = arguments[capabilityIndex + 1]
        let capabilities = NativeAuthCapabilities(
            magicLink: capability == "all",
            apple: capability == "all",
            google: capability == "all" || capability == "google"
        )
        var status = SignInPresentationModel.Status.idle
        if let stateIndex = arguments.firstIndex(
            of: "-kairoAuthStateFixture"
        ), arguments.indices.contains(stateIndex + 1) {
            switch arguments[stateIndex + 1] {
            case "appleLoading":
                status = .loading(.apple)
            case "appleError":
                status = .failed(
                    "Apple sign-in couldn’t be completed. Please try again."
                )
            case "googleLoading":
                status = .loading(.google)
            case "googleError":
                status = .failed(
                    "Google authentication couldn't be completed. Try again."
                )
            case "googleDuplicate":
                status = .duplicateAccount
            case "googleSuccess":
                status = .signedIn
            case "googleCancelled":
                status = .idle
            case "magicSent":
                email = "planner@example.test"
                status = .magicLinkSent(email)
            default:
                break
            }
        }
        model.installFixture(
            capabilities: capabilities,
            status: status
        )
        if capabilities.apple {
            appleChallenge = .init(
                state: "synthetic-state",
                nonce: "synthetic-nonce",
                expiresAt: Date().addingTimeInterval(3_600)
            )
        }
        return true
    }
#endif

    @MainActor
    private func prepareApple() async {
        guard !preparingApple else {
            return
        }
        preparingApple = true
        applePreparationFailed = false
        appleChallenge = nil
        do {
            appleChallenge = try await KairoAPI.shared.appleChallenge(
                intent: .signIn
            )
        } catch is CancellationError {
            applePreparationFailed = false
        } catch {
            applePreparationFailed = true
        }
        preparingApple = false
    }

    @MainActor
    private func signInWithGoogle() async {
        let session = await model.authenticate(using: .google) {
            let credential = try await GoogleSignInCoordinator().credential()
            return try await KairoAPI.shared.googleSignIn(
                credential: credential
            )
        }
        if let session {
            await finish(session)
        }
    }

    @MainActor
    private func submitPassword() async {
        let session: NativeSessionController.PersistResult? =
            await model.authenticate(using: .password) {
            if mode == .signIn {
                return try await KairoAPI.shared.signIn(
                    email: email,
                    password: password
                )
            }
            return try await KairoAPI.shared.signUp(
                name: name,
                email: email,
                password: password
            )
        }
        if let session {
            await finish(session)
        }
    }

    @MainActor
    private func sendMagicLink() async {
        _ = await model.requestMagicLink(email: email) {
            try await KairoAPI.shared.requestMagicLink(email: email)
        }
    }

    @MainActor
    private func finishAppleSignIn(
        _ result: Result<AppleIdentityCredential, Error>
    ) async {
        guard let challenge = appleChallenge else {
            return
        }
        let session: NativeSessionController.PersistResult? =
            await model.authenticate(using: .apple) {
            let credential = try result.get()
            guard
                let session: NativeSessionController.PersistResult =
                    try await KairoAPI.shared.exchangeAppleCredential(
                        intent: .signIn,
                        challenge: challenge,
                        idToken: credential.idToken
                    )
            else {
                throw AppleSignInValidationError.missingCredential
            }
            return session
        }
        if let session {
            await finish(session)
        } else if !model.isBusy {
            await prepareApple()
        }
    }

    @MainActor
    private func finish(
        _ session: NativeSessionController.PersistResult
    ) async {
        await SignInSessionFinisher.finish(
            session,
            prepareForAccountSwitch: { scope in
                await app.prepareForAccountSwitch(newScope: scope)
            },
            bootstrap: {
                await app.bootstrap()
            }
        )
    }
}

@MainActor
enum SignInSessionFinisher {
    static func finish(
        _ session: NativeSessionController.PersistResult,
        prepareForAccountSwitch: (String) async -> Bool,
        bootstrap: () async -> Void
    ) async {
        if session.replacedScope != nil,
           !(await prepareForAccountSwitch(session.scope))
        {
            return
        }
        await bootstrap()
    }
}
