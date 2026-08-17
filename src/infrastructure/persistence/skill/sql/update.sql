WITH
  current_row AS (
    SELECT
      1
    FROM
      skills
    WHERE
      id = $(id)
  ),
  updated_row AS (
    UPDATE skills
    SET
      name = $(name),
      description = $(description),
      last_updated = $(lastUpdated)
    WHERE
      id = $(id)
      AND concurrency_token (last_updated) = $(expectedToken)
    RETURNING
      id
  )
SELECT
  updated_row.id
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;