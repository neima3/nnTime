import SwiftUI

struct SignInView: View {
    @Environment(AppState.self) private var app
    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    enum Mode { case signIn, signUp }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    VStack(spacing: 10) {
                        KairoMark(size: 52)
                        Text("Kairo")
                            .font(.kDisplay(24, relativeTo: .title))
                            .foregroundStyle(Color.kInk)
                    }
                    .padding(.top, 48)
                    .padding(.bottom, 28)

                    VStack(alignment: .leading, spacing: 16) {
                        Text(mode == .signIn ? "Welcome back" : "Create your planner")
                            .font(.kDisplay(26, relativeTo: .title))
                            .foregroundStyle(Color.kInk)
                        Text(mode == .signIn
                             ? "Sign in to pick up where you left off."
                             : "A gentle, visual day — ready in a moment.")
                            .font(.kBody(15))
                            .foregroundStyle(Color.kInkSoft)

                        if mode == .signUp {
                            field("Name", text: $name, placeholder: "What should we call you?")
                        }
                        field("Email", text: $email, placeholder: "you@example.com")
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                        secureField("Password", text: $password,
                                    placeholder: mode == .signUp ? "At least 8 characters" : "Your password")

                        if let error {
                            Text(error)
                                .font(.kBody(13, weight: .medium))
                                .foregroundStyle(Color.kDanger)
                                .padding(.horizontal, 14).padding(.vertical, 10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color.kDangerSoft))
                        }

                        Button {
                            Task { await submit() }
                        } label: {
                            HStack(spacing: 8) {
                                if busy {
                                    ProgressView().tint(.kInkInverse)
                                } else {
                                    Text(mode == .signIn ? "Sign in" : "Create planner")
                                        .font(.kBody(16, weight: .semibold))
                                    Image(systemName: "arrow.right").font(.system(size: 14, weight: .bold))
                                }
                            }
                            .foregroundStyle(Color.kInkInverse)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 15)
                            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.kIris))
                        }
                        .disabled(busy || email.isEmpty || password.isEmpty)
                        .opacity(busy || email.isEmpty || password.isEmpty ? 0.65 : 1)
                        .kFloatShadow()
                    }
                    .padding(24)
                    .kCard(radius: 28)
                    .padding(.horizontal, 20)

                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            mode = mode == .signIn ? .signUp : .signIn
                            error = nil
                        }
                    } label: {
                        Text(mode == .signIn ? "New to Kairo? **Create one**" : "Already have a planner? **Sign in**")
                            .font(.kBody(14))
                            .foregroundStyle(Color.kInkSoft)
                    }
                    .padding(.top, 20)
                }
                .padding(.bottom, 40)
            }
        }
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
            TextField(placeholder, text: text)
                .font(.kBody(15))
                .autocorrectionDisabled()
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.kSurfaceSunken))
        }
    }

    private func secureField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
            SecureField(placeholder, text: text)
                .font(.kBody(15))
                .textContentType(.password)
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.kSurfaceSunken))
        }
    }

    private func submit() async {
        busy = true
        error = nil
        do {
            if mode == .signIn {
                try await KairoAPI.shared.signIn(email: email, password: password)
            } else {
                try await KairoAPI.shared.signUp(name: name, email: email, password: password)
            }
            await app.bootstrap()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = "Something went wrong — try again."
        }
        busy = false
    }
}
