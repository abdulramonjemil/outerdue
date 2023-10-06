-- This file contains PostgreSQL code that should be run on the PostgreSQL DB
-- using this system. It sets up the functions used in the SQL node proxy.

CREATE SCHEMA IF NOT EXISTS cmd_utils;

DROP FUNCTION IF EXISTS cmd_utils.get_proxy_result;
CREATE OR REPLACE FUNCTION cmd_utils.get_proxy_result(node_result jsonb)
RETURNS table (__type__ text, error jsonb) AS $$
BEGIN
  IF node_result->'payload'->>'__type__' = 'proxy_result' THEN
    RETURN QUERY SELECT
      'proxy_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'payload'->'error'->>'code',
        'message', node_result->'payload'->'error'->>'message'
      ) AS error;

  ELSE -- Take the result as SQL node proxy
    RETURN QUERY SELECT
      'proxy_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'response'->'items'->0->'error'->>'code',
        'message', node_result->'response'->'items'->0->'error'->>'message'
      ) AS error;
  END IF;
END $$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS cmd_utils.get_exit_result;
CREATE OR REPLACE FUNCTION cmd_utils.get_exit_result(node_result jsonb)
RETURNS table (__type__ text, error jsonb) AS $$
BEGIN
  IF node_result->'payload'->>'__type__' = 'exit_result' THEN
    RETURN QUERY SELECT
      'exit_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'payload'->'error'->>'code',
        'message', node_result->'payload'->'error'->>'message'
      ) AS error;

  ELSE -- Take the result as SQL node proxy
    RETURN QUERY SELECT
      'exit_result' AS __type__,
      jsonb_build_object(
        'code', node_result->'response'->'items'->0->'error'->>'code',
        'message', node_result->'response'->'items'->0->'error'->>'message'
      ) AS error;
  END IF;
END $$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS cmd_utils.is_proxy_result;
CREATE OR REPLACE FUNCTION cmd_utils.is_proxy_result(node_result jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN
    -- JS proxy result
    node_result->'payload'->>'__type__' = 'proxy_result' OR
    -- SQL proxy result
    node_result->'response'->'items'->0->>'__type__' = 'proxy_result';
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
