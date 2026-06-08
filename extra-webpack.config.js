/**
 * Config webpack parcial inyectada vía @angular-builders/custom-webpack.
 * jeep-sqlite referencia el módulo `crypto` de Node (no existe en navegador y
 * no se usa en web). Le decimos a webpack que lo resuelva como módulo vacío
 * para silenciar el warning de build sin afectar el runtime.
 */
module.exports = {
  resolve: {
    fallback: {
      crypto: false,
    },
  },
};
