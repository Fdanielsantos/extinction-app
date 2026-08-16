package com.extinction.api.service;

import com.extinction.api.domain.Seguida;
import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.UsuarioPublicoResponse;
import com.extinction.api.dto.UsuarioResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.repository.SeguidaRepository;
import com.extinction.api.repository.UsuarioRepository;
import com.extinction.api.storage.FileStorageService;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * RF: seguir outros usuários — busca de usuários e toggle de seguir/deixar
 * de seguir, no mesmo estilo do toggle de curtida em {@link PostagemService}.
 * Também cuida da edição do próprio perfil (nome, bio, foto).
 */
@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final SeguidaRepository seguidaRepository;
    private final FileStorageService fileStorageService;

    public UsuarioService(
            UsuarioRepository usuarioRepository,
            SeguidaRepository seguidaRepository,
            FileStorageService fileStorageService
    ) {
        this.usuarioRepository = usuarioRepository;
        this.seguidaRepository = seguidaRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public List<UsuarioPublicoResponse> listar(Usuario usuarioLogado) {
        return usuarioRepository.findByIdNotOrderByNomeAsc(usuarioLogado.getId()).stream()
                .map(usuario -> paraResponse(usuario, usuarioLogado))
                .toList();
    }

    @Transactional(readOnly = true)
    public UsuarioPublicoResponse obterPorId(Long id, Usuario usuarioLogado) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
        return paraResponse(usuario, usuarioLogado);
    }

    @Transactional
    public UsuarioPublicoResponse alternarSeguir(Long idSeguido, Usuario usuarioLogado) {
        if (idSeguido.equals(usuarioLogado.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não é possível seguir a si mesmo.");
        }
        Usuario seguido = usuarioRepository.findById(idSeguido)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));

        seguidaRepository.findBySeguidorIdAndSeguidoId(usuarioLogado.getId(), idSeguido)
                .ifPresentOrElse(
                        seguidaRepository::delete,
                        () -> seguidaRepository.save(Seguida.builder()
                                .seguidor(usuarioLogado)
                                .seguido(seguido)
                                .data(Instant.now())
                                .build()));

        return paraResponse(seguido, usuarioLogado);
    }

    @Transactional
    public UsuarioResponse atualizarPerfil(Usuario usuarioLogado, String nome, String bio, MultipartFile foto) {
        usuarioLogado.setNome(nome);
        usuarioLogado.setBio(bio);

        if (foto != null && !foto.isEmpty()) {
            String nomeArquivo = fileStorageService.salvar(foto);
            String fotoUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/uploads/")
                    .path(nomeArquivo)
                    .toUriString();
            usuarioLogado.setFotoUrl(fotoUrl);
        }

        return UsuarioResponse.from(usuarioRepository.save(usuarioLogado));
    }

    private UsuarioPublicoResponse paraResponse(Usuario usuario, Usuario usuarioLogado) {
        long totalSeguidores = seguidaRepository.countBySeguidoId(usuario.getId());
        long totalSeguindo = seguidaRepository.countBySeguidorId(usuario.getId());
        boolean seguindoPeloUsuario = seguidaRepository
                .existsBySeguidorIdAndSeguidoId(usuarioLogado.getId(), usuario.getId());
        return UsuarioPublicoResponse.from(usuario, totalSeguidores, totalSeguindo, seguindoPeloUsuario);
    }
}
