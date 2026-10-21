# EnerFactura — Plano do Projeto (teste técnico Grupo EMAX)

> Documento interno de decisões e planejamento. A entrega para a EMAX (UI e README) será em **espanhol**.
> Fonte: `EnerFactura_EMAX (1).pdf` (9 páginas).

---

## 1. Resumo do teste

| Item | Valor |
|---|---|
| Vaga | Desenvolvedor Full Stack (perfil sênior) |
| Produto | EnerFactura: faturamento e contabilidade para autônomos e PMEs espanholas |
| Tempo | **Máximo de 3h de trabalho efetivo** (o tempo investido precisa ser declarado) |
| Tecnologia | Livre escolha. IA, assistentes e serviços externos são permitidos |
| Entrega | App funcional (de preferência link público) + código-fonte + README |
| Referências | Contasimple (só como referência funcional, **não copiar a UI**) e Agencia Tributaria (Modelos 303, 111 e 349) |

**A mensagem central do PDF, repetida 4 vezes:** um app pequeno e **realmente conectado** vale mais que um app bonito com seções soltas.
- "Valoraremos más una aplicación pequeña y realmente funcional…" (p.3)
- "Es preferible un circuito completo que funcione correctamente…" (p.6)
- "Una aplicación visualmente atractiva pero sin funcionamiento real recibirá una valoración inferior…" (p.9)

## 2. Critérios de avaliação → estratégia

| Critério | Pts | O que fazemos para pontuar |
|---|---|---|
| Funcionamento real | **30** | Circuito completo: contato → fatura/gasto → dashboard → impostos, tudo derivado do banco. Casos A–E passando. |
| OCR e automação | **20** | Extração real com LLM de visão, JSON estruturado, validação cruzada dos valores, vínculo automático com o fornecedor pelo NIF, campos editáveis antes de salvar. |
| UX/UI e simplicidade | **20** | Formulários curtos, valores calculados ao vivo, criação de contato inline, mensagens claras em espanhol, responsivo. |
| Qualidade do código | **15** | Domínio fiscal em TS puro e testado, separado da UI. Zod compartilhado. Componentes reutilizáveis. |
| Autonomia | **10** | Decisões documentadas, suposições fiscais explícitas, seção de dificuldades honesta. |
| Documentação | **5** | README em espanhol com tudo o que a seção 9 pede + respostas às 3 perguntas finais. |

## 3. Requisitos por prioridade (seção 5 do PDF)

### P1 — Estrutura e Dashboard
- Navegação clara entre as seções.
- Resumo: **ingresos, gastos, balance, facturas pendientes de cobro**.
- Os números **se atualizam ao registrar operações**, ou seja, são calculados a partir do banco e nunca guardados como valores fixos.

### P2 — Faturamento funcional
- Criar ou selecionar cliente.
- Linhas com conceito, quantidade e preço.
- Cálculo de IVA e total.
- Salvar, consultar e **mudar o status de cobrança**.

### P3 — Gastos e faturas recebidas
- Registrar gastos e fornecedores.
- Base imponible, IVA e **IRPF quando houver**.
- Guardar documentos e consultar o histórico.

### P4 — OCR
- Subir PDF ou imagem → **extração real** → preencher campos → permitir edição → salvar.
- Se ficar incompleto: entregar um fluxo parcial operacional e explicar o que falta.

### P5 — Impostos
- **303:** IVA repercutido − IVA soportado deducible.
- **111:** retenções praticadas em faturas recebidas de profissionais.
- **349:** operações intracomunitárias declaráveis **por operador e por tipo**.
- Tudo calculado a partir dos documentos registrados, **sem valores digitados à mão**.

### P6 — Persistência
- Os dados sobrevivem a um reload. O README deve deixar **claro qual sistema de persistência** foi usado.

### Opcionais (só se sobrar tempo)
Orçamentos, exportação PDF, contatos avançados, filtros, multiempresa, bancos, conciliação, configuração.
→ **Filtro por trimestre** já sai junto com Impostos. **Exportação PDF** de fatura é o primeiro opcional a atacar se sobrar tempo.

## 4. Casos de teste (critério de aceite)

Vão virar **testes unitários** do módulo de domínio e **dados de seed** da demo.

