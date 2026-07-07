# boxdgrid

Gere colagens personalizadas dos filmes que voce assistiu no Letterboxd. Escolha periodo, tamanho do grid, agrupe por diretor e baixe como PNG ou JPG.

## Funcionalidades

- Importa seu diario do Letterboxd via RSS publico
- Filtro por periodo: 7 dias, 30 dias, 3 meses, 6 meses, 1 ano ou todo historico
- Agrupamento por filme ou diretor(a)
- Grid de 2x2 ate 10x10
- badges de Nota, Like, Resenha e Reviu nos posters
- Download como PNG ou JPG
- Copiar imagem para area de transferencia
- Compartilhar via Web Share API
- Overlay com titulo, ano e diretor ao passar o mouse

## Tecnologias

- **Server**: Bun (HTTP server), TypeScript
- **Frontend**: HTML, CSS, JavaScript puro (sem frameworks)
- **Deploy**: Docker, nginx
- **Cache**: Em memoria (texto e binario)
- **API**: Letterboxd RSS, TMDb API

## Desenvolvimento

### Pre-requisitos

- Bun instalado (`curl -fsSL https://bun.sh/install | bash`)
- Chave da API TMDb (https://www.themoviedb.org/settings/api)

### Setup

```bash
cp .env.example .env
# edite .env com sua TMDB_API_KEY e TMDB_ACCESS_TOKEN
bun run server.ts
```

O servidor sobe em `http://localhost:3033`.

### Variaveis de ambiente

| Variavel | Descricao |
|---|---|
| `TMDB_API_KEY` | Chave da API do TMDb |
| `TMDB_ACCESS_TOKEN` | Token de acesso do TMDb (opcional, substitui api_key) |
| `PORT` | Porta do servidor (padrao: 3033) |

## Deploy com Docker

```bash
docker build -t boxdgrid .
docker run -d --restart unless-stopped --name boxdgrid -p 3033:3033 --env-file .env boxdgrid
```

## Estrutura

```
public/
  index.html      Pagina principal
  styles.css      Estilos
  script.js       Logica do cliente
  robots.txt      Configuracao de crawlers
  sitemap.xml     Sitemap
server.ts         Servidor HTTP (RSS proxy, TMDb proxy, poster proxy, static files)
Dockerfile        Imagem Docker com Bun
```

## SEO

- Open Graph e Twitter Cards
- JSON-LD (schema.org/WebApplication)
- HTML semantico com ARIA labels
- sitemap.xml e robots.txt

## Licenca

MIT
