import type { usersTable } from "@workspace/db";

type Person = typeof usersTable.$inferSelect;

export function adminPerson(person: Person) {
  const { passwordHash: _passwordHash, ...result } = person;
  return result;
}

export function selfProfile(person: Person) {
  const {
    passwordHash: _passwordHash,
    adminNotes: _adminNotes,
    archivedBy: _archivedBy,
    ...result
  } = person;
  return result;
}

export function supervisorPerson(person: Person) {
  const {
    passwordHash: _passwordHash,
    adminNotes: _adminNotes,
    birthDate: _birthDate,
    archivedBy: _archivedBy,
    ...result
  } = person;
  return result;
}

export function publicPersonCard(person: Person) {
  const visibility = person.contactVisibility ?? { email: true, phone: true };
  return {
    id: person.id,
    name: person.name,
    preferredName: person.preferredName,
    photoUrl: person.photoUrl,
    professionalProfile: person.professionalProfile,
    primaryFunction: person.primaryFunction,
    specialization: person.specialization,
    email: visibility.email ? person.email : null,
    phone: visibility.phone ? person.phone : null,
  };
}