| Caso | Entrada | Esperado |
|---|---|---|
| **A** Fatura emitida | Cliente "Empresa Demo SL", base 1.000 €, IVA 21% | Total 1.210 €; aparece na listagem; o dashboard reflete; **+210 € de IVA repercutido** no 303 |
| **B** Fatura recebida | Base 1.000 €, IVA 21%, IRPF 15% | **Total a pagar 1.060 €** (1000 + 210 − 150); 210 € de IVA soportado (303); **150 € retidos** (111) |
| **C** Intracomunitária | Alemanha, base 2.000 €, prestação de serviços | Aparece no 349 com valor, operador (NIF-IVA `DE…`) e **chave S** |
| **D** OCR | PDF ou imagem de teste | Processa, extrai de verdade, campos editáveis, confirmar e salvar |
| **E** Persistência | Criar uma fatura e um gasto, recarregar | Os registros continuam lá e os resumos continuam coerentes |

> Com A + B no mesmo trimestre, o resultado do 303 fica em **0 €** (210 − 210). É um bom check visual na demo.

## 5. Regras fiscais (suposições simplificadas, documentadas no README)

As estimativas são orientativas e **não são declarações oficiais** (o próprio PDF pede isso).

- **Período:** trimestre natural (1T–4T) pela data da fatura. 303, 111 e 349 são apresentados por trimestre.
- **Tipos de IVA:** 21%, 10%, 4%, 0%.
- **Tipos de IRPF:** 15% (geral para profissionais), 7% (início de atividade), 0%.
- **Modelo 303**
  - Devengado = soma das cotas de IVA das faturas **emitidas** do trimestre.
  - Deducible = soma das cotas de IVA dos gastos **marcados como dedutíveis** do trimestre.
  - Resultado = devengado − deducible (positivo: a ingresar; negativo: a compensar).
  - Operações intracomunitárias emitidas: sem IVA repercutido (inversión del sujeto pasivo). Aparecem só como valor informativo.
- **Modelo 111**
  - Soma de `irpfAmount` dos gastos do trimestre com IRPF > 0, mais o número de perceptores (fornecedores distintos) e a base total.
- **Modelo 349**
  - Agrupa por **operador (NIF-IVA com prefixo do país) + chave**, somando as bases.
  - Chaves: `E` entregas de bens, `S` prestações de serviços (emitidas), `A` aquisições de bens, `I` aquisições de serviços (recebidas).
  - Uma fatura entra no 349 quando o contato é de um país UE ≠ ES, tem NIF-IVA e `operationType` é intracomunitário.
- **Dinheiro:** sempre em **centavos inteiros**. Quantidade em decimal. Arredondamento half-up. A cota de IVA é calculada sobre a base agrupada por tipo, como numa fatura real.
- **Numeração:** série correlativa por ano (`2026-0001`), atribuída no servidor ao salvar.

### Automação (pontua em "OCR e automatización" e na UX)
- Se o cliente selecionado é UE ≠ ES com NIF-IVA, a fatura **sugere automaticamente** "operación intracomunitaria", IVA 0% e chave 349.
- O gasto sugere IRPF 15% quando o fornecedor está marcado como profissional.
- O OCR procura o fornecedor pelo NIF. Se não existir, o fornecedor é criado já com os dados extraídos.
- Vencimento padrão = data + 30 dias. Status "vencida" é derivado (pendente e com vencimento no passado).

## 6. Stack (decidido)

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Front e back num só repo. Server Actions para mutações e Route Handler para o OCR, com a chave escondida no servidor. |
| UI | **Tailwind + shadcn/ui** + lucide-react | Componentes acessíveis e consistentes, rápidos de montar. Visual próprio, sem copiar o Contasimple. |
| Formulários | **Estado controlado + Zod** | O mesmo schema valida no cliente e no servidor. (O React Hook Form foi descartado: o `@hookform/resolvers` atual tem conflito de peer deps.) |
| Banco | **Postgres (Neon) + Prisma** | Persistência real que sobrevive ao deploy, com schema tipado. Já nasce com `companyId` para multiempresa. |
| OCR | **Claude (`claude-sonnet-5-5`) com visão** → JSON estruturado; **fallback com Tesseract.js + pdf.js + regex** quando não houver chave | Extração precisa de PDF e imagem. O fallback garante extração real mesmo sem chave. |
| Arquivos | **Vercel Blob** (ou, se apertar o tempo, só o nome do arquivo + dados extraídos) | "Guardar documentos" |
| Gráfico | Recharts | Evolução mensal no dashboard |
| Testes | **Vitest** no módulo de domínio | Casos A, B e C como testes |
| Deploy | **Vercel** + Neon | Link público de demo |

