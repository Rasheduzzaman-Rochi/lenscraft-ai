import { DeleteRecordButton } from "@/components/admin/form-parts";
import { KnowledgeForm } from "@/components/admin/knowledge-form";
import { BackLink, ErrorPanel, PageHeader, Panel } from "@/components/admin/ui";
import { AdminBackendError, adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminKnowledge } from "@/lib/admin/records";
import { formatDateTime } from "@/lib/admin/time";

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, display] = await Promise.all([
    getAdminKnowledge(id).then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);
  if ("error" in result) {
    const notFound = result.error instanceof AdminBackendError && result.error.status === 404;
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink href="/admin/knowledge" label="Back to knowledge base" />
        <ErrorPanel title={notFound ? "Document not found." : "Document could not be loaded."} message={notFound ? "This document may have been deleted." : adminConnectionMessage(result.error)} retry={!notFound} />
      </div>
    );
  }

  const document = result.value;
  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/admin/knowledge" label="Back to knowledge base" />
      <div className="mt-8">
        <PageHeader eyebrow="Voice agent knowledge" title={document.title} description={`Last updated ${formatDateTime(document.updated_at, display.timeZone)}`} />
      </div>
      <Panel className="mt-8"><KnowledgeForm document={document} /></Panel>
      <DeleteRecordButton
        endpoint={`/api/admin/knowledge/${document.id}`}
        resource="Document"
        recordLabel={document.title}
        redirectTo="/admin/knowledge"
        consequences={<p>The voice agent will no longer use this document to answer questions. Copy its content first if you may need it again.</p>}
      />
    </div>
  );
}
