-- Up Migration
-- NOTE: This migration was edited in place on 2026-08-05 to give `example_kinds` a UUID
-- surrogate primary key (`id`) and a `name` column, replacing the original design where
-- the `kind` string itself was the primary key. This is normally forbidden (migrations are
-- append-only once applied), but was done deliberately here by explicit instruction. Any
-- database that already applied the ORIGINAL content of this file must be rebuilt from
-- scratch (drop and re-run every migration) rather than upgraded in place — node-pg-migrate
-- tracks applied migrations by filename, not content, so it will never detect or re-apply
-- this change.
CREATE TABLE skills (
  id UUID NOT NULL CONSTRAINT skills_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT skills_name UNIQUE,
  description VARCHAR NOT NULL
);

CREATE TABLE example_kinds (
  id UUID NOT NULL CONSTRAINT example_kinds_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT example_kinds_name UNIQUE
);

CREATE TABLE examples (
  id UUID NOT NULL CONSTRAINT examples_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT examples_name UNIQUE,
  example_kind_id UUID NOT NULL CONSTRAINT examples_example_kind_id_fkey REFERENCES example_kinds (id),
  url VARCHAR
);

CREATE TABLE examples_to_skills (
  skill_id UUID NOT NULL CONSTRAINT examples_to_skills_skill_fkey REFERENCES skills (id) ON DELETE CASCADE,
  example_id UUID NOT NULL CONSTRAINT examples_to_skills_example_fkey REFERENCES examples (id) ON DELETE RESTRICT,
  CONSTRAINT examples_to_skills_pkey PRIMARY KEY (skill_id, example_id)
);

CREATE VIEW view_skills_with_examples AS
SELECT
  skills.id,
  skills.name,
  skills.description,
  COALESCE(
    JSON_AGG(
      examples.id
      ORDER BY
        examples.id
    ) FILTER (
      WHERE
        examples.id IS NOT NULL
    ),
    '[]'::JSON
  ) AS example_ids
FROM
  skills
  LEFT JOIN examples_to_skills ON examples_to_skills.skill_id = skills.id
  LEFT JOIN examples ON examples.id = examples_to_skills.example_id
GROUP BY
  skills.id;

-- Down Migration
DROP VIEW view_skills_with_examples;

DROP TABLE examples_to_skills;

DROP TABLE examples;

DROP TABLE example_kinds;

DROP TABLE skills;