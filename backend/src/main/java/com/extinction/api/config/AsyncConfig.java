package com.extinction.api.config;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Pool dedicado pra inferência de imagem (RF018), isolado das threads do Tomcat —
 * ver Recomendacao-Backend-Extinction.md, seção 2.2.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "inferenceExecutor")
    public Executor inferenceExecutor() {
        int nucleos = Runtime.getRuntime().availableProcessors();
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(Math.max(1, nucleos / 2));
        executor.setMaxPoolSize(nucleos);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("inference-");
        executor.initialize();
        return executor;
    }
}
