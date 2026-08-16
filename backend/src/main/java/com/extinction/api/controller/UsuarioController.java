package com.extinction.api.controller;

import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.UsuarioPublicoResponse;
import com.extinction.api.dto.UsuarioResponse;
import com.extinction.api.service.UsuarioService;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @GetMapping
    public List<UsuarioPublicoResponse> listar(@AuthenticationPrincipal Usuario usuarioLogado) {
        return usuarioService.listar(usuarioLogado);
    }

    @GetMapping("/{id}")
    public UsuarioPublicoResponse obterPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado
    ) {
        return usuarioService.obterPorId(id, usuarioLogado);
    }

    @PostMapping("/{id}/seguir")
    public UsuarioPublicoResponse seguir(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado
    ) {
        return usuarioService.alternarSeguir(id, usuarioLogado);
    }

    @PutMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UsuarioResponse atualizarPerfil(
            @AuthenticationPrincipal Usuario usuarioLogado,
            @RequestParam("nome") String nome,
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "foto", required = false) MultipartFile foto
    ) {
        return usuarioService.atualizarPerfil(usuarioLogado, nome, bio, foto);
    }
}
