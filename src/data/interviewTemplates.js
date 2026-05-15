/**
 * Ready-made interviews: fixed questions by role / level / stack.
 * No OpenAI required to start these sessions.
 */
export const INTERVIEW_TEMPLATES = [
  {
    id: "fe-junior-react",
    title: "Junior Frontend — React",
    summary: "Components, state, and basics for a junior React role.",
    role: "Frontend Developer",
    level: "Junior",
    techStack: ["React", "JavaScript", "HTML", "CSS"],
    questions: [
      "Explain the difference between props and state in React. When would you lift state up?",
      "How does the React component lifecycle (or useEffect) help you handle side effects such as data fetching?",
      "What strategies do you use to split a large UI into smaller components without over-fragmenting?",
      "How would you debug a situation where a child component does not re-render when you expect it to?",
      "Describe how you would make a simple form accessible (labels, focus, keyboard use) in a React app.",
    ],
  },
  {
    id: "fe-mid-react-ts",
    title: "Mid Frontend — React & TypeScript",
    summary: "Typing, performance, and maintainability for product teams.",
    role: "Frontend Engineer",
    level: "Mid",
    techStack: ["React", "TypeScript", "Next.js"],
    questions: [
      "How do you decide between generic component props versus composition (children, slots) in React?",
      "Explain how you use TypeScript to model API responses and avoid `any` in UI code.",
      "What techniques do you use to reduce unnecessary re-renders in a medium-sized React app?",
      "Walk through how you would add client-side routing and data loading in a Next.js app.",
      "How do you test React components and hooks in a way that stays stable as the UI evolves?",
    ],
  },
  {
    id: "be-mid-node",
    title: "Mid Backend — Node.js",
    summary: "APIs, persistence, and reliability on the server.",
    role: "Backend Engineer",
    level: "Mid",
    techStack: ["Node.js", "Express", "MongoDB"],
    questions: [
      "How would you structure an Express app so routes, controllers, and data access stay maintainable?",
      "Compare SQL vs document databases for a typical CRUD API. Why might a team pick MongoDB?",
      "Describe how you would design error handling and consistent HTTP status codes across an API.",
      "What is your approach to validating request bodies and rejecting bad input safely?",
      "How would you investigate high latency on a single endpoint in production?",
    ],
  },
  {
    id: "fullstack-senior",
    title: "Senior Full-Stack",
    summary: "End-to-end design, trade-offs, and production operations.",
    role: "Full-Stack Engineer",
    level: "Senior",
    techStack: ["React", "Node.js", "PostgreSQL", "Docker"],
    questions: [
      "Design a feature flag system for a web app: what components would you add on client and server?",
      "How do you approach database schema changes and zero-downtime deploys for a busy service?",
      "Explain trade-offs between synchronous REST, polling, and WebSockets for live updates.",
      "What is your checklist before shipping a change that touches authentication or authorization?",
      "How do you monitor and alert on errors and latency across a small distributed system?",
    ],
  },
  {
    id: "mobile-mid-react-native",
    title: "Mid Mobile — React Native",
    summary: "Navigation, native bridges, and UX on devices.",
    role: "Mobile Engineer",
    level: "Mid",
    techStack: ["React Native", "TypeScript", "iOS", "Android"],
    questions: [
      "How do you structure navigation in a React Native app as it grows beyond a few screens?",
      "What challenges have you seen with list performance, and how do you address them?",
      "How would you integrate a native module when a JS-only solution is not enough?",
      "Describe your approach to handling offline or flaky network conditions in a mobile client.",
      "How do you test React Native apps (unit, integration, device) before release?",
    ],
  },
];

export function getTemplateById(id) {
  return INTERVIEW_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function listTemplateSummaries() {
  return INTERVIEW_TEMPLATES.map(
    ({ id, title, summary, role, level, techStack, questions }) => ({
      id,
      title,
      summary,
      role,
      level,
      techStack,
      questionCount: questions.length,
    }),
  );
}
