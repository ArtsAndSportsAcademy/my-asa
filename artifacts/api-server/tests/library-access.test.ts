import assert from "node:assert/strict";
import { canReadLibraryScope, isLibraryFullReader, isLibraryManager } from "../src/services/library-access.ts";

const house = { scopeType: "HOUSE", areaId: null, locationId: null };
const ownArea = { scopeType: "AREA", areaId: "area-a", locationId: null };
const otherArea = { scopeType: "AREA", areaId: "area-b", locationId: null };
const localDocument = { scopeType: "LOCATION", areaId: "area-a", locationId: "location-a" };
const anotherLocalDocument = { scopeType: "LOCATION", areaId: "area-a", locationId: "location-b" };
const unknownScope = { scopeType: "UNKNOWN", areaId: null, locationId: null };

assert.equal(isLibraryManager("SUPERVISOR_A"), true);
assert.equal(isLibraryManager("DIR"), false);
assert.equal(isLibraryFullReader("DIR"), true);
assert.equal(isLibraryFullReader("MEMBER"), false);
assert.equal(canReadLibraryScope(house, false, "area-a"), true);
assert.equal(canReadLibraryScope(ownArea, false, "area-a"), true);
assert.equal(canReadLibraryScope(otherArea, false, "area-a"), false);
assert.equal(canReadLibraryScope(localDocument, false, "area-a"), false);
assert.equal(canReadLibraryScope(anotherLocalDocument, false, "area-a"), false);
assert.equal(canReadLibraryScope(unknownScope, false, "area-a"), false);
assert.equal(canReadLibraryScope(localDocument, true, null), true);
assert.equal(canReadLibraryScope(otherArea, true, null), true);

console.log("Library access tests passed");
