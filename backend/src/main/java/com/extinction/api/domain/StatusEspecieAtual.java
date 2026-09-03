package com.extinction.api.domain;

public enum StatusEspecieAtual {
    // Status placeholder para espécies criadas automaticamente a partir do
    // reconhecimento de imagem (RF018): o modelo treina em ~11 mil espécies do
    // GBIF, mas não há curadoria manual (descrição/habitat/status de conservação
    // real) pra quase nenhuma delas — só pras que alguém no time completar depois.
    NAO_AVALIADO,
    POUCO_PREOCUPANTE,
    QUASE_AMEACADA,
    VULNERAVEL,
    EM_PERIGO,
    CRIATICAMENTE_EM_PERIGO,
    EXTINTA_NA_NATUREZA,
    EXTINTA
}
