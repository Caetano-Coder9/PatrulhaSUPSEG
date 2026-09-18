# SUPSEGPatrulha

Sistema completo de gestão de rondas de segurança com painel administrativo e app móvel (PWA) offline-first.

## Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + Storage + Realtime)
- **Offline**: Dexie.js (IndexedDB) + fila de sincronização idempotente
- **QR Code**: html5-qrcode (leitura) + qrcode.react (geração)
- **GPS**: navigator.geolocation com validação por raio e precisão

## Design System

| Token        | Cor       |
|--------------|-----------|
| Navy         | `#0a192f` |
| Teal         | `#0d9488` |
| Dark Blue    | `#1e3a8a` |
| Success      | `#22c55e` |
| Danger       | `#ef4444` |
| Warning      | `#eab308` |

## Funcionalidades

### Painel Admin (`/admin/*`)
- Dashboard com feed em tempo real (Supabase Realtime)
- Gestão de postos, checkpoints, rotas e agentes
- Geração de QR Code para impressão
- Logs de ronda com status GPS e sequência
- Ocorrências e relatórios analíticos

### App Móvel (`/mobile/*`) – PWA Offline-First
- Login seguro
- Início de ronda e lista de checkpoints
- Scanner de QR via câmera
- Validação GPS (raio + precisão)
- Registro de ocorrências com foto
- Fila de sincronização com indicador visual
- Funciona completamente offline

## Setup rápido

### 1. Criar projeto Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Em **SQL Editor**, execute o conteúdo de:
   - `supabase/migrations/001_schema.sql`
3. Em **Authentication > Users**, crie:
   - Admin: `admin@supseg.local` (defina senha forte)
   - Guard: `sidonio@supseg.local` (defina senha forte)
4. Execute o seed (`supabase/seed.sql`) e atualize os profiles:

```sql
UPDATE public.profiles SET
  full_name = 'Administrador SUPSEG',
  role = 'admin',
  phone_number = '+258840000001',
  shift_info = 'Geral'
WHERE email = 'admin@supseg.local';

UPDATE public.profiles SET
  full_name = 'Sidónio',
  role = 'guard',
  phone_number = '+258840000002',
  shift_info = 'Turno Diurno 08h-16h'
WHERE email = 'sidonio@supseg.local';
```

5. Em **Storage**, crie o bucket `incident-photos` (privado ou público conforme política)

### 2. Configurar o app

```bash
cd supseg-patrulha
cp .env.example .env.local
# Edite .env.local com URL e anon key do Supabase

npm install
npm run dev
```

Abra http://localhost:3000

- Admin: `/admin/dashboard`
- Guard: `/mobile/home`

### 3. PWA no celular

1. Abra o app no Chrome/Safari do celular
2. “Adicionar à tela inicial”
3. Use com a câmera e GPS habilitados

## Estrutura do projeto

```
src/
  app/
    (auth)/login/          # Login
    admin/                 # Painel desktop
      dashboard/
      locations/
      checkpoints/         # + geração QR
      routes/
      agents/
      logs/
      incidents/
      reports/
    mobile/                # PWA
      home/                # Rotas e progresso
      scan/                # QR + GPS
      incident/            # Ocorrências offline
      sync/                # Fila de sincronização
      profile/
  lib/
    supabase/              # Clients + middleware
    offline/               # Dexie + sync engine
    types/
    utils/                 # geo, format, cn
supabase/
  migrations/001_schema.sql
  seed.sql
```

## Regras de negócio

- QR Code usa **token único** (não o código P01)
- Validação: checkpoint ativo, pertencente à rota, sequência, GPS (raio + precisão)
- Leituras fora de ordem → `out_of_sequence` (ainda registradas)
- Offline: tudo vai para IndexedDB + fila; sync idempotente via `client_event_id`
- RLS no Supabase por role (`admin` / `guard`)
- Nunca expor `service_role_key` no frontend

## Segurança

- Autenticação via Supabase Auth
- Row Level Security em todas as tabelas
- Middleware Next.js protege rotas `/admin` e `/mobile`
- Storage de fotos com políticas por usuário

## Próximos passos (evolução)

- Escalas de turno e alertas push
- Exportação de relatórios (PDF/Excel)
- Mapas com trajetória da ronda
- Multi-organização / multi-tenant
- Notificações de checkpoints saltados em tempo real

## Licença

Uso interno · SUPSEG
