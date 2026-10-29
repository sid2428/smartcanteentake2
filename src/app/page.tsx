import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { ROLE_HOME } from "@/lib/constants";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const destination = ROLE_HOME[session.role] || "/menu";
  redirect(destination);
}
