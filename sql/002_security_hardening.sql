-- ============================================================
-- MedGame — 002 : Durcissement sécurité (idempotent)
-- À exécuter dans Supabase SQL Editor (ou supabase db push)
--
-- Corrige :
--   1. Escalade de privilèges admin via profiles_update_own
--   2. Lecture des correct_indices par les joueurs (triche Arena)
--   3. Écriture du score par le client (anticheat serveur)
--   4. XP Arena attribuée côté client (double attribution possible)
--
-- Le client doit appeler :
--   SELECT submit_arena_answer(question_id, answer_indices)
--   SELECT claim_arena_xp(event_id)
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — protection anti-escalade + XP monotone
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_profile_role_integrity ON profiles;

CREATE OR REPLACE FUNCTION enforce_profile_role_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Contexte serveur / SQL Editor (pas de JWT) : pas de restriction.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF TG_OP = 'INSERT' THEN
    -- Un utilisateur ne peut pas créer un profil admin ou avec de l'XP.
    IF NOT COALESCE(v_is_admin, false) THEN
      NEW.role := 'player';
      IF NEW.total_xp IS NOT NULL AND NEW.total_xp < 0 THEN
        NEW.total_xp := 0;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT COALESCE(v_is_admin, false) THEN
      -- Rôle figé pour un non-admin.
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Modification du role interdite';
      END IF;
      -- XP monotone : interdiction de diminuer son XP.
      IF NEW.total_xp IS DISTINCT FROM OLD.total_xp AND COALESCE(NEW.total_xp, 0) < COALESCE(OLD.total_xp, 0) THEN
        RAISE EXCEPTION 'Diminution du XP interdite';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_profile_role_integrity
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_profile_role_integrity();

-- ------------------------------------------------------------
-- 2. ARENA_QUESTIONS — plus de lecture publique de la table brute
--    (les joueurs passent par la vue arena_questions_safe)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "questions_select_all" ON arena_questions;

CREATE POLICY "questions_select_admin" ON arena_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Vue sûre (sans correct_indices) — recréée pour garantir sa présence.
CREATE OR REPLACE VIEW arena_questions_safe AS
  SELECT id, event_id, order_num, question, sub_question, image_url,
         options, time_limit, correction_time_limit, explanation
  FROM arena_questions;

GRANT SELECT ON arena_questions_safe TO authenticated;
GRANT SELECT ON arena_questions_safe TO anon;

-- ------------------------------------------------------------
-- 3. ARENA_PLAYERS — le score n'est plus modifiable par le client
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "players_update_own" ON arena_players;

-- ------------------------------------------------------------
-- 4. ARENA_ANSWERS — insertion uniquement via RPC (score calculé serveur)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "answers_insert_own" ON arena_answers;

-- Normalise int[] ou jsonb en int[] (la colonne a pu être créée des deux façons).
CREATE OR REPLACE FUNCTION _arena_norm_int_array(v anyelement)
RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t text;
BEGIN
  t := btrim(v::text, '[]"{} ');
  IF t IS NULL OR t = '' THEN
    RETURN ARRAY[]::int[];
  END IF;
  RETURN ARRAY(
    SELECT btrim(p)::int FROM unnest(string_to_array(t, ',')) AS p WHERE btrim(p) <> ''
  );
END; $$;

-- Score d'une réponse : 0 écart = 1pt | 1 écart = 0.5 | 2 écarts = 0.2 | 3+ = 0
CREATE OR REPLACE FUNCTION _arena_compute_points(p_correct int[], p_selected int[])
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  WITH w AS (SELECT count(*)::int AS n FROM unnest(p_selected) s WHERE s <> ALL (p_correct)),
       m AS (SELECT count(*)::int AS n FROM unnest(p_correct) c WHERE c <> ALL (p_selected))
  SELECT CASE (SELECT w.n + m.n FROM w, m)
           WHEN 0 THEN 1.0
           WHEN 1 THEN 0.5
           WHEN 2 THEN 0.2
           ELSE 0.0
         END;
$$;

