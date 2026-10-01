import type { usersTable } from "@workspace/db";

type Person = typeof usersTable.$inferSelect;

export function adminPerson(person: Person) {
  const { passwordHash: _passwordHash, ...result } = person;
  return { ...result, displayName: person.name };
}

export function selfProfile(person: Person) {
  const {
    passwordHash: _passwordHash,
    adminNotes: _adminNotes,
    archivedBy: _archivedBy,
    fullName: _fullName,
    ...result
  } = person;
  return { ...result, displayName: person.name };
}

export function supervisorPerson(person: Person) {
  const {
    passwordHash: _passwordHash,
    adminNotes: _adminNotes,
    birthDate: _birthDate,
    archivedBy: _archivedBy,
    fullName: _fullName,
    silencio: _silencio,
    ...result
  } = person;
  return { ...result, displayName: person.name };
}

/** Nível escolhido; linha antiga sem `privacidade` herda o booleano de `contactVisibility` (visível = toda a ASA). */
function nivelDe(person: Person) {
  if (person.privacidade) return person.privacidade;
  const cv = person.contactVisibility ?? { email: true, phone: true };
  return { tel: cv.phone ? "asa" : "gestao", mail: cv.email ? "asa" : "gestao", bday: "mural" } as const;
}

/**
 * Colega vendo colega (Elenco no diretório da própria área): telefone e e-mail só aparecem se a
 * dona do dado escolheu "meu grupo" ou "toda a ASA". "Só gestão" some para colegas. (28 Perfil, regra 02)
 */
export function colleaguePerson(person: Person, viewerId: string) {
  const base = supervisorPerson(person);
  if (person.id === viewerId) return base;
  const nivel = nivelDe(person);
  return { ...base, phone: nivel.tel === "gestao" ? null : person.phone, email: nivel.mail === "gestao" ? null : person.email, privacidade: undefined };
}

/** Cartão público: `relacao` é como quem olha se liga à pessoa (gestão, mesmo grupo ou só a mesma ASA). */
export function publicPersonCard(person: Person, relacao: "gestao" | "grupo" | "asa" = "asa") {
  const nivel = nivelDe(person);
  const ve = (escolha: "gestao" | "grupo" | "asa") => relacao === "gestao" || escolha === "asa" || (escolha === "grupo" && relacao === "grupo");
  return {
    id: person.id,
    name: person.name,
    displayName: person.name,
    photoUrl: person.photoUrl,
    professionalProfile: person.professionalProfile,
    primaryFunction: person.primaryFunction,
    specialization: person.specialization,
    email: ve(nivel.mail) ? person.email : null,
    phone: ve(nivel.tel) ? person.phone : null,
  };
}
