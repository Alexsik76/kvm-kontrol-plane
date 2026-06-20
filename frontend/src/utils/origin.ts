export const wsBase = () =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
