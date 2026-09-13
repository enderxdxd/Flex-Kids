/**
 * Formatação de moeda para exibição na interface (pt-BR).
 *
 * Não usar em payload de impressora fiscal — o comprovante térmico tem
 * formatação própria e é validado separadamente.
 */
export function formatBRL(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}