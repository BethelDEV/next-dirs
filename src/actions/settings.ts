"use server";
import { SettingsSchema } from "@/lib/schemas";
import type { z } from "zod";
import { updateUserLink } from "./update-link";
import { updateUserName } from "./update-name";
import { updateUserPassword } from "./update-password";
export async function settings(values: z.infer<typeof SettingsSchema>) {
  const parsed = SettingsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Invalid fields" };
  if (parsed.data.password && parsed.data.newPassword)
    return updateUserPassword({
      password: parsed.data.password,
      newPassword: parsed.data.newPassword,
      confirmPassword: parsed.data.newPassword,
    });
  const result = await updateUserName({ name: parsed.data.name });
  if (result.status === "error") return result;
  return updateUserLink({ link: parsed.data.link ?? "" });
}
