# Captura de logs sob demanda por usuário

## Como funciona

1. O admin do tenant abre **Usuários** e clica no ícone de atividade do usuário.
2. Clica em **Iniciar gravação**.
3. O aplicativo do usuário verifica a existência da captura ativa a cada 10 segundos.
4. Somente durante a captura, eventos novos e redigidos são enviados em lotes ao servidor.
5. O admin clica em **Encerrar gravação**.
6. O relatório permanece disponível por 7 dias e depois é removido pelo processo de limpeza.

Fora de uma captura ativa, nenhum log do usuário é enviado ao servidor.

## Isolamento e segurança

- O admin acessa somente usuários do próprio tenant.
- A captura é vinculada a tenant, usuário e instalação.
- Senhas, cookies, tokens, secrets e chaves privadas são redigidos no cliente.
- Endpoints de push aparecem mascarados no relatório.
- O servidor rejeita uploads depois que a gravação é encerrada.
- Eventos duplicados são ignorados por uma chave única de captura/instalação/evento.

## Banco de dados

Antes de usar a funcionalidade em produção, execute uma vez:

```bash
npm run db:migrate
```

O comando é idempotente e cria `diagnostic_captures`, `diagnostic_capture_events` e seus índices.

## Retenção

O encerramento define a expiração para 7 dias depois. O cron existente `render:cleanup` remove capturas expiradas; as consultas da própria ferramenta também fazem limpeza oportunista.