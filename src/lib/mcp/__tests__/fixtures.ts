import { ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createToolIdentity, type ConfirmationKey, type UserScopedDb } from "../domain/client";
import {
  createFakeClient,
  type FakeClient,
  type FakeClientOptions,
  type FakeQueryCall,
  type FakeRpcCall,
  type RecordedCall,
} from "./fakeSupabase";

type Row = Record<string, unknown>;

export const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export const INSTITUTION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const INSTITUTION_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

export const FOLDER_A = "11111111-1111-4111-8111-111111111111";
export const FOLDER_A_SYSTEM = "11111111-1111-4111-8111-222222222222";
export const FOLDER_A_DELETED = "11111111-1111-4111-8111-333333333333";
export const FOLDER_A_CLASS = "11111111-1111-4111-8111-444444444444";
export const FOLDER_A_INSTITUTION = "11111111-1111-4111-8111-555555555555";
export const FOLDER_B = "22222222-2222-4222-8222-222222222222";

export const LIST_A = "aaaaaaaa-0001-4000-8000-000000000001";
export const LIST_A_SECOND = "aaaaaaaa-0001-4000-8000-000000000002";
export const LIST_A_SYSTEM = "aaaaaaaa-0001-4000-8000-000000000003";
export const LIST_A_DELETED = "aaaaaaaa-0001-4000-8000-000000000004";
export const LIST_A_INSTITUTION = "aaaaaaaa-0001-4000-8000-000000000005";
export const LIST_B = "bbbbbbbb-0001-4000-8000-000000000001";

export const CARD_A_1 = "aaaaaaaa-0002-4000-8000-000000000001";
export const CARD_A_2 = "aaaaaaaa-0002-4000-8000-000000000002";
export const CARD_A_3 = "aaaaaaaa-0002-4000-8000-000000000003";
export const CARD_A_DELETED = "aaaaaaaa-0002-4000-8000-000000000004";
export const CARD_A_OTHER_LIST = "aaaaaaaa-0002-4000-8000-000000000005";
export const CARD_B_1 = "bbbbbbbb-0002-4000-8000-000000000001";

function folderRow(overrides: Row): Row {
  return {
    owner_id: USER_A,
    title: "Pasta",
    description: null,
    visibility: "private",
    system_kind: "user",
    deleted_at: null,
    class_id: null,
    institution_id: null,
    lang_a: "en",
    lang_b: "pt",
    tts_enabled: true,
    updated_at: "2026-09-13T10:00:00.000Z",
    lists: [],
    ...overrides,
  };
}

function listRow(overrides: Row, folder: Row): Row {
  return {
    owner_id: USER_A,
    title: "Lista",
    description: null,
    folder_id: String(folder.id),
    order_index: 0,
    primary_side: "a",
    lang: "en",
    lang_a: "en",
    lang_b: "pt",
    study_type: "language",
    labels_a: null,
    labels_b: null,
    tts_enabled: true,
    visibility: "private",
    system_kind: "user",
    deleted_at: null,
    updated_at: "2026-09-13T11:00:00.000Z",
    folders: folder,
    ...overrides,
  };
}

function cardRow(overrides: Row, list: Row): Row {
  return {
    user_id: USER_A,
    list_id: String(list.id),
    term: "word",
    translation: "palavra",
    hint: null,
    example_text: null,
    example_translation: null,
    context_tag: null,
    layer_index: null,
    parent_card_id: null,
    deleted_at: null,
    created_at: "2026-09-13T12:00:00.000Z",
    updated_at: "2026-09-13T12:00:00.000Z",
    lists: list,
    ...overrides,
  };
}

const privateFolderA = folderRow({
  id: FOLDER_A,
  title: "Inglês B1",
  description: "Curso de inglês intermediário",
  lists: [
    { id: LIST_A, deleted_at: null, system_kind: "user" },
    { id: LIST_A_SYSTEM, deleted_at: null, system_kind: "reforco" },
    { id: LIST_A_DELETED, deleted_at: "2026-09-01T00:00:00.000Z", system_kind: "user" },
  ],
});

const privateFolderA2 = folderRow({
  id: FOLDER_A_CLASS,
  title: "Turma privada",
  class_id: "99999999-1111-4111-8111-999999999999",
});

const privateFolderB = folderRow({ id: FOLDER_B, owner_id: USER_B, title: "Conta B privada" });

const institutionFolderA = folderRow({
  id: FOLDER_A_INSTITUTION,
  title: "Biblioteca da instituição",
  institution_id: INSTITUTION_A,
});

const listA = listRow({ id: LIST_A, title: "Phrasal Verbs" }, privateFolderA);
const listASecond = listRow({ id: LIST_A_SECOND, title: "Present Perfect" }, privateFolderA);
const listASystem = listRow({ id: LIST_A_SYSTEM, title: "Reforço", system_kind: "reforco" }, privateFolderA);
const listADeleted = listRow({ id: LIST_A_DELETED, title: "Lista apagada", deleted_at: "2026-09-01T00:00:00.000Z" }, privateFolderA);
const listAInstitution = listRow({ id: LIST_A_INSTITUTION, title: "Lista institucional" }, institutionFolderA);
const listB = listRow({ id: LIST_B, owner_id: USER_B, title: "Lista da conta B" }, privateFolderB);

