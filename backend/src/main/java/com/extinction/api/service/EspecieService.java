package com.extinction.api.service;

import com.extinction.api.dto.EspecieResponse;
import com.extinction.api.repository.EspecieRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class EspecieService {

    private final EspecieRepository especieRepository;

    public EspecieService(EspecieRepository especieRepository) {
        this.especieRepository = especieRepository;
    }

    public List<EspecieResponse> listar() {
        return especieRepository.findAll().stream().map(EspecieResponse::from).toList();
    }
}
