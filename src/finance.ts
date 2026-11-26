export const REF_DATE = '2026-11-10'
export const STORAGE_KEY = 'infaturamento.demo.v1'

export const categories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Outros'] as const
export type Category = (typeof categories)[number]
export const categoryColors: Record<Category, string> = {
  Alimentação: '#72986B', Moradia: '#244C3B', Transporte: '#A6B876', Saúde: '#D7AE7B',
  Educação: '#AAA3BD', Lazer: '#E0CC89', Compras: '#86A8AE', Outros: '#A9ADA6',
}
export const categoryIcons: Record<Category, string> = {
  Alimentação: '◫', Moradia: '⌂', Transporte: '◇', Saúde: '♡',
  Educação: '▤', Lazer: '☼', Compras: '□', Outros: '▦',
}

export type PaymentMethod = 'Pix' | 'Dinheiro' | 'Débito' | 'Boleto' | 'Cartão'
export type Expense = {
  id: string; description: string; amount: number; category: Category; method: PaymentMethod
  date: string; dueDate?: string; paid?: { date: string; amount: number }; notes: string
  recurring?: boolean; cardId?: string; installments?: number
}
export type Income = {
  id: string; description: string; amount: number; date: string; category: string; notes: string
}
export type Card = { id: string; name: string; color: string; closingDay: number; dueDay: number; last4?: string }
export type InvoicePayment = { cardId: string; month: string; date: string; amount: number }
export type DemoState = {
  version: 1; expenses: Expense[]; incomes: Income[]; cards: Card[]
  budgets: Record<string, Partial<Record<Category, number>>>; invoicePayments: InvoicePayment[]
}
export type Occurrence = {
  key: string; expense: Expense; month: string; dueDate: string; amount: number
  installment?: number; totalInstallments?: number; forecast: boolean
}

