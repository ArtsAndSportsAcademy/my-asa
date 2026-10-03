import { createHash } from "node:crypto";

export type AnnouncementConfirmationSnapshot = {
  id: string;
  title: string | null;
  body: string;
  // PEOPLE (0053): a lista de pessoas não muda depois de publicado, então não entra na versão.
  scope: "HOUSE" | "AREA" | "LOCATION" | "PEOPLE";
  areaId: string | null;
  locationId: string | null;
  updatedAt: Date;
};

export function announcementConfirmationVersion(post: AnnouncementConfirmationSnapshot): string {
  return createHash("sha256").update(JSON.stringify([
    post.id, post.title, post.body, post.scope, post.areaId, post.locationId, post.updatedAt,
  ])).digest("hex");
}
