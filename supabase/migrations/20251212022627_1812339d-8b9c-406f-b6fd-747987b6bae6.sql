-- Remove a constraint existente
ALTER TABLE notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;

-- Adiciona a nova constraint com os tipos de aviso incluídos
ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'atribuicao_concluida'::text, 
    'mensagem_recebida'::text, 
    'aluno_inscrito'::text,
    'aviso'::text,
    'aviso_atribuicao'::text
  ]));