### Versões e particularidades (definidas no setup)
- **Next.js 16.4** com `cacheComponents` ligado. Leituras do banco chamam `connection()` e ficam dentro de `<Suspense>` (com skeleton). Mutações via Server Actions + `revalidatePath`.
- **Prisma 7.10**: client gerado em `src/generated/prisma`, conexão via `@prisma/adapter-pg` e config em `prisma.config.ts`.
- **shadcn/ui (estilo base-nova)** sobre **Base UI**, não Radix. Composição via prop `render`, não `asChild`.
- **npm 10** com `legacy-peer-deps=true` no `.npmrc`, para contornar um bug do npm com peers opcionais do vitest. A Vercel usa o mesmo `.npmrc`.
- **Auto-seed:** se o banco estiver vazio, a primeira visita cria os dados demo, então um deploy novo funciona sem rodar o seed à mão.
- No `Contact`, o NIF e o NIF-IVA ficam num campo só (`nif` + `country`). O NIF-IVA do 349 é derivado com o prefixo do país (e `EL` para a Grécia).

### Alternativas descartadas
- **SPA + IndexedDB:** é mais rápido, mas a persistência fica só no navegador, pontua menos em arquitetura e ainda precisaria de um backend à parte para esconder a chave do OCR.
- **Front + API separados (Nest/Express):** demonstra mais arquitetura, mas o risco de estourar as 3h é alto.
- **SQLite:** não persiste na Vercel (filesystem efêmero).
- **Textract / Document AI / Mindee:** o setup de conta e credenciais consome tempo, e o LLM devolve o JSON já no formato do domínio.

## 7. Arquitetura

```
src/
  app/
    (app)/
      layout.tsx            # shell: sidebar (desktop) / bottom nav ou drawer (mobile)
      page.tsx              # Dashboard
      facturas/             # listagem, nova, detalhe
      gastos/               # listagem, novo (manual ou via OCR), detalhe
      impuestos/            # 303 / 111 / 349 com seletor de trimestre
      contactos/            # listagem simples (criação inline nos formulários)
    api/ocr/route.ts        # upload → extração → JSON validado
  domain/                   # TS PURO, sem React e sem Prisma
    money.ts                # centavos, arredondamento, formatação EUR
    invoice.ts              # totais de linhas, agrupamento por tipo de IVA
    expense.ts              # base + IVA − IRPF
    taxes/{m303,m111,m349}.ts
    period.ts               # trimestres
    nif.ts                  # validação NIF/CIF/NIE e NIF-IVA UE
    __tests__/              # casos A, B, C, arredondamento
  server/
    db.ts                   # cliente Prisma
    repositories/           # acesso a dados (sempre filtrado por companyId)
    actions/                # Server Actions (validam com Zod e chamam domain + repo)
    ocr/
      claude.ts             # provider principal
      tesseract.ts          # fallback
      parse.ts              # normalização + validação cruzada
  components/
    ui/                     # shadcn
    money-input, vat-select, contact-combobox, status-badge, kpi-card, ...
  schemas/                  # Zod compartilhado
prisma/
  schema.prisma
  seed.ts                   # empresa demo + casos A, B e C
```

**Regra de ouro:** cálculos fiscais **só** dentro de `domain/`. Dashboard, impostos e formulários (preview ao vivo) chamam as mesmas funções. Assim não existe número que discorde entre telas.

### Modelo de dados (Prisma, resumido)

