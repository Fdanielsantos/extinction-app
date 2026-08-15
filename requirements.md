# Requisitos de instalação — extinction-app

Este projeto não usa Python, então não há `requirements.txt`. Este arquivo lista o que precisa
estar instalado na máquina para rodar o frontend (Expo) e o backend (Spring Boot).

## Obrigatório em qualquer cenário

| Ferramenta | Versão | Uso |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (com Docker Compose) | recente | Sobe MySQL (+ opcionalmente o backend inteiro) |
| [Node.js](https://nodejs.org/) + npm | LTS atual (20+) | Roda o app Expo (frontend) |

## Necessário apenas se for rodar o backend fora do Docker

Use isso se quiser rodar `mvn spring-boot:run` local em vez de `docker-compose up --build`
(mais rápido pra iterar em código Java).

| Ferramenta | Versão | Uso |
|---|---|---|
| JDK (Java) | **17** (fixado em `backend/pom.xml`) | Compilar/rodar o backend |
| Maven | recente | Não há `mvnw` no projeto — precisa do `mvn` no PATH |

Mesmo rodando o backend local, o **Docker continua necessário** para:
- subir o MySQL (`docker-compose up -d mysql`)
- rodar `mvn test` (usa Testcontainers)

## Necessário para testar o app em dispositivo/emulador

Escolha conforme o alvo de teste:

| Alvo | Ferramenta |
|---|---|
| Celular físico | App **Expo Go** instalado (Android/iOS) |
| Emulador Android | **Android Studio** com SDK/emulador configurado |
| Simulador iOS | **Xcode** (somente macOS) |

## Não é necessário

- Nenhuma chave de API externa
- Nenhum banco de dados gerenciado / conta de nuvem
- `expo-cli` global (o projeto usa o Expo local via `npm start`)

## Resumo por cenário

| Cenário | Instalar |
|---|---|
| Backend 100% via Docker + frontend | Docker Desktop, Node.js + npm |
| Backend local (fora do Docker) | Docker Desktop, JDK 17, Maven, Node.js + npm |
| + testar no celular | Expo Go |
| + testar em emulador Android | Android Studio |
| + testar em simulador iOS | Xcode (macOS) |

## Nota Windows

Docker Desktop 4.86+ eleva a versão mínima da API do engine, o que quebra o Testcontainers em
`mvn test` com `BadRequestException` vazia. Já corrigido em
`backend/src/test/resources/docker-java.properties` (`api.version=1.44`). Ver
`backend/README.md` para detalhes se o problema voltar após um upgrade do Docker Desktop.
