export function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    sections: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    skills: <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" />,
    github: (
      <path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .2-2-1-3 4-.5 6-2 6-6 0-1-.5-3-1-3 .3-1 .3-2 0-3-2 0-3 1-4 2a12 12 0 0 0-6 0C8 4 7 3 5 3c-.3 1-.3 2 0 3-.5.5-1 2-1 3 0 4 2 5.5 6 6-1 1-1 2-1 3v4" />
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
        <circle cx="12" cy="12" r="7" />
      </>
    ),
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
    edit: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15z" />
      </>
    ),
    camera: (
      <>
        <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    moon: <path d="M20.5 13.5A9 9 0 0 1 10.5 3a9 9 0 1 0 10 10.5Z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    share: <path d="M14 4h6v6m0-6L9 15M10 5H4v15h15v-6" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    projects: (
      <>
        <path d="M3 7h7l2 2h9v10H3z" />
        <path d="M3 7V5h7l2 2" />
      </>
    ),
    feed: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
      </>
    ),
    contact: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      {paths[name] || paths.profile}
    </svg>
  );
}
