package com.extinction.api.controller;

import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.ComentarioRequest;
import com.extinction.api.dto.ComentarioResponse;
import com.extinction.api.dto.PostagemResponse;
import com.extinction.api.service.PostagemService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/postagens")
public class PostagemController {

    private final PostagemService postagemService;

    public PostagemController(PostagemService postagemService) {
        this.postagemService = postagemService;
    }

    @GetMapping
    public List<PostagemResponse> listar(@AuthenticationPrincipal Usuario usuarioLogado) {
        return postagemService.listarFeed(usuarioLogado);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostagemResponse> criar(
            @AuthenticationPrincipal Usuario usuarioLogado,
            @RequestParam("foto") MultipartFile foto,
            @RequestParam("legenda") String legenda,
            @RequestParam("especieIds") List<Long> especieIds,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude
    ) {
        PostagemResponse postagem = postagemService.criar(
                usuarioLogado, foto, legenda, especieIds, latitude, longitude);
        return ResponseEntity.status(HttpStatus.CREATED).body(postagem);
    }

    @PostMapping("/{id}/curtir")
    public PostagemResponse curtir(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado
    ) {
        return postagemService.curtir(id, usuarioLogado);
    }

    @PostMapping("/{id}/comentarios")
    public ResponseEntity<ComentarioResponse> comentar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado,
            @Valid @RequestBody ComentarioRequest request
    ) {
        ComentarioResponse comentario = postagemService.comentar(id, usuarioLogado, request.descricao());
        return ResponseEntity.status(HttpStatus.CREATED).body(comentario);
    }
}
