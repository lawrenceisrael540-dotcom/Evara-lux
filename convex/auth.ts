import { convexAuth } from "@convex-dev/auth/server"
import { Password } from "@convex-dev/auth/providers/Password"
import { ResendOTP, PasswordResetEmail } from "./ResendOTP"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ResendOTP,
    Password({
      reset: PasswordResetEmail,
      validatePasswordRequirements(password) {
        if (password.length < 10) throw new Error("Password must be at least 10 characters.")
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error("Password must contain upper, lower and number characters.")
        }
      },
      profile: (params) => {
        const email = String(params.email ?? "").trim().toLowerCase()
        if (!email) throw new Error("Email is required.")
        return { email }
      },
    }),
  ],
})
