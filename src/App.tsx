import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, Category, DemoState, Expense, Income, Occurrence, PaymentMethod, REF_DATE, STORAGE_KEY,
  addMonths, categories, categoryColors, categoryIcons, categorySuggestion, dateBR, dateInMonth,
  firstInvoiceMonth, inputMoney, invoicePaid, invoiceTotal, money, monthExpenses, monthIncomes,
  monthLabel, monthOccurrences, monthOf, occurrenceStatus, occurrences, parseMoney, seedState,
  spendByCategory, splitAmount, uid, validState,
} from './finance'

type Tab = 'Dashboard' | 'Despesas' | 'Agenda' | 'Cartões e faturas' | 'Orçamento'
type Modal = null | { kind: 'expense'; expense?: Expense; presetCard?: string; receipt?: boolean } | { kind: 'income'; income?: Income }
  | { kind: 'details'; expense: Expense } | { kind: 'deleteExpense'; expense: Expense }
  | { kind: 'deleteIncome'; income: Income } | { kind: 'payment'; occurrence: Occurrence }
  | { kind: 'invoice'; card: Card } | { kind: 'card' } | { kind: 'budgets'; category?: Category }
  | { kind: 'about' } | { kind: 'restore' }

const Icon = ({ name }: { name: 'info' | 'plus' | 'edit' | 'trash' | 'calendar' | 'card' | 'close' }) => {
  const paths = {
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, edit: <path d="m4 20 4.3-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/><path d="M10 11v5m4-5v5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const Button = ({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'link' | 'success' }) =>
  <button {...props} className={`button ${variant} ${props.className || ''}`}>{children}</button>

const Field = ({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) =>
  <label className={`field ${className}`}><span>{label}</span>{children}{error && <small className="error">{error}</small>}</label>

const Status = ({ children }: { children: string }) => <span className={`status ${children.toLowerCase().replace('ã', 'a')}`}>{children}</span>

function ModalShell({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus()
    const key = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); previous?.focus() }
  }, [close])
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && close()}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
      <header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={close} aria-label="Fechar diálogo"><Icon name="close"/></button></header>
      <div className="modal-body">{children}</div>
    </div>
  </div>
}

type ExpenseDraft = { description: string; amount: string; date: string; category: Category; method: PaymentMethod; dueDate: string; status: 'Pendente' | 'Paga'; cardId: string; installments: number; notes: string; recurring: boolean }
const blankExpense = (month: string, cardId = ''): ExpenseDraft => ({
  description: '', amount: '', date: month === '2026-11' ? REF_DATE : `${month}-01`, category: 'Alimentação',
  method: cardId ? 'Cartão' : 'Pix', dueDate: month === '2026-11' ? REF_DATE : `${month}-01`,
  status: 'Pendente', cardId, installments: 1, notes: '', recurring: false,
})

