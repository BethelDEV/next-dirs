import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
// Middleware only uses JWT routing hints. All privileged operations recheck D1.
export default { providers: [GitHub, Google] } satisfies NextAuthConfig;
