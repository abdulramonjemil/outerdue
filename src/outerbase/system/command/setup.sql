-- This file contains PostgreSQL code that should be run on the PostgreSQL DB
-- using this system. It sets up the functions used in the SQL node proxy.

CREATE SCHEMA IF NOT EXISTS cmd_utils;

DROP FUNCTION IF EXISTS cmd_utils.get_problem_result;
CREATE OR REPLACE FUNCTION cmd_utils.get_problem_result(node_result jsonb)
RETURNS table (__type__ text, problem jsonb) AS $$
BEGIN
  IF node_result->'payload'->>'__type__' = 'problem_result' THEN
    RETURN QUERY SELECT
      'problem_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'payload'->'problem'->>'code',
        'message', node_result->'payload'->'problem'->>'message'
      ) AS problem;

  ELSE -- Take the result as SQL node proxy
    RETURN QUERY SELECT
      'problem_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'response'->'items'->0->'problem'->>'code',
        'message', node_result->'response'->'items'->0->'problem'->>'message'
      ) AS problem;
  END IF;
END $$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS cmd_utils.get_exit_result;
CREATE OR REPLACE FUNCTION cmd_utils.get_exit_result(node_result jsonb)
RETURNS table (__type__ text, info jsonb) AS $$
BEGIN
  IF node_result->'payload'->>'__type__' = 'exit_result' THEN
    RETURN QUERY SELECT
      'exit_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'payload'->'info'->>'code',
        'message', node_result->'payload'->'info'->>'message'
      ) AS info;

  ELSE -- Take the result as SQL node proxy
    RETURN QUERY SELECT
      'exit_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'response'->'items'->0->'info'->>'code',
        'message', node_result->'response'->'items'->0->'info'->>'message'
      ) AS info;
  END IF;
END $$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS cmd_utils.is_problem_result;
CREATE OR REPLACE FUNCTION cmd_utils.is_problem_result(node_result jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN
    -- JS proxy result
    node_result->'payload'->>'__type__' = 'problem_result' OR
    -- SQL proxy result
    node_result->'response'->'items'->0->>'__type__' = 'problem_result';
END $$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS cmd_utils.is_exit_result;
CREATE OR REPLACE FUNCTION cmd_utils.is_exit_result(node_result jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN
    -- JS proxy result
    node_result->'payload'->>'__type__' = 'exit_result' OR
    -- SQL proxy result
    node_result->'response'->'items'->0->>'__type__' = 'exit_result';
END $$ LANGUAGE plpgsql;
