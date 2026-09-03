package com.extinction.api.ai;

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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Implementação real de {@link SpeciesIdentificationPort} via DJL + engine TensorFlow.
 *
 * Carrega o SavedModel treinado por ml/scripts/train_model.py (transfer learning sobre
 * MobileNetV2, ~11 mil espécies do GBIF -- ver ml/README.md) a partir de {@code
 * app.ml.model-dir}. Só devolve o rótulo bruto do synset (nome científico, com
 * autoria) e a confiança -- resolver isso pro catálogo (criar/reaproveitar
 * {@code Especie}, aplicar limiar de confiança mínima) é responsabilidade de
 * {@link com.extinction.api.service.EspecieIdentificationService}, não daqui.
 */
@Component
public class TFmodel implements SpeciesIdentificationPort {

    private static final Logger log = LoggerFactory.getLogger(TFmodel.class);

    private static final int IMG_SIZE = 224;
    private static final int TOP_K = 5;

    private final Path modelDir;

    private ZooModel<Image, Classifications> model;

    public TFmodel(@Value("${app.ml.model-dir}") String modelDir) {
        this.modelDir = Path.of(modelDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void carregarModelo() throws ModelNotFoundException, MalformedModelException, IOException {
        Path savedModelDir = modelDir.resolve("saved_model");
        Path synsetPath = modelDir.resolve("synset.txt");
        List<String> synset = Files.readAllLines(synsetPath, StandardCharsets.UTF_8);

        Criteria<Image, Classifications> criteria = Criteria.builder()
                .setTypes(Image.class, Classifications.class)
                .optModelPath(savedModelDir)
                .optEngine("TensorFlow")
                .optTranslator(new SpeciesClassifierTranslator(IMG_SIZE, synset))
                .build();
        model = criteria.loadModel();
        log.info("TFmodel: SavedModel carregado de {} ({} classes)", savedModelDir, synset.size());
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

            List<PredictionResult> resultado = classifications.topK(TOP_K).stream()
                    .map(item -> new PredictionResult(
                            item.getClassName(),
                            Math.round(item.getProbability() * 10000) / 100.0))
                    .toList();

            log.debug("TFmodel: top-{} = {}", TOP_K, resultado);
            return CompletableFuture.completedFuture(resultado);
        } catch (TranslateException | IOException e) {
            log.error("TFmodel: falha ao rodar inferência", e);
            return CompletableFuture.completedFuture(List.of());
        }
    }
}
