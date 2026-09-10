// @types/jest a partir da v29.5.14/v30 parou de declarar `jest` como valor
// global (só mantém `namespace jest` para tipos como `jest.Mock<T>`) — o
// pacote espera que projetos migrem pra `import { jest } from '@jest/globals'`.
// Este projeto usa o modelo clássico de globals injetados pelo jest-expo
// (sem imports explícitos nos 59 arquivos de teste), então restauramos aqui
// só a declaração de valor que faltou, reaproveitando o namespace já
// fornecido por @types/jest.
declare global {
  // eslint-disable-next-line no-var
  var jest: jest.Jest;
}

export {};
