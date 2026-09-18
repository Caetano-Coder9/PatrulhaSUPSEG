import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDateTime(iso: string | Date) {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return format(d, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

export function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return format(d, "HH:mm:ss", { locale: ptBR });
}

export function formatRelative(iso: string) {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: "Concluído",
    missed: "Perdido",
    late: "Atrasado",
    out_of_sequence: "Fora de sequência",
    in_progress: "Em andamento",
    open: "Aberto",
    resolved: "Resolvido",
    verified: "Verificado",
    outside_radius: "Fora do raio",
    low_accuracy: "Baixa precisão",
    permission_denied: "Sem permissão GPS",
    unavailable: "GPS indisponível",
    pending: "Pendente",
    scanned: "Escaneado",
  };
  return map[status] ?? status;
}

export function severityLabel(s: string): string {
  return { low: "Baixa", medium: "Média", high: "Alta" }[s] ?? s;
}
