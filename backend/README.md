# extinction-api

Backend REST do projeto Extinction (TCC). Java 17 + Spring Boot 3.4.1 + MySQL 8, conforme
`../Recomendacao-Backend-Extinction.md`.

**Status:** conectado de ponta a ponta com o app Expo (`../src/services/api.ts`) — não há mais
dados mockados no frontend, exceto recuperação de senha (sem infra de e-mail ainda).

## Rodando localmente

Via Docker Compose (recomendado — sobe MySQL + API juntos):

```bash
cd backend
docker-compose up --build -d
```

A API sobe em `http://localhost:8080`. Swagger UI em `http://localhost:8080/swagger-ui/index.html`.
Healthcheck em `http://localhost:8080/actuator/health`.

Alternativa (API fora do Docker, mais rápida pra iterar em código Java):

```bash
docker-compose up -d mysql
mvn spring-boot:run
```

**Primeira subida é mais lenta** (30–55s): além do MySQL, o `TFmodel` (ver seção de IA abaixo)
baixa a lib nativa do TensorFlow (~200MB) e um modelo pré-treinado na primeira inicialização,
cacheados depois em `~/.djl.ai` (via Docker, isso fica no volume `djl_cache_data`, então só
acontece uma vez por ambiente).

### Porta do MySQL

O `docker-compose.yml` expõe o MySQL do projeto na porta **3307** do host (não 3306) —
em máquinas com um MySQL local já instalado como serviço do Windows, a 3306 costuma estar
ocupada. Isso não afeta a comunicação entre os containers (a API fala com `mysql:3306`
internamente, só o mapeamento externo mudou).

## Variáveis de ambiente

