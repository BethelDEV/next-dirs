"use server";

import { signIn } from "@/auth";
import { getUserByEmail } from "@/data/user";
import { getDb } from "@/db";
import { hashToken, limitAction } from "@/db/identity";
import { sendVerificationEmail } from "@/lib/mail";
import { LoginSchema } from "@/lib/schemas";
import { generateVerificationToken } from "@/lib/tokens";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import type * as z from "zod";

export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
  redirectUrl?: string;
};

export async function login(
  values: z.infer<typeof LoginSchema>,
  callbackUrl?: string | null,
): Promise<ServerActionResponse> {
  const validatedFields = LoginSchema.safeParse(values);
  if (!validatedFields.success) {
    return { status: "error", message: "Invalid fields!" };
  }

  const { email, password } = validatedFields.data;
  const db = await getDb();
  if (
    !(await limitAction(
      db,
      `login-action:${await hashToken(email.toLowerCase())}`,
      10,
      900,
    ))
  )
    return { status: "error", message: "Please try again later" };
  const redirectUrl =
    callbackUrl?.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !/[\\\r\n]/.test(callbackUrl)
      ? callbackUrl
      : DEFAULT_LOGIN_REDIRECT;
  const existingUser = await getUserByEmail(email);
  if (!existingUser || !existingUser.email || !existingUser.password) {
    return { status: "error", message: "Invalid credentials!" };
  }

  if (
    existingUser.disabled ||
    !(await bcrypt.compare(password, existingUser.password))
  )
    return { status: "error", message: "Invalid credentials!" };
  if (!existingUser.emailVerified) {
    const verificationToken = await generateVerificationToken(
      existingUser.email,
    );
    await sendVerificationEmail(
      verificationToken.identifier,
      verificationToken.token,
    );
    return {
      status: "success",
      message: "Please check your email for verification",
    };
  }

  try {
    // https://youtu.be/1MTyCvS05V4?t=9828
    await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: redirectUrl,
    });

    return {
      status: "success",
      message: "Login success",
      redirectUrl: redirectUrl,
    };
  } catch (error) {
    // console.error("login, error:", error);
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { status: "error", message: "Invalid credentials!" };
        default:
          return { status: "error", message: "Something went wrong!" };
      }
    }
    return { status: "error", message: "Something went wrong!" };
  }
}
