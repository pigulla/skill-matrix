DELETE FROM skills_to_teams_with_proficiency
WHERE
  team_id = $(team_id)
  AND skill_id = $(skill_id)
RETURNING
  skill_id;