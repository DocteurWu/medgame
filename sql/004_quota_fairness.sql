-- ============================================================
-- MedGame — 004 : equitable du quota LLM (idempotent)
-- À exécuter dans Supabase SQL Editor, dans cet ordre :
--   1. sql/003_llm_quotas.sql
--   2. CE FICHIER
-- Le proxy est tolérant : s'il n'a pas encore ce schéma, il retombe sur
-- l'ancienne signature log_llm_usage/5 (déduplication simplement inactive).
-- Donc l'ordre de déploiement proxy/BD n'a pas d'importance.
--
-- Ce que ce fichier corrige, et qui était mesuré :
--   1. UNE LIGNE PAR MESSAGE, pas par TENTATIVE.
--      `llm_usage_log` recevait une ligne par appel upstream RÉUSSI. Or le
--      client réessaie (`maxRetries`), et un essai peut aboutir côté serveur
--      alors que le client a déjà abandonné sur son timeout. Un message de
--      l'étudiant coûtait donc jusqu'à 3 lignes — et 6 avec l'appel de
--      gradation ECOS qui l'accompagne. « 20/jour » ne valait en réalité
--      que 3 à 10 questions.
--      `llm_dedup` rend la déduplication atomique et NON CONTOURNABLE : la
--      clé est calculée par le proxy (ip_hash + user_id + contenu), jamais
--      reçue du client — un appelant qui renverrait une clé constante se
--      ferait dédupliquer pour de bon, ce qui serait pire que le défaut.
--
--   2. LA GRADATION ECOS SORT DU BUDGET DIALOGUE.
--      `classifyAndCheck()` est un appel purement interne : l'étudiant ne le
--      voit pas et ne l'a pas demandé. Il était pourtant classé 'dialogue',
--      donc il consomait le même quota que ses questions. D'où la classe
--      'grading', avec son propre budget — large, car il est borné par la
--      taille de la grille d'évaluation et ne coûte donc pas plus que le
--      dialogue qu'il accompagne.
--
-- Confidentialité : inchangée, seul le hash d'IP est stocké, et il ne l'est
-- pas dans llm_dedup (il entre dans la clé, déjà hachée).
-- Accès : SECURITY DEFINER + service_role uniquement.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. DÉDUPLICATION (fenêtre courte : couvre les retries, pas les répétitions)
-- ------------------------------------------------------------
-- 2 minutes : assez large pour englober une tentative qui aboutit côté
-- upstream alors que le client a expiré (timeout 12-30 s + backoff), assez
-- court pour que reposer la MÊME question plus tard soit de nouveau compté.
CREATE TABLE IF NOT EXISTS llm_dedup (
  request_key text        PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_dedup_created
  ON llm_dedup (created_at);

ALTER TABLE llm_dedup ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. NOUVELLE CLASSE DE QUOTA
-- ------------------------------------------------------------
-- Le CHECK de 003 était créé sans nom ; Postgres l'a nommé
-- `llm_usage_log_kind_check`. On le supprime s'il existe, puis on le
-- recrée avec un nom explicite (les lignes existantes ne contiennent que
-- 'dialogue'/'correction', la nouvelle contrainte est donc toujours vraie).
ALTER TABLE llm_usage_log DROP CONSTRAINT IF EXISTS llm_usage_log_kind_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'llm_usage_log_kind_check'
  ) THEN
    ALTER TABLE llm_usage_log
      ADD CONSTRAINT llm_usage_log_kind_check
      CHECK (kind IN ('dialogue', 'correction', 'grading'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. GATE : global + quotas, atomique, en un seul appel
--    Signature inchangée (text, uuid, text) : le proxy n'a rien à changer
--    de ce côté.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION llm_gate(
  p_ip_hash text,
  p_user_id uuid,
  p_kind    text DEFAULT 'dialogue'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind      text;
  v_window    timestamptz;
  v_gcount    int;
  v_day       int;
  v_week      int;
  v_anon      int;
  v_grade     int;
  v_corr      int;
BEGIN
  v_kind := CASE p_kind
              WHEN 'correction' THEN 'correction'
              WHEN 'grading'    THEN 'grading'
              ELSE 'dialogue'
            END;
  IF p_ip_hash IS NULL OR p_ip_hash = '' THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'BAD_REQUEST', 'reason', 'ip_manquante');
  END IF;

  -- 3a. Garde-fou ABSOLU : 50 req/min tous utilisateurs (corrections et
  --     gradations incluses — elles sortent d'une boucle utilisateur).
  v_window := date_trunc('minute', now());
  DELETE FROM llm_global_window WHERE window_start < v_window - interval '10 minutes';
  INSERT INTO llm_global_window (window_start, count)
  VALUES (v_window, 1)
  ON CONFLICT (window_start) DO UPDATE SET count = llm_global_window.count + 1
  RETURNING count INTO v_gcount;

  IF v_gcount > 50 THEN
    RETURN jsonb_build_object(
      'allowed', false, 'code', 'GLOBAL_429', 'reason', 'global_minute',
      'global_count', v_gcount, 'global_limit', 50
    );
  END IF;

  -- 3b. Corrections : exemptées du quota dialogue, budget propre anti-détournement.
  IF v_kind = 'correction' THEN
    IF p_user_id IS NULL THEN
      SELECT count(*) INTO v_corr FROM llm_usage_log
      WHERE kind = 'correction' AND user_id IS NULL AND ip_hash = p_ip_hash
        AND created_at >= date_trunc('day', now());
      IF v_corr >= 3 THEN
        RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
          'reason', 'correction_daily_anon', 'limit', 3);
      END IF;
      RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'kind', 'correction',
        'remaining_correction', 3 - v_corr);
    ELSE
      SELECT count(*) INTO v_corr FROM llm_usage_log
      WHERE kind = 'correction' AND user_id = p_user_id
        AND created_at >= date_trunc('day', now());
      IF v_corr >= 10 THEN
        RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
          'reason', 'correction_daily', 'limit', 10);
      END IF;
      RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'kind', 'correction',
        'remaining_correction', 10 - v_corr);
    END IF;
  END IF;

  -- 3c. GRADATION ECOS : hors budget dialogue, budget propre.
  --     Généreuse à dessein — un appel par message de l'étudiant, donc le
  --     volume suit exactement le dialogue. Si ce budget devenait le facteur
  --     limitant, la grille d'évaluation cesserait de se remplir, ce qui est
  --     pire que de laisser passer un appel de plus.
  IF v_kind = 'grading' THEN
    IF p_user_id IS NULL THEN
      SELECT count(*) INTO v_grade FROM llm_usage_log
      WHERE kind = 'grading' AND user_id IS NULL AND ip_hash = p_ip_hash
        AND created_at > now() - interval '14 days';
      IF v_grade >= 30 THEN
        RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
          'reason', 'grading_window_anon', 'limit', 30, 'kind', 'grading');
      END IF;
      RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'kind', 'grading',
        'remaining_grading', 30 - v_grade);
    ELSE
      SELECT count(*) INTO v_grade FROM llm_usage_log
      WHERE kind = 'grading' AND user_id = p_user_id
        AND created_at >= date_trunc('day', now());
      IF v_grade >= 80 THEN
        RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
          'reason', 'grading_daily', 'limit', 80, 'kind', 'grading');
      END IF;
      RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'kind', 'grading',
        'remaining_grading', 80 - v_grade);
    END IF;
  END IF;

  -- 3d. Dialogue anonyme : 5 / 14 jours glissants par IP hashée.
  IF p_user_id IS NULL THEN
    SELECT count(*) INTO v_anon FROM llm_usage_log
    WHERE kind = 'dialogue' AND user_id IS NULL AND ip_hash = p_ip_hash
      AND created_at > now() - interval '14 days';
    IF v_anon >= 5 THEN
      RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
        'reason', 'anon_window', 'limit', 5, 'window', '14d');
    END IF;
    RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'kind', 'dialogue',
      'remaining', 5 - v_anon);
  END IF;

  -- 3e. Dialogue connecté : 20 / jour calendaire + 50 / 7 jours glissants.
  SELECT count(*) INTO v_day FROM llm_usage_log
  WHERE kind = 'dialogue' AND user_id = p_user_id
    AND created_at >= date_trunc('day', now());
  IF v_day >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
      'reason', 'daily', 'limit', 20, 'remaining_day', 0, 'remaining_week', 50 - v_week);
  END IF;

  SELECT count(*) INTO v_week FROM llm_usage_log
  WHERE kind = 'dialogue' AND user_id = p_user_id
    AND created_at > now() - interval '7 days';
  IF v_week >= 50 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
      'reason', 'weekly', 'limit', 50,
      'remaining_day', 20 - v_day, 'remaining_week', 0);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'kind', 'dialogue',
    'remaining_day', 20 - v_day, 'remaining_week', 50 - v_week);
