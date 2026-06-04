# Changelog

## 7.0.0-executive
- Complete UI redesign: dark executive command center replacing the basic admin panel
- Sidebar navigation with live badges for pending deals and agent reviews
- Agent Center page: configure Sales Agent margins, Accounting Agent fiscal rules, run Auditor on demand
- Deals page: full pipeline view with accept/reject actions, commission summary
- Invoices page: fiscal registry with invoice numbers, tax breakdown, status
- Finance: data table with color-coded income/expense, inline entry creation
- Overview: live agent event feed, open deals pipeline, audit status, KPI bar with 6 metrics
- Toast notification system
- Mobile responsive layout

## 6.0.0-autonomous-agents
- Multi-agent architecture: Sales Agent, Accounting Agent, Auditor Agent, Orchestrator
- Autonomous negotiation with configurable margin bands
- Instant deal closure → invoice → ledger in one atomic transaction
- Per-country fiscal profiles: AFIP (AR 21%), IRS (US 0%), Receita Federal (BR 12%)
- Value-based billing: 2% commission per closed deal

## 5.0.1-fixes
- Fixed OpenAI API call (wrong method, wrong model)
- Fixed profile never loading into AI prompts
- Fixed WhatsApp inbound (only logged, never replied)
- Added Procfile, gunicorn, PORT support, .gitignore
