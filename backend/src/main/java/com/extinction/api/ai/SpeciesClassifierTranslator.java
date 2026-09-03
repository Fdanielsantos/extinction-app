package com.extinction.api.ai;

import ai.djl.modality.Classifications;
import ai.djl.modality.cv.Image;
import ai.djl.modality.cv.util.NDImageUtils;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.types.DataType;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;
import java.util.List;

/**
 * Replica exatamente o pré-processamento usado em ml/scripts/train_model.py pra
 * imagens de entrada: resize pro tamanho de treino e reescala pra [-1, 1] (equivalente a
 * keras.applications.mobilenet_v2.preprocess_input, o base model usado no treino).
 *
 * Não usa o Pipeline padrão do DJL (Resize + ToTensor) porque ToTensor() transpõe a
 * imagem pra CHW (convenção estilo PyTorch) — o SavedModel exportado pelo Keras espera
 * HWC (channels-last, convenção padrão do TensorFlow/Keras). Mantemos HWC aqui e só
 * aplicamos resize + normalização.
 */
public class SpeciesClassifierTranslator implements Translator<Image, Classifications> {

    private final int imgSize;
    private final List<String> classes;

    public SpeciesClassifierTranslator(int imgSize, List<String> classes) {
        this.imgSize = imgSize;
        this.classes = classes;
    }

    @Override
    public NDList processInput(TranslatorContext ctx, Image input) {
        NDArray array = input.toNDArray(ctx.getNDManager(), Image.Flag.COLOR);
        array = NDImageUtils.resize(array, imgSize, imgSize);
        array = array.toType(DataType.FLOAT32, false);
        array = array.div(127.5f).sub(1f);
        return new NDList(array);
    }

    @Override
    public Classifications processOutput(TranslatorContext ctx, NDList list) {
        // A última camada do modelo já é Dense(..., activation="softmax") -- a saída
        // já são probabilidades, sem precisar de softmax adicional aqui.
        NDArray probabilities = list.singletonOrThrow();
        return new Classifications(classes, probabilities);
    }

    @Override
    public Batchifier getBatchifier() {
        return Batchifier.STACK;
    }
}
