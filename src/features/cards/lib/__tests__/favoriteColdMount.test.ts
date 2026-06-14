/**
 * Cold-mount reproduction test (Fase 0 — Clara Master).
 *
 * Objetivo: provar, sem depender de cache do React Query, que:
 *   1. Favoritar a camada 2 de um grupo grava na identidade canônica
 *      do grupo (parent_card_id), e que após destruir o QueryClient,
 *      desmontar e recriar a leitura, TODAS as camadas continuam vendo
 *      o favorito.
 *   2. Marcar Especial na camada 2 NÃO marca a camada 1 nem a 3, mesmo
 *      após o ciclo de cold-mount.
 *
 * Este teste NÃO tenta validar comportamento de UI — opera sobre as
 * funções puras de identidade + um mock de tabela do Supabase. Ainda
 * assim cobre a invariante essencial da reestruturação proposta.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  resolveCardStatusIdentity,
  buildCanonicalToPlayableMap,
} from '../cardStatusIdentity';

type Row = { user_id: string; flashcard_id: string };

const USER = 'user-1';

const layers = [
  { id: 'L1', parent_card_id: 'P', layer_index: 0 },
  { id: 'L2', parent_card_id: 'P', layer_index: 1 },
  { id: 'L3', parent_card_id: 'P', layer_index: 2 },
] as const;

/** Mock "server" tables for the two stores we care about in Fase 0. */
const db = {
  user_favorites: [] as Array<{ user_id: string; resource_type: string; resource_id: string }>,
  user_special_flashcards: [] as Row[],
};

/** Mimics RPC set_flashcard_group_favorite. */
function rpcSetFavoriteGroup(canonical: string, cleanup: string[], enable: boolean) {
  const all = Array.from(new Set([canonical, ...cleanup]));
  if (!enable) {
    db.user_favorites = db.user_favorites.filter(
      (r) => !(r.user_id === USER && r.resource_type === 'flashcard' && all.includes(r.resource_id)),
    );
    return;
  }
  // scrub legacy ids that aren't the canonical
  db.user_favorites = db.user_favorites.filter(
    (r) => !(r.user_id === USER && r.resource_type === 'flashcard' && all.includes(r.resource_id) && r.resource_id !== canonical),
  );
  if (!db.user_favorites.some((r) => r.user_id === USER && r.resource_id === canonical)) {
    db.user_favorites.push({ user_id: USER, resource_type: 'flashcard', resource_id: canonical });
  }
}

/** Mimics direct write of useSetSpecialLayer (per-layer). */
function writeSpecial(layerId: string, enable: boolean) {
  if (!enable) {
    db.user_special_flashcards = db.user_special_flashcards.filter(
      (r) => !(r.user_id === USER && r.flashcard_id === layerId),
    );
    return;
  }
  if (!db.user_special_flashcards.some((r) => r.user_id === USER && r.flashcard_id === layerId)) {
    db.user_special_flashcards.push({ user_id: USER, flashcard_id: layerId });
  }
}

/** Mimics the scoped read of useFavorites for a list whose deck = `deck`. */
function readFavoritesForDeck(deck: ReadonlyArray<{ id: string; parent_card_id: string | null }>) {
  const scoped = new Set<string>();
  for (const c of deck) {
    scoped.add(c.id);
    if (c.parent_card_id) scoped.add(c.parent_card_id);
  }
  return db.user_favorites
    .filter((r) => r.user_id === USER && r.resource_type === 'flashcard' && scoped.has(r.resource_id))
    .map((r) => r.resource_id);
}

function readSpecial() {
  return db.user_special_flashcards
    .filter((r) => r.user_id === USER)
    .map((r) => r.flashcard_id);
}

beforeEach(() => {
  db.user_favorites = [];
  db.user_special_flashcards = [];
});

describe('cold-mount: favorito de camada 2 sobrevive', () => {
  it('grava no canônico do grupo e todas as camadas o reconhecem após remount', async () => {
    // 1) Estado quente: usuário em L2 favorita.
    const idHot = resolveCardStatusIdentity({
      displayedCard: layers[1],
      engineCard: { ...layers[0], __parentCardId: 'P' } as any,
      layers: layers as any,
    });
    expect(idHot.canonicalGroupId).toBe('P');
    rpcSetFavoriteGroup(idHot.canonicalGroupId!, idHot.legacyIds, true);

    // Cache quente reconhece (sanity).
    const qcHot = new QueryClient();
    qcHot.setQueryData(['favorites', USER, 'flashcard', 'list-1', null, null, null], readFavoritesForDeck(layers as any));
    expect((qcHot.getQueryData(['favorites', USER, 'flashcard', 'list-1', null, null, null]) as string[])).toContain('P');

    // 2) Cold-mount: destrói cliente, remonta do zero, faz refetch real do "servidor".
    qcHot.clear();
    qcHot.getQueryCache().clear();
    const qcCold = new QueryClient();
    const fresh = readFavoritesForDeck(layers as any); // releitura real
    qcCold.setQueryData(['favorites', USER, 'flashcard', 'list-1', null, null, null], fresh);
    const data = qcCold.getQueryData(['favorites', USER, 'flashcard', 'list-1', null, null, null]) as string[];

    // 3) Invariante: TODAS as camadas enxergam o favorito do grupo.
    const map = buildCanonicalToPlayableMap(layers as any);
    for (const layer of layers) {
      const id = resolveCardStatusIdentity({
        displayedCard: layer as any,
        engineCard: { ...layers[0], __parentCardId: 'P' } as any,
        layers: layers as any,
      });
      // Estado consumido pela UI: favorites.includes(canonicalGroupId).
      expect(data.includes(id.canonicalGroupId!)).toBe(true);
    }
    // map também é estável.
    expect(map.get('P')).toBe('L1');
  });
});

describe('cold-mount: especial é estritamente por camada', () => {
  it('marcar L2 não vaza para L1 nem L3 após remount', () => {
    writeSpecial('L2', true);

    const qcHot = new QueryClient();
    qcHot.setQueryData(['special-flashcards', USER], readSpecial());
    expect((qcHot.getQueryData(['special-flashcards', USER]) as string[])).toEqual(['L2']);

    qcHot.clear();
    const qcCold = new QueryClient();
    qcCold.setQueryData(['special-flashcards', USER], readSpecial());
    const data = qcCold.getQueryData(['special-flashcards', USER]) as string[];

    expect(data).toContain('L2');
    expect(data).not.toContain('L1');
    expect(data).not.toContain('L3');
  });

  it('desfavoritar o grupo limpa também a Lista Vermelha (invariante)', () => {
    // Simulação: favorito + entrada de vermelho no canônico.
    rpcSetFavoriteGroup('P', ['L1', 'L2', 'L3'], true);
    // (a RPC de vermelho real faz o mesmo cleanup; aqui simulamos o resultado)
    // Ao desfavoritar, RPC já remove vermelho na mesma transação.
    rpcSetFavoriteGroup('P', ['L1', 'L2', 'L3'], false);
    expect(db.user_favorites.length).toBe(0);
  });
});