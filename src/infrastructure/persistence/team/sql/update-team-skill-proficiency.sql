UPDATE skills_to_teams
SET
  proficiency = $(proficiency)
WHERE
  team_id = $(team_id)
  AND skill_id = $(skill_id)
RETURNING
  skill_id;