-- ------------------------------------------------------------
-- RPC : soumission d'une réponse (score calculé et agrégé SERVEUR)
-- Remplace : fetch correct_indices + computeScore + insert answers
--           + update arena_players.score faits côté client.
-- Idempotent : renvoyer la note existante si déjà répondu.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_arena_answer(
  p_question_id uuid,
  p_answer_indices jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q          arena_questions%ROWTYPE;
  v_player     arena_players%ROWTYPE;
  v_correct    int[];
  v_selected   int[];
  v_points     numeric;
  v_total      numeric;
  v_existing   record;
BEGIN
  SELECT * INTO v_q FROM arena_questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question inconnue';
  END IF;

  SELECT * INTO v_player
  FROM arena_players
  WHERE user_id = auth.uid() AND event_id = v_q.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vous ne participez pas à cet événement';
  END IF;

  -- Idempotence : déjà répondu → renvoyer la note existante sans re-scorer.
  SELECT score_awarded INTO v_existing
  FROM arena_answers
  WHERE player_id = v_player.id AND question_id = p_question_id;
  IF FOUND THEN
    SELECT score INTO v_total FROM arena_players WHERE id = v_player.id;
    RETURN jsonb_build_object(
      'points', v_existing.score_awarded,
      'total_score', v_total,
      'correct_indices', to_jsonb(_arena_norm_int_array(v_q.correct_indices)),
      'duplicate', true
    );
  END IF;

  v_correct  := _arena_norm_int_array(v_q.correct_indices);
  v_selected := _arena_norm_int_array(p_answer_indices);
  v_points   := _arena_compute_points(v_correct, v_selected);

  INSERT INTO arena_answers (player_id, question_id, answer_indices, score_awarded)
  VALUES (v_player.id, p_question_id, to_jsonb(v_selected), v_points);

  UPDATE arena_players
  SET score = COALESCE(score, 0) + v_points
  WHERE id = v_player.id
  RETURNING score INTO v_total;

  RETURN jsonb_build_object(
    'points', v_points,
    'total_score', v_total,
    'correct_indices', to_jsonb(v_correct),
    'duplicate', false
  );
END; $$;

GRANT EXECUTE ON FUNCTION submit_arena_answer(uuid, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- RPC : attribution d'XP de fin d'événement (idempotente, rang serveur)
-- Remplace le read-then-update non transactionnel du client.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_arena_xp(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event    arena_events%ROWTYPE;
  v_player   arena_players%ROWTYPE;
  v_rank     int;
  v_rewards  jsonb;
  v_xp       int := 0;
BEGIN
  SELECT * INTO v_event FROM arena_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evenement inconnu';
  END IF;

  -- Terminé si status='finished' ou si la date de fin est passée (mode timed).
  IF v_event.status IS DISTINCT FROM 'finished'
     AND (v_event.ends_at IS NULL OR v_event.ends_at > now()) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_player
  FROM arena_players
  WHERE user_id = auth.uid() AND event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Déjà récompensé → no-op.
  IF COALESCE(v_player.xp_earned, 0) > 0 THEN
    RETURN 0;
  END IF;

  SELECT count(*) + 1 INTO v_rank
  FROM arena_players
  WHERE event_id = p_event_id
    AND COALESCE(score, 0) > COALESCE(v_player.score, 0);

  IF v_rank < 1 OR v_rank > 5 THEN
    UPDATE arena_players SET final_rank = v_rank WHERE id = v_player.id;
    RETURN 0;
  END IF;

  v_rewards := COALESCE(
    CASE WHEN jsonb_typeof(v_event.xp_rewards) = 'array' THEN v_event.xp_rewards END,
    '[300,200,100,50,50]'::jsonb
  );
  v_xp := COALESCE((v_rewards -> (v_rank - 1))::int, 0);

  IF v_xp > 0 THEN
    UPDATE profiles
    SET total_xp = COALESCE(total_xp, 0) + v_xp
    WHERE id = auth.uid();
  END IF;

  UPDATE arena_players
  SET final_rank = v_rank, xp_earned = v_xp
  WHERE id = v_player.id;

  RETURN v_xp;
END; $$;

GRANT EXECUTE ON FUNCTION claim_arena_xp(uuid) TO authenticated;
