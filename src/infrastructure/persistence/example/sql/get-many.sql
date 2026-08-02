SELECT
  id,
  name,
  kind,
  url
FROM
  examples
WHERE
  id IN ($(ids:csv))
ORDER BY
  id;