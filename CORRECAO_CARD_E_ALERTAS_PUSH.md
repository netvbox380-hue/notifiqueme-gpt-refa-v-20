# Correção do card de ativação e dos alertas push

**Autor:** Manus AI  
**Data:** 11 de julho de 2026

## Diagnóstico

O card permanecia visível por dois problemas combinados. Primeiro, depois de salvar a assinatura no backend, a interface voltava o estado global para `checking` e dependia de uma nova leitura das APIs do Service Worker. Em celulares mais lentos, o limite de três segundos podia expirar; a leitura então degradava para `not-subscribed`, embora a ativação tivesse acabado de ser concluída. Segundo, o frontend reutilizava qualquer `PushSubscription` existente sem confirmar se ela havia sido criada com a chave VAPID pública atual. Após uma troca de chave VAPID, o navegador podia parecer “ativado”, mas o servidor não conseguia entregar mensagens usando a assinatura antiga.

> A permissão `granted` não prova, por si só, que existe uma assinatura Web Push utilizável e compatível com a chave VAPID atual.

A ausência de som com o app aberto tinha ainda uma causa independente: o alerta sonoro e a vibração local eram preparados e executados apenas na rota da caixa de mensagens. Se o usuário estivesse em outra tela, o listener global mostrava o toast e atualizava o badge, mas não reproduzia som nem vibrava.

| Sintoma | Causa identificada | Correção aplicada |
|---|---|---|
| Card “Ativar notificações” continua aparecendo | Nova leitura lenta sobrescrevia o sucesso confirmado | O estado agora é confirmado como `active` somente depois de o backend aceitar a assinatura, invalidando leituras antigas |
| Permissão concedida, mas nenhuma mensagem chega | Assinatura antiga podia usar outra chave VAPID | A chave da assinatura é comparada com a chave pública atual; se divergir, a assinatura é cancelada e recriada |
| Falso negativo em celulares lentos | Timeouts de três segundos eram agressivos para Android/TWA | Limites internos elevados para oito segundos e guarda global elevada para 24 segundos |
| Sem som/vibração quando o app está aberto fora da caixa de mensagens | O alerta local existia apenas em `UserNotifications.tsx` | Preparação de áudio, som e vibração foram movidos para o listener global de `App.tsx` |
| Toast ou som duplicado na caixa de mensagens | Dois listeners passariam a alertar a mesma entrega | O listener da página agora apenas atualiza a caixa; o alerta imediato fica centralizado no app |

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `client/src/lib/push.ts` | Reconciliação da chave VAPID, renovação de assinatura incompatível, confirmação transacional do estado e timeouts adequados a dispositivos móveis |
| `client/src/components/InstallAppButton.tsx` | O card passa a receber `active` imediatamente após a inscrição ser salva no servidor |
| `client/src/App.tsx` | Som, vibração, toast e badge passam a funcionar globalmente quando o app está aberto |
| `client/src/pages/UserNotifications.tsx` | Remoção do alerta imediato duplicado, preservando atualização e fallback por polling |
| `shared/push-vapid.ts` | Comparação binária reutilizável da chave VAPID da assinatura |
| `server/push-vapid.test.ts` | Cinco testes de regressão para chave igual, diferente, ausente e views com deslocamento |

## Limites de som, vibração e badge no celular

O Web Push não possui uma opção para escolher ou forçar um arquivo de som em `showNotification()`. A API oferece `silent`, `vibrate` e `badge`, mas o som de uma notificação em segundo plano é decidido pelo canal de notificações do navegador/PWA e pelas configurações do Android ou iOS. A vibração também é *best effort* e pode ser bloqueada pelo modo silencioso, “Não perturbe”, economia de bateria ou configuração do canal.[1]

A propriedade `PushSubscription.options.applicationServerKey` expõe a chave usada para criar a assinatura. Por isso, comparar essa chave com a VAPID atual e recriar a assinatura quando houver divergência é o comportamento correto.[2]

| Situação | Quem controla o alerta |
|---|---|
| App aberto e visível | O projeto toca o alerta local, vibra, mostra toast e solicita badge |
| App em segundo plano ou fechado | O Service Worker apresenta a notificação; som, vibração e badge obedecem ao sistema operacional e ao canal do app |
| Navegador/PWA com canal definido como silencioso | O código não consegue sobrepor a escolha do sistema; o usuário precisa habilitar som e vibração nas configurações do celular |
| Launcher sem suporte a contador | Pode aparecer somente ponto ou nenhuma contagem, mesmo com a API de badge executada |

## Validação realizada

A suíte completa passou com **36 testes em quatro arquivos**, incluindo os cinco novos testes de VAPID. O build de produção do cliente e o build do servidor também foram concluídos com sucesso.

O comando global `npm run check` continua acusando aproximadamente 100 erros TypeScript que já existiam em 17 arquivos não relacionados a esta correção. Nenhum erro da saída se refere aos seis arquivos alterados ou adicionados para o push. Essa dívida técnica não impediu os testes nem os builds de produção.

## Checklist após publicar

Após implantar o pacote, deve-se abrir o app publicado por HTTPS e atualizar/reabrir o PWA. No primeiro acesso, o código renovará automaticamente uma assinatura criada com chave VAPID antiga. Em seguida, é recomendável usar “Testar push” e conferir o painel de diagnóstico.

No Android, deve-se abrir **Configurações → Apps → navegador ou PWA → Notificações** e confirmar que o canal está permitido, com som, vibração e badge habilitados. Também é importante remover restrições severas de bateria para o navegador/PWA quando o fabricante interrompe processos em segundo plano.

No servidor publicado, `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` precisam pertencer ao mesmo par e permanecer estáveis entre implantações. Trocar apenas uma delas invalida a capacidade de entrega das assinaturas existentes.

## Referências

[1]: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification "MDN — ServiceWorkerRegistration.showNotification()"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/PushSubscriptionOptions/applicationServerKey "MDN — PushSubscriptionOptions.applicationServerKey"
