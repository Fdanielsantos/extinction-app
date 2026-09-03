package com.extinction.api.config;

import com.extinction.api.exception.ApiError;
import com.extinction.api.security.JwtAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/**",
            "/actuator/health",
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/uploads/**",
            // Sem isso, um erro real (ex.: 500) em qualquer endpoint autenticado vira um
            // 401 enganoso: o forward interno pro /error passa pelo filtro de novo, e
            // "anyRequest().authenticated()" barra esse forward antes do erro de verdade
            // chegar no cliente -- quem chama só vê "não autenticado", não a causa real.
            "/error",
            // Chat em tempo real: o handshake do WebSocket não consegue mandar o
            // header Authorization de forma confiável a partir do RN, então a
            // autenticação de verdade acontece dentro do ChatHandshakeInterceptor
            // (token via query param), não neste filtro HTTP.
            "/ws/**"
    };

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(handling -> handling
                        // Rejeições do Spring Security (token ausente/inválido/expirado, ou usuário
                        // autenticado sem permissão) não passam pelo GlobalExceptionHandler -- sem
                        // isso o cliente recebe um 401/403 com corpo vazio, e a mensagem de erro que
                        // chega no app fica genérica demais pra dar pista do que aconteceu.
                        .authenticationEntryPoint((request, response, ex) ->
                                writeApiError(response, HttpStatus.UNAUTHORIZED,
                                        "Sessão expirada ou inválida. Faça login novamente."))
                        .accessDeniedHandler((request, response, ex) ->
                                writeApiError(response, HttpStatus.FORBIDDEN,
                                        "Você não tem permissão para acessar este recurso.")))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private void writeApiError(
            jakarta.servlet.http.HttpServletResponse response, HttpStatus status, String message
    ) throws IOException {
        response.setStatus(status.value());
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiError.of(status.value(), message));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider(
            UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
