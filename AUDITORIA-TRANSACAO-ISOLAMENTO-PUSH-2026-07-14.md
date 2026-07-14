# Auditoria de envio, isolamento e push — 2026-07-14

## Escopo aplicado

- Mantido o logout revisado, sem remover Service Worker ou caches globais.
- Não foi adicionado `organizationId`.
- Refatorado o envio imediato de notificações para uma transação única.
- Reforçada a autorização de anexos.
- Melhorado o registro do resultado do canal push.
- Substituído o pedido automático de permissão no primeiro gesto por consentimento contextual.
- Adicionados testes unitários das políticas de audiência, IDs e anexos.

## Transação do envio

A mesma transação confirma:

1. consumo de créditos;
2. criação da notificação;
3. vínculo dos anexos;
4. criação das deliveries.

Qualquer falha reverte todas essas etapas. O push é executado somente depois do commit, pois é uma operação externa.

## Anexos

- Precisam pertencer ao tenant da mensagem.
- Administradores só podem usar arquivos carregados pela própria conta.
- Owner pode usar arquivos do tenant selecionado.
- Arquivos já ligados a outra notificação não podem ser reutilizados.
- A atualização transacional usa `relatedNotificationId IS NULL` e confirma a quantidade atualizada, evitando corrida entre dois envios.

## Push e inbox

- `delivered`: ao menos uma subscription do usuário aceitou o push.
- `failed`: falha real de entrega; o motivo é registrado por usuário.
- `sent` com observação: usuário sem subscription ativa, mas a mensagem permanece na inbox.
- Falha ao atualizar o status de auditoria não desfaz a mensagem já confirmada.
- Endpoints 404/410 continuam sendo removidos pelo despachante de push.

## Consentimento inicial

A permissão nativa não é mais aberta em qualquer toque da aplicação. É exibida uma explicação contextual com ação explícita. Ao escolher “Agora não”, o aviso é adiado por sete dias. Depois de concedida a permissão, a recuperação e sincronização continuam automáticas.

## Validações realizadas neste ambiente

- Auditoria estática dos pontos alterados.
- Transpilação TypeScript individual dos arquivos alterados: sem erros sintáticos.
- Verificação da permanência do logout revisado.
- Verificação de que o consumo de créditos ocorre somente dentro da transação.
- Verificação de que o push ocorre somente depois do commit.

A instalação completa de dependências não pôde ser concluída no ambiente devido à indisponibilidade de alguns pacotes no cache interno. Por isso, este documento não afirma execução completa de `tsc`, Vitest e builds nesta rodada específica.
