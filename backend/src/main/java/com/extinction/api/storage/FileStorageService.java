package com.extinction.api.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FileStorageService {

    private final Path uploadDir;

    public FileStorageService(@Value("${app.upload-dir:uploads}") String uploadDirProperty) {
        this.uploadDir = Paths.get(uploadDirProperty).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível criar o diretório de uploads: " + uploadDir, e);
        }
    }

    /** Salva o arquivo com um nome único e devolve apenas o nome (sem caminho). */
    public String salvar(MultipartFile arquivo) {
        String nomeArquivo = UUID.randomUUID() + extrairExtensao(arquivo.getOriginalFilename());
        try {
            arquivo.transferTo(uploadDir.resolve(nomeArquivo));
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao salvar o arquivo enviado.", e);
        }
        return nomeArquivo;
    }

    private String extrairExtensao(String nomeOriginal) {
        if (nomeOriginal == null) return "";
        int idx = nomeOriginal.lastIndexOf('.');
        return idx >= 0 ? nomeOriginal.substring(idx) : "";
    }
}
