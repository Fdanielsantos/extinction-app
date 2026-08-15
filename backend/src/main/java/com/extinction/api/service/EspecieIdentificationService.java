package com.extinction.api.service;

import com.extinction.api.ai.SpeciesIdentificationPort;
import com.extinction.api.ai.SpeciesIdentificationPort.PredictionResult;
import com.extinction.api.domain.Especie;
import com.extinction.api.dto.EspecieResponse;
import com.extinction.api.dto.PredicaoEspecieResponse;
import com.extinction.api.repository.EspecieRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.springframework.stereotype.Service;

/**
 * RF018: identifica candidatas de espécie a partir de uma foto. Delega a
 * inferência em si pra {@link SpeciesIdentificationPort} e resolve os
 * resultados pro catálogo real de {@link Especie}.
 */
@Service
public class EspecieIdentificationService {

    private static final double CONFIANCA_PADRAO_SEM_DETECCAO = 15.0;
    private static final int TOTAL_CANDIDATAS = 3;

    private final SpeciesIdentificationPort speciesIdentificationPort;
    private final EspecieRepository especieRepository;

    public EspecieIdentificationService(
            SpeciesIdentificationPort speciesIdentificationPort,
            EspecieRepository especieRepository
    ) {
        this.speciesIdentificationPort = speciesIdentificationPort;
        this.especieRepository = especieRepository;
    }

    public CompletableFuture<List<PredicaoEspecieResponse>> identificar(byte[] imagem) {
        return speciesIdentificationPort.identify(imagem).thenApply(this::resolverCandidatas);
    }

    private List<PredicaoEspecieResponse> resolverCandidatas(List<PredictionResult> predicoes) {
        List<Especie> catalogo = especieRepository.findAll();
        List<PredicaoEspecieResponse> candidatas = new ArrayList<>();

        for (PredictionResult predicao : predicoes) {
            especieRepository.findByNomeCientifico(predicao.nomeCientifico())
                    .ifPresent(especie -> candidatas.add(
                            new PredicaoEspecieResponse(EspecieResponse.from(especie), predicao.confiancaPercentual())));
        }

        // Sem candidatas reais suficientes (rótulo do modelo não bateu com o catálogo),
        // completa com outras espécies em confiança baixa fixa — a tela sempre tem opções.
        for (Especie especie : catalogo) {
            if (candidatas.size() >= TOTAL_CANDIDATAS) break;
            boolean jaIncluida = candidatas.stream()
                    .anyMatch(c -> c.especie().id().equals(especie.getId()));
            if (!jaIncluida) {
                candidatas.add(new PredicaoEspecieResponse(EspecieResponse.from(especie), CONFIANCA_PADRAO_SEM_DETECCAO));
            }
        }

        return candidatas.stream()
                .sorted(Comparator.comparingDouble(PredicaoEspecieResponse::confiancaPercentual).reversed())
                .limit(TOTAL_CANDIDATAS)
                .toList();
    }
}
