# Isolamento e mensagens administrativas

## Regras implementadas

- Owner envia para administradores do tenant selecionado.
- `all` para owner significa todos os usuários com papel `admin` daquele tenant.
- Seleção específica do owner aceita apenas admins pertencentes ao tenant informado.
- Admin continua enviando somente para usuários finais criados por ele.
- Grupos de admin são validados por tenant e pelo admin criador.
- Owner não pode usar grupos para avisos administrativos.
- Listagem, mapa de entregas, feedbacks e limpeza são limitados ao emissor (`createdBy`).
- IDs enviados pelo frontend nunca são usados sem revalidação no backend.
- Push valida novamente se cada destinatário pertence ao tenant.
- `push_subscriptions` passa a registrar `tenantId`; `ensureSchema` cria a coluna, faz backfill e cria índice sem apagar dados.
- Status da delivery passa para `delivered` quando o push é aceito e `failed` quando o envio push falha; usuários sem subscription continuam com a mensagem disponível na inbox.

## Validações executadas

- `npm run check`: aprovado, zero erros TypeScript.
- `npm test`: 36/36 testes aprovados.
- `npm run build:client`: aprovado.
- `npm run build:server`: aprovado.

## Observação de modelo

O projeto mantém o conceito atual de owner global do sistema. O isolamento entre owners é aplicado às mensagens pelo campo `createdBy`. Se no futuro existirem empresas donas independentes, recomenda-se adicionar uma entidade `organizationId`/`ownerAccountId` aos tenants e usuários.
