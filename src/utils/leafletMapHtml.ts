// Mapa via WebView + Leaflet (tiles do OpenStreetMap) em vez de um componente
// de mapa nativo — decisão já tomada em HU05 de não depender de um provider
// pago/gerenciado (ex.: Google Maps), e o `react-native-webview` roda direto
// no Expo Go (sem precisar de dev client), diferente de libs de mapa nativas.
//
// A comunicação com a WebView é via `window.ReactNativeWebView.postMessage`
// (WebView → RN) e `injectJavaScript` (RN → WebView, chamando funções globais
// expostas no `window` de cada template abaixo).

const CABECALHO = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #mapa { height: 100%; width: 100%; margin: 0; padding: 0; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function enviarParaApp(mensagem) {
      window.ReactNativeWebView.postMessage(JSON.stringify(mensagem));
    }
  </script>
</body>
</html>
`;

interface CentroInicial {
  latitude: number;
  longitude: number;
  zoom?: number;
}

/**
 * Mapa somente-leitura pro Feed/Mapa: marcadores definidos depois via
 * `injectJavaScript` chamando `window.definirMarcadores([{ id, latitude, longitude, cor }])`.
 * Toque num marcador manda `{ tipo: "marcador", id }` pro RN.
 */
export function construirHtmlMapaFeed(centro: CentroInicial): string {
  return CABECALHO.replace(
    '</script>\n</body>',
    `
    var mapa = L.map('mapa', { attributionControl: true }).setView([${centro.latitude}, ${centro.longitude}], ${centro.zoom ?? 4});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapa);

    var marcadoresAtuais = [];

    window.definirMarcadores = function (lista) {
      marcadoresAtuais.forEach(function (m) { mapa.removeLayer(m); });
      marcadoresAtuais = lista.map(function (item) {
        var marcador = L.circleMarker([item.latitude, item.longitude], {
          radius: 9,
          weight: 2,
          color: '#ffffff',
          fillColor: item.cor,
          fillOpacity: 1,
        }).addTo(mapa);
        marcador.on('click', function () {
          enviarParaApp({ tipo: 'marcador', id: item.id });
        });
        return marcador;
      });
    };

    enviarParaApp({ tipo: 'pronto' });
    </script>\n</body>`,
  );
}

/**
 * Mapa interativo pro seletor de localização: um único pino, que pode ser
 * arrastado ou reposicionado tocando no mapa. Cada mudança manda
 * `{ tipo: "pino", latitude, longitude }` pro RN.
 */
export function construirHtmlMapaSeletor(centro: CentroInicial): string {
  return CABECALHO.replace(
    '</script>\n</body>',
    `
    var mapa = L.map('mapa', { attributionControl: true }).setView([${centro.latitude}, ${centro.longitude}], ${centro.zoom ?? 4});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapa);

    var pino = null;

    function posicionarPino(lat, lng) {
      if (pino) {
        pino.setLatLng([lat, lng]);
      } else {
        pino = L.marker([lat, lng], { draggable: true }).addTo(mapa);
        pino.on('dragend', function () {
          var posicao = pino.getLatLng();
          enviarParaApp({ tipo: 'pino', latitude: posicao.lat, longitude: posicao.lng });
        });
      }
    }

    window.definirPino = function (lat, lng, recentralizar) {
      posicionarPino(lat, lng);
      if (recentralizar) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 12));
    };

    mapa.on('click', function (evento) {
      posicionarPino(evento.latlng.lat, evento.latlng.lng);
      enviarParaApp({ tipo: 'pino', latitude: evento.latlng.lat, longitude: evento.latlng.lng });
    });

    enviarParaApp({ tipo: 'pronto' });
    </script>\n</body>`,
  );
}
