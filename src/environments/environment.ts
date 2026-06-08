// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// La config de Firebase web es pública por diseño (la seguridad va en las reglas
// de Firestore + Auth), por eso puede vivir en el repositorio.

export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyDsAqk99hRbMBU1iseJXNM9dUnR76TPRwg',
    authDomain: 'vstore-2026.firebaseapp.com',
    projectId: 'vstore-2026',
    storageBucket: 'vstore-2026.firebasestorage.app',
    messagingSenderId: '465812165290',
    appId: '1:465812165290:web:714a8dc3de378d1242b6d3',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
