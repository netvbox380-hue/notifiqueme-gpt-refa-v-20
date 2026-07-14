# Correções TypeScript — 2026-07-12

Validações finais:

- `npx tsc --noEmit`: aprovado, zero erros
- `npm test -- --run`: 36 testes aprovados
- `npm run build`: cliente e servidor aprovados

Principais correções:

- tipagem da autenticação e cache tRPC no logout;
- calendário compatibilizado com a versão instalada do `react-day-picker`;
- tipos mínimos para Google Maps, CORS e cookie-parser;
- logs de entrega alinhados ao procedimento `deliveryMap` existente;
- retorno assíncrono da limpeza de notificações normalizado para `Promise<void>`;
- tipagem dos IDs de usuários e grupos em agendamentos;
- procedimento seguro de redefinição de senha de administradores para o owner;
- fluxo OAuth legado desativado explicitamente, evitando chamadas a métodos inexistentes;
- `getDb()` agora falha de forma explícita quando `DATABASE_URL` não existe e retorna banco não-nulo quando bem-sucedido;
- filas e routers ajustados para o contrato não-nulo do banco;
- narrowing de `tenantId` na listagem de notificações;
- código de erro tRPC de upload corrigido;
- iteração de conjuntos normalizada para `Array.from`.

A refatoração global de push e subscription permanece incluída.
