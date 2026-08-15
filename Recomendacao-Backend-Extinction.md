# Extinction — Recomendações de Backend

> Análise de engenharia sobre o Documento de Arquitetura de Software v1.0.1 e o Documento de Visão, com foco no backend: o que manter, o que reforçar, o que falta, e um panorama de bases públicas de fauna/flora para o TensorFlow.

## 1. Veredito geral

**Java 17 + Spring Boot 3.4.1 é uma escolha adequada e deve ser mantida.** Não há ganho técnico real em reescrever o backend em outra stack:

- Spring Security com `@PreAuthorize` + enum `TipoDaConta` cobre bem o RBAC (COMUM/CIENTISTA/ADMIN) exigido por RNF001 e pelas HUs de segurança.
- Spring Data JPA/Hibernate é maduro para o modelo relacional já desenhado (Usuário, Postagem, Espécie, Álbum, Comentário etc.).
- O cliente fala com o backend via REST/JWT — já não há acoplamento de linguagem com o React Native (Expo), então "unificar linguagem com JS" não traria benefício, só custo de reescrever um documento de arquitetura já aprovado.

O que precisa de atenção não é a escolha da stack, e sim **três lacunas de engenharia** que o Documento de Arquitetura ainda não resolve: onde a inferência de IA roda de fato, como o RNF008 é implementado na prática, e a ausência de testes/observabilidade. Tratamos cada uma abaixo.

## 2. Onde a IA deve rodar — o maior risco arquitetural

O documento já embute o TensorFlow dentro do próprio backend Java via DJL (classe `TFmodel`, chamada por `SpecieIdentificationService`), com o modelo treinado em Python/Colab e exportado para ser servido pelo DJL. Essa decisão é boa e deve ser mantida — a alternativa (extrair um microsserviço Python separado para servir o modelo) foi considerada e descartada aqui pelos mesmos motivos que a equipe já usou para descartar a troca de linguagem no backend: **para um time de 6 pessoas com prazo acadêmico fixo e hospedagem free-tier (Railway/Render), rodar dois runtimes/dois deploys agrega complexidade de infraestrutura desproporcional ao ganho.** DJL com engine TensorFlow carrega um `SavedModel` nativamente em Java, sem precisar de um servidor Python em produção.

Dito isso, há três pontos que o documento não resolve e que vão gerar retrabalho se não forem decididos agora:

### 2.1 Formalizar a fronteira de troca

O diagrama de pacotes já sugere a separação certa (`EspecieController` → `EspecieService` → `SpecieIdentificationService` → `TFmodel`). Recomendação: declarar isso explicitamente como uma interface —

```java
public interface SpeciesIdentificationPort {
    PredictionResult identify(byte[] imagem);
}
```

com `TFmodel`/DJL como única implementação hoje. Isso custa quase nada agora e garante que, se um dia for necessário migrar para um serviço externo (ex: por limite de RAM do free tier), a mudança fica isolada em uma classe, sem tocar controllers nem regras de negócio.

### 2.2 Resolver a inconsistência síncrono vs. assíncrono

A Seção 8 (Escalabilidade) do Documento de Arquitetura propõe processar imagens via fila assíncrona (RabbitMQ/Spring AMQP), para não travar as threads do Tomcat. Mas os diagramas de sequência modelam o fluxo como **síncrono**: o usuário tira a foto, recebe a espécie predita com a confiança, e só então confirma/edita antes de publicar (RF018 → RF019). Isso é uma contradição real, não cosmética — se a inferência virar assíncrona (fila + callback), a tela de "confirmar espécie identificada" descrita nas HUs deixa de fazer sentido como está.

