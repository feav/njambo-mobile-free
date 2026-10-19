// Local test env: points the app at a backend running on YOUR machine (see
// fap-fap-back/scripts/run-local-preprod.sh), itself connected to the préprod
// database through an SSH tunnel. Use this to reproduce/debug real préprod
// bugs locally before pushing anything.
export const environment = {
  production: false,
  apiBaseUrl: 'https://fapfap-backend.betai.fr',
  googleClientId: '1063984749264-vgbbripgttec7fsalo7ue3op7lnu0r15.apps.googleusercontent.com'
};