END; $$;

-- ------------------------------------------------------------
-- 4. LOG après succès upstream (les échecs ne consomment rien)
--    + DÉDUPLICATION des retries.
--
--    `p_dedup_key` est fourni par le proxy et calculé côté serveur. Quand la
--    clé a déjà été vue dans la fenêtre de 2 minutes, on n'insère PAS de
--    ligne de consommation : c'est la même demande, réessayée.
--
--    L'ordre des deux INSERT est important : on réserve la clé AVANT de
--    logger, sinon deux retries concurrents pourraient tous deux voir
--    « pas encore vu » et tous deux logger. La réservation étant atomique
--    (clé primaire), un seul gagne.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_llm_usage(
  p_ip_hash     text,
  p_user_id     uuid,
  p_kind        text DEFAULT 'dialogue',
  p_model       text DEFAULT NULL,
  p_dedup_key   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind    text;
  v_reserve boolean;
BEGIN
  v_kind := CASE p_kind
              WHEN 'correction' THEN 'correction'
              WHEN 'grading'    THEN 'grading'
              ELSE 'dialogue'
            END;

  -- Purge paresseuse : même principe que llm_global_window dans llm_gate.
  DELETE FROM llm_dedup WHERE created_at < now() - interval '2 minutes';

  IF p_dedup_key IS NOT NULL AND p_dedup_key <> '' THEN
    INSERT INTO llm_dedup (request_key) VALUES (p_dedup_key)
    ON CONFLICT (request_key) DO NOTHING
    RETURNING TRUE INTO v_reserve;
    -- Clé déjà vue : même demande réessayée → rien n'est consommé.
    IF v_reserve IS NOT TRUE THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO llm_usage_log (ip_hash, user_id, kind, model)
  VALUES (p_ip_hash, p_user_id, v_kind, NULLIF(p_model, ''));
END; $$;

-- ------------------------------------------------------------
-- 5. VERROUILLAGE : aucun accès direct (service_role uniquement)
-- ------------------------------------------------------------
REVOKE ALL ON TABLE llm_usage_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE llm_global_window FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE llm_dedup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION llm_gate(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION log_llm_usage(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
-- L'ancienne signature est remplacée : on retire aussi son droit d'exécution.
REVOKE ALL ON FUNCTION log_llm_usage(text, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 6. VUE de contrôle : consommation RÉELLE par jour et par compte
--    Réservée au service_role / admin, comme v_llm_top_consumers de 003.
--    `appels` est le nombre de LIGNES, donc le nombre de messages après 004
--    (une tentative réessayée ne compte plus qu'une fois).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_llm_daily_usage AS
  SELECT date_trunc('day', created_at) AS jour,
         kind,
         count(*)                     AS appels,
         count(DISTINCT ip_hash)      AS ips,
         count(DISTINCT user_id)      AS comptes
  FROM llm_usage_log
  WHERE created_at > now() - interval '14 days'
  GROUP BY 1, 2
  ORDER BY 1 DESC, 3 DESC;

-- ------------------------------------------------------------
-- 7. ROLLBACK (à exécuter seulement pour revenir en arrière)
--    DROP VIEW IF EXISTS v_llm_daily_usage;
--    DROP TABLE IF EXISTS llm_dedup;
--    ALTER TABLE llm_usage_log DROP CONSTRAINT IF EXISTS llm_usage_log_kind_check;
--    ALTER TABLE llm_usage_log
--      ADD CONSTRAINT llm_usage_log_kind_check
--      CHECK (kind IN ('dialogue', 'correction'));
--    \i sql/003_llm_quotas.sql   -- restaure log_llm_usage/5 et llm_gate
-- ============================================================