Recomendação prática:
- **Manter síncrono no MVP.** O orçamento de RNF004 é de até 20s e a meta de "Publicar Avistamento com IA" no documento é ≤4,5s — há folga real para uma chamada síncrona.
- Isolar a chamada de inferência num **thread pool dedicado e limitado** (`@Async` com `ThreadPoolTaskExecutor` próprio, dimensionado por núcleos de CPU disponíveis), separado do pool de requisições HTTP do Tomcat, com resposta 429/503 quando saturado. Isso evita que picos de upload de imagem travem endpoints não relacionados (feed, mapa, login).
- **RabbitMQ vira o caminho de evolução**, não pré-requisito do dia 1: faz sentido quando o volume justificar desacoplar totalmente o processamento (ex: reprocessamento em lote, retries, múltiplos consumidores). Não é necessário para o MVP acadêmico funcionar dentro das metas já definidas.

### 2.3 Risco de memória em hospedagem free-tier

DJL + biblioteca nativa do TensorFlow + JVM têm footprint de memória não-trivial. Planos gratuitos do Railway/Render costumam limitar RAM a 512MB–1GB, o que pode não comportar JVM + modelo carregado + tráfego concorrente. Recomendação: medir o consumo real cedo (antes de depender disso para a demo/entrega) e, ao treinar o modelo, preferir arquiteturas leves como **MobileNetV3** ou **EfficientNet-Lite**, que existem justamente para cenários de inferência com recursos limitados — isso ajuda tanto o app mobile (se algum dia quiser inferência local) quanto o backend hospedado em free tier.

## 3. Persistência e geodados

MySQL (já decidido) é suficiente para a escala declarada (15.000 usuários, 5.000 conexões simultâneas no pico). O ponto de atenção é **como** os dados geográficos são modelados:

- Usar o tipo espacial nativo do MySQL 8 (`POINT`) para `Localidade`, com `SPATIAL INDEX` e consultas via `ST_Distance_Sphere`/`ST_Contains`, em vez de guardar latitude/longitude como colunas `float` soltas. Isso é o que de fato sustenta RF017 (filtrar por raio/região), RNF007 (validar coordenadas incompatíveis com a espécie) e a meta de ≤2,5s para consultas geográficas — sem índice espacial, uma tabela de avistamentos com volume relevante não bate essa meta com `WHERE lat BETWEEN ... AND lng BETWEEN ...`.
- **PostGIS/PostgreSQL** seria tecnicamente superior para geoconsultas complexas, mas não há motivo para trocar o banco já decidido — os recursos espaciais do MySQL 8 atendem a escala e as consultas descritas nos requisitos.

## 4. RNF008 (Modularidade da API de Espécies) — like RF003, mas para valer

RNF008 exige que a base científica de status de conservação (IUCN/IBAMA) seja substituível sem alterar o núcleo do código. Isso não deve significar "chamar a API externa a cada requisição do usuário" — isso violaria o SLA de 2,5s e fica refém de rate limit de terceiros.

Recomendação: um **job agendado** (`@Scheduled` ou worker separado) que sincroniza periodicamente as tabelas locais `Especie`/`StatusEspecieAtual` a partir de uma fonte externa, atrás de uma interface trocável:

```java
public interface SpeciesDataProvider {
    List<SpeciesConservationStatus> fetchUpdates();
}
```

com implementações para ICMBio/SALVE e, depois, IUCN Red List API como fallback. Isso é a aplicação concreta de RNF008 — o app sempre lê do banco local (rápido, resiliente a falhas externas), e a sincronização roda em background.

## 5. Lacunas que o Documento de Arquitetura não cobre

- **Testes**: nada é mencionado no documento atual. Recomendação: JUnit5 + Mockito para testes unitários de service/regras de negócio, e Testcontainers (MySQL + RabbitMQ) para testes de integração dos repositórios e do fluxo de mensageria, rodando em pipeline no GitHub Actions. Isso também é relevante para a avaliação acadêmica de qualidade do projeto.
- **Observabilidade**: o documento define metas de SLA bem específicas (99,5% de uptime, <1% de erro em pico, tempos de resposta por tipo de transação) mas não diz como medi-las. Sem Spring Boot Actuator (`/health`, `/metrics`) e logs estruturados, essas metas viram promessas não verificáveis na homologação. Recomendação: incluir Actuator desde o início do projeto, não como item de "produção futura".
- **Inconsistência já conhecida e não corrigida**: a Seção 7 (Visão de Implantação) do Documento de Arquitetura ainda mostra um diagrama com JBoss 6.2 + Oracle 11g, contradizendo o resto do documento (Spring Boot + MySQL + Docker). Isso já havia sido apontado no `Recomendacao-Tecnologias-Extinction.md` e continua pendente — vale corrigir antes da entrega final, é o tipo de inconsistência que salta aos olhos de quem avalia.

