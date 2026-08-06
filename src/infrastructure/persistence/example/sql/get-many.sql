SELECT
  id,
  name,
  example_kind_id,
  url
FROM
  examples
WHERE
  id IN ($(ids:csv))
ORDER BY
  id;