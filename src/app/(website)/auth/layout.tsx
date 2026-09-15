import BackButtonSmall from "@/components/shared/back-button-small";
import { currentUser } from "@/lib/auth";
import Image from "next/image";
import { redirect } from "next/navigation";

/**
 * auth layout is different from other public layouts,
 * so auth directory is not put in (public) directory.
 *
 * https://ui.shadcn.com/blocks#authentication-04
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await currentUser()) redirect("/dashboard");
  return (
    <div>
      <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
        {/* auth form */}
        <div className="flex items-center justify-center relative w-full h-full min-h-screen">
          <BackButtonSmall className="absolute top-6 left-6" />
          <div className="w-full max-w-md px-4">{children}</div>
        </div>

        {/* brand image */}
        <div className="hidden bg-muted lg:block">
          <Image
            src="/placeholder.svg"
            alt="Image"
            width="1920"
            height="1080"
            className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </div>
  );
}
