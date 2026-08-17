WITH
  current_row AS (
    SELECT
      1
    FROM
      examples
    WHERE
      id = $(id)
  ),
  updated_row AS (
    UPDATE examples
    SET
      name = $(name),
      example_kind_id = $(exampleKindId),
      url = $(url),
      last_updated = $(lastUpdated)
    WHERE
      id = $(id)
      AND concurrency_token (last_updated) = $(expectedToken)
    RETURNING
      id,
      name,
      example_kind_id,
      url,
      last_updated
  )
SELECT
  updated_row.id,
  updated_row.name,
  updated_row.example_kind_id,
  updated_row.url,
  updated_row.last_updated
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;