const cardA1 = cardRow({ id: CARD_A_1, term: "work", translation: "trabalhar" }, listA);
const cardA2 = cardRow({ id: CARD_A_2, term: "study", translation: "estudar" }, listA);
const cardA3 = cardRow({ id: CARD_A_3, term: "warehouse", translation: "armazém" }, listASecond);
const cardADeleted = cardRow({ id: CARD_A_DELETED, term: "ghost", deleted_at: "2026-09-01T00:00:00.000Z" }, listA);
const cardB1 = cardRow({ id: CARD_B_1, user_id: USER_B, term: "warehouse", translation: "galpão" }, listB);

export interface FixtureTables extends Record<string, Row[]> {}

/** Fresh fixture set: account A with personal + institution content, account B private. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildTables(): FixtureTables {
  return {
    folders: [
      privateFolderA,
      folderRow({ id: FOLDER_A_SYSTEM, title: "Pontos de atenção", system_kind: "attention" }),
      folderRow({ id: FOLDER_A_DELETED, title: "Pasta apagada", deleted_at: "2026-09-01T00:00:00.000Z" }),
      privateFolderA2,
      institutionFolderA,
      privateFolderB,
    ].map(clone),
    lists: [listA, listASecond, listASystem, listADeleted, listAInstitution, listB].map(clone),
    flashcards: [cardA1, cardA2, cardA3, cardADeleted, cardB1].map(clone),
    institutions: [
      { id: INSTITUTION_A, owner_id: USER_A, name: "Colégio Alfa" },
      { id: INSTITUTION_B, owner_id: USER_B, name: "Colégio Beta" },
    ].map(clone),
    profiles: [
      { id: USER_A, first_name: "Pedro", avatar_url: null, is_teacher: true, level: 7, public_slug: "pedro" },
      { id: USER_B, first_name: "Outra Conta", avatar_url: null, is_teacher: false, level: 1, public_slug: null },
    ].map(clone),
  };
}

export interface TestHarness {
  db: UserScopedDb;
  calls: RecordedCall[];
  fake: FakeClient;
}

export function createHarness(
  tables: FixtureTables = buildTables(),
  options: FakeClientOptions = {},
  userId: string = USER_A,
): TestHarness {
  const calls: RecordedCall[] = [];
  const fake = createFakeClient(tables, options, calls);
  return {
    db: { client: fake as unknown as SupabaseClient, userId },
    calls,
    fake,
  };
}

export function callsFor(calls: RecordedCall[], table: string): FakeQueryCall[] {
  return calls.filter((call): call is FakeQueryCall => call.operation !== "rpc" && call.table === table);
}

export function rpcCalls(calls: RecordedCall[], name: string): FakeRpcCall[] {
  return calls.filter((call): call is FakeRpcCall => call.operation === "rpc" && call.rpcName === name);
}

/** Row builders reused by tests that need extra content in the fixture. */
export const makeFolderRow = folderRow;
export const makeListRow = listRow;
export const makeCardRow = cardRow;

export function filtersOf(call: FakeQueryCall | undefined): string[] {
  if (!call) return [];
  return call.filters.map((filter) =>
    filter.op === "or" ? `or(${String(filter.value)})` : `${filter.column} ${filter.op} ${String(filter.value)}`,
  );
}

export const TEST_BEARER = "unit-test-bearer-secret";

/** Real ToolContext carrying a verified identity, as the MCP runtime provides. */
export function authenticatedContext(userId: string = USER_A): ToolContext {
  return new ToolContext({
    type: "oauth",
    principal: {
      claims: { sub: userId, aud: "authenticated" },
      issuer: "https://ymahldldyxvwjeruaxpr.supabase.co/auth/v1",
      resource: "https://ymahldldyxvwjeruaxpr.supabase.co/functions/v1/mcp",
      acceptedAudiences: ["authenticated"],
      scopes: [],
      sub: userId,
    },
    // Each account carries its own bearer, so confirmation keys differ per user.
    bearer: { token: TEST_BEARER + ":" + userId },
  } as unknown as ConstructorParameters<typeof ToolContext>[0]);
}

/** Confirmation key exactly as the tools obtain it from the ToolContext. */
export function confirmationKeyFor(userId: string = USER_A): ConfirmationKey {
  return createToolIdentity(authenticatedContext(userId)).confirmationKey;
}

/** Extra card rows used by the layer/duplication tests. */
export const EXTRA_LAYER_CARD = "aaaaaaaa-0002-4000-8000-0000000000ff";
export const EXTRA_COPY_FOLDER = "11111111-1111-4111-8111-999999999999";
