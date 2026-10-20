/**
 * Keeps a list page's title, search, filters, and top-right actions
 * pinned while the document list scrolls. Negative margins cancel the
 * app layout's padding so the bar sits flush with the viewport. The
 * frosted backdrop only appears after the page has been scrolled, so
 * the top of the page still looks like the rest of the layout.
 */
export default function StickyListHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 border-b border-line bg-paper px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
