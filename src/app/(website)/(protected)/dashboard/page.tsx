import EmptySubmission from "@/components/dashboard/submission-empty";
import SubmissionList from "@/components/dashboard/submission-list";
import CustomPagination from "@/components/shared/pagination";
import { siteConfig } from "@/config/site";
import { getSubmissions } from "@/data/submission";
import { currentUser } from "@/lib/auth";
import { SUBMISSIONS_PER_PAGE } from "@/lib/constants";
import { constructMetadata } from "@/lib/metadata";
import { redirect } from "next/navigation";

export const metadata = constructMetadata({
  title: "Dashboard",
  description: "Overview of submissions",
  canonicalUrl: `${siteConfig.url}/dashboard`,
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/auth/login");

  const { page } = ((await searchParams) ?? {}) as { [key: string]: string };
  const currentPage = page ? Number(page) : 1;
  const { submissions, totalCount } = await getSubmissions({
    currentPage,
  });
  const totalPages = Math.ceil(totalCount / SUBMISSIONS_PER_PAGE);

  return (
    <div>
      {/* when no submissions are found */}
      {submissions?.length === 0 && <EmptySubmission />}

      {/* when submissions are found */}
      {submissions && submissions.length > 0 && (
        <section className="">
          <SubmissionList items={submissions} />

          <div className="mt-8 flex items-center justify-center">
            <CustomPagination
              routePrefix="/dashboard"
              totalPages={totalPages}
            />
          </div>
        </section>
      )}
    </div>
  );
}
