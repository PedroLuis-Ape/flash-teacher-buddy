import { describe, expect, it } from 'vitest';
import { getTurmaUpdateErrorMessage } from './turmaUpdateErrors';

describe('getTurmaUpdateErrorMessage', () => {
  it('preserves the friendly backend message', () => {
    expect(getTurmaUpdateErrorMessage({
      code: 'FORBIDDEN',
      error: 'Você não tem permissão para editar esta turma.',
    })).toBe('Você não tem permissão para editar esta turma.');
  });

  it('maps a missing schema code when the backend omits a message', () => {
    expect(getTurmaUpdateErrorMessage({ code: 'MISSING_SCHEMA' })).toBe(
      'A publicação de turmas ainda não foi instalada no servidor.',
    );
  });

  it('maps unauthenticated sessions', () => {
    expect(getTurmaUpdateErrorMessage({ code: 'UNAUTHENTICATED' })).toBe(
      'Sua sessão expirou. Entre novamente para atualizar a turma.',
    );
  });

  it('uses the supplied fallback for unknown errors', () => {
    expect(getTurmaUpdateErrorMessage({ code: 'UNKNOWN' }, 'Falha controlada')).toBe('Falha controlada');
  });
});
