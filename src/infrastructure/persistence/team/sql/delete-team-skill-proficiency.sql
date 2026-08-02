DELETE FROM team_skills
WHERE
  team_id = $(teamId)
  AND skill_id = $(skillId)
RETURNING
  skill_id