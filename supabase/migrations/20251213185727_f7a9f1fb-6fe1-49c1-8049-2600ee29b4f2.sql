-- Corrigir folders de atribuição existentes que estão com visibility 'private'
UPDATE folders 
SET visibility = 'class' 
WHERE class_id IS NOT NULL AND visibility = 'private';

-- Corrigir lists de atribuição existentes que estão com visibility 'private'
UPDATE lists 
SET visibility = 'class' 
WHERE class_id IS NOT NULL AND visibility = 'private';