SELECT
  id,
  name,
  description,
  concurrency_token (version) AS concurrency_token,
  example_ids
FROM
  view_skills_with_examples
WHERE
  id = $(id);