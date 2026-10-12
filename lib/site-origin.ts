export const siteOrigin = () =>
  new URL(process.env.PUBLIC_ORIGIN || 'https://ericisme.cloud').origin;
