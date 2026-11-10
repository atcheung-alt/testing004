import { notFound } from "next/navigation";
import EventDesk from "@/components/EventDesk";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EventDeskPage() {
  const user = await getCurrentUser();
  if (!user || user.email.trim().toLowerCase() !== "atcheung@hrplus.info") notFound();
  return <EventDesk />;
}
