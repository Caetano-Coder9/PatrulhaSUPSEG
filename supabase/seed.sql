-- ============================================================
-- SUPSEGPatrulha - Dados de Teste
-- Execute APÓS criar usuários no Auth e a migration 001
-- Substitua os UUIDs de profiles pelos IDs reais dos usuários
-- ============================================================

-- 1. Localização
INSERT INTO public.locations (id, name, address, latitude, longitude, is_active)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  'Laulane''s Place',
  'Maputo, Moçambique - Zona de Laulane',
  -25.8910,
  32.6050,
  true
) ON CONFLICT DO NOTHING;

-- 2. Checkpoints (tokens únicos)
INSERT INTO public.checkpoints (id, location_id, code, name, qr_code_token, target_lat, target_lng, gps_radius_meters, is_active)
VALUES
  ('b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'P01', 'Portão Principal',
   'cp_p01_' || encode(gen_random_bytes(8), 'hex'), -25.8908, 32.6048, 40, true),
  ('b0000002-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 'P02', 'Porta Lateral',
   'cp_p02_' || encode(gen_random_bytes(8), 'hex'), -25.8912, 32.6052, 35, true),
  ('b0000003-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000001', 'P03', 'Mesa de Bilhares',
   'cp_p03_' || encode(gen_random_bytes(8), 'hex'), -25.8910, 32.6051, 25, true),
  ('b0000004-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000001', 'P04', 'Balcão/Bar',
   'cp_p04_' || encode(gen_random_bytes(8), 'hex'), -25.8909, 32.6053, 30, true),
  ('b0000005-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000001', 'P05', 'Escritório-SupSeg',
   'cp_p05_' || encode(gen_random_bytes(8), 'hex'), -25.8911, 32.6049, 30, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Rota diurna
INSERT INTO public.patrol_routes (id, location_id, name, scheduled_time, tolerance_minutes, is_active)
VALUES (
  'c0000001-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000001',
  'Ronda Diurna - Laulane',
  '08:00:00',
  20,
  true
) ON CONFLICT DO NOTHING;

-- 4. Ordem dos checkpoints na rota
-- Relaciona por code para funcionar mesmo se P01-P05 já existirem
-- com UUIDs diferentes dos IDs de exemplo acima.
INSERT INTO public.route_checkpoints (route_id, checkpoint_id, sequence_order)
SELECT
  'c0000001-0000-4000-8000-000000000001'::uuid,
  cp.id,
  ord.sequence_order
FROM (VALUES
  ('P01', 1),
  ('P02', 2),
  ('P03', 3),
  ('P04', 4),
  ('P05', 5)
) AS ord(code, sequence_order)
JOIN public.checkpoints AS cp ON cp.code = ord.code
ON CONFLICT (route_id, checkpoint_id) DO NOTHING;

-- ============================================================
-- IMPORTANTE: Após criar usuários no Supabase Auth:
-- 1. Admin: email admin@supseg.local / senha forte
-- 2. Guard: email sidonio@supseg.local / senha forte
-- Depois atualize profiles:
--
-- UPDATE public.profiles SET
--   full_name = 'Administrador SUPSEG',
--   role = 'admin',
--   phone_number = '+258840000001',
--   shift_info = 'Geral'
-- WHERE email = 'admin@supseg.local';
--
-- UPDATE public.profiles SET
--   full_name = 'Sidónio',
--   role = 'guard',
--   phone_number = '+258840000002',
--   shift_info = 'Turno Diurno 08h-16h'
-- WHERE email = 'sidonio@supseg.local';
-- ============================================================

-- Exemplo de incidente (substitua guard_id pelo UUID real do Sidónio)
-- INSERT INTO public.incidents (
--   guard_id, location_id, checkpoint_id, title, description, severity, status
-- ) VALUES (
--   '<UUID_DO_SIDONIO>',
--   'a0000001-0000-4000-8000-000000000001',
--   'b0000003-0000-4000-8000-000000000003',
--   'Porta de serviço entreaberta',
--   'Encontrada porta lateral do setor de bilhares parcialmente aberta durante a ronda.',
--   'medium',
--   'open'
-- );
