import { useEffect, useMemo, useRef, useState } from 'react'
import { categories, monthExpenses, monthIncomes, monthLabel, spendByCategory, type DemoState } from './finance'

type Report = { summary: string; tips: { title: string; category: string; reason: string; action: string }[]; provider: string; model: string; generatedAt: string; month: string }

export function AiDiagnosis({ state, month, pendingCents }: { state: DemoState; month: string; pendingCents: number }) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const controller = useRef<AbortController | null>(null)
  const payload = useMemo(() => {
    const spent = spendByCategory(state, month)
    return JSON.stringify({ month, incomeCents: monthIncomes(state, month), expenseCents: monthExpenses(state, month), pendingCents, categories: categories.map(name => ({ name, spentCents: spent[name], limitCents: state.budgets[month]?.[name] || 0 })) })
  }, [state, month, pendingCents])
  useEffect(() => { controller.current?.abort(); setReport(null); setError(''); setBusy(false); return () => controller.current?.abort() }, [payload])
  async function generate() {
    controller.current?.abort()
    const request = new AbortController(); controller.current = request
    setBusy(true); setError(''); setReport(null)
    try {
      const response = await fetch('/api/ai/diagnostico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, signal: request.signal })
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Servidor de IA não disponível nesta publicação. Execute npm run dev no VS Code com a chave configurada.')
      const data = await response.json()
      if (!response.ok) throw Error(data.error || 'Não foi possível gerar a análise.')
      if (data.provider !== 'Google Gemini' || !data.model || !data.summary || !Array.isArray(data.tips) || data.tips.length !== 3 || data.month !== month) throw Error('Resposta de IA inválida. Tente novamente.')
      if (!request.signal.aborted) setReport(data)
    } catch (problem) { if (!request.signal.aborted) setError(problem instanceof Error ? problem.message : 'Falha ao consultar IA.') }
    finally { if (!request.signal.aborted) setBusy(false) }
  }
  return <div className="ai-diagnosis">
    <div className="card-head"><div><h3>Dicas personalizadas com IA</h3><p>O Gemini analisa os gastos de {monthLabel(month)} e sugere três ações para economizar.</p></div><span className="ai-badge">IA generativa</span></div>
    <label className="check ai-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy}/> Autorizo enviar ao Google Gemini apenas os totais do mês por categoria, receitas e limites, para gerar este relatório.</label>
    <p className="hint">Nomes, descrições, observações, recibos e números de cartão não são enviados. Use os dados fictícios da demonstração.</p>
    <button className="button success" onClick={generate} disabled={!consent || busy || !monthExpenses(state, month)}>{busy ? 'Analisando com IA…' : report ? 'Gerar novamente com IA' : 'Gerar 3 dicas com IA'}</button>
    {busy && <p role="status" aria-live="polite">Aguardando a resposta do modelo. Isso pode levar alguns segundos.</p>}
    {error && <p className="error ai-error" role="alert">{error}</p>}
    {report && <section className="ai-report" aria-label="Relatório gerado por IA" aria-live="polite"><p className="ai-metadata">Gerado por {report.provider} · {report.model} · {monthLabel(report.month)}</p><p>{report.summary}</p><ol>{report.tips.map((tip, index) => <li key={index}><span>{tip.category}</span><h4>{tip.title}</h4><p>{tip.reason}</p><p><strong>Ação sugerida:</strong> {tip.action}</p></li>)}</ol><p className="hint">Sugestões geradas por IA podem conter erros. Confira as informações. Nenhuma transação ou limite é alterado pelo relatório.</p></section>}
  </div>
}
