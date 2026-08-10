export const OpenApiTag = {
  USERS: { name: 'Users', description: 'Manage users.' },
  TEAMS: { name: 'Teams', description: 'Manage teams.' },
  TEAM_SKILLS: { name: 'Team Skills', description: "Manage a team's skill proficiencies." },
  SKILLS: { name: 'Skills', description: 'Manage skills.' },
  EXAMPLES: {
    name: 'Examples',
    description: 'Manage examples that illustrate skill proficiency levels.',
  },
  EXAMPLE_KINDS: {
    name: 'Example Kinds',
    description: 'Manage the kinds examples can be classified as.',
  },
  HEALTH: { name: 'Health', description: 'Service health check.' },
} as const satisfies Record<string, { name: string; description: string }>