function ExpenseForm({ state, month, initial, presetCard, presetReceipt, onSave, close }: {
  state: DemoState; month: string; initial?: Expense; presetCard?: string; presetReceipt?: boolean; onSave: (e: Expense) => void; close: () => void
}) {
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<ExpenseDraft>(() => initial ? {
    description: initial.description, amount: inputMoney(initial.amount), date: initial.date, category: initial.category,
    method: initial.method, dueDate: initial.dueDate || initial.date, status: initial.paid ? 'Paga' : 'Pendente',
    cardId: initial.cardId || '', installments: initial.installments || 1, notes: initial.notes, recurring: !!initial.recurring,
  } : presetReceipt ? {
    description: 'Supermercado Boa Mesa', amount: '187,42', date: REF_DATE, category: 'Alimentação', method: 'Pix',
    dueDate: REF_DATE, status: 'Paga', cardId: '', installments: 1,
    notes: 'Recibo fictício de demonstração. Campos livres para correção.', recurring: false,
  } : blankExpense(month, presetCard))
  const suggestion = categorySuggestion(draft.description)
  const update = (patch: Partial<ExpenseDraft>) => setDraft(d => ({ ...d, ...patch }))
  const validate = () => {
    const next: Record<string, string> = {}
    const amount = parseMoney(draft.amount)
    if (!draft.description.trim()) next.description = 'Informe a descrição.'
    if (draft.description.length > 120) next.description = 'Use no máximo 120 caracteres.'
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000000) next.amount = 'Informe um valor entre R$ 0,01 e R$ 1.000.000,00, sem separador de milhar.'
    if (!draft.date || draft.date < '2020-01-01' || draft.date > REF_DATE) next.date = 'Use uma data entre 01/01/2020 e 10/11/2026.'
    if (draft.method === 'Cartão') {
      if (!state.cards.some(c => c.id === draft.cardId)) next.cardId = 'Selecione um cartão existente.'
      if (!Number.isInteger(draft.installments) || draft.installments < 1 || draft.installments > 24) next.installments = 'Use de 1 a 24 parcelas.'
      if (Number.isFinite(amount) && amount < draft.installments) next.installments = 'Cada parcela precisa ter pelo menos um centavo.'
    } else if (!draft.dueDate || draft.dueDate < draft.date) next.dueDate = 'O vencimento deve ser igual ou posterior à data.'
    setErrors(next)
    if (Object.keys(next).length) setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    else setStep(2)
  }
  const receipt = () => setDraft({
    description: 'Supermercado Boa Mesa', amount: '187,42', date: REF_DATE, category: 'Alimentação', method: 'Pix',
    dueDate: REF_DATE, status: 'Paga', cardId: '', installments: 1,
    notes: 'Recibo fictício de demonstração. Campos livres para correção.', recurring: false,
  })
  const save = () => {
    const amount = parseMoney(draft.amount)
    onSave({
      id: initial?.id || uid('expense'), description: draft.description.trim(), amount, date: draft.date, category: draft.category,
      method: draft.method, dueDate: draft.method === 'Cartão' ? undefined : draft.dueDate,
      paid: draft.method !== 'Cartão' && draft.status === 'Paga' ? { date: draft.date, amount } : undefined,
      cardId: draft.method === 'Cartão' ? draft.cardId : undefined, installments: draft.method === 'Cartão' ? draft.installments : undefined,
      notes: draft.notes, recurring: draft.method === 'Cartão' ? false : draft.recurring,
    })
  }
  const card = state.cards.find(c => c.id === draft.cardId)
  const firstMonth = card ? firstInvoiceMonth(draft.date, card) : ''
  return <ModalShell title={initial ? 'Editar despesa' : 'Nova despesa'} close={close}>
    {step === 1 ? <>
      <p className="eyebrow">1 DE 2 · PREENCHIMENTO</p>
      <div className="form-grid">
        <Field label="Descrição" error={errors.description} className="wide"><input maxLength={120} value={draft.description} onChange={e => update({ description: e.target.value })} aria-invalid={!!errors.description}/></Field>
        <Field label="Valor total da compra (R$)" error={errors.amount}><input inputMode="decimal" value={draft.amount} onChange={e => update({ amount: e.target.value })} aria-invalid={!!errors.amount}/></Field>
        <Field label="Data da despesa" error={errors.date}><input type="date" min="2020-01-01" max={REF_DATE} value={draft.date} onChange={e => update({ date: e.target.value })} aria-invalid={!!errors.date}/></Field>
        <Field label="Categoria"><select value={draft.category} onChange={e => update({ category: e.target.value as Category })}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Forma de pagamento"><select value={draft.method} onChange={e => update({ method: e.target.value as PaymentMethod })}>{['Pix','Dinheiro','Débito','Boleto','Cartão'].map(p => <option key={p}>{p}</option>)}</select></Field>
        {draft.method === 'Cartão' ? <>
          <Field label="Cartão" error={errors.cardId}><select value={draft.cardId} onChange={e => update({ cardId: e.target.value })} aria-invalid={!!errors.cardId}><option value="">Selecione</option>{state.cards.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Parcelas" error={errors.installments}><input type="number" min="1" max="24" value={draft.installments} onChange={e => update({ installments: Number(e.target.value) })} aria-invalid={!!errors.installments}/></Field>
        </> : <>
          <Field label="Situação"><select value={draft.status} onChange={e => update({ status: e.target.value as 'Paga' | 'Pendente' })}><option>Pendente</option><option>Paga</option></select></Field>
          <Field label="Vencimento" error={errors.dueDate}><input type="date" value={draft.dueDate} onChange={e => update({ dueDate: e.target.value })} aria-invalid={!!errors.dueDate}/></Field>
          <label className="check wide"><input type="checkbox" checked={draft.recurring} onChange={e => update({ recurring: e.target.checked })}/> Recorrência mensal como previsão por 12 meses</label>
        </>}
        <Field label="Observações (opcional)" className="wide"><textarea maxLength={500} rows={3} value={draft.notes} onChange={e => update({ notes: e.target.value })}/></Field>
      </div>
      <div className="rule-box"><strong>Regra local</strong><p>{suggestion ? <>Sugestão: <b>{suggestion}</b>.</> : 'Digite mais detalhes ou escolha a categoria manualmente.'}</p>{suggestion && <Button variant="secondary" onClick={() => update({ category: suggestion })}>Sugerir categoria</Button>}</div>
      <div className="receipt-box"><strong>Um empurrãozinho para começar</strong><p>Use um recibo fictício e corrija qualquer campo antes de revisar.</p><Button variant="secondary" onClick={receipt}>Usar recibo de exemplo</Button></div>
      <div className="modal-actions"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={validate}>Revisar despesa</Button></div>
    </> : <>
      <p className="eyebrow">2 DE 2 · REVISÃO</p><h3>Tudo certo com sua despesa?</h3>
      <div className="review-hero"><strong>{draft.description}</strong><b>{money(parseMoney(draft.amount))}</b></div>
      <dl className="review-list">
        <div><dt>Categoria</dt><dd>{draft.category}</dd></div><div><dt>Data</dt><dd>{dateBR(draft.date)}</dd></div>
        <div><dt>Pagamento</dt><dd>{draft.method}</dd></div>
        <div><dt>{draft.method === 'Cartão' ? 'Primeira fatura' : 'Vencimento'}</dt><dd>{draft.method === 'Cartão' ? `${monthLabel(firstMonth)} · ${draft.installments}x` : dateBR(draft.dueDate)}</dd></div>
        <div><dt>Situação</dt><dd>{draft.method === 'Cartão' ? 'Controlada pela fatura' : draft.status}</dd></div>
        {draft.notes && <div><dt>Observações</dt><dd>{draft.notes}</dd></div>}
      </dl>
      {draft.method === 'Cartão' && <p className="hint">As parcelas serão distribuídas desde {monthLabel(firstMonth)}, em meses consecutivos, com ajuste exato dos centavos.</p>}
      {draft.recurring && <p className="hint">As próximas 11 ocorrências serão previsões. A ocorrência real deverá ser cadastrada.</p>}
      <div className="modal-actions"><Button variant="secondary" onClick={() => setStep(1)}>Voltar e corrigir</Button><Button onClick={save}>Salvar despesa</Button></div>
    </>}
  </ModalShell>
}

function IncomeForm({ initial, onSave, close }: { initial?: Income; onSave: (i: Income) => void; close: () => void }) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState({ description: initial?.description || '', amount: initial ? inputMoney(initial.amount) : '', date: initial?.date || REF_DATE, category: initial?.category || 'Salário', notes: initial?.notes || '' })
  const [error, setError] = useState('')
  const update = (patch: Partial<typeof draft>) => setDraft(d => ({ ...d, ...patch }))
  const review = () => {
    const amount = parseMoney(draft.amount)
    if (!draft.description.trim() || !draft.category.trim() || draft.category.length > 50 || !Number.isFinite(amount) || amount < 1 || draft.date > REF_DATE) setError('Revise descrição, valor positivo, categoria e data até 10/11/2026.')
    else { setError(''); setStep(2) }
  }
  return <ModalShell title={initial ? 'Editar receita' : 'Nova receita'} close={close}>
    {step === 1 ? <><p className="eyebrow">1 DE 2 · PREENCHIMENTO</p><div className="form-grid">
      <Field label="Descrição" className="wide"><input value={draft.description} onChange={e => update({description:e.target.value})}/></Field>
      <Field label="Valor (R$)"><input inputMode="decimal" value={draft.amount} onChange={e => update({amount:e.target.value})}/></Field>
      <Field label="Data de recebimento"><input type="date" max={REF_DATE} value={draft.date} onChange={e => update({date:e.target.value})}/></Field>
      <Field label="Categoria" className="wide"><input maxLength={50} value={draft.category} onChange={e => update({category:e.target.value})}/></Field>
      <Field label="Observações" className="wide"><textarea rows={3} value={draft.notes} onChange={e => update({notes:e.target.value})}/></Field>
    </div>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={review}>Revisar receita</Button></div></>
    : <><p className="eyebrow">2 DE 2 · REVISÃO</p><div className="review-hero"><strong>{draft.description}</strong><b className="green">{money(parseMoney(draft.amount))}</b></div>
      <dl className="review-list"><div><dt>Categoria</dt><dd>{draft.category}</dd></div><div><dt>Recebida em</dt><dd>{dateBR(draft.date)}</dd></div></dl>
      <div className="modal-actions"><Button variant="secondary" onClick={() => setStep(1)}>Voltar e corrigir</Button><Button onClick={() => onSave({id:initial?.id||uid('income'),description:draft.description.trim(),amount:parseMoney(draft.amount),date:draft.date,category:draft.category.trim(),notes:draft.notes})}>Salvar receita</Button></div></>}
  </ModalShell>
}

