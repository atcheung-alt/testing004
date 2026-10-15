/**
 * Keeps a list page's title, search, filters, and top-right actions
 * pinned while the document list scrolls. `top-14` on small screens sits
 * below the floating hamburger / language switch; desktop sticks to the
 * viewport top. Horizontal negative margins match the app layout padding
 * so the backdrop covers the full content column.
 */
export default function StickyListHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-14 lg:top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 pt-3 pb-4 bg-paper/90 backdrop-blur-md border-b border-line">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
