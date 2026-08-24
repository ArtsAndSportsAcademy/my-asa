process.env.DATABASE_URL ??= "postgresql://localhost/myasa_profile_authorization_tests";

const {
  CAPABILITIES,
  capabilitiesForRoles,
  resolvePrimaryRole,
} = await import("../src/lib/authorization.service.js");
const {
  adminPerson,
  publicPersonCard,
  selfProfile,
  supervisorPerson,
} = await import("../src/lib/person-projection.js");

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

const roles = (values: string[]) => values.map((role) => ({ role }));

assert(resolvePrimaryRole([]) === null, "conta sem perfil não recebe MEMBER por padrão");
assert(resolvePrimaryRole(roles(["TRAINER"])) === "TRAINER", "TRAINER legado é reconhecido explicitamente");
assert(
  resolvePrimaryRole(roles(["MEMBER", "SUPERVISOR_B"])) === "SUPERVISOR_B",
  "prioridade mantém o perfil supervisor sobre membro",
);

const memberCapabilities = capabilitiesForRoles(roles(["MEMBER"]));
assert(memberCapabilities.includes(CAPABILITIES.VIEW_OWN_SCHEDULE), "membro vê a própria escala");
assert(!memberCapabilities.includes(CAPABILITIES.MANAGE_PEOPLE), "membro não administra pessoas");

const trainerCapabilities = capabilitiesForRoles(roles(["TRAINER"]));
assert(trainerCapabilities.includes(CAPABILITIES.VIEW_AGENDA), "treinador legado vê agenda");
assert(!trainerCapabilities.includes(CAPABILITIES.VIEW_OWN_SCHEDULE), "treinador legado não entra na escala do elenco");
assert(!trainerCapabilities.includes(CAPABILITIES.USE_ASA), "treinador legado não herda módulos não autorizados");

const supervisorCapabilities = capabilitiesForRoles(roles(["SUPERVISOR_A"]));
assert(supervisorCapabilities.includes(CAPABILITIES.MANAGE_OPERATIONAL_SCHEDULES), "supervisor gerencia escala operacional");
assert(!supervisorCapabilities.includes(CAPABILITIES.MANAGE_PEOPLE), "supervisor não altera cadastro administrativo");

const adminCapabilities = capabilitiesForRoles(roles(["ADMIN"]));
assert(adminCapabilities.length === Object.keys(CAPABILITIES).length, "admin autorizado recebe todas as capacidades da Onda 1");

const person = {
  id: "person-1",
  organizationId: "org-1",
  name: "Carolina",
  preferredName: "Carol",
  email: "carol@example.com",
  phone: "555-0100",
  username: "carolina.gonzalez",
  passwordHash: "secret-hash",
  mustChangePassword: false,
  photoUrl: null,
  personStatus: "ACTIVE",
  status: "ACTIVE",
  professionalProfile: "MEMBER",
  primaryFunction: "Patinadora",
  specialization: "PERFORMER",
  birthDate: "1990-01-01",
  entryDate: "2024-01-01",
  visitUntil: null,
  adminNotes: "observação reservada",
  contactVisibility: { email: false, phone: true },
  archivedAt: null,
  archivedBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

assert(!("passwordHash" in adminPerson(person)), "nem a projeção admin expõe hash de senha");
assert(!("adminNotes" in selfProfile(person)), "perfil próprio não expõe observações administrativas");
assert(!("adminNotes" in supervisorPerson(person)), "supervisor não recebe observações administrativas");
assert(!("birthDate" in supervisorPerson(person)), "supervisor não recebe data de nascimento");
const publicCard = publicPersonCard(person);
assert(publicCard.email === null && publicCard.phone === person.phone, "cartão público respeita visibilidade de contato");

if (failures.length > 0) {
  console.error(`\n${failures.length} falha(s); ${passed} verificação(ões) passaram.`);
  process.exit(1);
}

console.log(`✓ Segurança de perfis: ${passed} verificações passaram.`);
