SELECT
  id,
  name,
  description,
  last_updated,
  example_ids
FROM
  view_skills_with_examples
WHERE
  id = $(id);