# ADEHASC Site

Portal público com painel ADM para matérias com texto, fotos e vídeos.

## Desenvolvimento

```powershell
npm.cmd install
npm.cmd run dev
```

Para testar também as rotas `/api` localmente, use o ambiente da Vercel:

```powershell
npm.cmd run vercel:dev
```

## Produção na Vercel

Configure estas variáveis no projeto da Vercel antes de usar o painel `/admin` online:

```text
ADMIN_PASSWORD
BLOB_READ_WRITE_TOKEN
```

O `BLOB_READ_WRITE_TOKEN` é criado quando você conecta um Blob Store ao projeto na Vercel. Ele salva matérias, fotos e vídeos publicados pelo painel ADM.
