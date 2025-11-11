-- Criar bucket para skins (público para facilitar acesso)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skins',
  'skins',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket skins
-- Todos podem ver
CREATE POLICY "Public can view skins"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'skins');

-- Apenas admin pode fazer upload
CREATE POLICY "Admin can upload skins"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'skins' 
  AND public.has_role(auth.uid(), 'developer_admin'::public.app_role)
);

-- Apenas admin pode atualizar
CREATE POLICY "Admin can update skins"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'skins'
  AND public.has_role(auth.uid(), 'developer_admin'::public.app_role)
);

-- Apenas admin pode deletar
CREATE POLICY "Admin can delete skins"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'skins'
  AND public.has_role(auth.uid(), 'developer_admin'::public.app_role)
);