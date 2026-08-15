package com.extinction.api.species;

import java.util.List;

/**
 * Fronteira trocável para a fonte de status de conservação (RNF008).
 * Um job agendado deve usar esta interface para sincronizar as tabelas locais
 * a partir de ICMBio/SALVE (fonte primária) e IUCN Red List (fallback) — o app
 * sempre lê do banco local, nunca chama a fonte externa no caminho de requisição
 * do usuário (ver Recomendacao-Backend-Extinction.md, seção 4).
 */
public interface SpeciesDataProvider {

    List<SpeciesConservationStatus> fetchUpdates();

    record SpeciesConservationStatus(String nomeCientifico, String statusEspecieAtual) {
    }
}
