# Extinction App (React Native / Expo) + extinction-api (Spring Boot)

Projeto acadêmico **Extinction** — plataforma de ciência cidadã para conservação da
biodiversidade brasileira. Cliente mobile em **React Native + Expo + TypeScript**, backend em
**Java 17 + Spring Boot + MySQL** (pasta `backend/`, ver `backend/README.md`).

**Status:** as duas pontas estão conectadas de verdade — o app não usa mais dados mockados
(exceto recuperação de senha, por falta de infra de e-mail no backend). Ver
`backend/README.md` pra detalhes de endpoints, domínio e do reconhecimento de imagem via
TensorFlow.

## Como rodar tudo

### 1. Backend (precisa do Docker Desktop aberto)

```bash
cd backend
docker-compose up --build -d
```

Confere que subiu: `curl http://localhost:8080/actuator/health` deve responder
`{"status":"UP"}`. Primeira subida é mais lenta (~30-55s, baixa a lib nativa do TensorFlow e um
modelo — ver `backend/README.md`, seção de IA).

### 2. Frontend (Expo)

Em outro terminal, na raiz do projeto:

```bash
npx expo start
```

Escaneie o QR code com o app **Expo Go** (Android/iOS) — celular precisa estar na mesma rede
Wi-Fi/LAN do computador. O app detecta sozinho o IP da API a partir do endereço que o próprio
Metro Bundler está usando (`src/services/api.ts`), então não precisa configurar nada manual —
a menos que queira forçar uma URL específica via variável de ambiente `EXPO_PUBLIC_API_URL`.

### 3. Login

Usuários de teste já cadastrados (senha `extinction123` pra todos — ver
`backend/README.md`): `ana.biologa@extinction.dev`, `flavio.santos@extinction.dev`,
`guilherme.alves@extinction.dev`.

Outros comandos úteis:
- `npx tsc --noEmit` — checagem de tipos (TypeScript em modo `strict`).
- `npx expo export --platform android` — gera o bundle JS de produção, útil para validar que tudo compila sem abrir um dispositivo.

## O que já está implementado

| Tela | Arquivo | Requisitos/HU cobertos |
|---|---|---|
| Login | `src/screens/auth/LoginScreen.tsx` | HU02 — autenticação real via JWT |
| Cadastro | `src/screens/auth/RegisterScreen.tsx` | HU01 — regras de senha, cadastro real |
| Recuperar senha | `src/screens/auth/ForgotPasswordScreen.tsx` | HU03 — **ainda mockado** (sem infra de e-mail no backend) |
| Feed | `src/screens/FeedScreen.tsx` | RF005/RF013, HU06 — timeline real, curtidas, comentários (expandir/adicionar), pull-to-refresh, recarrega ao focar a aba |
| Mapa | `src/screens/MapScreen.tsx` | RF008/RF016/RF017, HU05 — mapa OpenStreetMap com avistamentos reais, busca, filtro por status, recarrega ao focar a aba |
| Novo Avistamento | `src/screens/NewSightingScreen.tsx` | RF001/RF002/RF011/RF018, HU04 — foto (câmera/galeria), GPS automático, reconhecimento de espécie via DJL/TensorFlow real no backend, upload de foto |
| Enciclopédia | `src/screens/EncyclopediaScreen.tsx` | RF014, HU07 — busca e detalhes de espécies (catálogo real) |
| Perfil | `src/screens/ProfileScreen.tsx` | RF007/RF010, HU08 — estatísticas reais (avistamentos/espécies do usuário), ranking real, logout |

Todas as telas respeitam a área segura do dispositivo (notch/status bar) via
`react-native-safe-area-context`.

### Autenticação e navegação

- `src/context/AuthContext.tsx`: guarda o usuário logado **e o token JWT**, persiste ambos com
  `@react-native-async-storage/async-storage`, injeta o token nas chamadas via
  `src/services/api.ts`.
- `src/navigation/RootNavigator.tsx`: `AuthNavigator` (sem login) ou `MainNavigator` (com
  login) — abas Feed, Mapa, Avistar, Espécies, Perfil.

### Estrutura de pastas

```
extinction-app/
├─ App.tsx                     # SafeAreaProvider + AuthProvider + RootNavigator
├─ backend/                    # API Spring Boot (ver backend/README.md)
└─ src/
   ├─ types/index.ts           # modelos TS espelhando os DTOs do backend
   ├─ theme/colors.ts          # paleta de cores e rótulos de status de extinção
   ├─ services/
   │  ├─ api.ts                # cliente HTTP real (JWT, multipart, base URL auto-detectada)
   │  └─ mockApi.ts            # só recuperação de senha ainda (sem infra de e-mail no backend)
   ├─ context/AuthContext.tsx  # sessão do usuário + token JWT
   ├─ components/
   │  ├─ StatusBadge.tsx       # selo colorido de status de extinção
   │  └─ PostCard.tsx          # card de postagem: curtir, expandir/adicionar comentários
   ├─ navigation/
   │  ├─ types.ts
   │  ├─ AuthNavigator.tsx
   │  ├─ MainNavigator.tsx
   │  └─ RootNavigator.tsx
   └─ screens/
      ├─ auth/ (Login, Register, ForgotPassword)
      ├─ FeedScreen.tsx
      ├─ MapScreen.tsx
      ├─ NewSightingScreen.tsx
      ├─ EncyclopediaScreen.tsx
      └─ ProfileScreen.tsx
```

