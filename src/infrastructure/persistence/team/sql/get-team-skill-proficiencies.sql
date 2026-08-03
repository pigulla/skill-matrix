SELECT
  team_id,
  skill_proficiencies
FROM
  view_team_skill_proficiencies
WHERE
  team_id = $(team_id);