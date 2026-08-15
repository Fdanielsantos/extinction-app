// Única função que continua mockada mesmo com o backend real conectado
// (ver src/services/api.ts): não há infraestrutura de e-mail no backend
// ainda pra recuperação de senha.

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockRequestPasswordReset(email: string): Promise<void> {
  await delay();
  if (!email.includes('@')) {
    throw new Error('E-mail inválido.');
  }
}
