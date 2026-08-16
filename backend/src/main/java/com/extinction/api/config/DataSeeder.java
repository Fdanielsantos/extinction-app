package com.extinction.api.config;

import com.extinction.api.domain.Especie;
import com.extinction.api.domain.StatusEspecieAtual;
import com.extinction.api.domain.TipoDaConta;
import com.extinction.api.domain.Usuario;
import com.extinction.api.repository.EspecieRepository;
import com.extinction.api.repository.UsuarioRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Popula o banco com usuários de teste e o catálogo de espécies numa base
 * vazia — o suficiente pra logar e testar sem precisar cadastrar tudo na mão.
 * Não semeia postagens/comentários/curtidas: esses dados nascem do uso real
 * do app (RF011/HU04) à medida que os testes acontecem.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final String SENHA_SEED = "extinction123";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final EspecieRepository especieRepository;

    public DataSeeder(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            EspecieRepository especieRepository
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.especieRepository = especieRepository;
    }

    @Override
    public void run(String... args) {
        if (usuarioRepository.count() == 0) {
            Usuario flavio = criarUsuario("Flávio Santos", "flavio.santos@extinction.dev", "flavio.santos");
            Usuario ana = criarUsuario("Ana Bióloga", "ana.biologa@extinction.dev", "ana.biologa");
            Usuario guilherme = criarUsuario("Guilherme Alves", "guilherme.alves@extinction.dev", "guilherme.alves");
            usuarioRepository.saveAll(List.of(flavio, ana, guilherme));
        }

        if (especieRepository.count() == 0) {
            Especie micoLeaoDourado = especie(
                    "Leontopithecus rosalia", "Mico-leão-dourado",
                    "Pequeno primata de pelagem dourada, símbolo da conservação da Mata Atlântica.",
                    "Mata Atlântica (RJ)", "Mata Atlântica", StatusEspecieAtual.EM_PERIGO);
            Especie loboGuara = especie(
                    "Chrysocyon brachyurus", "Lobo-guará",
                    "Maior canídeo da América do Sul, típico do Cerrado brasileiro.",
                    "Cerrado", "Cerrado", StatusEspecieAtual.QUASE_AMEACADA);
            Especie araucaria = especie(
                    "Araucaria angustifolia", "Araucária",
                    "Conífera nativa da Mata Atlântica, também chamada de pinheiro-do-paraná.",
                    "Mata Atlântica (Sul)", "Mata Atlântica", StatusEspecieAtual.CRIATICAMENTE_EM_PERIGO);
            Especie oncaPintada = especie(
                    "Panthera onca", "Onça-pintada",
                    "Maior felino das Américas, topo da cadeia alimentar em vários biomas.",
                    "Amazônia, Pantanal, Cerrado", "Amazônia", StatusEspecieAtual.VULNERAVEL);
            Especie araraAzulDeLear = especie(
                    "Anodorhynchus leari", "Arara-azul-de-lear",
                    "Ave endêmica da Bahia, com população historicamente muito reduzida.",
                    "Caatinga (BA)", "Caatinga", StatusEspecieAtual.EM_PERIGO);
            especieRepository.saveAll(List.of(micoLeaoDourado, loboGuara, araucaria, oncaPintada, araraAzulDeLear));
        }
    }

    private Usuario criarUsuario(String nome, String email, String userName) {
        return Usuario.builder()
                .nome(nome)
                .email(email)
                .userName(userName)
                .senhaHash(passwordEncoder.encode(SENHA_SEED))
                .tipoDaConta(TipoDaConta.COMUM)
                .dataCadastro(Instant.now())
                .build();
    }

    private Especie especie(
            String nomeCientifico, String nomePopular, String descricao, String habitat, String regiao,
            StatusEspecieAtual status
    ) {
        return Especie.builder()
                .nomeCientifico(nomeCientifico)
                .nomePopular(nomePopular)
                .descricao(descricao)
                .habitat(habitat)
                .regiao(regiao)
                .statusEspecieAtual(status)
                .build();
    }
}
