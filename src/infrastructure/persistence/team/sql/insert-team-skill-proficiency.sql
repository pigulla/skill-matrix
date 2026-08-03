INSERT INTO
  skills_to_teams (team_id, skill_id, proficiency)
VALUES
  ($(team_id), $(skill_id), $(proficiency))
RETURNING
  skill_id;