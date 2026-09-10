// Config do Metro para o app mobile — necessário pro NativeWind processar
// as classes Tailwind (className) em estilos de verdade. Faltava neste
// projeto (nunca existiu) porque a versão de nativewind originalmente
// travada (~4.0.1) usava um mecanismo mais simples, baseado só no plugin
// babel, sem depender do pipeline de CSS do Metro. Versões mais recentes
// da faixa 4.x (a atual, 4.2.6) tornaram esse pipeline obrigatório — sem
// ele, o transform de className roda mas não tem nenhuma folha de estilo
// compilada pra resolver, então os componentes renderizam sem nenhum
// estilo aplicado.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
