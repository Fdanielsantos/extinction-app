package com.extinction.api.controller;

import com.extinction.api.dto.RankingUsuarioResponse;
import com.extinction.api.service.RankingService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ranking")
public class RankingController {

    private final RankingService rankingService;

    public RankingController(RankingService rankingService) {
        this.rankingService = rankingService;
    }

    @GetMapping
    public List<RankingUsuarioResponse> listar() {
        return rankingService.listar();
    }
}
