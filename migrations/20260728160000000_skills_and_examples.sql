-- Up Migration
CREATE TABLE skills (
  id UUID NOT NULL CONSTRAINT skills_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT skills_name UNIQUE,
  description VARCHAR NOT NULL
);

CREATE TABLE example_kinds (
  kind VARCHAR NOT NULL CONSTRAINT example_kinds_pkey PRIMARY KEY
);

CREATE TABLE examples (
  id UUID NOT NULL CONSTRAINT examples_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT examples_name UNIQUE,
  kind VARCHAR NOT NULL CONSTRAINT examples_kind_fkey REFERENCES example_kinds (kind),
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
  ) AS examples
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