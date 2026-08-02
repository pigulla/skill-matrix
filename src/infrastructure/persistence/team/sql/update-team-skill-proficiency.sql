UPDATE team_skills
SET
  proficiency = $(proficiency)
WHERE
  team_id = $(teamId)
  AND skill_id = $(skillId)
RETURNING
  skill_id