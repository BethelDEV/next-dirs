"use client";

import { createCheckoutSession } from "@/actions/create-checkout-session";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type { SubmissionDto as ItemInfo } from "@/db/listings";
import { PricePlans, ProPlanStatus, SponsorPlanStatus } from "@/lib/submission";
import { cn } from "@/lib/utils";
import type { PricePlan } from "@/types";
import {
  ArrowRightIcon,
  ArrowUpLeftIcon,
  CheckCircleIcon,
  RocketIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Icons } from "../icons/icons";

interface SponsorPlanButtonProps {
  item?: ItemInfo;
  pricePlan: PricePlan;
  className?: string;
}

export function SponsorPlanButton({
  item,
  pricePlan,
  className,
}: SponsorPlanButtonProps) {
  // console.log('SponsorPlanButton, item:', item);
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const handleCreateCheckoutSession = () => {
    startTransition(async () => {
      await createCheckoutSession(
        item._id,
        pricePlan.stripePriceId,
        PricePlans.SPONSOR,
      )
        .then((data) => {
          if (data?.status === "error") toast.error(data.message);
          console.log("createCheckoutSession, data:", data);
          // already redirected to stripe checkout page in server action
        })
        .catch((error) => {
          console.error("createCheckoutSession, error:", error);
          toast.error("Failed to create checkout session");
        });
    });
  };

  const handleClick = () => {
    console.log(
      "SponsorPlanButton, handleClick, item.sponsorPlanStatus:",
      item?.sponsorPlanStatus,
    );
    if (!item) {
      // no specific item in pricing page
      router.push("/submit");
    } else if (
      item.sponsorPlanStatus === null ||
      item.sponsorPlanStatus === SponsorPlanStatus.SUBMITTING ||
      item.sponsorPlanStatus === SponsorPlanStatus.PENDING
    ) {
      // maybe in pro plan or free plan before
      console.log("SponsorPlanButton, handleClick, creating checkout session");
      handleCreateCheckoutSession();
    } else if (item.sponsorPlanStatus === SponsorPlanStatus.SUCCESS) {
      if (item.publishDate) {
        // already published
        console.log("SponsorPlanButton, handleClick, already published");
        router.push("/dashboard");
      } else {
        // pay success but not published yet
        console.log(
          "SponsorPlanButton, handleClick, pay success but not published yet",
        );
        router.push(`/publish/${item._id}`);
      }
    } else if (item.sponsorPlanStatus === SponsorPlanStatus.FAILED) {
      console.log("SponsorPlanButton, handleClick, pay failed");
    } else {
      console.error(
        "SponsorPlanButton, invalid sponsor plan status:",
        item.sponsorPlanStatus,
      );
    }
  };

  return (
    <Button
      size="lg"
      variant="default"
      className={cn(
        "overflow-hidden rounded-full",
        "group transition-transform duration-300 ease-in-out hover:scale-105",
        "bg-primary text-primary-foreground dark:bg-primary/90",
        "hover:bg-primary/90 dark:hover:bg-primary/80",
        "shadow-lg hover:shadow-xl",
        className,
      )}
      disabled={isPending}
      onClick={handleClick}
    >
      {!item ? (
        <div className="flex items-center justify-center gap-2">
          <span>Go Submit</span>
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
        </div>
      ) : isPending ? (
        // when creating checkout session
        <div className="flex items-center justify-center">
          <Icons.spinner className="mr-2 size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : item.sponsorPlanStatus === SponsorPlanStatus.SUCCESS ? (
        // maybe published already(pay success or approved in free plan)
        item.publishDate ? (
          <div className="flex items-center justify-center">
            <ArrowUpLeftIcon className="mr-2 size-4 icon-scale" />
            <span>Go Dashboard</span>
          </div>
        ) : (
          // maybe pay success but not published yet
          <div className="flex items-center justify-center">
            <CheckCircleIcon className="mr-2 size-4 icon-scale" />
            <span>Go Publish</span>
          </div>
        )
      ) : (
        // not paid success yet
        <div className="flex items-center justify-center">
          <RocketIcon className="mr-2 size-4 icon-scale" />
          <span>Pay & Publish Right Now</span>
        </div>
      )}
    </Button>
  );
}
