-- Fase 28: AI-fotoadvies bij de productanalyse.
-- Het analysemodel ziet de foto's toch al en geeft concrete tips voor
-- ontbrekende/betere foto's ("maak een detailfoto van het typeplaatje").

ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_advice TEXT[];

COMMENT ON COLUMN products.photo_advice IS
  'Fase 28: AI-tips voor extra/betere advertentiefoto''s, gezet door de web-analyse-pipeline.';
