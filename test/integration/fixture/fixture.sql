--
-- Teams
--
INSERT INTO
  teams (id, name)
VALUES
  (
    '40000000-0002-4000-8000-000000000001',
    'Platform'
  ),
  ('40000000-0002-4000-8000-000000000002', 'Product'),
  ('40000000-0002-4000-8000-000000000003', 'QA');

--
-- Users
--
INSERT INTO
  users (id, first_name, last_name, email, team_id)
VALUES
  (
    '10000000-0001-4000-8000-edd1ebea1e00',
    'Eddie',
    'Beale',
    'eddie.beale@example.com',
    '40000000-0002-4000-8000-000000000001'
  ),
  (
    '20000000-0001-4000-8000-7e555ad1e900',
    'Tess',
    'Sadler',
    'tess.sadler@example.com',
    '40000000-0002-4000-8000-000000000001'
  ),
  (
    '30000000-0001-4000-8000-da1e61a55000',
    'Dale',
    'Glass',
    'dale.glass@example.com',
    '40000000-0002-4000-8000-000000000002'
  );

--
-- Skill example kinds
--
INSERT INTO
  example_kinds (kind)
VALUES
  ('technology'),
  ('pattern'),
  ('concept'),
  ('methodology');

--
-- Skills
--
INSERT INTO
  skills (id, name, description)
VALUES
  (
    '10000000-0003-4000-8000-5c111a00a100',
    'Backend Development',
    'Designing and building server-side services.'
  ),
  (
    '20000000-0003-4000-8000-5c111b00b200',
    'Frontend Development',
    'Building modern web user interfaces.'
  ),
  (
    '30000000-0003-4000-8000-5c111c00c300',
    'Software Architecture',
    'The high-level structure of a software system, including its components, relationships, and the key decisions guiding its design and evolution.'
  );

--
-- Examples
--
INSERT INTO
  examples (id, name, kind, url)
VALUES
  (
    'a0000000-0004-4000-8000-000000000001',
    'NestJS',
    'technology',
    'https://nestjs.com'
  ),
  (
    'a0000000-0004-4000-8000-000000000002',
    'PostgreSQL',
    'technology',
    'https://www.postgresql.org'
  ),
  (
    'a0000000-0004-4000-8000-000000000003',
    'React',
    'technology',
    'https://react.dev'
  ),
  (
    'a0000000-0004-4000-8000-000000000004',
    'SOLID',
    'methodology',
    NULL
  ),
  (
    'a0000000-0004-4000-8000-000000000005',
    'Next.js',
    'technology',
    'https://nextjs.org'
  ),
  (
    'a0000000-0004-4000-8000-000000000006',
    'COBOL',
    'technology',
    NULL
  );

--
-- Examples <--> Skills
--
INSERT INTO
  examples_to_skills (skill_id, example_id)
VALUES
  (
    '10000000-0003-4000-8000-5c111a00a100', -- Backend Development
    'a0000000-0004-4000-8000-000000000001' -- NestJS
  ),
  (
    '10000000-0003-4000-8000-5c111a00a100', -- Backend Development
    'a0000000-0004-4000-8000-000000000002' -- PostgreSQL
  ),
  (
    '20000000-0003-4000-8000-5c111b00b200', -- Frontend Development
    'a0000000-0004-4000-8000-000000000003' -- React
  ),
  (
    '30000000-0003-4000-8000-5c111c00c300', -- Software Architecture
    'a0000000-0004-4000-8000-000000000004' -- SOLID
  ),
  (
    '20000000-0003-4000-8000-5c111b00b200', -- Frontend Development
    'a0000000-0004-4000-8000-000000000005' -- Next.js
  );

--
-- Teams <--> Skills
--
INSERT INTO
  team_skills (team_id, skill_id, proficiency)
VALUES
  (
    '40000000-0002-4000-8000-000000000001', -- Platform
    '10000000-0003-4000-8000-5c111a00a100', -- Backend Development
    3
  ),
  (
    '40000000-0002-4000-8000-000000000001', -- Platform
    '30000000-0003-4000-8000-5c111c00c300', -- Software Architecture
    2
  ),
  (
    '40000000-0002-4000-8000-000000000002', -- Product
    '30000000-0003-4000-8000-5c111c00c300', -- Software Architecture
    2
  ),
  (
    '40000000-0002-4000-8000-000000000002', -- Product
    '10000000-0003-4000-8000-5c111a00a100', -- Backend Development
    1
  );