-- Trechos com página confirmada manualmente para respostas rastreáveis da ASA.
CREATE TABLE IF NOT EXISTS library_document_page_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  page_number integer NOT NULL CHECK (page_number > 0),
  excerpt text NOT NULL CHECK (length(btrim(excerpt)) BETWEEN 8 AND 1000),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_document_page_citations_doc_version_idx
  ON library_document_page_citations(document_id, version);

ALTER TABLE library_document_page_citations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE library_document_page_citations FROM anon, authenticated, PUBLIC;
