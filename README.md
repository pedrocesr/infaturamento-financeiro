# infaturamento-financeiro
Protótipo de organização financeira pessoal e familiar, com controle de receitas, despesas, contas, cartões e orçamento mensal.

## Relatório personalizado com IA

O Dashboard inclui **Gerar 3 dicas com IA**, integrado à API do Google Gemini. O servidor envia somente os totais do mês por categoria, receitas, limites e valor pendente. O modelo gera um resumo e três dicas com categoria, justificativa e ação. Descrições, nomes, observações, recibos e números de cartão não são enviados.

O botão exige consentimento. Trocar o mês ou os valores invalida a análise anterior. A resposta identifica provedor e modelo. Falhas de conexão, chave, cota ou conteúdo incompleto aparecem como erro: o aplicativo não apresenta regras locais como se fossem IA.

O resumo por regras continua disponível em um botão separado. A sugestão de categoria e o recibo de exemplo continuam locais; apenas o novo relatório chama o modelo.

### Configurar a chave e executar

1. Acesse https://aistudio.google.com/apikey com sua conta Google e crie uma chave para um projeto. Confira a disponibilidade e cota gratuita na sua conta; não é necessário habilitar cobrança para tentar um modelo que tenha faixa gratuita disponível.
2. Na raiz do projeto, copie `.env.example` para `.env.local`. Se o arquivo já existir, edite-o sem substituí-lo.
3. Preencha localmente:

```dotenv
GEMINI_API_KEY=COLE_SUA_CHAVE_AQUI
GEMINI_MODEL=gemini-3.5-flash-lite
```

Não use prefixo `VITE_` para a chave. Não compartilhe a chave em mensagens ou capturas. `.env.local` está no `.gitignore`; `.env.example`, sem chave, pode ser versionado.

4. No terminal da pasta do projeto:

```bash
npm install
npm run dev -- --port 5174
```

5. Abra http://127.0.0.1:5174. No Dashboard, vá a Diagnóstico financeiro, marque a autorização para enviar os totais e clique em Gerar 3 dicas com IA. Ao alterar a chave, reinicie o servidor.

O modelo pode ser trocado em `GEMINI_MODEL` conforme a disponibilidade da conta. Uma resposta 429 pode indicar falta de cota: confirme no AI Studio antes de habilitar qualquer plano pago.

### Onde a integração funciona

A integração funciona no servidor local iniciado por `npm run dev`. Também está conectada a `npm run preview` depois do build. A chave é lida pelo servidor, sem entrar no JavaScript entregue ao navegador. Existe limite local de 10 chamadas por hora e somente uma análise simultânea por processo.

O diretório `dist` contém apenas o frontend. Publicar os arquivos no GitHub, GitHub Pages ou em uma hospedagem estática não cria o endpoint de IA. A publicação do Figma Make também não é atualizada por estas alterações locais. Para disponibilizar a IA online, será necessário hospedar um backend com variáveis secretas, autenticação e limites de uso adequados. Nesta entrega, o caminho de demonstração é pelo VS Code.

### Testar

```bash
npm run check
```

Executa TypeScript, sete testes de integração com respostas do provedor simuladas e o build de produção. Os testes verificam payload agregado, remoção de campos pessoais, três dicas completas, chave somente no servidor, falta de configuração, cota, resposta incompleta e validação do endpoint local.

O fluxo de interface foi conferido em Chrome desktop e largura de celular, incluindo testes com resposta simulada e falhas de configuração/cota. **Em 26/11/2026 também foi executada com sucesso uma chamada real autenticada ao Google Gemini, modelo `gemini-3.5-flash-lite`, que gerou um resumo e exatamente três dicas.** Essa chamada usou somente os totais fictícios da demonstração em um perfil isolado. A chave não foi lida nem exibida no relatório de testes.

Para apresentar o trabalho: execute localmente, gere a análise com o botão de IA e mostre provedor/modelo e as três dicas. Explique que os totais são calculados pelo aplicativo e a interpretação e as sugestões são geradas pelo modelo. As dicas não alteram os registros. A disponibilidade futura depende da chave, da cota da conta e da conexão; não confundir os testes simulados com a chamada real.

### Escopo

Use dados fictícios no trabalho. A faixa gratuita do Gemini pode utilizar o conteúdo para melhoria dos serviços, conforme as condições do provedor. As dicas podem conter erros e devem ser revisadas; nenhuma transação, pagamento ou limite é alterado pela IA.

Documentação oficial: [chaves](https://aistudio.google.com/docs/api-key), [preços e condições](https://aistudio.google.com/docs/pricing), [API de geração](https://aistudio.google.com/api-reference/generate-content).
