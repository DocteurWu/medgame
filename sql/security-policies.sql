-- ============================================
-- Medgame — Sécurité Supabase (RLS + Policies)
-- ============================================
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Activer RLS sur la table profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes policies (si elles existent)
DROP POLICY IF EXISTS "Lecture profil public" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son propre profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur lit son propre profil" ON profiles;

-- 3. Policy SELECT : tout le monde peut lire les profils (classement)
CREATE POLICY "Lecture profil public"
ON profiles FOR SELECT
USING (true);

-- 4. Policy UPDATE : un utilisateur ne peut modifier QUE son propre profil
CREATE POLICY "Utilisateur modifie son propre profil"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Policy INSERT : un utilisateur ne peut créer QUE son propre profil
CREATE POLICY "Utilisateur cree son propre profil"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- Sécurité supplémentaire : Trigger anti-triche XP
-- ============================================
-- Empêche la réduction d'XP (on ne peut que gagner)
-- et limite le gain max par update à 200 XP

CREATE OR REPLACE FUNCTION check_xp_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Interdire la réduction d'XP
    IF NEW.total_xp < OLD.total_xp THEN
        RAISE EXCEPTION 'Impossible de réduire l''XP';
    END IF;

    -- Limiter le gain max à 200 XP par update
    IF (NEW.total_xp - OLD.total_xp) > 200 THEN
        RAISE EXCEPTION 'Gain XP trop élevé (max 200 par partie)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS xp_update_check ON profiles;
CREATE TRIGGER xp_update_check
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    WHEN (OLD.total_xp IS DISTINCT FROM NEW.total_xp)
    EXECUTE FUNCTION check_xp_update();

-- ============================================
-- CORS : À configurer dans Supabase Dashboard
-- ============================================
-- Settings → API → Additional URLs
-- Ajouter UNIQUEMENT :
--   https://ton-domaine.com
--   http://localhost:3000 (pour le dev)
-- NE PAS laisser "*" en production
