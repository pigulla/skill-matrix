INSERT INTO
  skills_to_teams_with_proficiency (team_id, skill_id, proficiency)
VALUES
  ($(team_id), $(skill_id), $(proficiency))
RETURNING
  skill_id;