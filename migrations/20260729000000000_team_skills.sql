-- Up Migration
CREATE TABLE team_skills (
  team_id UUID NOT NULL CONSTRAINT team_skills_team_fkey REFERENCES teams (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL CONSTRAINT team_skills_skill_fkey REFERENCES skills (id) ON DELETE RESTRICT,
  proficiency SMALLINT NOT NULL CONSTRAINT team_skills_proficiency_check CHECK (proficiency BETWEEN 0 AND 4),
  CONSTRAINT team_skills_pkey PRIMARY KEY (team_id, skill_id)
);

CREATE VIEW view_team_skill_proficiencies AS
SELECT
  teams.id AS team_id,
  COALESCE(
    JSON_AGG(
      JSON_BUILD_ARRAY(team_skills.skill_id, team_skills.proficiency)
      ORDER BY
        team_skills.skill_id
    ) FILTER (
      WHERE
        team_skills.skill_id IS NOT NULL
    ),
    '[]'::JSON
  ) AS skill_proficiencies
FROM
  teams
  LEFT JOIN team_skills ON team_skills.team_id = teams.id
GROUP BY
  teams.id;

-- Down Migration
DROP VIEW view_team_skill_proficiencies;

DROP TABLE team_skills;