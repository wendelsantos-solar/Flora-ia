# Roteiro de conversa humana — Fase 01.1

**Resultado atual: PENDENTE.** O usuário escolheu executar a conversa em outro momento. Não há aprovação humana inferida dos testes automáticos ou dos medidores.

Atualização de 08/11/2026: o responsável confirmou conversa bidirecional. A ficha abaixo continua sem medições detalhadas ou atribuição a um navegador.

## Preparação dos ramais 201 e 202

1. Abra a central em `http://localhost:13400`, com os serviços locais ativos. Atualize a página para carregar a versão da Fase 01.1.
2. Use dois perfis realmente separados de Chrome, ou um perfil normal e outro anônimo. Abas normais do mesmo perfil compartilham o cookie e não isolam os operadores.
3. Conecte 201 com `TOKEN_201` e `SIP_201_PASSWORD` do `.env`; no outro perfil, 202 com suas credenciais. Não inclua valores em relatórios, capturas ou mensagens.
4. Conecte dois headsets físicos. Não use “Microsoft Teams Audio” ou outra entrada virtual como comprovação de microfone físico. A inspeção desta execução identificou microfone/alto-falantes internos e dispositivos virtuais; não confirmou dois headsets.
5. Em cada perfil, abra **Dispositivo de áudio → Buscar microfones** e conceda permissão ao site. Escolha entradas diferentes: headset A no 201, headset B no 202.
6. Se aparecer **Saída de áudio**, escolha o headset correspondente em cada perfil. Se o navegador não permitir saída individual, use a seleção do sistema. Para dois operadores no mesmo computador, uma saída compartilhada não é evidência adequada de isolamento acústico; providencie saídas independentes ou realize depois o cenário privado de dois dispositivos descrito em REDES-DE-HOMOLOGACAO.md.
7. Confirme SIP conectado nos dois perfis. Baixe o volume inicialmente e use fones; não faça a avaliação com alto-falantes abertos próximos aos microfones.

Nenhuma gravação é necessária. Os medidores processam amostras localmente em memória; não enviam uma cópia do áudio ao backend e não medem inteligibilidade.

## Procedimento com duas pessoas

Use pessoas A e B, sem nomes ou dados pessoais no registro.

| Etapa | Ação objetiva | Resultado a registrar |
| --- | --- | --- |
| Captura/reprodução A → B | 201 liga para 202; B atende. A lê “A janela azul tem quarenta e sete folhas”. B repete a frase ouvida | Frase entendida sem consultar este roteiro no lado receptor; volume utilizável; ausência de cortes |
| Captura/reprodução B → A | B escolhe uma frase diferente e a lê; A a repete | Mesmos critérios no sentido inverso |
| Simultaneidade | Ambos contam de 1 a 10, em voz normal, ao mesmo tempo, por pelo menos 15 segundos | Duas vozes mantidas; não exigir alternância artificial para conseguir ouvir |
| Qualidade por 3 minutos | Conversa normal, com pausas e variação de volume | Registrar eco, retorno da própria voz, atraso percebido, cortes, distorção e esforço de entendimento |
| Mute A | A silencia e continua falando por cinco segundos; B informa o que escuta. A reativa e lê nova frase | Voz de A ausente enquanto silenciado e restaurada após reativação; B continua audível |
| Mute B | Repetir no outro ramal | Mesmo critério |
| Remoção de entrada | Desconectar fisicamente um headset durante a chamada | Aviso visível; não apresentar microfone perdido como ativo; registrar se a escuta restante funciona |
| Recuperação/troca | Reconectar ou selecionar outra entrada permitida. Repetir a frase | Captura retorna; não há duas entradas abertas sem necessidade. Seleção em chamada usa replaceTrack; se o navegador recusar, encerrar e escolher antes de ligar |
| Troca de saída | Quando suportado, selecionar outro fone e confirmar onde a voz é reproduzida | Som efetivamente muda de destino. Mudança do seletor, sozinha, não comprova reprodução |
| Permissão negada | Encerrar, negar microfone no site e tentar ligar/atender | Mensagem útil, chamada não fica presa, recursos liberados |
| Permissão restaurada | Permitir microfone no site e ligar novamente sem recarregar | Captura/reprodução funcionam; se o navegador exigir reload, registrar essa limitação em vez de marcar PASS |
| Encerramento A/B | Encerrar no 201; depois inverter 202 → 201 e encerrar no 202 | Ambos voltam a Disponível, áudio cessa e indicador de microfone do navegador deixa de apontar captura desta página |
| Chamadas sucessivas | Fazer cinco chamadas, alternando o originador, sem recarregar | Todas funcionam; cada chamada possui ID/histórico próprios; nenhuma chamada anterior continua audível |

Depois de desligar o microfone físico, o evento recebido depende do navegador/driver: alguns terminam a track, outros mudam para o dispositivo padrão. Registrar o comportamento observado. Não marcar remoção física como aprovada só porque a revogação automática de permissão passou.

## Critério de aprovação humana

As duas pessoas devem confirmar que conseguem conversar nos dois sentidos simultaneamente, entender as frases e sustentar três minutos sem eco incômodo, cortes recorrentes ou distorção. Se uma pessoa não confirmar, o resultado é FAIL ou INCONCLUSIVO, com motivo. Não transformar ausência de reclamação em aprovação.

## Registro a preencher

Copie o bloco abaixo por combinação de navegador/dispositivos. Não registrar áudio, senha, token, nome pessoal nem identificador persistente do hardware.

```text
Data/hora e fuso:
Versão da aplicação / referência das evidências:
Navegador e versão do 201 / do 202:
Sistema operacional de cada lado:
Rede: mesmo computador / LAN privada / VPN privada:
Entradas físicas: headset A / headset B:
Saídas físicas: headset A / headset B:
ID da chamada 201 → 202:
ID da chamada 202 → 201:
Frases compreendidas A → B: PENDENTE
Frases compreendidas B → A: PENDENTE
Fala simultânea: PENDENTE
Conversa de três minutos / qualidade: PENDENTE
Mute e recuperação A / B: PENDENTE
Permissão negada e restaurada: PENDENTE
Remoção e troca física de dispositivo: PENDENTE
Cinco chamadas sucessivas: PENDENTE
Encerramento e liberação da captura: PENDENTE
Confirmação da pessoa A: PENDENTE
Confirmação da pessoa B: PENDENTE
Ocorrências e limitações:
Parecer desta combinação: PENDENTE
```

O relatório principal só pode passar a GO integral após anexar esse resultado com confirmação positiva dos dois lados e tratar eventuais falhas materiais.
