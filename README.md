# Vector Search Demo (Next.js + pgvector)

Минимальный demo семантического поиска:
- UI с одной строкой поиска;
- API на Next.js (`/api/search`, `/api/index`);
- Postgres + `pgvector`;
- миграции SQL;
- импорт данных из папки `import`;
- отдельная индексация векторов с сохранением статуса в таблице `documents`.

## 1) Поднять инфраструктуру

Из корня проекта:

```bash
docker compose up -d postgres embeddings
```

## 2) Настроить frontend

```bash
cd frontend
cp .env.example .env.local
npm install
```

## 3) Накатить миграции

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

Скрипт поддерживает fallback на `../import` (если папка `import` лежит рядом с `frontend` в корне репозитория).

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

Статус хранится в `documents.indexing_status`:
- `pending` - ожидает индексации;
- `indexing` - в обработке;
- `indexed` - успешно проиндексировано;
- `error` - ошибка, текст в `documents.indexing_error`.

Важно: размерность вектора зафиксирована как `1024` (см. `lib/constants.ts` и миграции). Если задать `EMBEDDING_DIM`, отличающийся от `1024`, приложение завершится ошибкой на старте, чтобы не допустить рассинхрон runtime и схемы БД.

## 6) Запустить UI

```bash
npm run dev
```

Открыть: [http://localhost:3000](http://localhost:3000)
