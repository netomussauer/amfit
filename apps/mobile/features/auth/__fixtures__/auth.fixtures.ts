import type { AuthResponse, LoginRequest } from '@amfit/shared';

export function makeLoginRequest(overrides: Partial<LoginRequest> = {}): LoginRequest {
  return {
    email: 'aluno@example.com',
    senha: 'senha1234',
    tipo: 'ALUNO',
    ...overrides,
  };
}

export function makeAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-456',
    token_type: 'Bearer',
    expires_in: 3600,
    usuario: {
      id: '70000000-0000-0000-0000-000000000001',
      nome: 'Aluno Teste',
      role: 'ALUNO',
    },
    ...overrides,
  };
}
