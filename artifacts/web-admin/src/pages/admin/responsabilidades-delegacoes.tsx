import AdminLayout from "@/components/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsibilitiesContent } from "@/pages/admin/responsibilities";
import { DelegationsContent } from "@/pages/supervisor/delegations";

export default function ResponsabilidadesDelegacoesPage() {
  return (
    <AdminLayout title="Responsabilidades & Delegações">
      <Tabs defaultValue="responsabilidades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="responsabilidades">Responsabilidades</TabsTrigger>
          <TabsTrigger value="delegacoes">Delegações</TabsTrigger>
        </TabsList>
        <TabsContent value="responsabilidades">
          <ResponsibilitiesContent />
        </TabsContent>
        <TabsContent value="delegacoes">
          <DelegationsContent />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
