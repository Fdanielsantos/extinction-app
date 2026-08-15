package com.extinction.api.service;

import com.extinction.api.domain.TipoDaConta;
import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.AuthResponse;
import com.extinction.api.dto.LoginRequest;
import com.extinction.api.dto.RegisterRequest;
import com.extinction.api.dto.UsuarioResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.repository.UsuarioRepository;
import com.extinction.api.security.JwtService;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        if (usuarioRepository.existsByEmail(request.email())) {
            throw new ApiException(HttpStatus.CONFLICT, "Já existe uma conta com este e-mail.");
        }

        Usuario usuario = Usuario.builder()
                .nome(request.nome())
                .email(request.email())
                .userName(gerarUserName(request.email()))
                .senhaHash(passwordEncoder.encode(request.senha()))
                .tipoDaConta(TipoDaConta.COMUM)
                .dataCadastro(Instant.now())
                .build();

        usuario = usuarioRepository.save(usuario);

        return new AuthResponse(jwtService.generateToken(usuario), UsuarioResponse.from(usuario));
    }

    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.senha()));
        } catch (BadCredentialsException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Credenciais incorretas.");
        }

        Usuario usuario = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Credenciais incorretas."));

        return new AuthResponse(jwtService.generateToken(usuario), UsuarioResponse.from(usuario));
    }

    private String gerarUserName(String email) {
        String base = email.substring(0, email.indexOf('@'));
        String candidato = base;
        int sufixo = 1;
        while (usuarioRepository.existsByUserName(candidato)) {
            candidato = base + sufixo++;
        }
        return candidato;
    }
}
