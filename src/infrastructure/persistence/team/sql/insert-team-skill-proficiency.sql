INSERT INTO
  team_skills (team_id, skill_id, proficiency)
VALUES
  ($(teamId), $(skillId), $(proficiency))
RETURNING
  skill_id