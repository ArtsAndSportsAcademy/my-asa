ALTER TABLE formations ADD COLUMN IF NOT EXISTS scene_id uuid REFERENCES show_book_scenes(id);

CREATE INDEX IF NOT EXISTS formations_show_scene_people_count_idx
  ON formations (show_id, scene_id, people_count);
