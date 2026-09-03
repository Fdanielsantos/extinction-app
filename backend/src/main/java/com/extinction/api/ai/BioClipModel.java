package com.extinction.api.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Implementação real de {@link SpeciesIdentificationPort} via BioCLIP 2
 * (hf-hub:imageomics/bioclip-2, https://huggingface.co/imageomics/bioclip-2), com a
 * taxonomia embutida da lib pybioclip (sem lista de espécies candidatas própria do
 * projeto -- ver ml/bioclip_service/main.py).
 *
 * Diferente do classificador TensorFlow anterior, não roda inferência dentro do
 * processo Java: delega pra um serviço Python local (ver ml/bioclip_service/main.py),
 * rodando no mesmo servidor (não no cliente/app) -- BioCLIP é um modelo CLIP (open_clip)
 * sem binding Java maduro. A URL desse serviço vem de {@code app.ml.bioclip-url}.
 */
@Component
public class BioClipModel implements SpeciesIdentificationPort {

    private static final Logger log = LoggerFactory.getLogger(BioClipModel.class);

    private final RestClient restClient;

    public BioClipModel(@Value("${app.ml.bioclip-url}") String bioclipUrl) {
        // Factory default (JDK HttpClient) manda o corpo multipart em streaming
        // (chunked) -- o serviço Python recebia a requisição sem o campo "imagem"
        // (Field required). SimpleClientHttpRequestFactory bufferiza o corpo inteiro
        // antes de mandar (Content-Length explícito), o que resolve.
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        this.restClient = RestClient.builder()
                .baseUrl(bioclipUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    @Async("inferenceExecutor")
    public CompletableFuture<List<PredictionResult>> identify(byte[] imagem) {
        try {
            MultipartBodyBuilder multipart = new MultipartBodyBuilder();
            multipart.part("imagem", new ByteArrayResource(imagem) {
                        @Override
                        public String getFilename() {
                            return "imagem.jpg";
                        }
                    })
                    .contentType(MediaType.IMAGE_JPEG);

            // Sem contentType explícito aqui: o Spring precisa gerar o Content-Type
            // sozinho (multipart/form-data; boundary=...) a partir do corpo. Forçar
            // MULTIPART_FORM_DATA manualmente sobrescreve isso e manda o header sem
            // boundary -- o servidor recebe um multipart ilegível (nenhum campo chega).
            BioClipPrediction[] predicoes = restClient.post()
                    .uri("/identificar")
                    .body(multipart.build())
                    .retrieve()
                    .body(BioClipPrediction[].class);

            List<PredictionResult> resultado = predicoes == null
                    ? List.of()
                    : Arrays.stream(predicoes)
                            .map(p -> new PredictionResult(p.nomeCientifico(), p.confiancaPercentual()))
                            .toList();

            log.debug("BioClipModel: predições = {}", resultado);
            return CompletableFuture.completedFuture(resultado);
        } catch (RestClientException e) {
            log.error("BioClipModel: falha ao chamar o serviço de inferência", e);
            return CompletableFuture.completedFuture(List.of());
        }
    }

    private record BioClipPrediction(
            @JsonProperty("nome_cientifico") String nomeCientifico,
            @JsonProperty("confianca_percentual") double confiancaPercentual) {
    }
}
