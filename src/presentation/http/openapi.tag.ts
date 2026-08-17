export const OpenApiTag = {
  USERS: { name: 'Users', description: 'Manage users.' },
  TEAMS: { name: 'Teams', description: 'Manage teams.' },
  SKILLS: { name: 'Skills', description: 'Manage skills.' },
  EXAMPLE_KINDS: {
    name: 'Example Kinds',
    description: 'Manage the kinds examples can be classified as.',
  },
  EXAMPLES: {
    name: 'Examples',
    description: 'Manage examples that illustrate skill proficiency levels.',
  },
  TEAM_SKILL_PROFICIENCIES: {
    name: 'Team Skill Proficiencies',
    description: "Manage a team's skill proficiencies.",
  },
  HEALTH: { name: 'Health', description: 'Service health check.' },
} as const satisfies Record<string, { name: string; description: string }>
