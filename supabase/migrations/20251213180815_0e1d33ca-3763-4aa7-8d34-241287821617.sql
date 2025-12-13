-- 1. Adicionar campos para suporte a pasta como etapa
ALTER TABLE user_goal_steps
  ADD COLUMN step_type text NOT NULL DEFAULT 'list',
  ADD COLUMN folder_id uuid NULL;

-- 2. Garantir que todos os steps existentes estejam como 'list' (FREIO #5)
UPDATE user_goal_steps SET step_type = 'list' WHERE step_type = 'list';

-- 3. Permitir list_id nulo para etapas do tipo 'folder'
ALTER TABLE user_goal_steps ALTER COLUMN list_id DROP NOT NULL;

-- 4. Constraint: ou list_id ou folder_id (nunca ambos, nunca nenhum)
ALTER TABLE user_goal_steps
  ADD CONSTRAINT chk_step_source CHECK (
    (step_type = 'list' AND list_id IS NOT NULL AND folder_id IS NULL) OR
    (step_type = 'folder' AND folder_id IS NOT NULL AND list_id IS NULL)
  );

-- 5. Índice para consultas por folder_id (FREIO #5)
CREATE INDEX idx_goal_steps_folder_id ON user_goal_steps(folder_id) WHERE folder_id IS NOT NULL;