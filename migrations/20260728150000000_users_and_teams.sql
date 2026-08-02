-- Up Migration
CREATE TABLE teams (
  id UUID NOT NULL CONSTRAINT teams_pkey PRIMARY KEY,
  name VARCHAR NOT NULL CONSTRAINT teams_name UNIQUE
);

CREATE TABLE users (
  id UUID NOT NULL CONSTRAINT users_pkey PRIMARY KEY,
  email VARCHAR NOT NULL CONSTRAINT users_email UNIQUE,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  team_id UUID NOT NULL CONSTRAINT users_team_fkey REFERENCES teams (id) ON DELETE RESTRICT
);

CREATE VIEW view_teams_with_members AS
SELECT
  teams.id,
  teams.name,
  COALESCE(
    JSON_AGG(
      users.id
      ORDER BY
        users.id
    ) FILTER (
      WHERE
        users.id IS NOT NULL
    ),
    '[]'::JSON
  ) AS members
FROM
  teams
  LEFT JOIN users ON users.team_id = teams.id
GROUP BY
  teams.id;

-- Down Migration
DROP VIEW view_teams_with_members;

DROP TABLE users;

DROP TABLE teams;