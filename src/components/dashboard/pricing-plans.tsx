"use client";

import { FreePlanButton } from "@/components/payment/free-plan-button";
import { ProPlanButton } from "@/components/payment/pro-plan-button";
import { Skeleton } from "@/components/ui/skeleton";
import { priceConfig } from "@/config/price";
import type { SubmissionDto as ItemInfo } from "@/db/listings";
import { PricePlans } from "@/lib/submission";
import { cn } from "@/lib/utils";
import type { PricePlan } from "@/types/index";
import { CheckIcon, XIcon } from "lucide-react";
import { SponsorPlanButton } from "../payment/sponsor-plan-button";

interface PricingPlansProps {
  item?: ItemInfo;
}

export function PricingPlans({ item }: PricingPlansProps) {
  // console.log('PricingPlans, item:', item);
  return (
    <section className="flex flex-col items-center text-center w-full mx-auto">
      <div className="grid gap-8 w-full sm:grid-cols-1 lg:grid-cols-3 items-center">
        {priceConfig.plans.map((pricePlan) => (
          <PricingPlanCard
            item={item}
            key={pricePlan.title}
            pricePlan={pricePlan}
          />
        ))}
      </div>
    </section>
  );
}

interface PricingPlanCardProps {
  item?: ItemInfo;
  pricePlan: PricePlan;
}

const PricingPlanCard = ({ item, pricePlan }: PricingPlanCardProps) => {
  return (
    <div className="relative pt-4">
      {isProPlan(pricePlan) && (
        <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
            POPULAR
          </div>
        </div>
      )}
      <div
        className={cn(
          "relative overflow-hidden flex flex-col rounded-xl shadow-sm",
          isProPlan(pricePlan) ? "border-2 border-primary" : "border",
        )}
      >
        {/* price plan title and price */}
        <div className="bg-muted/50 p-6 pr-10 border-b flex flex-row items-center justify-between">
          <span className="text-2xl font-bold uppercase tracking-wider">
            {pricePlan.title}
          </span>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-semibold font-workSans leading-relaxed text-primary">
              ${pricePlan.price}
            </div>
            <div className="text-sm font-semibold font-workSans leading-relaxed text-muted-foreground">
              {pricePlan.priceSuffix}
            </div>
          </div>
        </div>

        {/* price plan features and limitations */}
        <div className="flex flex-col flex-grow px-6 py-8">
          <div className="flex-grow space-y-4">
            <div className="grid grid-cols-1 gap-4 text-left text-sm leading-normal">
              {pricePlan.benefits.map((feature) => (
                <div key={feature} className="flex items-start gap-x-4">
                  <CheckIcon className="text-primary size-4 shrink-0 text-primary-500 mt-0.5" />
                  <p>{feature}</p>
                </div>
              ))}

              {pricePlan.limitations.map((feature) => (
                <div key={feature} className="flex items-start gap-x-4">
                  <XIcon className="size-4 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">{feature}</p>
                </div>
              ))}
            </div>
          </div>

          {/* action buttons */}
          <div className="mt-12 px-6">
            {pricePlan.title.toUpperCase() === PricePlans.FREE.toUpperCase() ? (
              <FreePlanButton item={item} className="w-full" />
            ) : pricePlan.title.toUpperCase() ===
              PricePlans.SPONSOR.toUpperCase() ? (
              <SponsorPlanButton
                item={item}
                pricePlan={pricePlan}
                className="w-full"
              />
            ) : (
              <ProPlanButton
                item={item}
                pricePlan={pricePlan}
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function isProPlan(pricePlan: PricePlan) {
  return pricePlan.title.toLowerCase() === PricePlans.PRO.toLowerCase();
}

export function PricingPlansSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {[...Array(2)].map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <PricingPlanCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function PricingPlanCardSkeleton() {
  return (
    <div className="relative flex flex-col p-6 rounded-lg justify-between border">
      <div>
        <div className="flex justify-between">
          <Skeleton className="h-12 w-24" /> {/* Plan name */}
          <Skeleton className="h-12 w-24" /> {/* Popular badge */}
        </div>
        {/* <div className="mt-4 flex items-baseline text-zinc-900 dark:text-zinc-50">
          <Skeleton className="h-12 w-20" /> 
          <Skeleton className="ml-1 h-6 w-16" /> 
        </div> */}
      </div>
      <ul className="mt-6 space-y-4">
        {[...Array(6)].map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <li key={index} className="flex">
            {/* <CheckIcon className="h-6 w-6 shrink-0" /> */}
            <Skeleton className="h-8 w-full" /> {/* Feature */}
          </li>
        ))}
      </ul>
      <Skeleton className="mt-8 h-14 w-full" />
    </div>
  );
}