function Donut({ values }: { values: { label: string; value: number; color: string }[] }) {
  const total = values.reduce((s, v) => s + v.value, 0)
  let offset = 0
  return <div className="donut-wrap"><svg viewBox="0 0 42 42" className="donut" role="img" aria-label={`Total ${money(total)}`}>
    <circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef2f7" strokeWidth="6"/>
    {values.filter(v => v.value).map(v => { const length = v.value / total * 100; const el = <circle key={v.label} cx="21" cy="21" r="15.9" fill="none" stroke={v.color} strokeWidth="6" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-offset} transform="rotate(-90 21 21)"/>; offset += length; return el })}
    <text x="21" y="19.7" textAnchor="middle">Total</text><text x="21" y="23.4" textAnchor="middle" className="donut-total">{money(total).replace('R$ ','')}</text>
  </svg><div className="legend">{values.filter(v => v.value).map(v => <div key={v.label}><i style={{background:v.color}}/><span>{v.label}</span><b>{money(v.value)}</b></div>)}</div></div>
}

function Dashboard({ state, month, setTab, setModal, onQuick, flash }: { state: DemoState; month: string; setTab:(t:Tab)=>void; setModal:(m:Modal)=>void; onQuick:(i:Income|Expense)=>void; flash:(s:string)=>void }) {
  const expenses = monthExpenses(state, month), incomes = monthIncomes(state, month), byCategory = spendByCategory(state, month)
  const [quick, setQuick] = useState({description:'',amount:'',category:'Alimentação',type:'Despesa'})
  const [chartType, setChartType] = useState<'Despesas'|'Receitas'>('Despesas')
  const [chartView, setChartView] = useState<'Rosca'|'Barras'>('Rosca')
  const [expanded, setExpanded] = useState(false), [diagnosis, setDiagnosis] = useState(false)
  const [goalCat, setGoalCat] = useState<Category>('Alimentação'), [goalValue, setGoalValue] = useState('')
  const occurrencesThisMonth = monthOccurrences(state, month)
  const unpaidOutside = occurrencesThisMonth.filter(o => !o.forecast && o.expense.method !== 'Cartão' && !o.expense.paid)
  const openInvoices = state.cards.reduce((s,c)=>s+(invoicePaid(state,c.id,month)?0:invoiceTotal(state,c.id,month)),0)
  const payable = unpaidOutside.reduce((s,o)=>s+o.amount,0)+openInvoices
  const budget = state.budgets[month] || {}, ranked = categories.map(c => ({c,spent:byCategory[c],limit:budget[c]||0,p:(byCategory[c]/(budget[c]||1))*100})).sort((a,b)=>b.p-a.p).slice(0,3)
  const transactions = [
    ...occurrencesThisMonth.filter(o=>!o.forecast).map(o=>({id:o.key,date:o.expense.date,description:o.expense.description,category:o.expense.category,amount:-o.amount,type:'Despesa',expense:o.expense,status:occurrenceStatus(o)})),
    ...state.incomes.filter(i=>monthOf(i.date)===month).map(i=>({id:i.id,date:i.date,description:i.description,category:i.category,amount:i.amount,type:'Receita',income:i,status:'Recebida'})),
  ].sort((a,b)=>b.date.localeCompare(a.date))
  const chartValues = chartType === 'Despesas'
    ? categories.map(c=>({label:c,value:byCategory[c],color:categoryColors[c]}))
    : Array.from(new Set(state.incomes.filter(i=>monthOf(i.date)===month).map(i=>i.category))).map((c,i)=>({label:c,value:state.incomes.filter(x=>monthOf(x.date)===month&&x.category===c).reduce((s,x)=>s+x.amount,0),color:['#059669','#34D399','#6EE7B7'][i%3]}))
  const quickSubmit = () => {
    const amount=parseMoney(quick.amount); if(!quick.description.trim()||!Number.isFinite(amount)||amount<1){flash('Preencha descrição e valor válido.');return}
    if(quick.type==='Receita') setModal({kind:'income',income:{id:uid('income'),description:quick.description,amount,date:REF_DATE,category:quick.category,notes:''}})
    else setModal({kind:'expense',expense:{id:uid('expense'),description:quick.description,amount,date:REF_DATE,category:quick.category as Category,method:'Pix',dueDate:REF_DATE,notes:''}})
  }
  const largest=categories.reduce((a,b)=>byCategory[a]>byCategory[b]?a:b)
  return <>
    <section className="summary-grid">
      <div className="summary-card"><span>Saldo do mês</span><strong>{money(incomes-expenses)}</strong></div>
      <div className="summary-card"><span>Receitas</span><strong className="green">{money(incomes)}</strong></div>
      <div className="summary-card"><span>Despesas</span><strong className="red">{money(expenses)}</strong></div>
    </section>
    <p className="summary-note">Saldo = receitas registradas menos despesas confirmadas, incluindo as contas a pagar. Esse saldo não é saldo bancário.</p>
    <section className="card"><div className="card-head"><div><h2>Nova transação</h2><p>Adicione um registro e revise antes de salvar.</p></div><button className="text-link" onClick={()=>setModal({kind:'expense',receipt:true})}>Usar recibo de exemplo</button></div>
      <div className="quick-grid"><Field label="Descrição"><input value={quick.description} onChange={e=>setQuick({...quick,description:e.target.value})}/></Field><Field label="Valor (R$)"><input value={quick.amount} inputMode="decimal" onChange={e=>setQuick({...quick,amount:e.target.value})}/></Field><Field label="Categoria"><select value={quick.category} onChange={e=>setQuick({...quick,category:e.target.value})}>{(quick.type==='Receita'?['Salário','Trabalho extra','Outros']:categories).map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Tipo"><select value={quick.type} onChange={e=>setQuick({...quick,type:e.target.value,category:e.target.value==='Receita'?'Salário':'Alimentação'})}><option>Despesa</option><option>Receita</option></select></Field></div>
      <Button className="full" onClick={quickSubmit}>Revisar transação</Button>
    </section>
    <section className="card"><div className="card-head"><div><h2>Contas do mês</h2><p>Compromissos confirmados e próximos vencimentos.</p></div><button className="text-link" onClick={()=>setTab('Agenda')}>Consultar agenda</button></div>
      <div className="account-summary"><div><span>A pagar</span><b>{money(payable)}</b></div><div><span>Faturas em aberto</span><b>{money(openInvoices)}</b></div><div><span>Próximo vencimento</span><b>{unpaidOutside.sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0]?`${dateBR(unpaidOutside[0].dueDate).slice(0,5)} · ${unpaidOutside[0].expense.description}`:'Tudo pago'}</b></div></div>
      {unpaidOutside.some(o=>occurrenceStatus(o)==='Atrasada')&&<div className="alert">1 conta em atraso. Energia elétrica venceu em 08/11/2026.</div>}
    </section>
    <section className="card"><div className="card-head"><div><h2>Metas de gastos do mês</h2><p>Resumo das três metas mais utilizadas.</p></div><button className="text-link" onClick={()=>setTab('Orçamento')}>Ver orçamento</button></div>
      <div className="goal-form"><Field label="Categoria"><select value={goalCat} onChange={e=>setGoalCat(e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Limite mensal (R$)"><input value={goalValue} onChange={e=>setGoalValue(e.target.value)}/></Field><Button onClick={()=>{const n=parseMoney(goalValue);if(Number.isFinite(n)&&n>=0){onQuick({...state.incomes[0],id:'__budget__',amount:n,category:goalCat});setGoalValue('')}}}>Salvar meta</Button></div>
      <div className="goals">{ranked.map(r=><div key={r.c}><div><b>{r.c}</b><span>{money(r.spent)} / {money(r.limit)} · {Math.round(r.p)}%</span></div><div className="progress"><i style={{width:`${Math.min(r.p,100)}%`}}/></div><small>{r.p>100?`Acima do limite em ${money(r.spent-r.limit)}`:r.p>=80?'Próximo do limite':'Dentro do planejado'}</small></div>)}</div>
    </section>
    <section className="card"><div className="card-head"><div><h2>Para onde vai o dinheiro</h2><p>Distribuição do mês selecionado.</p></div><div className="segments"><button className={chartType==='Despesas'?'active':''} onClick={()=>setChartType('Despesas')}>Despesas</button><button className={chartType==='Receitas'?'active':''} onClick={()=>setChartType('Receitas')}>Receitas</button><button className={chartView==='Rosca'?'active':''} onClick={()=>setChartView('Rosca')}>Rosca</button><button className={chartView==='Barras'?'active':''} onClick={()=>setChartView('Barras')}>Barras</button></div></div>
      {chartView==='Rosca'?<Donut values={chartValues}/>:<div className="bar-chart">{chartValues.filter(v=>v.value).map(v=><div key={v.label}><span>{v.label}</span><i><b style={{width:`${v.value/Math.max(...chartValues.map(x=>x.value))*100}%`,background:v.color}}/></i><strong>{money(v.value)}</strong></div>)}</div>}
    </section>
    <section className="card"><div className="card-head"><div><h2>Últimas transações</h2><p>Receitas e despesas reunidas.</p></div><button className="text-link" onClick={()=>setExpanded(!expanded)}>{expanded?'Mostrar recentes':'Ver todas'}</button></div>
      <div className="transactions">{(expanded?transactions:transactions.slice(0,5)).map(t=><div className="transaction" key={t.id}><div><b>{t.description}</b><span>{t.category} · {dateBR(t.date)} · {t.status} · {t.type}</span></div><strong className={t.amount>0?'green':'red'}>{t.amount>0?'+':'−'} {money(Math.abs(t.amount))}</strong><div className="row-actions"><button aria-label={`Editar ${t.description}`} onClick={()=>setModal(t.expense?{kind:'expense',expense:t.expense}:{kind:'income',income:t.income})}><Icon name="edit"/></button><button aria-label={`Excluir ${t.description}`} onClick={()=>setModal(t.expense?{kind:'deleteExpense',expense:t.expense}:{kind:'deleteIncome',income:t.income!})}><Icon name="trash"/></button></div></div>)}</div>
    </section>
    <section className="card"><div className="card-head"><div><h2>Diagnóstico financeiro</h2><p>Análise simples por regras locais, sem IA externa.</p></div><Button variant="success" onClick={()=>setDiagnosis(true)}>Analisar finanças</Button></div>
      {diagnosis&&<div className="diagnosis"><div><b>Raio-X</b><p>Maior categoria: {largest}, com {money(byCategory[largest])}.</p></div><div><b>Resultado do mês</b><p>{incomes-expenses>=0?'Resultado positivo':'Resultado negativo'} de {money(Math.abs(incomes-expenses))}. Não é previsão de saldo bancário.</p></div><div><b>Próximos passos</b><p>{unpaidOutside.filter(o=>occurrenceStatus(o)==='Atrasada').length} conta(s) em atraso. Revise compromissos e metas.</p></div></div>}
    </section>
  </>
}

function ExpensesPage({ state, month, setMonth, setModal }: {state:DemoState;month:string;setMonth:(m:string)=>void;setModal:(m:Modal)=>void}) {
  const [search,setSearch]=useState(''),[cat,setCat]=useState('Todas'),[status,setStatus]=useState('Todas'),[method,setMethod]=useState('Todos')
  const rows=monthOccurrences(state,month).filter(o=>{
    const s=occurrenceStatus(o); return o.expense.description.toLowerCase().includes(search.toLowerCase())&&(cat==='Todas'||o.expense.category===cat)&&(method==='Todos'||o.expense.method===method)&&(status==='Todas'||s===status||(status==='Pendências'&&(s==='Pendente'||s==='Atrasada')))
  })
  return <section className="card"><div className="card-head"><div><h2>Suas despesas</h2><p>Compras parceladas aparecem pela parcela do mês.</p></div><Button variant="secondary" onClick={()=>setModal({kind:'expense',receipt:true})}>Usar recibo de exemplo</Button></div>
    <div className="filters"><Field label="Buscar por descrição"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex.: supermercado"/></Field><Field label="Categoria"><select value={cat} onChange={e=>setCat(e.target.value)}><option>Todas</option>{categories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Situação"><select value={status} onChange={e=>setStatus(e.target.value)}>{['Todas','Pendências','Pendente','Atrasada','Paga','Previsão'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Pagamento"><select value={method} onChange={e=>setMethod(e.target.value)}>{['Todos','Pix','Dinheiro','Débito','Boleto','Cartão'].map(s=><option key={s}>{s}</option>)}</select></Field><Button variant="secondary" onClick={()=>{setSearch('');setCat('Todas');setStatus('Todas');setMethod('Todos')}}>Limpar</Button></div>
    {rows.length?<><div className="table"><div className="tr th"><span>Descrição e categoria</span><span>Data / competência</span><span>Pagamento</span><span>Situação</span><span>Valor</span><span>Ações</span></div>{rows.map(o=><div className="tr" key={o.key}><button className="desc-cell" onClick={()=>setModal({kind:'details',expense:o.expense})}><b>{o.expense.description}</b><small>{o.expense.category}{o.installment?` · Parcela ${o.installment}/${o.totalInstallments}`:''}</small></button><span>{o.expense.method==='Cartão'?dateBR(o.dueDate):dateBR(o.expense.date)}</span><span>{o.expense.method}</span><span><Status>{occurrenceStatus(o)}</Status></span><b>{money(o.amount)}</b><div className="row-actions"><button aria-label="Editar" onClick={()=>setModal({kind:'expense',expense:o.expense})}><Icon name="edit"/></button><button aria-label="Excluir" onClick={()=>setModal({kind:'deleteExpense',expense:o.expense})}><Icon name="trash"/></button></div></div>)}</div><div className="table-total"><span>{rows.length} lançamento(s)</span><b>Total filtrado: {money(rows.reduce((s,o)=>s+o.amount,0))}</b></div></>:<div className="empty"><h3>Nenhuma despesa encontrada</h3><p>Limpe os filtros ou cadastre uma nova despesa.</p><Button onClick={()=>setModal({kind:'expense'})}>Nova despesa</Button></div>}
  </section>
}

function Agenda({state,month,setModal}:{state:DemoState;month:string;setModal:(m:Modal)=>void}) {
  const [filter,setFilter]=useState('Pendências')
  const outside=monthOccurrences(state,month).filter(o=>o.expense.method!=='Cartão')
  const invoices=state.cards.map(card=>{const total=invoiceTotal(state,card.id,month);return total?{card,total,paid:invoicePaid(state,card.id,month),dueDate:dateInMonth(month,card.dueDay),forecast:month>'2026-11'}:null}).filter(Boolean) as {card:Card;total:number;paid:ReturnType<typeof invoicePaid>;dueDate:string;forecast:boolean}[]
  const match=(s:string)=>filter==='Todas'||filter===s||(filter==='Pendências'&&(s==='Pendente'||s==='Atrasada'))||(filter==='Atrasadas'&&s==='Atrasada')||(filter==='Pagas'&&s==='Paga')||(filter==='Previsões'&&s==='Previsão')
  const rows=[...outside.map(o=>({key:o.key,name:o.expense.description,amount:o.amount,due:o.dueDate,status:occurrenceStatus(o),occ:o})),...invoices.map(i=>({key:`inv-${i.card.id}`,name:`Fatura · ${i.card.name}`,amount:i.total,due:i.dueDate,status:i.forecast?'Previsão':i.paid?'Paga':i.dueDate<REF_DATE?'Atrasada':'Pendente',invoice:i}))].filter(r=>match(r.status)).sort((a,b)=>a.due.localeCompare(b.due))
  return <><div className="calendar-banner"><Icon name="calendar"/><div><b>{rows.filter(r=>r.status==='Pendente'||r.status==='Atrasada').length} compromissos aguardando registro</b><p>Registre somente pagamentos já realizados. Nenhum valor é movimentado pela plataforma.</p></div></div>
    <section className="card"><div className="card-head"><div><h2>Contas por vencimento</h2><p>Contas e faturas, sem duplicar os lançamentos.</p></div></div><div className="filter-tabs">{['Pendências','Todas','Atrasadas','Pagas','Previsões'].map(f=><button className={filter===f?'active':''} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>
      {rows.length?<div className="agenda-list">{rows.map(r=><div key={r.key}><div><b>{r.name}</b><span>Vencimento {dateBR(r.due)}</span></div><Status>{r.status}</Status><strong>{money(r.amount)}</strong>{r.status==='Previsão'?<span className="muted">Somente previsão</span>:<Button variant="secondary" onClick={()=>r.occ?setModal({kind:'payment',occurrence:r.occ}):setModal({kind:'invoice',card:r.invoice!.card})}>{r.status==='Paga'?'Ver pagamento':'Registrar pagamento'}</Button>}</div>)}</div>:<div className="empty"><h3>Tudo certo por aqui</h3><p>Não há compromissos neste filtro.</p></div>}
    </section></>
}

function CardsPage({state,month,setMonth,setModal}:{state:DemoState;month:string;setMonth:(m:string)=>void;setModal:(m:Modal)=>void}) {
  const [selected,setSelected]=useState(state.cards[0]?.id||'')
  useEffect(()=>{if(!state.cards.some(c=>c.id===selected))setSelected(state.cards[0]?.id||'')},[state.cards,selected])
  const card=state.cards.find(c=>c.id===selected)
  if(!card)return <div className="empty card"><Icon name="card"/><h3>Adicione seu primeiro cartão</h3><p>Cadastre apenas nome, datas, cor e os últimos quatro dígitos opcionais.</p><Button onClick={()=>setModal({kind:'card'})}>Adicionar cartão</Button></div>
  const occ=monthOccurrences(state,month).filter(o=>o.expense.cardId===card.id),total=occ.filter(o=>!o.forecast).reduce((s,o)=>s+o.amount,0),paid=invoicePaid(state,card.id,month),forecast=month>'2026-11'
  const future=[1,2,3,4,5,6].map(i=>{const m=addMonths(month,i),os=monthOccurrences(state,m).filter(o=>o.expense.cardId===card.id);return{m,value:os.reduce((s,o)=>s+o.amount,0),count:os.length}}).filter(x=>x.value)
  return <><div className="cards-layout"><section className="card"><div className="card-head"><h2>Seus cartões</h2><Button variant="secondary" onClick={()=>setModal({kind:'card'})}><Icon name="plus"/> Adicionar</Button></div><div className="card-strip">{state.cards.map(c=><button key={c.id} className={`credit-card ${c.id===selected?'selected':''}`} style={{background:c.color}} onClick={()=>setSelected(c.id)}><span>{c.name}</span><i/><b>•••• {c.last4||'••••'}</b><small>Fecha dia {c.closingDay} · vence dia {c.dueDay}</small></button>)}</div></section>
    <section className="card invoice-summary"><div className="card-head"><div><h2>{card.name}</h2><p>{monthLabel(month)}</p></div><Status>{forecast?'Previsão':paid?'Paga':'Pendente'}</Status></div><strong>{money(total||occ.reduce((s,o)=>s+o.amount,0))}</strong><p>Vencimento em {dateBR(dateInMonth(month,card.dueDay))}</p><p className="hint">A quitação reduz o saldo a pagar. As compras são contadas uma única vez.</p>{forecast?<Button disabled>Quitação indisponível em previsões</Button>:<Button onClick={()=>setModal({kind:'invoice',card})}>{paid?'Consultar / corrigir quitação':'Registrar quitação'}</Button>}</section></div>
    <section className="card"><div className="card-head"><div><h2>Lançamentos da fatura</h2><p>Compras e parcelas do mês.</p></div><Button onClick={()=>setModal({kind:'expense',presetCard:card.id})}>Compra no cartão</Button></div>{occ.length?<div className="invoice-list">{occ.map(o=><button key={o.key} onClick={()=>setModal({kind:'details',expense:o.expense})}><div><b>{o.expense.description}</b><span>{o.expense.category} · compra em {dateBR(o.expense.date)}</span></div><span>Parcela {o.installment} de {o.totalInstallments}</span><strong>{money(o.amount)}</strong></button>)}</div>:<div className="empty"><h3>Nenhuma compra nesta fatura</h3><p>As compras do cartão aparecerão aqui.</p></div>}</section>
    <section className="card"><div className="card-head"><div><h2>Compromissos futuros</h2><p>Parcelas previstas, separadas dos gastos confirmados.</p></div></div>{future.length?<div className="future-grid">{future.map(f=><div key={f.m}><Status>Previsão</Status><b>{monthLabel(f.m)}</b><strong>{money(f.value)}</strong><span>{f.count} parcela(s)</span><Button variant="secondary" onClick={()=>setMonth(f.m)}>Consultar fatura</Button></div>)}</div>:<div className="empty"><h3>Sem parcelas futuras</h3><p>Não há compromissos previstos para este cartão.</p></div>}</section></>
}

function BudgetPage({state,month,setModal,openExpenses}:{state:DemoState;month:string;setModal:(m:Modal)=>void;openExpenses:(c:Category)=>void}) {
  const spent=spendByCategory(state,month),budget=state.budgets[month]||{},planned=categories.reduce((s,c)=>s+(budget[c]||0),0),total=monthExpenses(state,month)
  return <><section className="budget-summary card"><div><span>Orçamento planejado</span><b>{money(planned)}</b></div><div><span>Gastos confirmados</span><b>{money(total)}</b></div><div><span>Saldo disponível</span><b>{money(planned-total)}</b></div><Button onClick={()=>setModal({kind:'budgets'})}>Editar limites</Button></section>
    <div className="budget-grid">{categories.map(c=>{const limit=budget[c]||0,p=limit?spent[c]/limit*100:0,status=!limit?'Sem limite definido':p>100?'Acima do limite':p>=80?'Próximo do limite':'Dentro do planejado';return <section className="category-card" key={c}><div className="category-head"><i style={{background:categoryColors[c]}}>{categoryIcons[c]}</i><h2>{c}</h2><button aria-label={`Editar limite de ${c}`} onClick={()=>setModal({kind:'budgets',category:c})}><Icon name="edit"/></button></div><strong>{money(spent[c])}</strong><span>de {money(limit)}</span><div className={`progress ${p>100?'over':p>=80?'near':''}`}><i style={{width:`${Math.min(p,100)}%`}}/></div><div className="category-status"><b>{status}</b><span>{limit?(p>100?`${money(spent[c]-limit)} excedidos`:`${Math.round(p)}% · ${money(limit-spent[c])} restantes`):'Defina um limite para acompanhar'}</span></div><button className="text-link" onClick={()=>openExpenses(c)}>Consultar despesas</button></section>})}</div></>
}

function App() {
  const [state,setState]=useState<DemoState>(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return seedState();const parsed=JSON.parse(raw);if(validState(parsed))return{...parsed,incomes:Array.isArray(parsed.incomes)?parsed.incomes:[],invoicePayments:Array.isArray(parsed.invoicePayments)?parsed.invoicePayments:[]};return seedState()}catch{return seedState()}})
  const [tab,setTab]=useState<Tab>('Dashboard'),[month,setMonth]=useState('2026-11'),[modal,setModal]=useState<Modal>(null),[notice,setNotice]=useState(''),[storageError,setStorageError]=useState(false)
  const [undo,setUndo]=useState<{label:string;restore:()=>void}|null>(null)
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));setStorageError(false)}catch{setStorageError(true)}},[state])
  useEffect(()=>{if(!undo)return;const id=setTimeout(()=>setUndo(null),20000);return()=>clearTimeout(id)},[undo])
  const flash=(text:string)=>{setNotice(text);setTimeout(()=>setNotice(''),4000)}
  const saveExpense=(expense:Expense)=>{setState(s=>({...s,expenses:s.expenses.some(e=>e.id===expense.id)?s.expenses.map(e=>e.id===expense.id?expense:e):[...s.expenses,expense]}));setMonth(monthOf(expense.method==='Cartão'?occurrences(expense,state.cards)[0]?.month||expense.date:expense.date));setModal(null);flash('Despesa salva com sucesso.')}
  const saveIncome=(income:Income)=>{setState(s=>({...s,incomes:s.incomes.some(i=>i.id===income.id)?s.incomes.map(i=>i.id===income.id?income:i):[...s.incomes,income]}));setMonth(monthOf(income.date));setModal(null);flash('Receita salva com sucesso.')}
  const deleteExpense=(expense:Expense)=>{const previous=state;setState(s=>({...s,expenses:s.expenses.filter(e=>e.id!==expense.id)}));setUndo({label:`${expense.description} foi excluída.`,restore:()=>setState(previous)});setModal(null)}
  const deleteIncome=(income:Income)=>{const previous=state;setState(s=>({...s,incomes:s.incomes.filter(i=>i.id!==income.id)}));setUndo({label:`${income.description} foi excluída.`,restore:()=>setState(previous)});setModal(null)}
  const title=tab==='Dashboard'?'Visão geral':tab
  const subtitle:Record<Tab,string>={Dashboard:'Acompanhe seu mês em um só lugar.',Despesas:'Consulte, organize e revise cada lançamento.',Agenda:'Contas e faturas em ordem de vencimento.','Cartões e faturas':'Acompanhe as compras e as próximas parcelas.',Orçamento:'Defina limites e acompanhe seus gastos.'}
  const updateBudget=(data:Record<Category,number>)=>{setState(s=>({...s,budgets:{...s.budgets,[month]:data}}));setModal(null);flash('Limites atualizados.')}
  const quickHandler=(item:Income|Expense)=>{if(item.id==='__budget__'){const c=item.category as Category;updateBudget({...Object.fromEntries(categories.map(x=>[x,state.budgets[month]?.[x]||0])) as Record<Category,number>,[c]:item.amount})}else if('method'in item)saveExpense(item);else saveIncome(item)}
  return <div className="app">
    <a className="skip-link" href="#main">Pular para o conteúdo</a>
    <header className="site-header"><div><div className="brand">Infaturamento</div><p>Controle suas finanças com simplicidade.</p></div><div className="demo-tools"><span>Dados de demonstração</span><button className="icon-button" aria-label="Informações sobre a demonstração" onClick={()=>setModal({kind:'about'})}><Icon name="info"/></button></div></header>
    <nav className="tabs" aria-label="Áreas do Infaturamento">{(['Dashboard','Despesas','Agenda','Cartões e faturas','Orçamento'] as Tab[]).map(t=><button key={t} className={tab===t?'active':''} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
    <main id="main">
      <div className="page-head"><div><h1>{title}</h1><p>{subtitle[tab]}</p></div><div><Field label="Mês"><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></Field><Button onClick={()=>setModal({kind:'expense'})}><Icon name="plus"/> Nova despesa</Button></div></div>
      {storageError&&<div className="warning">Não foi possível salvar. Os dados estão somente nesta sessão.</div>}
      {tab==='Dashboard'&&<Dashboard state={state} month={month} setTab={setTab} setModal={setModal} onQuick={quickHandler} flash={flash}/>}
      {tab==='Despesas'&&<ExpensesPage state={state} month={month} setMonth={setMonth} setModal={setModal}/>}
      {tab==='Agenda'&&<Agenda state={state} month={month} setModal={setModal}/>}
      {tab==='Cartões e faturas'&&<CardsPage state={state} month={month} setMonth={setMonth} setModal={setModal}/>}
      {tab==='Orçamento'&&<BudgetPage state={state} month={month} setModal={setModal} openExpenses={()=>setTab('Despesas')}/>}
    </main>
    <footer><span>Dados fictícios · Referência: 10/11/2026</span><button onClick={()=>setModal({kind:'about'})}>Salvo neste navegador · Sobre a demo</button></footer>
    {notice&&<div className="toast" role="status">{notice}</div>}{undo&&<div className="toast undo" role="status"><span>{undo.label}</span><button onClick={()=>{undo.restore();setUndo(null)}}>Desfazer</button></div>}
    {modal?.kind==='expense'&&<ExpenseForm state={state} month={month} initial={modal.expense} presetCard={modal.presetCard} presetReceipt={modal.receipt} onSave={saveExpense} close={()=>setModal(null)}/>}
    {modal?.kind==='income'&&<IncomeForm initial={modal.income} onSave={saveIncome} close={()=>setModal(null)}/>}
    {modal?.kind==='details'&&<DetailsModal expense={modal.expense} state={state} close={()=>setModal(null)} edit={()=>setModal({kind:'expense',expense:modal.expense})} remove={()=>setModal({kind:'deleteExpense',expense:modal.expense})}/>}
    {modal?.kind==='deleteExpense'&&<ConfirmDelete name={modal.expense.description} value={modal.expense.amount} close={()=>setModal(null)} confirm={()=>deleteExpense(modal.expense)} linked/>}
    {modal?.kind==='deleteIncome'&&<ConfirmDelete name={modal.income.description} value={modal.income.amount} close={()=>setModal(null)} confirm={()=>deleteIncome(modal.income)}/>}
    {modal?.kind==='payment'&&<PaymentModal occurrence={modal.occurrence} onSave={(payment)=>{setState(s=>({...s,expenses:s.expenses.map(e=>e.id===modal.occurrence.expense.id?{...e,paid:payment}:e)}));setModal(null);flash(payment?'Registro de pagamento atualizado.':'Registro de pagamento desfeito.')}} close={()=>setModal(null)}/>}
    {modal?.kind==='invoice'&&<InvoicePaymentModal state={state} month={month} card={modal.card} close={()=>setModal(null)} onSave={p=>{setState(s=>({...s,invoicePayments:p?[...s.invoicePayments.filter(x=>!(x.cardId===modal.card.id&&x.month===month)),p]:s.invoicePayments.filter(x=>!(x.cardId===modal.card.id&&x.month===month))}));setModal(null);flash(p?'Quitação registrada.':'Quitação desfeita.')}}/>}
    {modal?.kind==='card'&&<CardModal close={()=>setModal(null)} onSave={card=>{setState(s=>({...s,cards:[...s.cards,card]}));setModal(null);flash('Cartão adicionado.')}}/>}
    {modal?.kind==='budgets'&&<BudgetsModal month={month} values={state.budgets[month]||{}} category={modal.category} close={()=>setModal(null)} save={updateBudget}/>}
    {modal?.kind==='about'&&<AboutModal close={()=>setModal(null)} restore={()=>setModal({kind:'restore'})}/>}
    {modal?.kind==='restore'&&<ModalShell title="Restaurar demonstração?" close={()=>setModal(null)}><p>Esta ação substituirá todos os registros atuais pelos dados fictícios iniciais.</p><div className="modal-actions"><Button variant="secondary" onClick={()=>setModal(null)}>Cancelar</Button><Button variant="danger" onClick={()=>{setState(seedState());setMonth('2026-11');setTab('Dashboard');setModal(null);flash('Demonstração restaurada.')}}>Sim, restaurar tudo</Button></div></ModalShell>}
  </div>
}

function DetailsModal({expense,state,close,edit,remove}:{expense:Expense;state:DemoState;close:()=>void;edit:()=>void;remove:()=>void}) {
  const os=occurrences(expense,state.cards),current=os.find(o=>o.month==='2026-11')||os[0]
  const locked=expense.cardId&&os.some(o=>!!invoicePaid(state,expense.cardId!,o.month))
  return <ModalShell title="Detalhes da despesa" close={close}><div className="review-hero"><strong>{expense.description}</strong><b>{money(current?.amount||expense.amount)}</b></div><dl className="review-list"><div><dt>Categoria</dt><dd>{expense.category}</dd></div><div><dt>Data original</dt><dd>{dateBR(expense.date)}</dd></div><div><dt>Pagamento</dt><dd>{expense.method}</dd></div>{expense.installments&&<><div><dt>Parcela</dt><dd>{current?.installment}/{expense.installments}</dd></div><div><dt>Total original</dt><dd>{money(expense.amount)}</dd></div></>}</dl>{locked&&<p className="warning">Esta compra pertence a uma fatura quitada. Desfaça primeiro a quitação da fatura para editar ou excluir.</p>}<div className="modal-actions"><Button variant="danger" disabled={!!locked} onClick={remove}>Excluir</Button><Button disabled={!!locked} onClick={edit}>Editar</Button></div></ModalShell>
}
function ConfirmDelete({name,value,close,confirm,linked}:{name:string;value:number;close:()=>void;confirm:()=>void;linked?:boolean}) {
  return <ModalShell title="Excluir registro?" close={close}><p><b>{name}</b> · {money(value)}</p>{linked&&<p className="warning">Todas as parcelas ou previsões vinculadas também serão removidas.</p>}<div className="modal-actions"><Button variant="secondary" onClick={close}>Cancelar</Button><Button variant="danger" onClick={confirm}>Excluir</Button></div></ModalShell>
}
function PaymentModal({occurrence,onSave,close}:{occurrence:Occurrence;onSave:(p:Expense['paid'])=>void;close:()=>void}) {
  const existing=occurrence.expense.paid,[date,setDate]=useState(existing?.date||REF_DATE),[error,setError]=useState('')
  return <ModalShell title={existing?'Consultar pagamento':'Registrar pagamento'} close={close}><p><b>{occurrence.expense.description}</b></p><Field label="Data do pagamento" error={error}><input type="date" min={occurrence.expense.date} max={REF_DATE} value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Valor pago"><input value={money(occurrence.amount)} disabled/></Field><p className="hint">Somente o valor integral. O total de despesas permanece igual.</p><div className="modal-actions">{existing&&<Button variant="danger" onClick={()=>onSave(undefined)}>Desfazer registro</Button>}<Button onClick={()=>{if(date<occurrence.expense.date||date>REF_DATE)setError('Use uma data entre a despesa e 10/11/2026.');else onSave({date,amount:occurrence.amount})}}>{existing?'Corrigir registro':'Confirmar registro'}</Button></div></ModalShell>
}
function InvoicePaymentModal({state,month,card,onSave,close}:{state:DemoState;month:string;card:Card;onSave:(p:DemoState['invoicePayments'][number]|null)=>void;close:()=>void}) {
  const existing=invoicePaid(state,card.id,month),total=invoiceTotal(state,card.id,month),[date,setDate]=useState(existing?.date||REF_DATE)
  return <ModalShell title="Quitação da fatura" close={close}><p><b>{card.name}</b> · {monthLabel(month)}</p><Field label="Data da quitação"><input type="date" max={REF_DATE} value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Valor integral"><input value={money(total)} disabled/></Field><p className="hint">A quitação não cria uma nova despesa e não duplica as compras.</p><div className="modal-actions">{existing&&<Button variant="danger" onClick={()=>onSave(null)}>Desfazer quitação</Button>}<Button onClick={()=>onSave({cardId:card.id,month,date,amount:total})}>{existing?'Corrigir quitação':'Confirmar quitação'}</Button></div></ModalShell>
}
function CardModal({onSave,close}:{onSave:(c:Card)=>void;close:()=>void}) {
  const [d,setD]=useState({name:'',color:'#4F46E5',closingDay:2,dueDay:15,last4:''}),[error,setError]=useState('')
  return <ModalShell title="Adicionar cartão" close={close}><div className="form-grid"><Field label="Nome" className="wide"><input value={d.name} onChange={e=>setD({...d,name:e.target.value})}/></Field><Field label="Cor"><input type="color" value={d.color} onChange={e=>setD({...d,color:e.target.value})}/></Field><Field label="Últimos quatro dígitos"><input inputMode="numeric" maxLength={4} value={d.last4} onChange={e=>setD({...d,last4:e.target.value.replace(/\D/g,'')})}/></Field><Field label="Dia de fechamento"><input type="number" min="1" max="28" value={d.closingDay} onChange={e=>setD({...d,closingDay:Number(e.target.value)})}/></Field><Field label="Dia de vencimento"><input type="number" min="1" max="28" value={d.dueDay} onChange={e=>setD({...d,dueDay:Number(e.target.value)})}/></Field></div><p className="hint">Não solicitamos nem armazenamos número completo ou código de segurança.</p>{error&&<p className="error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={()=>{if(!d.name.trim()||(d.last4&&d.last4.length!==4)||d.closingDay<1||d.closingDay>28||d.dueDay<1||d.dueDay>28)setError('Revise nome, dias de 1 a 28 e os quatro dígitos opcionais.');else onSave({id:uid('card'),...d,name:d.name.trim()})}}>Salvar cartão</Button></div></ModalShell>
}
function BudgetsModal({values,category,save,close,month}:{values:Partial<Record<Category,number>>;category?:Category;save:(v:Record<Category,number>)=>void;close:()=>void;month:string}) {
  const [draft,setDraft]=useState(Object.fromEntries(categories.map(c=>[c,inputMoney(values[c]||0)])) as Record<Category,string>),shown=category?[category]:categories
  return <ModalShell title={category?`Editar limite · ${category}`:'Editar limites'} close={close}><p className="hint">Limites independentes para {monthLabel(month)}.</p><div className="budget-fields">{shown.map(c=><Field key={c} label={`${c} (R$)`}><input inputMode="decimal" value={draft[c]} onChange={e=>setDraft({...draft,[c]:e.target.value})}/></Field>)}</div><div className="modal-actions"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={()=>{const next=Object.fromEntries(categories.map(c=>[c,parseMoney(draft[c])])) as Record<Category,number>;if(Object.values(next).every(v=>Number.isFinite(v)&&v>=0&&v<=100000000))save(next)}}>Salvar limites</Button></div></ModalShell>
}
function AboutModal({close,restore}:{close:()=>void;restore:()=>void}) {
  return <ModalShell title="Sobre a demonstração" close={close}><div className="about-copy"><p>Todos os dados são fictícios e a data de referência é fixa em <b>10/11/2026</b>.</p><p>Sugestões e diagnósticos usam somente regras locais, sem IA externa. As alterações ficam armazenadas apenas neste navegador.</p><p>O Infaturamento registra pagamentos já realizados, mas não movimenta dinheiro, não se conecta a bancos e não realiza pagamentos reais.</p></div><div className="modal-actions"><Button variant="danger" onClick={restore}>Restaurar demonstração</Button><Button onClick={close}>Entendi</Button></div></ModalShell>
}

export default App
