import { notFound } from "next/navigation";
import EventDesk from "@/components/EventDesk";
import { listDeskEvents, loadDeskEvent, requireDeskUser } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

export default async function EventDeskPage({ searchParams }: { searchParams: { id?: string } }) {
  if (!(await requireDeskUser())) notFound();
  const events = await listDeskEvents();
  const openId = searchParams.id || events[0]?.id || "";
  const open = openId ? await loadDeskEvent(openId) : null;
  return <EventDesk events={events} open={open} />;
}