| Variável | Default (dev) | Descrição |
|---|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/extinction...` | JDBC URL do MySQL |
| `DB_USER` | `extinction` | Usuário do banco |
| `DB_PASSWORD` | `extinction` | Senha do banco |
| `JWT_SECRET` | valor de dev embutido | Chave HMAC para assinar os JWT — **trocar em qualquer ambiente real** |
| `JWT_EXPIRATION_MS` | `86400000` (24h) | Validade do token |
| `SERVER_PORT` | `8080` | Porta HTTP |
| `UPLOAD_DIR` | `uploads` | Pasta onde as fotos de avistamento enviadas são salvas |

## Usuários de teste (seed)

`DataSeeder` (`config/DataSeeder.java`) popula usuários e o catálogo de espécies numa base
vazia — não semeia postagens (essas nascem do uso real do app). Login com qualquer um destes
(senha `extinction123` pra todos):

- `flavio.santos@extinction.dev`
- `ana.biologa@extinction.dev`
- `guilherme.alves@extinction.dev`

## Endpoints disponíveis

Autenticação (públicos):
- `POST /api/auth/register` — `{ nome, email, senha }` → `201` com `{ token, usuario }`
- `POST /api/auth/login` — `{ email, senha }` → `200` com `{ token, usuario }`

Protegidos por JWT (`Authorization: Bearer <token>`):
- `GET /api/especies` — catálogo de espécies
- `POST /api/especies/inferencia` — multipart (`foto`) → até 3 candidatas de espécie com
  confiança, via DJL/TensorFlow (ver seção de IA)
- `GET /api/postagens` — feed, mais recentes primeiro
- `POST /api/postagens` — multipart (`foto`, `legenda`, `especieIds`, `latitude`/`longitude`
  opcionais) → cria um avistamento
- `POST /api/postagens/{id}/curtir` — toggle de curtida do usuário logado
- `POST /api/postagens/{id}/comentarios` — `{ descricao }` → adiciona comentário
- `GET /api/ranking` — total de avistamentos por usuário, desc

Públicos (auxiliares):
- `GET /actuator/health` — healthcheck
- `GET /uploads/{arquivo}` — fotos enviadas (estático)
- `/swagger-ui/**`, `/v3/api-docs/**` — documentação OpenAPI

## Upload de fotos

Fotos de avistamento são enviadas via multipart, salvas em disco (`FileStorageService`, pasta
`UPLOAD_DIR`) com nome único (`UUID`), e servidas de volta como arquivo estático em
`/uploads/{arquivo}` — a URL completa é montada a partir do host que o cliente usou de fato
(funciona tanto em `localhost` quanto no IP de LAN do celular rodando o Expo Go). No Docker,
a pasta de upload é persistida no volume `uploads_data`. Limite de tamanho: 10MB
(`spring.servlet.multipart.max-file-size`).

## Reconhecimento de imagem (RF018) — DJL + TensorFlow

`ai/TFmodel.java` implementa `SpeciesIdentificationPort` usando **DJL com engine TensorFlow**,
conforme a seção 2 da recomendação de backend. Hoje carrega um **ResNet50 genérico pré-treinado
no ImageNet** (resolvido automaticamente pelo model zoo do próprio DJL, sem precisar hospedar
nenhum arquivo de modelo manualmente).

**Isso não é um modelo treinado nas espécies do catálogo** — treinar isso de verdade exige
curadoria de dataset (GBIF/iNaturalist) + treino em Python (local, ver `ml/scripts/train_model.py`), fora do escopo do que dá pra
fazer direto no backend Java (ver seção 6 da recomendação). Por isso, hoje só 3 rótulos do
ImageNet têm mapeamento pro catálogo (`ROTULOS_IMAGENET` em `TFmodel.java`):

| Rótulo ImageNet | Espécie do catálogo |
|---|---|
| "jaguar" | Onça-pintada |
| "maned wolf" | Lobo-guará |
| "macaw" | Arara-azul-de-lear |

Mico-leão-dourado e Araucária não têm classe equivalente no ImageNet-1k — só aparecem como
preenchimento de baixa confiança fixa (a tela de "Novo avistamento" sempre mostra 3 opções pra
escolher, mesmo sem detecção real).

**Quando houver um modelo treinado de verdade** (SavedModel exportado por `ml/scripts/train_model.py`): a troca é
isolada dentro de `TFmodel.java` — carregar esse modelo em vez do ResNet50 do zoo, e ajustar
`ROTULOS_IMAGENET` (ou a lógica de mapeamento, se as classes do modelo já baterem 1:1 com o
catálogo). Nada em `EspecieController`, `EspecieIdentificationService` ou no frontend precisa
mudar — essa é a fronteira que `SpeciesIdentificationPort` foi desenhada pra garantir.

A inferência roda num thread pool dedicado (`config/AsyncConfig.java`, bean
`inferenceExecutor`), isolado das threads de request do Tomcat (seção 2.2 da recomendação).

> **Nota de implementação:** o controller aguarda o resultado desse pool de forma bloqueante
> (`.join()`) em vez de devolver `CompletableFuture` direto pro Spring MVC — testado e
> descartado porque o dispatch assíncrono do Spring MVC colidia com o Spring Security nessa
> versão (toda chamada voltava `403` sem nem chegar no controller). O ganho de isolar a
> computação pesada do pool do Tomcat continua valendo; só não libera a thread do Tomcat
> enquanto espera.

## Estrutura de pacotes

```
com.extinction.api
  config/      SecurityConfig, AsyncConfig (pool de inferência), StaticResourceConfig (/uploads),
               DataSeeder (usuários/espécies de teste)
  security/    JWT (geração/validação/filtro)
  domain/      Usuario, Especie, Postagem, Comentario, Localidade (@Embeddable), enums
  dto/         request/response da API (records)
  repository/  Spring Data JPA
  service/     regras de negócio (Auth, Postagem, Especie, EspecieIdentification, Ranking)
  controller/  endpoints REST
  exception/   tratamento de erro centralizado
  storage/     FileStorageService (upload de fotos em disco)
  ai/          SpeciesIdentificationPort + TFmodel (DJL/TensorFlow, ver seção acima)
  species/     fronteira para a fonte de status de conservação (RNF008) — ainda sem implementação
```

## O que ainda não existe (próximas etapas)

- Modelo de IA treinado nas espécies reais do catálogo (ver seção de IA acima).
- `Perfil`/`Selo` como entidades próprias — hoje `Postagem`/`Comentario` referenciam `Usuario`
  diretamente; autor/estatísticas são derivados disso.
- Criação de comentários pela UI usa o endpoint acima; não há edição/exclusão de
  comentário/postagem (RF012) ainda.
- Implementação real de `SpeciesDataProvider` (sincronização agendada com ICMBio/SALVE e IUCN
  Red List) — RNF008 continua sem fonte externa de verdade, só o catálogo local via seed.
- Recuperação de senha por e-mail (segue mockada no frontend, sem infra de e-mail no backend).
- `Localidade` como tipo espacial (`POINT` + índice espacial do MySQL 8) — hoje é
  latitude/longitude simples embutidos em `Postagem`.
- RabbitMQ (caminho de evolução, não pré-requisito do MVP — ver seção 2.2 da recomendação).
- Migrações versionadas (Flyway) — hoje o schema é gerado via `ddl-auto=update`.

## Testes

```bash
mvn test
```

`ExtinctionApiApplicationTests` e `AuthControllerIT` usam Testcontainers e precisam de Docker
disponível na máquina/CI. No Windows com Docker Desktop, se aparecer `BadRequestException`
vazia ao rodar os testes, veja a nota abaixo.

### Nota Windows: Docker Desktop 4.86+ e Testcontainers

Docker Desktop recentes elevaram a API mínima do engine pra 1.44; o cliente `docker-java`
embutido no Testcontainers 1.20.4 negocia uma versão mais antiga, que o daemon rejeita com
HTTP 400 — aparece como uma `BadRequestException` com corpo JSON vazio, igual não importa o
transporte (named pipe ou TCP). Corrigido fixando a versão da API em
`src/test/resources/docker-java.properties` (`api.version=1.44`). Se voltar a acontecer depois
de um upgrade do Docker Desktop, é isso — conferir se a versão fixada ainda é ≤ à API atual do
daemon (`docker info` ou `curl http://localhost:2375/version` com o daemon exposto).
