package com.extinction.api.controller;

import com.extinction.api.dto.EspecieResponse;
import com.extinction.api.dto.PredicaoEspecieResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.service.EspecieIdentificationService;
import com.extinction.api.service.EspecieService;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.CompletionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/especies")
public class EspecieController {

    private final EspecieService especieService;
    private final EspecieIdentificationService especieIdentificationService;

    public EspecieController(
            EspecieService especieService,
            EspecieIdentificationService especieIdentificationService
    ) {
        this.especieService = especieService;
        this.especieIdentificationService = especieIdentificationService;
    }

    @GetMapping
    public List<EspecieResponse> listar() {
        return especieService.listar();
    }

    @PostMapping(value = "/inferencia", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<PredicaoEspecieResponse> inferencia(@RequestParam("foto") MultipartFile foto) {
        try {
            // .join() bloqueia esta thread do Tomcat até a inferência terminar, mas o
            // trabalho pesado em si roda isolado no pool "inferenceExecutor" (seção 2.2
            // da recomendação) — não compete com as threads livres pra outras requisições.
            return especieIdentificationService.identificar(foto.getBytes()).join();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não foi possível ler a imagem enviada.");
        } catch (CompletionException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao identificar a espécie na imagem.");
        }
    }
}
