-- Migration : classement final + distribution XP pour Arena QCM
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter colonne final_rank sur arena_players
ALTER TABLE arena_players
ADD COLUMN IF NOT EXISTS final_rank INTEGER;

-- 2. Ajouter colonne xp_earned sur arena_players
ALTER TABLE arena_players
ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;

-- 3. Vérifier
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'arena_players'
AND column_name IN ('final_rank', 'xp_earned');
