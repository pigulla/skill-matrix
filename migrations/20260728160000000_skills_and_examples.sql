-- Up Migration
CREATE FUNCTION concurrency_token (version BIGINT) RETURNS TEXT AS $$
  SELECT md5(version::TEXT)
$$ LANGUAGE SQL IMMUTABLE;

CREATE TABLE skills (
  id UUID NOT NULL CONSTRAINT skills_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT skills_name UNIQUE,
  description VARCHAR NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE example_kinds (
  id UUID NOT NULL CONSTRAINT example_kinds_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT example_kinds_name UNIQUE,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE examples (
  id UUID NOT NULL CONSTRAINT examples_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT examples_name UNIQUE,
  example_kind_id UUID NOT NULL CONSTRAINT examples_example_kind_id_fkey REFERENCES example_kinds (id) ON DELETE RESTRICT,
  url VARCHAR,
  last_updated TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX examples_example_kind_id_idx ON examples (example_kind_id);

CREATE TABLE examples_to_skills (
  skill_id UUID NOT NULL CONSTRAINT examples_to_skills_skill_fkey REFERENCES skills (id) ON DELETE CASCADE,
  example_id UUID NOT NULL CONSTRAINT examples_to_skills_example_fkey REFERENCES examples (id) ON DELETE RESTRICT,
  CONSTRAINT examples_to_skills_pkey PRIMARY KEY (skill_id, example_id)
);

CREATE INDEX examples_to_skills_example_id_idx ON examples_to_skills (example_id);

CREATE VIEW view_skills_with_examples AS
SELECT
  skills.id,
  skills.name,
  skills.description,
  skills.last_updated,
  skills.version,
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

DROP FUNCTION concurrency_token (BIGINT);