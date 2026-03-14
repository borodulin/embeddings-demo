# Vector Search Demo (Next.js + pgvector)

Минимальный demo семантического поиска по нескольким embedding-моделям:
- UI с одновременным выводом результатов по моделям;
- API на Next.js (`/api/search`, `/api/index`);
- Postgres + `pgvector`;
- хранение векторов в отдельных таблицах:
  - `document_vectors_qwen3_embedding_0_6b` (`vector(1024)`);
  - `document_vectors_gigachat` (`vector(2560)`);
  - `document_vectors_text_embedding_3_small` (`vector(1536)`);
- импорт данных из папки `import`;
- отдельная индексация векторов с сохранением статусов по каждой модели.

## 1) Полный reset БД (обязательно для новой схемы)

Из корня проекта:

```bash
docker compose down -v
docker compose up -d postgres
```

## 2) Установить зависимости

```bash
npm install
```

## 3) Накатить миграции на чистую БД

```bash
npm run db:migrate
```

## 4) Импортировать данные из папки `import`

```bash
npm run import:data
```

По умолчанию команда запускает:

```bash
tsx scripts/import-data.ts --dir ./import
```

Скрипт поддерживает fallback на `../import`.

Полезно для smoke-теста:

```bash
npm run import:data -- --limit 100
```

## 5) Проиндексировать векторы отдельной командой

```bash
npm run index:vectors
```

Для smoke-теста:

```bash
npm run index:vectors -- --limit 100
```

Smoke-тест только для OpenAI-индексации (создаёт 1 pending-запись, индексирует и проверяет статус `indexed`):

```bash
npm run smoke:index:openai
```

`--limit` трактуется как `limit per model` (то же, что `--limit-per-model`).
Пример явного указания:

```bash
npm run index:vectors -- --limit-per-model 10
```

Можно индексировать только одну модель:

```bash
npm run index:vectors -- --model qwen3_embedding_0_6b
```

Доступные значения `--model`: `qwen3_embedding_0_6b`, `gigachat`, `text_embedding_3_small`.

Скорость индексации регулируется через `INDEX_CONCURRENCY` (по умолчанию `8`, максимум `32`):

```bash
INDEX_CONCURRENCY=16 npm run index:vectors -- --model text_embedding_3_small
```

Для OpenAI дополнительно можно настраивать размер batch-запроса embeddings через
`OPENAI_EMBED_BATCH_SIZE` (по умолчанию `16`, максимум `128`):

```bash
INDEX_CONCURRENCY=8 OPENAI_EMBED_BATCH_SIZE=32 npm run index:vectors -- --model text_embedding_3_small
```

## Диагностика: получить вектор по модели

```bash
npm run get:vector -- --model qwen3_embedding_0_6b --text "кроссовки nike"
```

Полный вектор JSON:

```bash
npm run get:vector -- --model text_embedding_3_small --text "кроссовки nike" --json
```

Статус хранится в model-specific таблицах (`document_vectors_*`). Значения:
- `pending` - ожидает индексации;
- `indexing` - в обработке;
- `indexed` - успешно проиндексировано;
- `error` - ошибка, текст в `indexing_error`.

По умолчанию используются model names:
- `Qwen/Qwen3-Embedding-0.6B` для локально поднятой модели Qwen;
- `EmbeddingsGigaR` для GigaChat;
- `text-embedding-3-small` для OpenAI.

Можно переопределить через env:
- `EMBEDDINGS_API_URL_QWEN3_EMBEDDING_0_6B`, `EMBEDDINGS_API_URL_GIGACHAT`, `EMBEDDINGS_API_URL_OPENAI`;
- `EMBEDDINGS_MODEL_QWEN3_EMBEDDING_0_6B`, `EMBEDDINGS_MODEL_GIGACHAT`, `EMBEDDINGS_MODEL_OPENAI`.

Для реальной интеграции GigaChat/OpenAI дополнительно:
- `GIGACHAT_AUTH_KEY` - Basic-ключ авторизации для OAuth;
- `GIGACHAT_SCOPE` - например `GIGACHAT_API_PERS`/`GIGACHAT_API_CORP`;
- `GIGACHAT_OAUTH_URL` - по умолчанию `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`;
- `OPENAI_API_KEY` - API-ключ OpenAI;
- `OPENAI_ORGANIZATION` - опционально, если требуется организационный контекст;
- `OPENAI_PROXY_URL` - URL прокси для OpenAI-запросов (если задан, запросы к OpenAI идут через него).

Примечание по OpenAI:
- без `OPENAI_PROXY_URL` требуется `OPENAI_API_KEY`;
- с `OPENAI_PROXY_URL` ключ может быть не нужен, если прокси сам обеспечивает авторизацию.

Архитектурно провайдеры разделены по модулям:
- `lib/embeddings/providers/qwen.ts`
- `lib/embeddings/providers/gigachat.ts`
- `lib/embeddings/providers/openai.ts`

## 6) Запустить UI

```bash
npm run dev
```

Открыть: [http://localhost:3000](http://localhost:3000)
