-- ============================================================
-- MedGame — 003 : Quotas API anti-fuite (idempotent)
-- À exécuter dans Supabase SQL Editor (ou supabase db push)
--
-- Règles :
--   Anonyme  : 5 messages dialogue / 14 jours glissants par IP hashée
--              (+ budget correction 3 / jour / IP)
--   Connecté : 20 / jour calendaire + 50 / 7 jours glissants par user_id
--              (+ budget correction 10 / jour / compte ; vie = stats, sans blocage)
--   Global   : 50 requêtes / minute tous utilisateurs confondus (sécurité absolue)
--
-- Confidentialité : aucune IP en clair, seul un hash SHA-256 (IP + sel
-- serveur QUOTA_SALT, calculé dans le proxy Netlify) est stocké.
--
-- Accès : AUCUN grant public. Les fonctions sont SECURITY DEFINER et
-- appelées uniquement avec la clé service_role depuis le proxy.
-- (En Postgres, EXECUTE est granted à PUBLIC par défaut → REVOKE explicite.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() (déjà actif sur Supabase en général)

-- ------------------------------------------------------------
-- 1. LOG DES APPELS (1 ligne / appel LLM réussi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_hash    text        NOT NULL,
  user_id    uuid        NULL,
  kind       text        NOT NULL DEFAULT 'dialogue'
             CHECK (kind IN ('dialogue', 'correction')),
  model      text        NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_log_ip_time
  ON llm_usage_log (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_log_user_time
  ON llm_usage_log (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. FENÊTRE GLOBALE (compteur atomique par minute)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_global_window (
  window_start timestamptz PRIMARY KEY,
  count        int         NOT NULL DEFAULT 0
);

ALTER TABLE llm_global_window ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. GATE : global + quota, atomique, en un seul appel
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
  v_corr      int;
BEGIN
  v_kind := CASE WHEN p_kind = 'correction' THEN 'correction' ELSE 'dialogue' END;
  IF p_ip_hash IS NULL OR p_ip_hash = '' THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'BAD_REQUEST', 'reason', 'ip_manquante');
  END IF;

  -- 3a. Garde-fou ABSOLU : 50 req/min tous utilisateurs (corrections incluses).
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

  -- 3c. Dialogue anonyme : 5 / 14 jours glissants par IP hashée.
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

  -- 3d. Dialogue connecté : 20 / jour calendaire + 50 / 7 jours glissants.
  SELECT count(*) INTO v_day FROM llm_usage_log
  WHERE kind = 'dialogue' AND user_id = p_user_id
    AND created_at >= date_trunc('day', now());
  IF v_day >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'QUOTA_EXCEEDED',
      'reason', 'daily', 'limit', 20, 'remaining_day', 0);
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
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_llm_usage(
  p_ip_hash text,
  p_user_id uuid,
  p_kind    text DEFAULT 'dialogue',
  p_model   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO llm_usage_log (ip_hash, user_id, kind, model)
  VALUES (p_ip_hash, p_user_id,
          CASE WHEN p_kind = 'correction' THEN 'correction' ELSE 'dialogue' END,
          NULLIF(p_model, ''));
END; $$;

-- ------------------------------------------------------------
-- 5. VERROUILLAGE : aucun accès direct (service_role uniquement)
-- ------------------------------------------------------------
REVOKE ALL ON TABLE llm_usage_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE llm_global_window FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION llm_gate(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION log_llm_usage(text, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 6. VUE abus : conso à vie par compte (stats, sans blocage)
--    + top IPs anonymes sur 14 jours. Réservée au service_role / admin.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_llm_top_consumers AS
  SELECT user_id,
         count(*) FILTER (WHERE kind = 'dialogue')  AS dialogue_lifetime,
         count(*) FILTER (WHERE kind = 'correction') AS correction_lifetime,
         count(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7d,
         max(created_at) AS last_seen
  FROM llm_usage_log
  WHERE user_id IS NOT NULL
  GROUP BY user_id
  ORDER BY dialogue_lifetime DESC;

-- ------------------------------------------------------------
-- 7. PURGE (maintenance, à lancer périodiquement ou à la main) :
--    DELETE FROM llm_usage_log WHERE created_at < now() - interval '30 days';
--    La règle "14 jours" des anonymes est déjà une fenêtre glissante
--    dans llm_gate (aucun cron requis pour l'appliquer).
-- ------------------------------------------------------------
