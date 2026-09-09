package com.extinction.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.extinction.api.domain.Especie;
import com.extinction.api.domain.Postagem;
import com.extinction.api.domain.StatusEspecieAtual;
import com.extinction.api.domain.TipoDaConta;
import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.PostagemResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.repository.ComentarioRepository;
import com.extinction.api.repository.EspecieRepository;
import com.extinction.api.repository.PostagemRepository;
import com.extinction.api.storage.FileStorageService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.multipart.MultipartFile;

/**
 * Cobre a regra revisada de RN-004: quando o BioCLIP não retorna nenhuma
 * espécie candidata acima do limiar de confiança, o usuário pode publicar
 * mesmo assim, digitando sua própria sugestão em texto livre (RF: sugestão de
 * espécie pelo usuário) -- em vez de ficar bloqueado sem conseguir publicar.
 */
@ExtendWith(MockitoExtension.class)
class PostagemServiceTest {

    @Mock
    private PostagemRepository postagemRepository;
    @Mock
    private EspecieRepository especieRepository;
    @Mock
    private ComentarioRepository comentarioRepository;
    @Mock
    private FileStorageService fileStorageService;

    @InjectMocks
    private PostagemService postagemService;

    private Usuario usuario;
    private MultipartFile foto;

    @BeforeEach
    void setUp() {
        usuario = Usuario.builder()
                .id(1L)
                .nome("Flávio")
                .email("flavio@extinction.dev")
                .userName("flavio")
                .senhaHash("hash")
                .tipoDaConta(TipoDaConta.COMUM)
                .dataCadastro(Instant.now())
                .build();
        foto = new MockMultipartFile("fotos", "foto.jpg", "image/jpeg", new byte[] {1, 2, 3});

        // salvarESerializarUrl() usa ServletUriComponentsBuilder.fromCurrentContextPath(),
        // que exige uma requisição HTTP "atual" registrada na thread -- sem isso o teste
        // quebra com "No current ServletRequestAttributes" mesmo fora de um contexto web real.
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void semEspecieENemSugestao_lancaExcecao() {
        // Lista de IDs vazia curto-circuita antes de bater no repositório
        // (ver PostagemService.criar) -- nenhum stub de findAllById necessário aqui.
        assertThatThrownBy(() -> postagemService.criar(
                usuario, List.of(foto), "legenda", List.of(), null, null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Selecione uma espécie identificada ou informe sua sugestão");
    }

    @Test
    void semEspecieComSugestaoEmBranco_lancaExcecao() {
        assertThatThrownBy(() -> postagemService.criar(
                usuario, List.of(foto), "legenda", null, "   ", null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Selecione uma espécie identificada ou informe sua sugestão");
    }

    @Test
    void semEspecieComSugestaoValida_criaPostagemComSugestaoEIdentificacaoPendente() {
        when(fileStorageService.salvar(any(MultipartFile.class))).thenReturn("uuid.jpg");
        when(postagemRepository.save(any(Postagem.class))).thenAnswer(inv -> {
            Postagem p = inv.getArgument(0);
            p.setId(10L);
            return p;
        });

        PostagemResponse resposta = postagemService.criar(
                usuario, List.of(foto), "legenda", null, "  Lobo-guará  ", -15.7, -47.9, null, null);

        assertThat(resposta.especies()).isEmpty();
        assertThat(resposta.sugestaoEspecieUsuario()).isEqualTo("Lobo-guará");
        assertThat(resposta.identificacaoPendente()).isTrue();
    }

    @Test
    void comEspecieConfirmada_ignoraSugestaoEmTextoRecebidaJunto() {
        Especie especie = Especie.builder()
                .id(5L)
                .nomeCientifico("Chrysocyon brachyurus")
                .nomePopular("Lobo-guará")
                .statusEspecieAtual(StatusEspecieAtual.VULNERAVEL)
                .build();
        when(especieRepository.findAllById(List.of(5L))).thenReturn(List.of(especie));
        when(fileStorageService.salvar(any(MultipartFile.class))).thenReturn("uuid.jpg");
        when(postagemRepository.save(any(Postagem.class))).thenAnswer(inv -> {
            Postagem p = inv.getArgument(0);
            p.setId(11L);
            return p;
        });

        // Sugestão de texto enviada "por engano" junto de uma espécie já confirmada
        // -- a confirmada tem prioridade e a sugestão deve ser descartada.
        PostagemResponse resposta = postagemService.criar(
                usuario, List.of(foto), "legenda", List.of(5L), "Espécie qualquer", null, null, null, null);

        assertThat(resposta.especies()).hasSize(1);
        assertThat(resposta.sugestaoEspecieUsuario()).isNull();
        assertThat(resposta.identificacaoPendente()).isFalse();
    }

    @Test
    void sugestaoAcimaDoLimiteDeCaracteres_lancaExcecao() {
        String sugestaoMuitoLonga = "a".repeat(151);

        assertThatThrownBy(() -> postagemService.criar(
                usuario, List.of(foto), "legenda", null, sugestaoMuitoLonga, null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no máximo 150 caracteres");
    }

    @Test
    void semFotos_lancaExcecao() {
        assertThatThrownBy(() -> postagemService.criar(
                usuario, List.of(), "legenda", null, "Lobo-guará", null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Envie ao menos uma foto");
    }
}
