# Correção baseada no diagnóstico 5050sd

O relatório da captura #1 confirmou:

- usuário: `5050sd` (ID 1017, tenant 1);
- uma subscription Android/Chrome registrada no servidor;
- duas deliveries recebidas e posteriormente marcadas como lidas;
- dois eventos `PUSH_PING` recebidos pelo aplicativo;
- 37 esperas malsucedidas por `serviceWorker.ready`;
- 8 timeouts globais falsamente degradando o estado para `not-subscribed`;
- recriação repetida de subscriptions;
- 4 avisos React causados pelo uso de um componente `Link` sem encaminhamento de ref dentro de um Slot.

Correções aplicadas:

1. Remoção total de `navigator.serviceWorker.ready` da cadeia de push.
2. Consultas de registrations e subscriptions em paralelo e com prazo curto.
3. Uso direto da registration existente para ler/criar subscription.
4. Registro e atualização do Service Worker centralizados em `main.tsx`.
5. Remoção do registro/`update()` duplicado em `App.tsx`.
6. Fallback de registro sem `update()` no módulo de push.
7. Cache do Service Worker elevado para v11 para distribuir a correção.
8. Navegação lateral sem `Link` funcional dentro de Radix Slot, eliminando o aviso de ref.
9. Iteração dos listeners ajustada para compatibilidade TypeScript.