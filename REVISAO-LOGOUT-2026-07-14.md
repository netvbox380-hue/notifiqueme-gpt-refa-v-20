# Revisão do logout

Alteração restrita a `client/src/pages/UserNotifications.tsx`.

## Comportamento anterior

A tela chamava o logout central e, em seguida, desregistrava todos os Service Workers e apagava todos os caches do domínio.

## Comportamento atual

- O `AuthContext` remove do backend apenas a associação entre a subscription e a conta atual.
- A subscription local permanece disponível para reassociação segura no próximo login.
- O Service Worker permanece registrado.
- Os caches estruturais do PWA são preservados.
- O badge da sessão encerrada é zerado.
- O logout continua mesmo se houver falha de rede.

Nenhuma outra cadeia foi modificada.
