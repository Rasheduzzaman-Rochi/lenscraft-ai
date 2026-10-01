import { KnowledgeForm } from "@/components/admin/knowledge-form";
import { BackLink, PageHeader, Panel } from "@/components/admin/ui";

export default function NewKnowledgePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/admin/knowledge" label="Back to knowledge base" />
      <div className="mt-8"><PageHeader eyebrow="Voice agent knowledge" title="New document." /></div>
      <Panel className="mt-8"><KnowledgeForm /></Panel>
    </div>
  );
}