### Dependências nativas já instaladas

| Pacote | Uso |
|---|---|
| `@react-navigation/native`, `native-stack`, `bottom-tabs` | Navegação |
| `react-native-screens`, `react-native-safe-area-context` | Navegação + área segura (notch/status bar) |
| `react-native-maps` | Mapa com tiles OpenStreetMap (`UrlTile`) |
| `expo-location` | Captura de GPS no avistamento |
| `expo-image-picker` | Câmera e galeria de fotos |
| `expo-constants` | Detecta o IP da API a partir do endereço do Metro Bundler |
| `@react-native-async-storage/async-storage` | Persistência local de sessão + token JWT |

## O que ainda é mock ou está fora de escopo

1. **Recuperação de senha** (`mockRequestPasswordReset` em `src/services/mockApi.ts`) — não há
   infraestrutura de envio de e-mail no backend ainda.
2. ~~Reconhecimento de espécie usa um classificador genérico do ImageNet~~ — **atualizado**:
   agora carrega o SavedModel real treinado por `ml/scripts/train_model.py` (transfer learning
   sobre MobileNetV2, ~11 mil espécies do GBIF, não só as do catálogo de exemplo). Detalhes,
   configuração e limitações na seção abaixo e em `backend/README.md`.

### Reconhecimento de espécie (RF018) com o modelo treinado

- `ai/TFmodel.java` carrega `ml/model/saved_model/` (Git LFS) via DJL, com um translator
  próprio (`SpeciesClassifierTranslator`) que replica o pré-processamento do treino (resize
  224×224, reescala pra `[-1, 1]`, layout HWC — **não** o `ToTensor()` padrão do DJL, que
  quebraria a inferência num SavedModel do Keras). Validado com um smoke test manual rodando
  inferência de verdade contra o modelo real antes de entrar no código.
- Previsões abaixo de `app.identificacao.confianca-minima` (default 50%, env
  `CONFIANCA_MINIMA_IDENTIFICACAO`) são descartadas — sem nenhuma previsão confiante, a resposta
  vem vazia e o app mostra "espécie não identificada" em vez de forçar uma sugestão de baixa
  confiança (comportamento antigo, removido).
- O catálogo (`Especie`) não tem mais curadoria manual cobrindo todo o espaço de espécies
  reconhecíveis (~11 mil, inviável à mão): a primeira identificação confiante de uma espécie
  nova cria a linha automaticamente (nome popular = nome científico, status `NAO_AVALIADO`);
  curar descrição/habitat/status real depois é um UPDATE manual, não um fluxo de código novo.
- Modelo atual ainda modesto (`ml/model/training_log.csv`: val_accuracy ~32%, val_top5_acc ~49%
  em ~11 mil classes) — o limiar de confiança acima deve ser reajustado conforme o treino
  evoluir.

### Avisos / decisões em aberto (não resolvidos por conta própria)

- **CI não baixa o modelo via Git LFS.** `.github/workflows/backend-ci.yml` usa o checkout
  padrão, que ignora conteúdo LFS — então nenhum teste de inferência real roda em CI hoje (o
  smoke test usado pra validar a integração foi removido do repo de propósito, só existiu
  localmente). Se a equipe quiser esse teste em CI, precisa adicionar `lfs: true` no
  `actions/checkout`, mas isso passa a baixar ~500MB por execução contra a cota gratuita de
  1GB/mês de banda LFS do GitHub — decisão de custo/benefício da equipe, não ativei por padrão.
- **Publicar avistamento sem espécie identificada ainda não funciona de ponta a ponta.**
  `NewSightingScreen.tsx` tem um comentário citando "HU04 cenário 4.3: publicação sem
  título/espécie", mas `PostagemController`/`PostagemService.criar` exigem `especieIds` não
  vazio (`especieIds` nem é opcional no `@RequestParam`, e o service rejeita lista vazia com
  400). Antes, isso nunca aparecia na prática porque o backend sempre preenchia 3 candidatas
  falsas de baixa confiança; agora que "não identificado" é uma resposta real e esperada, quem
  cair nesse caso fica sem conseguir publicar. Não mudei essa regra de negócio porque decidir se
  postagens podem existir sem espécie é escopo de produto, não de integração do modelo — precisa
  de uma decisão explícita da equipe.

## O que ainda não existe

- Tela de edição/exclusão de postagem (RF012).
- Tela de detalhe de espécie a partir de um marcador do mapa.
- Login social (Google/Apple).
- Notificações push (Firebase Cloud Messaging).
- Ícones de verdade nas abas (hoje são emojis).

## Contexto do projeto

Plataforma de ciência cidadã para conservação da biodiversidade brasileira. Documento de
Arquitetura de Software e Documento de Visão da equipe descrevem o escopo completo; este
README cobre o estado atual da implementação (frontend + backend).
