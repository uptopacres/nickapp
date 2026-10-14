// Apps Script web-app URLs for the data service. Not secrets: the per-user
// token (captured from ?u= on the Pages URL) is what identifies the user.
// Add ?env=test to the Pages URL to talk to the TEST Sheet's deployment.
const URLS = {
  live: 'https://script.google.com/macros/s/AKfycby48oBTLtSi5hHRezoWmb22fvTAUu2GAvmQJ8MO6AiM_A7NMY3iFoMZUGsvO-Hj_EJ-/exec',
  test: 'https://script.google.com/macros/s/AKfycbwRVJ2wlNJf0-Y9fJjoI1fqMPsBPRva8kWU8YyzCFN102TsGdJdsaAqkuFC-1nNYXMebw/exec',
};

export const ENV = new URLSearchParams(location.search).get('env') === 'test' ? 'test' : 'live';
export const API_URL = URLS[ENV];
