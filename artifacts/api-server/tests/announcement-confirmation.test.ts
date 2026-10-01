import assert from "node:assert/strict";
import { announcementConfirmationVersion } from "../src/services/announcement-version.ts";

const source = {
  id: "post-1",
  title: "Reunião geral",
  body: "Horário confirmado.",
  scope: "HOUSE" as const,
  areaId: null,
  locationId: null,
  updatedAt: new Date("2026-10-01T12:00:00.000Z"),
};

const version = announcementConfirmationVersion(source);
assert.equal(announcementConfirmationVersion({ ...source }), version);
assert.notEqual(announcementConfirmationVersion({ ...source, title: "Novo título" }), version);
assert.notEqual(announcementConfirmationVersion({ ...source, body: "Novo texto." }), version);
assert.notEqual(announcementConfirmationVersion({ ...source, scope: "AREA", areaId: "area-1" }), version);
assert.notEqual(announcementConfirmationVersion({ ...source, scope: "LOCATION", locationId: "location-1" }), version);
assert.notEqual(announcementConfirmationVersion({ ...source, updatedAt: new Date("2026-10-01T12:01:00.000Z") }), version);

process.stdout.write("Announcement preview version tests passed (6 cases).\n");
