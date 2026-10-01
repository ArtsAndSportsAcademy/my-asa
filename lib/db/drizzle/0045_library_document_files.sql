-- Biblioteca: PDF enviado pela Administração/Supervisão, sem bucket público.
-- O conteúdo só é servido pela API autenticada, depois de aplicar o escopo do documento.
CREATE TABLE IF NOT EXISTS library_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES library_documents(id),
  org_id uuid NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  content bytea NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_document_files_doc_active_idx
  ON library_document_files(document_id, active);

ALTER TABLE library_document_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE library_document_files FROM anon, authenticated, PUBLIC;
