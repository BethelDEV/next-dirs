import { Resend } from "resend";
import { ApprovalEmail } from "../../emails/approval-email";
import { NotifySubmissionToUserEmail } from "../../emails/notify-submission-to-user";
import { PaymentSuccessEmail } from "../../emails/payment-success";
import RejectionEmail from "../../emails/rejection-email";
import { ResetPasswordEmail } from "../../emails/reset-password";
import VerifyEmail from "../../emails/verify-email";
import { findUser, hashToken } from "../db/identity";

export interface NotificationProvider {
  send(input: {
    id: string;
    to: string;
    subject: string;
    react?: React.ReactNode;
    text?: string;
  }): Promise<void>;
  contact(email: string, unsubscribed: boolean): Promise<void>;
}
export function emailProvider(config: {
  apiKey: string;
  from: string;
  audienceId?: string;
}): NotificationProvider {
  const resend = new Resend(config.apiKey);
  return {
    async send(input) {
      const result = await resend.emails.send(
        {
          from: config.from,
          to: input.to,
          subject: input.subject,
          ...(input.react
            ? { react: input.react }
            : { text: input.text ?? "" }),
        },
        { idempotencyKey: input.id },
      );
      if (result.error) throw new Error("Email provider failed");
    },
    async contact(email, unsubscribed) {
      const result = await resend.contacts.create({
        email,
        unsubscribed,
        audienceId: config.audienceId,
      });
      if (result.error) throw new Error("Contact synchronization failed");
    },
  };
}

export async function drainNotifications(
  db: D1Database,
  provider: NotificationProvider,
  config: { siteUrl: string; adminEmail?: string },
  maximum = 10,
) {
  for (let count = 0; count < maximum; count++) {
    const now = new Date().toISOString();
    const lease = crypto.randomUUID();
    const row = await db
      .prepare(
        "UPDATE notifications SET status='running',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),lease_token=?,lease_until=? WHERE id=(SELECT id FROM notifications WHERE (status IN ('pending','failed') AND available_at<=?) OR (status='running' AND lease_until<?) ORDER BY created_at,id LIMIT 1) RETURNING id,kind,payload_json,attempts,first_attempt_at",
      )
      .bind(now, lease, new Date(Date.now() + 60000).toISOString(), now, now)
      .first<{
        id: string;
        kind: string;
        payload_json: string;
        attempts: number;
        first_attempt_at: string;
      }>();
    if (!row) break;
    // Provider idempotency lasts 24 hours. A lost response must not cause a new
    // automatic send outside that window; staff can inspect paused deliveries.
    if (
      row.attempts > 10 ||
      Date.now() - Date.parse(row.first_attempt_at) > 23 * 3600_000
    ) {
      await db
        .prepare(
          "UPDATE notifications SET status='paused',last_error='Delivery needs review',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?",
        )
        .bind(row.id, lease)
        .run();
      continue;
    }
    try {
      const payload = JSON.parse(row.payload_json) as {
        userId?: string;
        listingId?: string;
        to?: string;
        token?: string;
        name?: string;
        unsubscribeToken?: string;
      };
      const user = payload.userId
        ? await findUser(db, "id", payload.userId)
        : null;
      const to =
        row.kind === "review-admin"
          ? config.adminEmail
          : (payload.to ?? user?.email);
      if (!to) throw new Error("Recipient missing");
      if (row.kind === "newsletter-sync") {
        const state = await db
          .prepare(
            "SELECT status,updated_at FROM newsletter_subscriptions WHERE email=?",
          )
          .bind(to)
          .first<{ status: string; updated_at: string }>();
        if (state) {
          await provider.contact(to, state.status === "unsubscribed");
          const current = await db
            .prepare(
              "SELECT status,updated_at FROM newsletter_subscriptions WHERE email=?",
            )
            .bind(to)
            .first<{ status: string; updated_at: string }>();
          if (
            current.status !== state.status ||
            current.updated_at !== state.updated_at
          )
            throw new Error("Subscription changed; sync current state again");
        }
      } else if (row.kind === "newsletter-welcome") {
        const state = await db
          .prepare(
            "SELECT status,unsubscribe_hash FROM newsletter_subscriptions WHERE email=?",
          )
          .bind(to)
          .first<{ status: string; unsubscribe_hash: string }>();
        if (
          state?.status === "subscribed" &&
          state.unsubscribe_hash === (await hashToken(payload.unsubscribeToken))
        ) {
          await provider.send({
            id: row.id,
            to,
            subject: "Welcome to our newsletter",
            text: `Thanks for subscribing!\n\nUnsubscribe: ${config.siteUrl}/unsubscribe?token=${encodeURIComponent(payload.unsubscribeToken)}`,
          });
        }
      } else {
        const link = `${config.siteUrl}/dashboard`;
        let subject = "Submission update";
        let react: React.ReactNode;
        let text: string;
        if (row.kind === "verify" || row.kind === "reset") {
          const valid = await db
            .prepare(
              "SELECT token_hash FROM verification_tokens WHERE token_hash=? AND expires_at>?",
            )
            .bind(await hashToken(payload.token), now)
            .first();
          if (valid) {
            if (row.kind === "verify") {
              subject = "Confirm your email";
              react = VerifyEmail({
                confirmLink: `${config.siteUrl}/auth/new-verification?token=${encodeURIComponent(payload.token)}`,
              });
            } else {
              subject = "Reset your password";
              react = ResetPasswordEmail({
                userName: payload.name,
                resetLink: `${config.siteUrl}/auth/new-password?token=${encodeURIComponent(payload.token)}`,
              });
            }
          }
        } else if (row.kind === "payment")
          react = PaymentSuccessEmail({ userName: user.name, itemLink: link });
        else if (row.kind === "approve")
          react = ApprovalEmail({ userName: user.name, itemLink: link });
        else if (row.kind === "reject")
          react = RejectionEmail({ userName: user.name, dashboardLink: link });
        else if (row.kind === "published") {
          subject = "Your listing is published";
          text = `Your listing has been published. Manage it at ${link}`;
        } else if (row.kind === "review-admin") {
          subject = "A submission needs review";
          text = `Review the submission in ${config.siteUrl}/admin`;
        } else
          react = NotifySubmissionToUserEmail({
            userName: user?.name ?? "",
            itemName: "your submission",
            statusLink: link,
          });
        if (react || text)
          await provider.send({ id: row.id, to, subject, react, text });
      }
      await db
        .prepare(
          "UPDATE notifications SET status='sent',payload_json='{}',lease_token=NULL,lease_until=NULL,last_error=NULL WHERE id=? AND lease_token=?",
        )
        .bind(row.id, lease)
        .run();
    } catch {
      await db
        .prepare(
          "UPDATE notifications SET status='failed',lease_token=NULL,lease_until=NULL,last_error='Delivery failed',available_at=? WHERE id=? AND lease_token=?",
        )
        .bind(
          new Date(
            Date.now() + Math.min(3600, 2 ** Math.min(row.attempts, 10)) * 1000,
          ).toISOString(),
          row.id,
          lease,
        )
        .run();
    }
  }
}
