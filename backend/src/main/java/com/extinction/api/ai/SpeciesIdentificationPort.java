package com.extinction.api.ai;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Fronteira entre a aplicação e o motor de inferência de imagens (RF018).
 * Implementação real em {@link TFmodel} (DJL + TensorFlow). Isolar a troca aqui
 * evita acoplar controllers/regras de negócio ao motor de ML escolhido
 * (ver Recomendacao-Backend-Extinction.md, seção 2.1). Assíncrona (seção 2.2 da
 * recomendação): a inferência roda num thread pool dedicado, não nas threads do Tomcat.
 */
public interface SpeciesIdentificationPort {

    CompletableFuture<List<PredictionResult>> identify(byte[] imagem);

    record PredictionResult(String nomeCientifico, double confiancaPercentual) {
    }
}
