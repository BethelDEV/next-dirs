import SubmissionCardInPublishPage from "@/components/publish/submission-card-in-publish-page";
import ConfettiEffect from "@/components/shared/confetti-effect";
import { RefreshPending } from "@/components/shared/refresh-pending";
import { siteConfig } from "@/config/site";
import { getSubmission } from "@/data/submission";
import { currentUser } from "@/lib/auth";
import { constructMetadata } from "@/lib/metadata";
import { FreePlanStatus, PricePlans, ProPlanStatus } from "@/lib/submission";
import { sanityFetch } from "@/sanity/lib/fetch";
import { itemByIdQuery } from "@/sanity/lib/queries";
import type { ItemInfo } from "@/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata | undefined> {
  return constructMetadata({
    title: "Submit your product (3/3)",
    description: "Submit your product (3/3) Review and publish product",
    canonicalUrl: `${siteConfig.url}/publish/${(await params).id}`,
  });
}

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) {
    console.error("PublishPage, user not found");
    return redirect("/auth/login");
  }

  const { id } = await params;
  const { pay } = ((await searchParams) ?? {}) as { [key: string]: string };

  // console.log('PublishPage, itemId:', id);
  const item = await getSubmission(id);

  if (!item) {
    console.error("PublishPage, item not found");
    return notFound();
  }
  // console.log("PublishPage, item:", item);

  // redirect to dashboard if the item is not submitted by the user
  if (item.submitter._id !== user.id) {
    console.error("PublishPage, user not match");
    return redirect("/dashboard");
  }

  if (!item.paid && ["pending", "processing"].includes(item.paymentStatus))
    return (
      <div className="space-y-4 py-12">
        <RefreshPending active />
        <h1 className="text-2xl">Payment is being confirmed</h1>
        <p>
          This page updates automatically. You can publish once your payment is
          confirmed.
        </p>
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </div>
    );

  // check status, redirect to the corresponding page if the status is not right
  if (
    !item.firstPublishedAt &&
    item.pricePlan === PricePlans.FREE &&
    item.freePlanStatus !== FreePlanStatus.APPROVED
  ) {
    return redirect("/dashboard");
  }
  if (
    item.pricePlan === PricePlans.PRO &&
    item.proPlanStatus !== ProPlanStatus.SUCCESS
  ) {
    return redirect("/dashboard");
  }

  return (
    <div>
      {/* show confetti if the payment is successful */}
      {pay === "success" && item.paid && <ConfettiEffect />}

      <SubmissionCardInPublishPage item={item} />
    </div>
  );
}
