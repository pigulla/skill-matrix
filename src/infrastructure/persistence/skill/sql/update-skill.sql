UPDATE skills
SET
  name = $(name),
  description = $(description),
  last_updated = $(lastUpdated)
WHERE
  id = $(id)
RETURNING
  id,
  name,
  description,
  last_updated;