```
Company   id, name, nif, address, defaultVatRate, invoiceSeries
Contact   id, companyId, kind (CLIENT|SUPPLIER|BOTH), name, nif, country (ISO2),
          vatNumber?, email?, address?, isProfessional (bool), createdAt
Invoice   id, companyId, contactId, number (unique por company+ano), issueDate, dueDate,
          status (PENDING|PAID), paidAt?, operationType (DOMESTIC|EU_GOODS|EU_SERVICES),
          notes?, createdAt
InvoiceLine id, invoiceId, description, quantity (Decimal), unitPriceCents, vatRate
Expense   id, companyId, supplierId, number?, date, category, baseCents, vatRate,
          vatCents, irpfRate, irpfCents, totalCents, deductible (bool),
          operationType (DOMESTIC|EU_GOODS|EU_SERVICES), status (PENDING|PAID), paidAt?,
          documentId?, source (MANUAL|OCR), createdAt
Document  id, companyId, fileName, mimeType, url?, ocrProvider, ocrRaw (Json), createdAt
```

Os totais de fatura **não são persistidos**: são derivados das linhas pelo `domain/`. No gasto, os campos de cota são guardados porque vêm do documento (OCR ou entrada manual), e o domínio valida a coerência.

## 8. Fluxo do OCR

1. Usuário arrasta um PDF ou imagem (até 4 MB; o limite de body da Vercel é 4,5 MB) em **Gastos → Subir factura**.
2. `POST /api/ocr`: valida tipo e tamanho e aplica rate limit simples por IP.
3. **Provider Claude:** manda o arquivo como bloco `document` (PDF) ou `image`, pedindo uma saída estruturada (tool/JSON schema) com: `supplierName, supplierNif, supplierCountry, invoiceNumber, date, base, vatRate, vatAmount, irpfRate, irpfAmount, total, concept, confidence por campo`.
4. **Sem `ANTHROPIC_API_KEY`:** cai no fallback. pdf.js extrai a camada de texto (ou Tesseract.js faz OCR da imagem), e regex extrai NIF, datas, % e valores.
5. **Validação cruzada** no `domain/`: `base + iva − irpf ≈ total`, `iva ≈ base × tipo`, NIF válido. Divergências viram avisos amarelos no campo.
6. O formulário de gasto abre **pré-preenchido e editável**, com o arquivo visível ao lado (desktop). O fornecedor é casado pelo NIF ou criado.
7. Confirmar → salva `Document` + `Expense` (`source = OCR`). O dashboard e os impostos já refletem.

Segurança: a chave fica só como env var na Vercel, `.env.example` vai sem valores e nada sensível é commitado. Dados de exemplo fictícios.

## 9. Telas e UX

- **Dashboard:** 4 KPIs (Ingresos, Gastos, Balance, Pendiente de cobro com quantidade e €), card "IVA estimado del trimestre", gráfico de barras ingresos vs. gastos por mês, últimas 5 operações, botões rápidos "Nueva factura" e "Subir gasto".
- **Facturas:** tabela com número, cliente, data, total e status (badge clicável para marcar como cobrada). Formulário: combobox de cliente com "+ Crear cliente" inline, linhas dinâmicas e resumo ao vivo (base / IVA por tipo / total).
- **Gastos:** tabela + botão principal "Subir factura (OCR)" e secundário "Registrar manualmente". Resumo ao vivo com total a pagar.
- **Impuestos:** seletor de trimestre e três cards (303 / 111 / 349). Cada um mostra o detalhamento e o link para os documentos de origem, provando que o cálculo vem do banco.
- **Contactos:** listagem simples com edição.
- **Restablecer datos demo:** recria o seed, útil porque a demo é compartilhada entre avaliadores.
- Formatação `es-ES` (`1.210,00 €`, `dd/mm/aaaa`). Estados de vazio, loading e erro. Toasts de sucesso. Responsivo: sidebar no desktop, menu no mobile e tabelas que viram cards.

## 10. Plano de execução (180 min)

> Cronometrar desde o início e registrar o tempo real para o README.

