WITH
  current_row AS (
    SELECT
      1
    FROM
      skills
    WHERE
      id = $(id)
  ),
  deleted_row AS (
    DELETE FROM skills
    WHERE
      id = $(id)
      AND concurrency_token (last_updated) = $(expectedToken)
    RETURNING
      id
  )
SELECT
  deleted_row.id
FROM
  current_row
  LEFT JOIN deleted_row ON TRUE;