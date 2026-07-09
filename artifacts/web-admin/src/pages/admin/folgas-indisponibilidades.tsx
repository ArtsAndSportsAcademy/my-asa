import AdminLayout from "@/components/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolgasContent } from "@/pages/admin/folgas";
import { RestrictionsContent } from "@/pages/supervisor/restrictions";

export default function FolgasIndisponibilidadesPage() {
  return (
    <AdminLayout title="Folgas & Indisponibilidades">
      <Tabs defaultValue="folgas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="folgas">Folgas</TabsTrigger>
          <TabsTrigger value="indisponibilidades">Indisponibilidades</TabsTrigger>
        </TabsList>
        <TabsContent value="folgas">
          <FolgasContent />
        </TabsContent>
        <TabsContent value="indisponibilidades">
          <RestrictionsContent />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
