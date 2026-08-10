SELECT
  id,
  name,
  example_kind_id,
  url,
  last_updated
FROM
  examples
WHERE
  id IN ($(ids:csv))
ORDER BY
  id;