## 6. Panorama de bases públicas de fauna/flora para o TensorFlow

O próprio Documento de Visão já reconhece o problema central: bases de imagens rotuladas para treino de ML voltadas especificamente a espécies brasileiras são escassas, e a maioria dos datasets abertos é voltada a outras regiões. Isso muda a estratégia — não dá para tratar isso como "baixar um dataset e treinar do zero".

| Fonte | O que oferece | Cobertura Brasil | Papel no projeto |
|---|---|---|---|
| **iNaturalist / iNat Challenge datasets** (iNat2017–2021, ~2,7M imagens rotuladas) | Dataset de classificação de imagens pronto para pesquisa, licença permissiva | Boa cobertura neotropical, incluindo várias espécies da Mata Atlântica/Cerrado | **Backbone pré-treinado para transfer learning** — não treinar do zero |
| **GBIF** (Global Biodiversity Information Facility) | Maior repositório de registros de ocorrência do mundo, com mídia associada, API + download em massa | Forte no Brasil | Fonte para **localizar e coletar imagens** das espécies-alvo, filtrando por `scientificName` + país |
| **ICMBio — Portal da Biodiversidade / SALVE / Livro Vermelho da Fauna Brasileira Ameaçada de Extinção** | Lista oficial brasileira de status de conservação (não é dataset de imagens) | Nacional, é a fonte citada no próprio Documento de Visão | **Fonte de verdade para RF003/RNF008** e para delimitar a lista fechada de espécies-alvo do modelo |
| **IUCN Red List API** | Padrão global de status de conservação | Cobre espécies globalmente, inclusive as sem avaliação nacional | Segunda fonte/fallback ao lado do ICMBio no `SpeciesDataProvider` |
| **Pl@ntNet** | Dataset e API específicos de identificação de flora | Boa cobertura de flora tropical | Fonte de imagens de plantas **e** possível "fonte externa de validação" (Cenário 7.2 da HU07, já previsto no Documento de Arquitetura) |
| **Wikimedia Commons / EOL (Encyclopedia of Life)** | Imagens soltas, sem curadoria para ML | Variável | Suplementar, baixa prioridade — exige curadoria manual antes de usar |

**Estratégia recomendada**: não tentar cobrir "toda a fauna e flora brasileira" — isso não é viável no prazo acadêmico e o próprio Documento de Visão reconhece a escassez de dados. Em vez disso:

1. Definir uma **lista fechada de espécies-alvo**, a partir do Livro Vermelho/SALVE do ICMBio, com foco nos biomas já citados no Documento de Visão (Mata Atlântica, Cerrado) — algo como 30–100 espécies, não milhares.
2. Usar **transfer learning** sobre um backbone leve (MobileNetV3/EfficientNet-Lite) pré-treinado em iNaturalist ou ImageNet, afinando apenas para essa lista fechada — isso reduz drasticamente a quantidade de imagens necessária por espécie comparado a treinar do zero.
3. Curar as imagens de treino via GBIF e iNaturalist, filtrando por ocorrência no Brasil e pelas espécies da lista.
4. **Checar a licença de cada imagem** (CC0/CC-BY) antes do uso — como é uma entrega acadêmica que pode ser publicada/demonstrada, vale documentar a proveniência das imagens de treino.
5. Usar ICMBio (fonte primária) + IUCN (fallback) apenas para o **status de conservação** (RF003), nunca para as imagens — são dados de naturezas diferentes e é esse o motivo de RNF008 pedir uma interface trocável entre eles.
