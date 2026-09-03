package com.extinction.api.service;

import com.extinction.api.ai.SpeciesIdentificationPort;
import com.extinction.api.ai.SpeciesIdentificationPort.PredictionResult;
import com.extinction.api.domain.Especie;
import com.extinction.api.domain.StatusEspecieAtual;
import com.extinction.api.dto.EspecieResponse;
import com.extinction.api.dto.PredicaoEspecieResponse;
import com.extinction.api.repository.EspecieRepository;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * RF018: identifica candidatas de espécie a partir de uma foto. Delega a
 * inferência em si pra {@link SpeciesIdentificationPort} (modelo treinado em
 * ~11 mil espécies do GBIF, ver ml/README.md) e resolve os rótulos pro
 * catálogo de {@link Especie}, descartando previsões abaixo da confiança
 * mínima -- não existe mais "preenchimento" com espécies aleatórias: sem
 * confiança suficiente, a resposta é simplesmente vazia (espécie não
 * identificada).
 */
@Service
public class EspecieIdentificationService {

    private final SpeciesIdentificationPort speciesIdentificationPort;
    private final EspecieRepository especieRepository;
    private final double confiancaMinimaPercentual;

    public EspecieIdentificationService(
            SpeciesIdentificationPort speciesIdentificationPort,
            EspecieRepository especieRepository,
            @Value("${app.identificacao.confianca-minima}") double confiancaMinimaPercentual
    ) {
        this.speciesIdentificationPort = speciesIdentificationPort;
        this.especieRepository = especieRepository;
        this.confiancaMinimaPercentual = confiancaMinimaPercentual;
    }

    public CompletableFuture<List<PredicaoEspecieResponse>> identificar(byte[] imagem) {
        return speciesIdentificationPort.identify(imagem).thenApply(this::resolverCandidatas);
    }

    private List<PredicaoEspecieResponse> resolverCandidatas(List<PredictionResult> predicoes) {
        return predicoes.stream()
                .filter(predicao -> predicao.confiancaPercentual() >= confiancaMinimaPercentual)
                .map(predicao -> new PredicaoEspecieResponse(
                        EspecieResponse.from(resolverOuCriarEspecie(predicao.nomeCientifico())),
                        predicao.confiancaPercentual()))
                .toList();
    }

    /**
     * O modelo reconhece ~11 mil espécies do GBIF, muito além do que dá pra curar à
     * mão (descrição, habitat, status de conservação real) -- por isso a primeira vez
     * que uma espécie é identificada com confiança suficiente, ela nasce no catálogo
     * com um placeholder (nome popular = nome científico, status "não avaliado").
     * Alguém do time pode completar a curadoria depois; identificações futuras dessa
     * mesma espécie reaproveitam a linha já existente.
     */
    private Especie resolverOuCriarEspecie(String nomeCientifico) {
        return especieRepository.findByNomeCientifico(nomeCientifico)
                .orElseGet(() -> especieRepository.save(
                        Especie.builder()
                                .nomeCientifico(nomeCientifico)
                                .nomePopular(nomeCientifico)
                                .statusEspecieAtual(StatusEspecieAtual.NAO_AVALIADO)
                                .build()));
    }
}
