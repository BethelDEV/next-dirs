"use server";

import { getUserByEmail } from "@/data/user";
import { getDb } from "@/db";
import { hashToken, limitAction } from "@/db/identity";
import { sendPasswordResetEmail } from "@/lib/mail";
import { ResetSchema } from "@/lib/schemas";
import { generatePasswordResetToken } from "@/lib/tokens";
import type * as z from "zod";

export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
};

export async function reset(
  values: z.infer<typeof ResetSchema>,
): Promise<ServerActionResponse> {
  const validatedFields = ResetSchema.safeParse(values);
  if (!validatedFields.success) {
    return { status: "error", message: "Invalid email!" };
  }

  const { email } = validatedFields.data;

  const response = {
    status: "success" as const,
    message: "If this account can reset its password, an email is on its way.",
  };
  if (
    !(await limitAction(
      await getDb(),
      `reset:${await hashToken(email.toLowerCase())}`,
      3,
      3600,
    ))
  )
    return response;
  const existingUser = await getUserByEmail(email);
  if (!existingUser || existingUser.disabled || !existingUser.password) {
    return response;
  }

  const passwordResetToken = await generatePasswordResetToken(email);
  await sendPasswordResetEmail(
    existingUser.name,
    passwordResetToken.identifier,
    passwordResetToken.token,
  );

  return response;
}
