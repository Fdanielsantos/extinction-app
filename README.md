# Extinction App — Esqueleto Mobile (React Native / Expo)

Esqueleto funcional do cliente mobile do projeto **Extinction**, construído em **React Native + Expo + TypeScript**, conforme a recomendação de tecnologias da equipe (ver `../Recomendacao-Tecnologias-Extinction.md`).

O objetivo desta primeira leva é ter **navegação completa e telas funcionais rodando com dados mockados**, prontas para depois serem conectadas à API real (Java 17 + Spring Boot, já definida no Documento de Arquitetura de Software da equipe).

## Como rodar

Pré-requisitos: Node.js (LTS) instalado — já configurado nesta máquina. Em um terminal **novo** (aberto depois da instalação do Node):

```bash
cd extinction-app
node -v        # confirma que o Node está disponível no PATH
npx expo start
```

Isso abre o Metro Bundler com um QR code. Escaneie com o app **Expo Go** (Android ou iOS, disponível na loja de apps) para rodar o app no celular — não é necessário emulador nem build nativo para esta fase.

Outros comandos úteis:
- `npx tsc --noEmit` — checagem de tipos (TypeScript em modo `strict`).
- `npx expo export --platform android` — gera o bundle JS de produção, útil para validar que tudo compila sem abrir um dispositivo.

## O que já está implementado

Todas as telas usam **dados mockados** (`src/services/mockApi.ts`) que simulam a futura API REST do backend — cada função já tem a assinatura (parâmetros e retorno) que a chamada real deveria ter, então trocar o mock por `axios`/`fetch` depois não deve exigir mudanças nas telas.

| Tela | Arquivo | Requisitos/HU cobertos |
|---|---|---|
| Login | `src/screens/auth/LoginScreen.tsx` | HU02 — validação de campos, mensagens de erro |
| Cadastro | `src/screens/auth/RegisterScreen.tsx` | HU01 — regras de senha (8+ caracteres, letra+número), confirmação de senha |
| Recuperar senha | `src/screens/auth/ForgotPasswordScreen.tsx` | HU03 |
| Feed | `src/screens/FeedScreen.tsx` | RF005/RF013, HU06 — timeline, curtidas, pull-to-refresh |
| Mapa | `src/screens/MapScreen.tsx` | RF008/RF016/RF017, HU05 — mapa com tiles OpenStreetMap, busca por nome de espécie, filtro por nível de risco |
| Novo Avistamento | `src/screens/NewSightingScreen.tsx` | RF001/RF002/RF011/RF018, HU04 — foto (câmera/galeria), GPS automático, classificação de espécie (mock) |
| Enciclopédia | `src/screens/EncyclopediaScreen.tsx` | RF014, HU07 — busca e detalhes de espécies |
| Perfil | `src/screens/ProfileScreen.tsx` | RF007/RF010, HU08 — estatísticas, ranking (gamificação), logout |

### Autenticação e navegação

- `src/context/AuthContext.tsx`: guarda o usuário logado, expõe `login`, `registrar`, `logout`, e persiste a sessão localmente com `@react-native-async-storage/async-storage`.
- `src/navigation/RootNavigator.tsx`: decide automaticamente qual navegador mostrar — `AuthNavigator` (pilha com Login/Cadastro/Recuperar senha) se não houver usuário logado, ou `MainNavigator` (abas: Feed, Mapa, Avistar, Espécies, Perfil) se houver.

### Estrutura de pastas

```
extinction-app/
├─ App.tsx                     # ponto de entrada: AuthProvider + RootNavigator
└─ src/
   ├─ types/index.ts           # modelos TS espelhando o diagrama de classes do backend
   ├─ theme/colors.ts          # paleta de cores e rótulos de status de extinção
   ├─ services/mockApi.ts      # camada de dados mockada (trocar por API real depois)
   ├─ context/AuthContext.tsx  # estado de sessão do usuário
   ├─ components/
   │  ├─ StatusBadge.tsx       # selo colorido de status de extinção (reutilizado em várias telas)
   │  └─ PostCard.tsx          # card de postagem usado no Feed
   ├─ navigation/
   │  ├─ types.ts              # tipos das rotas (stacks/tabs)
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
| `react-native-screens`, `react-native-safe-area-context` | Requeridas pelo React Navigation |
| `react-native-maps` | Mapa com tiles OpenStreetMap (`UrlTile`) |
| `expo-location` | Captura de GPS no avistamento |
| `expo-image-picker` | Câmera e galeria de fotos |
| `@react-native-async-storage/async-storage` | Persistência local da sessão |

## O que é mock e precisa ser substituído depois

Procure por comentários `TODO`/"mock" no código — os principais pontos de integração futura são:

1. **`classificarImagemMock` em `mockApi.ts`** — hoje sorteia 3 espécies aleatórias com confiança fake. Deve virar uma chamada `POST` para o endpoint do backend que aciona a classe `TFmodel` (DJL + TensorFlow, conforme a arquitetura já definida).
2. **`mockLogin` / `mockRegister` em `mockApi.ts`** — hoje aceitam qualquer credencial válida no formato. Devem virar chamadas para os endpoints de autenticação Spring Security + JWT, e o token JWT retornado deve passar a ser guardado no `AuthContext` (hoje ele guarda só os dados do usuário) e enviado no header `Authorization` das próximas chamadas.
3. **`MOCK_ESPECIES` / `MOCK_POSTAGENS` em `mockApi.ts`** — hoje são arrays fixos em memória. Devem virar respostas de `GET /especies` e `GET /postagens` (feed paginado).

## O que ainda não existe neste esqueleto

- Tela de edição/exclusão de postagem (RF012).
- Tela de detalhe de espécie a partir de um marcador do mapa (RF entre HU05/HU07 — hoje o mapa só mostra callout nativo).
- Fluxo de login social (Google/Apple), citado no Documento de Arquitetura mas não implementado aqui.
- Notificações push (Firebase Cloud Messaging).
- Ícones de verdade nas abas (hoje são emojis, só para não depender de mais uma biblioteca nesta fase).

## Contexto do projeto

Este app é o cliente do projeto acadêmico **Extinction** (plataforma de ciência cidadã para conservação da biodiversidade brasileira). O backend (Java 17 + Spring Boot + MySQL) já está definido no Documento de Arquitetura de Software da equipe; este README documenta apenas a parte mobile, criada como esqueleto inicial para acelerar o desenvolvimento do semestre.
