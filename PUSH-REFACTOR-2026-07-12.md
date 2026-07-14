# Refatoração global de Push — 2026-07-12

## Alterações

- Removido o card `PushActivationBanner` e seu arquivo.
- Removida toda responsabilidade de push do `InstallAppButton`.
- `InstallAppButton` agora cuida exclusivamente da instalação do PWA.
- Criado `PushSubscriptionManager`, montado uma única vez no nível global do app.
- Sincronização automática da subscription após autenticação.
- Autorreparo em boot, pageshow, foco, reconexão, retorno do background e controllerchange.
- Retentativas com backoff e verificação periódica a cada cinco minutos.
- Reaproveitamento da subscription válida e renovação em caso de mudança de VAPID.
- Persistência idempotente no backend usando o endpoint e as chaves reais do navegador.
- Primeira permissão solicitada apenas durante gesto confiável do usuário, conforme exigência do navegador.
- Mantidos o Service Worker, badge, som, vibração, PUSH_PING e atualização da inbox existentes.

## Validação executada

- `npm run build:client`: aprovado.
- `npm run build:server`: aprovado.
- `npm test -- --run`: 36 testes aprovados.
- `npm run check`: ainda apresenta erros TypeScript preexistentes em outros módulos do projeto.
