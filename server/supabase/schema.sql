-- ============================================================
-- APPXV — Esquema PostgreSQL Optimizado para Supabase
-- Generado: 2026-02-16
-- Basado en: Auditoría de arquitectura de BBDD
-- ============================================================
-- 
-- IMPORTANTE: Este script se ejecuta en el SQL Editor de Supabase.
-- Supabase Auth se encarga de auth.users automáticamente.
-- Aquí creamos las tablas del esquema "public" que extienden
-- el perfil del usuario y almacenan toda la data de la app.
--
-- Orden de creación respeta dependencias (FK).
-- ============================================================


-- =============================================
--  1. AUTENTICACIÓN & USUARIOS
-- =============================================

-- Perfil público de usuario (extiende auth.users de Supabase)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'subscriber' CHECK (role IN ('admin', 'subscriber', 'staff')),
  plan TEXT DEFAULT 'freemium' CHECK (plan IN ('freemium', 'premium', 'vip', 'honor')),
  username TEXT UNIQUE,
  avatar_url TEXT,
  google_id TEXT,
  recovery_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Perfiles de staff (DJs, coordinadores, etc.)
CREATE TABLE public.staff_profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.staff_profiles IS 'Staff members created by a subscriber (owner). The id references auth.users.';


-- =============================================
--  2. EVENTOS
-- =============================================

CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE,
  time TEXT,
  location TEXT,
  message TEXT,
  image_url TEXT,
  host_name TEXT,
  gift_type TEXT CHECK (gift_type IN ('alias', 'list')),
  gift_detail TEXT,
  capacity INTEGER,
  dress_code TEXT,
  venue_notes TEXT,
  arrival_tips TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.events IS 'Eventos creados por suscriptores.';

-- FotoWall separado de events (1:1)
CREATE TABLE public.fotowall_configs (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  album_url TEXT,
  interval INTEGER DEFAULT 5,
  shuffle BOOLEAN DEFAULT false,
  overlay_title TEXT,
  moderation_mode TEXT DEFAULT 'manual' CHECK (moderation_mode IN ('ai', 'manual')),
  filters JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.fotowall_configs IS 'Configuración de FotoWall por evento. Relación 1:1 con events.';

-- Staff assignments (qué staff tiene acceso a qué evento)
CREATE TABLE public.staff_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '{
    "invitados": false,
    "mesas": false,
    "link": false,
    "games": false,
    "fotowall": false
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, event_id)
);

COMMENT ON TABLE public.staff_assignments IS 'Asignación staff→evento con permisos granulares en JSONB.';

-- Mesas del evento
CREATE TABLE public.tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER,
  sort_order INTEGER DEFAULT 0,
  assignments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invitados
CREATE TABLE public.guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  allotted JSONB DEFAULT '{"adults": 1, "teens": 0, "kids": 0, "infants": 0}'::jsonb,
  confirmed JSONB DEFAULT '{"adults": 0, "teens": 0, "kids": 0, "infants": 0}'::jsonb,
  companion_names JSONB DEFAULT '{"adults": [], "teens": [], "kids": [], "infants": []}'::jsonb,
  invitation_sent BOOLEAN DEFAULT false,
  assigned_table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN public.guests.allotted IS 'Cupos asignados: {adults, teens, kids, infants}';
COMMENT ON COLUMN public.guests.confirmed IS 'Cupos confirmados: {adults, teens, kids, infants}';
COMMENT ON COLUMN public.guests.companion_names IS 'Nombres de acompañantes por categoría (JSONB)';


-- =============================================
--  3. GASTOS & PROVEEDORES
-- =============================================

CREATE TABLE public.expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  subtitle TEXT
);

CREATE TABLE public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT
);

CREATE TABLE public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  total DECIMAL(12, 2) DEFAULT 0,
  paid DECIMAL(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pagado', 'Adelanto', 'Pendiente')),
  responsible TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.payment_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight DECIMAL(5, 2) DEFAULT 1.00
);

CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.payment_participants(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) DEFAULT 0,
  date DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =============================================
--  4. JUEGOS (Persistidos)
-- =============================================

-- Tipo de juego como ENUM nativo de PostgreSQL
CREATE TYPE game_type AS ENUM (
  'trivia',
  'bingo',
  'impostor',
  'confessions',
  'raffle'
);

CREATE TABLE public.game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  game_type game_type NOT NULL,
  status TEXT DEFAULT 'WAITING',
  config JSONB DEFAULT '{}'::jsonb,
  state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.game_sessions IS 'Sesiones de juego. config = settings iniciales, state = estado actual del juego.';

CREATE TABLE public.game_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_id TEXT,
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  data JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.game_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.game_participants(id) ON DELETE SET NULL,
  content TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.game_submissions IS 'Submissions de juegos (fotos de bingo, mensajes de confesiones, etc.)';


-- =============================================
--  5. PAGOS ONLINE (Suscripciones)
-- =============================================

-- Estado de suscripción
CREATE TYPE subscription_status AS ENUM (
  'active',
  'cancelled',
  'past_due',
  'trialing'
);

-- Estado de pago
CREATE TYPE payment_intent_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded'
);

CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('freemium', 'premium', 'vip', 'honor')),
  status subscription_status DEFAULT 'active',
  payment_provider TEXT CHECK (payment_provider IN ('stripe', 'mercadopago')),
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.payment_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  status payment_intent_status DEFAULT 'pending',
  provider_payment_id TEXT,
  provider_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void', 'uncollectible')),
  provider_invoice_id TEXT,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.webhook_events IS 'Log idempotente de webhooks recibidos de proveedores de pago.';


-- =============================================
--  6. INDEXES
-- =============================================

-- Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_google_id ON public.users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_username ON public.users(username) WHERE username IS NOT NULL;

-- Events
CREATE INDEX idx_events_creator ON public.events(creator_id);

-- Guests
CREATE INDEX idx_guests_event ON public.guests(event_id);
CREATE INDEX idx_guests_event_status ON public.guests(event_id, status);

-- Tables
CREATE INDEX idx_tables_event ON public.tables(event_id);

-- Staff
CREATE INDEX idx_staff_profiles_owner ON public.staff_profiles(owner_id);
CREATE INDEX idx_staff_assignments_event ON public.staff_assignments(event_id);
CREATE INDEX idx_staff_assignments_staff ON public.staff_assignments(staff_id);

-- Expenses & Payments
CREATE INDEX idx_expenses_event ON public.expenses(event_id);
CREATE INDEX idx_suppliers_event ON public.suppliers(event_id);
CREATE INDEX idx_expense_categories_event ON public.expense_categories(event_id);
CREATE INDEX idx_payments_expense ON public.payments(expense_id);
CREATE INDEX idx_payments_participant ON public.payments(participant_id);
CREATE INDEX idx_payment_participants_event ON public.payment_participants(event_id);

-- Games
CREATE INDEX idx_game_sessions_event ON public.game_sessions(event_id);
CREATE INDEX idx_game_sessions_event_type ON public.game_sessions(event_id, game_type);
CREATE INDEX idx_game_participants_session ON public.game_participants(session_id);
CREATE INDEX idx_game_submissions_session ON public.game_submissions(session_id);

-- Subscriptions & Payments Online
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_payment_intents_user ON public.payment_intents(user_id);
CREATE INDEX idx_payment_intents_subscription ON public.payment_intents(subscription_id);
CREATE INDEX idx_invoices_user ON public.invoices(user_id);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed) WHERE processed = false;


-- =============================================
--  7. ROW LEVEL SECURITY (RLS)
-- =============================================
-- Habilitar RLS en todas las tablas para que cada usuario
-- solo pueda acceder a sus propios datos.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotowall_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Políticas base para users (cada usuario ve su propio perfil)
CREATE POLICY "Users: ver propio perfil"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users: actualizar propio perfil"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Políticas para events (creador ve sus eventos)
CREATE POLICY "Events: creador puede todo"
  ON public.events FOR ALL
  USING (auth.uid() = creator_id);

-- Staff asignado puede ver el evento
CREATE POLICY "Events: staff asignado puede ver"
  ON public.events FOR SELECT
  USING (
    id IN (
      SELECT event_id FROM public.staff_assignments
      WHERE staff_id = auth.uid()
    )
  );

-- Políticas para guests (acceso via evento del creador)
CREATE POLICY "Guests: creador del evento puede todo"
  ON public.guests FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para tables
CREATE POLICY "Tables: creador del evento puede todo"
  ON public.tables FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para fotowall_configs
CREATE POLICY "FotoWall: creador del evento puede todo"
  ON public.fotowall_configs FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para expenses
CREATE POLICY "Expenses: creador del evento puede todo"
  ON public.expenses FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para suppliers
CREATE POLICY "Suppliers: creador del evento puede todo"
  ON public.suppliers FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para expense_categories
CREATE POLICY "Categories: creador del evento puede todo"
  ON public.expense_categories FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para payment_participants
CREATE POLICY "PaymentParticipants: creador del evento puede todo"
  ON public.payment_participants FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- Políticas para payments (a través de expense → event)
CREATE POLICY "Payments: creador del evento puede todo"
  ON public.payments FOR ALL
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.events ev ON e.event_id = ev.id
      WHERE ev.creator_id = auth.uid()
    )
  );

-- Game policies (acceso via evento)
CREATE POLICY "GameSessions: creador del evento puede todo"
  ON public.game_sessions FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "GameParticipants: acceso via sesión"
  ON public.game_participants FOR ALL
  USING (
    session_id IN (
      SELECT gs.id FROM public.game_sessions gs
      JOIN public.events ev ON gs.event_id = ev.id
      WHERE ev.creator_id = auth.uid()
    )
  );

CREATE POLICY "GameSubmissions: acceso via sesión"
  ON public.game_submissions FOR ALL
  USING (
    session_id IN (
      SELECT gs.id FROM public.game_sessions gs
      JOIN public.events ev ON gs.event_id = ev.id
      WHERE ev.creator_id = auth.uid()
    )
  );

-- Subscriptions (usuario ve las propias)
CREATE POLICY "Subscriptions: ver propias"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "PaymentIntents: ver propios"
  ON public.payment_intents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Invoices: ver propias"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

-- Webhook events: solo accesible por service_role (backend)
-- No se crea policy para SELECT → denegado por default con RLS


-- =============================================
--  8. TRIGGERS (updated_at automático)
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_events
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_game_sessions
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================
--  9. FUNCIÓN: Crear perfil de usuario al registrarse
-- =============================================
-- Este trigger crea automáticamente una fila en public.users
-- cuando un usuario se registra en Supabase Auth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
