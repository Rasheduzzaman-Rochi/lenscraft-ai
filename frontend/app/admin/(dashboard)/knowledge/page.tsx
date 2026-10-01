import { Plus } from "lucide-react";
import Link from "next/link";

import { ADMIN_PAGE_SIZE, adminPrimaryButtonClass, EmptyState, ErrorPanel, FilterBar, PageHeader, Pagination, pageNumber } from "@/components/admin/ui";
import { adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminKnowledgeList } from "@/lib/admin/records";
import { formatDate } from "@/lib/admin/time";

export default async function AdminKnowledgePage({ searchParams }: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const [result, display] = await Promise.all([
    getAdminKnowledgeList({ search: query.search?.trim(), limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE })
      .then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Voice agent knowledge"
        title="Knowledge base."
        description="Verified studio information the voice agent searches to answer customer questions."
        actions={<Link href="/admin/knowledge/new" className={adminPrimaryButtonClass}><Plus className="h-3.5 w-3.5" /> New document</Link>}
      />
      <FilterBar action="/admin/knowledge" search={query.search} placeholder="Search titles and content" resetHref="/admin/knowledge" />
      {"error" in result ? (
        <ErrorPanel title="Knowledge documents could not be loaded." message={adminConnectionMessage(result.error)} />
      ) : result.value.items.length === 0 ? (
        <EmptyState title="No documents found." message={query.search ? "No documents match this search." : "Add verified studio information for the voice agent."} />
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {result.value.items.map((document) => (
              <Link key={document.id} href={`/admin/knowledge/${document.id}`} className="group flex flex-col border border-ink/10 bg-paper p-6 transition hover:border-ink/30">
                <h2 className="font-serif text-2xl group-hover:text-bronze">{document.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/55">{document.content.slice(0, 400)}</p>
                <p className="mt-auto pt-4 text-[9px] uppercase tracking-[0.16em] text-ink/40">{document.content.length.toLocaleString()} characters · updated {formatDate(document.updated_at, display.timeZone)}</p>
              </Link>
            ))}
          </div>
          <Pagination basePath="/admin/knowledge" params={{ search: query.search }} page={page} total={result.value.total} />
        </>
      )}
    </div>
  );
}
