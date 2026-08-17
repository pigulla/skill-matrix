SELECT
  id,
  name,
  last_updated
FROM
  teams
WHERE
  id = $(id);