| Bloco | Min | Entrega |
|---|---|---|
| 0 | 0–15 | `create-next-app`, Tailwind/shadcn, Prisma + Neon, **deploy do esqueleto na Vercel** (para não descobrir problema de deploy no final) |
| 1 | 15–35 | `domain/` (money, invoice, expense, 303/111/349, period) + testes dos casos A/B/C |
| 2 | 35–50 | Schema Prisma, migração, seed, layout com navegação, shell do dashboard |
| 3 | 50–85 | **Facturas:** criar (cliente inline + linhas), listar, detalhe, mudar status |
| 4 | 85–110 | **Gastos:** form manual com IRPF, listagem, histórico |
| 5 | 110–145 | **OCR:** rota, provider Claude, fallback, formulário pré-preenchido, salvar |
| 6 | 145–165 | **Impuestos** com seletor de trimestre + dashboard conectado de verdade |
| 7 | 165–180 | Reset de demo, rodar os casos A–E na produção, README, deploy final |

**Corte de escopo se atrasar** (nesta ordem): gráfico do dashboard → arquivo no Blob (guardar só os metadados) → fallback Tesseract (documentar como pendente) → tela de Contactos (manter só a criação inline).
**Nunca cortar:** circuito fatura → dashboard → 303, gasto com IRPF → 111, intracomunitária → 349, OCR real com Claude, persistência.

## 11. Checklist de entrega (seção 9 do PDF)

- [ ] Link público de demo (Vercel)
- [ ] Repositório Git
- [ ] README em espanhol com:
  - [ ] Como rodar (`pnpm i`, `.env`, `prisma migrate`, `seed`, `dev`)
  - [ ] Tecnologias: framework, banco **(Postgres/Neon via Prisma, informado explicitamente)** e serviços externos (Anthropic API, Vercel, Neon)
  - [ ] Funcionalidades: o que funciona, o que está incompleto e o que está simulado
  - [ ] Tempo investido (real)
  - [ ] Dificuldades encontradas e como foram resolvidas
  - [ ] Suposições fiscais (seção 5 deste documento)
  - [ ] Respostas às 3 perguntas finais
- [ ] (Opcional) Vídeo de até 3 min: fatura A → dashboard → gasto B via OCR → impostos → reload

## 12. Rascunho das respostas às perguntas finais

**1. Arquitetura para milhares de empresas**
- Multi-tenant com `companyId` em todas as tabelas + Row Level Security no Postgres.
- Autenticação real (SSO/OAuth) com RBAC por empresa (owner/contable/lector).
- Agregados fiscais materializados por trimestre, invalidados por evento, em vez de somar tudo em cada request.
- OCR assíncrono com fila (SQS/BullMQ) e workers, armazenamento em S3 com URLs assinadas, idempotência.
- Read replicas, cache, índices por (`companyId`, data).
- Auditoria imutável (requisito de faturamento: Verifactu/TicketBAI), criptografia em repouso, backups e observabilidade (OpenTelemetry).

**2. Melhorar o OCR**
- Pipeline em camadas: camada de texto do PDF quando existir, LLM de visão quando não existir.
- Validação aritmética e fiscal (NIF, coerência entre tipos e cotas), com score de confiança por campo e revisão humana só abaixo do limiar.
- Memória por fornecedor: templates e correções anteriores como few-shot.
- Detecção de duplicados (NIF + número + valor) e leitura de faturas eletrônicas estruturadas (Facturae/UBL) quando disponíveis.
- Caixa de entrada por e-mail para processar automaticamente.

**3. Três melhorias de produto**
1. **Conexão bancária (PSD2) + conciliação automática:** elimina o maior trabalho manual e fecha o ciclo de cobros e pagos.
2. **Compliance Verifactu + envio de faturas eletrônicas:** obrigatório na Espanha e um diferencial de confiança.
3. **Assistente fiscal proativo:** alertas de prazos, previsão de impostos e geração do rascunho oficial dos modelos para revisão do gestor.

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Estourar as 3h | Plano com cortes definidos; deploy no minuto 15 |
| OCR falhar ou ficar lento na demo | Fallback local, timeout com mensagem clara, entrada manual sempre disponível |
| Abuso ou custo da chave na demo pública | Rate limit por IP, limite de tamanho, modelo com custo controlado |
| Dados da demo bagunçados por outros avaliadores | Botão "Restablecer datos demo" |
| Erro de arredondamento | Centavos inteiros + testes unitários |
| Interpretação fiscal discutível | Suposições explícitas no README e rótulo "estimación, no declaración oficial" na UI |