export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export const dateBR = (iso?: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'
export const monthLabel = (month: string) => {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, m - 1, 1)))
}
export const parseMoney = (value: string) => {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+([.,]\d{1,2})?$/.test(value.trim())) return NaN
  return Math.round(Number(normalized) * 100)
}
export const inputMoney = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
export const monthOf = (iso: string) => iso.slice(0, 7)
export const addMonths = (month: string, amount: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + amount, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
export const dateInMonth = (month: string, day: number) => `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function firstInvoiceMonth(date: string, card: Card) {
  let month = monthOf(date)
  if (Number(date.slice(8)) > card.closingDay) month = addMonths(month, 1)
  if (card.dueDay <= card.closingDay) month = addMonths(month, 1)
  return month
}
export function splitAmount(amount: number, count: number) {
  const base = Math.floor(amount / count)
  const rest = amount % count
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0))
}
export function occurrences(expense: Expense, cards: Card[]): Occurrence[] {
  if (expense.method === 'Cartão') {
    const card = cards.find(c => c.id === expense.cardId)
    if (!card) return []
    const total = expense.installments || 1
    const first = firstInvoiceMonth(expense.date, card)
    return splitAmount(expense.amount, total).map((amount, index) => {
      const month = addMonths(first, index)
      return {
        key: `${expense.id}-${index + 1}`, expense, month, dueDate: dateInMonth(month, card.dueDay),
        amount, installment: index + 1, totalInstallments: total, forecast: month > '2026-11',
      }
    })
  }
  const original: Occurrence = {
    key: expense.id, expense, month: monthOf(expense.date), dueDate: expense.dueDate || expense.date,
    amount: expense.amount, forecast: false,
  }
  if (!expense.recurring) return [original]
  return [original, ...Array.from({ length: 11 }, (_, i) => {
    const month = addMonths(monthOf(expense.date), i + 1)
    const dueDay = Number((expense.dueDate || expense.date).slice(8))
    return { ...original, key: `${expense.id}-r${i + 1}`, month, dueDate: dateInMonth(month, dueDay), forecast: true }
  })]
}
export const monthOccurrences = (state: DemoState, month: string) =>
  state.expenses.flatMap(e => occurrences(e, state.cards)).filter(o => o.month === month)
export const monthExpenses = (state: DemoState, month: string) =>
  monthOccurrences(state, month).filter(o => !o.forecast).reduce((sum, o) => sum + o.amount, 0)
export const monthIncomes = (state: DemoState, month: string) =>
  state.incomes.filter(i => monthOf(i.date) === month).reduce((sum, i) => sum + i.amount, 0)
export const spendByCategory = (state: DemoState, month: string) =>
  Object.fromEntries(categories.map(category => [category,
    monthOccurrences(state, month).filter(o => !o.forecast && o.expense.category === category).reduce((s, o) => s + o.amount, 0)
  ])) as Record<Category, number>
export const invoiceTotal = (state: DemoState, cardId: string, month: string) =>
  monthOccurrences(state, month).filter(o => !o.forecast && o.expense.cardId === cardId).reduce((s, o) => s + o.amount, 0)
export const invoicePaid = (state: DemoState, cardId: string, month: string) =>
  state.invoicePayments.find(p => p.cardId === cardId && p.month === month)
export const occurrenceStatus = (o: Occurrence) => {
  if (o.forecast) return 'Previsão'
  if (o.expense.method !== 'Cartão' && o.expense.paid) return 'Paga'
  if (o.dueDate < REF_DATE) return 'Atrasada'
  return 'Pendente'
}
export const categorySuggestion = (text: string): Category | null => {
  const words: Record<Category, string[]> = {
    Alimentação: ['mercado', 'supermercado', 'feira', 'padaria', 'restaurante', 'ifood', 'açougue', 'café'],
    Moradia: ['aluguel', 'condomínio', 'energia', 'água', 'internet', 'luz', 'gás'],
    Transporte: ['uber', '99', 'ônibus', 'combustível', 'gasolina', 'metrô'],
    Saúde: ['farmácia', 'consulta', 'médico', 'dentista', 'exame'],
    Educação: ['escola', 'curso', 'livro', 'faculdade', 'mensalidade'],
    Lazer: ['cinema', 'netflix', 'spotify', 'passeio', 'teatro'],
    Compras: ['roupa', 'tênis', 'notebook', 'celular', 'loja'], Outros: [],
  }
  const normalized = text.toLocaleLowerCase('pt-BR')
  return categories.find(c => words[c].some(word => normalized.includes(word))) || null
}

const expense = (id: string, description: string, amount: number, category: Category, method: PaymentMethod, date: string, dueDate: string | undefined, paid: boolean): Expense => ({
  id, description, amount, category, method, date, dueDate, paid: paid ? { date, amount } : undefined, notes: '',
})
export function seedState(): DemoState {
  const expenses: Expense[] = [
    expense('e1', 'Aluguel do apartamento', 145000, 'Moradia', 'Boleto', '2026-11-01', '2026-11-05', true),
    expense('e2', 'Supermercado Boa Mesa', 48690, 'Alimentação', 'Débito', '2026-11-03', '2026-11-03', true),
    expense('e3', 'Feira da semana', 12350, 'Alimentação', 'Pix', '2026-11-08', '2026-11-08', true),
    expense('e4', 'Energia elétrica', 18640, 'Moradia', 'Boleto', '2026-11-02', '2026-11-08', false),
    expense('e5', 'Internet de casa', 9990, 'Moradia', 'Boleto', '2026-11-01', '2026-11-12', false),
    expense('e6', 'Transporte para o trabalho', 24800, 'Transporte', 'Pix', '2026-11-04', '2026-11-04', true),
    expense('e7', 'Farmácia Bem Cuidar', 9570, 'Saúde', 'Débito', '2026-11-06', '2026-11-06', true),
    expense('e8', 'Curso de inglês', 32000, 'Educação', 'Boleto', '2026-11-01', '2026-11-18', false),
    expense('e9', 'Cinema em família', 12800, 'Lazer', 'Dinheiro', '2026-11-07', '2026-11-07', true),
    { ...expense('e10', 'Notebook para estudos', 180000, 'Compras', 'Cartão', '2026-09-01', undefined, false), cardId: 'card-1', installments: 6 },
    { ...expense('e11', 'Restaurante da praça', 14990, 'Alimentação', 'Cartão', '2026-11-01', undefined, false), cardId: 'card-1', installments: 1 },
  ]
  return {
    version: 1, expenses,
    incomes: [
      { id: 'income-1', description: 'Salário de Marina', amount: 420000, date: '2026-11-05', category: 'Salário', notes: 'Receita fictícia da demonstração.' },
      { id: 'income-2', description: 'Trabalho extra', amount: 65000, date: '2026-11-09', category: 'Trabalho extra', notes: 'Receita fictícia da demonstração.' },
    ],
    cards: [{ id: 'card-1', name: 'Meu cartão principal', color: '#4F46E5', closingDay: 2, dueDay: 15, last4: '4821' }],
    budgets: { '2026-11': { Alimentação: 90000, Moradia: 200000, Transporte: 40000, Saúde: 25000, Educação: 30000, Lazer: 30000, Compras: 50000, Outros: 15000 } },
    invoicePayments: [],
  }
}

export function validState(value: unknown): value is DemoState {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<DemoState>
  return s.version === 1 && Array.isArray(s.expenses) && Array.isArray(s.cards) && !!s.budgets
}
