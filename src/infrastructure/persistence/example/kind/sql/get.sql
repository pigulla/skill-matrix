SELECT
  id,
  name,
  last_updated
FROM
  example_kinds
WHERE
  id = $(id);