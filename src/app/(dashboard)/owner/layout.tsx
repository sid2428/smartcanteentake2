import { guardPage } from "@/lib/server/page-guard";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await guardPage("/owner", "owner");
  return children;
}
