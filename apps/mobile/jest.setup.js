jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-worklets (dependência nova do Reanimated 4) inicializa um
// módulo nativo só por ser importado — mesmo sob o mock oficial do
// reanimated (react-native-reanimated/mock), o código-fonte real da lib
// ainda importa utilitários de react-native-worklets no top-level de vários
// módulos (ex.: src/animation/util.ts chama createSerializable(...) e
// serializableMappingCache.set(...) ao ser carregado). Um stub recursivo
// (qualquer propriedade acessada devolve outro stub, chamável e com
// qualquer sub-propriedade) cobre tanto "é uma função" quanto "é um objeto
// com métodos" sem precisar enumerar a API real do pacote.
function mockCreateWorkletsNoopStub() {
  const fn = () => mockCreateWorkletsNoopStub();
  return new Proxy(fn, {
    get: (target, prop) => {
      // `then` precisa devolver undefined, não outro stub: caso contrário
      // qualquer stub deste Proxy passa no teste de "é um thenable" do
      // motor de Promise do JS (`typeof x.then === 'function'`), e um
      // `await`/`Promise.resolve(...)` em cima dele chamaria esse `.then`
      // fake — que ignora os argumentos resolve/reject — travando a
      // Promise pra sempre em vez de rejeitar/resolver.
      if (prop === 'then') return undefined;
      return mockCreateWorkletsNoopStub();
    },
  });
}
jest.mock('react-native-worklets', () => mockCreateWorkletsNoopStub());
