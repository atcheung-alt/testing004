import { notFound } from "next/navigation";
import EventDesk from "@/components/EventDesk";
import { listDeskEvents, loadDeskEvent, requireDeskUser } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

export default async function EventDeskPage({ searchParams }: { searchParams: { id?: string } }) {
  const user = await requireDeskUser();
  if (!user) notFound();
  const events = await listDeskEvents();
  const open = searchParams.id ? await loadDeskEvent(searchParams.id) : null;
  return <EventDesk key={open?.id || "list"} events={events} open={open} senderEmail={user.email} />;
}
