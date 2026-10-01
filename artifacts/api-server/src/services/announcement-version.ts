import { createHash } from "node:crypto";

export type AnnouncementConfirmationSnapshot = {
  id: string;
  title: string | null;
  body: string;
  scope: "HOUSE" | "AREA" | "LOCATION";
  areaId: string | null;
  locationId: string | null;
  updatedAt: Date;
};

export function announcementConfirmationVersion(post: AnnouncementConfirmationSnapshot): string {
  return createHash("sha256").update(JSON.stringify([
    post.id, post.title, post.body, post.scope, post.areaId, post.locationId, post.updatedAt,
  ])).digest("hex");
}
