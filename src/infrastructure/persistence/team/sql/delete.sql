WITH
  current_row AS (
    SELECT
      1
    FROM
      teams
    WHERE
      id = $(id)
  ),
  deleted_row AS (
    DELETE FROM teams
    WHERE
      id = $(id)
      AND concurrency_token (version) = $(expectedToken)
    RETURNING
      id
  )
SELECT
  deleted_row.id
FROM
  current_row
  LEFT JOIN deleted_row ON TRUE;