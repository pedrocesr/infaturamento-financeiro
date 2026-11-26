import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAiMiddleware, generateReport, validateSummary, validateReport } from '../server/ai.mjs';
const names = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Outros'];
const summary = () => ({ month: '2026-11', incomeCents: 485000, expenseCents: 10000, pendingCents: 5000, categories: names.map((name, index) => ({ name, spentCents: index ? 0 : 10000, limitCents: 20000 })) });
const report = () => ({ summary: 'Os gastos se concentram em Alimentação.', tips: names.slice(0, 3).map(category => ({ category, title: `Revisar ${category}`, reason: 'Confira os valores do mês informado.', action: 'Revise o planejamento antes de uma nova compra.' })) });
const vendor = value => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });

test('reconstrói resumo e descarta dados pessoais e campos inesperados', () => {
  const input = summary(); input.name = 'Nome privado'; input.transactions = ['Descrição privada']; input.categories[0].notes = 'Observação privada';
  assert.deepEqual(validateSummary(input), summary());
});
test('rejeita valores negativos, categorias duplicadas e totais incompatíveis', () => {
  assert.throws(() => validateSummary({ ...summary(), expenseCents: -1 }));
  assert.throws(() => validateSummary({ ...summary(), expenseCents: 12345 }));
  const input = summary(); input.categories[1].name = 'Alimentação';
  assert.throws(() => validateSummary(input));
});
test('exige exatamente três dicas completas e categorias válidas', () => {
  assert.deepEqual(validateReport(report()), report());
  assert.throws(() => validateReport({ ...report(), tips: report().tips.slice(0, 2) }));
  assert.throws(() => validateReport({ ...report(), summary: '' }));
});
test('chamada correta ao provedor; chave fica no header e relatório inclui origem/modelo', async () => {
  let called = false;
  const result = await generateReport(summary(), { apiKey: 'fake-test-key', model: 'gemini-3.5-flash-lite', fetchImpl: async (url, options) => {
    called = true; assert.match(url, /:generateContent$/); assert.ok(!url.includes('fake-test-key'));
    assert.equal(options.headers['x-goog-api-key'], 'fake-test-key');
    const payload = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text), summary());
    assert.equal(payload.generationConfig.responseSchema.properties.tips.maxItems, 3);
    return vendor(report());
  } });
  assert.equal(called, true); assert.equal(result.provider, 'Google Gemini'); assert.equal(result.month, '2026-11'); assert.equal(result.tips.length, 3);
});
test('sem chave não chama rede nem apresenta dicas falsas', async () => {
  await assert.rejects(generateReport(summary(), { fetchImpl: () => { throw Error('Não deveria chamar'); } }), /IA não configurada/);
});
test('trata cota e resposta incompleta sem fallback disfarçado de IA', async () => {
  await assert.rejects(generateReport(summary(), { apiKey: 'fake', fetchImpl: async () => new Response('', { status: 429 }) }), /limite de uso/);
  await assert.rejects(generateReport(summary(), { apiKey: 'fake', fetchImpl: async () => vendor({ summary: 'Incompleto', tips: [] }) }), /não concluiu/);
});
test('API local verifica origem, método, configuração e resposta; não revela chave', async () => {
  const middleware = createAiMiddleware({ apiKey: 'fake-test-key', fetchImpl: async () => vendor(report()) });
  const server = http.createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await fetch(url + '/api/ai/status').then(response => response.json());
    assert.equal(status.configured, true); assert.ok(!JSON.stringify(status).includes('fake-test-key'));
    const response = await fetch(url + '/api/ai/diagnostico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summary()) });
    assert.equal(response.status, 200); assert.equal((await response.json()).tips.length, 3);
    assert.equal((await fetch(url + '/api/ai/diagnostico')).status, 405);
    const forbidden = await fetch(url + '/api/ai/diagnostico', { method: 'POST', headers: { Origin: 'https://outro-site.example', 'Content-Type': 'application/json' }, body: JSON.stringify(summary()) });
    assert.equal(forbidden.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
