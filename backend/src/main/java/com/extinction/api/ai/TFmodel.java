package com.extinction.api.ai;

import ai.djl.Application;
import ai.djl.MalformedModelException;
import ai.djl.inference.Predictor;
import ai.djl.modality.Classifications;
import ai.djl.modality.cv.Image;
import ai.djl.modality.cv.ImageFactory;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.translate.TranslateException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Implementação real de {@link SpeciesIdentificationPort} via DJL + engine TensorFlow.
 *
 * Hoje carrega um classificador genérico pré-treinado no ImageNet (via model zoo do
 * próprio DJL) — não há ainda um modelo treinado nas espécies brasileiras do catálogo
 * (isso depende de curadoria de dataset + treino em Python/Colab, fora deste ambiente,
 * ver Recomendacao-Backend-Extinction.md seção 6). Os rótulos do ImageNet que têm
 * correspondência plausível com o catálogo são mapeados em {@link #ROTULOS_IMAGENET};
 * o resto é descartado. Quando o time treinar um modelo de verdade, a troca é só aqui
 * dentro — nada em controller/service/frontend depende de como a inferência é feita.
 */
@Component
public class TFmodel implements SpeciesIdentificationPort {

    private static final Logger log = LoggerFactory.getLogger(TFmodel.class);

    /** Rótulo do ImageNet (substring, case-insensitive) → nomeCientifico no nosso catálogo. */
    private static final Map<String, String> ROTULOS_IMAGENET = Map.of(
            "jaguar", "Panthera onca",
            "maned wolf", "Chrysocyon brachyurus",
            "macaw", "Anodorhynchus leari"
    );

    private ZooModel<Image, Classifications> model;

    @PostConstruct
    public void carregarModelo() throws ModelNotFoundException, MalformedModelException, IOException {
        Criteria<Image, Classifications> criteria = Criteria.builder()
                .optApplication(Application.CV.IMAGE_CLASSIFICATION)
                .setTypes(Image.class, Classifications.class)
                .optFilter("dataset", "imagenet")
                .optEngine("TensorFlow")
                .build();
        model = criteria.loadModel();
        log.info("TFmodel: modelo de classificação de imagem carregado ({})", model.getName());
    }

    @PreDestroy
    public void fecharModelo() {
        if (model != null) {
            model.close();
        }
    }

    @Override
    @Async("inferenceExecutor")
    public CompletableFuture<List<PredictionResult>> identify(byte[] imagem) {
        try (Predictor<Image, Classifications> predictor = model.newPredictor()) {
            Image image = ImageFactory.getInstance().fromInputStream(new ByteArrayInputStream(imagem));
            Classifications classifications = predictor.predict(image);

            List<PredictionResult> resultado = classifications.topK(5).stream()
                    .map(item -> {
                        String nomeCientifico = mapearParaCatalogo(item.getClassName());
                        double confianca = Math.round(item.getProbability() * 10000) / 100.0;
                        return nomeCientifico != null ? new PredictionResult(nomeCientifico, confianca) : null;
                    })
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toList());

            log.debug("TFmodel: top-5 bruto do ImageNet = {}", classifications.topK(5));
            return CompletableFuture.completedFuture(resultado);
        } catch (TranslateException | IOException e) {
            log.error("TFmodel: falha ao rodar inferência", e);
            return CompletableFuture.completedFuture(List.of());
        }
    }

    private String mapearParaCatalogo(String rotuloImagenet) {
        String rotulo = rotuloImagenet.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> entry : ROTULOS_IMAGENET.entrySet()) {
            if (rotulo.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }
}
