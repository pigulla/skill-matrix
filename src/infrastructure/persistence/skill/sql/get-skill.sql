SELECT
  id,
  name,
  description,
  example_ids
FROM
  view_skills_with_examples
WHERE
  id = $(id);