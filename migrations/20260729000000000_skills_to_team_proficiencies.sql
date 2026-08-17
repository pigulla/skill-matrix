-- Up Migration
CREATE TABLE skills_to_teams_with_proficiency (
  team_id UUID NOT NULL CONSTRAINT skills_to_teams_with_proficiency_team_fkey REFERENCES teams (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL CONSTRAINT skills_to_teams_with_proficiency_skill_fkey REFERENCES skills (id) ON DELETE RESTRICT,
  proficiency SMALLINT NOT NULL CONSTRAINT skills_to_teams_proficiency_check CHECK (proficiency BETWEEN 0 AND 4),
  CONSTRAINT skills_to_teams_with_proficiency_pkey PRIMARY KEY (team_id, skill_id)
);

CREATE VIEW view_team_skill_proficiencies AS
SELECT
  teams.id AS team_id,
  COALESCE(
    JSON_AGG(
      JSON_BUILD_ARRAY(
        skills_to_teams_with_proficiency.skill_id,
        skills_to_teams_with_proficiency.proficiency
      )
      ORDER BY
        skills_to_teams_with_proficiency.skill_id
    ) FILTER (
      WHERE
        skills_to_teams_with_proficiency.skill_id IS NOT NULL
    ),
    '[]'::JSON
  ) AS skill_proficiencies
FROM
  teams
  LEFT JOIN skills_to_teams_with_proficiency ON skills_to_teams_with_proficiency.team_id = teams.id
GROUP BY
  teams.id;

-- Down Migration
DROP VIEW view_team_skill_proficiencies;

DROP TABLE skills_to_teams_with_proficiency;