SELECT
  id,
  name,
  kind,
  url
FROM
  examples
WHERE
  id = $(id);